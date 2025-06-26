package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/quote-service/internal/config"
	"github.com/moonx-farm/quote-service/internal/models"
	"github.com/moonx-farm/quote-service/internal/utils"
)

// RelayService handles Relay.link API integration
type RelayService struct {
	apiConfig    *config.APIConfig
	httpClient   *http.Client
	baseURL      string
	cacheService *CacheService
	tokenUtils   *utils.TokenUtils
}

// NewRelayService creates a new Relay service
func NewRelayService(apiConfig *config.APIConfig, cacheService *CacheService) *RelayService {
	return &RelayService{
		apiConfig:    apiConfig,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		baseURL:      "https://api.relay.link",
		cacheService: cacheService,
		tokenUtils:   utils.NewTokenUtils(),
	}
}

// Relay API request and response structures
type RelayQuoteRequest struct {
	OriginChainId       int    `json:"originChainId"`        // Required field!
	DestinationChainId  int    `json:"destinationChainId"`   // Required field!
	OriginCurrency      string `json:"originCurrency"`       // Required field!
	DestinationCurrency string `json:"destinationCurrency"`  // Required field!
	Amount              string `json:"amount"`
	User                string `json:"user"`
	Recipient           string `json:"recipient"`
	TradeType           string `json:"tradeType"`
	Source              string `json:"source,omitempty"`
	UseExternalLiquidity bool   `json:"useExternalLiquidity,omitempty"`
	UseFallbacks        bool   `json:"useFallbacks,omitempty"`
	SlippageTolerance   string `json:"slippageTolerance,omitempty"`
}

type RelayQuoteResponse struct {
	Steps []struct {
		ID          string `json:"id"`
		Action      string `json:"action"`
		Description string `json:"description"`
		Kind        string `json:"kind"`
		RequestID   string `json:"requestId,omitempty"`
		Items       []struct {
			Status string      `json:"status"`
			Data   interface{} `json:"data"`
			Check  interface{} `json:"check"`
		} `json:"items"`
	} `json:"steps"`
	Fees struct {
		Gas struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI    string `json:"logoURI"`
					Verified   bool   `json:"verified"`
					IsNative   bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount           string `json:"amount"`
			AmountFormatted  string `json:"amountFormatted"`
			AmountUsd        string `json:"amountUsd"`
			MinimumAmount    string `json:"minimumAmount"`
		} `json:"gas"`
		Relayer struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
		} `json:"relayer"`
	} `json:"fees"`
	Details struct {
		Operation   string `json:"operation"`
		TimeEstimate int   `json:"timeEstimate"`
		Sender      string `json:"sender"`
		Recipient   string `json:"recipient"`
		CurrencyIn  struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI  string `json:"logoURI"`
					Verified bool   `json:"verified"`
					IsNative bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
		} `json:"currencyIn"`
		CurrencyOut struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI  string `json:"logoURI"`
					Verified bool   `json:"verified"`
					IsNative bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
		} `json:"currencyOut"`
		Rate string `json:"rate"`
	} `json:"details"`
}

