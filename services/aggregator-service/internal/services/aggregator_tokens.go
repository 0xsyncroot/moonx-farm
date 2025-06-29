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

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
)

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
	popularKey := ""
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
	popularKey := ""
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

// SearchTokensExternal searches tokens using external APIs with auto-detection
func (a *AggregatorService) SearchTokensExternal(ctx context.Context, query string, limit int) ([]*models.Token, error) {
	return a.ExternalAPIService.SearchTokensExternal(ctx, query)
}

// GetPopularTokensWithPrices gets popular tokens with real-time prices from Binance
// chainID: specify chain ID to get tokens for specific chain, 0 for all active chains
func (a *AggregatorService) GetPopularTokensWithPrices(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Get popular tokens from chain configuration
	popularTokens := a.getPopularTokensFromConfig(chainID)

	// Get prices from Binance API
	symbols := a.extractBinanceSymbols(popularTokens)
	priceData, err := a.ExternalAPIService.GetBinancePrices(ctx, symbols)
	if err != nil {
		logrus.WithError(err).Warn("Failed to get Binance prices, using cached prices")
		// Continue with tokens without updated prices
	}

	// Merge price data with tokens
	tokensWithPrices := a.mergeTokensWithBinancePrices(popularTokens, priceData)

	// Sort by importance: native tokens, major tokens, stablecoins
	a.sortPopularTokens(tokensWithPrices)

	logrus.WithFields(logrus.Fields{
		"tokenCount": len(tokensWithPrices),
		"priceCount": len(priceData),
		"chainID":    chainID,
		"source":     "config+binance",
	}).Info("Popular tokens retrieved with Binance prices")

	return tokensWithPrices, nil
}

// getPopularTokensFromConfig returns popular tokens from chain configuration
func (a *AggregatorService) getPopularTokensFromConfig(chainID int) []*models.Token {
	var tokens []*models.Token

	// Get active chains from config
	activeChains := config.GetActiveChains("production")

	// If chainID is specified, only get tokens for that chain
	if chainID != 0 {
		chainConfig := config.GetChainByID(chainID, "production")
		if chainConfig == nil || !chainConfig.IsActive {
			logrus.WithField("chainID", chainID).Warn("Chain not found or not active")
			return tokens
		}
		activeChains = map[int]*config.ChainConfig{chainID: chainConfig}
	}

	// Build tokens from each active chain
	for cID, chainConfig := range activeChains {
		popularTokensMap := config.GetPopularTokens(cID)

		for symbol, address := range popularTokensMap {
			token := a.buildTokenFromConfig(symbol, address, cID, chainConfig)
			if token != nil {
				tokens = append(tokens, token)
			}
		}
	}

	return tokens
}

// buildTokenFromConfig builds a Token object from config data
func (a *AggregatorService) buildTokenFromConfig(symbol, address string, chainID int, chainConfig *config.ChainConfig) *models.Token {
	token := &models.Token{
		Address:  address,
		Symbol:   symbol,
		ChainID:  chainID,
		Popular:  true,
		IsNative: address == "0x0000000000000000000000000000000000000000",
	}

	// Set token details based on symbol and chain
	switch symbol {
	case "ETH", "WETH":
		token.Name = "Ethereum"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/279/large/ethereum.png"
		if symbol == "ETH" {
			token.IsNative = true
		}
	case "LINK":
		token.Name = "Chainlink"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png"
	case "BNB", "WBNB":
		token.Name = "BNB"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"
		if symbol == "BNB" {
			token.IsNative = true
		}
	case "MATIC":
		token.Name = "Polygon"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png"
		token.IsNative = true
	case "USDC", "USDbC":
		token.Name = "USD Coin"
		token.Decimals = 6
		if chainID == 56 { // BSC has 18 decimals for USDC
			token.Decimals = 18
		}
		token.LogoURI = "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png"
	case "USDT":
		token.Name = "Tether USD"
		token.Decimals = 6
		if chainID == 56 { // BSC has 18 decimals for USDT
			token.Decimals = 18
		}
		token.LogoURI = "https://assets.coingecko.com/coins/images/325/large/Tether.png"
	case "DAI":
		token.Name = "Dai Stablecoin"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png"
	case "BUSD":
		token.Name = "Binance USD"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/9576/large/BUSD.png"
	default:
		token.Name = symbol
		token.Decimals = 18
		// Fallback logo for unknown tokens - use a generic token icon
		token.LogoURI = "https://www.google.com/s2/favicons?domain=ethereum.org&sz=64" // Generic crypto icon
	}

	return token
}

