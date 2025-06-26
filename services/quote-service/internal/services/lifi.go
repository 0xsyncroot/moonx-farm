package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/quote-service/internal/config"
	"github.com/moonx-farm/quote-service/internal/models"
	"github.com/moonx-farm/quote-service/internal/utils"
)

// LiFiService handles LiFi API integration with advanced retry and fallback
type LiFiService struct {
	apiConfig    *config.APIConfig
	httpClient   *http.Client
	baseURL      string
	cacheService *CacheService
	tokenUtils   *utils.TokenUtils
}

// NewLiFiService creates a new LiFi service with optimized configuration
func NewLiFiService(apiConfig *config.APIConfig, cacheService *CacheService) *LiFiService {
	return &LiFiService{
		apiConfig:    apiConfig,
		httpClient:   &http.Client{Timeout: 15 * time.Second}, // Reduced timeout for faster failover
		baseURL:      "https://li.quest/v1",
		cacheService: cacheService,
		tokenUtils:   utils.NewTokenUtils(),
	}
}

// LiFiTimingConfig represents timing optimization strategies
type LiFiTimingConfig struct {
	Order                      string `json:"order"`                       // CHEAPEST, FASTEST
	PreferExchanges           string `json:"preferExchanges,omitempty"`    // Preferred DEX list
	PreferBridges             string `json:"preferBridges,omitempty"`      // Preferred bridge list
	SwapStepTimingStrategies  string `json:"swapStepTimingStrategies,omitempty"`
	RouteTimingStrategies     string `json:"routeTimingStrategies,omitempty"`
}

// LiFiQuoteRequest represents the enhanced request parameters
type LiFiQuoteRequest struct {
	FromChain     int    `json:"fromChain"`
	ToChain       int    `json:"toChain"`
	FromToken     string `json:"fromToken"`
	ToToken       string `json:"toToken"`
	FromAmount    string `json:"fromAmount"`
	FromAddress   string `json:"fromAddress"`
	ToAddress     string `json:"toAddress,omitempty"`
	Slippage      string `json:"slippage,omitempty"`
	Integrator    string `json:"integrator,omitempty"`
	Referrer      string `json:"referrer,omitempty"`
	Order         string `json:"order,omitempty"`
	PreferExchanges string `json:"preferExchanges,omitempty"`
	PreferBridges   string `json:"preferBridges,omitempty"`
}

// QuoteValidation represents validation results
type QuoteValidation struct {
	IsValid bool     `json:"is_valid"`
	Score   float64  `json:"score"`
	Issues  []string `json:"issues"`
}

// ErrorCategory represents categorized API errors
type ErrorCategory struct {
	Category         string `json:"category"`
	IsRetryable      bool   `json:"is_retryable"`
	FallbackStrategy string `json:"fallback_strategy,omitempty"`
	Message          string `json:"message"`
}

// LiFi API response structures
type LiFiQuoteResponse struct {
	Action struct {
		FromChainID int    `json:"fromChainId"`
		ToChainID   int    `json:"toChainId"`
		FromToken   struct {
			Address  string `json:"address"`
			Symbol   string `json:"symbol"`
			Name     string `json:"name"`
			Decimals int    `json:"decimals"`
			ChainID  int    `json:"chainId"`
			LogoURI  string `json:"logoURI"`
		} `json:"fromToken"`
		ToToken struct {
			Address  string `json:"address"`
			Symbol   string `json:"symbol"`
			Name     string `json:"name"`
			Decimals int    `json:"decimals"`
			ChainID  int    `json:"chainId"`
			LogoURI  string `json:"logoURI"`
		} `json:"toToken"`
		FromAmount string      `json:"fromAmount"`
		ToAmount   string      `json:"toAmount"`
		Slippage   interface{} `json:"slippage"` // Can be string or number
	} `json:"action"`
	Estimate struct {
		FromAmount         string `json:"fromAmount"`
		ToAmount           string `json:"toAmount"`
		ToAmountMin        string `json:"toAmountMin"`
		ApprovalAddress    string `json:"approvalAddress"`
		ExecutionDuration  int    `json:"executionDuration"`
		FeeCosts           []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Token       struct {
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				ChainID  int    `json:"chainId"`
			} `json:"token"`
			Amount     string `json:"amount"`
			AmountUSD  string `json:"amountUSD"`
			Percentage string `json:"percentage"`
		} `json:"feeCosts"`
		GasCosts []struct {
			Type      string `json:"type"`
			Estimate  string `json:"estimate"`
			Limit     string `json:"limit"`
			Amount    string `json:"amount"`
			AmountUSD string `json:"amountUSD"`
			Token     struct {
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				ChainID  int    `json:"chainId"`
			} `json:"token"`
		} `json:"gasCosts"`
	} `json:"estimate"`
	TransactionRequest struct {
		Data     string `json:"data"`
		To       string `json:"to"`
		Value    string `json:"value"`
		From     string `json:"from"`
		ChainID  int    `json:"chainId"`
		GasLimit string `json:"gasLimit"`
		GasPrice string `json:"gasPrice"`
	} `json:"transactionRequest"`
	Tool        string    `json:"tool"`
	ToolDetails struct {
		Key     string `json:"key"`
		Name    string `json:"name"`
		LogoURI string `json:"logoURI"`
	} `json:"toolDetails"`
	ID string `json:"id"`
}

type LiFiTokensResponse struct {
	Tokens map[string][]struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		ChainID  int    `json:"chainId"`
		LogoURI  string `json:"logoURI"`
		PriceUSD string `json:"priceUSD"`
	} `json:"tokens"`
}

