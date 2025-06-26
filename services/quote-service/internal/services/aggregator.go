package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/quote-service/internal/models"
)

// AggregatorService combines quotes from multiple sources with advanced validation and optimization
type AggregatorService struct {
	LiFiService        *LiFiService
	OneInchService     *OneInchService
	RelayService       *RelayService
	DexScreenerService *DexScreenerService
	CacheService       *CacheService
	ExternalAPI        *ExternalAPIService
	
	// Performance and reliability optimizations
	providerMetrics map[string]*ProviderMetrics
	metricsMutex    sync.RWMutex
	
	// Validation configuration based on industry best practices
	maxPriceImpact       decimal.Decimal
	maxSlippageTolerance decimal.Decimal
	minQuoteValidityTime time.Duration
	maxQuoteValidityTime time.Duration
	
	// Circuit breaker for each provider
	circuitBreakers map[string]*CircuitBreaker
	cbMutex         sync.RWMutex
}

// ProviderMetrics tracks performance metrics for each provider (1inch pattern)
type ProviderMetrics struct {
	AvgResponseTime time.Duration
	SuccessRate     float64
	LastUsed        time.Time
	TotalRequests   int64
	SuccessCount    int64
	ErrorCount      int64
	LastError       string
	LastErrorTime   time.Time
}

// CircuitBreaker implements circuit breaker pattern for provider reliability
type CircuitBreaker struct {
	State         string    // CLOSED, OPEN, HALF_OPEN
	FailureCount  int64
	LastFailTime  time.Time
	NextRetryTime time.Time
	FailureThreshold int64
	RecoveryTimeout  time.Duration
}

// QuoteValidationLevel defines validation intensity
type QuoteValidationLevel int

const (
	ValidationFast QuoteValidationLevel = iota // Basic validation only
	ValidationStandard                         // Standard validation (default)
	ValidationStrict                          // Full validation with calldata verification
)

// NewAggregatorService creates a new aggregator service with industry-standard configurations
func NewAggregatorService(
	lifiService *LiFiService,
	oneInchService *OneInchService,
	relayService *RelayService,
	dexScreenerService *DexScreenerService,
	cacheService *CacheService,
	externalAPI *ExternalAPIService,
) *AggregatorService {
	return &AggregatorService{
		LiFiService:        lifiService,
		OneInchService:     oneInchService,
		RelayService:       relayService,
		DexScreenerService: dexScreenerService,
		CacheService:       cacheService,
		ExternalAPI:        externalAPI,
		providerMetrics:    make(map[string]*ProviderMetrics),
		circuitBreakers:    make(map[string]*CircuitBreaker),
		
		// Industry standard validation thresholds
		maxPriceImpact:       decimal.NewFromFloat(0.30),   // 30% max (LiFi standard)
		maxSlippageTolerance: decimal.NewFromFloat(0.50),   // 50% max (1inch standard)
		minQuoteValidityTime:  30 * time.Second,             // 30s min (industry standard)
		maxQuoteValidityTime:  5 * time.Minute,              // 5m max (1inch pattern)
	}
}

// GetBestQuote gets the best quote with intelligent validation and fallback strategies
func (a *AggregatorService) GetBestQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// Step 1: Check cache first for ultra-fast response (15 seconds TTL)
	cacheKey := fmt.Sprintf("quote:%d:%s:%s:%s", req.ChainID, req.FromToken, req.ToToken, req.Amount)
	var cachedQuote models.Quote
	if err := a.CacheService.Get(ctx, cacheKey, &cachedQuote); err == nil {
		// Validate cached quote is still fresh and accurate
		if time.Since(cachedQuote.CreatedAt) < 15*time.Second && cachedQuote.ExpiresAt.After(time.Now()) {
			logrus.WithFields(logrus.Fields{
				"fromToken": req.FromToken,
				"toToken":   req.ToToken,
				"provider":  cachedQuote.Provider,
				"age":       time.Since(cachedQuote.CreatedAt),
			}).Debug("Quote found in cache")
			return &cachedQuote, nil
		}
	}

	// Step 2: Multi-tier quote aggregation with intelligent timeout strategy
	startTime := time.Now()
	
	// Tier 1: Fast providers (1inch pattern - <400ms response time target)
	fastQuotes := a.getFastQuotes(ctx, req, 800*time.Millisecond)
	
	// If we have good fast quotes, validate and return immediately for speed
	if len(fastQuotes) > 0 {
		bestFastQuote := a.selectBestQuoteWithValidation(fastQuotes, ValidationFast)
		if bestFastQuote != nil {
			// Cache immediately and return
			go a.cacheQuote(cacheKey, bestFastQuote)
			logrus.WithFields(logrus.Fields{
				"provider":   bestFastQuote.Provider,
				"toAmount":   bestFastQuote.ToAmount,
				"duration":   time.Since(startTime),
				"tier":       "fast",
			}).Info("Fast quote selected")
			return bestFastQuote, nil
		}
	}
	
	// Tier 2: Extended timeout for comprehensive quotes (LiFi pattern)
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	
	allQuotes, err := a.getAllQuotesOptimized(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get quotes: %w", err)
	}

	if len(allQuotes) == 0 {
		return nil, fmt.Errorf("no quotes available")
	}

	// Step 3: Apply intelligent quote selection with validation
	bestQuote := a.selectBestQuoteWithValidation(allQuotes, ValidationStandard)
	if bestQuote == nil {
		return nil, fmt.Errorf("no valid quotes found after validation")
	}

	// Step 4: Cache the best quote for future requests
	go a.cacheQuote(cacheKey, bestQuote)

	logrus.WithFields(logrus.Fields{
		"fromToken":    req.FromToken,
		"toToken":      req.ToToken,
		"amount":       req.Amount,
		"bestProvider": bestQuote.Provider,
		"toAmount":     bestQuote.ToAmount,
		"quotesCount":  len(allQuotes),
		"totalTime":    time.Since(startTime),
	}).Info("Best quote selected with validation")

	return bestQuote, nil
}

