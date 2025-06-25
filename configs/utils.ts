import { 
  createConfig, 
  ConfigProfile, 
  ConfigForProfile
} from './index';

/**
 * Configuration utilities for easy access to common configurations
 */

/**
 * Get database configuration for any service that needs it
 */
export const getDatabaseConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  if (!configData.DATABASE_HOST) {
    throw new Error(`Database configuration not available for profile: ${profile}`);
  }

  return {
    host: configData.DATABASE_HOST,
    port: configData.DATABASE_PORT,
    database: configData.DATABASE_NAME,
    user: configData.DATABASE_USER,
    password: configData.DATABASE_PASSWORD,
    ssl: configData.DATABASE_SSL,
    maxConnections: configData.DATABASE_MAX_CONNECTIONS,
    idleTimeoutMs: configData.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: configData.DATABASE_CONNECTION_TIMEOUT_MS,
  };
};

/**
 * Get Redis configuration for any service that needs it
 */
export const getRedisConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  if (!configData.REDIS_HOST) {
    throw new Error(`Redis configuration not available for profile: ${profile}`);
  }

  return {
    host: configData.REDIS_HOST,
    port: configData.REDIS_PORT,
    password: configData.REDIS_PASSWORD,
    db: configData.REDIS_DB,
    keyPrefix: configData.REDIS_KEY_PREFIX,
    enableReadyCheck: configData.REDIS_ENABLE_READY_CHECK,
    lazyConnect: configData.REDIS_LAZY_CONNECT,
    maxRetriesPerRequest: configData.REDIS_MAX_RETRIES_PER_REQUEST,
    connectTimeout: configData.REDIS_CONNECT_TIMEOUT,
    commandTimeout: configData.REDIS_COMMAND_TIMEOUT,
  };
};

/**
 * Get Kafka configuration for any service that needs it
 */
export const getKafkaConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  if (!configData.KAFKA_BROKERS) {
    throw new Error(`Kafka configuration not available for profile: ${profile}`);
  }

  return {
    clientId: configData.KAFKA_CLIENT_ID,
    brokers: configData.KAFKA_BROKERS.split(','),
    ssl: configData.KAFKA_SSL,
    sasl: configData.KAFKA_USERNAME && configData.KAFKA_PASSWORD ? {
      mechanism: configData.KAFKA_SASL_MECHANISM,
      username: configData.KAFKA_USERNAME,
      password: configData.KAFKA_PASSWORD,
    } : undefined,
    connectionTimeout: configData.KAFKA_CONNECTION_TIMEOUT,
    requestTimeout: configData.KAFKA_REQUEST_TIMEOUT,
    retry: {
      initialRetryTime: configData.KAFKA_RETRY_INITIAL_TIME,
      retries: configData.KAFKA_RETRY_COUNT,
    },
  };
};

/**
 * Get JWT configuration for any service that needs it
 */
export const getJwtConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  if (!configData.JWT_SECRET) {
    throw new Error(`JWT configuration not available for profile: ${profile}`);
  }

  return {
    secret: configData.JWT_SECRET,
    expiresIn: configData.JWT_EXPIRES_IN,
    refreshExpiresIn: configData.JWT_REFRESH_EXPIRES_IN,
    issuer: configData.JWT_ISSUER,
    audience: configData.JWT_AUDIENCE,
  };
};

/**
 * Get service URLs for inter-service communication
 */
export const getServiceUrls = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;

  return {
    apiGateway: `http://${configData.API_GATEWAY_HOST || 'localhost'}:${configData.API_GATEWAY_PORT || 3000}`,
    authService: `http://${configData.AUTH_SERVICE_HOST || 'localhost'}:${configData.AUTH_SERVICE_PORT || 3001}`,
    walletRegistry: `http://${configData.WALLET_REGISTRY_HOST || 'localhost'}:${configData.WALLET_REGISTRY_PORT || 3002}`,
    quoteService: `http://${configData.QUOTE_SERVICE_HOST || 'localhost'}:${configData.QUOTE_SERVICE_PORT || 3003}`,
    swapOrchestrator: `http://${configData.SWAP_ORCHESTRATOR_HOST || 'localhost'}:${configData.SWAP_ORCHESTRATOR_PORT || 3004}`,
    positionIndexer: `http://${configData.POSITION_INDEXER_HOST || 'localhost'}:${configData.POSITION_INDEXER_PORT || 3005}`,
    notifyService: `http://${configData.NOTIFY_SERVICE_HOST || 'localhost'}:${configData.NOTIFY_SERVICE_PORT || 3006}`,
  };
};