// GetQuote gets a quote from LiFi with enhanced retry and validation
func (l *LiFiService) GetQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// Check cache first with enhanced validation
	cacheKey := l.generateIntelligentCacheKey(req)
	if cachedQuote, err := l.cacheService.GetQuote(ctx, cacheKey); err == nil && cachedQuote != nil {
		// Validate cached quote is still fresh and reliable
		if l.validateCachedQuote(cachedQuote) {
			logrus.WithField("cacheKey", cacheKey).Debug("LiFi quote found in cache and validated")
			return cachedQuote, nil
		} else {
			logrus.WithField("cacheKey", cacheKey).Debug("Cached LiFi quote failed validation, fetching new")
		}
	}

	// Normalize token addresses for LiFi compatibility
	fromToken := l.normalizeTokenAddress(req.FromToken)
	toToken := l.normalizeTokenAddress(req.ToToken)

	// Convert amount to wei format using shared token utils
	amountWei, err := l.convertAmountToWei(req.Amount, fromToken, req.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to convert amount to wei: %w", err)
	}

	// Build optimized request parameters
	lifiReq, err := l.buildOptimizedRequest(req, fromToken, toToken, amountWei)
	if err != nil {
		return nil, fmt.Errorf("failed to build LiFi request: %w", err)
	}

	// Execute request with intelligent retry
	lifiResp, err := l.executeWithIntelligentRetry(ctx, lifiReq, 3)
	if err != nil {
		return nil, fmt.Errorf("failed to get LiFi quote: %w", err)
	}

	// Validate quote executability before returning
	validation := l.validateQuoteExecutability(lifiResp, req)
	if !validation.IsValid {
		return nil, fmt.Errorf("quote validation failed (score: %.2f): %s", 
			validation.Score, strings.Join(validation.Issues, "; "))
	}

	// Convert to our Quote model with enhanced data
	quote, err := l.convertToEnhancedQuote(lifiResp, req, validation.Score)
	if err != nil {
		return nil, fmt.Errorf("failed to convert LiFi response: %w", err)
	}

	// Cache the quote with validation score
	cacheTTL := l.calculateCacheTTL(validation.Score)
	if err := l.cacheService.SetQuoteWithTTL(ctx, cacheKey, quote, cacheTTL); err != nil {
		logrus.WithError(err).Warn("Failed to cache LiFi quote")
	}

	logrus.WithFields(logrus.Fields{
		"fromToken":       req.FromToken,
		"toToken":         req.ToToken,
		"amount":          req.Amount,
		"chainID":         req.ChainID,
		"provider":        "lifi",
		"validationScore": validation.Score,
		"toAmount":        quote.ToAmount,
		"tool":            lifiResp.Tool,
	}).Info("LiFi quote retrieved and validated successfully")

	return quote, nil
}

// GetMultipleQuotes gets multiple quotes from LiFi with route variations
func (l *LiFiService) GetMultipleQuotes(ctx context.Context, req *models.QuoteRequest, maxQuotes int) ([]*models.Quote, error) {
	// LiFi supports multiple routes through different strategies
	quotes := make([]*models.Quote, 0, maxQuotes)
	
	// Strategy 1: Get fastest route
	fastQuote, err := l.getQuoteWithStrategy(ctx, req, "FASTEST")
	if err == nil && fastQuote != nil {
		quotes = append(quotes, fastQuote)
	}
	
	// Strategy 2: Get cheapest route
	if len(quotes) < maxQuotes {
		cheapQuote, err := l.getQuoteWithStrategy(ctx, req, "CHEAPEST")
		if err == nil && cheapQuote != nil {
			// Only add if it's different from the fast quote
			if len(quotes) == 0 || !l.isQuoteSimilar(fastQuote, cheapQuote) {
				quotes = append(quotes, cheapQuote)
			}
		}
	}
	
	// Strategy 3: Get recommended route (balanced)
	if len(quotes) < maxQuotes {
		balancedQuote, err := l.getQuoteWithStrategy(ctx, req, "RECOMMENDED")
		if err == nil && balancedQuote != nil {
			// Only add if it's different from existing quotes
			isDifferent := true
			for _, existingQuote := range quotes {
				if l.isQuoteSimilar(existingQuote, balancedQuote) {
					isDifferent = false
					break
				}
			}
			if isDifferent {
				quotes = append(quotes, balancedQuote)
			}
		}
	}
	
	// Strategy 4: Try different DEX preferences for variety
	if len(quotes) < maxQuotes {
		dexStrategies := []string{"uniswap", "1inch", "paraswap"}
		for _, dex := range dexStrategies {
			if len(quotes) >= maxQuotes {
				break
			}
			
			dexQuote, err := l.getQuoteWithDEXPreference(ctx, req, dex)
			if err == nil && dexQuote != nil {
				// Only add if it's different from existing quotes
				isDifferent := true
				for _, existingQuote := range quotes {
					if l.isQuoteSimilar(existingQuote, dexQuote) {
						isDifferent = false
						break
					}
				}
				if isDifferent {
					quotes = append(quotes, dexQuote)
				}
			}
		}
	}
	
	logrus.WithFields(logrus.Fields{
		"fromToken":   req.FromToken,
		"toToken":     req.ToToken,
		"amount":      req.Amount,
		"maxQuotes":   maxQuotes,
		"quotesFound": len(quotes),
		"provider":    "lifi",
	}).Info("LiFi multiple quotes retrieved")
	
	return quotes, nil
}

