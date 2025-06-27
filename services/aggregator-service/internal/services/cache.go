package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/storage"
)

// CacheService handles caching operations
type CacheService struct {
	redis  *storage.RedisClient
	config *config.CacheConfig
}

// NewCacheService creates a new cache service
func NewCacheService(redis *storage.RedisClient, config *config.CacheConfig) *CacheService {
	return &CacheService{
		redis:  redis,
		config: config,
	}
}

// Quote caching methods

// GetQuote retrieves a cached quote
func (c *CacheService) GetQuote(ctx context.Context, key string) (*models.Quote, error) {
	data, err := c.redis.Get(ctx, c.quoteKey(key))
	if err != nil {
		if err == storage.ErrKeyNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get quote from cache: %w", err)
	}

	var quote models.Quote
	if err := json.Unmarshal([]byte(data), &quote); err != nil {
		return nil, fmt.Errorf("failed to unmarshal quote: %w", err)
	}

	return &quote, nil
}

// SetQuote stores a quote in cache
func (c *CacheService) SetQuote(ctx context.Context, key string, quote *models.Quote) error {
	data, err := json.Marshal(quote)
	if err != nil {
		return fmt.Errorf("failed to marshal quote: %w", err)
	}

	if err := c.redis.Set(ctx, c.quoteKey(key), data, c.config.QuoteTTL); err != nil {
		return fmt.Errorf("failed to set quote in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"key": key,
		"ttl": c.config.QuoteTTL,
	}).Debug("Quote cached successfully")

	return nil
}

// SetQuoteWithTTL stores a quote in cache with custom TTL
func (c *CacheService) SetQuoteWithTTL(ctx context.Context, key string, quote *models.Quote, ttl time.Duration) error {
	data, err := json.Marshal(quote)
	if err != nil {
		return fmt.Errorf("failed to marshal quote: %w", err)
	}

	if err := c.redis.Set(ctx, c.quoteKey(key), data, ttl); err != nil {
		return fmt.Errorf("failed to set quote in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"key": key,
		"ttl": ttl,
	}).Debug("Quote cached successfully with custom TTL")

	return nil
}

// Price caching methods

// GetTokenPrice retrieves a cached token price
func (c *CacheService) GetTokenPrice(ctx context.Context, token string, chainID int) (*models.PriceResponse, error) {
	key := c.priceKey(token, chainID)
	data, err := c.redis.Get(ctx, key)
	if err != nil {
		if err == storage.ErrKeyNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get price from cache: %w", err)
	}

	var price models.PriceResponse
	if err := json.Unmarshal([]byte(data), &price); err != nil {
		return nil, fmt.Errorf("failed to unmarshal price: %w", err)
	}

	return &price, nil
}

// SetTokenPrice stores a token price in cache
func (c *CacheService) SetTokenPrice(ctx context.Context, token string, chainID int, price *models.PriceResponse) error {
	data, err := json.Marshal(price)
	if err != nil {
		return fmt.Errorf("failed to marshal price: %w", err)
	}

	key := c.priceKey(token, chainID)
	if err := c.redis.Set(ctx, key, data, c.config.PriceTTL); err != nil {
		return fmt.Errorf("failed to set price in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"token":   token,
		"chainID": chainID,
		"ttl":     c.config.PriceTTL,
	}).Debug("Price cached successfully")

	return nil
}

// GetMultipleTokenPrices retrieves multiple cached token prices
func (c *CacheService) GetMultipleTokenPrices(ctx context.Context, tokens []string, chainID int) (map[string]*models.PriceResponse, error) {
	prices := make(map[string]*models.PriceResponse)

	for _, token := range tokens {
		price, err := c.GetTokenPrice(ctx, token, chainID)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"token":   token,
				"chainID": chainID,
				"error":   err,
			}).Warn("Failed to get price from cache")
			continue
		}
		if price != nil {
			prices[token] = price
		}
	}

	return prices, nil
}

// Route caching methods

// GetRoute retrieves a cached route
func (c *CacheService) GetRoute(ctx context.Context, key string) (*models.Route, error) {
	data, err := c.redis.Get(ctx, c.routeKey(key))
	if err != nil {
		if err == storage.ErrKeyNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get route from cache: %w", err)
	}

	var route models.Route
	if err := json.Unmarshal([]byte(data), &route); err != nil {
		return nil, fmt.Errorf("failed to unmarshal route: %w", err)
	}

	return &route, nil
}

// SetRoute stores a route in cache
func (c *CacheService) SetRoute(ctx context.Context, key string, route *models.Route) error {
	data, err := json.Marshal(route)
	if err != nil {
		return fmt.Errorf("failed to marshal route: %w", err)
	}

	if err := c.redis.Set(ctx, c.routeKey(key), data, c.config.RouteTTL); err != nil {
		return fmt.Errorf("failed to set route in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"key": key,
		"ttl": c.config.RouteTTL,
	}).Debug("Route cached successfully")

	return nil
}

// Token list caching methods

// GetTokenList retrieves a cached token list
func (c *CacheService) GetTokenList(ctx context.Context, chainID int) (*models.TokenListResponse, error) {
	key := c.tokenListKey(chainID)
	data, err := c.redis.Get(ctx, key)
	if err != nil {
		if err == storage.ErrKeyNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get token list from cache: %w", err)
	}

	var tokenList models.TokenListResponse
	if err := json.Unmarshal([]byte(data), &tokenList); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token list: %w", err)
	}

	return &tokenList, nil
}

