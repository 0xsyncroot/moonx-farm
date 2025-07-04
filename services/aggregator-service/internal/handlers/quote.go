package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/services"
)

type QuoteHandler struct {
	aggregatorService *services.AggregatorService
}

type ErrorResponse struct {
	Error   string      `json:"error"`
	Message string      `json:"message"`
	Code    int         `json:"code"`
	Details interface{} `json:"details,omitempty"`
}

func NewQuoteHandler(aggregatorService *services.AggregatorService) *QuoteHandler {
	return &QuoteHandler{
		aggregatorService: aggregatorService,
	}
}

// GetBestQuote gets the best quote from all sources with cross-chain support
// @Summary Get best quote
// @Description Get the best quote from all available sources, supports same-chain and cross-chain swaps
// @Tags quotes
// @Accept json
// @Produce json
// @Param fromChainId query int true "Source chain ID"
// @Param toChainId query int true "Destination chain ID"
// @Param fromToken query string true "Source token address"
// @Param toToken query string true "Destination token address"
// @Param amount query string true "Amount to swap (in token decimals)"
// @Param userAddress query string false "User wallet address"
// @Param slippage query number false "Slippage tolerance (default: 0.5)"
// @Success 200 {object} models.Quote
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /quote [get]
func (h *QuoteHandler) GetBestQuote(c *gin.Context) {
	// Parse required parameters
	fromChainIDStr := c.Query("fromChainId")
	if fromChainIDStr == "" {
		h.errorResponse(c, http.StatusBadRequest, "fromChainId is required", nil)
		return
	}
	fromChainID, err := strconv.Atoi(fromChainIDStr)
	if err != nil {
		h.errorResponse(c, http.StatusBadRequest, "Invalid fromChainId", err)
		return
	}

	toChainIDStr := c.Query("toChainId")
	if toChainIDStr == "" {
		h.errorResponse(c, http.StatusBadRequest, "toChainId is required", nil)
		return
	}
	toChainID, err := strconv.Atoi(toChainIDStr)
	if err != nil {
		h.errorResponse(c, http.StatusBadRequest, "Invalid toChainId", err)
		return
	}

	fromToken := c.Query("fromToken")
	if fromToken == "" {
		h.errorResponse(c, http.StatusBadRequest, "fromToken is required", nil)
		return
	}

	toToken := c.Query("toToken")
	if toToken == "" {
		h.errorResponse(c, http.StatusBadRequest, "toToken is required", nil)
		return
	}

	amountStr := c.Query("amount")
	if amountStr == "" {
		h.errorResponse(c, http.StatusBadRequest, "amount is required", nil)
		return
	}

	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		h.errorResponse(c, http.StatusBadRequest, "Invalid amount format", err)
		return
	}

	// Parse optional parameters
	userAddress := c.Query("userAddress")

	slippageStr := c.Query("slippage")
	slippage := decimal.NewFromFloat(0.5) // Default 0.5%
	if slippageStr != "" {
		if s, err := decimal.NewFromString(slippageStr); err == nil {
			slippage = s
		}
	}

	// Build quote request
	req := &models.QuoteRequest{
		FromToken:         fromToken,
		ToToken:           toToken,
		Amount:            amount,
		ChainID:           fromChainID,
		ToChainID:         toChainID,
		UserAddress:       userAddress,
		SlippageTolerance: slippage,
	}

	// Get all quotes with best quote suggestion
	quotesResponse, err := h.aggregatorService.GetQuotes(c.Request.Context(), req)
	if err != nil {
		logrus.WithError(err).Error("Failed to get quotes")
		h.errorResponse(c, http.StatusInternalServerError, "Failed to get quotes", err)
		return
	}

	// Enhance response with metadata
	response := gin.H{
		"quotes":       quotesResponse.Quotes, // Ordered list with best first
		"quotesCount":  quotesResponse.QuotesCount,
		"responseTime": quotesResponse.ResponseTime.Milliseconds(),
		"request": gin.H{
			"fromChainId": fromChainID,
			"toChainId":   toChainID,
			"fromToken":   fromToken,
			"toToken":     toToken,
			"amount":      amount.String(),
			"slippage":    slippage.String(),
		},
		"crossChain": fromChainID != toChainID,
		"timestamp":  time.Now().Unix(),
		"metadata":   quotesResponse.Metadata,
	}

	logrus.WithFields(logrus.Fields{
		"fromChainId": fromChainID,
		"toChainId":   toChainID,
		"fromToken":   fromToken,
		"toToken":     toToken,
		"amount":      amount.String(),
		"quotesCount": quotesResponse.QuotesCount,
		"bestProvider": func() string {
			if len(quotesResponse.Quotes) > 0 {
				return quotesResponse.Quotes[0].Provider
			}
			return "none"
		}(),
		"bestAmount": func() string {
			if len(quotesResponse.Quotes) > 0 {
				return quotesResponse.Quotes[0].ToAmount.String()
			}
			return "0"
		}(),
		"responseTime": quotesResponse.ResponseTime,
		"crossChain":   fromChainID != toChainID,
	}).Info("Quotes retrieved and ordered by quality")

	c.JSON(http.StatusOK, response)
}