// getQuoteWithStrategy gets quote with specific LiFi strategy
func (l *LiFiService) getQuoteWithStrategy(ctx context.Context, req *models.QuoteRequest, strategy string) (*models.Quote, error) {
	// Check cache first
	cacheKey := fmt.Sprintf("%s:strategy:%s", l.generateIntelligentCacheKey(req), strategy)
	if cachedQuote, err := l.cacheService.GetQuote(ctx, cacheKey); err == nil && cachedQuote != nil {
		if l.validateCachedQuote(cachedQuote) {
			return cachedQuote, nil
		}
	}
	
	// Normalize token addresses
	fromToken := l.normalizeTokenAddress(req.FromToken)
	toToken := l.normalizeTokenAddress(req.ToToken)
	
	// Convert amount to wei format
	amountWei, err := l.convertAmountToWei(req.Amount, fromToken, req.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to convert amount to wei: %w", err)
	}
	
	// Build request with specific strategy
	lifiReq, err := l.buildOptimizedRequest(req, fromToken, toToken, amountWei)
	if err != nil {
		return nil, fmt.Errorf("failed to build LiFi request: %w", err)
	}
	
	// Override strategy
	lifiReq.Order = strategy
	
	// Execute request
	lifiResp, err := l.executeWithIntelligentRetry(ctx, lifiReq, 2) // Reduced retries for multiple quotes
	if err != nil {
		return nil, fmt.Errorf("failed to get LiFi quote with strategy %s: %w", strategy, err)
	}
	
	// Validate quote
	validation := l.validateQuoteExecutability(lifiResp, req)
	if !validation.IsValid {
		return nil, fmt.Errorf("quote validation failed for strategy %s", strategy)
	}
	
	// Convert to Quote model
	quote, err := l.convertToEnhancedQuote(lifiResp, req, validation.Score)
	if err != nil {
		return nil, fmt.Errorf("failed to convert LiFi response: %w", err)
	}
	
	// Add strategy metadata
	if quote.Metadata == nil {
		quote.Metadata = make(map[string]interface{})
	}
	quote.Metadata["strategy"] = strategy
	quote.Metadata["tool"] = lifiResp.Tool
	
	// Cache with shorter TTL for strategy-specific quotes
	cacheTTL := 10 * time.Second
	if err := l.cacheService.SetQuoteWithTTL(ctx, cacheKey, quote, cacheTTL); err != nil {
		logrus.WithError(err).Warn("Failed to cache LiFi strategy quote")
	}
	
	return quote, nil
}

// getQuoteWithDEXPreference gets quote with specific DEX preference
func (l *LiFiService) getQuoteWithDEXPreference(ctx context.Context, req *models.QuoteRequest, dexPreference string) (*models.Quote, error) {
	// Normalize token addresses
	fromToken := l.normalizeTokenAddress(req.FromToken)
	toToken := l.normalizeTokenAddress(req.ToToken)
	
	// Convert amount to wei format
	amountWei, err := l.convertAmountToWei(req.Amount, fromToken, req.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to convert amount to wei: %w", err)
	}
	
	// Build request with DEX preference
	lifiReq, err := l.buildOptimizedRequest(req, fromToken, toToken, amountWei)
	if err != nil {
		return nil, fmt.Errorf("failed to build LiFi request: %w", err)
	}
	
	// Set DEX preference
	lifiReq.PreferExchanges = dexPreference
	
	// Execute request
	lifiResp, err := l.executeWithIntelligentRetry(ctx, lifiReq, 1) // Single retry for DEX-specific quotes
	if err != nil {
		return nil, fmt.Errorf("failed to get LiFi quote with DEX %s: %w", dexPreference, err)
	}
	
	// Validate quote
	validation := l.validateQuoteExecutability(lifiResp, req)
	if !validation.IsValid {
		return nil, fmt.Errorf("quote validation failed for DEX %s", dexPreference)
	}
	
	// Convert to Quote model
	quote, err := l.convertToEnhancedQuote(lifiResp, req, validation.Score)
	if err != nil {
		return nil, fmt.Errorf("failed to convert LiFi response: %w", err)
	}
	
	// Add DEX metadata
	if quote.Metadata == nil {
		quote.Metadata = make(map[string]interface{})
	}
	quote.Metadata["preferredDEX"] = dexPreference
	quote.Metadata["tool"] = lifiResp.Tool
	
	return quote, nil
}

// isQuoteSimilar checks if two quotes are similar (within 1% of each other)
func (l *LiFiService) isQuoteSimilar(quote1, quote2 *models.Quote) bool {
	if quote1 == nil || quote2 == nil {
		return false
	}
	
	// Check if output amounts are within 1% of each other
	diff := quote1.ToAmount.Sub(quote2.ToAmount).Abs()
	threshold := quote1.ToAmount.Mul(decimal.NewFromFloat(0.01)) // 1%
	
	return diff.LessThanOrEqual(threshold)
}

// GetTokenList gets supported tokens from LiFi with aggressive caching and speed optimization
func (l *LiFiService) GetTokenList(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Multi-layer cache strategy for maximum speed
	
	// 1. Check primary cache (30min TTL for stable tokens)
	if cachedList, err := l.cacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		// Check if cache is recent enough (less than 5 minutes for popular tokens)
		if time.Since(cachedList.UpdatedAt) < 5*time.Minute {
			logrus.WithField("chainID", chainID).Debug("LiFi token list found in recent cache")
			return cachedList.Tokens, nil
		}
	}

	// 2. Check short-term cache for newly added tokens (1min TTL)
	shortTermKey := fmt.Sprintf("lifi:tokens:short:%d", chainID)
	var shortTermTokens []*models.Token
	if err := l.cacheService.Get(ctx, shortTermKey, &shortTermTokens); err == nil {
		logrus.WithField("chainID", chainID).Debug("LiFi token list found in short-term cache")
		return shortTermTokens, nil
	}

	// 3. Fetch fresh data with optimized parameters
	requestURL := l.buildOptimizedTokenListURL(chainID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Optimized headers for speed
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Cache-Control", "no-cache")
	httpReq.Header.Set("Connection", "keep-alive")
	
	// Add API key for priority access
	if l.apiConfig.LiFiAPIKey != "" {
		httpReq.Header.Set("x-lifi-api-key", l.apiConfig.LiFiAPIKey)
	}

	resp, err := l.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("LiFi API error (status %d): %s", resp.StatusCode, string(body))
	}

	var lifiResp LiFiTokensResponse
	if err := json.NewDecoder(resp.Body).Decode(&lifiResp); err != nil {
		return nil, fmt.Errorf("failed to decode LiFi tokens response: %w", err)
	}

	// Convert and optimize token list
	tokens := l.processTokenListWithPrioritization(lifiResp, chainID)

	// 4. Multi-level caching strategy
	tokenList := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
	}

	// Cache with different TTLs based on token popularity
	go func() {
		// Primary cache (30min for stable tokens)
		if err := l.cacheService.SetTokenList(context.Background(), chainID, tokenList); err != nil {
			logrus.WithError(err).Warn("Failed to cache LiFi token list")
		}

		// Short-term cache (1min for quick access)
		shortTermKey := fmt.Sprintf("lifi:tokens:short:%d", chainID)
		if err := l.cacheService.Set(context.Background(), shortTermKey, tokens, 1*time.Minute); err != nil {
			logrus.WithError(err).Warn("Failed to cache short-term LiFi token list")
		}

		// Individual token address cache for fast lookups
		l.cacheTokensByAddress(context.Background(), tokens, chainID)
	}()

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"tokenCount": len(tokens),
		"provider":   "lifi",
		"cached":     "multiple_layers",
	}).Info("LiFi token list retrieved and cached")

	return tokens, nil
}

