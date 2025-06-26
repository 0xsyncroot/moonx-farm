package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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

// OneInchService handles 1inch API integration
type OneInchService struct {
	apiConfig    *config.APIConfig
	httpClient   *http.Client
	baseURL      string
	cacheService *CacheService
	tokenUtils   *utils.TokenUtils
}

// NewOneInchService creates a new 1inch service
func NewOneInchService(apiConfig *config.APIConfig, cacheService *CacheService) *OneInchService {
	return &OneInchService{
		apiConfig:    apiConfig,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		baseURL:      "https://api.1inch.dev",
		cacheService: cacheService,
		tokenUtils:   utils.NewTokenUtils(),
	}
}

// 1inch API response structures
type OneInchQuoteResponse struct {
	DstAmount      string `json:"dstAmount"`
	SrcToken       struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		LogoURI  string `json:"logoURI"`
	} `json:"srcToken"`
	DstToken struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		LogoURI  string `json:"logoURI"`
	} `json:"dstToken"`
	Protocols [][]struct {
		Name           string `json:"name"`
		Part           int    `json:"part"`
		FromTokenAddress string `json:"fromTokenAddress"`
		ToTokenAddress   string `json:"toTokenAddress"`
	} `json:"protocols"`
	EstimatedGas string `json:"estimatedGas"`
}

type OneInchSwapResponse struct {
	DstAmount      string `json:"dstAmount"`
	SrcToken       struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		LogoURI  string `json:"logoURI"`
	} `json:"srcToken"`
	DstToken struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		LogoURI  string `json:"logoURI"`
	} `json:"dstToken"`
	Tx struct {
		From     string `json:"from"`
		To       string `json:"to"`
		Data     string `json:"data"`
		Value    string `json:"value"`
		GasPrice string `json:"gasPrice"`
		Gas      string `json:"gas"`
	} `json:"tx"`
	Protocols [][]struct {
		Name           string `json:"name"`
		Part           int    `json:"part"`
		FromTokenAddress string `json:"fromTokenAddress"`
		ToTokenAddress   string `json:"toTokenAddress"`
	} `json:"protocols"`
}

type OneInchTokensResponse struct {
	Tokens map[string]struct {
		Address  string `json:"address"`
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
		LogoURI  string `json:"logoURI"`
	} `json:"tokens"`
}

// GetQuote gets a quote from 1inch
func (o *OneInchService) GetQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// 1inch only supports same-chain swaps, reject cross-chain requests
	if req.ToChainID != 0 && req.ToChainID != req.ChainID {
		return nil, fmt.Errorf("1inch does not support cross-chain swaps (from chain %d to chain %d)", req.ChainID, req.ToChainID)
	}

	// Check cache first
	cacheKey := GenerateQuoteKey(req.FromToken, req.ToToken, req.Amount.String(), req.ChainID, req.SlippageTolerance.String())
	if cachedQuote, err := o.cacheService.GetQuote(ctx, cacheKey); err == nil && cachedQuote != nil {
		logrus.WithField("cacheKey", cacheKey).Debug("1inch quote found in cache")
		return cachedQuote, nil
	}

	// Build request URL
	requestURL, err := o.buildQuoteURL(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build quote URL: %w", err)
	}

	// Make HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Add API key if available
	if o.apiConfig.OneInchAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+o.apiConfig.OneInchAPIKey)
	}

	resp, err := o.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("1inch API error (status %d): %s", resp.StatusCode, string(body))
	}

	// For quote, we first get quote, then get swap data if needed
	var oneInchResp OneInchQuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&oneInchResp); err != nil {
		return nil, fmt.Errorf("failed to decode 1inch response: %w", err)
	}

	// Convert to our Quote model
	quote, err := o.convertQuoteToQuote(&oneInchResp, req)
	if err != nil {
		return nil, fmt.Errorf("failed to convert 1inch response: %w", err)
	}

	// If we need transaction data, get swap data
	if req.UserAddress != "" {
		swapData, err := o.getSwapData(ctx, req)
		if err != nil {
			logrus.WithError(err).Warn("Failed to get 1inch swap data")
		} else {
			quote.CallData = swapData.Tx.Data
			quote.Value = swapData.Tx.Value
			quote.To = swapData.Tx.To
		}
	}

	// Cache the quote
	if err := o.cacheService.SetQuote(ctx, cacheKey, quote); err != nil {
		logrus.WithError(err).Warn("Failed to cache 1inch quote")
	}

	logrus.WithFields(logrus.Fields{
		"fromToken": req.FromToken,
		"toToken":   req.ToToken,
		"amount":    req.Amount,
		"chainID":   req.ChainID,
		"provider":  models.ProviderOneInch,
	}).Info("1inch quote retrieved successfully")

	return quote, nil
}

