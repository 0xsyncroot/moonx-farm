package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/sirupsen/logrus"
	"github.com/shopspring/decimal"
)

// ExternalAPIService handles external API integrations
type ExternalAPIService struct {
	httpClient *http.Client
	cache      *CacheService
	cfg        *config.Config
	logger     *logrus.Logger
}

// NewExternalAPIService creates a new external API service
func NewExternalAPIService(cache *CacheService, cfg *config.Config, logger *logrus.Logger) *ExternalAPIService {
	return &ExternalAPIService{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		cache:  cache,
		cfg:    cfg,
		logger: logger,
	}
}

// CoingeckoToken represents CoinGecko API response
type CoingeckoToken struct {
	ID       string `json:"id"`
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Platforms map[string]string `json:"platforms"`
}

// DexScreenerToken represents DexScreener API response
type DexScreenerToken struct {
	ChainID string `json:"chainId"`
	Address string `json:"address"`
	Name    string `json:"name"`
	Symbol  string `json:"symbol"`
}

// BinanceToken represents Binance API response
type BinanceToken struct {
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
}

// TokenInfo holds contract data from onchain calls
type TokenInfo struct {
	Symbol   string
	Name     string
	Decimals int
}

// Address regex patterns
var (
	ethereumAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)
	symbolRegex         = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]{1,10}$`)
)

// DetectInputType determines if input is address or symbol
func (s *ExternalAPIService) DetectInputType(input string) string {
	input = strings.TrimSpace(input)
	
	if ethereumAddressRegex.MatchString(input) {
		return "address"
	}
	
	if symbolRegex.MatchString(input) {
		return "symbol"
	}
	
	return "unknown"
}

// SearchTokensExternal searches tokens using external APIs
func (s *ExternalAPIService) SearchTokensExternal(ctx context.Context, query string) ([]*models.Token, error) {
	inputType := s.DetectInputType(query)
	
	// Cache key
	cacheKey := fmt.Sprintf("external:search:%s:%s", inputType, strings.ToLower(query))
	
	// Try cache first (for external token search results)
	// Note: We use a simple string key for search cache, not chainID-based
	var cachedResults []*models.Token
	if err := s.cache.Get(ctx, cacheKey, &cachedResults); err == nil && len(cachedResults) > 0 {
		s.logger.Debugf("External search cache hit for: %s", query)
		return cachedResults, nil
	}
	
	var allTokens []*models.Token
	
	// Strategy based on input type
	if inputType == "address" {
		// For addresses: prioritize onchain verification
		tokens := s.searchByAddress(ctx, query)
		allTokens = append(allTokens, tokens...)
	} else {
		// For symbols: external APIs with robust error handling
		// Use channels for parallel execution without blocking
		type apiResult struct {
			tokens []*models.Token
			source string
		}
		
		results := make(chan apiResult, 3)
		
		// 1. GeckoTerminal (free, 30 calls/min)
		go func() {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Errorf("GeckoTerminal search panic: %v", r)
					results <- apiResult{tokens: nil, source: "geckoterminal"}
				}
			}()
			tokens := s.searchGeckoTerminal(ctx, query)
			results <- apiResult{tokens: tokens, source: "geckoterminal"}
		}()
		
		// 2. DexScreener (DEX focused)
		go func() {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Errorf("DexScreener search panic: %v", r)
					results <- apiResult{tokens: nil, source: "dexscreener"}
				}
			}()
			tokens := s.searchDexScreener(ctx, query)
			results <- apiResult{tokens: tokens, source: "dexscreener"}
		}()
		
		// 3. Binance (fast public API)
		go func() {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Errorf("Binance search panic: %v", r)
					results <- apiResult{tokens: nil, source: "binance"}
				}
			}()
			tokens := s.searchBinance(ctx, query)
			results <- apiResult{tokens: tokens, source: "binance"}
		}()
		
		// Collect results with timeout protection
		successfulSources := 0
		for i := 0; i < 3; i++ {
			select {
			case result := <-results:
				if result.tokens != nil && len(result.tokens) > 0 {
					allTokens = append(allTokens, result.tokens...)
					successfulSources++
					s.logger.Debugf("API %s returned %d tokens", result.source, len(result.tokens))
				} else {
					s.logger.Debugf("API %s returned no tokens", result.source)
				}
			case <-ctx.Done():
				s.logger.Warnf("External API search cancelled due to context timeout")
				break
			}
		}
		
		s.logger.Infof("External APIs completed: %d/%d successful", successfulSources, 3)
	}
	
	// Fallback: onchain search across supported chains
	onchainTokens := s.searchOnchain(ctx, query)
	allTokens = append(allTokens, onchainTokens...)
	
	// Deduplicate and sort
	finalTokens := s.deduplicateTokens(allTokens)
	
	// Cache results (5 minutes for external APIs)
	if len(finalTokens) > 0 {
		s.cache.Set(ctx, cacheKey, finalTokens, 5*time.Minute)
	}
	
	return finalTokens, nil
}

// searchGeckoTerminal searches GeckoTerminal API (avoids rate limits)
func (s *ExternalAPIService) searchGeckoTerminal(ctx context.Context, query string) []*models.Token {
	// Use GeckoTerminal pools search which includes token info
	url := fmt.Sprintf("https://api.geckoterminal.com/api/v2/search/pools?query=%s&page=1", query)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Warnf("Failed to create GeckoTerminal request: %v", err)
		return nil
	}
	
	// Add version header as recommended
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "MoonXFarm-QuoteService/1.0")
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Warnf("GeckoTerminal API error: %v", err)
		return nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Warnf("GeckoTerminal API returned status: %d", resp.StatusCode)
		return nil
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Warnf("Failed to read GeckoTerminal response: %v", err)
		return nil
	}
	
	var result struct {
		Data []struct {
			ID         string `json:"id"`
			Attributes struct {
				Name       string `json:"name"`
				Address    string `json:"address"`
				BaseToken  struct {
					Address string `json:"address"`
					Symbol  string `json:"symbol"`
					Name    string `json:"name"`
				} `json:"base_token"`
				QuoteToken struct {
					Address string `json:"address"`
					Symbol  string `json:"symbol"`
					Name    string `json:"name"`
				} `json:"quote_token"`
			} `json:"attributes"`
			Relationships struct {
				Network struct {
					Data struct {
						ID string `json:"id"`
					} `json:"data"`
				} `json:"network"`
			} `json:"relationships"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Warnf("Failed to parse GeckoTerminal response: %v", err)
		return nil
	}
	
	var tokens []*models.Token
	chains := config.GetActiveChains(s.cfg.Environment)
	seenTokens := make(map[string]bool)
	
	for _, pool := range result.Data {
		networkID := pool.Relationships.Network.Data.ID
		chainID := s.mapGeckoTerminalNetworkToChainID(networkID)
		if chainID == 0 {
			continue
		}
		
		if _, exists := chains[chainID]; !exists {
			continue
		}
		
		// Add base token
		baseKey := fmt.Sprintf("%d:%s", chainID, strings.ToLower(pool.Attributes.BaseToken.Address))
		if !seenTokens[baseKey] && pool.Attributes.BaseToken.Address != "" {
			tokens = append(tokens, &models.Token{
				Address:  strings.ToLower(pool.Attributes.BaseToken.Address),
				Symbol:   strings.ToUpper(pool.Attributes.BaseToken.Symbol),
				Name:     pool.Attributes.BaseToken.Name,
				ChainID:  chainID,
				Decimals: 18,
				Source:   "geckoterminal",
				Verified: true,
				Popular:  false,
			})
			seenTokens[baseKey] = true
		}
		
		// Add quote token if not stablecoin
		quoteKey := fmt.Sprintf("%d:%s", chainID, strings.ToLower(pool.Attributes.QuoteToken.Address))
		if !seenTokens[quoteKey] && pool.Attributes.QuoteToken.Address != "" && !s.isStablecoin(pool.Attributes.QuoteToken.Symbol) {
			tokens = append(tokens, &models.Token{
				Address:  strings.ToLower(pool.Attributes.QuoteToken.Address),
				Symbol:   strings.ToUpper(pool.Attributes.QuoteToken.Symbol),
				Name:     pool.Attributes.QuoteToken.Name,
				ChainID:  chainID,
				Decimals: 18,
				Source:   "geckoterminal",
				Verified: true,
				Popular:  false,
			})
			seenTokens[quoteKey] = true
		}
	}
	
	s.logger.Debugf("GeckoTerminal found %d tokens for: %s", len(tokens), query)
	return tokens
}