// buildOptimizedTokenListURL builds URL with optimization parameters
func (l *LiFiService) buildOptimizedTokenListURL(chainID int) string {
	baseURL := fmt.Sprintf("%s/tokens", l.baseURL)
	
	params := url.Values{}
	if chainID > 0 {
		params.Set("chains", strconv.Itoa(chainID))
	}
	
	// Request tokens with pricing info for better prioritization
	params.Set("includePrices", "true")
	
	// Limit to active tokens only for speed
	params.Set("activeOnly", "true")
	
	if len(params) > 0 {
		return baseURL + "?" + params.Encode()
	}
	return baseURL
}

// processTokenListWithPrioritization processes and prioritizes tokens for optimal UX
func (l *LiFiService) processTokenListWithPrioritization(lifiResp LiFiTokensResponse, chainID int) []*models.Token {
	var popularTokens []*models.Token
	var otherTokens []*models.Token

	// Define popular token addresses for prioritization (Base chain example)
	popularAddresses := map[string]bool{
		"0x0000000000000000000000000000000000000000": true, // ETH
		"0x4200000000000000000000000000000000000006": true, // WETH
		"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": true, // USDC
		"0x50c5725949a6f0c72e6c4a641f24049a917db0cb": true, // DAI
		"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": true, // USDbC
	}

	for _, chainTokens := range lifiResp.Tokens {
		for _, token := range chainTokens {
			if chainID > 0 && token.ChainID != chainID {
				continue
			}

			priceUSD, _ := decimal.NewFromString(token.PriceUSD)
			
			modelToken := &models.Token{
				Address:     token.Address,
				Symbol:      token.Symbol,
				Name:        token.Name,
				Decimals:    token.Decimals,
				ChainID:     token.ChainID,
				LogoURI:     token.LogoURI,
				PriceUSD:    priceUSD,
				LastUpdated: time.Now(),
				Metadata: map[string]interface{}{
					"source":     "lifi",
					"isPopular":  popularAddresses[strings.ToLower(token.Address)],
					"hasPrice":   token.PriceUSD != "" && token.PriceUSD != "0",
				},
			}

			// Categorize tokens for prioritization
			if popularAddresses[strings.ToLower(token.Address)] {
				popularTokens = append(popularTokens, modelToken)
			} else {
				otherTokens = append(otherTokens, modelToken)
			}
		}
	}

	// Sort popular tokens by symbol
	sort.Slice(popularTokens, func(i, j int) bool {
		return popularTokens[i].Symbol < popularTokens[j].Symbol
	})

	// Sort other tokens by price (descending) then symbol
	sort.Slice(otherTokens, func(i, j int) bool {
		if !otherTokens[i].PriceUSD.Equal(otherTokens[j].PriceUSD) {
			return otherTokens[i].PriceUSD.GreaterThan(otherTokens[j].PriceUSD)
		}
		return otherTokens[i].Symbol < otherTokens[j].Symbol
	})

	// Combine: popular tokens first, then others
	return append(popularTokens, otherTokens...)
}

// cacheTokensByAddress caches individual tokens by address for fast lookup
func (l *LiFiService) cacheTokensByAddress(ctx context.Context, tokens []*models.Token, chainID int) {
	for _, token := range tokens {
		// Cache by address
		addressKey := fmt.Sprintf("lifi:token:addr:%d:%s", chainID, strings.ToLower(token.Address))
		if err := l.cacheService.Set(ctx, addressKey, token, 10*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"address": token.Address,
				"symbol":  token.Symbol,
			}).Debug("Token cached by address")
		}
		
		// Cache by symbol for quick symbol lookup
		symbolKey := fmt.Sprintf("lifi:token:symbol:%d:%s", chainID, strings.ToLower(token.Symbol))
		if err := l.cacheService.Set(ctx, symbolKey, token, 5*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"symbol":  token.Symbol,
				"address": token.Address,
			}).Debug("Token cached by symbol")
		}
	}
}

// GetTokenByAddress gets a specific token by address with optimized caching
func (l *LiFiService) GetTokenByAddress(ctx context.Context, address string, chainID int) (*models.Token, error) {
	// Check address cache first
	addressKey := fmt.Sprintf("lifi:token:addr:%d:%s", chainID, strings.ToLower(address))
	var token models.Token
	if err := l.cacheService.Get(ctx, addressKey, &token); err == nil {
		logrus.WithField("address", address).Debug("Token found in address cache")
		return &token, nil
	}

	// Fallback to token list and cache the result
	tokens, err := l.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	normalizedAddress := strings.ToLower(address)
	for _, token := range tokens {
		if strings.ToLower(token.Address) == normalizedAddress {
			// Cache this token for future lookups
			go l.cacheService.Set(context.Background(), addressKey, token, 10*time.Minute)
			return token, nil
		}
	}

	return nil, fmt.Errorf("token not found: %s", address)
}