// getFastQuotes gets quotes from fastest providers with aggressive timeout
func (a *AggregatorService) getFastQuotes(ctx context.Context, req *models.QuoteRequest, timeout time.Duration) []*models.Quote {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	
	// Get only the fastest providers based on metrics
	fastProviders := a.getFastestProviders(2) // Top 2 fastest
	
	quotes, _ := a.getQuotesFromSourcesOptimized(ctx, req, fastProviders)
	return quotes
}

// selectBestQuoteWithValidation selects best quote with appropriate validation level
func (a *AggregatorService) selectBestQuoteWithValidation(quotes []*models.Quote, level QuoteValidationLevel) *models.Quote {
	if len(quotes) == 0 {
		return nil
	}

	// Pre-filter quotes based on validation level
	validQuotes := make([]*models.Quote, 0, len(quotes))
	
	for _, quote := range quotes {
		if a.isQuoteValid(quote, level) {
			validQuotes = append(validQuotes, quote)
		}
	}
	
	if len(validQuotes) == 0 {
		logrus.Warn("No quotes passed validation")
		return nil
	}
	
	// Apply multi-criteria selection (LiFi pattern)
	return a.selectOptimalQuote(validQuotes)
}

// isQuoteValid validates quote based on validation level
func (a *AggregatorService) isQuoteValid(quote *models.Quote, level QuoteValidationLevel) bool {
	if quote == nil {
		return false
	}
	
	// Level 1: Fast validation (basic checks only)
	if quote.ToAmount.LessThanOrEqual(decimal.Zero) {
		return false
	}
	
	if quote.FromAmount.LessThanOrEqual(decimal.Zero) {
		return false
	}
	
	// Check quote expiration
	if quote.ExpiresAt.Before(time.Now()) {
		return false
	}
	
	if level == ValidationFast {
		return true
	}
	
	// Level 2: Standard validation
	if quote.PriceImpact.GreaterThan(a.maxPriceImpact) {
		logrus.WithFields(logrus.Fields{
			"provider":     quote.Provider,
			"priceImpact":  quote.PriceImpact,
			"maxAllowed":   a.maxPriceImpact,
		}).Warn("Quote exceeds max price impact")
		return false
	}
	
	if quote.SlippageTolerance.GreaterThan(a.maxSlippageTolerance) {
		return false
	}
	
	// Validate amount consistency
	if quote.ToAmountMin.GreaterThan(quote.ToAmount) {
		return false
	}
	
	if level == ValidationStandard {
		return true
	}
	
	// Level 3: Strict validation (includes calldata validation)
	if quote.CallData == "" {
		logrus.WithField("provider", quote.Provider).Warn("Quote missing call data")
		return false
	}
	
	if quote.To == "" {
		return false
	}
	
	// Additional calldata format validation
	if !strings.HasPrefix(quote.CallData, "0x") || len(quote.CallData) < 10 {
		return false
	}
	
	return true
}

// selectOptimalQuote selects the best quote using multi-criteria analysis
func (a *AggregatorService) selectOptimalQuote(quotes []*models.Quote) *models.Quote {
	if len(quotes) == 0 {
		return nil
	}
	
	if len(quotes) == 1 {
		return quotes[0]
	}
	
	// Multi-criteria scoring (LiFi pattern)
	type quoteScore struct {
		quote *models.Quote
		score float64
	}
	
	scores := make([]quoteScore, len(quotes))
	
	for i, quote := range quotes {
		score := a.calculateQuoteScore(quote)
		scores[i] = quoteScore{quote: quote, score: score}
	}
	
	// Sort by score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].score > scores[j].score
	})
	
	bestQuote := scores[0].quote
	
	logrus.WithFields(logrus.Fields{
		"provider":   bestQuote.Provider,
		"score":      scores[0].score,
		"toAmount":   bestQuote.ToAmount,
		"totalQuotes": len(quotes),
	}).Debug("Optimal quote selected")
	
	return bestQuote
}

