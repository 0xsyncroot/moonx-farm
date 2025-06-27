package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
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
		maxPriceImpact:       decimal.NewFromFloat(0.30), // 30% max (LiFi standard)
		maxSlippageTolerance: decimal.NewFromFloat(0.50), // 50% max (1inch standard)
		minQuoteValidityTime: 30 * time.Second,           // 30s min (industry standard)
		maxQuoteValidityTime: 5 * time.Minute,            // 5m max (1inch pattern)
	}
}

// GetBestQuote gets the best quote with intelligent validation and fallback strategies
func (a *AggregatorService) GetBestQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// Get ordered quotes
	quotesResponse, err := a.GetQuotes(ctx, req)
	if err != nil {
		return nil, err
	}

	if len(quotesResponse.Quotes) == 0 {
		return nil, fmt.Errorf("no valid quotes found")
	}

	// Return the first quote (best one)
	return quotesResponse.Quotes[0], nil
}

// GetQuotes gets all quotes from providers and returns them ordered by quality (best first)
func (a *AggregatorService) GetQuotes(ctx context.Context, req *models.QuoteRequest) (*models.QuotesResponse, error) {
	// Skip cache check for maximum speed - go straight to providers
	startTime := time.Now()
	logrus.WithFields(logrus.Fields{
		"fromToken": req.FromToken,
		"toToken":   req.ToToken,
		"amount":    req.Amount.String(),
		"chainID":   req.ChainID,
	}).Info("🎯 Starting quote aggregation")

	// Use generous timeout to avoid context cancellation
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second) // 15 seconds - generous timeout
	defer cancel()

	aggregationStart := time.Now()
	logrus.Info("📊 Starting provider aggregation...")

	allQuotes, err := a.getAllQuotesOptimizedMultiple(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get quotes: %w", err)
	}

	aggregationDuration := time.Since(aggregationStart)
	logrus.WithFields(logrus.Fields{
		"duration":    aggregationDuration,
		"quotesFound": len(allQuotes),
	}).Info("✅ Provider aggregation completed")

	if len(allQuotes) == 0 {
		return nil, fmt.Errorf("no quotes available")
	}

	// Step 3: Order quotes by quality (best first) - simplified
	sortStart := time.Now()
	logrus.Info("🔄 Sorting quotes by quality...")

	orderedQuotes := a.orderQuotesByQuality(allQuotes, ValidationFast) // Use fast validation

	sortDuration := time.Since(sortStart)
	logrus.WithFields(logrus.Fields{
		"duration":      sortDuration,
		"quotesOrdered": len(orderedQuotes),
	}).Info("✅ Quote sorting completed")

	totalTime := time.Since(startTime)

	// Log final summary with detailed breakdown
	bestProvider := "none"
	bestAmount := "0"
	if len(orderedQuotes) > 0 {
		bestProvider = orderedQuotes[0].Provider
		bestAmount = orderedQuotes[0].ToAmount.String()
	}

	logrus.WithFields(logrus.Fields{
		"totalDuration":       totalTime,
		"aggregationDuration": aggregationDuration,
		"sortDuration":        sortDuration,
		"quotesFound":         len(allQuotes),
		"quotesReturned":      len(orderedQuotes),
		"bestProvider":        bestProvider,
		"bestAmount":          bestAmount,
		"performance":         fmt.Sprintf("%.0fms total", float64(totalTime.Nanoseconds())/1000000),
	}).Info("🏆 Quote aggregation COMPLETED")

	response := &models.QuotesResponse{
		Quotes:       orderedQuotes,
		QuotesCount:  len(orderedQuotes),
		ResponseTime: totalTime,
		CreatedAt:    time.Now(),
		Metadata: map[string]interface{}{
			"providers":            a.getProvidersFromQuotes(orderedQuotes),
			"strategy":             "fast_aggregation",
			"aggregationTime":      aggregationDuration.Milliseconds(),
			"sortTime":             sortDuration.Milliseconds(),
			"totalTimeMs":          totalTime.Milliseconds(),
			"performanceOptimized": true,
		},
	}

	// Skip caching for speed - cache in background if needed
	go func() {
		cacheKey := fmt.Sprintf("quotes:%d:%s:%s:%s", req.ChainID, req.FromToken, req.ToToken, req.Amount)
		if err := a.CacheService.Set(context.Background(), cacheKey, response, 30*time.Second); err != nil {
			// Silent fail - don't log to avoid overhead
		}
	}()

	return response, nil
}