// GetTokenPrice gets token price from LiFi
func (l *LiFiService) GetTokenPrice(ctx context.Context, tokenAddress string, chainID int) (*models.PriceResponse, error) {
	// Check cache first
	if cachedPrice, err := l.cacheService.GetTokenPrice(ctx, tokenAddress, chainID); err == nil && cachedPrice != nil {
		logrus.WithFields(logrus.Fields{
			"token":   tokenAddress,
			"chainID": chainID,
		}).Debug("LiFi token price found in cache")
		return cachedPrice, nil
	}

	// Get token list and find the token
	tokens, err := l.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token list: %w", err)
	}

	for _, token := range tokens {
		if token.Address == tokenAddress || token.Symbol == tokenAddress {
			priceResp := &models.PriceResponse{
				Token:     token,
				Price:     token.PriceUSD,
				Currency:  models.CurrencyUSD,
				Source:    models.ProviderLiFi,
				UpdatedAt: time.Now(),
			}

			// Cache the price
			if err := l.cacheService.SetTokenPrice(ctx, tokenAddress, chainID, priceResp); err != nil {
				logrus.WithError(err).Warn("Failed to cache LiFi token price")
			}

			return priceResp, nil
		}
	}

	return nil, fmt.Errorf("token not found: %s", tokenAddress)
}

// generateIntelligentCacheKey creates an enhanced cache key including user context
func (l *LiFiService) generateIntelligentCacheKey(req *models.QuoteRequest) string {
	fromToken := l.normalizeTokenAddress(req.FromToken)
	toToken := l.normalizeTokenAddress(req.ToToken)
	
	// Hash user address to maintain privacy while ensuring uniqueness
	userHash := "none"
	if req.UserAddress != "" {
		userHash = l.hashUserAddress(req.UserAddress)
	}
	
	return fmt.Sprintf("lifi:v3:%d:%s:%s:%s:%.3f:%s:ts%d", 
		req.ChainID, 
		strings.ToLower(fromToken), 
		strings.ToLower(toToken), 
		req.Amount.String(),
		req.SlippageTolerance.InexactFloat64(),
		userHash,
		time.Now().Unix()/180) // 3-minute buckets for balance between cache efficiency and freshness
}

// validateCachedQuote validates if a cached quote is still reliable
func (l *LiFiService) validateCachedQuote(quote *models.Quote) bool {
	if quote == nil {
		return false
	}

	// Check if quote has expired (LiFi quotes valid for ~30 seconds)
	if time.Since(quote.CreatedAt) > 25*time.Second {
		return false
	}

	// Check if amounts are reasonable
	if quote.ToAmount.IsZero() || quote.FromAmount.IsZero() {
		return false
	}

	// Check if price is reasonable (not extreme)
	if quote.Price.IsZero() || quote.Price.LessThan(decimal.NewFromFloat(0.000001)) {
		return false
	}

	return true
}

// normalizeTokenAddress converts token addresses for LiFi compatibility
func (l *LiFiService) normalizeTokenAddress(tokenAddress string) string {
	normalized := strings.ToLower(strings.TrimSpace(tokenAddress))
	
	// Validate address format first
	if len(normalized) != 42 || !strings.HasPrefix(normalized, "0x") {
		logrus.Warnf("❌ Invalid token address format for LiFi: %s", tokenAddress)
		return ""
	}
	
	// Handle native ETH
	if normalized == "0x0000000000000000000000000000000000000000" || 
	   normalized == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" {
		return "0x0000000000000000000000000000000000000000"
	}
	
	// For Base chain, use known tokens
	switch normalized {
	case "0x4200000000000000000000000000000000000006": // Base WETH
		return "0x0000000000000000000000000000000000000000"
	case "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": // Base USDC
		return normalized
	default:
		// Return the original address for validation by LiFi
		return normalized
	}
}

// hashUserAddress creates a short hash of user address for cache key privacy
func (l *LiFiService) hashUserAddress(address string) string {
	if address == "" {
		return "none"
	}
	
	// Normalize address to lowercase
	normalizedAddr := strings.ToLower(strings.TrimSpace(address))
	
	// Create hash
	hash := sha256.Sum256([]byte(normalizedAddr))
	
	// Return first 8 characters of hex for cache efficiency
	return hex.EncodeToString(hash[:])[:8]
}

// convertAmountToWei converts decimal amount to wei string
func (l *LiFiService) convertAmountToWei(amount decimal.Decimal, tokenAddress string, chainID int) (string, error) {
	// Amount is in human-readable format (e.g. "0.1" for 0.1 ETH)
	// Need to convert to smallest units (wei for ETH, etc.)
	
	decimals, err := l.getTokenDecimals(tokenAddress, chainID)
	if err != nil {
		logrus.WithError(err).Warnf("Failed to get decimals for token %s, using default 18", tokenAddress)
		decimals = 18 // Fallback to 18 decimals
	}
	
	// Convert to smallest units: amount * 10^decimals
	multiplier := decimal.New(1, int32(decimals))
	amountWei := amount.Mul(multiplier)
	
	logrus.WithFields(logrus.Fields{
		"originalAmount": amount.String(),
		"decimals":       decimals,
		"amountWei":      amountWei.String(),
		"tokenAddress":   tokenAddress,
		"chainID":        chainID,
	}).Debug("💰 Converting human amount to wei")
	
	return amountWei.String(), nil
}