// SearchTokens unified token search với logic mới
// @Summary Search tokens
// @Description Search tokens by name/symbol (CoinGecko) or address (onchain + DexScreener)
// @Tags tokens
// @Accept json
// @Produce json
// @Param q query string true "Search query (name/symbol or 0x address)"
// @Param chainId query int false "Preferred chain ID for address searches"
// @Param limit query int false "Maximum results (default: 20, max: 100)"
// @Param testnet query bool false "Filter for testnet chains only (default: false for mainnet)"
// @Success 200 {object} models.TokenListResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /tokens/search [get]
func (h *QuoteHandler) SearchTokens(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		h.errorResponse(c, http.StatusBadRequest, "Search query 'q' is required", nil)
		return
	}

	limit := 20
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	preferredChainID := 0
	if chainIDStr := c.Query("chainId"); chainIDStr != "" {
		if cid, err := strconv.Atoi(chainIDStr); err == nil && cid > 0 {
			preferredChainID = cid
		}
	}

	// New: testnet filter parameter
	testnetOnly := false
	if testnetStr := c.Query("testnet"); testnetStr != "" {
		if t, err := strconv.ParseBool(testnetStr); err == nil {
			testnetOnly = t
		}
	}

	start := time.Now()

	// Detect input type: address (0x...) or symbol/name
	inputType := "symbol"
	if strings.HasPrefix(query, "0x") && len(query) == 42 {
		inputType = "address"
	}

	var tokens []*models.Token
	var err error

	if inputType == "address" {
		// Address flow: onchain detection -> DexScreener enhancement
		tokens, err = h.searchTokenByAddress(c, query, preferredChainID, testnetOnly)
	} else {
		// Symbol flow: CoinGecko search
		tokens, err = h.searchTokenBySymbol(c, query, limit, testnetOnly)
	}

	if err != nil {
		logrus.WithError(err).WithField("query", query).Error("Token search failed")
		h.errorResponse(c, http.StatusInternalServerError, "Token search failed", err)
		return
	}

	duration := time.Since(start)

	// Build response
	response := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"query":          query,
			"inputType":      inputType,
			"resultCount":    len(tokens),
			"responseTimeMs": duration.Milliseconds(),
			"preferredChain": preferredChainID,
			"testnetOnly":    testnetOnly,
			"strategy":       inputType + "_optimized",
		},
	}

	logrus.WithFields(logrus.Fields{
		"query":     query,
		"inputType": inputType,
		"results":   len(tokens),
		"testnet":   testnetOnly,
		"duration":  duration,
	}).Info("Token search completed")

	c.JSON(http.StatusOK, response)
}