// SetTokenList stores a token list in cache
func (c *CacheService) SetTokenList(ctx context.Context, chainID int, tokenList *models.TokenListResponse) error {
	data, err := json.Marshal(tokenList)
	if err != nil {
		return fmt.Errorf("failed to marshal token list: %w", err)
	}

	key := c.tokenListKey(chainID)
	// Token lists have longer TTL (30 minutes)
	ttl := 30 * time.Minute
	
	if err := c.redis.Set(ctx, key, data, ttl); err != nil {
		return fmt.Errorf("failed to set token list in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"chainID": chainID,
		"count":   len(tokenList.Tokens),
		"ttl":     ttl,
	}).Debug("Token list cached successfully")

	return nil
}

// SetTokenListWithTTL stores a token list in cache with custom TTL
func (c *CacheService) SetTokenListWithTTL(ctx context.Context, chainID int, tokenList *models.TokenListResponse, ttl time.Duration) error {
	data, err := json.Marshal(tokenList)
	if err != nil {
		return fmt.Errorf("failed to marshal token list: %w", err)
	}

	key := c.tokenListKey(chainID)
	
	if err := c.redis.Set(ctx, key, data, ttl); err != nil {
		return fmt.Errorf("failed to set token list in cache: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"chainID": chainID,
		"count":   len(tokenList.Tokens),
		"ttl":     ttl,
	}).Debug("Token list cached successfully with custom TTL")

	return nil
}

// Generic caching methods

// Set stores any data in cache with custom TTL
func (c *CacheService) Set(ctx context.Context, key string, data interface{}, ttl time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	return c.redis.Set(ctx, key, jsonData, ttl)
}

// Get retrieves any data from cache
func (c *CacheService) Get(ctx context.Context, key string, dest interface{}) error {
	data, err := c.redis.Get(ctx, key)
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(data), dest)
}

// Delete removes data from cache
func (c *CacheService) Delete(ctx context.Context, keys ...string) error {
	return c.redis.Del(ctx, keys...)
}

// Exists checks if key exists in cache
func (c *CacheService) Exists(ctx context.Context, key string) (bool, error) {
	return c.redis.Exists(ctx, key)
}

// Increment increments a counter in cache
func (c *CacheService) Increment(ctx context.Context, key string) (int64, error) {
	return c.redis.Incr(ctx, key)
}

// SetWithLock sets data with distributed locking to prevent race conditions
func (c *CacheService) SetWithLock(ctx context.Context, lockKey, dataKey string, data interface{}, ttl time.Duration) error {
	// Try to acquire lock
	acquired, err := c.redis.SetNX(ctx, c.lockKey(lockKey), "locked", 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to acquire lock: %w", err)
	}

	if !acquired {
		return fmt.Errorf("failed to acquire lock: already locked")
	}

	// Ensure lock is released
	defer func() {
		if err := c.redis.Del(ctx, c.lockKey(lockKey)); err != nil {
			logrus.WithError(err).Error("Failed to release lock")
		}
	}()

	// Set the data
	return c.Set(ctx, dataKey, data, ttl)
}

// Key generation methods

func (c *CacheService) quoteKey(key string) string {
	return fmt.Sprintf("quote:%s", key)
}

func (c *CacheService) priceKey(token string, chainID int) string {
	return fmt.Sprintf("price:%d:%s", chainID, token)
}

func (c *CacheService) routeKey(key string) string {
	return fmt.Sprintf("route:%s", key)
}

func (c *CacheService) tokenListKey(chainID int) string {
	return fmt.Sprintf("tokens:%d", chainID)
}

func (c *CacheService) lockKey(key string) string {
	return fmt.Sprintf("lock:%s", key)
}

// Cache key generation helpers

// GenerateQuoteKey generates a cache key for quotes
func GenerateQuoteKey(fromToken, toToken string, amount string, chainID int, slippage string) string {
	return fmt.Sprintf("%s-%s-%s-%d-%s", fromToken, toToken, amount, chainID, slippage)
}

// GenerateRouteKey generates a cache key for routes
func GenerateRouteKey(fromToken, toToken string, amount string, chainID int) string {
	return fmt.Sprintf("%s-%s-%s-%d", fromToken, toToken, amount, chainID)
}

// Cleanup methods

// CleanupExpiredKeys removes expired keys (called periodically)
func (c *CacheService) CleanupExpiredKeys(ctx context.Context) error {
	// Get all quote keys
	quoteKeys, err := c.redis.Keys(ctx, "quote:*")
	if err != nil {
		return fmt.Errorf("failed to get quote keys: %w", err)
	}

	// Check TTL and remove expired keys
	var expiredKeys []string
	for _, key := range quoteKeys {
		ttl, err := c.redis.TTL(ctx, key)
		if err != nil {
			continue
		}
		if ttl < 0 {
			expiredKeys = append(expiredKeys, key)
		}
	}

	if len(expiredKeys) > 0 {
		if err := c.redis.Del(ctx, expiredKeys...); err != nil {
			return fmt.Errorf("failed to delete expired keys: %w", err)
		}
		logrus.WithField("count", len(expiredKeys)).Info("Cleaned up expired cache keys")
	}

	return nil
} 