// getTokenDecimals gets token decimals with caching and onchain fallback
func (l *LiFiService) getTokenDecimals(tokenAddress string, chainID int) (int, error) {
	return l.tokenUtils.GetTokenDecimals(tokenAddress, chainID)
}

// getTokenDecimalsFromContract fetches decimals from contract via RPC
func (l *LiFiService) getTokenDecimalsFromContract(tokenAddress string, chainID int) (int, error) {
	// This would require RPC client setup - for now return default
	// TODO: Implement actual contract call
	logrus.WithFields(logrus.Fields{
		"tokenAddress": tokenAddress,
		"chainID":      chainID,
	}).Warn("⚠️ Token decimals not found in known list, using default 18. TODO: implement onchain lookup")
	
	return 18, nil
}

// getBalancedTimingConfig returns optimized timing configuration
func (l *LiFiService) getBalancedTimingConfig() *LiFiTimingConfig {
	return &LiFiTimingConfig{
		Order:                     "CHEAPEST", // Prioritize value over speed
		SwapStepTimingStrategies:  "minWaitTime-800-4-300",
		RouteTimingStrategies:     "minWaitTime-1500-6-400",
	}
}

// buildOptimizedRequest builds enhanced LiFi request with timing optimization
func (l *LiFiService) buildOptimizedRequest(req *models.QuoteRequest, fromToken, toToken, amountWei string) (*LiFiQuoteRequest, error) {
	// Get timing configuration
	timingConfig := l.getBalancedTimingConfig()
	
	// Convert slippage to decimal format (JavaScript: slippage / 100)
	slippage := "0.005" // Default 0.5%
	if !req.SlippageTolerance.IsZero() {
		slippage = req.SlippageTolerance.Div(decimal.NewFromInt(100)).String()
	}
	
	// Use user address or fallback
	userAddress := req.UserAddress
	if userAddress == "" {
		userAddress = "0x000000000000000000000000000000000000dEaD"
	}
	
	// Determine destination chain - use ToChainID if specified, otherwise same chain
	toChainID := req.ChainID
	if req.ToChainID != 0 {
		toChainID = req.ToChainID
	}

	lifiReq := &LiFiQuoteRequest{
		FromChain:       req.ChainID,
		ToChain:         toChainID,
		FromToken:       fromToken,
		ToToken:         toToken,
		FromAmount:      amountWei,
		FromAddress:     userAddress,
		ToAddress:       userAddress, // JavaScript: usually same as fromAddress for swaps
		Slippage:        slippage,
		Integrator:      "moonx-farm",
		Referrer:        userAddress, // JavaScript: referrer: fromAddress
		Order:           timingConfig.Order,
		PreferExchanges: timingConfig.PreferExchanges,
		PreferBridges:   timingConfig.PreferBridges,
	}
	
	return lifiReq, nil
}

// executeWithIntelligentRetry executes request with exponential backoff and error analysis
func (l *LiFiService) executeWithIntelligentRetry(ctx context.Context, lifiReq *LiFiQuoteRequest, maxRetries int) (*LiFiQuoteResponse, error) {
	var lastErr error
	
	for attempt := 0; attempt < maxRetries; attempt++ {
		// Build request URL with parameters
		requestURL, err := l.buildRequestURL(lifiReq)
		if err != nil {
			return nil, fmt.Errorf("failed to build request URL: %w", err)
		}
		
		logrus.WithFields(logrus.Fields{
			"url":         requestURL,
			"fromChain":   lifiReq.FromChain,
			"toChain":     lifiReq.ToChain,
			"fromToken":   lifiReq.FromToken,
			"toToken":     lifiReq.ToToken,
			"fromAmount":  lifiReq.FromAmount,
			"fromAddress": lifiReq.FromAddress,
			"toAddress":   lifiReq.ToAddress,
			"slippage":    lifiReq.Slippage,
			"integrator":  lifiReq.Integrator,
			"order":       lifiReq.Order,
		}).Info("🔗 LiFi API Request (detailed)")
		
		// Create HTTP request
		httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create HTTP request: %w", err)
		}
		
		// Set enhanced headers (match JavaScript implementation)
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("User-Agent", "moonx-farm/1.0.0")
		httpReq.Header.Set("Accept", "application/json")
		httpReq.Header.Set("Cache-Control", "no-cache")
		
		// Add API key if available (critical for LiFi access)
		if l.apiConfig.LiFiAPIKey != "" {
			httpReq.Header.Set("x-lifi-api-key", l.apiConfig.LiFiAPIKey)
			logrus.Debug("🔑 LiFi API key added to request")
		} else {
			logrus.Warn("⚠️ LiFi API key not configured - may cause rate limiting")
		}
		
		// Execute request
		resp, err := l.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("network error: %w", err)
			if attempt < maxRetries-1 {
				backoffDelay := time.Duration(math.Pow(2, float64(attempt))) * time.Second + 
					time.Duration(time.Now().UnixNano()%1000) * time.Millisecond
				logrus.WithFields(logrus.Fields{
					"attempt": attempt + 1,
					"delay":   backoffDelay,
					"error":   err,
				}).Warn("LiFi request failed, retrying...")
				
				select {
				case <-time.After(backoffDelay):
				case <-ctx.Done():
					return nil, ctx.Err()
				}
				continue
			}
			return nil, lastErr
		}
		defer resp.Body.Close()
		
		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %w", err)
			continue
		}
		
		// Log first 500 chars of response for debugging
		responsePreview := string(body)
		if len(responsePreview) > 500 {
			responsePreview = responsePreview[:500] + "..."
		}
		logrus.WithFields(logrus.Fields{
			"statusCode": resp.StatusCode,
			"response":   responsePreview,
		}).Debug("🔍 LiFi API Response")
		
		// Handle non-200 status codes with intelligent error analysis
		if resp.StatusCode != http.StatusOK {
			errorCategory := l.categorizeAPIError(resp.StatusCode, body)
			
			// Retry on certain error types
			if errorCategory.IsRetryable && attempt < maxRetries-1 {
				backoffDelay := time.Duration(math.Pow(2, float64(attempt))) * time.Second
				logrus.WithFields(logrus.Fields{
					"attempt":    attempt + 1,
					"statusCode": resp.StatusCode,
					"category":   errorCategory.Category,
					"delay":      backoffDelay,
				}).Warn("LiFi API error, retrying...")
				
				select {
				case <-time.After(backoffDelay):
				case <-ctx.Done():
					return nil, ctx.Err()
				}
				continue
			}
			
			return nil, fmt.Errorf("LiFi API error (%d): %s", resp.StatusCode, errorCategory.Message)
		}
		
		// Parse successful response
		var lifiResp LiFiQuoteResponse
		if err := json.Unmarshal(body, &lifiResp); err != nil {
			return nil, fmt.Errorf("failed to decode LiFi response: %w", err)
		}
		
		return &lifiResp, nil
	}
	
	return nil, lastErr
}

