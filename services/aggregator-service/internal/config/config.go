package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type RateLimitConfig struct {
	RequestsPerMinute int
	BurstSize         int
}

// Config holds all configuration for the aggregator service
type Config struct {
	Environment  string            `json:"environment"`
	LogLevel     string            `json:"log_level"`
	Port         int               `json:"port"`
	Host         string            `json:"host"`
	Redis        *RedisConfig      `json:"redis"`
	ExternalAPIs *APIConfig        `json:"external_apis"`
	Blockchain   *BlockchainConfig `json:"blockchain"`
	Cache        *CacheConfig      `json:"cache"`
	RateLimit    *RateLimitConfig  `json:"rate_limit"`
}

// RedisConfig holds Redis connection configuration
type RedisConfig struct {
	Host                 string        `json:"host"`
	Port                 int           `json:"port"`
	Password             string        `json:"password"`
	DB                   int           `json:"db"`
	KeyPrefix            string        `json:"key_prefix"`
	EnableReadyCheck     bool          `json:"enable_ready_check"`
	LazyConnect          bool          `json:"lazy_connect"`
	MaxRetriesPerRequest int           `json:"max_retries_per_request"`
	ConnectTimeout       time.Duration `json:"connect_timeout"`
	CommandTimeout       time.Duration `json:"command_timeout"`
}

// APIConfig holds external API configuration
type APIConfig struct {
	CoingeckoAPIKey     string `json:"coingecko_api_key"`
	CoinMarketCapAPIKey string `json:"coinmarketcap_api_key"`
	DexScreenerAPIKey   string `json:"dexscreener_api_key"`
	OneInchAPIKey       string `json:"oneinch_api_key"`
	ParaswapAPIKey      string `json:"paraswap_api_key"`
	LiFiAPIKey          string `json:"lifi_api_key"`
	AlchemyAPIKey       string `json:"alchemy_api_key"`
	InfuraAPIKey        string `json:"infura_api_key"`
	QuicknodeAPIKey     string `json:"quicknode_api_key"`
}

// BlockchainConfig holds legacy blockchain RPC configuration (deprecated)
type BlockchainConfig struct {
	BaseMainnetRPC     string `json:"base_mainnet_rpc"`
	BaseMainnetChainID int    `json:"base_mainnet_chain_id"`
	BaseTestnetRPC     string `json:"base_testnet_rpc"`
	BaseTestnetChainID int    `json:"base_testnet_chain_id"`
	BSCMainnetRPC      string `json:"bsc_mainnet_rpc"`
	BSCMainnetChainID  int    `json:"bsc_mainnet_chain_id"`
	BSCTestnetRPC      string `json:"bsc_testnet_rpc"`
	BSCTestnetChainID  int    `json:"bsc_testnet_chain_id"`
	DefaultChainID     int    `json:"default_chain_id"`
}

// CacheConfig holds caching configuration
type CacheConfig struct {
	QuoteTTL time.Duration `json:"quote_ttl"`
	PriceTTL time.Duration `json:"price_ttl"`
	RouteTTL time.Duration `json:"route_ttl"`
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		Environment: getEnvString("NODE_ENV", "development"),
		LogLevel:    getEnvString("LOG_LEVEL", "info"),
		Port:        getEnvInt("QUOTE_SERVICE_PORT", 3003),
		Host:        getEnvString("QUOTE_SERVICE_HOST", "localhost"),
	}

	// Load Redis configuration
	redis, err := loadRedisConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load Redis config: %w", err)
	}
	cfg.Redis = redis

	// Load External APIs configuration
	apis, err := loadAPIConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load API config: %w", err)
	}
	cfg.ExternalAPIs = apis

	// Load Blockchain configuration
	blockchain, err := loadChainConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load blockchain config: %w", err)
	}
	cfg.Blockchain = blockchain

	// Load Cache configuration
	cache, err := loadCacheConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load cache config: %w", err)
	}
	cfg.Cache = cache

	// Load Rate Limit configuration
	rateLimit, err := loadRateLimitConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load rate limit config: %w", err)
	}
	cfg.RateLimit = rateLimit

	return cfg, nil
}

