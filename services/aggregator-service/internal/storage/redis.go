package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
)

// RedisClient wraps the Redis client with additional functionality
type RedisClient struct {
	client *redis.Client
	prefix string
}

// NewRedisClient creates a new Redis client
func NewRedisClient(cfg *config.RedisConfig) (*RedisClient, error) {
	options := &redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  cfg.ConnectTimeout,
		ReadTimeout:  cfg.CommandTimeout,
		WriteTimeout: cfg.CommandTimeout,
		MaxRetries:   cfg.MaxRetriesPerRequest,
	}

	client := redis.NewClient(options)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"host": cfg.Host,
		"port": cfg.Port,
		"db":   cfg.DB,
	}).Info("Connected to Redis successfully")

	return &RedisClient{
		client: client,
		prefix: cfg.KeyPrefix,
	}, nil
}

// Get retrieves a value from Redis
func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	fullKey := r.prefix + key
	result := r.client.Get(ctx, fullKey)
	if result.Err() == redis.Nil {
		return "", ErrKeyNotFound
	}
	return result.Result()
}

// Set stores a value in Redis with TTL
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	fullKey := r.prefix + key
	return r.client.Set(ctx, fullKey, value, ttl).Err()
}

// SetNX sets a key only if it doesn't exist
func (r *RedisClient) SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error) {
	fullKey := r.prefix + key
	return r.client.SetNX(ctx, fullKey, value, ttl).Result()
}

// Del deletes one or more keys
func (r *RedisClient) Del(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}

	fullKeys := make([]string, len(keys))
	for i, key := range keys {
		fullKeys[i] = r.prefix + key
	}

	return r.client.Del(ctx, fullKeys...).Err()
}

// Exists checks if a key exists
func (r *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	fullKey := r.prefix + key
	result, err := r.client.Exists(ctx, fullKey).Result()
	return result > 0, err
}

// Expire sets TTL for a key
func (r *RedisClient) Expire(ctx context.Context, key string, ttl time.Duration) error {
	fullKey := r.prefix + key
	return r.client.Expire(ctx, fullKey, ttl).Err()
}

// TTL returns the TTL of a key
func (r *RedisClient) TTL(ctx context.Context, key string) (time.Duration, error) {
	fullKey := r.prefix + key
	return r.client.TTL(ctx, fullKey).Result()
}

// Keys returns all keys matching pattern
func (r *RedisClient) Keys(ctx context.Context, pattern string) ([]string, error) {
	fullPattern := r.prefix + pattern
	keys, err := r.client.Keys(ctx, fullPattern).Result()
	if err != nil {
		return nil, err
	}

	// Remove prefix from returned keys
	for i, key := range keys {
		keys[i] = key[len(r.prefix):]
	}
	return keys, nil
}

// HGet gets a field from a hash
func (r *RedisClient) HGet(ctx context.Context, key, field string) (string, error) {
	fullKey := r.prefix + key
	result := r.client.HGet(ctx, fullKey, field)
	if result.Err() == redis.Nil {
		return "", ErrKeyNotFound
	}
	return result.Result()
}

// HSet sets a field in a hash
func (r *RedisClient) HSet(ctx context.Context, key string, values ...interface{}) error {
	fullKey := r.prefix + key
	return r.client.HSet(ctx, fullKey, values...).Err()
}

// HGetAll gets all fields from a hash
func (r *RedisClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	fullKey := r.prefix + key
	return r.client.HGetAll(ctx, fullKey).Result()
}

// HDel deletes fields from a hash
func (r *RedisClient) HDel(ctx context.Context, key string, fields ...string) error {
	if len(fields) == 0 {
		return nil
	}
	fullKey := r.prefix + key
	return r.client.HDel(ctx, fullKey, fields...).Err()
}

// ZAdd adds members to a sorted set
func (r *RedisClient) ZAdd(ctx context.Context, key string, members ...*redis.Z) error {
	fullKey := r.prefix + key
	return r.client.ZAdd(ctx, fullKey, members...).Err()
}

// ZRange returns a range of members from a sorted set
func (r *RedisClient) ZRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	fullKey := r.prefix + key
	return r.client.ZRange(ctx, fullKey, start, stop).Result()
}

// ZRangeWithScores returns a range of members with scores from a sorted set
func (r *RedisClient) ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]redis.Z, error) {
	fullKey := r.prefix + key
	return r.client.ZRangeWithScores(ctx, fullKey, start, stop).Result()
}

// ZRem removes members from a sorted set
func (r *RedisClient) ZRem(ctx context.Context, key string, members ...interface{}) error {
	fullKey := r.prefix + key
	return r.client.ZRem(ctx, fullKey, members...).Err()
}

// Incr increments the integer value of a key by one
func (r *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	fullKey := r.prefix + key
	return r.client.Incr(ctx, fullKey).Result()
}

// IncrBy increments the integer value of a key by the given amount
func (r *RedisClient) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	fullKey := r.prefix + key
	return r.client.IncrBy(ctx, fullKey, value).Result()
}

// Pipeline creates a pipeline for batch operations
func (r *RedisClient) Pipeline() redis.Pipeliner {
	return r.client.Pipeline()
}

// Ping checks if Redis is alive
func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// GetClient returns the underlying Redis client
func (r *RedisClient) GetClient() *redis.Client {
	return r.client
}

// Custom errors
var (
	ErrKeyNotFound = fmt.Errorf("key not found")
) 