// buildRequestURL builds the complete request URL with parameters
func (l *LiFiService) buildRequestURL(lifiReq *LiFiQuoteRequest) (string, error) {
	// Validate tokens before building URL
	if lifiReq.FromToken == "" || lifiReq.ToToken == "" {
		return "", fmt.Errorf("invalid token addresses: fromToken=%s, toToken=%s", lifiReq.FromToken, lifiReq.ToToken)
	}
	
	baseURL, err := url.Parse(fmt.Sprintf("%s/quote", l.baseURL))
	if err != nil {
		return "", err
	}
	
	params := url.Values{}
	params.Set("fromChain", strconv.Itoa(lifiReq.FromChain))
	params.Set("toChain", strconv.Itoa(lifiReq.ToChain))
	params.Set("fromToken", lifiReq.FromToken)
	params.Set("toToken", lifiReq.ToToken)
	params.Set("fromAmount", lifiReq.FromAmount)
	params.Set("fromAddress", lifiReq.FromAddress)
	
	if lifiReq.ToAddress != "" {
		params.Set("toAddress", lifiReq.ToAddress)
	}
	if lifiReq.Slippage != "" {
		params.Set("slippage", lifiReq.Slippage)
	}
	if lifiReq.Integrator != "" {
		params.Set("integrator", lifiReq.Integrator)
	}
	if lifiReq.Referrer != "" {
		params.Set("referrer", lifiReq.Referrer)
	}
	if lifiReq.Order != "" {
		params.Set("order", lifiReq.Order)
	}
	if lifiReq.PreferExchanges != "" {
		params.Set("preferExchanges", lifiReq.PreferExchanges)
	}
	if lifiReq.PreferBridges != "" {
		params.Set("preferBridges", lifiReq.PreferBridges)
	}
	
	baseURL.RawQuery = params.Encode()
	return baseURL.String(), nil
}

// categorizeAPIError analyzes and categorizes API errors for intelligent retry
func (l *LiFiService) categorizeAPIError(statusCode int, body []byte) *ErrorCategory {
	var errorMsg string
	
	// Try to parse error response
	var errorResp struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	
	if err := json.Unmarshal(body, &errorResp); err == nil {
		if errorResp.Message != "" {
			errorMsg = errorResp.Message
		} else if errorResp.Error != "" {
			errorMsg = errorResp.Error
		}
	}
	
	if errorMsg == "" {
		errorMsg = string(body)
	}
	
	switch statusCode {
	case 429:
		return &ErrorCategory{
			Category:    "RATE_LIMIT",
			IsRetryable: true,
			Message:     "Rate limit exceeded. Please reduce request frequency.",
		}
	case 400:
		return &ErrorCategory{
			Category:         "VALIDATION",
			IsRetryable:      false,
			Message:          fmt.Sprintf("Invalid request parameters: %s", errorMsg),
			FallbackStrategy: "Check token addresses and amounts",
		}
	case 401, 403:
		return &ErrorCategory{
			Category:    "AUTH",
			IsRetryable: false,
			Message:     "Authentication failed. Check API key.",
		}
	case 404:
		return &ErrorCategory{
			Category:         "NOT_FOUND",
			IsRetryable:      false,
			Message:          "Endpoint not found or token not supported.",
			FallbackStrategy: "Try different token pair",
		}
	case 500, 502, 503, 504:
		return &ErrorCategory{
			Category:    "SERVER_ERROR",
			IsRetryable: true,
			Message:     "LiFi server error. Please try again.",
		}
	default:
		return &ErrorCategory{
			Category:    "UNKNOWN",
			IsRetryable: statusCode >= 500,
			Message:     fmt.Sprintf("Unexpected error: %s", errorMsg),
		}
	}
}

// validateQuoteExecutability validates quote before returning
func (l *LiFiService) validateQuoteExecutability(lifiResp *LiFiQuoteResponse, req *models.QuoteRequest) *QuoteValidation {
	issues := []string{}
	score := 1.0
	
	// Check if amounts are reasonable
	fromAmount, err := decimal.NewFromString(lifiResp.Estimate.FromAmount)
	if err != nil || fromAmount.IsZero() {
		issues = append(issues, "Invalid from amount")
		score -= 0.3
	}
	
	toAmount, err := decimal.NewFromString(lifiResp.Estimate.ToAmount)
	if err != nil || toAmount.IsZero() {
		issues = append(issues, "Invalid to amount")
		score -= 0.3
	}
	
	// Check gas costs are reasonable
	if len(lifiResp.Estimate.GasCosts) > 0 {
		totalGasCostUSD := 0.0
		for _, gasCost := range lifiResp.Estimate.GasCosts {
			if amountUSD, err := strconv.ParseFloat(gasCost.AmountUSD, 64); err == nil {
				totalGasCostUSD += amountUSD
			}
		}
		
		// Check if gas costs exceed 5% of trade value
		if totalGasCostUSD > req.Amount.InexactFloat64()*0.05 {
			issues = append(issues, fmt.Sprintf("High gas costs: $%.2f", totalGasCostUSD))
			score -= 0.2
		}
	}
	
	// Check execution duration
	if lifiResp.Estimate.ExecutionDuration > 600 { // 10 minutes
		issues = append(issues, "Execution time too long")
		score -= 0.1
	}
	
	// Ensure score is non-negative
	if score < 0 {
		score = 0
	}
	
	return &QuoteValidation{
		IsValid: score >= 0.7,
		Score:   score,
		Issues:  issues,
	}
}

