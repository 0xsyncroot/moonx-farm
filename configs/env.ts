import { z } from 'zod';

/**
 * Centralized Environment Configuration for MoonX Farm DEX
 * This file manages all environment variables across the entire monorepo
 */

// Configuration Schema
const ConfigSchema = z.object({
  // =============================================================================
  // GENERAL SETTINGS
  // =============================================================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  APP_NAME: z.string().default('moonx-farm'),

  // =============================================================================
  // DATABASE CONFIGURATION
  // =============================================================================
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('moonx_farm'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres123'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),

  // =============================================================================
  // REDIS CONFIGURATION
  // =============================================================================
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('moonx:'),

  // =============================================================================
  // KAFKA CONFIGURATION
  // =============================================================================
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('moonx-farm'),
  KAFKA_SSL: z.coerce.boolean().default(false),

  // =============================================================================
  // JWT & AUTHENTICATION
  // =============================================================================
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // =============================================================================
  // MICROSERVICES PORTS
  // =============================================================================
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  AUTH_SERVICE_PORT: z.coerce.number().default(3001),
  WALLET_REGISTRY_PORT: z.coerce.number().default(3002),
  QUOTE_SERVICE_PORT: z.coerce.number().default(3003),
  SWAP_ORCHESTRATOR_PORT: z.coerce.number().default(3004),
  POSITION_INDEXER_PORT: z.coerce.number().default(3005),
  NOTIFY_SERVICE_PORT: z.coerce.number().default(3006),

  // =============================================================================
  // BLOCKCHAIN NETWORKS
  // =============================================================================
  BASE_MAINNET_RPC: z.string().url().default('https://mainnet.base.org'),
  BASE_MAINNET_CHAIN_ID: z.coerce.number().default(8453),
  BSC_MAINNET_RPC: z.string().url().default('https://bsc-dataseed.binance.org/'),
  BSC_MAINNET_CHAIN_ID: z.coerce.number().default(56),
  DEFAULT_CHAIN_ID: z.coerce.number().default(8453),

  // =============================================================================
  // EXTERNAL API KEYS
  // =============================================================================
  COINGECKO_API_KEY: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),

  // =============================================================================
  // FRONTEND CONFIGURATION
  // =============================================================================
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3006'),
  NEXT_PUBLIC_APP_NAME: z.string().default('MoonX Farm DEX'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration Manager Class
 */
class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = ConfigSchema.parse(process.env);
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get specific config value
   */
  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Get full config object
   */
  public getAll(): Config {
    return this.config;
  }

  /**
   * Environment checks
   */
  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig() {
    return {
      host: this.config.DATABASE_HOST,
      port: this.config.DATABASE_PORT,
      database: this.config.DATABASE_NAME,
      user: this.config.DATABASE_USER,
      password: this.config.DATABASE_PASSWORD,
      ssl: this.config.DATABASE_SSL,
      maxConnections: this.config.DATABASE_MAX_CONNECTIONS,
    };
  }

  /**
   * Get Redis configuration
   */
  public getRedisConfig() {
    return {
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      password: this.config.REDIS_PASSWORD,
      db: this.config.REDIS_DB,
      keyPrefix: this.config.REDIS_KEY_PREFIX,
    };
  }

  /**
   * Get Kafka configuration
   */
  public getKafkaConfig() {
    return {
      clientId: this.config.KAFKA_CLIENT_ID,
      brokers: this.config.KAFKA_BROKERS.split(','),
      ssl: this.config.KAFKA_SSL,
    };
  }

  /**
   * Get JWT configuration
   */
  public getJwtConfig() {
    return {
      secret: this.config.JWT_SECRET,
      expiresIn: this.config.JWT_EXPIRES_IN,
    };
  }

  /**
   * Get service URLs
   */
  public getServiceUrls() {
    return {
      apiGateway: `http://localhost:${this.config.API_GATEWAY_PORT}`,
      authService: `http://localhost:${this.config.AUTH_SERVICE_PORT}`,
      walletRegistry: `http://localhost:${this.config.WALLET_REGISTRY_PORT}`,
      quoteService: `http://localhost:${this.config.QUOTE_SERVICE_PORT}`,
      swapOrchestrator: `http://localhost:${this.config.SWAP_ORCHESTRATOR_PORT}`,
      positionIndexer: `http://localhost:${this.config.POSITION_INDEXER_PORT}`,
      notifyService: `http://localhost:${this.config.NOTIFY_SERVICE_PORT}`,
    };
  }

  /**
   * Get blockchain network configurations
   */
  public getNetworkConfigs() {
    return {
      base: {
        mainnet: {
          rpc: this.config.BASE_MAINNET_RPC,
          chainId: this.config.BASE_MAINNET_CHAIN_ID,
        },
      },
      bsc: {
        mainnet: {
          rpc: this.config.BSC_MAINNET_RPC,
          chainId: this.config.BSC_MAINNET_CHAIN_ID,
        },
      },
      default: {
        chainId: this.config.DEFAULT_CHAIN_ID,
      },
    };
  }

  /**
   * Get external API keys
   */
  public getApiKeys() {
    return {
      coingecko: this.config.COINGECKO_API_KEY,
      coinmarketcap: this.config.COINMARKETCAP_API_KEY,
      alchemy: this.config.ALCHEMY_API_KEY,
    };
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export convenience functions
export const getConfig = () => config.getAll();
export const getDatabaseConfig = () => config.getDatabaseConfig();
export const getRedisConfig = () => config.getRedisConfig();
export const getKafkaConfig = () => config.getKafkaConfig();
export const getJwtConfig = () => config.getJwtConfig();
export const getServiceUrls = () => config.getServiceUrls();
export const getNetworkConfigs = () => config.getNetworkConfigs();
export const getApiKeys = () => config.getApiKeys();

// Export schema for extending in services
export { ConfigSchema }; 