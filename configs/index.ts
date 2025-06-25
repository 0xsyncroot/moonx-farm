import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Base configuration schema - shared across all services
 */
const BaseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  APP_NAME: z.string().default('moonx-farm'),
});

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('moonx_farm'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres123'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().default(10000),
  DATABASE_URL: z.string().optional(),
});

/**
 * Redis configuration schema
 */
const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('moonx:'),
  REDIS_ENABLE_READY_CHECK: z.coerce.boolean().default(true),
  REDIS_LAZY_CONNECT: z.coerce.boolean().default(true),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().default(3),
  REDIS_CONNECT_TIMEOUT: z.coerce.number().default(10000),
  REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),
  REDIS_URL: z.string().optional(),
});

/**
 * Kafka configuration schema
 */
const KafkaConfigSchema = z.object({
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('moonx-farm'),
  KAFKA_SSL: z.coerce.boolean().default(false),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_SASL_MECHANISM: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']).default('plain'),
  KAFKA_CONNECTION_TIMEOUT: z.coerce.number().default(10000),
  KAFKA_REQUEST_TIMEOUT: z.coerce.number().default(30000),
  KAFKA_RETRY_INITIAL_TIME: z.coerce.number().default(100),
  KAFKA_RETRY_COUNT: z.coerce.number().default(8),
});

/**
 * JWT configuration schema
 */
const JwtConfigSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  JWT_ISSUER: z.string().default('moonx-farm'),
  JWT_AUDIENCE: z.string().default('moonx-users'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().default(86400000),
});

/**
 * Services configuration schema
 */
const ServicesConfigSchema = z.object({
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  API_GATEWAY_HOST: z.string().default('0.0.0.0'),
  AUTH_SERVICE_PORT: z.coerce.number().default(3001),
  AUTH_SERVICE_HOST: z.string().default('localhost'),
  WALLET_REGISTRY_PORT: z.coerce.number().default(3002),
  WALLET_REGISTRY_HOST: z.string().default('localhost'),
  QUOTE_SERVICE_PORT: z.coerce.number().default(3003),
  QUOTE_SERVICE_HOST: z.string().default('localhost'),
  SWAP_ORCHESTRATOR_PORT: z.coerce.number().default(3004),
  SWAP_ORCHESTRATOR_HOST: z.string().default('localhost'),
  POSITION_INDEXER_PORT: z.coerce.number().default(3005),
  POSITION_INDEXER_HOST: z.string().default('localhost'),
  NOTIFY_SERVICE_PORT: z.coerce.number().default(3006),
  NOTIFY_SERVICE_HOST: z.string().default('localhost'),
});

/**
 * Blockchain configuration schema
 */
const BlockchainConfigSchema = z.object({
  BASE_MAINNET_RPC: z.string().url().default('https://mainnet.base.org'),
  BASE_MAINNET_CHAIN_ID: z.coerce.number().default(8453),
  BASE_MAINNET_EXPLORER: z.string().url().default('https://basescan.org'),
  BASE_TESTNET_RPC: z.string().url().default('https://goerli.base.org'),
  BASE_TESTNET_CHAIN_ID: z.coerce.number().default(84531),
  BASE_TESTNET_EXPLORER: z.string().url().default('https://goerli.basescan.org'),
  BSC_MAINNET_RPC: z.string().url().default('https://bsc-dataseed.binance.org/'),
  BSC_MAINNET_CHAIN_ID: z.coerce.number().default(56),
  BSC_MAINNET_EXPLORER: z.string().url().default('https://bscscan.com'),
  BSC_TESTNET_RPC: z.string().url().default('https://data-seed-prebsc-1-s1.binance.org:8545/'),
  BSC_TESTNET_CHAIN_ID: z.coerce.number().default(97),
  BSC_TESTNET_EXPLORER: z.string().url().default('https://testnet.bscscan.com'),
  DEFAULT_CHAIN_ID: z.coerce.number().default(8453),
  DEFAULT_RPC_URL: z.string().url().default('https://mainnet.base.org'),
});

/**
 * External APIs configuration schema
 */