// searchDexScreener searches DexScreener API
func (s *ExternalAPIService) searchDexScreener(ctx context.Context, query string) []*models.Token {
	url := fmt.Sprintf("https://api.dexscreener.com/latest/dex/search/?q=%s", query)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Warnf("Failed to create DexScreener request: %v", err)
		return nil
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Warnf("DexScreener API error: %v", err)
		return nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Warnf("DexScreener API returned status: %d", resp.StatusCode)
		return nil
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Warnf("Failed to read DexScreener response: %v", err)
		return nil
	}
	
	var result struct {
		Pairs []struct {
			ChainID    string `json:"chainId"`
			BaseToken  DexScreenerToken `json:"baseToken"`
			QuoteToken DexScreenerToken `json:"quoteToken"`
		} `json:"pairs"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Warnf("Failed to parse DexScreener response: %v", err)
		return nil
	}
	
	var tokens []*models.Token
	chains := config.GetActiveChains(s.cfg.Environment)
	seenTokens := make(map[string]bool)
	
	for _, pair := range result.Pairs {
		chainID := s.mapDexScreenerChainToID(pair.ChainID)
		if chainID == 0 {
			continue
		}
		
		if _, exists := chains[chainID]; !exists {
			continue
		}
		
		// Add base token
		baseKey := fmt.Sprintf("%d:%s", chainID, strings.ToLower(pair.BaseToken.Address))
		if !seenTokens[baseKey] {
			tokens = append(tokens, &models.Token{
				Address:  strings.ToLower(pair.BaseToken.Address),
				Symbol:   strings.ToUpper(pair.BaseToken.Symbol),
				Name:     pair.BaseToken.Name,
				ChainID:  chainID,
				Decimals: 18,
				Source:   "dexscreener",
				Verified: true,
				Popular:  false,
			})
			seenTokens[baseKey] = true
		}
		
		// Add quote token if not stablecoin
		quoteKey := fmt.Sprintf("%d:%s", chainID, strings.ToLower(pair.QuoteToken.Address))
		if !seenTokens[quoteKey] && !s.isStablecoin(pair.QuoteToken.Symbol) {
			tokens = append(tokens, &models.Token{
				Address:  strings.ToLower(pair.QuoteToken.Address),
				Symbol:   strings.ToUpper(pair.QuoteToken.Symbol),
				Name:     pair.QuoteToken.Name,
				ChainID:  chainID,
				Decimals: 18,
				Source:   "dexscreener",
				Verified: true,
				Popular:  false,
			})
			seenTokens[quoteKey] = true
		}
	}
	
	s.logger.Debugf("DexScreener found %d tokens for: %s", len(tokens), query)
	return tokens
}

// searchBinance searches Binance public API (no API key required)
func (s *ExternalAPIService) searchBinance(ctx context.Context, query string) []*models.Token {
	// Use fastest endpoint without API key requirement
	url := "https://api1.binance.com/api/v3/ticker/price"
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Warnf("Failed to create Binance request: %v", err)
		return nil
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Warnf("Binance API error: %v", err)
		return nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Warnf("Binance API returned status: %d", resp.StatusCode)
		return nil
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Warnf("Failed to read Binance response: %v", err)
		return nil
	}
	
	var result []struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Warnf("Failed to parse Binance response: %v", err)
		return nil
	}
	
	queryUpper := strings.ToUpper(query)
	var tokens []*models.Token
	seenSymbols := make(map[string]bool)
	
	// Focus on BSC since Binance owns it and provides BSC token mappings
	bscChainID := 56
	if chain := config.GetChainByID(bscChainID, s.cfg.Environment); chain != nil && chain.IsActive {
		popularTokens := config.GetPopularTokens(bscChainID)
		
		for _, ticker := range result {
			// Extract base asset from trading pair (e.g., BTCUSDT -> BTC)
			var baseAsset string
			if strings.HasSuffix(ticker.Symbol, "USDT") {
				baseAsset = strings.TrimSuffix(ticker.Symbol, "USDT")
			} else if strings.HasSuffix(ticker.Symbol, "BUSD") {
				baseAsset = strings.TrimSuffix(ticker.Symbol, "BUSD")
			} else if strings.HasSuffix(ticker.Symbol, "BNB") {
				baseAsset = strings.TrimSuffix(ticker.Symbol, "BNB")
			} else {
				continue // Skip if not a common trading pair
			}
			
			// Check if matches query and we have BSC address
			if strings.Contains(baseAsset, queryUpper) && !seenSymbols[baseAsset] {
				if address, exists := popularTokens[baseAsset]; exists {
					tokens = append(tokens, &models.Token{
						Address:  strings.ToLower(address),
						Symbol:   baseAsset,
						Name:     baseAsset, // Binance doesn't provide full token names in ticker
						ChainID:  bscChainID,
						Decimals: 18,
						Source:   "binance",
						Verified: true,
						Popular:  true,
					})
					seenSymbols[baseAsset] = true
				}
			}
		}
	}
	
	s.logger.Debugf("Binance found %d tokens for: %s", len(tokens), query)
	return tokens
}

// searchByAddress searches token by address across chains with intelligent strategy
func (s *ExternalAPIService) searchByAddress(ctx context.Context, address string) []*models.Token {
	var tokens []*models.Token
	
	// Strategy 1: Check if it's a popular token first
	if popularTokens := s.getPopularTokensForAddress(address); len(popularTokens) > 0 {
		s.logger.Debugf("Found %d popular tokens for address %s", len(popularTokens), address)
		
		// Enhance popular tokens with live Binance prices
		for _, token := range popularTokens {
			s.enhancePopularTokenWithBinancePrice(ctx, token)
			tokens = append(tokens, token)
		}
		return tokens
	}
	
	// Strategy 2: Regular token flow - onchain detection -> external APIs
	chains := config.GetActiveChains(s.cfg.Environment)
	
	// Step 1: Detect which chains have this token by calling name() onchain
	validChains := s.detectTokenChains(ctx, address, chains)
	if len(validChains) == 0 {
		s.logger.Debugf("Token %s not found on any chain", address)
		return tokens
	}
	
	s.logger.Debugf("Token %s found on %d chains: %v", address, len(validChains), validChains)
	
	// Step 2: For each valid chain, get onchain data + external market data
	for _, chainID := range validChains {
		token := s.getTokenWithMarketData(ctx, address, chainID)
		if token != nil {
			tokens = append(tokens, token)
		}
	}
	
	return tokens
}

// searchOnchain performs onchain token verification
func (s *ExternalAPIService) searchOnchain(ctx context.Context, query string) []*models.Token {
	inputType := s.DetectInputType(query)
	var tokens []*models.Token
	
	if inputType == "address" {
		tokens = s.searchByAddress(ctx, query)
	} else {
		// For symbols, check popular tokens first
		chains := config.GetActiveChains(s.cfg.Environment)
		queryUpper := strings.ToUpper(query)
		
		for chainID := range chains {
			popularTokens := config.GetPopularTokens(chainID)
			if address, exists := popularTokens[queryUpper]; exists {
				if token := s.verifyTokenOnchain(ctx, address, chainID); token != nil {
					token.Popular = true
					tokens = append(tokens, token)
				}
			}
		}
	}
	
	return tokens
}

// verifyTokenOnchain verifies token contract onchain using actual RPC calls
func (s *ExternalAPIService) verifyTokenOnchain(ctx context.Context, address string, chainID int) *models.Token {
	chain := config.GetChainByID(chainID, s.cfg.Environment)
	if chain == nil || chain.RpcURL == "" {
		s.logger.Debugf("No RPC configuration for chain %d", chainID)
		return nil
	}
	
	// Create context with timeout for RPC calls
	rpcCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	// Get token info from contract
			tokenInfo, err := s.getTokenInfoFromContract(rpcCtx, address, chainID)
	if err != nil {
		s.logger.Debugf("Failed to get token info for %s on chain %d: %v", address, chainID, err)
		return nil
	}
	
	// Validate that we got meaningful data
	if tokenInfo.Symbol == "" || tokenInfo.Name == "" {
		s.logger.Debugf("Invalid token data for %s on chain %d: symbol=%s, name=%s", 
			address, chainID, tokenInfo.Symbol, tokenInfo.Name)
		return nil
	}
	
	return &models.Token{
		Address:  strings.ToLower(address),
		Symbol:   strings.ToUpper(tokenInfo.Symbol),
		Name:     tokenInfo.Name,
		ChainID:  chainID,
		Decimals: tokenInfo.Decimals,
		Source:   "onchain",
		Verified: true,
		Popular:  false,
	}
}

// Helper functions

// mapGeckoTerminalNetworkToChainID maps GeckoTerminal network IDs to our chain IDs
func (s *ExternalAPIService) mapGeckoTerminalNetworkToChainID(networkID string) int {
	// GeckoTerminal network ID mapping
	networkMap := map[string]int{
		"eth":           1,     // Ethereum
		"bsc":           56,    // BSC Mainnet
		"base":          8453,  // Base Mainnet
		"base-sepolia":  84532, // Base Sepolia Testnet
		"bsc-testnet":   97,    // BSC Testnet
	}
	return networkMap[networkID]
}

func (s *ExternalAPIService) mapPlatformToChainID(platform string) int {
	platformMap := map[string]int{
		"ethereum":             1,
		"binance-smart-chain":  56,
		"polygon-pos":          137,
		"base":                 8453,
		"arbitrum-one":         42161,
		"optimistic-ethereum":  10,
	}
	return platformMap[platform]
}

func (s *ExternalAPIService) mapDexScreenerChainToID(chain string) int {
	chainMap := map[string]int{
		"ethereum": 1,
		"bsc":      56,
		"polygon":  137,
		"base":     8453,
		"arbitrum": 42161,
		"optimism": 10,
	}
	return chainMap[chain]
}

func (s *ExternalAPIService) isStablecoin(symbol string) bool {
	stablecoins := map[string]bool{
		"USDT": true, "USDC": true, "DAI": true, "BUSD": true,
		"FRAX": true, "LUSD": true, "SUSD": true, "TUSD": true,
	}
	return stablecoins[strings.ToUpper(symbol)]
}

func (s *ExternalAPIService) deduplicateTokens(tokens []*models.Token) []*models.Token {
	seen := make(map[string]*models.Token)
	var result []*models.Token
	
	for _, token := range tokens {
		key := fmt.Sprintf("%d:%s", token.ChainID, strings.ToLower(token.Address))
		
		if existing, exists := seen[key]; exists {
			// Prefer tokens with better source priority
			if s.getSourcePriority(token.Source) > s.getSourcePriority(existing.Source) {
				seen[key] = token
			}
		} else {
			seen[key] = token
		}
	}
	
	// Convert map to slice
	for _, token := range seen {
		result = append(result, token)
	}
	
	// Sort by priority: Popular > Verified > Source priority
	// This would be implemented with proper sorting logic
	
	return result
}

func (s *ExternalAPIService) getSourcePriority(source string) int {
	priorities := map[string]int{
		"geckoterminal": 4,
		"onchain":       3,
		"dexscreener":   2,
		"binance":       1,
	}
	if priority, exists := priorities[source]; exists {
		return priority
	}
	return 0
}

// getTokenInfoFromContract fetches token info from smart contract
func (s *ExternalAPIService) getTokenInfoFromContract(ctx context.Context, address string, chainID int) (*TokenInfo, error) {
	// Get RPC URL from chain config
	chains := config.GetActiveChains(s.cfg.Environment)
	chain, exists := chains[chainID]
	if !exists {
		return nil, fmt.Errorf("chain %d not supported", chainID)
	}
	
	rpcURL := chain.RpcURL
	// Connect to RPC endpoint
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}
	defer client.Close()

	tokenAddress := common.HexToAddress(address)
	
	// ERC20 function signatures
	nameSignature := "0x06fdde03"   // name()
	symbolSignature := "0x95d89b41" // symbol() 
	decimalsSignature := "0x313ce567" // decimals()
	
	tokenInfo := &TokenInfo{}
	
	// Get symbol
	if symbol, err := s.callStringMethod(ctx, client, tokenAddress, symbolSignature); err == nil {
		tokenInfo.Symbol = symbol
	} else {
		s.logger.Debugf("Failed to get symbol for %s: %v", address, err)
		return nil, fmt.Errorf("failed to get symbol: %w", err)
	}
	
	// Get name
	if name, err := s.callStringMethod(ctx, client, tokenAddress, nameSignature); err == nil {
		tokenInfo.Name = name
	} else {
		s.logger.Debugf("Failed to get name for %s: %v", address, err) 
		return nil, fmt.Errorf("failed to get name: %w", err)
	}
	
	// Get decimals
	if decimals, err := s.callDecimalsMethod(ctx, client, tokenAddress, decimalsSignature); err == nil {
		tokenInfo.Decimals = int(decimals)
	} else {
		s.logger.Debugf("Failed to get decimals for %s: %v", address, err)
		// Default to 18 if decimals call fails (some tokens don't implement it)
		tokenInfo.Decimals = 18
	}
	
	return tokenInfo, nil
}

// callStringMethod calls a contract method that returns a string
func (s *ExternalAPIService) callStringMethod(ctx context.Context, client *ethclient.Client, address common.Address, methodSig string) (string, error) {
	data := common.FromHex(methodSig)
	
	msg := ethereum.CallMsg{
		To:   &address,
		Data: data,
	}
	
	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return "", err
	}
	
	if len(result) < 64 {
		return "", fmt.Errorf("invalid response length")
	}
	
	// Parse ABI encoded string response
	stringType, _ := abi.NewType("string", "", nil)
	args := abi.Arguments{{Type: stringType}}
	
	decoded, err := args.Unpack(result)
	if err != nil {
		return "", fmt.Errorf("failed to decode string: %w", err)
	}
	
	if len(decoded) == 0 {
		return "", fmt.Errorf("no data decoded")
	}
	
	if str, ok := decoded[0].(string); ok {
		return str, nil
	}
	
	return "", fmt.Errorf("decoded value is not a string")
}

// callDecimalsMethod calls decimals() method that returns uint8
func (s *ExternalAPIService) callDecimalsMethod(ctx context.Context, client *ethclient.Client, address common.Address, methodSig string) (uint8, error) {
	data := common.FromHex(methodSig)
	
	msg := ethereum.CallMsg{
		To:   &address,
		Data: data,
	}
	
	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return 0, err
	}
	
	if len(result) < 32 {
		return 0, fmt.Errorf("invalid response length")
	}
	
	// decimals() returns uint8, but it's padded to 32 bytes
	decimals := new(big.Int).SetBytes(result).Uint64()
	
	// Validate reasonable decimals (0-77, but usually 0-18)
	if decimals > 77 {
		return 18, fmt.Errorf("unreasonable decimals value: %d", decimals)
	}
	
	return uint8(decimals), nil
}

// detectTokenChains detects which chains have this token contract
func (s *ExternalAPIService) detectTokenChains(ctx context.Context, address string, chains map[int]*config.ChainConfig) []int {
	var validChains []int
	
	// Use channels for parallel chain detection
	type chainResult struct {
		chainID int
		isValid bool
	}
	
	results := make(chan chainResult, len(chains))
	
	// Check each chain in parallel
	for chainID, chain := range chains {
		go func(cID int, c *config.ChainConfig) {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Debugf("Chain detection panic for chain %d: %v", cID, r)
					results <- chainResult{chainID: cID, isValid: false}
				}
			}()
			
			// Quick name() call to check if contract exists
			isValid := s.quickTokenCheck(ctx, address, chainID)
			results <- chainResult{chainID: cID, isValid: isValid}
		}(chainID, chain)
	}
	
	// Collect results
	for i := 0; i < len(chains); i++ {
		select {
		case result := <-results:
			if result.isValid {
				validChains = append(validChains, result.chainID)
			}
		case <-ctx.Done():
			s.logger.Warn("Chain detection cancelled due to context timeout")
			break
		}
	}
	
	return validChains
}

// quickTokenCheck quickly checks if token exists on chain by calling name()
func (s *ExternalAPIService) quickTokenCheck(ctx context.Context, address string, chainID int) bool {
	// Get RPC URL from chain config
	chains := config.GetActiveChains(s.cfg.Environment)
	chain, exists := chains[chainID]
	if !exists {
		return false
	}
	
	rpcURL := chain.RpcURL
	if rpcURL == "" {
		return false
	}
	
	// Short timeout for quick check
	quickCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	
	client, err := ethclient.DialContext(quickCtx, rpcURL)
	if err != nil {
		return false
	}
	defer client.Close()
	
	tokenAddress := common.HexToAddress(address)
	nameSignature := "0x06fdde03" // name()
	
	// Try to call name() - if it succeeds, token exists
	_, err = s.callStringMethod(quickCtx, client, tokenAddress, nameSignature)
	return err == nil
}

// getTokenWithMarketData gets token info from onchain + market data from external APIs
func (s *ExternalAPIService) getTokenWithMarketData(ctx context.Context, address string, chainID int) *models.Token {
	// First get onchain data
	baseToken := s.verifyTokenOnchain(ctx, address, chainID)
	if baseToken == nil {
		s.logger.Debugf("Failed to verify token %s onchain for chain %d", address, chainID)
		return nil
	}
	
	s.logger.Debugf("Got onchain data for %s: %s (%s) - %d decimals", address, baseToken.Symbol, baseToken.Name, baseToken.Decimals)
	
	// Then enhance with market data from external APIs
	s.enhanceTokenWithMarketData(ctx, baseToken)
	
	return baseToken
}

// enhanceTokenWithMarketData adds price/market data from external APIs
func (s *ExternalAPIService) enhanceTokenWithMarketData(ctx context.Context, token *models.Token) {
	if token == nil {
		return
	}
	
	s.logger.Debugf("Attempting to enhance %s (%s) with market data...", token.Symbol, token.Address)
	
	// Strategy: DexScreener first (best for DEX tokens), fallback to GeckoTerminal
	
	// 1. Try DexScreener for this specific token address
	if s.enhanceFromDexScreener(ctx, token) {
		s.logger.Infof("✅ Enhanced %s with DexScreener data - Price: $%s", token.Symbol, token.PriceUSD.String())
		return
	}
	
	s.logger.Debugf("DexScreener failed for %s, trying GeckoTerminal...", token.Symbol)
	
	// 2. Fallback to GeckoTerminal
	if s.enhanceFromGeckoTerminal(ctx, token) {
		s.logger.Infof("✅ Enhanced %s with GeckoTerminal data - Price: $%s", token.Symbol, token.PriceUSD.String())
		return
	}
	
	s.logger.Warnf("❌ No market data found for %s (%s) on chain %d", token.Symbol, token.Address, token.ChainID)
	token.Source = "onchain_only"
}

// enhanceFromDexScreener enhances token with DexScreener data
func (s *ExternalAPIService) enhanceFromDexScreener(ctx context.Context, token *models.Token) bool {
	// DexScreener token search API - searches across all chains automatically
	url := fmt.Sprintf("https://api.dexscreener.com/latest/dex/tokens/%s", token.Address)
	
	s.logger.Debugf("Calling DexScreener API: %s", url)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Debugf("Failed to create DexScreener request: %v", err)
		return false
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Debugf("DexScreener API error for %s: %v", token.Address, err)
		return false
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Debugf("DexScreener API returned status %d for %s", resp.StatusCode, token.Address)
		return false
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Debugf("Failed to read DexScreener response: %v", err)
		return false
	}
	
	s.logger.Debugf("DexScreener raw response: %s", string(body)[:200]) // Log first 200 chars
	
	var result struct {
		Pairs []struct {
			ChainID   string `json:"chainId"`
			DexID     string `json:"dexId"`
			URL       string `json:"url"`
			PairAddress string `json:"pairAddress"`
			BaseToken struct {
				Address  string `json:"address"`
				Name     string `json:"name"`
				Symbol   string `json:"symbol"`
				Decimals int    `json:"decimals"`
			} `json:"baseToken"`
			QuoteToken struct {
				Address string `json:"address"`
				Symbol  string `json:"symbol"`
			} `json:"quoteToken"`
			PriceUsd string `json:"priceUsd"`
			Volume   struct {
				H24 string `json:"h24"`
				H6  string `json:"h6"`
				H1  string `json:"h1"`
			} `json:"volume"`
			Liquidity struct {
				USD   string `json:"usd"`
				Base  string `json:"base"`
				Quote string `json:"quote"`
			} `json:"liquidity"`
			FDV         string `json:"fdv"`
			MarketCap   string `json:"marketCap"`
			PriceChange struct {
				M5  string `json:"m5"`
				H1  string `json:"h1"`
				H6  string `json:"h6"`
				H24 string `json:"h24"`
			} `json:"priceChange"`
			CreatedAt int64 `json:"createdAt"`
		} `json:"pairs"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Debugf("Failed to parse DexScreener response: %v", err)
		return false
	}
	
	if len(result.Pairs) == 0 {
		s.logger.Debugf("No pairs found for token %s on DexScreener", token.Address)
		return false
	}
	
	s.logger.Debugf("Found %d pairs for token %s on DexScreener", len(result.Pairs), token.Address)
	
	// Find the best pair for this token (highest liquidity USD)
	var bestPair *struct {
		ChainID   string `json:"chainId"`
		DexID     string `json:"dexId"`
		URL       string `json:"url"`
		PairAddress string `json:"pairAddress"`
		BaseToken struct {
			Address  string `json:"address"`
			Name     string `json:"name"`
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"baseToken"`
		QuoteToken struct {
			Address string `json:"address"`
			Symbol  string `json:"symbol"`
		} `json:"quoteToken"`
		PriceUsd string `json:"priceUsd"`
		Volume   struct {
			H24 string `json:"h24"`
			H6  string `json:"h6"`
			H1  string `json:"h1"`
		} `json:"volume"`
		Liquidity struct {
			USD   string `json:"usd"`
			Base  string `json:"base"`
			Quote string `json:"quote"`
		} `json:"liquidity"`
		FDV         string `json:"fdv"`
		MarketCap   string `json:"marketCap"`
		PriceChange struct {
			M5  string `json:"m5"`
			H1  string `json:"h1"`
			H6  string `json:"h6"`
			H24 string `json:"h24"`
		} `json:"priceChange"`
		CreatedAt int64 `json:"createdAt"`
	}
	
	maxLiquidity := decimal.Zero
	
	for i := range result.Pairs {
		pair := &result.Pairs[i]
		
		// Check if this pair's base token matches our target token
		if strings.EqualFold(pair.BaseToken.Address, token.Address) {
			if pair.Liquidity.USD != "" {
				if liquidity, err := decimal.NewFromString(pair.Liquidity.USD); err == nil {
					if bestPair == nil || liquidity.GreaterThan(maxLiquidity) {
						bestPair = pair
						maxLiquidity = liquidity
					}
				}
			} else if bestPair == nil {
				bestPair = pair
			}
		}
	}
	
	if bestPair == nil {
		s.logger.Debugf("No matching pairs found for token %s address", token.Address)
		return false
	}
	
	s.logger.Debugf("Selected best pair: %s/%s on %s with liquidity $%s", 
		bestPair.BaseToken.Symbol, bestPair.QuoteToken.Symbol, bestPair.DexID, bestPair.Liquidity.USD)
	
	// Update token with market data
	s.parseAndSetMarketData(token, bestPair.PriceUsd, bestPair.Volume.H24, bestPair.MarketCap, bestPair.PriceChange.H24)
	token.Source = "dexscreener_enhanced"
	
	return true
}

// enhanceFromGeckoTerminal enhances token with GeckoTerminal data
func (s *ExternalAPIService) enhanceFromGeckoTerminal(ctx context.Context, token *models.Token) bool {
	// GeckoTerminal network mapping
	networkSlug := s.getNetworkSlugForGeckoTerminal(token.ChainID)
	if networkSlug == "" {
		s.logger.Debugf("No network slug found for chain %d", token.ChainID)
		return false
	}
	
	// GeckoTerminal token info API - exact endpoint from JS code
	url := fmt.Sprintf("https://api.geckoterminal.com/api/v2/networks/%s/tokens/%s", networkSlug, strings.ToLower(token.Address))
	
	s.logger.Debugf("Calling GeckoTerminal API: %s", url)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Debugf("Failed to create GeckoTerminal request: %v", err)
		return false
	}
	
	req.Header.Set("Accept", "application/json")
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Debugf("GeckoTerminal API error for %s: %v", token.Address, err)
		return false
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Debugf("GeckoTerminal API returned status %d for %s", resp.StatusCode, token.Address)
		return false
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Debugf("Failed to read GeckoTerminal response: %v", err)
		return false
	}
	
	s.logger.Debugf("GeckoTerminal raw response: %s", string(body)[:200]) // Log first 200 chars
	
	var result struct {
		Data struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Name              string `json:"name"`
				Symbol            string `json:"symbol"`
				Address           string `json:"address"`
				LogoURI           string `json:"logo_uri"`
				PriceUsd          string `json:"price_usd"`
				PriceNative       string `json:"price_native"`
				MarketCapUsd      string `json:"market_cap_usd"`
				FdvUsd            string `json:"fdv_usd"`
				TotalSupply       string `json:"total_supply"`
				VolumeUsd24h      string `json:"volume_usd_24h"`
				ReserveInUsd      string `json:"reserve_in_usd"`
				PriceChange24h    string `json:"price_change_24h"`
			} `json:"attributes"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Debugf("Failed to parse GeckoTerminal response: %v", err)
		return false
	}
	
	if result.Data.Attributes.Name == "" {
		s.logger.Debugf("No token data found in GeckoTerminal response")
		return false
	}
	
	// Update token with market data
	attrs := result.Data.Attributes
	s.logger.Debugf("GeckoTerminal data for %s: price=$%s, volume=$%s", token.Symbol, attrs.PriceUsd, attrs.VolumeUsd24h)
	
	s.parseAndSetMarketData(token, attrs.PriceUsd, attrs.VolumeUsd24h, attrs.MarketCapUsd, attrs.PriceChange24h)
	
	// Also update logo if available
	if attrs.LogoURI != "" && token.LogoURI == "" {
		token.LogoURI = attrs.LogoURI
	}
	
	token.Source = "geckoterminal_enhanced"
	
	return true
}

