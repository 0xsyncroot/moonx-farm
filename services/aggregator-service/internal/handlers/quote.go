package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

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
		FromToken:          fromToken,
		ToToken:            toToken,
		Amount:             amount,
		ChainID:            fromChainID,
		ToChainID:          toChainID,
		UserAddress:        userAddress,
		SlippageTolerance:  slippage,
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
		"quotes":       quotesResponse.Quotes,        // Ordered list with best first
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

// SearchTokens unified token search with intelligent chain prioritization
// @Summary Search tokens
// @Description Search tokens by name, symbol, or address with intelligent chain-based prioritization
// @Tags tokens
// @Accept json
// @Produce json
// @Param q query string true "Search query (name, symbol, or address)"
// @Param chainId query int false "Preferred chain ID for prioritization"
// @Param limit query int false "Maximum results (default: 20, max: 100)"
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

	start := time.Now()

	// Use external API service for comprehensive auto-detection search
	tokens, err := h.aggregatorService.SearchTokensExternal(c.Request.Context(), query, limit)
	if err != nil {
		logrus.WithError(err).WithField("query", query).Error("External token search failed")
		h.errorResponse(c, http.StatusInternalServerError, "Token search failed", err)
		return
	}

	duration := time.Since(start)

	// Auto-detect input type for metadata
	inputType := "symbol"
	if strings.HasPrefix(query, "0x") && len(query) == 42 {
		inputType = "address"
	}

	// Build chain distribution map
	chainDistribution := make(map[string]int)
	for _, token := range tokens {
		chainName := fmt.Sprintf("Chain-%d", token.ChainID)
		chainDistribution[chainName]++
	}

	// Apply limit
	if len(tokens) > limit {
		tokens = tokens[:limit]
	}

	response := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"query":             query,
			"inputType":         inputType,
			"searchStrategy":    "external_apis_with_onchain_fallback",
			"resultCount":       len(tokens),
			"responseTimeMs":    duration.Milliseconds(),
			"chainDistribution": chainDistribution,
			"sources":           []string{"coingecko", "dexscreener", "binance", "onchain"},
		},
	}

	logrus.WithFields(logrus.Fields{
		"query":       query,
		"inputType":   inputType,
		"results":     len(tokens),
		"duration":    duration,
		"chains":      len(chainDistribution),
	}).Info("External token search completed")

	c.JSON(http.StatusOK, response)
}

// searchTokenByAddress searches for token by address across chains
func (h *QuoteHandler) searchTokenByAddress(c *gin.Context, address string, preferredChainID int) *models.Token {
	// Try preferred chain first if specified
	if preferredChainID > 0 {
		if token := h.tryGetTokenByAddress(c, address, preferredChainID); token != nil {
			return token
		}
	}

	// Try major chains
	majorChains := []int{1, 8453, 137, 56, 42161, 10} // Ethereum, Base, Polygon, BSC, Arbitrum, Optimism
	for _, chainID := range majorChains {
		if chainID == preferredChainID {
			continue // Already tried
		}
		if token := h.tryGetTokenByAddress(c, address, chainID); token != nil {
			return token
		}
	}

	return nil
}

// tryGetTokenByAddress attempts to get token from a specific chain
func (h *QuoteHandler) tryGetTokenByAddress(c *gin.Context, address string, chainID int) *models.Token {
	// Try each service
	services := []string{"lifi", "oneinch", "relay"}
	for _, service := range services {
		token, err := h.getTokenFromService(c, service, address, chainID)
		if err == nil && token != nil {
			return token
		}
	}
	return nil
}

// getTokenFromService gets token from specific service
func (h *QuoteHandler) getTokenFromService(c *gin.Context, service, address string, chainID int) (*models.Token, error) {
	ctx := c.Request.Context()
	
	switch service {
	case "lifi":
		return h.aggregatorService.LiFiService.GetTokenByAddress(ctx, address, chainID)
	case "oneinch":
		return h.aggregatorService.OneInchService.GetTokenByAddress(ctx, address, chainID)
	case "relay":
		return h.aggregatorService.RelayService.GetTokenByAddress(ctx, address, chainID)
	default:
		return nil, fmt.Errorf("unknown service: %s", service)
	}
}