// searchTokenByAddress handles address-based token search
func (h *QuoteHandler) searchTokenByAddress(c *gin.Context, address string, preferredChainID int, testnetOnly bool) ([]*models.Token, error) {
	ctx := c.Request.Context()

	// STEP 1: Check if this is a popular token FIRST (across all supported chains)
	popularToken := h.getPopularTokenByAddress(ctx, address, testnetOnly)
	if popularToken != nil {
		logrus.WithFields(logrus.Fields{
			"address": address,
			"symbol":  popularToken.Symbol,
			"chainID": popularToken.ChainID,
			"testnet": testnetOnly,
		}).Info("Popular token found by address, skipping onchain lookup")

		return []*models.Token{popularToken}, nil
	}

	// STEP 2: If not popular, get basic token info from onchain
	baseToken, err := h.aggregatorService.OnchainService.GetTokenInfoByAddress(ctx, address)
	if err != nil {
		logrus.WithError(err).WithField("address", address).Error("Failed to get onchain token info")
		return nil, fmt.Errorf("token not found onchain: %w", err)
	}

	// Set verified = false for non-popular tokens by default
	baseToken.Verified = false

	// Filter based on testnet detection using chain config
	chainConfig := config.GetChainByID(baseToken.ChainID, h.aggregatorService.Environment)
	if chainConfig == nil {
		return nil, fmt.Errorf("unsupported chain: %d", baseToken.ChainID)
	}

	// Apply testnet filter
	if testnetOnly && !chainConfig.IsTestnet {
		return nil, fmt.Errorf("token is on mainnet but testnet only requested")
	} else if !testnetOnly && chainConfig.IsTestnet {
		return nil, fmt.Errorf("token is on testnet but mainnet requested")
	}

	logrus.WithFields(logrus.Fields{
		"address": address,
		"symbol":  baseToken.Symbol,
		"name":    baseToken.Name,
		"chainID": baseToken.ChainID,
		"testnet": chainConfig.IsTestnet,
	}).Info("Token detected onchain")

	// Step 2: Enhance with market data from DexScreener (skip for testnet)
	enhancedToken := baseToken
	if !chainConfig.IsTestnet {
		if marketToken, err := h.aggregatorService.MarketDataService.EnhanceTokenWithMarketData(ctx, baseToken); err == nil {
			enhancedToken = marketToken
		} else {
			logrus.WithError(err).Warn("Failed to enhance token with DexScreener data, using base token")
		}

		// Step 3: Fallback to CoinGecko Terminal if no price data
		if enhancedToken.PriceUSD.IsZero() {
			// Try to get price from CoinGecko by searching the symbol
			cgTokens, err := h.aggregatorService.CoinGeckoService.SearchTokensBySymbol(ctx, enhancedToken.Symbol)
			if err == nil && len(cgTokens) > 0 {
				// Find matching token for same chain
				for _, cgToken := range cgTokens {
					if cgToken.ChainID == enhancedToken.ChainID &&
						strings.EqualFold(cgToken.Address, enhancedToken.Address) {

						// ALWAYS merge logoURI if available from CoinGecko
						if cgToken.LogoURI != "" && enhancedToken.LogoURI == "" {
							enhancedToken.LogoURI = cgToken.LogoURI
						}

						// Merge verified status from CoinGecko only if it's a popular token
						if cgToken.Source == "coingecko" && config.IsPopularToken(enhancedToken.Address, enhancedToken.ChainID) {
							enhancedToken.Verified = true
						}

						// Merge CoinGecko price data if available
						if !cgToken.PriceUSD.IsZero() {
							enhancedToken.PriceUSD = cgToken.PriceUSD
							enhancedToken.Change24h = cgToken.Change24h
							enhancedToken.Volume24h = cgToken.Volume24h
							enhancedToken.MarketCap = cgToken.MarketCap
							enhancedToken.Source = "onchain+coingecko"
						}
						break
					}
				}
			}
		}
	} else {
		// For testnet tokens, set source and clear price data
		enhancedToken.Source = "testnet"
		enhancedToken.PriceUSD = decimal.Zero
		enhancedToken.Change24h = decimal.Zero
		enhancedToken.Volume24h = decimal.Zero
		enhancedToken.MarketCap = decimal.Zero
	}

	// IMPORTANT: Ensure token has logoURI and verified metadata before returning
	h.ensureTokenLogo(enhancedToken)

	// Update metadata with verified status
	if enhancedToken.Metadata == nil {
		enhancedToken.Metadata = make(map[string]interface{})
	}
	enhancedToken.Metadata["isVerified"] = enhancedToken.Verified

	logrus.WithFields(logrus.Fields{
		"address":  address,
		"symbol":   enhancedToken.Symbol,
		"chainID":  enhancedToken.ChainID,
		"verified": enhancedToken.Verified,
		"source":   enhancedToken.Source,
	}).Info("Token address search completed with verification status")

	return []*models.Token{enhancedToken}, nil
}