const ExternalApisConfigSchema = z.object({
  COINGECKO_API_KEY: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),
  DEXSCREENER_API_KEY: z.string().optional(),
  ONE_INCH_API_KEY: z.string().optional(),
  PARASWAP_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  INFURA_API_KEY: z.string().optional(),
  QUICKNODE_API_KEY: z.string().optional(),
});

/**
 * Trading configuration schema
 */
const TradingConfigSchema = z.object({
  DEFAULT_SLIPPAGE_TOLERANCE: z.coerce.number().min(0).max(100).default(0.5),
  DEFAULT_DEADLINE_MINUTES: z.coerce.number().min(1).max(60).default(20),
  MAX_SLIPPAGE_TOLERANCE: z.coerce.number().min(0).max(100).default(5.0),
  MIN_SLIPPAGE_TOLERANCE: z.coerce.number().min(0).max(100).default(0.1),
  GAS_PRICE_MULTIPLIER: z.coerce.number().min(1).max(5).default(1.1),
  MAX_GAS_PRICE_GWEI: z.coerce.number().min(1).default(100),
  PRIORITY_FEE_MULTIPLIER: z.coerce.number().min(1).max(5).default(1.2),
  MAX_ORDER_SIZE_USD: z.coerce.number().min(1).default(100000),
  MIN_ORDER_SIZE_USD: z.coerce.number().min(0.01).default(1),
  MAX_ORDERS_PER_USER: z.coerce.number().min(1).default(100),
});

/**
 * Frontend configuration schema
 */
const FrontendConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3006'),
  NEXT_PUBLIC_APP_NAME: z.string().default('MoonX Farm DEX'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_ENABLE_TESTNETS: z.coerce.boolean().default(true),
});

/**
 * Cache configuration schema
 */
const CacheConfigSchema = z.object({
  CACHE_TTL_PRICES: z.coerce.number().default(60),
  CACHE_TTL_USER_DATA: z.coerce.number().default(300),
  CACHE_TTL_TRADING_PAIRS: z.coerce.number().default(3600),
  CACHE_TTL_MARKET_DATA: z.coerce.number().default(120),
  CACHE_PREFIX_PRICES: z.string().default('prices:'),
  CACHE_PREFIX_USERS: z.string().default('users:'),
  CACHE_PREFIX_ORDERS: z.string().default('orders:'),
  CACHE_PREFIX_POSITIONS: z.string().default('positions:'),
});

/**
 * Configuration profiles for different services
 */
export const CONFIG_PROFILES = {
  // API Gateway needs all service configs
  'api-gateway': BaseConfigSchema
    .merge(ServicesConfigSchema)
    .merge(JwtConfigSchema)
    .merge(RedisConfigSchema),

  // Auth service needs database, redis, jwt
  'auth-service': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(JwtConfigSchema)
    .merge(ServicesConfigSchema.pick({ AUTH_SERVICE_PORT: true, AUTH_SERVICE_HOST: true })),

  // Wallet registry needs database, blockchain
  'wallet-registry': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ServicesConfigSchema.pick({ WALLET_REGISTRY_PORT: true, WALLET_REGISTRY_HOST: true })),

  // Quote service needs redis, external APIs, blockchain
  'quote-service': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ServicesConfigSchema.pick({ QUOTE_SERVICE_PORT: true, QUOTE_SERVICE_HOST: true })),

  // Swap orchestrator needs database, redis, kafka, blockchain, trading
  'swap-orchestrator': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(TradingConfigSchema)
    .merge(ServicesConfigSchema.pick({ SWAP_ORCHESTRATOR_PORT: true, SWAP_ORCHESTRATOR_HOST: true })),

  // Position indexer needs database, redis, kafka, blockchain
  'position-indexer': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ServicesConfigSchema.pick({ POSITION_INDEXER_PORT: true, POSITION_INDEXER_HOST: true })),

  // Notify service needs redis, kafka
  'notify-service': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ServicesConfigSchema.pick({ NOTIFY_SERVICE_PORT: true, NOTIFY_SERVICE_HOST: true })),

  // Price crawler worker needs redis, kafka, external APIs, blockchain
  'price-crawler': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema),

  // Order executor worker needs database, redis, kafka, blockchain, trading
  'order-executor': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(TradingConfigSchema),

  // Frontend web app needs frontend config
  'web': BaseConfigSchema
    .merge(FrontendConfigSchema),

  // Full config for development/testing
  'full': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(JwtConfigSchema)
    .merge(ServicesConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(TradingConfigSchema)
    .merge(FrontendConfigSchema)
    .merge(CacheConfigSchema),
} as const;