// calculateQuoteScore calculates a comprehensive score for quote selection
func (a *AggregatorService) calculateQuoteScore(quote *models.Quote) float64 {
	score := 0.0
	
	// Primary factor: Output amount (70% weight)
	outputScore := float64(quote.ToAmount.InexactFloat64())
	score += outputScore * 0.7
	
	// Secondary factor: Price impact (15% weight - lower is better)
	priceImpactPenalty := float64(quote.PriceImpact.InexactFloat64()) * 1000 // Convert to penalty
	score -= priceImpactPenalty * 0.15
	
	// Tertiary factor: Gas cost (10% weight - lower is better)
	if quote.GasEstimate != nil {
		gasCostPenalty := float64(quote.GasEstimate.GasFee.InexactFloat64())
		score -= gasCostPenalty * 0.1
	}
	
	// Provider reliability factor (5% weight)
	a.metricsMutex.RLock()
	if metrics, exists := a.providerMetrics[quote.Provider]; exists {
		reliabilityBonus := metrics.SuccessRate * 100 // 0-100 bonus
		score += reliabilityBonus * 0.05
	}
	a.metricsMutex.RUnlock()
	
	return score
}

// getFastestProviders returns providers ordered by performance
func (a *AggregatorService) getFastestProviders(limit int) []string {
	allProviders := []string{
		models.ProviderLiFi,
		models.ProviderOneInch,
		"relay",
	}
	
	orderedProviders := a.getOrderedProviders(allProviders)
	
	if limit > 0 && limit < len(orderedProviders) {
		return orderedProviders[:limit]
	}
	
	return orderedProviders
}

// cacheQuote caches quote in background
func (a *AggregatorService) cacheQuote(cacheKey string, quote *models.Quote) {
	if err := a.CacheService.Set(context.Background(), cacheKey, quote, 15*time.Second); err != nil {
		logrus.WithError(err).Warn("Failed to cache best quote")
	}
}

// isCircuitBreakerOpen checks if circuit breaker is open for provider
func (a *AggregatorService) isCircuitBreakerOpen(provider string) bool {
	a.cbMutex.RLock()
	defer a.cbMutex.RUnlock()
	
	cb, exists := a.circuitBreakers[provider]
	if !exists {
		return false
	}
	
	if cb.State == "OPEN" {
		if time.Now().After(cb.NextRetryTime) {
			// Transition to HALF_OPEN
			cb.State = "HALF_OPEN"
			logrus.WithField("provider", provider).Info("Circuit breaker transitioning to HALF_OPEN")
		} else {
			return true
		}
	}
	
	return false
}

// recordProviderResult updates circuit breaker and metrics
func (a *AggregatorService) recordProviderResult(provider string, success bool, duration time.Duration, err error) {
	// Update metrics
	a.updateProviderMetrics(provider, duration, success)
	
	// Update circuit breaker
	a.cbMutex.Lock()
	defer a.cbMutex.Unlock()
	
	cb, exists := a.circuitBreakers[provider]
	if !exists {
		cb = &CircuitBreaker{
			State:            "CLOSED",
			FailureThreshold: 5,                // 5 failures threshold
			RecoveryTimeout:  30 * time.Second, // 30s recovery
		}
		a.circuitBreakers[provider] = cb
	}
	
	if success {
		cb.FailureCount = 0
		if cb.State == "HALF_OPEN" {
			cb.State = "CLOSED"
			logrus.WithField("provider", provider).Info("Circuit breaker closed")
		}
	} else {
		cb.FailureCount++
		cb.LastFailTime = time.Now()
		
		if cb.FailureCount >= cb.FailureThreshold && cb.State == "CLOSED" {
			cb.State = "OPEN"
			cb.NextRetryTime = time.Now().Add(cb.RecoveryTimeout)
			logrus.WithFields(logrus.Fields{
				"provider":     provider,
				"failureCount": cb.FailureCount,
				"nextRetry":    cb.NextRetryTime,
			}).Warn("Circuit breaker opened")
		}
	}
}

// CompareQuotes gets quotes from all sources and compares them
func (a *AggregatorService) CompareQuotes(ctx context.Context, req *models.CompareQuotesRequest) (*models.CompareQuotesResponse, error) {
	// Convert to QuoteRequest
	quoteReq := &models.QuoteRequest{
		FromToken:         req.FromToken,
		ToToken:           req.ToToken,
		Amount:            req.Amount,
		ChainID:           req.ChainID,
		ToChainID:         req.ToChainID,
		SlippageTolerance: req.SlippageTolerance,
		UserAddress:       req.UserAddress,
	}

	// Get quotes from requested sources or all sources
	var quotes []*models.Quote
	var err error

	if len(req.Sources) > 0 {
		quotes, err = a.getQuotesFromSources(ctx, quoteReq, req.Sources)
	} else {
		quotes, err = a.getAllQuotesOptimized(ctx, quoteReq)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get quotes: %w", err)
	}

	if len(quotes) == 0 {
		return nil, fmt.Errorf("no quotes available")
	}

	// Find best quote with validation
	bestQuote := a.selectBestQuoteWithValidation(quotes, ValidationStandard)

	// Generate comparison
	comparison := a.generateComparison(quotes)

	response := &models.CompareQuotesResponse{
		Quotes:      quotes,
		BestQuote:   bestQuote,
		Comparison:  comparison,
		RequestedAt: time.Now(),
	}

	logrus.WithFields(logrus.Fields{
		"fromToken":       req.FromToken,
		"toToken":         req.ToToken,
		"amount":          req.Amount,
		"quotesCount":     len(quotes),
		"bestProvider":    bestQuote.Provider,
		"priceDifference": comparison.PriceDifferencePercent,
	}).Info("Quote comparison completed")

	return response, nil
}