// GetAllQuotes gets all quotes from providers and returns them with best quote suggestion
// DEPRECATED: Use GetQuotes instead for simplified response
func (a *AggregatorService) GetAllQuotes(ctx context.Context, req *models.QuoteRequest) (*models.AllQuotesResponse, error) {
	// Convert to simplified response
	quotesResp, err := a.GetQuotes(ctx, req)
	if err != nil {
		return nil, err
	}

	var bestQuote *models.Quote
	if len(quotesResp.Quotes) > 0 {
		bestQuote = quotesResp.Quotes[0] // First quote is the best
	}

	return &models.AllQuotesResponse{
		AllQuotes:    quotesResp.Quotes,
		BestQuote:    bestQuote,
		QuotesCount:  quotesResp.QuotesCount,
		ResponseTime: quotesResp.ResponseTime,
		CreatedAt:    quotesResp.CreatedAt,
		Metadata:     quotesResp.Metadata,
	}, nil
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

	// Get ordered quotes
	quotesResponse, err := a.GetQuotes(ctx, quoteReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get quotes: %w", err)
	}

	if len(quotesResponse.Quotes) == 0 {
		return nil, fmt.Errorf("no quotes available")
	}

	// Generate comparison
	comparison := a.generateComparison(quotesResponse.Quotes)

	response := &models.CompareQuotesResponse{
		Quotes:      quotesResponse.Quotes, // Already ordered with best first
		Comparison:  comparison,
		RequestedAt: time.Now(),
	}

	logrus.WithFields(logrus.Fields{
		"fromToken":       req.FromToken,
		"toToken":         req.ToToken,
		"amount":          req.Amount,
		"quotesCount":     len(quotesResponse.Quotes),
		"bestProvider":    quotesResponse.Quotes[0].Provider,
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
		// Check if cache is fresh enough (less than 5 minutes)
		if time.Since(aggregatedTokens.UpdatedAt) < 5*time.Minute {
			logrus.WithField("chainID", chainID).Debug("Aggregated token list found in fresh cache")
			return &aggregatedTokens, nil
		}
	}

	// Use generous timeout for token list
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
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

	// Launch concurrent requests
	for _, provider := range orderedProviders {
		go func(provider string) {
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
				tokens:   tokens,
				err:      err,
				duration: time.Since(start),
			}
		}(provider)
	}

	// Collect results with generous timeout
	tokenMap := make(map[string]*models.Token)
	var errors []error
	providerStats := make(map[string]time.Duration)
	resultsCollected := 0

	// Generous timeout for collection
	timeout := time.NewTimer(8 * time.Second)
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
					"provider":   res.provider,
					"tokenCount": len(res.tokens),
					"duration":   res.duration,
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

		case <-timeout.C:
			logrus.WithField("timeout", "8s").Info("Token list aggregation timeout - using partial results")
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

	// Cache aggregated result for 10 minutes
	if err := a.CacheService.Set(ctx, aggregatedCacheKey, response, 10*time.Minute); err != nil {
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

	// Use generous timeout for price fetching
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
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

	// Launch concurrent requests
	for _, provider := range orderedProviders {
		go func(provider string) {
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
				price:    price,
				err:      err,
				duration: duration,
			}
		}(provider)
	}

	// Collect results with generous timeout
	timeout := time.NewTimer(6 * time.Second)
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

			// If provider failed, log and continue to others
			logrus.WithFields(logrus.Fields{
				"provider": res.provider,
				"duration": res.duration,
				"error":    res.err,
			}).Warn("Price provider failed")

		case <-timeout.C:
			logrus.WithField("timeout", "6s").Warn("Token price fetch timeout")
			break
		}
	}

	return nil, fmt.Errorf("no price available for token %s on chain %d", token, chainID)
}

// Helper functions
func (a *AggregatorService) cacheQuotes(cacheKey string, response *models.QuotesResponse) {
	if err := a.CacheService.Set(context.Background(), cacheKey, response, 15*time.Second); err != nil {
		logrus.WithError(err).Warn("Failed to cache quotes response")
	}
}

func (a *AggregatorService) getProvidersFromQuotes(quotes []*models.Quote) []string {
	providerMap := make(map[string]bool)
	for _, quote := range quotes {
		if quote != nil && quote.Provider != "" {
			providerMap[quote.Provider] = true
		}
	}

	providers := make([]string, 0, len(providerMap))
	for provider := range providerMap {
		providers = append(providers, provider)
	}

	return providers
}