// getSwapData gets swap transaction data from 1inch
func (o *OneInchService) getSwapData(ctx context.Context, req *models.QuoteRequest) (*OneInchSwapResponse, error) {
	requestURL, err := o.buildSwapURL(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build swap URL: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	if o.apiConfig.OneInchAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+o.apiConfig.OneInchAPIKey)
	}

	resp, err := o.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("1inch swap API error (status %d): %s", resp.StatusCode, string(body))
	}

	var swapResp OneInchSwapResponse
	if err := json.NewDecoder(resp.Body).Decode(&swapResp); err != nil {
		return nil, fmt.Errorf("failed to decode 1inch swap response: %w", err)
	}

	return &swapResp, nil
}

// GetTokenList gets supported tokens from 1inch with optimized caching and speed
func (o *OneInchService) GetTokenList(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Multi-layer cache strategy for maximum speed
	
	// 1. Check primary cache (30min TTL for stable tokens)
	if cachedList, err := o.cacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		// Check if cache is recent enough (less than 3 minutes for active trading)
		if time.Since(cachedList.UpdatedAt) < 3*time.Minute {
			logrus.WithField("chainID", chainID).Debug("1inch token list found in recent cache")
			return cachedList.Tokens, nil
		}
	}

	// 2. Check short-term cache for newly listed tokens (30s TTL)
	shortTermKey := fmt.Sprintf("oneinch:tokens:short:%d", chainID)
	var shortTermTokens []*models.Token
	if err := o.cacheService.Get(ctx, shortTermKey, &shortTermTokens); err == nil {
		logrus.WithField("chainID", chainID).Debug("1inch token list found in short-term cache")
		return shortTermTokens, nil
	}

	requestURL := fmt.Sprintf("%s/swap/v6.0/%d/tokens", o.baseURL, chainID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Optimized headers for speed
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Cache-Control", "no-cache")
	httpReq.Header.Set("Connection", "keep-alive")

	if o.apiConfig.OneInchAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+o.apiConfig.OneInchAPIKey)
	}

	resp, err := o.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("1inch API error (status %d): %s", resp.StatusCode, string(body))
	}

	var oneInchResp OneInchTokensResponse
	if err := json.NewDecoder(resp.Body).Decode(&oneInchResp); err != nil {
		return nil, fmt.Errorf("failed to decode 1inch tokens response: %w", err)
	}

	// Process and prioritize tokens
	tokens := o.processTokenListWithPrioritization(oneInchResp, chainID)

	// Multi-level caching strategy
	tokenList := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
	}

	// Async caching for speed
	go func() {
		// Primary cache (30min for stable tokens)
		if err := o.cacheService.SetTokenList(context.Background(), chainID, tokenList); err != nil {
			logrus.WithError(err).Warn("Failed to cache 1inch token list")
		}

		// Short-term cache (30s for quick access to new tokens)
		shortTermKey := fmt.Sprintf("oneinch:tokens:short:%d", chainID)
		if err := o.cacheService.Set(context.Background(), shortTermKey, tokens, 30*time.Second); err != nil {
			logrus.WithError(err).Warn("Failed to cache short-term 1inch token list")
		}

		// Individual token address cache for instant lookups
		o.cacheTokensByAddress(context.Background(), tokens, chainID)
	}()

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"tokenCount": len(tokens),
		"provider":   "oneinch",
		"cached":     "multiple_layers",
	}).Info("1inch token list retrieved and cached")

	return tokens, nil
}