// GetTokenList gets tokens from all sources with ultra-fast aggregation and deduplication
func (a *AggregatorService) GetTokenList(ctx context.Context, chainID int) (*models.TokenListResponse, error) {
	// Check aggregated cache first for instant response
	aggregatedCacheKey := fmt.Sprintf("aggregated:tokens:%d", chainID)
	var aggregatedTokens models.TokenListResponse
	if err := a.CacheService.Get(ctx, aggregatedCacheKey, &aggregatedTokens); err == nil {
		// Check if cache is fresh enough (less than 30 seconds for ultra-fast response)
		if time.Since(aggregatedTokens.UpdatedAt) < 30*time.Second {
			logrus.WithField("chainID", chainID).Debug("Aggregated token list found in fresh cache")
			return &aggregatedTokens, nil
		}
	}

	// Check legacy cache as fallback
	if cachedList, err := a.CacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		logrus.WithField("chainID", chainID).Debug("Aggregated token list found in legacy cache")
		return cachedList, nil
	}

	// Ultra-aggressive timeout for token list - 2 seconds max
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	
	type result struct {
		provider string
		tokens   []*models.Token
		err      error
		duration time.Duration
	}

	results := make(chan result, 3)
	startTime := time.Now()

	// Get ordered providers by performance
	orderedProviders := a.getOrderedProviders([]string{"lifi", "oneinch", "relay"})

	// Launch concurrent requests with staggered timeouts (fastest first)
	for i, provider := range orderedProviders {
		go func(provider string, stagger time.Duration) {
			// Add small stagger to prevent thundering herd
			time.Sleep(stagger)
			
			start := time.Now()
			var tokens []*models.Token
			var err error
			
			switch provider {
			case "lifi":
				tokens, err = a.LiFiService.GetTokenList(ctx, chainID)
			case "oneinch":
				tokens, err = a.OneInchService.GetTokenList(ctx, chainID)
			case "relay":
				tokens, err = a.RelayService.GetTokenList(ctx, chainID)
			}
			
			results <- result{
				provider: provider, 
				tokens: tokens, 
				err: err,
				duration: time.Since(start),
			}
		}(provider, time.Duration(i*50)*time.Millisecond) // 50ms stagger
	}

	// Collect results with intelligent prioritization
	tokenMap := make(map[string]*models.Token)
	var errors []error
	providerStats := make(map[string]time.Duration)
	resultsCollected := 0
	
	// Fast collection with early termination
	timeout := time.NewTimer(1500 * time.Millisecond) // Even more aggressive
	defer timeout.Stop()
	
	for resultsCollected < len(orderedProviders) {
		select {
		case res := <-results:
			resultsCollected++
			providerStats[res.provider] = res.duration
			
			// Update provider metrics for future optimization
			a.updateProviderMetrics(res.provider, res.duration, res.err == nil)
			
			if res.err != nil {
				logrus.WithFields(logrus.Fields{
					"provider": res.provider,
					"duration": res.duration,
					"error":    res.err,
				}).Warn("Provider failed to fetch tokens")
				errors = append(errors, res.err)
				continue
			}

			if res.tokens != nil {
				logrus.WithFields(logrus.Fields{
					"provider":    res.provider,
					"tokenCount":  len(res.tokens),
					"duration":    res.duration,
				}).Info("Provider tokens retrieved")

				// Merge tokens with quality-based deduplication and prioritization
				for _, token := range res.tokens {
					key := strings.ToLower(token.Address)
					
					// Skip invalid tokens
					if token.Address == "" || token.Symbol == "" {
						continue
					}
					
					existing, exists := tokenMap[key]
					if !exists {
						tokenMap[key] = token
					} else {
						// Keep higher quality token
						if a.getTokenQualityScore(token) > a.getTokenQualityScore(existing) {
							tokenMap[key] = token
						}
					}
				}
			}
			
			// Early termination if we have enough tokens from fast providers
			if len(tokenMap) > 100 && res.provider == orderedProviders[0] {
				logrus.WithField("provider", res.provider).Info("Early termination - sufficient tokens from fastest provider")
				break
			}
			
		case <-timeout.C:
			logrus.WithField("timeout", "1.5s").Warn("Token list aggregation timeout - using partial results")
			break
		}
	}

	totalTime := time.Since(startTime)

	// Optimally order tokens (popular first, then by quality)
	tokens := a.orderTokensOptimally(tokenMap)

	// Cache popular tokens separately for ultra-fast access
	go a.cachePopularTokens(context.Background(), tokens, chainID)

	response := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"cacheStatus":   "aggregated",
			"sources":       []string{"lifi", "oneinch", "relay"},
			"totalTime":     totalTime,
			"providersUsed": len(providerStats),
			"providerStats": providerStats,
			"errors":        len(errors),
		},
	}

	// Cache aggregated result for 5 minutes
	if err := a.CacheService.Set(ctx, aggregatedCacheKey, response, 5*time.Minute); err != nil {
		logrus.WithError(err).Warn("Failed to cache aggregated token list")
	}

	logrus.WithFields(logrus.Fields{
		"chainID":       chainID,
		"totalTokens":   len(tokens),
		"totalTime":     totalTime,
		"providersUsed": len(providerStats),
		"errors":        len(errors),
	}).Info("Token list aggregation completed")

	return response, nil
}

