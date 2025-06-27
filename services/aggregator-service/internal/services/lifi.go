package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/types/lifi"
	"github.com/moonx-farm/aggregator-service/internal/utils"
	lifiUtils "github.com/moonx-farm/aggregator-service/internal/utils/lifi"
)

// LiFiService handles LiFi API integration - simplified for maximum speed
type LiFiService struct {
	apiConfig       *config.APIConfig
	httpClient      *http.Client
	baseURL         string
	cacheService    *CacheService
	tokenUtils      *utils.TokenUtils
	conversionUtils *lifiUtils.ConversionUtils
}

// NewLiFiService creates a new LiFi service with optimized configuration
func NewLiFiService(apiConfig *config.APIConfig, cacheService *CacheService) *LiFiService {
	// Optimized HTTP transport for better performance
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DisableKeepAlives:   false,
		DisableCompression:  false,
		ForceAttemptHTTP2:   true,
	}

	httpClient := &http.Client{
		Timeout:   30 * time.Second, // Generous timeout - no aggressive limits
		Transport: transport,
	}

	return &LiFiService{
		apiConfig:       apiConfig,
		httpClient:      httpClient,
		baseURL:         "https://li.quest/v1",
		cacheService:    cacheService,
		tokenUtils:      utils.NewTokenUtils(),
		conversionUtils: lifiUtils.NewConversionUtils(),
	}
}

// GetQuote gets a single best quote from LiFi
func (l *LiFiService) GetQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	if req == nil || req.Amount.IsZero() {
		return nil, fmt.Errorf("invalid request")
	}

	// Build request
	lifiReq := l.buildRequest(req)

	// Get quote with generous timeout
	lifiResp, err := l.executeRequest(ctx, lifiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get LiFi quote: %w", err)
	}

	// Convert to quote
	quote := l.conversionUtils.ConvertLiFiToQuote(lifiResp, req)
	return quote, nil
}