// searchTokenBySymbol handles symbol-based token search with unified popular token logic
func (h *QuoteHandler) searchTokenBySymbol(c *gin.Context, symbol string, limit int, testnetOnly bool) ([]*models.Token, error) {
	ctx := c.Request.Context()

	// STEP 1: Always check popular tokens first (both testnet and mainnet)
	popularTokens := h.getUnifiedPopularTokensBySymbol(ctx, symbol, testnetOnly)
	if len(popularTokens) > 0 {
		logrus.WithFields(logrus.Fields{
			"symbol":  symbol,
			"results": len(popularTokens),
			"testnet": testnetOnly,
			"source":  "popular+enhanced",
		}).Info("Popular tokens found for symbol search")

		// Limit results but prioritize popular tokens
		if len(popularTokens) > limit {
			popularTokens = popularTokens[:limit]
		}

		return popularTokens, nil
	}

	// STEP 2: If no popular tokens found and mainnet, fallback to CoinGecko
	if !testnetOnly {
		allTokens, err := h.aggregatorService.CoinGeckoService.SearchTokensBySymbol(ctx, symbol)
		if err != nil {
			logrus.WithError(err).WithField("symbol", symbol).Error("CoinGecko search failed")
			return nil, fmt.Errorf("symbol search failed: %w", err)
		}

		// Filter tokens by supported chains only
		supportedChains := config.GetActiveChains(h.aggregatorService.Environment)
		var tokens []*models.Token
		for _, token := range allTokens {
			if chainConfig, exists := supportedChains[token.ChainID]; exists && !chainConfig.IsTestnet {
				tokens = append(tokens, token)
			}
		}

		logrus.WithFields(logrus.Fields{
			"symbol":          symbol,
			"allResults":      len(allTokens),
			"filteredResults": len(tokens),
			"supportedChains": len(supportedChains),
		}).Debug("Filtered CoinGecko results by supported chains")

		// Limit results
		if len(tokens) > limit {
			tokens = tokens[:limit]
		}

		// Sort by relevance (market cap, popularity)
		h.sortTokensByRelevance(tokens, symbol)

		// Ensure all tokens have logoURI and set verified status
		for _, token := range tokens {
			h.ensureTokenLogo(token)
			// CoinGecko tokens default to verified = false unless explicitly set
			// Only popular tokens should be automatically verified
			if token.Verified == false {
				// Check if this is a popular token using config
				if config.IsPopularToken(token.Address, token.ChainID) {
					token.Verified = true
				} else {
					// CoinGecko tokens remain unverified by default
					token.Verified = false
				}
			}
			// Set verified metadata
			if token.Metadata == nil {
				token.Metadata = make(map[string]interface{})
			}
			token.Metadata["isVerified"] = token.Verified
		}

		logrus.WithFields(logrus.Fields{
			"symbol":  symbol,
			"results": len(tokens),
			"source":  "coingecko_filtered",
		}).Info("Symbol search completed via CoinGecko with chain filtering")

		return tokens, nil
	}

	// STEP 3: For testnet with no popular matches, return empty
	logrus.WithFields(logrus.Fields{
		"symbol":  symbol,
		"testnet": testnetOnly,
	}).Info("No popular testnet tokens found for symbol")

	return []*models.Token{}, nil
}

// sortTokensByRelevance sorts tokens by market cap and symbol match quality
func (h *QuoteHandler) sortTokensByRelevance(tokens []*models.Token, query string) {
	if len(tokens) <= 1 {
		return
	}

	query = strings.ToUpper(query)

	// Simple sorting by multiple criteria
	for i := 0; i < len(tokens)-1; i++ {
		for j := i + 1; j < len(tokens); j++ {
			shouldSwap := false

			// Primary: Exact symbol match
			iExactMatch := strings.EqualFold(tokens[i].Symbol, query)
			jExactMatch := strings.EqualFold(tokens[j].Symbol, query)

			if jExactMatch && !iExactMatch {
				shouldSwap = true
			} else if iExactMatch == jExactMatch {
				// Secondary: Higher market cap
				if tokens[j].MarketCap.GreaterThan(tokens[i].MarketCap) {
					shouldSwap = true
				} else if tokens[j].MarketCap.Equal(tokens[i].MarketCap) {
					// Tertiary: Popular tokens first
					if tokens[j].Popular && !tokens[i].Popular {
						shouldSwap = true
					}
				}
			}

			if shouldSwap {
				tokens[i], tokens[j] = tokens[j], tokens[i]
			}
		}
	}
}

// errorResponse sends error response
func (h *QuoteHandler) errorResponse(c *gin.Context, statusCode int, message string, err error) {
	response := ErrorResponse{
		Error:   http.StatusText(statusCode),
		Message: message,
		Code:    statusCode,
	}

	if err != nil {
		response.Details = err.Error()
	}

	c.JSON(statusCode, response)
}