// getTokenQualityScore calculates a quality score for token prioritization
func (a *AggregatorService) getTokenQualityScore(token *models.Token) float64 {
	score := 0.0
	
	// Base score
	score += 1.0
	
	// Logo bonus
	if token.LogoURI != "" {
		score += 2.0
	}
	
	// Price data bonus
	if !token.PriceUSD.IsZero() {
		score += 3.0
	}
	
	// Native token bonus
	if token.IsNative {
		score += 5.0
	}
	
	// Metadata bonuses
	if token.Metadata != nil {
		if verified, ok := token.Metadata["isVerified"].(bool); ok && verified {
			score += 4.0
		}
		if popular, ok := token.Metadata["isPopular"].(bool); ok && popular {
			score += 6.0
		}
		if stable, ok := token.Metadata["isStable"].(bool); ok && stable {
			score += 3.0
		}
	}
	
	return score
}

// orderTokensOptimally orders tokens for optimal user experience
func (a *AggregatorService) orderTokensOptimally(tokenMap map[string]*models.Token) []*models.Token {
	var nativeTokens []*models.Token
	var popularTokens []*models.Token
	var stablecoins []*models.Token
	var verifiedTokens []*models.Token
	var withPriceTokens []*models.Token
	var otherTokens []*models.Token

	for _, token := range tokenMap {
		switch {
		case token.IsNative:
			nativeTokens = append(nativeTokens, token)
		case a.isPopularToken(token):
			popularTokens = append(popularTokens, token)
		case a.isStablecoin(token):
			stablecoins = append(stablecoins, token)
		case a.isVerifiedToken(token):
			verifiedTokens = append(verifiedTokens, token)
		case !token.PriceUSD.IsZero():
			withPriceTokens = append(withPriceTokens, token)
		default:
			otherTokens = append(otherTokens, token)
		}
	}

	// Sort each category
	sortBySymbol := func(tokens []*models.Token) {
		sort.Slice(tokens, func(i, j int) bool {
			return tokens[i].Symbol < tokens[j].Symbol
		})
	}

	sortBySymbol(nativeTokens)
	sortBySymbol(popularTokens)
	sortBySymbol(stablecoins)
	sortBySymbol(verifiedTokens)
	
	// Sort tokens with price by market cap (price * circulating supply approximation)
	sort.Slice(withPriceTokens, func(i, j int) bool {
		if !withPriceTokens[i].PriceUSD.Equal(withPriceTokens[j].PriceUSD) {
			return withPriceTokens[i].PriceUSD.GreaterThan(withPriceTokens[j].PriceUSD)
		}
		return withPriceTokens[i].Symbol < withPriceTokens[j].Symbol
	})
	
	sortBySymbol(otherTokens)

	// Combine in optimal order
	result := append(nativeTokens, popularTokens...)
	result = append(result, stablecoins...)
	result = append(result, verifiedTokens...)
	result = append(result, withPriceTokens...)
	return append(result, otherTokens...)
}

// Helper methods for token categorization
func (a *AggregatorService) isPopularToken(token *models.Token) bool {
	if token.Metadata != nil {
		if popular, ok := token.Metadata["isPopular"].(bool); ok {
			return popular
		}
	}
	
	// Fallback to address-based detection
	popularAddresses := map[string]bool{
		"0x0000000000000000000000000000000000000000": true, // ETH
		"0x4200000000000000000000000000000000000006": true, // WETH (Base)
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": true, // WETH (Ethereum)
	}
	return popularAddresses[strings.ToLower(token.Address)]
}

func (a *AggregatorService) isStablecoin(token *models.Token) bool {
	if token.Metadata != nil {
		if stable, ok := token.Metadata["isStable"].(bool); ok {
			return stable
		}
	}
	
	// Fallback to symbol-based detection
	stableSymbols := map[string]bool{
		"USDC": true, "USDT": true, "DAI": true, "FRAX": true,
		"USDB": true, "USDBC": true, "USDbC": true,
	}
	return stableSymbols[strings.ToUpper(token.Symbol)]
}

func (a *AggregatorService) isVerifiedToken(token *models.Token) bool {
	if token.Metadata != nil {
		if verified, ok := token.Metadata["isVerified"].(bool); ok {
			return verified
		}
	}
	return false
}

// cachePopularTokens caches popular tokens separately for instant access
func (a *AggregatorService) cachePopularTokens(ctx context.Context, tokens []*models.Token, chainID int) {
	var popularTokens []*models.Token
	
	for _, token := range tokens {
		if a.isPopularToken(token) || token.IsNative || a.isStablecoin(token) {
			popularTokens = append(popularTokens, token)
		}
	}
	
	// Cache popular tokens with longer TTL
	popularKey := fmt.Sprintf("popular:tokens:%d", chainID)
	if err := a.CacheService.Set(ctx, popularKey, popularTokens, 5*time.Minute); err != nil {
		logrus.WithError(err).Warn("Failed to cache popular tokens")
	}
	
	logrus.WithFields(logrus.Fields{
		"chainID":      chainID,
		"popularCount": len(popularTokens),
	}).Debug("Popular tokens cached separately")
}