// processTokenListWithPrioritization processes and prioritizes 1inch tokens
func (o *OneInchService) processTokenListWithPrioritization(oneInchResp OneInchTokensResponse, chainID int) []*models.Token {
	var popularTokens []*models.Token
	var stablecoins []*models.Token
	var otherTokens []*models.Token

	// Define token categories for optimal ordering
	popularAddresses := map[string]bool{
		"0x0000000000000000000000000000000000000000": true, // ETH
		"0x4200000000000000000000000000000000000006": true, // WETH (Base)
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": true, // WETH (Ethereum)
	}

	stablecoinAddresses := map[string]bool{
		"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": true, // USDC (Base)
		"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": true, // USDC (Ethereum)
		"0x6b175474e89094c44da98b954eedeac495271d0f": true, // DAI
		"0xdac17f958d2ee523a2206206994597c13d831ec7": true, // USDT
		"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": true, // USDbC (Base)
	}

	for address, token := range oneInchResp.Tokens {
		normalizedAddr := strings.ToLower(address)
		
		modelToken := &models.Token{
			Address:     address,
			Symbol:      token.Symbol,
			Name:        token.Name,
			Decimals:    token.Decimals,
			ChainID:     chainID,
			LogoURI:     token.LogoURI,
			LastUpdated: time.Now(),
			Metadata: map[string]interface{}{
				"source":      "oneinch",
				"isPopular":   popularAddresses[normalizedAddr],
				"isStable":    stablecoinAddresses[normalizedAddr],
				"hasLogo":     token.LogoURI != "",
			},
		}

		// Categorize for prioritization
		if popularAddresses[normalizedAddr] {
			popularTokens = append(popularTokens, modelToken)
		} else if stablecoinAddresses[normalizedAddr] {
			stablecoins = append(stablecoins, modelToken)
		} else {
			otherTokens = append(otherTokens, modelToken)
		}
	}

	// Sort each category
	sort.Slice(popularTokens, func(i, j int) bool {
		return popularTokens[i].Symbol < popularTokens[j].Symbol
	})
	
	sort.Slice(stablecoins, func(i, j int) bool {
		return stablecoins[i].Symbol < stablecoins[j].Symbol
	})
	
	sort.Slice(otherTokens, func(i, j int) bool {
		return otherTokens[i].Symbol < otherTokens[j].Symbol
	})

	// Combine: Popular -> Stablecoins -> Others
	result := append(popularTokens, stablecoins...)
	return append(result, otherTokens...)
}

// cacheTokensByAddress caches individual tokens by address for ultra-fast lookup
func (o *OneInchService) cacheTokensByAddress(ctx context.Context, tokens []*models.Token, chainID int) {
	for _, token := range tokens {
		// Cache by address (10min TTL)
		addressKey := fmt.Sprintf("oneinch:token:addr:%d:%s", chainID, strings.ToLower(token.Address))
		if err := o.cacheService.Set(ctx, addressKey, token, 10*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"address": token.Address,
				"symbol":  token.Symbol,
			}).Debug("1inch token cached by address")
		}
		
		// Cache by symbol (5min TTL for symbol searches)
		symbolKey := fmt.Sprintf("oneinch:token:symbol:%d:%s", chainID, strings.ToLower(token.Symbol))
		if err := o.cacheService.Set(ctx, symbolKey, token, 5*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"symbol":  token.Symbol,
				"address": token.Address,
			}).Debug("1inch token cached by symbol")
		}
	}
}