// getChainSlugForDexScreener maps chain ID to DexScreener chain slug
func (s *ExternalAPIService) getChainSlugForDexScreener(chainID int) string {
	slugMap := map[int]string{
		1:     "ethereum",
		56:    "bsc", 
		8453:  "base",
		137:   "polygon",
		42161: "arbitrum",
		10:    "optimism",
		84532: "", // Base Sepolia not supported
		97:    "", // BSC Testnet not supported
	}
	return slugMap[chainID]
}

// getNetworkSlugForGeckoTerminal maps chain ID to GeckoTerminal network slug
func (s *ExternalAPIService) getNetworkSlugForGeckoTerminal(chainID int) string {
	networkMap := map[int]string{
		1:     "eth",
		56:    "bsc",
		8453:  "base", 
		137:   "polygon_pos",
		42161: "arbitrum",
		10:    "optimism",
		84532: "base_sepolia",
		97:    "bsc_testnet",
	}
	return networkMap[chainID]
}

// parseAndSetMarketData parses string values and sets them on the token
func (s *ExternalAPIService) parseAndSetMarketData(token *models.Token, priceUsd, volume24h, marketCap, priceChange24h string) {
	if token == nil {
		return
	}
	
	s.logger.Debugf("🔍 Parsing market data for %s - Price: '%s', Volume: '%s', MCap: '%s', Change: '%s'", 
		token.Symbol, priceUsd, volume24h, marketCap, priceChange24h)
	
	// Parse price
	if priceUsd != "" && priceUsd != "0" && priceUsd != "null" {
		if price, err := decimal.NewFromString(priceUsd); err == nil && price.IsPositive() {
			token.PriceUSD = price
			s.logger.Infof("💰 Set price for %s: $%s", token.Symbol, price.String())
		} else {
			s.logger.Debugf("❌ Failed to parse price '%s' for %s: %v", priceUsd, token.Symbol, err)
		}
	}
	
	// Parse volume
	if volume24h != "" && volume24h != "0" && volume24h != "null" {
		if volume, err := decimal.NewFromString(volume24h); err == nil && volume.IsPositive() {
			token.Volume24h = volume
			s.logger.Debugf("📊 Set volume for %s: $%s", token.Symbol, volume.String())
		} else {
			s.logger.Debugf("❌ Failed to parse volume '%s' for %s: %v", volume24h, token.Symbol, err)
		}
	}
	
	// Parse market cap
	if marketCap != "" && marketCap != "0" && marketCap != "null" {
		if mcap, err := decimal.NewFromString(marketCap); err == nil && mcap.IsPositive() {
			token.MarketCap = mcap
			s.logger.Debugf("🏦 Set market cap for %s: $%s", token.Symbol, mcap.String())
		} else {
			s.logger.Debugf("❌ Failed to parse market cap '%s' for %s: %v", marketCap, token.Symbol, err)
		}
	}
	
	// Parse 24h change (can be negative)
	if priceChange24h != "" && priceChange24h != "null" {
		if change, err := decimal.NewFromString(priceChange24h); err == nil {
			token.Change24h = change
			s.logger.Debugf("📈 Set price change for %s: %s%%", token.Symbol, change.String())
		} else {
			s.logger.Debugf("❌ Failed to parse price change '%s' for %s: %v", priceChange24h, token.Symbol, err)
		}
	}
	
	// Set last updated timestamp
	token.LastUpdated = time.Now()
}