// GetMultipleQuotes gets multiple quotes from LiFi using 3 fastest tools with different strategies
func (l *LiFiService) GetMultipleQuotes(ctx context.Context, req *models.QuoteRequest, maxQuotes int) ([]*models.Quote, error) {
	if req == nil || req.Amount.IsZero() {
		return nil, fmt.Errorf("invalid request")
	}

	multiStart := time.Now()
	logrus.WithFields(logrus.Fields{
		"maxQuotes":  maxQuotes,
		"fromToken":  req.FromToken,
		"toToken":    req.ToToken,
		"amount":     req.Amount.String(),
		"crossChain": req.ToChainID != 0 && req.ToChainID != req.ChainID,
	}).Info("🔥 Starting LiFi 3 fastest tools with different strategies")

	// Define fastest tools based on performance analysis
	var fastestTools []struct {
		name     string
		strategy string
		order    string
	}

	if req.ToChainID != 0 && req.ToChainID != req.ChainID {
		// Cross-chain: Use 3 fastest bridges
		fastestTools = []struct {
			name     string
			strategy string
			order    string
		}{
			{"hop", "FASTEST_BRIDGE_1", "FASTEST"},       // ~400ms
			{"thorswap", "FASTEST_BRIDGE_2", "CHEAPEST"}, // ~450ms
			{"mayan", "FASTEST_BRIDGE_3", "FASTEST"},     // ~500ms
		}
		logrus.WithField("fastestBridges", []string{"hop", "thorswap", "mayan"}).Info("🌉 Using 3 fastest bridges")
	} else {
		// Same-chain: Use 3 fastest DEXs
		fastestTools = []struct {
			name     string
			strategy string
			order    string
		}{
			{"kyberswap", "FASTEST_DEX_1", "FASTEST"}, // ~400ms
			{"1inch", "FASTEST_DEX_2", "CHEAPEST"},    // ~700ms
			{"dodo", "FASTEST_DEX_3", "FASTEST"},      // ~1000ms
		}
		logrus.WithField("fastestDEXs", []string{"kyberswap", "1inch", "dodo"}).Info("💱 Using 3 fastest DEXs")
	}

	// Channel to collect results
	type result struct {
		quote    *models.Quote
		err      error
		strategy string
		tool     string
		duration time.Duration
	}

	results := make(chan result, 3) // Expect 3 results
	var wg sync.WaitGroup

	// Launch 3 concurrent calls with fastest tools
	for i, tool := range fastestTools {
		wg.Add(1)
		go func(toolInfo struct {
			name     string
			strategy string
			order    string
		}, index int) {
			defer wg.Done()

			stratStart := time.Now()
			logrus.WithFields(logrus.Fields{
				"tool":     toolInfo.name,
				"strategy": toolInfo.strategy,
				"order":    toolInfo.order,
				"index":    index + 1,
			}).Info("🎯 Starting fastest tool strategy")

			lifiReq := l.buildRequest(req)
			lifiReq.Order = toolInfo.order

			// Set preferred tool based on chain type
			if req.ToChainID != 0 && req.ToChainID != req.ChainID {
				// Cross-chain: Use preferred bridge
				lifiReq.PreferBridges = []string{toolInfo.name}
				logrus.WithFields(logrus.Fields{
					"preferBridge": toolInfo.name,
					"strategy":     toolInfo.strategy,
				}).Info("🌉 Using preferred bridge")
			} else {
				// Same-chain: Use preferred exchange
				lifiReq.PreferExchanges = []string{toolInfo.name}
				logrus.WithFields(logrus.Fields{
					"preferExchange": toolInfo.name,
					"strategy":       toolInfo.strategy,
				}).Info("💱 Using preferred exchange")
			}

			lifiResp, err := l.executeRequest(ctx, lifiReq)
			stratDuration := time.Since(stratStart)

			if err != nil {
				logrus.WithFields(logrus.Fields{
					"tool":     toolInfo.name,
					"strategy": toolInfo.strategy,
					"duration": stratDuration,
					"error":    err.Error(),
				}).Error("❌ Fastest tool strategy failed")
				results <- result{nil, err, toolInfo.strategy, toolInfo.name, stratDuration}
				return
			}

			quote := l.conversionUtils.ConvertLiFiToQuote(lifiResp, req)
			if quote != nil {
				if quote.Metadata == nil {
					quote.Metadata = make(map[string]interface{})
				}
				quote.Metadata["strategy"] = toolInfo.strategy
				quote.Metadata["preferredTool"] = toolInfo.name
				quote.Metadata["order"] = toolInfo.order
				quote.Metadata["toolPerformance"] = fmt.Sprintf("%.0fms", float64(stratDuration.Nanoseconds())/1000000)

				if req.ToChainID != 0 && req.ToChainID != req.ChainID {
					quote.Metadata["preferredBridge"] = toolInfo.name
				} else {
					quote.Metadata["preferredExchange"] = toolInfo.name
				}
			}

			logrus.WithFields(logrus.Fields{
				"tool":     toolInfo.name,
				"strategy": toolInfo.strategy,
				"duration": stratDuration,
				"success":  true,
				"amount":   quote.ToAmount.String(),
			}).Info("✅ Fastest tool strategy completed")

			results <- result{quote, nil, toolInfo.strategy, toolInfo.name, stratDuration}
		}(tool, i)
	}

	launchDuration := time.Since(multiStart)
	logrus.WithFields(logrus.Fields{
		"launchDuration": launchDuration,
		"totalCalls":     3,
		"toolsUsed":      len(fastestTools),
	}).Info("🚀 All 3 fastest tool strategies launched concurrently")

	// Collect results with optimized timeout for fast tools
	var allQuotes []*models.Quote
	resultsReceived := 0
	expectedResults := 3

	// Shorter timeout since we're using fastest tools
	timeout := time.NewTimer(5 * time.Second) // Reduced from 10s to 5s
	defer timeout.Stop()

	collectStart := time.Now()
	var toolPerformance []string

	for resultsReceived < expectedResults {
		select {
		case res := <-results:
			resultsReceived++
			toolPerformance = append(toolPerformance, fmt.Sprintf("%s:%.0fms", res.tool, float64(res.duration.Nanoseconds())/1000000))

			logrus.WithFields(logrus.Fields{
				"tool":      res.tool,
				"strategy":  res.strategy,
				"resultNum": resultsReceived,
				"duration":  res.duration,
				"success":   res.err == nil,
			}).Info("📥 Fastest tool result received")

			if res.err != nil {
				continue // Skip failed requests
			}

			if res.quote != nil {
				allQuotes = append(allQuotes, res.quote)
			}

		case <-timeout.C:
			logrus.WithFields(logrus.Fields{
				"timeout":         "5s",
				"resultsReceived": resultsReceived,
				"expectedResults": expectedResults,
				"quotesFound":     len(allQuotes),
				"toolPerformance": toolPerformance,
			}).Warn("⏰ Fast tools collection timeout - using available results")
			break

		case <-ctx.Done():
			logrus.WithError(ctx.Err()).Warn("🛑 Fast tools collection cancelled by context")
			return allQuotes, ctx.Err()
		}
	}

	collectDuration := time.Since(collectStart)

	// Sort quotes by amount (best first)
	sortStart := time.Now()
	if len(allQuotes) > 1 {
		// Sort by ToAmount (higher is better)
		for i := 0; i < len(allQuotes)-1; i++ {
			for j := i + 1; j < len(allQuotes); j++ {
				if allQuotes[i].ToAmount.Cmp(allQuotes[j].ToAmount) < 0 {
					allQuotes[i], allQuotes[j] = allQuotes[j], allQuotes[i]
				}
			}
		}
	}
	sortDuration := time.Since(sortStart)

	// Limit to maxQuotes
	if len(allQuotes) > maxQuotes {
		allQuotes = allQuotes[:maxQuotes]
	}

	bestAmount := ""
	bestTool := ""
	if len(allQuotes) > 0 {
		bestAmount = allQuotes[0].ToAmount.String()
		if tool, ok := allQuotes[0].Metadata["preferredTool"].(string); ok {
			bestTool = tool
		}
	}

	totalDuration := time.Since(multiStart)
	logrus.WithFields(logrus.Fields{
		"totalDuration":   totalDuration,
		"launchDuration":  launchDuration,
		"collectDuration": collectDuration,
		"sortDuration":    sortDuration,
		"quotesReturned":  len(allQuotes),
		"bestAmount":      bestAmount,
		"bestTool":        bestTool,
		"performance":     fmt.Sprintf("%.0fms total", float64(totalDuration.Nanoseconds())/1000000),
		"toolPerformance": toolPerformance,
		"optimization":    "fastest_tools_only",
	}).Info("🏆 LiFi fastest tools quotes COMPLETED - MAXIMUM SPEED")

	return allQuotes, nil
}