// GetTokenByAddress gets a specific token by address with aggressive caching
func (o *OneInchService) GetTokenByAddress(ctx context.Context, address string, chainID int) (*models.Token, error) {
	// Check address cache first for instant response
	addressKey := fmt.Sprintf("oneinch:token:addr:%d:%s", chainID, strings.ToLower(address))
	var token models.Token
	if err := o.cacheService.Get(ctx, addressKey, &token); err == nil {
		logrus.WithField("address", address).Debug("1inch token found in address cache")
		return &token, nil
	}

	// Fallback to full token list
	tokens, err := o.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	normalizedAddress := strings.ToLower(address)
	for _, token := range tokens {
		if strings.ToLower(token.Address) == normalizedAddress {
			// Cache for future instant access
			go o.cacheService.Set(context.Background(), addressKey, token, 10*time.Minute)
			return token, nil
		}
	}

	return nil, fmt.Errorf("token not found in 1inch: %s", address)
}

// buildQuoteURL builds the 1inch API URL for quote request
func (o *OneInchService) buildQuoteURL(req *models.QuoteRequest) (string, error) {
	baseURL, err := url.Parse(fmt.Sprintf("%s/swap/v6.0/%d/quote", o.baseURL, req.ChainID))
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("src", req.FromToken)
	params.Set("dst", req.ToToken)
	params.Set("amount", req.Amount.String())

	if len(req.Protocols) > 0 {
		protocols := ""
		for i, protocol := range req.Protocols {
			if i > 0 {
				protocols += ","
			}
			protocols += protocol
		}
		params.Set("protocols", protocols)
	}

	baseURL.RawQuery = params.Encode()
	return baseURL.String(), nil
}

// buildSwapURL builds the 1inch API URL for swap request
func (o *OneInchService) buildSwapURL(req *models.QuoteRequest) (string, error) {
	baseURL, err := url.Parse(fmt.Sprintf("%s/swap/v6.0/%d/swap", o.baseURL, req.ChainID))
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("src", req.FromToken)
	params.Set("dst", req.ToToken)
	params.Set("amount", req.Amount.String())
	params.Set("from", req.UserAddress)

	if !req.SlippageTolerance.IsZero() {
		params.Set("slippage", req.SlippageTolerance.String())
	}

	if len(req.Protocols) > 0 {
		protocols := ""
		for i, protocol := range req.Protocols {
			if i > 0 {
				protocols += ","
			}
			protocols += protocol
		}
		params.Set("protocols", protocols)
	}

	baseURL.RawQuery = params.Encode()
	return baseURL.String(), nil
}

