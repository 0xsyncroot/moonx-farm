import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  BaseConfigSchema,
  DatabaseConfigSchema,
  RedisConfigSchema,
  KafkaConfigSchema,
  JwtConfigSchema,
  PrivyConfigSchema,
  ServicesConfigSchema,
  BlockchainConfigSchema,
  ExternalApisConfigSchema,
  TradingConfigSchema,
  FrontendConfigSchema,
  CacheConfigSchema,
  ZeroDevConfigSchema,
  LoggerConfigSchema,
} from './schemas';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Configuration profiles for different services
 */
export const CONFIG_PROFILES = {
  // API Gateway needs all service configs
  'api-gateway': BaseConfigSchema
    .merge(ServicesConfigSchema)
    .merge(JwtConfigSchema)
    .merge(RedisConfigSchema)
    .merge(LoggerConfigSchema),

  // Auth service needs database, redis, jwt, privy
  'auth-service': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(JwtConfigSchema)
    .merge(PrivyConfigSchema)
    .merge(ServicesConfigSchema.pick({ AUTH_SERVICE_PORT: true, AUTH_SERVICE_HOST: true, FRONTEND_URL: true }))
    .merge(LoggerConfigSchema),

  // Wallet registry needs database, blockchain, JWT for auth verification, ZeroDev
  'wallet-registry': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(JwtConfigSchema)
    .merge(ZeroDevConfigSchema)
    .merge(ServicesConfigSchema.pick({ WALLET_REGISTRY_PORT: true, WALLET_REGISTRY_HOST: true }))
    .merge(LoggerConfigSchema),

  // Core service needs database, redis, blockchain
  'core-service': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ServicesConfigSchema.pick({ CORE_SERVICE_PORT: true, CORE_SERVICE_HOST: true }))
    .merge(LoggerConfigSchema),

  // Aggregator service needs redis, external APIs, blockchain
  'aggregator-service': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(CacheConfigSchema)
    .merge(ServicesConfigSchema.pick({ AGGREGATOR_SERVICE_PORT: true, AGGREGATOR_SERVICE_HOST: true }))
    .merge(LoggerConfigSchema),

  // Swap orchestrator needs database, redis, kafka, blockchain, trading
  'swap-orchestrator': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(TradingConfigSchema)
    .merge(ServicesConfigSchema.pick({ SWAP_ORCHESTRATOR_PORT: true, SWAP_ORCHESTRATOR_HOST: true }))
    .merge(LoggerConfigSchema),

  // Position indexer needs database, redis, kafka, blockchain
  'position-indexer': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ServicesConfigSchema.pick({ POSITION_INDEXER_PORT: true, POSITION_INDEXER_HOST: true }))
    .merge(LoggerConfigSchema),

  // Notify service needs redis, kafka
  'notify-service': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ServicesConfigSchema.pick({ NOTIFY_SERVICE_PORT: true, NOTIFY_SERVICE_HOST: true }))
    .merge(LoggerConfigSchema),

  // WebSocket Gateway needs redis, services for auth calls
  'websocket-gateway': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(ServicesConfigSchema.pick({ 
      WEBSOCKET_GATEWAY_PORT: true, 
      WEBSOCKET_GATEWAY_HOST: true, 
      AUTH_SERVICE_URL: true 
    }))
    .merge(LoggerConfigSchema),

  // Notification Hub needs redis, kafka, external APIs
  'notification-hub': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ExternalApisConfigSchema.pick({ FIREBASE_SERVER_KEY: true }))
    .merge(ServicesConfigSchema.pick({ NOTIFICATION_HUB_PORT: true, NOTIFICATION_HUB_HOST: true }))
    .merge(LoggerConfigSchema),

  // Price crawler worker needs redis, kafka, external APIs, blockchain
  'price-crawler': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(CacheConfigSchema)
    .merge(LoggerConfigSchema),

  // Order executor worker needs database, redis, kafka, blockchain, trading
  'order-executor': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(TradingConfigSchema)
    .merge(LoggerConfigSchema),

  // Frontend Next.js app
  'web': BaseConfigSchema
    .merge(FrontendConfigSchema)
    .merge(LoggerConfigSchema),

  // Full config for development/testing
  'full': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(JwtConfigSchema)
    .merge(PrivyConfigSchema)
    .merge(ServicesConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(TradingConfigSchema)
    .merge(FrontendConfigSchema)
    .merge(CacheConfigSchema)
    .merge(ZeroDevConfigSchema)
    .merge(LoggerConfigSchema),
} as const;