// GetPopularTokens gets popular tokens for cross-chain swap with Binance prices
// @Summary Get popular tokens
// @Description Get popular tokens for cross-chain swap with real-time prices from Binance
// @Tags tokens
// @Accept json
// @Produce json
// @Param chainId query int false "Chain ID to filter tokens (0 for all active chains)"
// @Param testnet query bool false "Get testnet tokens only (default: false for mainnet)"
// @Success 200 {object} models.TokenListResponse
// @Failure 500 {object} ErrorResponse
// @Router /tokens/popular [get]
func (h *QuoteHandler) GetPopularTokens(c *gin.Context) {
	// Get chainID from query parameter, default to 0 (all active chains)
	chainID := 0
	if chainIDStr := c.Query("chainId"); chainIDStr != "" {
		if parsed, err := strconv.Atoi(chainIDStr); err == nil && parsed > 0 {
			chainID = parsed
		}
	}

	// Get testnet parameter
	testnetOnly := false
	if testnetStr := c.Query("testnet"); testnetStr != "" {
		if t, err := strconv.ParseBool(testnetStr); err == nil {
			testnetOnly = t
		}
	}

	// Build tokens directly from config metadata like search API
	tokens := h.buildPopularTokensFromConfig(c.Request.Context(), chainID, testnetOnly)

	response := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		Page:      1,
		Limit:     len(tokens),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"source":  fmt.Sprintf("config+%s", map[bool]string{true: "testnet", false: "binance"}[testnetOnly]),
			"type":    "popular",
			"chainID": chainID,
			"testnet": testnetOnly,
		},
	}

	logrus.WithFields(logrus.Fields{
		"tokenCount": len(tokens),
		"chainID":    chainID,
		"testnet":    testnetOnly,
		"source":     "popular_tokens",
	}).Info("Popular tokens retrieved")

	c.JSON(http.StatusOK, response)
}

// NEW: enhanceTokensWithBinancePrices enhances tokens with Binance pricing data
func (h *QuoteHandler) enhanceTokensWithBinancePrices(ctx context.Context, tokens []*models.Token) []*models.Token {
	if len(tokens) == 0 {
		return tokens
	}

	// First, handle USDT separately with fixed $1.00 price
	for _, token := range tokens {
		if strings.ToUpper(token.Symbol) == "USDT" {
			token.PriceUSD = decimal.NewFromFloat(1.00)
			token.Change24h = decimal.NewFromFloat(0.0) // USDT has minimal price change
			token.Volume24h = decimal.NewFromFloat(0.0) // We don't track volume for USDT
			token.LastUpdated = time.Now()
			token.Source = "popular+usdt_fixed"

			// Update metadata with USDT pricing
			if token.Metadata == nil {
				token.Metadata = make(map[string]interface{})
			}
			token.Metadata["usdtFixed"] = true
			token.Metadata["isVerified"] = token.Verified

			logrus.WithFields(logrus.Fields{
				"symbol":   token.Symbol,
				"chainID":  token.ChainID,
				"priceUSD": token.PriceUSD.String(),
			}).Debug("Fixed USDT price applied")
		}
	}

	// Extract unique Binance symbols (excluding USDT)
	symbolMap := make(map[string]bool)
	var binanceSymbols []string

	for _, token := range tokens {
		// Skip USDT as it already has fixed price
		if strings.ToUpper(token.Symbol) == "USDT" {
			continue
		}

		binanceSymbol := h.getBinanceSymbol(token.Symbol)
		if binanceSymbol != "" && !symbolMap[binanceSymbol] {
			symbolMap[binanceSymbol] = true
			binanceSymbols = append(binanceSymbols, binanceSymbol)
		}
	}

	// If no non-USDT tokens, return early
	if len(binanceSymbols) == 0 {
		return tokens
	}

	// Get prices from Binance for non-USDT tokens
	priceData, err := h.aggregatorService.ExternalAPIService.GetBinancePrices(ctx, binanceSymbols)
	if err != nil {
		logrus.WithError(err).Warn("Failed to get Binance prices for search tokens")
		return tokens
	}

	// Merge price data with non-USDT tokens
	for _, token := range tokens {
		// Skip USDT as it already has fixed price
		if strings.ToUpper(token.Symbol) == "USDT" {
			continue
		}

		binanceSymbol := h.getBinanceSymbol(token.Symbol)
		if binanceSymbol != "" && priceData[binanceSymbol] != nil {
			if priceInfo, ok := priceData[binanceSymbol].(map[string]interface{}); ok {
				if priceStr, ok := priceInfo["lastPrice"].(string); ok {
					if price, err := decimal.NewFromString(priceStr); err == nil {
						token.PriceUSD = price
					}
				}
				if changeStr, ok := priceInfo["priceChangePercent"].(string); ok {
					if change, err := decimal.NewFromString(changeStr); err == nil {
						token.Change24h = change
					}
				}
				if volumeStr, ok := priceInfo["quoteVolume"].(string); ok {
					if volume, err := decimal.NewFromString(volumeStr); err == nil {
						token.Volume24h = volume
					}
				}
				token.LastUpdated = time.Now()
				token.Source = "popular+binance"

				// Update metadata with enhanced pricing and verified status
				if token.Metadata == nil {
					token.Metadata = make(map[string]interface{})
				}
				token.Metadata["binanceEnhanced"] = true
				token.Metadata["isVerified"] = token.Verified
			}
		}
	}

	return tokens
}

