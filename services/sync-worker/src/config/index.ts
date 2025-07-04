import { 
  WorkerConfig, 
  ClusterConfig, 
  RedisConfig, 
  DatabaseConfig, 
  AlchemyConfig,
  ExternalApiConfig 
} from '@/types';

// Import shared base config if available
let baseConfig: any = {};
try {
  const { createConfig } = require('@moonx-farm/configs');
  baseConfig = createConfig();
} catch (error) {
  console.warn('Shared configs not available, using local configuration');
}

// Worker-specific configuration
export const workerConfig: WorkerConfig = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
  maxJobs: parseInt(process.env.WORKER_MAX_JOBS || '100'),
  timeout: parseInt(process.env.WORKER_TIMEOUT || '300000'), // 5 minutes
  retryAttempts: parseInt(process.env.WORKER_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '5000'), // 5 seconds
  backoffMultiplier: parseFloat(process.env.WORKER_BACKOFF_MULTIPLIER || '2.0'),
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
  circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'), // 1 minute
};

// Cluster configuration
export const clusterConfig: ClusterConfig = {
  enabled: process.env.CLUSTER_MODE === 'true',
  workers: parseInt(process.env.CLUSTER_WORKERS || '4'),
  maxMemory: parseInt(process.env.MAX_MEMORY_USAGE || '512'), // MB
  cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'), // %
  autoScale: process.env.AUTO_SCALE === 'true',
  minWorkers: parseInt(process.env.MIN_WORKERS || '2'),
  maxWorkers: parseInt(process.env.MAX_WORKERS || '10'),
};

// Redis configuration for job queue
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
};

// Database configuration
export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'moonx_farm',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
  idle: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
};

// Alchemy configuration
export const alchemyConfig: AlchemyConfig = {
  apiKey: process.env.ALCHEMY_API_KEY || '',
  ...(process.env.ALCHEMY_WEBHOOK_ID && { webhookId: process.env.ALCHEMY_WEBHOOK_ID }),
  ...(process.env.ALCHEMY_WEBHOOK_SIGNING_KEY && { webhookSigningKey: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY }),
  rateLimitRpm: parseInt(process.env.ALCHEMY_RATE_LIMIT_RPM || '300'),
  timeout: parseInt(process.env.ALCHEMY_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.ALCHEMY_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.ALCHEMY_RETRY_DELAY || '300'),
};

// External API configurations
export const externalApiConfig: ExternalApiConfig = {
  binance: {
    ...(process.env.BINANCE_API_KEY && { apiKey: process.env.BINANCE_API_KEY }),
    ...(process.env.BINANCE_API_SECRET && { apiSecret: process.env.BINANCE_API_SECRET }),
    baseUrl: process.env.BINANCE_BASE_URL || 'https://api.binance.com/api/v3',
    timeout: parseInt(process.env.BINANCE_TIMEOUT || '5000'),
  },
  coingecko: {
    ...(process.env.COINGECKO_API_KEY && { apiKey: process.env.COINGECKO_API_KEY }),
    baseUrl: process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3',
    timeout: parseInt(process.env.COINGECKO_TIMEOUT || '10000'),
  },
  dexscreener: {
    ...(process.env.DEXSCREENER_API_KEY && { apiKey: process.env.DEXSCREENER_API_KEY }),
    baseUrl: process.env.DEXSCREENER_BASE_URL || 'https://api.dexscreener.com/latest/dex',
    timeout: parseInt(process.env.DEXSCREENER_TIMEOUT || '5000'),
  },
};

// App configuration
export const appConfig = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  metricsPort: parseInt(process.env.METRICS_PORT || '3002'),
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3003'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
  apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
};

// Performance configuration
export const performanceConfig = {
  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER === 'true',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  cacheTtl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
  cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  enableCacheWarming: process.env.ENABLE_CACHE_WARMING === 'true',
};

// Monitoring configuration
export const monitoringConfig = {
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000'), // 5 minutes
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'), // 1 minute
  enablePrometheus: process.env.ENABLE_PROMETHEUS === 'true',
  enableHealthEndpoint: process.env.ENABLE_HEALTH_ENDPOINT === 'true',
};

// Validation function
export function validateConfig(): void {
  const errors: string[] = [];

  // Required configurations
  if (!alchemyConfig.apiKey) {
    errors.push('ALCHEMY_API_KEY is required');
  }

  if (!databaseConfig.password || databaseConfig.password === 'password') {
    errors.push('DB_PASSWORD must be set and not be the default value');
  }

  if (workerConfig.concurrency < 1 || workerConfig.concurrency > 50) {
    errors.push('WORKER_CONCURRENCY must be between 1 and 50');
  }

  if (clusterConfig.enabled && (clusterConfig.workers < 1 || clusterConfig.workers > 20)) {
    errors.push('CLUSTER_WORKERS must be between 1 and 20');
  }

  if (workerConfig.timeout < 5000 || workerConfig.timeout > 600000) {
    errors.push('WORKER_TIMEOUT must be between 5 seconds and 10 minutes');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

// Export combined config
export const config = {
  app: appConfig,
  worker: workerConfig,
  cluster: clusterConfig,
  redis: redisConfig,
  database: databaseConfig,
  alchemy: alchemyConfig,
  externalApi: externalApiConfig,
  performance: performanceConfig,
  monitoring: monitoringConfig,
  baseConfig, // Include shared base config
};

// Validate configuration on module load
validateConfig();

export default config; 