// GetTokenList gets supported tokens from LiFi
func (l *LiFiService) GetTokenList(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Check cache first
	if cachedList, err := l.cacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		if time.Since(cachedList.UpdatedAt) < 10*time.Minute {
			return cachedList.Tokens, nil
		}
	}

	// Build URL
	requestURL := l.buildTokenListURL(chainID)

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Accept", "application/json")
	if l.apiConfig.LiFiAPIKey != "" {
		httpReq.Header.Set("x-lifi-api-key", l.apiConfig.LiFiAPIKey)
	}

	// Execute request
	resp, err := l.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("LiFi API error (status %d): %s", resp.StatusCode, string(body))
	}

	var lifiResp lifi.LiFiTokensResponse
	if err := json.NewDecoder(resp.Body).Decode(&lifiResp); err != nil {
		return nil, fmt.Errorf("failed to decode LiFi tokens response: %w", err)
	}

	// Convert to internal format
	tokens := l.conversionUtils.ConvertTokensListToInternalFormat(&lifiResp)

	// Cache result
	tokenList := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
	}

	go func() {
		if err := l.cacheService.SetTokenList(context.Background(), chainID, tokenList); err != nil {
			logrus.WithError(err).Warn("Failed to cache LiFi token list")
		}
	}()

	return tokens, nil
}

// GetTokenByAddress gets a specific token by address
func (l *LiFiService) GetTokenByAddress(ctx context.Context, address string, chainID int) (*models.Token, error) {
	tokens, err := l.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	normalizedAddress := strings.ToLower(address)
	for _, token := range tokens {
		if strings.ToLower(token.Address) == normalizedAddress {
			return token, nil
		}
	}

	return nil, fmt.Errorf("token not found: %s", address)
}

// GetTokenPrice gets token price from LiFi
func (l *LiFiService) GetTokenPrice(ctx context.Context, tokenAddress string, chainID int) (*models.PriceResponse, error) {
	// Check cache first
	if cachedPrice, err := l.cacheService.GetTokenPrice(ctx, tokenAddress, chainID); err == nil && cachedPrice != nil {
		return cachedPrice, nil
	}

	// Get token from token list
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
			go func() {
				if err := l.cacheService.SetTokenPrice(context.Background(), tokenAddress, chainID, priceResp); err != nil {
					logrus.WithError(err).Warn("Failed to cache LiFi token price")
				}
			}()

			return priceResp, nil
		}
	}

	return nil, fmt.Errorf("token not found: %s", tokenAddress)
}

// buildRequest builds LiFi request with optimized parameters
func (l *LiFiService) buildRequest(req *models.QuoteRequest) *lifi.LiFiQuoteRequest {
	// Simple token normalization
	fromToken := strings.ToLower(req.FromToken)
	toToken := strings.ToLower(req.ToToken)

	// Use amount as-is
	amountWei := req.Amount.String()

	// Convert slippage to decimal format
	slippage := "0.005" // Default 0.5%
	if !req.SlippageTolerance.IsZero() {
		slippage = req.SlippageTolerance.Div(decimal.NewFromInt(100)).String()
	}

	// Use user address or fallback
	userAddress := req.UserAddress
	if userAddress == "" {
		userAddress = "0x000000000000000000000000000000000000dEaD"
	}

	// Determine destination chain
	toChainID := req.ChainID
	if req.ToChainID != 0 {
		toChainID = req.ToChainID
	}

	return &lifi.LiFiQuoteRequest{
		FromChain:   strconv.Itoa(req.ChainID), // String format as per API docs
		ToChain:     strconv.Itoa(toChainID),   // String format as per API docs
		FromToken:   fromToken,
		ToToken:     toToken,
		FromAmount:  amountWei,
		FromAddress: userAddress,
		ToAddress:   userAddress,
		Slippage:    slippage,
		Integrator:  "moonx-farm",
		Referrer:    "0x0000000000000000000000000000000000000000", // Zero address as per docs
		Order:       "FASTEST",                                    // Use FASTEST for speed
	}
}