// NEW: getBinanceSymbol maps token symbols to Binance trading pairs
func (h *QuoteHandler) getBinanceSymbol(tokenSymbol string) string {
	// Handle wrapped tokens - map to native token pricing
	// NOTE: Only USDT is handled separately with fixed $1.00 price
	switch strings.ToUpper(tokenSymbol) {
	case "ETH", "WETH": // Both native and wrapped ETH use same price
		return "ETHUSDT"
	case "BNB", "WBNB": // Both native and wrapped BNB use same price
		return "BNBUSDT"
	case "BTC", "WBTC": // Both native and wrapped BTC use same price
		return "BTCUSDT"
	case "MATIC", "WMATIC": // Both native and wrapped MATIC use same price
		return "MATICUSDT"
	case "USDC": // USDC can have price fluctuation, get from Binance
		return "USDCUSDT"
	case "LINK":
		return "LINKUSDT"
	case "ADA":
		return "ADAUSDT"
	case "DOT":
		return "DOTUSDT"
	case "SOL":
		return "SOLUSDT"
	case "AVAX":
		return "AVAXUSDT"
	// Only USDT is handled separately with fixed $1.00 price
	// case "USDT": handled separately
	default:
		return ""
	}
}

// NEW: buildTokenFromPopularMetadata builds a token from popular token metadata
func (h *QuoteHandler) buildTokenFromPopularMetadata(metadata *config.PopularTokenMetadata, address string, chainID int) *models.Token {
	token := &models.Token{
		Address:     address,
		Symbol:      metadata.Symbol,
		Name:        metadata.Name,
		Decimals:    metadata.Decimals,
		ChainID:     chainID,
		LogoURI:     metadata.LogoURI,
		IsNative:    metadata.IsNative,
		Popular:     true,
		Verified:    true, // Popular tokens are verified by default
		Source:      "popular",
		LastUpdated: time.Now(),
		Metadata: map[string]interface{}{
			"isPopular":     true,
			"isVerified":    true,
			"isStablecoin":  metadata.IsStablecoin,
			"coinGeckoId":   metadata.CoinGeckoID,
			"binanceSymbol": metadata.BinanceSymbol,
			"tags":          metadata.Tags,
		},
	}

	// Ensure token has logoURI
	h.ensureTokenLogo(token)

	return token
}

// NEW: ensureTokenLogo ensures every token has a logoURI, using fallback logic if needed
func (h *QuoteHandler) ensureTokenLogo(token *models.Token) {
	// If token already has logoURI, keep it
	if token.LogoURI != "" {
		return
	}

	// Try to get logo based on symbol using our logo mapping
	logoURI := h.getTokenLogoBySymbol(token.Symbol, token.ChainID)
	if logoURI != "" {
		token.LogoURI = logoURI
		return
	}

	// Fallback to generic crypto icon
	token.LogoURI = "https://www.google.com/s2/favicons?domain=ethereum.org&sz=64"
}

// NEW: getTokenLogoBySymbol returns appropriate logo for common tokens
func (h *QuoteHandler) getTokenLogoBySymbol(symbol string, chainID int) string {
	// Use the same logic as in aggregator service for consistency
	switch strings.ToUpper(symbol) {
	case "ETH", "WETH":
		return "https://assets.coingecko.com/coins/images/279/large/ethereum.png"
	case "BNB", "WBNB":
		return "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"
	case "BTC", "WBTC":
		return "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
	case "USDC": // Removed USDBC due to low liquidity
		return "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png"
	case "USDT":
		return "https://assets.coingecko.com/coins/images/325/large/Tether.png"
	case "LINK":
		return "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png"
	case "MATIC":
		return "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png"
	case "DAI":
		return "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png"
	// Note: BUSD removed due to Binance deprecation
	default:
		return "" // Will use fallback in ensureTokenLogo
	}
}