/**
 * Get blockchain network configurations
 */
export const getNetworkConfigs = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;

  return {
    base: {
      mainnet: {
        privateRpc: configData.BASE_MAINNET_RPC,
        fallbackRpcs: configData.BASE_MAINNET_FALLBACK_RPCS?.split(',').map((url: string) => url.trim()) || [],
        chainId: configData.BASE_MAINNET_CHAIN_ID,
        explorer: configData.BASE_MAINNET_EXPLORER || 'https://basescan.org',
      },
      testnet: {
        privateRpc: configData.BASE_TESTNET_RPC,
        fallbackRpcs: configData.BASE_TESTNET_FALLBACK_RPCS?.split(',').map((url: string) => url.trim()) || [],
        chainId: configData.BASE_TESTNET_CHAIN_ID,
        explorer: configData.BASE_TESTNET_EXPLORER || 'https://sepolia.basescan.org',
      },
    },
    bsc: {
      mainnet: {
        privateRpc: configData.BSC_MAINNET_RPC,
        fallbackRpcs: configData.BSC_MAINNET_FALLBACK_RPCS?.split(',').map((url: string) => url.trim()) || [],
        chainId: configData.BSC_MAINNET_CHAIN_ID,
        explorer: configData.BSC_MAINNET_EXPLORER || 'https://bscscan.com',
      },
      testnet: {
        privateRpc: configData.BSC_TESTNET_RPC,
        fallbackRpcs: configData.BSC_TESTNET_FALLBACK_RPCS?.split(',').map((url: string) => url.trim()) || [],
        chainId: configData.BSC_TESTNET_CHAIN_ID,
        explorer: configData.BSC_TESTNET_EXPLORER || 'https://testnet.bscscan.com',
      },
    },
    default: {
      chainId: configData.DEFAULT_CHAIN_ID,
    },
  };
};

/**
 * Get trading configuration
 */
export const getTradingConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;

  return {
    defaultSlippageTolerance: configData.DEFAULT_SLIPPAGE_TOLERANCE,
    defaultDeadlineMinutes: configData.DEFAULT_DEADLINE_MINUTES,
    maxSlippageTolerance: configData.MAX_SLIPPAGE_TOLERANCE,
    minSlippageTolerance: configData.MIN_SLIPPAGE_TOLERANCE,
    gasPriceMultiplier: configData.GAS_PRICE_MULTIPLIER,
    maxGasPriceGwei: configData.MAX_GAS_PRICE_GWEI,
    priorityFeeMultiplier: configData.PRIORITY_FEE_MULTIPLIER,
    maxOrderSizeUsd: configData.MAX_ORDER_SIZE_USD,
    minOrderSizeUsd: configData.MIN_ORDER_SIZE_USD,
    maxOrdersPerUser: configData.MAX_ORDERS_PER_USER,
  };
};

/**
 * Get external API keys
 */
export const getApiKeys = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;

  return {
    coingecko: configData.COINGECKO_API_KEY,
    coinmarketcap: configData.COINMARKETCAP_API_KEY,
    dexscreener: configData.DEXSCREENER_API_KEY,
    oneInch: configData.ONE_INCH_API_KEY,
    paraswap: configData.PARASWAP_API_KEY,
    alchemy: configData.ALCHEMY_API_KEY,
    infura: configData.INFURA_API_KEY,
    quicknode: configData.QUICKNODE_API_KEY,
  };
};

/**
 * Get cache configuration
 */
export const getCacheConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;

  return {
    ttl: {
      prices: configData.CACHE_TTL_PRICES || 60,
      userData: configData.CACHE_TTL_USER_DATA || 300,
      tradingPairs: configData.CACHE_TTL_TRADING_PAIRS || 3600,
      marketData: configData.CACHE_TTL_MARKET_DATA || 120,
    },
    prefixes: {
      prices: configData.CACHE_PREFIX_PRICES || 'prices:',
      users: configData.CACHE_PREFIX_USERS || 'users:',
      orders: configData.CACHE_PREFIX_ORDERS || 'orders:',
      positions: configData.CACHE_PREFIX_POSITIONS || 'positions:',
    },
  };
};

/**
 * Validate that required configuration exists for a service
 */
