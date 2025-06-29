package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

type MarketDataService struct {
	httpClient   *http.Client
	cacheService *CacheService
	baseURL      string
}

type MarketDataResponse struct {
	SchemaVersion string           `json:"schemaVersion"`
	Pairs         []MarketDataPair `json:"pairs"`
}

type MarketDataPair struct {
	ChainID     string `json:"chainId"`
	DexID       string `json:"dexId"`
	URL         string `json:"url"`
	PairAddress string `json:"pairAddress"`
	BaseToken   struct {
		Address string `json:"address"`
		Name    string `json:"name"`
		Symbol  string `json:"symbol"`
	} `json:"baseToken"`
	QuoteToken struct {
		Address string `json:"address"`
		Name    string `json:"name"`
		Symbol  string `json:"symbol"`
	} `json:"quoteToken"`
	Info *struct {
		ImageURL  string `json:"imageUrl"`
		Header    string `json:"header"`
		OpenGraph string `json:"openGraph"`
		Websites  []struct {
			Label string `json:"label"`
			URL   string `json:"url"`
		} `json:"websites"`
		Socials []struct {
			Type string `json:"type"`
			URL  string `json:"url"`
		} `json:"socials"`
	} `json:"info,omitempty"`
	PriceNative string `json:"priceNative"`
	PriceUSD    string `json:"priceUsd"`
	Txns        struct {
		M5 struct {
			Buys  int `json:"buys"`
			Sells int `json:"sells"`
		} `json:"m5"`
		H1 struct {
			Buys  int `json:"buys"`
			Sells int `json:"sells"`
		} `json:"h1"`
		H6 struct {
			Buys  int `json:"buys"`
			Sells int `json:"sells"`
		} `json:"h6"`
		H24 struct {
			Buys  int `json:"buys"`
			Sells int `json:"sells"`
		} `json:"h24"`
	} `json:"txns"`
	Volume struct {
		H24 float64 `json:"h24"`
		H6  float64 `json:"h6"`
		H1  float64 `json:"h1"`
		M5  float64 `json:"m5"`
	} `json:"volume"`
	PriceChange struct {
		M5  float64 `json:"m5"`
		H1  float64 `json:"h1"`
		H6  float64 `json:"h6"`
		H24 float64 `json:"h24"`
	} `json:"priceChange"`
	Liquidity struct {
		USD   float64 `json:"usd"`
		Base  float64 `json:"base"`
		Quote float64 `json:"quote"`
	} `json:"liquidity"`
	FDV       float64 `json:"fdv"`
	MarketCap float64 `json:"marketCap"`
}

// Chain ID mapping from DexScreener to numeric
var marketDataChainMapping = map[string]int{
	"ethereum":  1,
	"bsc":       56,
	"polygon":   137,
	"avalanche": 43114,
	"arbitrum":  42161,
	"optimism":  10,
	"base":      8453,
}

func NewMarketDataService(cacheService *CacheService) *MarketDataService {
	return &MarketDataService{
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		cacheService: cacheService,
		baseURL:      "https://api.dexscreener.com/latest",
	}
}

// EnhanceTokenWithMarketData enhances token with market data from DexScreener
func (s *MarketDataService) EnhanceTokenWithMarketData(ctx context.Context, token *models.Token) (*models.Token, error) {
	if token == nil {
		return nil, fmt.Errorf("token is nil")
	}

	// Check cache first
	cacheKey := fmt.Sprintf("dexscreener:token:%d:%s", token.ChainID, token.Address)
	var cached *models.Token
	if err := s.cacheService.Get(ctx, cacheKey, &cached); err == nil && cached != nil {
		// Merge cached data with original token
		return s.mergeTokenData(token, cached), nil
	}

	// Get token data from DexScreener
	pairs, err := s.getTokenPairs(ctx, token.Address)
	if err != nil {
		logrus.WithError(err).WithField("address", token.Address).Debug("Failed to get DexScreener data")
		return token, nil // Return original token if enhancement fails
	}

	// Find the best pair for this token and chain
	bestPair := s.findBestPair(pairs, token.ChainID, token.Address)
	if bestPair == nil {
		logrus.WithField("address", token.Address).Debug("No suitable pair found on DexScreener")
		return token, nil
	}

	// Enhance token with market data
	enhancedToken := s.enhanceTokenFromPair(token, bestPair)

	// Cache enhanced token for 5 minutes
	s.cacheService.Set(ctx, cacheKey, enhancedToken, 5*time.Minute)

	return enhancedToken, nil
}