// extractBinanceSymbols extracts unique trading symbols for Binance API
func (a *AggregatorService) extractBinanceSymbols(tokens []*models.Token) []string {
	symbolMap := make(map[string]bool)
	var symbols []string

	for _, token := range tokens {
		var binanceSymbol string
		switch token.Symbol {
		case "ETH":
			binanceSymbol = "ETHUSDT"
		case "BTC", "WBTC":
			binanceSymbol = "BTCUSDT"
		case "USDC", "USDT":
			binanceSymbol = "USDCUSDT"
		case "BNB":
			binanceSymbol = "BNBUSDT"
		case "MATIC":
			binanceSymbol = "MATICUSDT"
		default:
			continue // Skip tokens not available on Binance
		}

		if !symbolMap[binanceSymbol] {
			symbolMap[binanceSymbol] = true
			symbols = append(symbols, binanceSymbol)
		}
	}

	return symbols
}

// mergeTokensWithBinancePrices merges token data with Binance price data
func (a *AggregatorService) mergeTokensWithBinancePrices(tokens []*models.Token, priceData map[string]interface{}) []*models.Token {
	for _, token := range tokens {
		var binanceSymbol string
		switch token.Symbol {
		case "ETH":
			binanceSymbol = "ETHUSDT"
		case "BTC", "WBTC":
			binanceSymbol = "BTCUSDT"
		case "USDC", "USDT":
			binanceSymbol = "USDCUSDT"
		case "BNB":
			binanceSymbol = "BNBUSDT"
		case "MATIC":
			binanceSymbol = "MATICUSDT"
		}

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
				token.Source = "binance"
			}
		}
	}

	return tokens
}

// sortPopularTokens sorts tokens by importance for UI display
func (a *AggregatorService) sortPopularTokens(tokens []*models.Token) {
	sort.Slice(tokens, func(i, j int) bool {
		// Native tokens first
		if tokens[i].IsNative != tokens[j].IsNative {
			return tokens[i].IsNative
		}

		// Then by symbol priority
		priority := map[string]int{
			"ETH": 1, "BTC": 2, "WBTC": 2, "BNB": 3, "MATIC": 4,
			"USDC": 5, "USDT": 6,
		}

		pi, piExists := priority[tokens[i].Symbol]
		pj, pjExists := priority[tokens[j].Symbol]

		if piExists && pjExists {
			return pi < pj
		}
		if piExists {
			return true
		}
		if pjExists {
			return false
		}

		// Finally by symbol alphabetically
		return tokens[i].Symbol < tokens[j].Symbol
	})
}

// PrefetchPopularTokensCache prefetches popular token searches for better cache hit rates
func (a *AggregatorService) PrefetchPopularTokensCache(ctx context.Context) {
	// List of popular search queries to prefetch
	popularQueries := []string{
		"ETH", "BTC", "USDC", "USDT", "BNB", "MATIC",
		"ethereum", "bitcoin", "USD Coin", "Tether",
	}

	// Prefetch in background goroutines
	for _, query := range popularQueries {
		go func(q string) {
			defer func() {
				if r := recover(); r != nil {
					logrus.Errorf("Panic in prefetch for query '%s': %v", q, r)
				}
			}()

			// Create cache key similar to SearchTokens
			cacheKey := fmt.Sprintf("search:%s:%d:%d", strings.ToLower(q), 0, 20)

			// Check if already cached
			var cachedResponse *models.TokenListResponse
			if err := a.CacheService.Get(ctx, cacheKey, &cachedResponse); err == nil {
				// Already cached, skip
				return
			}

			// Search and cache results
			tokens, err := a.SearchTokensExternal(ctx, q, 20)
			if err != nil || len(tokens) == 0 {
				return
			}

			// Build response
			response := &models.TokenListResponse{
				Tokens:    tokens,
				Total:     len(tokens),
				UpdatedAt: time.Now(),
				Metadata: map[string]interface{}{
					"query":      q,
					"prefetched": true,
					"strategy":   "background_prefetch",
				},
			}

			// Cache for longer duration (5 minutes for prefetched)
			if err := a.CacheService.Set(ctx, cacheKey, response, 5*time.Minute); err == nil {
				logrus.WithField("query", q).Debug("Prefetched popular token search")
			}
		}(query)
	}
}

