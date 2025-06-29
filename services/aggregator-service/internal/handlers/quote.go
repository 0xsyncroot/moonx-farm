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
		tokens, err = h.searchTokenByAddress(c, query, preferredChainID)
	} else {
		// Symbol flow: CoinGecko search
		tokens, err = h.searchTokenBySymbol(c, query, limit)
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
			"strategy":       inputType + "_optimized",
		},
	}

	logrus.WithFields(logrus.Fields{
		"query":     query,
		"inputType": inputType,
		"results":   len(tokens),
		"duration":  duration,
	}).Info("Token search completed")

	c.JSON(http.StatusOK, response)
}

// searchTokenByAddress handles address-based token search
func (h *QuoteHandler) searchTokenByAddress(c *gin.Context, address string, preferredChainID int) ([]*models.Token, error) {
	ctx := c.Request.Context()

	// Step 1: Get basic token info from onchain (concurrent across chains)
	baseToken, err := h.aggregatorService.OnchainService.GetTokenInfoByAddress(ctx, address)
	if err != nil {
		logrus.WithError(err).WithField("address", address).Error("Failed to get onchain token info")
		return nil, fmt.Errorf("token not found onchain: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"address": address,
		"symbol":  baseToken.Symbol,
		"name":    baseToken.Name,
		"chainID": baseToken.ChainID,
	}).Info("Token detected onchain")

	// Step 2: Enhance with market data from DexScreener
	enhancedToken, err := h.aggregatorService.MarketDataService.EnhanceTokenWithMarketData(ctx, baseToken)
	if err != nil {
		logrus.WithError(err).Warn("Failed to enhance token with DexScreener data, using base token")
		enhancedToken = baseToken
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
					// Merge CoinGecko price data
					if !cgToken.PriceUSD.IsZero() {
						enhancedToken.PriceUSD = cgToken.PriceUSD
						enhancedToken.Change24h = cgToken.Change24h
						enhancedToken.Volume24h = cgToken.Volume24h
						enhancedToken.MarketCap = cgToken.MarketCap
						enhancedToken.Source = "onchain+coingecko"
						enhancedToken.LogoURI = cgToken.LogoURI
					}
					break
				}
			}
		}
	}

	return []*models.Token{enhancedToken}, nil
}

// searchTokenBySymbol handles symbol-based token search using CoinGecko
func (h *QuoteHandler) searchTokenBySymbol(c *gin.Context, symbol string, limit int) ([]*models.Token, error) {
	ctx := c.Request.Context()

	// Use CoinGecko search API for symbols/names
	tokens, err := h.aggregatorService.CoinGeckoService.SearchTokensBySymbol(ctx, symbol)
	if err != nil {
		logrus.WithError(err).WithField("symbol", symbol).Error("CoinGecko search failed")
		return nil, fmt.Errorf("symbol search failed: %w", err)
	}

	// Limit results
	if len(tokens) > limit {
		tokens = tokens[:limit]
	}

	// Sort by relevance (market cap, popularity)
	h.sortTokensByRelevance(tokens, symbol)

	logrus.WithFields(logrus.Fields{
		"symbol":  symbol,
		"results": len(tokens),
		"source":  "coingecko",
	}).Info("Symbol search completed")

	return tokens, nil
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

	tokens, err := h.aggregatorService.GetPopularTokensWithPrices(c.Request.Context(), chainID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get popular tokens")
		h.errorResponse(c, http.StatusInternalServerError, "Failed to get popular tokens", err)
		return
	}

	response := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		Page:      1,
		Limit:     len(tokens),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"source":  "config+binance",
			"type":    "popular",
			"chainID": chainID,
		},
	}

	logrus.WithFields(logrus.Fields{
		"tokenCount": len(tokens),
		"chainID":    chainID,
		"source":     "popular_tokens_with_binance_prices",
	}).Info("Popular tokens retrieved with prices")

	c.JSON(http.StatusOK, response)
}