export type ConfigProfile = keyof typeof CONFIG_PROFILES;
export type ConfigForProfile<T extends ConfigProfile> = z.infer<typeof CONFIG_PROFILES[T]>;

/**
 * Generic Configuration Manager
 */
class ConfigManager<T extends z.ZodSchema> {
  private config: z.infer<T>;

  constructor(schema: T) {
    this.config = this.loadConfig(schema);
  }

  private loadConfig(schema: T): z.infer<T> {
    try {
      const config = schema.parse(process.env);
      console.log(`✅ Configuration loaded successfully`);
      return config;
    } catch (error) {
      console.error(`❌ Configuration validation failed:`, error);
      throw new Error(`Invalid configuration`);
    }
  }

  public get<K extends keyof z.infer<T>>(key: K): z.infer<T>[K] {
    return this.config[key];
  }

  public getAll(): z.infer<T> {
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

  public reload(schema: T): void {
    this.config = this.loadConfig(schema);
  }
}

/**
 * Generic config creator - supports both schemas and profiles
 */
export function createConfig<T extends z.ZodSchema>(schema: T): ConfigManager<T>;
export function createConfig<T extends ConfigProfile>(profile: T): ConfigManager<typeof CONFIG_PROFILES[T]>;
export function createConfig<T extends z.ZodSchema | ConfigProfile>(input: T): any {
  if (typeof input === 'string') {
    // Profile name
    return new ConfigManager(CONFIG_PROFILES[input as ConfigProfile]);
  } else {
    // Zod schema
    return new ConfigManager(input as z.ZodSchema);
  }
}

/**
 * Helper functions to create config instances for each service
 */
export const createFullConfig = () => createConfig(CONFIG_PROFILES.full);
export const createApiGatewayConfig = () => createConfig(CONFIG_PROFILES['api-gateway']);
export const createAuthServiceConfig = () => createConfig(CONFIG_PROFILES['auth-service']);
export const createWalletRegistryConfig = () => createConfig(CONFIG_PROFILES['wallet-registry']);
export const createCoreServiceConfig = () => createConfig(CONFIG_PROFILES['core-service']);
export const createAggregatorServiceConfig = () => createConfig(CONFIG_PROFILES['aggregator-service']);
export const createSwapOrchestratorConfig = () => createConfig(CONFIG_PROFILES['swap-orchestrator']);
export const createPositionIndexerConfig = () => createConfig(CONFIG_PROFILES['position-indexer']);
export const createNotifyServiceConfig = () => createConfig(CONFIG_PROFILES['notify-service']);
export const createWebSocketGatewayConfig = () => createConfig(CONFIG_PROFILES['websocket-gateway']);
export const createNotificationHubConfig = () => createConfig(CONFIG_PROFILES['notification-hub']);
export const createPriceCrawlerConfig = () => createConfig(CONFIG_PROFILES['price-crawler']);
export const createOrderExecutorConfig = () => createConfig(CONFIG_PROFILES['order-executor']);
export const createWebConfig = () => createConfig(CONFIG_PROFILES.web);

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
  LoggerConfigSchema,
};

// Export utility functions from utils.ts
export {
  getDatabaseConfig,
  getRedisConfig,
  getKafkaConfig,
  getJwtConfig,
  getServiceUrls,
  getNetworkConfigs,
  getTradingConfig,
  getApiKeys,
  getCacheConfig,
  validateServiceConfig,
  getServerConfig,
  getLoggerConfig,
  // Environment utilities
  isDevelopment,
  isProduction,
  isTest,
  getCurrentEnv,
  // RPC utilities
  getBestRpcUrl,
  getAllRpcUrls,
  getPublicRpcUrls,
  hasPrivateRpc,
  getRpcConfig,
} from './utils'; 