// searchTokensByText searches tokens by name/symbol with fallback
func (h *QuoteHandler) searchTokensByText(c *gin.Context, query string, preferredChainID, limit int) []*models.Token {
	var allResults []*models.Token
	
	// Try preferred chain first
	if preferredChainID > 0 {
		if tokens := h.getTokensFromChain(c, preferredChainID); len(tokens) > 0 {
			allResults = append(allResults, h.filterTokensByQuery(tokens, query)...)
		}
	}

	// Get tokens from other major chains
	majorChains := []int{1, 8453, 137, 56, 42161, 10}
	for _, chainID := range majorChains {
		if chainID == preferredChainID {
			continue
		}
		if tokens := h.getTokensFromChain(c, chainID); len(tokens) > 0 {
			filtered := h.filterTokensByQuery(tokens, query)
			allResults = append(allResults, filtered...)
		}
		
		// Stop if we have enough results
		if len(allResults) >= limit*3 {
			break
		}
	}

	return allResults
}

// getTokensFromChain gets token list from specific chain
func (h *QuoteHandler) getTokensFromChain(c *gin.Context, chainID int) []*models.Token {
	tokenList, err := h.aggregatorService.GetTokenList(c.Request.Context(), chainID)
	if err != nil {
		logrus.WithError(err).WithField("chainId", chainID).Warn("Failed to get tokens from chain")
		return nil
	}
	return tokenList.Tokens
}

// filterTokensByQuery filters tokens by search query
func (h *QuoteHandler) filterTokensByQuery(tokens []*models.Token, query string) []*models.Token {
	query = strings.ToLower(query)
	var exactMatches []*models.Token
	var prefixMatches []*models.Token
	var containsMatches []*models.Token

	for _, token := range tokens {
		symbol := strings.ToLower(token.Symbol)
		name := strings.ToLower(token.Name)

		if symbol == query || name == query {
			exactMatches = append(exactMatches, token)
		} else if strings.HasPrefix(symbol, query) || strings.HasPrefix(name, query) {
			prefixMatches = append(prefixMatches, token)
		} else if strings.Contains(symbol, query) || strings.Contains(name, query) {
			containsMatches = append(containsMatches, token)
		}
	}

	// Combine in priority order
	result := append(exactMatches, prefixMatches...)
	return append(result, containsMatches...)
}

// prioritizeTokenResults prioritizes search results intelligently
func (h *QuoteHandler) prioritizeTokenResults(tokens []*models.Token, preferredChainID int) []*models.Token {
	var preferredChainTokens []*models.Token
	var nativeTokens []*models.Token
	var stablecoins []*models.Token
	var popularTokens []*models.Token
	var otherTokens []*models.Token

	// Categorize tokens
	for _, token := range tokens {
		// Preferred chain gets highest priority
		if preferredChainID > 0 && token.ChainID == preferredChainID {
			preferredChainTokens = append(preferredChainTokens, token)
			continue
		}

		// Categorize by type
		if token.IsNative {
			nativeTokens = append(nativeTokens, token)
		} else if h.isStablecoin(token) {
			stablecoins = append(stablecoins, token)
		} else if h.isPopularToken(token) {
			popularTokens = append(popularTokens, token)
		} else {
			otherTokens = append(otherTokens, token)
		}
	}

	// Combine in priority order
	result := append(preferredChainTokens, nativeTokens...)
	result = append(result, stablecoins...)
	result = append(result, popularTokens...)
	return append(result, otherTokens...)
}

// Helper methods
func (h *QuoteHandler) isStablecoin(token *models.Token) bool {
	stableSymbols := map[string]bool{
		"USDC": true, "USDT": true, "DAI": true, "FRAX": true,
		"USDB": true, "USDBC": true, "USDbC": true, "BUSD": true,
	}
	return stableSymbols[strings.ToUpper(token.Symbol)]
}

func (h *QuoteHandler) isPopularToken(token *models.Token) bool {
	if token.Metadata != nil {
		if popular, ok := token.Metadata["isPopular"].(bool); ok && popular {
			return popular
		}
	}
	
	popularSymbols := map[string]bool{
		"WETH": true, "WBTC": true, "UNI": true, "AAVE": true,
		"LINK": true, "SUSHI": true, "CRV": true, "MKR": true,
	}
	return popularSymbols[strings.ToUpper(token.Symbol)]
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