// GetPopularTokens gets only popular tokens for quick loading
func (a *AggregatorService) GetPopularTokens(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Check popular tokens cache first
	popularKey := fmt.Sprintf("popular:tokens:%d", chainID)
	var popularTokens []*models.Token
	if err := a.CacheService.Get(ctx, popularKey, &popularTokens); err == nil {
		logrus.WithField("chainID", chainID).Debug("Popular tokens found in cache")
		return popularTokens, nil
	}
	
	// Fallback to full token list and filter
	tokenList, err := a.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}
	
	for _, token := range tokenList.Tokens {
		if a.isPopularToken(token) || token.IsNative || a.isStablecoin(token) {
			popularTokens = append(popularTokens, token)
		}
	}
	
	// Cache for future requests
	go a.CacheService.Set(context.Background(), popularKey, popularTokens, 5*time.Minute)
	
	return popularTokens, nil
}

// GetTokenPrice gets token price from multiple sources with fast-fail optimization
func (a *AggregatorService) GetTokenPrice(ctx context.Context, token string, chainID int) (*models.PriceResponse, error) {
	// Check cache first
	if cachedPrice, err := a.CacheService.GetTokenPrice(ctx, token, chainID); err == nil && cachedPrice != nil {
		logrus.WithFields(logrus.Fields{
			"token":   token,
			"chainID": chainID,
		}).Debug("Token price found in cache")
		return cachedPrice, nil
	}

	// Ultra-aggressive timeout for price fetching - 1.5 seconds max
	ctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	// Try to get price from different sources
	type result struct {
		provider string
		price    *models.PriceResponse
		err      error
		duration time.Duration
	}

	results := make(chan result, 2)
	
	// Get ordered providers for price fetching
	priceProviders := []string{models.ProviderLiFi, models.ProviderDexScreener}
	orderedProviders := a.getOrderedProviders(priceProviders)

	// Launch concurrent requests with staggered timing
	for i, provider := range orderedProviders {
		go func(provider string, stagger time.Duration) {
			if stagger > 0 {
				time.Sleep(stagger)
			}
			
			start := time.Now()
			var price *models.PriceResponse
			var err error
			
			switch provider {
			case models.ProviderLiFi:
				price, err = a.LiFiService.GetTokenPrice(ctx, token, chainID)
			case models.ProviderDexScreener:
				price, err = a.DexScreenerService.GetTokenPrice(ctx, token, chainID)
			}
			
			duration := time.Since(start)
			a.updateProviderMetrics(provider, duration, err == nil && price != nil)
			
			results <- result{
				provider: provider, 
				price: price, 
				err: err,
				duration: duration,
			}
		}(provider, time.Duration(i*100)*time.Millisecond) // 100ms stagger
	}

	// Fast collection with timeout
	timeout := time.NewTimer(1200 * time.Millisecond) // Even more aggressive
	defer timeout.Stop()
	
	resultsCollected := 0
	for resultsCollected < len(orderedProviders) {
		select {
		case res := <-results:
			resultsCollected++
			
			if res.err == nil && res.price != nil {
				// Cache the price immediately in background
				go func(price *models.PriceResponse) {
					if err := a.CacheService.SetTokenPrice(context.Background(), token, chainID, price); err != nil {
						logrus.WithError(err).Warn("Failed to cache token price")
					}
				}(res.price)

				logrus.WithFields(logrus.Fields{
					"token":    token,
					"chainID":  chainID,
					"provider": res.provider,
					"price":    res.price.Price,
					"duration": res.duration,
				}).Info("Token price retrieved")

				return res.price, nil
			}
			
			// If this was the fastest provider and it failed, continue to others
			logrus.WithFields(logrus.Fields{
				"provider": res.provider,
				"duration": res.duration,
				"error":    res.err,
			}).Warn("Price provider failed")
			
		case <-timeout.C:
			logrus.WithField("timeout", "1.2s").Warn("Token price fetch timeout")
			break
		}
	}

	return nil, fmt.Errorf("no price available for token %s on chain %d", token, chainID)
}

// GetMultipleTokenPrices gets prices for multiple tokens
func (a *AggregatorService) GetMultipleTokenPrices(ctx context.Context, tokens []string, chainID int) (*models.MultiPriceResponse, error) {
	prices := make(map[string]*models.PriceResponse)
	var wg sync.WaitGroup
	var mu sync.Mutex

	// Get prices concurrently
	for _, token := range tokens {
		wg.Add(1)
		go func(token string) {
			defer wg.Done()
			
			price, err := a.GetTokenPrice(ctx, token, chainID)
			if err != nil {
				logrus.WithFields(logrus.Fields{
					"token":   token,
					"chainID": chainID,
					"error":   err,
				}).Warn("Failed to get token price")
				return
			}

			mu.Lock()
			prices[token] = price
			mu.Unlock()
		}(token)
	}

	wg.Wait()

	response := &models.MultiPriceResponse{
		Prices:    prices,
		Currency:  models.CurrencyUSD,
		UpdatedAt: time.Now(),
	}

	logrus.WithFields(logrus.Fields{
		"requestedTokens": len(tokens),
		"foundPrices":     len(prices),
		"chainID":         chainID,
	}).Info("Multiple token prices retrieved")

	return response, nil
}

