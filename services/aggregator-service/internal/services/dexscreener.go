package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
)

// DexScreenerService handles DexScreener API integration for price data
type DexScreenerService struct {
	apiConfig    *config.APIConfig
	httpClient   *http.Client
	baseURL      string
	cacheService *CacheService
}

// NewDexScreenerService creates a new DexScreener service
func NewDexScreenerService(apiConfig *config.APIConfig, cacheService *CacheService) *DexScreenerService {
	return &DexScreenerService{
		apiConfig:    apiConfig,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		baseURL:      "https://api.dexscreener.com/latest",
		cacheService: cacheService,
	}
}

// DexScreener API response structures
type DexScreenerTokenResponse struct {
	Pair struct {
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
		PriceNative string `json:"priceNative"`
		PriceUSD    string `json:"priceUsd"`
		Volume      struct {
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
		MarketCap float64 `json:"marketCap"`
	} `json:"pair"`
}

type DexScreenerPairsResponse struct {
	Pairs []struct {
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
		PriceNative string `json:"priceNative"`
		PriceUSD    string `json:"priceUsd"`
		Volume      struct {
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
		MarketCap float64 `json:"marketCap"`
	} `json:"pairs"`
}

// GetTokenPrice gets token price from DexScreener
func (d *DexScreenerService) GetTokenPrice(ctx context.Context, tokenAddress string, chainID int) (*models.PriceResponse, error) {
	// Check cache first
	if cachedPrice, err := d.cacheService.GetTokenPrice(ctx, tokenAddress, chainID); err == nil && cachedPrice != nil {
		logrus.WithFields(logrus.Fields{
			"token":   tokenAddress,
			"chainID": chainID,
		}).Debug("DexScreener token price found in cache")
		return cachedPrice, nil
	}

	// Map chainID to DexScreener chain name
	chainName := d.mapChainIDToChainName(chainID)
	if chainName == "" {
		return nil, fmt.Errorf("unsupported chain ID: %d", chainID)
	}

	requestURL := fmt.Sprintf("%s/dex/tokens/%s", d.baseURL, tokenAddress)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Add API key if available
	if d.apiConfig.DexScreenerAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+d.apiConfig.DexScreenerAPIKey)
	}

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("DexScreener API error (status %d): %s", resp.StatusCode, string(body))
	}

	var dexResp DexScreenerPairsResponse
	if err := json.NewDecoder(resp.Body).Decode(&dexResp); err != nil {
		return nil, fmt.Errorf("failed to decode DexScreener response: %w", err)
	}

	// Find the best pair (highest liquidity on the target chain)
	var bestPair *struct {
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
		PriceNative string `json:"priceNative"`
		PriceUSD    string `json:"priceUsd"`
		Volume      struct {
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
		MarketCap float64 `json:"marketCap"`
	}

	for _, pair := range dexResp.Pairs {
		if pair.ChainID == chainName && (pair.BaseToken.Address == tokenAddress || pair.QuoteToken.Address == tokenAddress) {
			if bestPair == nil || pair.Liquidity.USD > bestPair.Liquidity.USD {
				bestPair = &pair
			}
		}
	}

	if bestPair == nil {
		return nil, fmt.Errorf("no price data found for token %s on chain %d", tokenAddress, chainID)
	}

	// Parse price
	priceUSD, err := decimal.NewFromString(bestPair.PriceUSD)
	if err != nil {
		return nil, fmt.Errorf("invalid price USD: %w", err)
	}

	// Create token info
	var token *models.Token
	if bestPair.BaseToken.Address == tokenAddress {
		token = &models.Token{
			Address:   bestPair.BaseToken.Address,
			Symbol:    bestPair.BaseToken.Symbol,
			Name:      bestPair.BaseToken.Name,
			ChainID:   chainID,
			PriceUSD:  priceUSD,
			Volume24h: decimal.NewFromFloat(bestPair.Volume.H24),
			Change24h: decimal.NewFromFloat(bestPair.PriceChange.H24),
			MarketCap: decimal.NewFromFloat(bestPair.MarketCap),
		}
	} else {
		token = &models.Token{
			Address:   bestPair.QuoteToken.Address,
			Symbol:    bestPair.QuoteToken.Symbol,
			Name:      bestPair.QuoteToken.Name,
			ChainID:   chainID,
			PriceUSD:  priceUSD,
			Volume24h: decimal.NewFromFloat(bestPair.Volume.H24),
			Change24h: decimal.NewFromFloat(bestPair.PriceChange.H24),
			MarketCap: decimal.NewFromFloat(bestPair.MarketCap),
		}
	}

	priceResp := &models.PriceResponse{
		Token:     token,
		Price:     priceUSD,
		Currency:  models.CurrencyUSD,
		Source:    models.ProviderDexScreener,
		UpdatedAt: time.Now(),
	}

	// Cache the price
	if err := d.cacheService.SetTokenPrice(ctx, tokenAddress, chainID, priceResp); err != nil {
		logrus.WithError(err).Warn("Failed to cache DexScreener token price")
	}

	logrus.WithFields(logrus.Fields{
		"token":     tokenAddress,
		"chainID":   chainID,
		"price":     priceUSD,
		"liquidity": bestPair.Liquidity.USD,
		"provider":  models.ProviderDexScreener,
	}).Info("DexScreener token price retrieved successfully")

	return priceResp, nil
}

// mapChainIDToChainName maps numeric chain ID to DexScreener chain name
func (d *DexScreenerService) mapChainIDToChainName(chainID int) string {
	switch chainID {
	case 1:
		return "ethereum"
	case 56:
		return "bsc"
	case 137:
		return "polygon"
	case 8453:
		return "base"
	case 42161:
		return "arbitrum"
	case 10:
		return "optimism"
	case 43114:
		return "avalanche"
	case 250:
		return "fantom"
	default:
		return ""
	}
} 