func loadRedisConfig() (*RedisConfig, error) {
	return &RedisConfig{
		Host:                 getEnvString("REDIS_HOST", "localhost"),
		Port:                 getEnvInt("REDIS_PORT", 6379),
		Password:             getEnvString("REDIS_PASSWORD", ""),
		DB:                   getEnvInt("REDIS_DB", 0),
		KeyPrefix:            getEnvString("REDIS_KEY_PREFIX", "moonx:quote:"),
		EnableReadyCheck:     getEnvBool("REDIS_ENABLE_READY_CHECK", true),
		LazyConnect:          getEnvBool("REDIS_LAZY_CONNECT", false),
		MaxRetriesPerRequest: getEnvInt("REDIS_MAX_RETRIES_PER_REQUEST", 3),
		ConnectTimeout:       time.Duration(getEnvInt("REDIS_CONNECT_TIMEOUT", 10000)) * time.Millisecond,
		CommandTimeout:       time.Duration(getEnvInt("REDIS_COMMAND_TIMEOUT", 5000)) * time.Millisecond,
	}, nil
}

func loadAPIConfig() (*APIConfig, error) {
	return &APIConfig{
		CoingeckoAPIKey:     getEnvString("COINGECKO_API_KEY", ""),
		CoinMarketCapAPIKey: getEnvString("COINMARKETCAP_API_KEY", ""),
		DexScreenerAPIKey:   getEnvString("DEXSCREENER_API_KEY", ""),
		OneInchAPIKey:       getEnvString("ONE_INCH_API_KEY", ""),
		ParaswapAPIKey:      getEnvString("PARASWAP_API_KEY", ""),
		LiFiAPIKey:          getEnvString("LIFI_API_KEY", ""),
		AlchemyAPIKey:       getEnvString("ALCHEMY_API_KEY", ""),
		InfuraAPIKey:        getEnvString("INFURA_API_KEY", ""),
		QuicknodeAPIKey:     getEnvString("QUICKNODE_API_KEY", ""),
	}, nil
}

func loadChainConfig() (*BlockchainConfig, error) {
	return &BlockchainConfig{
		BaseMainnetRPC:     getEnvString("BASE_MAINNET_RPC", "https://mainnet.base.org"),
		BaseMainnetChainID: getEnvInt("BASE_MAINNET_CHAIN_ID", 8453),
		BaseTestnetRPC:     getEnvString("BASE_TESTNET_RPC", "https://sepolia.base.org"),
		BaseTestnetChainID: getEnvInt("BASE_TESTNET_CHAIN_ID", 84532),
		BSCMainnetRPC:      getEnvString("BSC_MAINNET_RPC", "https://bsc-dataseed1.binance.org"),
		BSCMainnetChainID:  getEnvInt("BSC_MAINNET_CHAIN_ID", 56),
		BSCTestnetRPC:      getEnvString("BSC_TESTNET_RPC", "https://data-seed-prebsc-1-s1.binance.org:8545"),
		BSCTestnetChainID:  getEnvInt("BSC_TESTNET_CHAIN_ID", 97),
		DefaultChainID:     getEnvInt("DEFAULT_CHAIN_ID", 8453),
	}, nil
}

func loadCacheConfig() (*CacheConfig, error) {
	return &CacheConfig{
		QuoteTTL: time.Duration(getEnvInt("QUOTE_CACHE_TTL_SECONDS", 10)) * time.Second,
		PriceTTL: time.Duration(getEnvInt("PRICE_CACHE_TTL_SECONDS", 30)) * time.Second,
		RouteTTL: time.Duration(getEnvInt("ROUTE_CACHE_TTL_SECONDS", 60)) * time.Second,
	}, nil
}

func loadRateLimitConfig() (*RateLimitConfig, error) {
	return &RateLimitConfig{
		RequestsPerMinute: getEnvInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 60),
		BurstSize:         getEnvInt("RATE_LIMIT_BURST_SIZE", 10),
	}, nil
}

// Helper functions for environment variable parsing
func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvSlice(key, defaultValue string) []string {
	value := getEnvString(key, defaultValue)
	if value == "" {
		return []string{}
	}
	return strings.Split(value, ",")
}

// IsProduction returns true if running in production environment
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// IsDevelopment returns true if running in development environment
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsTest returns true if running in test environment
func (c *Config) IsTest() bool {
	return c.Environment == "test"
}
