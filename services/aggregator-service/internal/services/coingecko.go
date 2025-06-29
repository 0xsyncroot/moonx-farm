package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

type CoinGeckoService struct {
	httpClient   *http.Client
	cacheService *CacheService
	baseURL      string
}

type CoinGeckoSearchResponse struct {
	Coins []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		APISymbol string `json:"api_symbol"`
		Symbol    string `json:"symbol"`
		MarketCap int    `json:"market_cap_rank"`
		Thumb     string `json:"thumb"`
		Large     string `json:"large"`
	} `json:"coins"`
}

type CoinGeckoTokenDetail struct {
	ID     string `json:"id"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Image  struct {
		Thumb string `json:"thumb"`
		Small string `json:"small"`
		Large string `json:"large"`
	} `json:"image"`
	MarketData struct {
		CurrentPrice struct {
			USD float64 `json:"usd"`
		} `json:"current_price"`
		PriceChange24h           float64 `json:"price_change_24h"`
		PriceChangePercentage24h float64 `json:"price_change_percentage_24h"`
		MarketCap                struct {
			USD float64 `json:"usd"`
		} `json:"market_cap"`
		TotalVolume struct {
			USD float64 `json:"usd"`
		} `json:"total_volume"`
	} `json:"market_data"`
	Platforms map[string]string `json:"platforms"`
}

func NewCoinGeckoService(cacheService *CacheService) *CoinGeckoService {
	return &CoinGeckoService{
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		cacheService: cacheService,
		baseURL:      "https://api.coingecko.com/api/v3",
	}
}

// SearchTokensBySymbol searches tokens by symbol using CoinGecko search API
func (s *CoinGeckoService) SearchTokensBySymbol(ctx context.Context, symbol string) ([]*models.Token, error) {
	// Check cache first
	cacheKey := fmt.Sprintf("coingecko:search:%s", symbol)
	var cached []*models.Token
	if err := s.cacheService.Get(ctx, cacheKey, &cached); err == nil && len(cached) > 0 {
		return cached, nil
	}

	// Search on CoinGecko
	searchURL := fmt.Sprintf("%s/search?query=%s", s.baseURL, symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search tokens: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko search failed with status: %d", resp.StatusCode)
	}

	var searchResp CoinGeckoSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	var tokens []*models.Token

	// Process search results and get detailed info
	for _, coin := range searchResp.Coins {
		if len(tokens) >= 10 { // Limit results
			break
		}

		// Get detailed token info
		tokenDetail, err := s.getTokenDetail(ctx, coin.ID)
		if err != nil {
			logrus.WithError(err).WithField("coinId", coin.ID).Warn("Failed to get token detail")
			continue
		}

		// Convert to our token model
		token := s.convertToToken(tokenDetail)
		if token != nil {
			tokens = append(tokens, token)
		}
	}

	// Cache results for 5 minutes
	s.cacheService.Set(ctx, cacheKey, tokens, 5*time.Minute)

	return tokens, nil
}

// getTokenDetail gets detailed token information by CoinGecko ID
func (s *CoinGeckoService) getTokenDetail(ctx context.Context, coinID string) (*CoinGeckoTokenDetail, error) {
	detailURL := fmt.Sprintf("%s/coins/%s", s.baseURL, coinID)

	req, err := http.NewRequestWithContext(ctx, "GET", detailURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create detail request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get token detail: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko detail failed with status: %d", resp.StatusCode)
	}

	var detail CoinGeckoTokenDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return nil, fmt.Errorf("failed to decode detail response: %w", err)
	}

	return &detail, nil
}

// convertToToken converts CoinGecko data to our token model
func (s *CoinGeckoService) convertToToken(detail *CoinGeckoTokenDetail) *models.Token {
	// Map platform names to chain IDs
	chainMapping := map[string]int{
		"ethereum":            1,
		"binance-smart-chain": 56,
		"polygon-pos":         137,
		"avalanche":           43114,
		"arbitrum-one":        42161,
		"optimistic-ethereum": 10,
		"base":                8453,
	}

	// Create tokens for each supported platform
	var tokens []*models.Token

	for platform, address := range detail.Platforms {
		chainID, exists := chainMapping[platform]
		if !exists || address == "" {
			continue
		}

		token := &models.Token{
			Address:   address,
			Symbol:    detail.Symbol,
			Name:      detail.Name,
			ChainID:   chainID,
			Decimals:  18, // Default, should be fetched onchain if needed
			LogoURI:   detail.Image.Large,
			Source:    "coingecko",
			Verified:  true,
			PriceUSD:  decimal.NewFromFloat(detail.MarketData.CurrentPrice.USD),
			Change24h: decimal.NewFromFloat(detail.MarketData.PriceChangePercentage24h),
			Volume24h: decimal.NewFromFloat(detail.MarketData.TotalVolume.USD),
			MarketCap: decimal.NewFromFloat(detail.MarketData.MarketCap.USD),
			Popular:   detail.MarketData.MarketCap.USD > 1000000, // 1M+ market cap
			Metadata: map[string]interface{}{
				"coinGeckoId": detail.ID,
				"platform":    platform,
			},
		}

		tokens = append(tokens, token)
	}

	// Return the first token (usually Ethereum mainnet)
	if len(tokens) > 0 {
		return tokens[0]
	}

	return nil
}