// calculateCacheTTL calculates cache TTL based on validation score
func (l *LiFiService) calculateCacheTTL(validationScore float64) time.Duration {
	baseTTL := 30 * time.Second
	
	// Higher validation score = longer cache time
	if validationScore >= 0.9 {
		return baseTTL * 2 // 60 seconds
	} else if validationScore >= 0.8 {
		return baseTTL // 30 seconds
	} else {
		return baseTTL / 2 // 15 seconds
	}
}

// convertToEnhancedQuote converts LiFi response to our Quote model with enhanced data
func (l *LiFiService) convertToEnhancedQuote(lifiResp *LiFiQuoteResponse, req *models.QuoteRequest, validationScore float64) (*models.Quote, error) {
	fromAmount, err := decimal.NewFromString(lifiResp.Estimate.FromAmount)
	if err != nil {
		return nil, fmt.Errorf("invalid fromAmount: %w", err)
	}

	toAmount, err := decimal.NewFromString(lifiResp.Estimate.ToAmount)
	if err != nil {
		return nil, fmt.Errorf("invalid toAmount: %w", err)
	}

	toAmountMin, err := decimal.NewFromString(lifiResp.Estimate.ToAmountMin)
	if err != nil {
		return nil, fmt.Errorf("invalid toAmountMin: %w", err)
	}

	// Calculate price (how much toToken per 1 fromToken)
	var price decimal.Decimal
	if !fromAmount.IsZero() {
		price = toAmount.Div(fromAmount)
	}

	// Calculate price impact from gas costs
	priceImpact := decimal.Zero
	totalGasCostUSD := decimal.Zero
	
	for _, gasCost := range lifiResp.Estimate.GasCosts {
		if gasCostUSD, err := decimal.NewFromString(gasCost.AmountUSD); err == nil {
			totalGasCostUSD = totalGasCostUSD.Add(gasCostUSD)
		}
	}

	// Build enhanced gas estimate
	var gasEstimate *models.GasEstimate
	if len(lifiResp.Estimate.GasCosts) > 0 {
		gasCost := lifiResp.Estimate.GasCosts[0]
		if gasLimit, err := decimal.NewFromString(gasCost.Limit); err == nil {
			if gasPrice, err := decimal.NewFromString(gasCost.Amount); err == nil {
				if gasFeeUSD, err := decimal.NewFromString(gasCost.AmountUSD); err == nil {
					gasEstimate = &models.GasEstimate{
						GasLimit:  gasLimit.BigInt().Uint64(),
						GasPrice:  gasPrice,
						GasFee:    gasPrice,
						GasFeeUSD: gasFeeUSD,
					}
				}
			}
		}
	}

	// Build from/to token objects
	fromTokenObj := &models.Token{
		Address:  lifiResp.Action.FromToken.Address,
		Symbol:   lifiResp.Action.FromToken.Symbol,
		Name:     lifiResp.Action.FromToken.Name,
		Decimals: lifiResp.Action.FromToken.Decimals,
		ChainID:  lifiResp.Action.FromToken.ChainID,
		LogoURI:  lifiResp.Action.FromToken.LogoURI,
	}

	toTokenObj := &models.Token{
		Address:  lifiResp.Action.ToToken.Address,
		Symbol:   lifiResp.Action.ToToken.Symbol,
		Name:     lifiResp.Action.ToToken.Name,
		Decimals: lifiResp.Action.ToToken.Decimals,
		ChainID:  lifiResp.Action.ToToken.ChainID,
		LogoURI:  lifiResp.Action.ToToken.LogoURI,
	}

	// Build route with enhanced step information
	routeSteps := []*models.RouteStep{
		{
			Protocol:    lifiResp.Tool,
			FromToken:   fromTokenObj,
			ToToken:     toTokenObj,
			FromAmount:  fromAmount,
			ToAmount:    toAmount,
			Fee:         totalGasCostUSD,
			GasEstimate: gasEstimate,
		},
	}

	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    totalGasCostUSD,
		GasEstimate: gasEstimate,
	}

	// Calculate expiration time (LiFi quotes are valid for ~30 seconds)
	expirationTime := time.Now().Add(30 * time.Second)

	quote := &models.Quote{
		ID:                fmt.Sprintf("lifi-%s", lifiResp.ID),
		Provider:          "lifi",
		FromToken:         fromTokenObj,
		ToToken:           toTokenObj,
		FromAmount:        fromAmount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		PriceImpact:       priceImpact,
		SlippageTolerance: req.SlippageTolerance,
		GasEstimate:       gasEstimate,
		Route:             route,
		CreatedAt:         time.Now(),
		ExpiresAt:         expirationTime,
		CallData:          lifiResp.TransactionRequest.Data,
		Value:             lifiResp.TransactionRequest.Value,
		To:                lifiResp.TransactionRequest.To,
	}

	return quote, nil
}

// getConfidenceLevel returns confidence level based on validation score
func (l *LiFiService) getConfidenceLevel(score float64) string {
	if score > 0.8 {
		return "high"
	} else if score > 0.5 {
		return "medium"
	} else {
		return "low"
	}
} 