// getAllQuotes gets quotes from all available sources - legacy function for compatibility
func (a *AggregatorService) getAllQuotes(ctx context.Context, req *models.QuoteRequest) ([]*models.Quote, error) {
	return a.getAllQuotesOptimized(ctx, req)
}

// getQuotesFromSources gets quotes from specified sources - legacy function for compatibility  
func (a *AggregatorService) getQuotesFromSources(ctx context.Context, req *models.QuoteRequest, sources []string) ([]*models.Quote, error) {
	return a.getQuotesFromSourcesOptimized(ctx, req, sources)
}

// findBestQuote finds the quote with the highest output amount
func (a *AggregatorService) findBestQuote(quotes []*models.Quote) *models.Quote {
	if len(quotes) == 0 {
		return nil
	}

	bestQuote := quotes[0]
	for _, quote := range quotes[1:] {
		// Compare output amounts (higher is better)
		if quote.ToAmount.GreaterThan(bestQuote.ToAmount) {
			bestQuote = quote
		} else if quote.ToAmount.Equal(bestQuote.ToAmount) {
			// If output amounts are equal, prefer lower gas cost
			if quote.GasEstimate != nil && bestQuote.GasEstimate != nil {
				if quote.GasEstimate.GasFee.LessThan(bestQuote.GasEstimate.GasFee) {
					bestQuote = quote
				}
			}
		}
	}

	return bestQuote
}

// generateComparison generates comparison metrics between quotes
func (a *AggregatorService) generateComparison(quotes []*models.Quote) *models.QuoteComparison {
	if len(quotes) == 0 {
		return nil
	}

	// Find best and worst prices
	bestPrice := quotes[0].Price
	worstPrice := quotes[0].Price
	var bestGas, worstGas *models.GasEstimate

	for _, quote := range quotes {
		if quote.Price.GreaterThan(bestPrice) {
			bestPrice = quote.Price
		}
		if quote.Price.LessThan(worstPrice) {
			worstPrice = quote.Price
		}

		if quote.GasEstimate != nil {
			if bestGas == nil || quote.GasEstimate.GasFee.LessThan(bestGas.GasFee) {
				bestGas = quote.GasEstimate
			}
			if worstGas == nil || quote.GasEstimate.GasFee.GreaterThan(worstGas.GasFee) {
				worstGas = quote.GasEstimate
			}
		}
	}

	// Calculate price difference
	priceDifference := bestPrice.Sub(worstPrice)
	priceDifferencePercent := decimal.Zero
	if !worstPrice.IsZero() {
		priceDifferencePercent = priceDifference.Div(worstPrice).Mul(decimal.NewFromInt(100))
	}

	return &models.QuoteComparison{
		BestPrice:              bestPrice,
		WorstPrice:             worstPrice,
		PriceDifference:        priceDifference,
		PriceDifferencePercent: priceDifferencePercent,
		BestGasEstimate:        bestGas,
		WorstGasEstimate:       worstGas,
	}
}

// SearchTokensExternal searches tokens using external APIs with auto-detection
func (a *AggregatorService) SearchTokensExternal(ctx context.Context, query string, limit int) ([]*models.Token, error) {
	return a.ExternalAPI.SearchTokensExternal(ctx, query)
}

// getAllQuotesOptimized gets quotes from all available sources with fast-fail optimization
func (a *AggregatorService) getAllQuotesOptimized(ctx context.Context, req *models.QuoteRequest) ([]*models.Quote, error) {
	// Order providers by performance
	orderedProviders := a.getOrderedProviders([]string{
		models.ProviderLiFi,
		models.ProviderOneInch,
		"relay",
	})

	return a.getQuotesFromSourcesOptimized(ctx, req, orderedProviders)
}