export type ConfigProfile = keyof typeof CONFIG_PROFILES;
export type ConfigForProfile<T extends ConfigProfile> = z.infer<typeof CONFIG_PROFILES[T]>;

/**
 * Configuration Manager
 */
class ConfigManager {
  private static instances: Map<ConfigProfile, ConfigManager> = new Map();
  private config: any;
  private profile: ConfigProfile;

  private constructor(profile: ConfigProfile) {
    this.profile = profile;
    this.config = this.loadConfig(profile);
  }

  public static getInstance<T extends ConfigProfile>(profile: T): ConfigManager {
    if (!ConfigManager.instances.has(profile)) {
      ConfigManager.instances.set(profile, new ConfigManager(profile));
    }
    return ConfigManager.instances.get(profile)!;
  }

  private loadConfig(profile: ConfigProfile) {
    try {
      const schema = CONFIG_PROFILES[profile];
      const config = schema.parse(process.env);
      console.log(`✅ Configuration loaded for profile: ${profile}`);
      return config;
    } catch (error) {
      console.error(`❌ Configuration validation failed for profile: ${profile}`, error);
      throw new Error(`Invalid configuration for profile: ${profile}`);
    }
  }

  public get<K extends keyof ConfigForProfile<ConfigProfile>>(key: K): ConfigForProfile<ConfigProfile>[K] {
    return this.config[key];
  }

  public getAll(): ConfigForProfile<ConfigProfile> {
    return this.config;
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  public reload(): void {
    this.config = this.loadConfig(this.profile);
  }
}

/**
 * Helper functions to create config instances for each service
 */
export const createConfig = <T extends ConfigProfile>(profile: T) => {
  return ConfigManager.getInstance(profile);
};

// Export specific config creators for each service
export const createApiGatewayConfig = () => createConfig('api-gateway');
export const createAuthServiceConfig = () => createConfig('auth-service');
export const createWalletRegistryConfig = () => createConfig('wallet-registry');
export const createQuoteServiceConfig = () => createConfig('quote-service');
export const createSwapOrchestratorConfig = () => createConfig('swap-orchestrator');
export const createPositionIndexerConfig = () => createConfig('position-indexer');
export const createNotifyServiceConfig = () => createConfig('notify-service');
export const createPriceCrawlerConfig = () => createConfig('price-crawler');
export const createOrderExecutorConfig = () => createConfig('order-executor');
export const createWebConfig = () => createConfig('web');
export const createFullConfig = () => createConfig('full');

/**
 * Configuration helper functions
 */
export const getConfigForService = (serviceName: string) => {
  const profileMap: Record<string, ConfigProfile> = {
    'api-gateway': 'api-gateway',
    'auth-service': 'auth-service',
    'wallet-registry': 'wallet-registry',
    'quote-service': 'quote-service',
    'swap-orchestrator': 'swap-orchestrator',
    'position-indexer': 'position-indexer',
    'notify-service': 'notify-service',
    'price-crawler': 'price-crawler',
    'order-executor': 'order-executor',
    'web': 'web',
  };

  const profile = profileMap[serviceName];
  if (!profile) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  return createConfig(profile);
};

// Export schemas for extending
export {
  BaseConfigSchema,
  DatabaseConfigSchema,
  RedisConfigSchema,
  KafkaConfigSchema,
  JwtConfigSchema,
  ServicesConfigSchema,
  BlockchainConfigSchema,
  ExternalApisConfigSchema,
  TradingConfigSchema,
  FrontendConfigSchema,
  CacheConfigSchema,
}; 