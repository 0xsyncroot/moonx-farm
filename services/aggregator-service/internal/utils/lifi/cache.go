package lifi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
)

// CacheUtils provides caching utilities for LiFi service
type CacheUtils struct{}

// NewCacheUtils creates a new cache utils instance
func NewCacheUtils() *CacheUtils {
	return &CacheUtils{}
}

// GenerateIntelligentCacheKey creates an enhanced cache key including user context
func (c *CacheUtils) GenerateIntelligentCacheKey(req *models.QuoteRequest, fromToken, toToken string) string {
	// Hash user address to maintain privacy while ensuring uniqueness
	userHash := "none"
	if req.UserAddress != "" {
		userHash = c.hashUserAddress(req.UserAddress)
	}
	
	return fmt.Sprintf("lifi:v3:%d:%s:%s:%s:%.3f:%s:ts%d", 
		req.ChainID, 
		strings.ToLower(fromToken), 
		strings.ToLower(toToken), 
		req.Amount.String(),
		req.SlippageTolerance.InexactFloat64(),
		userHash,
		time.Now().Unix()/180) // 3-minute buckets for balance between cache efficiency and freshness
}

// ValidateCachedQuote validates if a cached quote is still reliable
func (c *CacheUtils) ValidateCachedQuote(quote *models.Quote) bool {
	if quote == nil {
		return false
	}

	// Check if quote has expired (LiFi quotes valid for ~30 seconds)
	if time.Since(quote.CreatedAt) > 25*time.Second {
		return false
	}

	// Check if amounts are reasonable
	if quote.ToAmount.IsZero() || quote.FromAmount.IsZero() {
		return false
	}

	// Check if price is reasonable (not extreme)
	if quote.Price.IsZero() || quote.Price.LessThan(decimal.NewFromFloat(0.000001)) {
		return false
	}

	return true
}

// CalculateCacheTTL calculates cache TTL based on validation score
func (c *CacheUtils) CalculateCacheTTL(validationScore float64) time.Duration {
	baseTTL := 30 * time.Second
	
	// Higher validation score = longer cache time
	if validationScore >= 0.9 {
		return baseTTL * 2 // 60 seconds
	} else if validationScore >= 0.8 {
		return baseTTL // 30 seconds
	} else {
		return baseTTL / 2 // 15 seconds
	}
}

// CacheTokensByAddress caches individual tokens by address for fast lookup
func (c *CacheUtils) CacheTokensByAddress(ctx context.Context, cacheService CacheServiceInterface, tokens []*models.Token, chainID int) {
	for _, token := range tokens {
		// Cache by address
		addressKey := fmt.Sprintf("lifi:token:addr:%d:%s", chainID, strings.ToLower(token.Address))
		if err := cacheService.Set(ctx, addressKey, token, 10*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"address": token.Address,
				"symbol":  token.Symbol,
			}).Debug("Token cached by address")
		}
		
		// Cache by symbol for quick symbol lookup
		symbolKey := fmt.Sprintf("lifi:token:symbol:%d:%s", chainID, strings.ToLower(token.Symbol))
		if err := cacheService.Set(ctx, symbolKey, token, 5*time.Minute); err == nil {
			logrus.WithFields(logrus.Fields{
				"symbol":  token.Symbol,
				"address": token.Address,
			}).Debug("Token cached by symbol")
		}
	}
}

// hashUserAddress creates a short hash of user address for cache key privacy
func (c *CacheUtils) hashUserAddress(address string) string {
	if address == "" {
		return "none"
	}
	
	// Normalize address to lowercase
	normalizedAddr := strings.ToLower(strings.TrimSpace(address))
	
	// Create hash
	hash := sha256.Sum256([]byte(normalizedAddr))
	
	// Return first 8 characters of hex for cache efficiency
	return hex.EncodeToString(hash[:])[:8]
}

// CacheServiceInterface defines the interface for cache operations
type CacheServiceInterface interface {
	Get(ctx context.Context, key string, dest interface{}) error
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
} 