// convertQuoteToQuote converts 1inch quote response to our Quote model
func (o *OneInchService) convertQuoteToQuote(oneInchResp *OneInchQuoteResponse, req *models.QuoteRequest) (*models.Quote, error) {
	fromAmount := req.Amount

	toAmount, err := decimal.NewFromString(oneInchResp.DstAmount)
	if err != nil {
		return nil, fmt.Errorf("invalid dstAmount: %w", err)
	}

	// Calculate toAmountMin with slippage
	slippageDecimal := req.SlippageTolerance.Div(decimal.NewFromInt(100))
	if slippageDecimal.IsZero() {
		slippageDecimal = decimal.NewFromFloat(0.005) // Default 0.5%
	}
	toAmountMin := toAmount.Mul(decimal.NewFromInt(1).Sub(slippageDecimal))

	// Calculate price
	price := toAmount.Div(fromAmount)

	// Calculate price impact (simplified)
	priceImpact := decimal.Zero

	// Build gas estimate
	var gasEstimate *models.GasEstimate
	if oneInchResp.EstimatedGas != "" {
		gasLimit, _ := strconv.ParseUint(oneInchResp.EstimatedGas, 10, 64)
		gasEstimate = &models.GasEstimate{
			GasLimit: gasLimit,
			GasPrice: decimal.Zero, // Will be filled by actual transaction
			GasFee:   decimal.Zero, // Will be calculated based on gas price
		}
	}

	// Build route steps from protocols
	var routeSteps []*models.RouteStep
	for _, protocolGroup := range oneInchResp.Protocols {
		for _, protocol := range protocolGroup {
			step := &models.RouteStep{
				Type: "swap",
				FromToken: &models.Token{
					Address:  oneInchResp.SrcToken.Address,
					Symbol:   oneInchResp.SrcToken.Symbol,
					Name:     oneInchResp.SrcToken.Name,
					Decimals: oneInchResp.SrcToken.Decimals,
					ChainID:  req.ChainID,
					LogoURI:  oneInchResp.SrcToken.LogoURI,
				},
				ToToken: &models.Token{
					Address:  oneInchResp.DstToken.Address,
					Symbol:   oneInchResp.DstToken.Symbol,
					Name:     oneInchResp.DstToken.Name,
					Decimals: oneInchResp.DstToken.Decimals,
					ChainID:  req.ChainID,
					LogoURI:  oneInchResp.DstToken.LogoURI,
				},
				FromAmount:  fromAmount.Mul(decimal.NewFromInt(int64(protocol.Part)).Div(decimal.NewFromInt(100))),
				ToAmount:    toAmount.Mul(decimal.NewFromInt(int64(protocol.Part)).Div(decimal.NewFromInt(100))),
				Protocol:    protocol.Name,
				Fee:         decimal.Zero,
				PriceImpact: priceImpact,
				GasEstimate: gasEstimate,
			}
			routeSteps = append(routeSteps, step)
		}
	}

	// If no protocols, create a single step
	if len(routeSteps) == 0 {
		routeSteps = []*models.RouteStep{
			{
				Type: "swap",
				FromToken: &models.Token{
					Address:  oneInchResp.SrcToken.Address,
					Symbol:   oneInchResp.SrcToken.Symbol,
					Name:     oneInchResp.SrcToken.Name,
					Decimals: oneInchResp.SrcToken.Decimals,
					ChainID:  req.ChainID,
					LogoURI:  oneInchResp.SrcToken.LogoURI,
				},
				ToToken: &models.Token{
					Address:  oneInchResp.DstToken.Address,
					Symbol:   oneInchResp.DstToken.Symbol,
					Name:     oneInchResp.DstToken.Name,
					Decimals: oneInchResp.DstToken.Decimals,
					ChainID:  req.ChainID,
					LogoURI:  oneInchResp.DstToken.LogoURI,
				},
				FromAmount:  fromAmount,
				ToAmount:    toAmount,
				Protocol:    "1inch",
				Fee:         decimal.Zero,
				PriceImpact: priceImpact,
				GasEstimate: gasEstimate,
			},
		}
	}

	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    decimal.Zero,
		GasEstimate: gasEstimate,
	}

	quote := &models.Quote{
		ID: fmt.Sprintf("1inch-%d-%s-%s-%s", req.ChainID, req.FromToken, req.ToToken, time.Now().Format("20060102150405")),
		FromToken: &models.Token{
			Address:  oneInchResp.SrcToken.Address,
			Symbol:   oneInchResp.SrcToken.Symbol,
			Name:     oneInchResp.SrcToken.Name,
			Decimals: oneInchResp.SrcToken.Decimals,
			ChainID:  req.ChainID,
			LogoURI:  oneInchResp.SrcToken.LogoURI,
		},
		ToToken: &models.Token{
			Address:  oneInchResp.DstToken.Address,
			Symbol:   oneInchResp.DstToken.Symbol,
			Name:     oneInchResp.DstToken.Name,
			Decimals: oneInchResp.DstToken.Decimals,
			ChainID:  req.ChainID,
			LogoURI:  oneInchResp.DstToken.LogoURI,
		},
		FromAmount:        fromAmount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		PriceImpact:       priceImpact,
		SlippageTolerance: req.SlippageTolerance,
		GasEstimate:       gasEstimate,
		Route:             route,
		Provider:          models.ProviderOneInch,
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(10 * time.Minute),
	}

	return quote, nil
} 