// GetCachedTokenSearch attempts to get cached search results with multiple cache tiers
func (a *AggregatorService) GetCachedTokenSearch(ctx context.Context, query string, preferredChainID int, limit int) (*models.TokenListResponse, bool) {
	// Tier 1: Exact match cache
	exactKey := fmt.Sprintf("search:%s:%d:%d", strings.ToLower(query), preferredChainID, limit)
	var response *models.TokenListResponse
	if err := a.CacheService.Get(ctx, exactKey, &response); err == nil && response != nil {
		logrus.WithField("query", query).Debug("Cache hit - exact match")
		return response, true
	}

	// Tier 2: Generic query cache (ignore chain preference and limit)
	genericKey := fmt.Sprintf("search:%s:%d:%d", strings.ToLower(query), 0, 20)
	if err := a.CacheService.Get(ctx, genericKey, &response); err == nil && response != nil {
		// Adapt to requested limit
		if len(response.Tokens) > limit {
			adaptedResponse := *response
			adaptedResponse.Tokens = response.Tokens[:limit]
			adaptedResponse.Total = len(adaptedResponse.Tokens)
			logrus.WithField("query", query).Debug("Cache hit - adapted from generic")
			return &adaptedResponse, true
		}
		logrus.WithField("query", query).Debug("Cache hit - generic match")
		return response, true
	}

	// Tier 3: Partial query cache (for similar queries)
	if len(query) >= 3 {
		partialKey := fmt.Sprintf("search:%s:%d:%d", strings.ToLower(query[:3]), 0, 20)
		if err := a.CacheService.Get(ctx, partialKey, &response); err == nil && response != nil {
			// Filter results to match full query
			var filteredTokens []*models.Token
			queryLower := strings.ToLower(query)

			for _, token := range response.Tokens {
				if strings.Contains(strings.ToLower(token.Symbol), queryLower) ||
					strings.Contains(strings.ToLower(token.Name), queryLower) {
					filteredTokens = append(filteredTokens, token)
					if len(filteredTokens) >= limit {
						break
					}
				}
			}

			if len(filteredTokens) > 0 {
				adaptedResponse := *response
				adaptedResponse.Tokens = filteredTokens
				adaptedResponse.Total = len(filteredTokens)
				adaptedResponse.Metadata = map[string]interface{}{
					"query":       query,
					"cacheSource": "partial_match",
					"originalKey": partialKey,
				}
				logrus.WithFields(logrus.Fields{
					"query":    query,
					"filtered": len(filteredTokens),
					"original": len(response.Tokens),
				}).Debug("Cache hit - partial match with filtering")
				return &adaptedResponse, true
			}
		}
	}

	return nil, false
}

// WarmupSearchCache initializes cache with popular searches
func (a *AggregatorService) WarmupSearchCache(ctx context.Context) {
	logrus.Info("Starting search cache warmup...")

	// Prefetch popular tokens
	a.PrefetchPopularTokensCache(ctx)

	// Warm up popular addresses from config
	popularAddresses := []string{}
	chains := config.GetActiveChains("production") // Use production chains for warmup
	for chainID := range chains {
		tokens := config.GetPopularTokens(chainID)
		for _, address := range tokens {
			popularAddresses = append(popularAddresses, address)
		}
	}

	for _, address := range popularAddresses {
		go func(addr string) {
			defer func() {
				if r := recover(); r != nil {
					logrus.Errorf("Panic in address warmup for '%s': %v", addr, r)
				}
			}()

			_, err := a.SearchTokensExternal(ctx, addr, 10)
			if err == nil {
				logrus.WithField("address", addr).Debug("Warmed up address search")
			}
		}(address)
	}

	logrus.Info("Search cache warmup initiated")
}