// getTokenPairs gets token pairs from DexScreener
func (s *MarketDataService) getTokenPairs(ctx context.Context, tokenAddress string) ([]MarketDataPair, error) {
	url := fmt.Sprintf("%s/dex/tokens/%s", s.baseURL, tokenAddress)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dexscreener API returned status: %d", resp.StatusCode)
	}

	var response MarketDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return response.Pairs, nil
}

// findBestPair finds the best trading pair for the token
func (s *MarketDataService) findBestPair(pairs []MarketDataPair, chainID int, tokenAddress string) *MarketDataPair {
	var bestPair *MarketDataPair
	bestLiquidity := 0.0

	tokenAddress = strings.ToLower(tokenAddress)

	for _, pair := range pairs {
		// Convert DexScreener chain ID to numeric
		pairChainID, exists := marketDataChainMapping[pair.ChainID]
		if !exists || pairChainID != chainID {
			continue
		}

		// Check if this pair involves our token
		isBaseToken := strings.ToLower(pair.BaseToken.Address) == tokenAddress
		isQuoteToken := strings.ToLower(pair.QuoteToken.Address) == tokenAddress

		if !isBaseToken && !isQuoteToken {
			continue
		}

		// Prefer pairs with higher liquidity
		if pair.Liquidity.USD > bestLiquidity {
			bestLiquidity = pair.Liquidity.USD
			bestPair = &pair
		}
	}

	return bestPair
}

// enhanceTokenFromPair enhances token with data from trading pair
func (s *MarketDataService) enhanceTokenFromPair(token *models.Token, pair *MarketDataPair) *models.Token {
	enhanced := *token // Copy original token

	// Extract logoURI from DexScreener info
	if pair.Info != nil && pair.Info.ImageURL != "" {
		enhanced.LogoURI = pair.Info.ImageURL
	}

	// Update price data
	if pair.PriceUSD != "" {
		if priceUSD, err := decimal.NewFromString(pair.PriceUSD); err == nil {
			enhanced.PriceUSD = priceUSD
		}
	}

	// Update 24h change
	enhanced.Change24h = decimal.NewFromFloat(pair.PriceChange.H24)

	// Update volume
	enhanced.Volume24h = decimal.NewFromFloat(pair.Volume.H24)

	// Update market cap
	if pair.MarketCap > 0 {
		enhanced.MarketCap = decimal.NewFromFloat(pair.MarketCap)
	}

	// Update metadata
	if enhanced.Metadata == nil {
		enhanced.Metadata = make(map[string]interface{})
	}

	enhanced.Metadata["dexScreener"] = map[string]interface{}{
		"pairAddress": pair.PairAddress,
		"dexId":       pair.DexID,
		"liquidity":   pair.Liquidity.USD,
		"fdv":         pair.FDV,
		"txns24h":     pair.Txns.H24.Buys + pair.Txns.H24.Sells,
		"lastUpdated": time.Now().Unix(),
	}

	// Mark as enhanced
	enhanced.Source = "onchain+dexscreener"
	enhanced.Popular = pair.Liquidity.USD > 100000 // $100k+ liquidity

	return &enhanced
}

// mergeTokenData merges cached data with original token
func (s *MarketDataService) mergeTokenData(original, cached *models.Token) *models.Token {
	// Start with original token
	merged := *original

	// Update with cached market data if available and recent
	if cached.Metadata != nil {
		if dsData, ok := cached.Metadata["dexScreener"].(map[string]interface{}); ok {
			if lastUpdated, ok := dsData["lastUpdated"].(float64); ok {
				// Only use cached data if it's less than 5 minutes old
				if time.Since(time.Unix(int64(lastUpdated), 0)) < 5*time.Minute {
					merged.PriceUSD = cached.PriceUSD
					merged.Change24h = cached.Change24h
					merged.Volume24h = cached.Volume24h
					merged.MarketCap = cached.MarketCap
					merged.Popular = cached.Popular

					// IMPORTANT: Also merge logoURI from cached DexScreener data
					if cached.LogoURI != "" && merged.LogoURI == "" {
						merged.LogoURI = cached.LogoURI
					}

					if merged.Metadata == nil {
						merged.Metadata = make(map[string]interface{})
					}
					merged.Metadata["dexScreener"] = dsData
				}
			}
		}
	}

	return &merged
}