// getPopularTokensForAddress checks if address matches any popular token
func (s *ExternalAPIService) getPopularTokensForAddress(address string) []*models.Token {
	var tokens []*models.Token
	normalizedAddress := strings.ToLower(address)
	
	// Check across all supported chains
	chains := config.GetActiveChains(s.cfg.Environment)
	for chainID := range chains {
		if metadata := config.GetPopularTokenMetadata(normalizedAddress, chainID); metadata != nil {
			token := s.createTokenFromMetadata(normalizedAddress, chainID, metadata)
			tokens = append(tokens, token)
		}
	}
	
	return tokens
}

// createTokenFromMetadata creates a Token from PopularTokenMetadata
func (s *ExternalAPIService) createTokenFromMetadata(address string, chainID int, metadata *config.PopularTokenMetadata) *models.Token {
	return &models.Token{
		Address:     address,
		Symbol:      metadata.Symbol,
		Name:        metadata.Name,
		Decimals:    metadata.Decimals,
		ChainID:     chainID,
		LogoURI:     metadata.LogoURI,
		IsNative:    metadata.IsNative,
		Tags:        metadata.Tags,
		Source:      "popular_prebuilt",
		Verified:    true,
		Popular:     true,
		LastUpdated: time.Now(),
	}
}

// enhancePopularTokenWithBinancePrice adds live price from Binance API
func (s *ExternalAPIService) enhancePopularTokenWithBinancePrice(ctx context.Context, token *models.Token) {
	if token == nil {
		return
	}
	
	// Get metadata to find Binance symbol
	metadata := config.GetPopularTokenMetadata(token.Address, token.ChainID)
	if metadata == nil || metadata.BinanceSymbol == "" {
		s.logger.Debugf("No Binance symbol for token %s", token.Symbol)
		return
	}
	
	// Get live price from Binance
	price := s.getBinancePrice(ctx, metadata.BinanceSymbol)
	if price.IsPositive() {
		token.PriceUSD = price
		token.Source = "popular_binance_enhanced"
		token.LastUpdated = time.Now()
		s.logger.Debugf("Enhanced popular token %s with Binance price: $%s", token.Symbol, price.String())
	}
}

// getBinancePrice gets current price from Binance ticker API
func (s *ExternalAPIService) getBinancePrice(ctx context.Context, symbol string) decimal.Decimal {
	// Binance 24hr ticker price API (no rate limit, public)
	url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/price?symbol=%sUSDT", symbol)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		s.logger.Debugf("Failed to create Binance request for %s: %v", symbol, err)
		return decimal.Zero
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Debugf("Binance API error for %s: %v", symbol, err)
		return decimal.Zero
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		s.logger.Debugf("Binance API returned status %d for %s", resp.StatusCode, symbol)
		return decimal.Zero
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Debugf("Failed to read Binance response for %s: %v", symbol, err)
		return decimal.Zero
	}
	
	var result struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"`
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Debugf("Failed to parse Binance response for %s: %v", symbol, err)
		return decimal.Zero
	}
	
	if price, err := decimal.NewFromString(result.Price); err == nil {
		return price
	}
	
	return decimal.Zero
}