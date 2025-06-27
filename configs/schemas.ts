import { z } from 'zod';

/**
 * Centralized Configuration Schemas for MoonX Farm DEX
 * This file contains all Zod schemas for environment validation
 */

// =============================================================================
// BASE SCHEMAS
// =============================================================================

/**
 * Base configuration schema that all services extend
 */
export const BaseConfigSchema = z.object({
  // General settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  APP_NAME: z.string().default('moonx-farm'),
  APP_VERSION: z.string().default('1.0.0'),
});

/**
 * Database configuration schema
 */
export const DatabaseConfigSchema = z.object({
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('moonx_farm'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres123'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().default(10000),
});

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('moonx:'),
  REDIS_ENABLE_READY_CHECK: z.coerce.boolean().default(true),
  REDIS_LAZY_CONNECT: z.coerce.boolean().default(false),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().default(3),
  REDIS_CONNECT_TIMEOUT: z.coerce.number().default(10000),
  REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),
});

/**
 * Kafka configuration schema
 */
export const KafkaConfigSchema = z.object({
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('moonx-farm'),
  KAFKA_SSL: z.coerce.boolean().default(false),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_SASL_MECHANISM: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']).default('plain'),
  KAFKA_CONNECTION_TIMEOUT: z.coerce.number().default(3000),
  KAFKA_REQUEST_TIMEOUT: z.coerce.number().default(30000),
  KAFKA_RETRY_INITIAL_TIME: z.coerce.number().default(100),
  KAFKA_RETRY_COUNT: z.coerce.number().default(3),
});

/**
 * JWT configuration schema
 */
export const JwtConfigSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('moonx-farm'),
  JWT_AUDIENCE: z.string().default('moonx-farm-users'),
});

/**
 * Privy authentication configuration schema
 */
export const PrivyConfigSchema = z.object({
  PRIVY_APP_ID: z.string().min(1, 'Privy App ID is required'),
  PRIVY_APP_SECRET: z.string().min(1, 'Privy App Secret is required'),
  PRIVY_VERIFICATION_KEY: z.string().optional(),
});

/**
 * Services configuration schema
 */
export const ServicesConfigSchema = z.object({
  // API Gateway
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  API_GATEWAY_HOST: z.string().default('localhost'),
  API_GATEWAY_CORS_ORIGIN: z.string().default('*'),
  API_GATEWAY_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  API_GATEWAY_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // Auth Service
  AUTH_SERVICE_PORT: z.coerce.number().default(3001),
  AUTH_SERVICE_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Wallet Registry
  WALLET_REGISTRY_PORT: z.coerce.number().default(3002),
  WALLET_REGISTRY_HOST: z.string().default('localhost'),
  
  // Aggregator Service
  AGGREGATOR_SERVICE_PORT: z.coerce.number().default(3003),
  AGGREGATOR_SERVICE_HOST: z.string().default('localhost'),
  
  // Swap Orchestrator
  SWAP_ORCHESTRATOR_PORT: z.coerce.number().default(3004),
  SWAP_ORCHESTRATOR_HOST: z.string().default('localhost'),
  
  // Position Indexer
  POSITION_INDEXER_PORT: z.coerce.number().default(3005),
  POSITION_INDEXER_HOST: z.string().default('localhost'),
  
  // Notify Service
  NOTIFY_SERVICE_PORT: z.coerce.number().default(3006),
  NOTIFY_SERVICE_HOST: z.string().default('localhost'),
});

/**
 * Blockchain networks configuration schema
 */