// getQuotesFromSourcesOptimized gets quotes from specified sources with circuit breaker and validation
func (a *AggregatorService) getQuotesFromSourcesOptimized(ctx context.Context, req *models.QuoteRequest, sources []string) ([]*models.Quote, error) {
	type result struct {
		provider string
		quote    *models.Quote
		err      error
		duration time.Duration
	}

	// Filter out providers with open circuit breakers
	availableSources := make([]string, 0, len(sources))
	for _, provider := range sources {
		if !a.isCircuitBreakerOpen(provider) {
			availableSources = append(availableSources, provider)
		} else {
			logrus.WithField("provider", provider).Debug("Skipping provider due to open circuit breaker")
		}
	}
	
	if len(availableSources) == 0 {
		return nil, fmt.Errorf("all providers have open circuit breakers")
	}

	results := make(chan result, len(availableSources))
	
	// Launch available providers concurrently with optimized staggering
	for i, source := range availableSources {
		go func(provider string, stagger time.Duration) {
			// Smart staggering based on provider performance
			if stagger > 0 {
				time.Sleep(stagger)
			}
			
			start := time.Now()
			var quote *models.Quote
			var err error

			// Route to appropriate service with error handling
			switch provider {
			case models.ProviderLiFi:
				quote, err = a.LiFiService.GetQuote(ctx, req)
			case models.ProviderOneInch:
				quote, err = a.OneInchService.GetQuote(ctx, req)
			case "relay":
				quote, err = a.RelayService.GetQuote(ctx, req)
			default:
				err = fmt.Errorf("unknown provider: %s", provider)
			}

			duration := time.Since(start)
			success := err == nil && quote != nil
			
			// Record result for circuit breaker and metrics
			a.recordProviderResult(provider, success, duration, err)

			results <- result{
				provider: provider, 
				quote: quote, 
				err: err,
				duration: duration,
			}
		}(source, time.Duration(i*50)*time.Millisecond) // Reduced stagger for speed
	}

	// Intelligent result collection with tiered timeout strategy
	var quotes []*models.Quote
	var errors []error
	resultsCollected := 0
	
	// Dynamic timeout based on context and request urgency
	timeoutDuration := 2*time.Second
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < timeoutDuration {
			timeoutDuration = remaining - 100*time.Millisecond // Leave buffer
		}
	}
	
	timeout := time.NewTimer(timeoutDuration)
	defer timeout.Stop()
	
	// Early termination conditions for speed optimization
	earlyTerminationThreshold := 2 // Return after 2 good quotes for speed
	
	for resultsCollected < len(availableSources) {
		select {
		case res := <-results:
			resultsCollected++
			
			if res.err != nil {
				logrus.WithFields(logrus.Fields{
					"provider": res.provider,
					"error":    res.err,
					"duration": res.duration,
				}).Debug("Provider failed to get quote")
				errors = append(errors, res.err)
				continue
			}

			if res.quote != nil {
				// Quick validation before adding to results
				if a.isQuoteValid(res.quote, ValidationFast) {
					quotes = append(quotes, res.quote)
					
					logrus.WithFields(logrus.Fields{
						"provider": res.provider,
						"toAmount": res.quote.ToAmount,
						"duration": res.duration,
					}).Debug("Valid quote received")
					
					// Intelligent early termination strategies
					// Strategy 1: Fast-fail with single best provider quote
					if res.provider == availableSources[0] && len(quotes) == 1 {
						// Check if this is significantly better than waiting
						if res.duration < 500*time.Millisecond {
							logrus.WithField("provider", res.provider).Info("Fast-fail: returning quote from fastest provider")
							break
						}
					}
					
					// Strategy 2: Multiple good quotes available
					if len(quotes) >= earlyTerminationThreshold {
						logrus.WithField("quotesCount", len(quotes)).Info("Multiple quotes available - early return for speed")
						break
					}
				} else {
					logrus.WithField("provider", res.provider).Debug("Quote failed fast validation, skipping")
				}
			}
			
		case <-timeout.C:
			logrus.WithFields(logrus.Fields{
				"timeout":          timeoutDuration,
				"resultsCollected": resultsCollected,
				"quotesFound":     len(quotes),
			}).Debug("Quote aggregation timeout - using available results")
			break
		}
	}

	logrus.WithFields(logrus.Fields{
		"requestedSources": len(sources),
		"availableSources": len(availableSources),
		"successfulQuotes": len(quotes),
		"errors":          len(errors),
		"resultsCollected": resultsCollected,
		"totalDuration":    timeoutDuration,
	}).Debug("Optimized quote aggregation completed")

	return quotes, nil
}

// getOrderedProviders returns providers ordered by performance metrics
func (a *AggregatorService) getOrderedProviders(providers []string) []string {
	a.metricsMutex.RLock()
	defer a.metricsMutex.RUnlock()

	type providerScore struct {
		provider string
		score    float64
	}

	scores := make([]providerScore, 0, len(providers))
	for _, provider := range providers {
		metric := a.providerMetrics[provider]
		if metric == nil {
			// Default score for new providers
			scores = append(scores, providerScore{provider: provider, score: 1000.0})
			continue
		}

		// Score = response time (ms) + failure penalty
		score := float64(metric.AvgResponseTime.Milliseconds())
		if metric.SuccessRate < 0.9 {
			score += 500 // penalty for low success rate
		}
		
		scores = append(scores, providerScore{provider: provider, score: score})
	}

	// Sort by score (lower is better)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].score < scores[j].score
	})

	ordered := make([]string, len(scores))
	for i, score := range scores {
		ordered[i] = score.provider
	}

	return ordered
}

// updateProviderMetrics updates performance metrics for providers
func (a *AggregatorService) updateProviderMetrics(provider string, duration time.Duration, success bool) {
	a.metricsMutex.Lock()
	defer a.metricsMutex.Unlock()

	metric, exists := a.providerMetrics[provider]
	if !exists {
		metric = &ProviderMetrics{
			AvgResponseTime: duration,
			SuccessRate:     1.0,
			LastUsed:        time.Now(),
			TotalRequests:   1,
			SuccessCount:    0,
		}
	}

	// Exponential moving average for response time
	alpha := 0.3 // smoothing factor
	metric.AvgResponseTime = time.Duration(float64(metric.AvgResponseTime)*alpha + float64(duration)*(1-alpha))
	
	metric.TotalRequests++
	if success {
		metric.SuccessCount++
	}
	
	// Calculate success rate
	metric.SuccessRate = float64(metric.SuccessCount) / float64(metric.TotalRequests)
	metric.LastUsed = time.Now()

	a.providerMetrics[provider] = metric
} 