// NEW: getUnifiedPopularTokensBySymbol returns popular tokens matching symbol for both testnet and mainnet
func (h *QuoteHandler) getUnifiedPopularTokensBySymbol(ctx context.Context, symbol string, testnetOnly bool) []*models.Token {
	var matchingTokens []*models.Token

	// Determine which chains to search
	var chains map[int]*config.ChainConfig
	if testnetOnly {
		chains = config.GetTestnetChains(h.aggregatorService.Environment)
	} else {
		chains = config.GetActiveChains(h.aggregatorService.Environment)
		// Filter out testnets for mainnet search
		mainnetChains := make(map[int]*config.ChainConfig)
		for chainID, chainConfig := range chains {
			if !chainConfig.IsTestnet {
				mainnetChains[chainID] = chainConfig
			}
		}
		chains = mainnetChains
	}

	// Search popular tokens across chains
	for chainID, chainConfig := range chains {
		popularTokensMap := config.GetAllPopularTokensForChain(chainID)
		for address, metadata := range popularTokensMap {
			// Match symbol (exact or contains, case insensitive)
			if strings.EqualFold(metadata.Symbol, symbol) ||
				strings.Contains(strings.ToUpper(metadata.Symbol), strings.ToUpper(symbol)) {

				// Build token from metadata
				token := h.buildTokenFromPopularMetadata(metadata, address, chainID)
				if token != nil {
					// Apply appropriate enhancement
					enhancedToken := h.enhancePopularTokenUnified(ctx, token, chainConfig.IsTestnet)
					matchingTokens = append(matchingTokens, enhancedToken)
				}
			}
		}
	}

	logrus.WithFields(logrus.Fields{
		"symbol":  symbol,
		"testnet": testnetOnly,
		"results": len(matchingTokens),
	}).Info("Unified popular tokens search completed")

	return matchingTokens
}

// NEW: enhancePopularTokenUnified applies appropriate enhancement for both testnet and mainnet popular tokens
func (h *QuoteHandler) enhancePopularTokenUnified(ctx context.Context, token *models.Token, isTestnet bool) *models.Token {
	// Ensure logo is always set
	h.ensureTokenLogo(token)

	// Popular tokens are always verified
	token.Verified = true
	token.Popular = true

	if isTestnet {
		// For testnet tokens, just ensure proper metadata
		token.PriceUSD = decimal.Zero
		token.Change24h = decimal.Zero
		token.Volume24h = decimal.Zero
		token.MarketCap = decimal.Zero
		token.Source = "testnet_popular"

		if token.Metadata == nil {
			token.Metadata = make(map[string]interface{})
		}
		token.Metadata["isTestnet"] = true
		token.Metadata["isPopular"] = true
		token.Metadata["isVerified"] = true

		logrus.WithFields(logrus.Fields{
			"symbol":   token.Symbol,
			"chainID":  token.ChainID,
			"verified": token.Verified,
			"source":   token.Source,
		}).Debug("Testnet popular token enhanced")

		return token
	}

	// For mainnet tokens, apply Binance pricing
	enhancedTokens := h.enhanceTokensWithBinancePrices(ctx, []*models.Token{token})
	if len(enhancedTokens) > 0 {
		enhanced := enhancedTokens[0]
		enhanced.Source = "popular+binance"
		enhanced.Verified = true // Ensure verified is maintained
		enhanced.Popular = true  // Ensure popular is maintained

		logrus.WithFields(logrus.Fields{
			"symbol":   enhanced.Symbol,
			"chainID":  enhanced.ChainID,
			"verified": enhanced.Verified,
			"priceUSD": enhanced.PriceUSD.String(),
			"source":   enhanced.Source,
		}).Debug("Mainnet popular token enhanced with Binance pricing")

		return enhanced
	}

	// Fallback for mainnet without pricing
	token.Source = "popular"
	token.Verified = true // Ensure verified is set
	token.Popular = true  // Ensure popular is maintained
	return token
}

// NEW: getPopularTokenByAddress checks if address is a popular token and returns enhanced token
func (h *QuoteHandler) getPopularTokenByAddress(ctx context.Context, address string, testnetOnly bool) *models.Token {
	// Determine which chains to search
	var chains map[int]*config.ChainConfig
	if testnetOnly {
		chains = config.GetTestnetChains(h.aggregatorService.Environment)
	} else {
		chains = config.GetActiveChains(h.aggregatorService.Environment)
		// Filter out testnets for mainnet search
		mainnetChains := make(map[int]*config.ChainConfig)
		for chainID, chainConfig := range chains {
			if !chainConfig.IsTestnet {
				mainnetChains[chainID] = chainConfig
			}
		}
		chains = mainnetChains
	}

	// Check if address matches any popular token
	normalizedAddress := strings.ToLower(address)
	for chainID, chainConfig := range chains {
		popularTokensMap := config.GetAllPopularTokensForChain(chainID)
		if metadata, exists := popularTokensMap[normalizedAddress]; exists {
			// Build token from metadata
			token := h.buildTokenFromPopularMetadata(metadata, address, chainID)
			if token != nil {
				// Apply appropriate enhancement
				enhancedToken := h.enhancePopularTokenUnified(ctx, token, chainConfig.IsTestnet)

				logrus.WithFields(logrus.Fields{
					"address": address,
					"symbol":  enhancedToken.Symbol,
					"chainID": chainID,
					"testnet": chainConfig.IsTestnet,
					"source":  enhancedToken.Source,
				}).Info("Popular token found by address lookup")

				return enhancedToken
			}
		}
	}

	return nil // Not a popular token
}