export const BlockchainConfigSchema = z.object({
  // Base Mainnet
  BASE_MAINNET_RPC: z.string().url().optional(),
  BASE_MAINNET_FALLBACK_RPCS: z.string().default('https://mainnet.base.org,https://base.blockpi.network/v1/rpc/public,https://1rpc.io/base,https://base.meowrpc.com'),
  BASE_MAINNET_CHAIN_ID: z.coerce.number().default(8453),
  BASE_MAINNET_EXPLORER: z.string().default('https://basescan.org'),
  
  // Base Testnet
  BASE_TESTNET_RPC: z.string().url().optional(),
  BASE_TESTNET_FALLBACK_RPCS: z.string().default('https://sepolia.base.org,https://base-sepolia.blockpi.network/v1/rpc/public,https://base-sepolia.publicnode.com'),
  BASE_TESTNET_CHAIN_ID: z.coerce.number().default(84532),
  BASE_TESTNET_EXPLORER: z.string().default('https://sepolia.basescan.org'),
  
  // BSC Mainnet
  BSC_MAINNET_RPC: z.string().url().optional(),
  BSC_MAINNET_FALLBACK_RPCS: z.string().default('https://bsc-dataseed1.binance.org,https://bsc-dataseed2.binance.org,https://bsc-dataseed3.binance.org,https://bsc-dataseed4.binance.org,https://bsc.nodereal.io'),
  BSC_MAINNET_CHAIN_ID: z.coerce.number().default(56),
  BSC_MAINNET_EXPLORER: z.string().default('https://bscscan.com'),
  
  // BSC Testnet
  BSC_TESTNET_RPC: z.string().url().optional(),
  BSC_TESTNET_FALLBACK_RPCS: z.string().default('https://data-seed-prebsc-1-s1.binance.org:8545,https://data-seed-prebsc-2-s1.binance.org:8545,https://data-seed-prebsc-1-s2.binance.org:8545,https://data-seed-prebsc-2-s2.binance.org:8545'),
  BSC_TESTNET_CHAIN_ID: z.coerce.number().default(97),
  BSC_TESTNET_EXPLORER: z.string().default('https://testnet.bscscan.com'),
  
  // Default Network
  DEFAULT_CHAIN_ID: z.coerce.number().default(8453),
});

/**
 * External APIs configuration schema
 */
export const ExternalApisConfigSchema = z.object({
  // Price Data Providers
  COINGECKO_API_KEY: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),
  DEXSCREENER_API_KEY: z.string().optional(),
  
  // DEX Aggregators
  ONE_INCH_API_KEY: z.string().optional(),
  PARASWAP_API_KEY: z.string().optional(),
  
  // Blockchain Infrastructure
  ALCHEMY_API_KEY: z.string().optional(),
  INFURA_API_KEY: z.string().optional(),
  QUICKNODE_API_KEY: z.string().optional(),
});

/**
 * Trading configuration schema
 */
export const TradingConfigSchema = z.object({
  // Default Trading Parameters
  DEFAULT_SLIPPAGE_TOLERANCE: z.coerce.number().default(0.5),
  DEFAULT_DEADLINE_MINUTES: z.coerce.number().default(20),
  MAX_SLIPPAGE_TOLERANCE: z.coerce.number().default(5.0),
  MIN_SLIPPAGE_TOLERANCE: z.coerce.number().default(0.1),
  
  // Gas Configuration
  GAS_PRICE_MULTIPLIER: z.coerce.number().default(1.1),
  MAX_GAS_PRICE_GWEI: z.coerce.number().default(100),
  PRIORITY_FEE_MULTIPLIER: z.coerce.number().default(1.2),
  
  // Order Limits
  MAX_ORDER_SIZE_USD: z.coerce.number().default(100000),
  MIN_ORDER_SIZE_USD: z.coerce.number().default(1),
  MAX_ORDERS_PER_USER: z.coerce.number().default(100),
});

/**
 * Frontend configuration schema
 */
export const FrontendConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3006'),
  NEXT_PUBLIC_APP_NAME: z.string().default('MoonX Farm DEX'),
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: z.coerce.number().default(8453),
});

/**
 * Cache configuration schema
 */
export const CacheConfigSchema = z.object({
  CACHE_TTL_DEFAULT: z.coerce.number().default(300), // 5 minutes
  CACHE_TTL_USER_PROFILE: z.coerce.number().default(300),
  CACHE_TTL_TOKEN_PRICE: z.coerce.number().default(60),
  CACHE_TTL_AGGREGATOR: z.coerce.number().default(30),
  CACHE_TTL_PORTFOLIO: z.coerce.number().default(120),
  CACHE_MAX_KEYS: z.coerce.number().default(10000),
});

/**
 * Logger configuration schema
 */
export const LoggerConfigSchema = z.object({
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_ENABLE_CONSOLE: z.coerce.boolean().default(true),
  LOG_ENABLE_FILE: z.coerce.boolean().default(false),
  LOG_DIR: z.string().default('logs'),
  LOG_MAX_FILES: z.coerce.number().default(5),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_FORMAT: z.enum(['json', 'console']).default('console'),
}); 