// BuildTokenFromConfigWithTestnet builds a Token object with enhanced testnet support
func (a *AggregatorService) BuildTokenFromConfigWithTestnet(symbol, address string, chainID int, chainConfig *config.ChainConfig) *models.Token {
	token := &models.Token{
		Address:  address,
		Symbol:   symbol,
		ChainID:  chainID,
		Popular:  true,
		IsNative: address == "0x0000000000000000000000000000000000000000",
		Source:   "config",
		Verified: true,
	}

	// Set token details based on symbol and chain with enhanced testnet support
	switch symbol {
	case "ETH", "WETH":
		token.Name = "Ethereum"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/279/large/ethereum.png"
		if symbol == "ETH" {
			token.IsNative = true
		}
	case "LINK":
		token.Name = "Chainlink"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png"
	case "BNB", "WBNB":
		token.Name = "BNB"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"
		if symbol == "BNB" {
			token.IsNative = true
		}
	case "MATIC":
		token.Name = "Polygon"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png"
		token.IsNative = true
	case "USDC", "USDbC":
		token.Name = "USD Coin"
		token.Decimals = 6
		if chainID == 56 { // BSC has 18 decimals for USDC
			token.Decimals = 18
		}
		token.LogoURI = "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png"
	case "USDT":
		token.Name = "Tether USD"
		token.Decimals = 6
		if chainID == 56 { // BSC has 18 decimals for USDT
			token.Decimals = 18
		}
		token.LogoURI = "https://assets.coingecko.com/coins/images/325/large/Tether.png"
	case "DAI":
		token.Name = "Dai Stablecoin"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png"
	case "BUSD":
		token.Name = "Binance USD"
		token.Decimals = 18
		token.LogoURI = "https://assets.coingecko.com/coins/images/9576/large/BUSD.png"
	default:
		token.Name = symbol
		token.Decimals = 18
		// Fallback logo for unknown tokens - use a generic token icon
		token.LogoURI = "https://www.google.com/s2/favicons?domain=ethereum.org&sz=64" // Generic crypto icon
	}

	// Set testnet-specific metadata
	if chainConfig.IsTestnet {
		token.PriceUSD = decimal.Zero
		token.Change24h = decimal.Zero
		token.Volume24h = decimal.Zero
		token.MarketCap = decimal.Zero
		token.Source = "testnet"

		// Add testnet indicator to metadata
		if token.Metadata == nil {
			token.Metadata = make(map[string]interface{})
		}
		token.Metadata["isTestnet"] = true
		token.Metadata["chainName"] = chainConfig.Name
	}

	return token
}

// GetTestnetPopularTokens gets popular testnet tokens
func (a *AggregatorService) GetTestnetPopularTokens(ctx context.Context, chainID int) []*models.Token {
	var tokens []*models.Token

	// Get testnet chains only
	testnetChains := config.GetTestnetChains(a.Environment)

	// If chainID is specified, only get tokens for that chain
	if chainID != 0 {
		chainConfig := config.GetChainByID(chainID, a.Environment)
		if chainConfig == nil || !chainConfig.IsTestnet {
			logrus.WithField("chainID", chainID).Warn("Chain not found or not a testnet")
			return tokens
		}
		testnetChains = map[int]*config.ChainConfig{chainID: chainConfig}
	}

	// Build tokens from each testnet chain
	for cID, chainConfig := range testnetChains {
		popularTokensMap := config.GetPopularTokens(cID)

		for symbol, address := range popularTokensMap {
			token := a.BuildTokenFromConfigWithTestnet(symbol, address, cID, chainConfig)
			if token != nil {
				tokens = append(tokens, token)
			}
		}
	}

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"tokenCount": len(tokens),
		"source":     "testnet_config",
	}).Info("Testnet popular tokens retrieved")

	return tokens
}