export const validateServiceConfig = (profile: ConfigProfile, requiredConfigs: string[]) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  const missing: string[] = [];
  
  for (const required of requiredConfigs) {
    if (!configData[required]) {
      missing.push(required);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration for ${profile}: ${missing.join(', ')}`);
  }
  
  return true;
};

/**
 * Get server configuration for a service
 */
export const getServerConfig = (profile: ConfigProfile) => {
  const config = createConfig(profile);
  const configData = config.getAll() as any;
  
  // Map profile to port configuration
  const portMap: Record<string, string> = {
    'api-gateway': 'API_GATEWAY_PORT',
    'auth-service': 'AUTH_SERVICE_PORT',
    'wallet-registry': 'WALLET_REGISTRY_PORT',
    'quote-service': 'QUOTE_SERVICE_PORT',
    'swap-orchestrator': 'SWAP_ORCHESTRATOR_PORT',
    'position-indexer': 'POSITION_INDEXER_PORT',
    'notify-service': 'NOTIFY_SERVICE_PORT',
  };
  
  const hostMap: Record<string, string> = {
    'api-gateway': 'API_GATEWAY_HOST',
    'auth-service': 'AUTH_SERVICE_HOST',
    'wallet-registry': 'WALLET_REGISTRY_HOST',
    'quote-service': 'QUOTE_SERVICE_HOST',
    'swap-orchestrator': 'SWAP_ORCHESTRATOR_HOST',
    'position-indexer': 'POSITION_INDEXER_HOST',
    'notify-service': 'NOTIFY_SERVICE_HOST',
  };
  
  const portKey = portMap[profile as string];
  const hostKey = hostMap[profile as string];
  
  return {
    port: configData[portKey] || 3000,
    host: configData[hostKey] || 'localhost',
    cors: {
      origin: configData.CORS_ORIGIN || '*',
      credentials: configData.CORS_CREDENTIALS || true,
    },
  };
};

/**
 * RPC Management Utilities
 */

/**
 * Get the best available RPC URL for a network
 * Priority: privateRpc > first fallback RPC
 */
export const getBestRpcUrl = (networkConfig: any): string => {
  return networkConfig.privateRpc || networkConfig.fallbackRpcs[0];
};

/**
 * Get all available RPC URLs for a network (private first, then fallbacks)
 */
export const getAllRpcUrls = (networkConfig: any): string[] => {
  const urls = [];
  if (networkConfig.privateRpc) {
    urls.push(networkConfig.privateRpc);
  }
  urls.push(...networkConfig.fallbackRpcs);
  return urls;
};

/**
 * Get public RPC URLs only (excluding private)
 */
export const getPublicRpcUrls = (networkConfig: any): string[] => {
  return [...networkConfig.fallbackRpcs];
};

/**
 * Check if network has private RPC configured
 */
export const hasPrivateRpc = (networkConfig: any): boolean => {
  return !!networkConfig.privateRpc;
};

/**
 * Get RPC configuration for a specific network and environment
 */
export const getRpcConfig = (profile: ConfigProfile, network: 'base' | 'bsc', environment: 'mainnet' | 'testnet') => {
  const networks = getNetworkConfigs(profile);
  const networkConfig = networks[network][environment];
  
  return {
    privateRpc: networkConfig.privateRpc,
    fallbackRpcs: networkConfig.fallbackRpcs,
    chainId: networkConfig.chainId,
    explorer: networkConfig.explorer,
    // Utility methods
    getBestUrl: () => getBestRpcUrl(networkConfig),
    getAllUrls: () => getAllRpcUrls(networkConfig),
    getPublicUrls: () => getPublicRpcUrls(networkConfig),
    hasPrivate: () => hasPrivateRpc(networkConfig),
  };
};

/**
 * Environment utility functions
 */

/**
 * Check if current environment is development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if current environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if current environment is test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get current environment
 */
export function getCurrentEnv(): 'development' | 'staging' | 'production' | 'test' {
  return (process.env.NODE_ENV as any) || 'development';
}

/**
 * Get logger configuration from environment
 * @returns Logger configuration object
 */
export function getLoggerConfig() {
  return {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    service: process.env.APP_NAME || 'moonx-farm',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    logDir: process.env.LOG_DIR || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    format: (process.env.LOG_FORMAT as 'json' | 'console') || 'console',
  };
}

/**
 * Get RPC configuration for a specific network
 * @param network - Network name (e.g., 'base-mainnet', 'bsc-testnet')
 * @returns RPC configuration object
 */ 