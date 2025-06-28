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
    .merge(ServicesConfigSchema.pick({ WALLET_REGISTRY_PORT: true, WALLET_REGISTRY_HOST: true, FRONTEND_URL: true }))
    .merge(LoggerConfigSchema),

  // Core service needs database, redis, JWT, external APIs, logger
  'core-service': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(JwtConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(ServicesConfigSchema.pick({ CORE_SERVICE_PORT: true, CORE_SERVICE_HOST: true, FRONTEND_URL: true }))
    .merge(LoggerConfigSchema),

  // Quote service needs redis, external APIs, blockchain
  'aggregator-service': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema)
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

  // Price crawler worker needs redis, kafka, external APIs, blockchain
  'price-crawler': BaseConfigSchema
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(ExternalApisConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(LoggerConfigSchema),

  // Order executor worker needs database, redis, kafka, blockchain, trading
  'order-executor': BaseConfigSchema
    .merge(DatabaseConfigSchema)
    .merge(RedisConfigSchema)
    .merge(KafkaConfigSchema)
    .merge(BlockchainConfigSchema)
    .merge(TradingConfigSchema)
    .merge(LoggerConfigSchema),

  // Frontend web app needs frontend config
  'web': BaseConfigSchema
    .merge(FrontendConfigSchema)
    .merge(LoggerConfigSchema),

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
    .merge(CacheConfigSchema)
    .merge(LoggerConfigSchema),
} as const;

export type ConfigProfile = keyof typeof CONFIG_PROFILES;
export type ConfigForProfile<T extends ConfigProfile> = z.infer<typeof CONFIG_PROFILES[T]>;

/**
 * Configuration Manager
 */
class ConfigManager<T extends ConfigProfile> {
  private static instances: Map<ConfigProfile, ConfigManager<any>> = new Map();
  private config: ConfigForProfile<T>;
  private profile: T;

  private constructor(profile: T) {
    this.profile = profile;
    this.config = this.loadConfig(profile);
  }

  public static getInstance<T extends ConfigProfile>(profile: T): ConfigManager<T> {
    if (!ConfigManager.instances.has(profile)) {
      ConfigManager.instances.set(profile, new ConfigManager(profile));
    }
    return ConfigManager.instances.get(profile)!;
  }

  private loadConfig(profile: T): ConfigForProfile<T> {
    try {
      const schema = CONFIG_PROFILES[profile];
      const config = schema.parse(process.env);
      console.log(`✅ Configuration loaded for profile: ${profile}`);
      return config as ConfigForProfile<T>;
    } catch (error) {
      console.error(`❌ Configuration validation failed for profile: ${profile}`, error);
      throw new Error(`Invalid configuration for profile: ${profile}`);
    }
  }

  public get<K extends keyof ConfigForProfile<T>>(key: K): ConfigForProfile<T>[K] {
    return this.config[key];
  }

  public getAll(): ConfigForProfile<T> {
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
export const createConfig = <T extends ConfigProfile>(profile: T): ConfigManager<T> => {
  return ConfigManager.getInstance(profile);
};

// Export specific config creators for each service
export const createApiGatewayConfig = () => createConfig('api-gateway');
export const createAuthServiceConfig = () => createConfig('auth-service');
export const createWalletRegistryConfig = () => createConfig('wallet-registry');
export const createCoreServiceConfig = () => createConfig('core-service');
export const createAggregatorServiceConfig = () => createConfig('aggregator-service');
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
    'core-service': 'core-service',
    'aggregator-service': 'aggregator-service',
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

/**
 * Get configuration for a specific profile
 * @param profile - Profile name
 * @returns Configuration object
 */
export const getConfig = (profile: ConfigProfile) => {
  return createConfig(profile).getAll();
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