// NEW: buildPopularTokensFromConfig builds all popular tokens from config metadata with enhancement
func (h *QuoteHandler) buildPopularTokensFromConfig(ctx context.Context, chainID int, testnetOnly bool) []*models.Token {
	var tokens []*models.Token

	// Determine which chains to search
	var chains map[int]*config.ChainConfig
	if testnetOnly {
		chains = config.GetTestnetChains(h.aggregatorService.Environment)
		if chainID != 0 {
			if chainConfig, exists := chains[chainID]; exists {
				chains = map[int]*config.ChainConfig{chainID: chainConfig}
			} else {
				chains = make(map[int]*config.ChainConfig)
			}
		}
	} else {
		chains = config.GetActiveChains(h.aggregatorService.Environment)
		// Filter out testnets for mainnet search
		mainnetChains := make(map[int]*config.ChainConfig)
		for cID, chainConfig := range chains {
			if !chainConfig.IsTestnet {
				mainnetChains[cID] = chainConfig
			}
		}
		chains = mainnetChains

		if chainID != 0 {
			if chainConfig, exists := chains[chainID]; exists {
				chains = map[int]*config.ChainConfig{chainID: chainConfig}
			} else {
				chains = make(map[int]*config.ChainConfig)
			}
		}
	}

	// Build tokens from config metadata for each chain
	for cID, chainConfig := range chains {
		popularTokensMap := config.GetAllPopularTokensForChain(cID)
		for address, metadata := range popularTokensMap {
			// Build token from metadata
			token := h.buildTokenFromPopularMetadata(metadata, address, cID)
			if token != nil {
				// Apply appropriate enhancement (testnet vs mainnet)
				enhancedToken := h.enhancePopularTokenUnified(ctx, token, chainConfig.IsTestnet)
				tokens = append(tokens, enhancedToken)
			}
		}
	}

	// Sort tokens by priority: native first, then by symbol
	h.sortPopularTokens(tokens)

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"testnet":    testnetOnly,
		"tokenCount": len(tokens),
		"method":     "buildFromConfig",
	}).Info("Popular tokens built from config metadata")

	return tokens
}

// NEW: sortPopularTokens sorts popular tokens by importance
func (h *QuoteHandler) sortPopularTokens(tokens []*models.Token) {
	if len(tokens) <= 1 {
		return
	}

	// Sort by multiple criteria
	for i := 0; i < len(tokens)-1; i++ {
		for j := i + 1; j < len(tokens); j++ {
			shouldSwap := false

			// 1. Native tokens first
			if tokens[j].IsNative && !tokens[i].IsNative {
				shouldSwap = true
			} else if tokens[i].IsNative == tokens[j].IsNative {
				// 2. Symbol priority (ETH, BTC, BNB, USDC, USDT, others)
				iPriority := h.getSymbolPriority(tokens[i].Symbol)
				jPriority := h.getSymbolPriority(tokens[j].Symbol)

				if jPriority < iPriority {
					shouldSwap = true
				} else if iPriority == jPriority {
					// 3. Alphabetical by symbol
					if tokens[j].Symbol < tokens[i].Symbol {
						shouldSwap = true
					}
				}
			}

			if shouldSwap {
				tokens[i], tokens[j] = tokens[j], tokens[i]
			}
		}
	}
}

// NEW: getSymbolPriority returns priority order for token symbols
func (h *QuoteHandler) getSymbolPriority(symbol string) int {
	priorities := map[string]int{
		"ETH":  1,
		"BTC":  2,
		"BNB":  3,
		"USDC": 4,
		"USDT": 5,
		"WETH": 6,
		"WBNB": 7,
		"WBTC": 8,
		"LINK": 9,
		"DAI":  10,
		// Note: BUSD removed due to Binance deprecation
	}

	if priority, exists := priorities[strings.ToUpper(symbol)]; exists {
		return priority
	}
	return 999 // Default for unlisted tokens
}