type RelayChainsResponse struct {
	Chains []struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
		Icon        string `json:"icon"`
		BaseToken   struct {
			Contract string `json:"contract"`
			Name     string `json:"name"`
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"baseToken"`
	} `json:"chains"`
}

type RelayCurrenciesResponse struct {
	Currencies []struct {
		Contract string `json:"contract"`
		Name     string `json:"name"`
		Symbol   string `json:"symbol"`
		Decimals int    `json:"decimals"`
		Metadata struct {
			LogoURI     string `json:"logoURI"`
			Verified    bool   `json:"verified"`
			IsNative    bool   `json:"isNative"`
		} `json:"metadata"`
	} `json:"currencies"`
}

// GetQuote gets a quote from Relay.link using their REST API
func (r *RelayService) GetQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// Check cache first with user-specific key
	cacheKey := r.generateUserAwareCacheKey(req)
	if cachedQuote, err := r.cacheService.GetQuote(ctx, cacheKey); err == nil && cachedQuote != nil {
		// Validate cached quote is still fresh
		if r.validateCachedQuote(cachedQuote) {
			logrus.WithField("cacheKey", cacheKey).Debug("Relay quote found in cache and validated")
			return cachedQuote, nil
		} else {
			logrus.WithField("cacheKey", cacheKey).Debug("Cached Relay quote failed validation, fetching new")
		}
	}

	// Build request payload
	requestPayload, err := r.buildQuoteRequest(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build quote request: %w", err)
	}

	// Execute request with retry logic
	relayResp, err := r.executeRequestWithRetry(ctx, requestPayload, 3)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote from Relay: %w", err)
	}

	// Convert to our Quote model
	quote, err := r.convertToQuote(relayResp, req)
	if err != nil {
		return nil, fmt.Errorf("failed to convert Relay response: %w", err)
	}

	// Validate quote before caching
	if err := r.validateQuote(quote); err != nil {
		return nil, fmt.Errorf("quote validation failed: %w", err)
	}

	// Cache the quote
	if err := r.cacheService.SetQuote(ctx, cacheKey, quote); err != nil {
		logrus.WithError(err).Warn("Failed to cache Relay quote")
	}

	logrus.WithFields(logrus.Fields{
		"fromToken": req.FromToken,
		"toToken":   req.ToToken,
		"amount":    req.Amount,
		"chainID":   req.ChainID,
		"provider":  "relay",
		"toAmount":  quote.ToAmount,
	}).Info("Relay quote retrieved successfully")

	return quote, nil
}

// GetTokenList gets supported tokens from Relay.link with ultra-fast caching
func (r *RelayService) GetTokenList(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Multi-layer cache strategy optimized for speed
	
	// 1. Check primary cache (20min TTL for stable tokens) 
	if cachedList, err := r.cacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		// Check if cache is fresh enough (less than 2 minutes for new tokens)
		if time.Since(cachedList.UpdatedAt) < 2*time.Minute {
			logrus.WithField("chainID", chainID).Debug("Relay token list found in recent cache")
			return cachedList.Tokens, nil
		}
	}

	// 2. Check ultra-short cache for immediate responses (20s TTL)
	ultraShortKey := fmt.Sprintf("relay:tokens:ultra:%d", chainID)
	var ultraShortTokens []*models.Token
	if err := r.cacheService.Get(ctx, ultraShortKey, &ultraShortTokens); err == nil {
		logrus.WithField("chainID", chainID).Debug("Relay token list found in ultra-short cache")
		return ultraShortTokens, nil
	}

	requestURL := fmt.Sprintf("%s/currencies/v1", r.baseURL)
	if chainID > 0 {
		requestURL += fmt.Sprintf("?chainId=%d", chainID)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Speed-optimized headers
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Cache-Control", "no-cache")
	httpReq.Header.Set("Connection", "keep-alive")
	httpReq.Header.Set("User-Agent", "moonx-farm/1.0.0")

	resp, err := r.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Relay API error (status %d): %s", resp.StatusCode, string(body))
	}

	var relayResp RelayCurrenciesResponse
	if err := json.NewDecoder(resp.Body).Decode(&relayResp); err != nil {
		return nil, fmt.Errorf("failed to decode Relay currencies response: %w", err)
	}

	// Process and prioritize tokens
	tokens := r.processTokenListWithOptimalOrdering(relayResp, chainID)

	// Multi-level caching strategy
	tokenList := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
	}

	// Async caching for maximum performance
	go func() {
		// Primary cache (20min for stable tokens)
		if err := r.cacheService.SetTokenList(context.Background(), chainID, tokenList); err != nil {
			logrus.WithError(err).Warn("Failed to cache Relay token list")
		}

		// Ultra-short cache (20s for instant responses)
		ultraShortKey := fmt.Sprintf("relay:tokens:ultra:%d", chainID)
		if err := r.cacheService.Set(context.Background(), ultraShortKey, tokens, 20*time.Second); err != nil {
			logrus.WithError(err).Warn("Failed to cache ultra-short Relay token list")
		}

		// Individual token address cache for lightning-fast lookups
		r.cacheTokensByAddress(context.Background(), tokens, chainID)
	}()

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"tokenCount": len(tokens),
		"provider":   "relay",
		"cached":     "ultra_optimized",
	}).Info("Relay token list retrieved with ultra-fast caching")

	return tokens, nil
}

// processTokenListWithOptimalOrdering processes tokens with intelligent prioritization
func (r *RelayService) processTokenListWithOptimalOrdering(relayResp RelayCurrenciesResponse, chainID int) []*models.Token {
	var nativeTokens []*models.Token
	var popularTokens []*models.Token
	var stablecoins []*models.Token
	var verifiedTokens []*models.Token
	var otherTokens []*models.Token

	// Define categories for optimal UX
	popularAddresses := map[string]bool{
		"0x0000000000000000000000000000000000000000": true, // ETH
		"0x4200000000000000000000000000000000000006": true, // WETH (Base)
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": true, // WETH (Ethereum)
	}

	stablecoinSymbols := map[string]bool{
		"USDC": true, "USDT": true, "DAI": true, "FRAX": true,
		"USDB": true, "USDBC": true, "USDbC": true,
	}

	for _, currency := range relayResp.Currencies {
		normalizedAddr := strings.ToLower(currency.Contract)
		normalizedSymbol := strings.ToUpper(currency.Symbol)
		
		modelToken := &models.Token{
			Address:     currency.Contract,
			Symbol:      currency.Symbol,
			Name:        currency.Name,
			Decimals:    currency.Decimals,
			ChainID:     chainID,
			LogoURI:     currency.Metadata.LogoURI,
			IsNative:    currency.Metadata.IsNative,
			LastUpdated: time.Now(),
			Metadata: map[string]interface{}{
				"source":     "relay",
				"isNative":   currency.Metadata.IsNative,
				"isVerified": currency.Metadata.Verified,
				"isPopular":  popularAddresses[normalizedAddr],
				"isStable":   stablecoinSymbols[normalizedSymbol],
				"hasLogo":    currency.Metadata.LogoURI != "",
			},
		}

		// Intelligent categorization for optimal ordering
		if currency.Metadata.IsNative {
			nativeTokens = append(nativeTokens, modelToken)
		} else if popularAddresses[normalizedAddr] {
			popularTokens = append(popularTokens, modelToken)
		} else if stablecoinSymbols[normalizedSymbol] {
			stablecoins = append(stablecoins, modelToken)
		} else if currency.Metadata.Verified {
			verifiedTokens = append(verifiedTokens, modelToken)
		} else {
			otherTokens = append(otherTokens, modelToken)
		}
	}

	// Sort each category for optimal user experience
	sortBySymbol := func(tokens []*models.Token) {
		sort.Slice(tokens, func(i, j int) bool {
			return tokens[i].Symbol < tokens[j].Symbol
		})
	}

	sortBySymbol(nativeTokens)
	sortBySymbol(popularTokens)
	sortBySymbol(stablecoins)
	sortBySymbol(verifiedTokens)
	sortBySymbol(otherTokens)

	// Combine in optimal order: Native -> Popular -> Stablecoins -> Verified -> Others
	result := append(nativeTokens, popularTokens...)
	result = append(result, stablecoins...)
	result = append(result, verifiedTokens...)
	return append(result, otherTokens...)
}

// cacheTokensByAddress caches individual tokens for lightning-fast address lookups
func (r *RelayService) cacheTokensByAddress(ctx context.Context, tokens []*models.Token, chainID int) {
	for _, token := range tokens {
		// Cache by address (15min TTL for stability)
		addressKey := fmt.Sprintf("relay:token:addr:%d:%s", chainID, strings.ToLower(token.Address))
		if err := r.cacheService.Set(ctx, addressKey, token, 15*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"address": token.Address,
				"symbol":  token.Symbol,
			}).Debug("Relay token cached by address")
		}
		
		// Cache by symbol (8min TTL for symbol searches)
		symbolKey := fmt.Sprintf("relay:token:symbol:%d:%s", chainID, strings.ToLower(token.Symbol))
		if err := r.cacheService.Set(ctx, symbolKey, token, 8*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"symbol":  token.Symbol,
				"address": token.Address,
			}).Debug("Relay token cached by symbol")
		}

		// Cache native tokens separately for priority access
		if token.IsNative {
			nativeKey := fmt.Sprintf("relay:token:native:%d", chainID)
			if err := r.cacheService.Set(ctx, nativeKey, token, 30*time.Minute); err == nil {
				logrus.WithField("symbol", token.Symbol).Debug("Native token cached")
			}
		}
	}
}

// GetTokenByAddress gets a specific token by address with lightning-fast response
func (r *RelayService) GetTokenByAddress(ctx context.Context, address string, chainID int) (*models.Token, error) {
	// Check address cache first for instant response
	addressKey := fmt.Sprintf("relay:token:addr:%d:%s", chainID, strings.ToLower(address))
	var token models.Token
	if err := r.cacheService.Get(ctx, addressKey, &token); err == nil {
		logrus.WithField("address", address).Debug("Relay token found in address cache")
		return &token, nil
	}

	// Fallback to full token list
	tokens, err := r.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	normalizedAddress := strings.ToLower(address)
	for _, token := range tokens {
		if strings.ToLower(token.Address) == normalizedAddress {
			// Cache for lightning-fast future access
			go r.cacheService.Set(context.Background(), addressKey, token, 15*time.Minute)
			return token, nil
		}
	}

	return nil, fmt.Errorf("token not found in Relay: %s", address)
}

// GetNativeToken gets the native token for a chain with priority caching
func (r *RelayService) GetNativeToken(ctx context.Context, chainID int) (*models.Token, error) {
	// Check native token cache first
	nativeKey := fmt.Sprintf("relay:token:native:%d", chainID)
	var token models.Token
	if err := r.cacheService.Get(ctx, nativeKey, &token); err == nil {
		logrus.WithField("chainID", chainID).Debug("Native token found in cache")
		return &token, nil
	}

	// Fallback to token list and find native
	tokens, err := r.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	for _, token := range tokens {
		if token.IsNative {
			// Cache native token with long TTL
			go r.cacheService.Set(context.Background(), nativeKey, token, 30*time.Minute)
			return token, nil
		}
	}

	return nil, fmt.Errorf("native token not found for chain %d", chainID)
}

// buildQuoteRequest builds the Relay API request payload
func (r *RelayService) buildQuoteRequest(req *models.QuoteRequest) (*RelayQuoteRequest, error) {
	// Convert human-readable amount to wei string
	amountWei, err := r.convertAmountToWei(req.Amount, req.FromToken, req.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to convert amount to wei: %w", err)
	}
	
	// Handle slippage tolerance - Relay expects integer string (e.g. "50" for 0.5%)
	slippageTolerance := "50" // Default 0.5% as "50"
	if !req.SlippageTolerance.IsZero() {
		// Convert percentage to integer string (0.5% -> "50")
		slippageBps := req.SlippageTolerance.Mul(decimal.NewFromInt(100)).IntPart()
		slippageTolerance = fmt.Sprintf("%d", slippageBps)
	}

	// Use user address or fallback to dead address
	userAddress := req.UserAddress
	if userAddress == "" {
		userAddress = "0x000000000000000000000000000000000000dEaD"
	}

	// Determine destination chain - use ToChainID if specified, otherwise same chain
	destinationChainId := req.ChainID
	if req.ToChainID != 0 {
		destinationChainId = req.ToChainID
	}

	relayReq := &RelayQuoteRequest{
		OriginChainId:        req.ChainID,
		DestinationChainId:   destinationChainId,
		OriginCurrency:       r.normalizeTokenAddress(req.FromToken),
		DestinationCurrency:  r.normalizeTokenAddress(req.ToToken),
		Amount:               amountWei,
		User:                 userAddress,
		Recipient:            userAddress,
		TradeType:            "EXACT_INPUT",
		Source:               "moonx-farm",
		UseExternalLiquidity: true,
		UseFallbacks:         true,
		SlippageTolerance:    slippageTolerance,
	}

	return relayReq, nil
}

// executeRequestWithRetry executes the API request with exponential backoff retry
func (r *RelayService) executeRequestWithRetry(ctx context.Context, payload *RelayQuoteRequest, maxRetries int) (*RelayQuoteResponse, error) {
	var lastErr error
	
	for attempt := 0; attempt < maxRetries; attempt++ {
		// Serialize payload
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		
		logrus.WithFields(logrus.Fields{
			"url":                   fmt.Sprintf("%s/quote", r.baseURL),
			"originChainId":         payload.OriginChainId,
			"destinationChainId":    payload.DestinationChainId,
			"originCurrency":        payload.OriginCurrency,
			"destinationCurrency":   payload.DestinationCurrency,
			"amount":                payload.Amount,
			"user":                  payload.User,
			"slippageTolerance":     payload.SlippageTolerance,
			"payload":               string(jsonData),
		}).Info("🔗 Relay API Request")

		// Create HTTP request
		requestURL := fmt.Sprintf("%s/quote", r.baseURL)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", requestURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, fmt.Errorf("failed to create HTTP request: %w", err)
		}

		// Set headers
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("User-Agent", "moonx-farm/1.0.0")
		httpReq.Header.Set("Accept", "application/json")

		// Execute request
		resp, err := r.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("network error: %w", err)
			if attempt < maxRetries-1 {
				backoffDelay := time.Duration(1<<attempt) * time.Second
				logrus.WithFields(logrus.Fields{
					"attempt": attempt + 1,
					"delay":   backoffDelay,
					"error":   err,
				}).Warn("Relay request failed, retrying...")
				time.Sleep(backoffDelay)
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

		// Handle non-200 status codes
		if resp.StatusCode != http.StatusOK {
			errorDetails := r.categorizeAPIError(resp.StatusCode, body)
			
			// Retry on certain error types
			if errorDetails.IsRetryable && attempt < maxRetries-1 {
				backoffDelay := time.Duration(1<<attempt) * time.Second
				logrus.WithFields(logrus.Fields{
					"attempt":    attempt + 1,
					"statusCode": resp.StatusCode,
					"category":   errorDetails.Category,
					"delay":      backoffDelay,
				}).Warn("Relay API error, retrying...")
				time.Sleep(backoffDelay)
				continue
			}
			
			return nil, fmt.Errorf("Relay API error (%d): %s", resp.StatusCode, errorDetails.Message)
		}

		// Parse successful response
		var relayResp RelayQuoteResponse
		if err := json.Unmarshal(body, &relayResp); err != nil {
			return nil, fmt.Errorf("failed to decode Relay response: %w", err)
		}

		return &relayResp, nil
	}

	return nil, lastErr
}

// APIErrorDetails represents categorized API error information
type APIErrorDetails struct {
	Category    string
	Message     string
	IsRetryable bool
}

// categorizeAPIError analyzes and categorizes API errors
func (r *RelayService) categorizeAPIError(statusCode int, body []byte) APIErrorDetails {
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
		return APIErrorDetails{
			Category:    "RATE_LIMIT",
			Message:     "Rate limit exceeded. Please reduce request frequency.",
			IsRetryable: true,
		}
	case 400:
		return APIErrorDetails{
			Category:    "VALIDATION",
			Message:     fmt.Sprintf("Invalid request parameters: %s", errorMsg),
			IsRetryable: false,
		}
	case 401, 403:
		return APIErrorDetails{
			Category:    "AUTH",
			Message:     "Authentication failed. Check API key.",
			IsRetryable: false,
		}
	case 404:
		return APIErrorDetails{
			Category:    "NOT_FOUND",
			Message:     "Endpoint not found or token not supported.",
			IsRetryable: false,
		}
	case 500, 502, 503, 504:
		return APIErrorDetails{
			Category:    "SERVER_ERROR",
			Message:     "Relay server error. Please try again.",
			IsRetryable: true,
		}
	default:
		return APIErrorDetails{
			Category:    "UNKNOWN",
			Message:     fmt.Sprintf("Unexpected error: %s", errorMsg),
			IsRetryable: statusCode >= 500,
		}
	}
}

// generateUserAwareCacheKey creates cache key that includes user context
func (r *RelayService) generateUserAwareCacheKey(req *models.QuoteRequest) string {
	fromToken := r.normalizeTokenAddress(req.FromToken)
	toToken := r.normalizeTokenAddress(req.ToToken)
	
	// Hash user address to maintain privacy while ensuring uniqueness
	userHash := "none"
	if req.UserAddress != "" {
		userHash = r.hashUserAddress(req.UserAddress)
	}
	
	return fmt.Sprintf("relay:v3:%d:%s:%s:%s:%.3f:%s:ts%d", 
		req.ChainID, 
		strings.ToLower(fromToken), 
		strings.ToLower(toToken), 
		req.Amount.String(),
		req.SlippageTolerance.InexactFloat64(),
		userHash,
		time.Now().Unix()/180) // 3-minute buckets for balance between cache efficiency and freshness
}

// hashUserAddress creates a short hash of user address for cache key privacy
func (r *RelayService) hashUserAddress(address string) string {
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

// validateCachedQuote validates if a cached quote is still reliable
func (r *RelayService) validateCachedQuote(quote *models.Quote) bool {
	if quote == nil {
		return false
	}

	// Check if quote has expired (Relay quotes valid for ~60 seconds)
	if time.Since(quote.CreatedAt) > 50*time.Second {
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

	// Check if route exists
	if quote.Route == nil {
		return false
	}

	return true
}

// convertAmountToWei converts human-readable amount to wei string for Relay API
func (r *RelayService) convertAmountToWei(amount decimal.Decimal, tokenAddress string, chainID int) (string, error) {
	// Amount is in human-readable format (e.g. "0.1" for 0.1 ETH)
	// Need to convert to smallest units (wei for ETH, etc.)
	
	decimals, err := r.getTokenDecimals(tokenAddress, chainID)
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
	}).Debug("💰 Relay: Converting human amount to wei")
	
	return amountWei.String(), nil
}

// getTokenDecimals gets token decimals using shared utility
func (r *RelayService) getTokenDecimals(tokenAddress string, chainID int) (int, error) {
	return r.tokenUtils.GetTokenDecimals(tokenAddress, chainID)
}

// getTokenDecimalsFromContract fetches decimals from contract via RPC  
func (r *RelayService) getTokenDecimalsFromContract(tokenAddress string, chainID int) (int, error) {
	// This would require RPC client setup - for now return default
	// TODO: Implement actual contract call
	logrus.WithFields(logrus.Fields{
		"tokenAddress": tokenAddress,
		"chainID":      chainID,
	}).Warn("⚠️ Token decimals not found in known list, using default 18. TODO: implement onchain lookup")
	
	return 18, nil
}

// normalizeTokenAddress normalizes token addresses for Relay API
func (r *RelayService) normalizeTokenAddress(tokenAddress string) string {
	// Convert native ETH representation to Relay format
	if tokenAddress == "0x0000000000000000000000000000000000000000" ||
		tokenAddress == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" {
		return "0x0000000000000000000000000000000000000000"
	}
	return tokenAddress
}

// validateQuote validates the quote response
func (r *RelayService) validateQuote(quote *models.Quote) error {
	if quote == nil {
		return fmt.Errorf("quote is nil")
	}

	if quote.ToAmount.IsZero() || quote.ToAmount.IsNegative() {
		return fmt.Errorf("invalid to amount: %s", quote.ToAmount)
	}

	if quote.FromAmount.IsZero() || quote.FromAmount.IsNegative() {
		return fmt.Errorf("invalid from amount: %s", quote.FromAmount)
	}

	if quote.Price.IsZero() || quote.Price.IsNegative() {
		return fmt.Errorf("invalid price: %s", quote.Price)
	}

	if quote.ExpiresAt.Before(time.Now()) {
		return fmt.Errorf("quote has expired")
	}

	return nil
}

// convertToQuote converts Relay response to our Quote model
func (r *RelayService) convertToQuote(relayResp *RelayQuoteResponse, req *models.QuoteRequest) (*models.Quote, error) {
	// Extract amounts with error handling and fallbacks
	fromAmount, err := decimal.NewFromString(relayResp.Details.CurrencyIn.Amount)
	if err != nil {
		// Fallback to formatted amount if raw amount fails
		if fromAmountFormatted, err2 := decimal.NewFromString(relayResp.Details.CurrencyIn.AmountFormatted); err2 == nil {
			// Adjust for decimals
			decimals := decimal.New(1, int32(relayResp.Details.CurrencyIn.Currency.Decimals))
			fromAmount = fromAmountFormatted.Mul(decimals)
		} else {
			return nil, fmt.Errorf("invalid currencyIn amount: %w", err)
		}
	}

	toAmount, err := decimal.NewFromString(relayResp.Details.CurrencyOut.Amount)
	if err != nil {
		// Fallback to formatted amount if raw amount fails
		if toAmountFormatted, err2 := decimal.NewFromString(relayResp.Details.CurrencyOut.AmountFormatted); err2 == nil {
			// Adjust for decimals
			decimals := decimal.New(1, int32(relayResp.Details.CurrencyOut.Currency.Decimals))
			toAmount = toAmountFormatted.Mul(decimals)
		} else {
			return nil, fmt.Errorf("invalid currencyOut amount: %w", err)
		}
	}

	// Calculate toAmountMin with slippage
	slippageDecimal := req.SlippageTolerance.Div(decimal.NewFromInt(100))
	if slippageDecimal.IsZero() {
		slippageDecimal = decimal.NewFromFloat(0.005) // Default 0.5%
	}
	toAmountMin := toAmount.Mul(decimal.NewFromInt(1).Sub(slippageDecimal))

	// Calculate price
	var price decimal.Decimal
	if relayResp.Details.Rate != "" {
		if ratePrice, err := decimal.NewFromString(relayResp.Details.Rate); err == nil {
			price = ratePrice
		} else {
			// Fallback calculation
			if !fromAmount.IsZero() {
				price = toAmount.Div(fromAmount)
			}
		}
	} else if !fromAmount.IsZero() {
		price = toAmount.Div(fromAmount)
	}

	// Calculate total fees from new structure
	totalFees := decimal.Zero
	if relayResp.Fees.Gas.Amount != "" {
		if gasAmount, err := decimal.NewFromString(relayResp.Fees.Gas.Amount); err == nil {
			totalFees = totalFees.Add(gasAmount)
		}
	}
	if relayResp.Fees.Relayer.Amount != "" {
		if relayerAmount, err := decimal.NewFromString(relayResp.Fees.Relayer.Amount); err == nil {
			totalFees = totalFees.Add(relayerAmount)
		}
	}

	// Build from/to token objects
	fromTokenObj := &models.Token{
		Address:  relayResp.Details.CurrencyIn.Currency.Address,
		Symbol:   relayResp.Details.CurrencyIn.Currency.Symbol,
		Name:     relayResp.Details.CurrencyIn.Currency.Name,
		Decimals: relayResp.Details.CurrencyIn.Currency.Decimals,
		ChainID:  relayResp.Details.CurrencyIn.Currency.ChainID,
		LogoURI:  relayResp.Details.CurrencyIn.Currency.Metadata.LogoURI,
		IsNative: relayResp.Details.CurrencyIn.Currency.Metadata.IsNative,
	}

	toTokenObj := &models.Token{
		Address:  relayResp.Details.CurrencyOut.Currency.Address,
		Symbol:   relayResp.Details.CurrencyOut.Currency.Symbol,
		Name:     relayResp.Details.CurrencyOut.Currency.Name,
		Decimals: relayResp.Details.CurrencyOut.Currency.Decimals,
		ChainID:  relayResp.Details.CurrencyOut.Currency.ChainID,
		LogoURI:  relayResp.Details.CurrencyOut.Currency.Metadata.LogoURI,
		IsNative: relayResp.Details.CurrencyOut.Currency.Metadata.IsNative,
	}

	// Build gas estimate
	var gasEstimate *models.GasEstimate
	if relayResp.Fees.Gas.Amount != "" {
		if gasAmount, err := decimal.NewFromString(relayResp.Fees.Gas.Amount); err == nil {
			if gasAmountUSD, err := decimal.NewFromString(relayResp.Fees.Gas.AmountUsd); err == nil {
				gasEstimate = &models.GasEstimate{
					GasLimit:  0, // Relay doesn't provide gas limit
					GasPrice:  gasAmount,
					GasFee:    gasAmount,
					GasFeeUSD: gasAmountUSD,
				}
			}
		}
	}

	// Build route steps from Relay steps
	var routeSteps []*models.RouteStep
	for range relayResp.Steps {
		routeStep := &models.RouteStep{
			Protocol:    "relay",
			FromToken:   fromTokenObj,
			ToToken:     toTokenObj,
			FromAmount:  fromAmount,
			ToAmount:    toAmount,
			Fee:         totalFees,
			GasEstimate: gasEstimate,
		}
		
		routeSteps = append(routeSteps, routeStep)
	}

	// If no steps, create a single step
	if len(routeSteps) == 0 {
		routeSteps = []*models.RouteStep{
			{
				Protocol:    "relay",
				FromToken:   fromTokenObj,
				ToToken:     toTokenObj,
				FromAmount:  fromAmount,
				ToAmount:    toAmount,
				Fee:         totalFees,
				GasEstimate: gasEstimate,
			},
		}
	}

	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    totalFees,
		GasEstimate: gasEstimate,
	}

	// Calculate expiration time (Relay quotes are valid for 30 seconds)
	expirationTime := time.Now().Add(30 * time.Second)

	quote := &models.Quote{
		ID:                fmt.Sprintf("relay-%d", time.Now().Unix()),
		Provider:          "relay",
		FromToken:         fromTokenObj,
		ToToken:           toTokenObj,
		FromAmount:        fromAmount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		SlippageTolerance: req.SlippageTolerance,
		GasEstimate:       gasEstimate,
		Route:             route,
		CreatedAt:         time.Now(),
		ExpiresAt:         expirationTime,
	}

	return quote, nil
} 