// executeRequest executes the LiFi API request
func (l *LiFiService) executeRequest(ctx context.Context, lifiReq *lifi.LiFiQuoteRequest) (*lifi.LiFiQuoteResponse, error) {
	// Build request URL
	requestURL, err := l.buildRequestURL(lifiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to build request URL: %w", err)
	}

	// Log request start
	requestStart := time.Now()
	logrus.WithFields(logrus.Fields{
		"url":    requestURL,
		"method": "GET",
	}).Info("🌐 Starting LiFi HTTP request")

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Connection", "keep-alive")
	httpReq.Header.Set("User-Agent", "moonx-farm/1.0.0")

	// Add API key if available
	if l.apiConfig.LiFiAPIKey != "" {
		httpReq.Header.Set("x-lifi-api-key", l.apiConfig.LiFiAPIKey)
	}

	// Execute request with timing
	httpStart := time.Now()
	resp, err := l.httpClient.Do(httpReq)
	if err != nil {
		httpDuration := time.Since(httpStart)
		logrus.WithFields(logrus.Fields{
			"duration": httpDuration,
			"error":    err.Error(),
		}).Error("❌ LiFi HTTP request failed")
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	httpDuration := time.Since(httpStart)
	logrus.WithFields(logrus.Fields{
		"duration":   httpDuration,
		"statusCode": resp.StatusCode,
	}).Info("📡 LiFi HTTP request completed")

	// Read response with timing
	readStart := time.Now()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	readDuration := time.Since(readStart)
	logrus.WithFields(logrus.Fields{
		"duration": readDuration,
		"bodySize": len(body),
	}).Info("📄 Response body read completed")

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LiFi API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response with timing
	parseStart := time.Now()
	var lifiResp lifi.LiFiQuoteResponse
	if err := json.Unmarshal(body, &lifiResp); err != nil {
		return nil, fmt.Errorf("failed to decode LiFi response: %w", err)
	}

	parseDuration := time.Since(parseStart)
	totalDuration := time.Since(requestStart)

	logrus.WithFields(logrus.Fields{
		"parseDuration": parseDuration,
		"totalDuration": totalDuration,
		"httpDuration":  httpDuration,
		"readDuration":  readDuration,
		"performance":   fmt.Sprintf("%.0fms total", float64(totalDuration.Nanoseconds())/1000000),
	}).Info("🎉 LiFi request processing completed")

	return &lifiResp, nil
}

// buildRequestURL builds the complete request URL with parameters
func (l *LiFiService) buildRequestURL(lifiReq *lifi.LiFiQuoteRequest) (string, error) {
	baseURL, err := url.Parse(fmt.Sprintf("%s/quote", l.baseURL))
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("fromChain", lifiReq.FromChain)
	params.Set("toChain", lifiReq.ToChain)
	params.Set("fromToken", lifiReq.FromToken)
	params.Set("toToken", lifiReq.ToToken)
	params.Set("fromAmount", lifiReq.FromAmount)
	params.Set("fromAddress", lifiReq.FromAddress)
	params.Set("toAddress", lifiReq.ToAddress)
	params.Set("slippage", lifiReq.Slippage)
	params.Set("integrator", lifiReq.Integrator)
	params.Set("referrer", lifiReq.Referrer)

	if lifiReq.Order != "" {
		params.Set("order", lifiReq.Order)
	}
	if lifiReq.PreferExchanges != nil {
		params.Set("preferExchanges", strings.Join(lifiReq.PreferExchanges, ","))
	}
	if lifiReq.PreferBridges != nil {
		params.Set("preferBridges", strings.Join(lifiReq.PreferBridges, ","))
	}

	baseURL.RawQuery = params.Encode()
	return baseURL.String(), nil
}

// buildTokenListURL builds URL for token list request
func (l *LiFiService) buildTokenListURL(chainID int) string {
	baseURL := fmt.Sprintf("%s/tokens", l.baseURL)

	params := url.Values{}
	if chainID > 0 {
		params.Set("chains", strconv.Itoa(chainID))
	}
	params.Set("includePrices", "true")
	params.Set("activeOnly", "true")

	if len(params) > 0 {
		return baseURL + "?" + params.Encode()
	}
	return baseURL
}
