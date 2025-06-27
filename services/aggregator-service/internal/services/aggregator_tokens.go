package services

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

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
	return a.ExternalAPI.SearchTokensExternal(ctx, query)
} 