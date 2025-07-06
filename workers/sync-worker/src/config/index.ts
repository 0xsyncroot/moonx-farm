import { z } from 'zod';
import { 
  createConfig, 
  BaseConfigSchema, 
  RedisConfigSchema, 
  DatabaseConfigSchema,
  LoggerConfigSchema 
} from '@moonx-farm/configs';
import { 
  WorkerConfig, 
  ClusterConfig, 
  RedisConfig, 
  DatabaseConfig, 
  AlchemyConfig,
  ExternalApiConfig 
} from '@/types';

// Sync Worker custom schema - extends base schemas with worker-specific config
const SyncWorkerConfigSchema = BaseConfigSchema
  .merge(RedisConfigSchema)
  .merge(DatabaseConfigSchema)
  .merge(LoggerConfigSchema)
  .merge(z.object({
    // Worker Configuration
    WORKER_CONCURRENCY: z.coerce.number().default(10),
    WORKER_MAX_JOBS: z.coerce.number().default(100),
    WORKER_TIMEOUT: z.coerce.number().default(10000),
    WORKER_RETRIES: z.coerce.number().default(3),
    WORKER_RETRY_DELAY: z.coerce.number().default(5000),
    WORKER_BACKOFF_MULTIPLIER: z.coerce.number().default(2.0),
    WORKER_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
    WORKER_CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000),
    WORKER_BATCH_SIZE: z.coerce.number().default(50),
    WORKER_RATE_LIMIT_WINDOW: z.coerce.number().default(900000),
    WORKER_RATE_LIMIT_MAX: z.coerce.number().default(5),
    WORKER_CLEANUP_INTERVAL: z.coerce.number().default(300000),
    WORKER_STATS_INTERVAL: z.coerce.number().default(30000),
    
    // Periodic sync configuration
    PERIODIC_SYNC_ENABLED: z.coerce.boolean().default(true),
    PERIODIC_SYNC_MARKET_HOURS_INTERVAL: z.coerce.number().default(300000),
    PERIODIC_SYNC_OFF_HOURS_INTERVAL: z.coerce.number().default(900000),
    PERIODIC_SYNC_STALE_THRESHOLD: z.coerce.number().default(3600000),
    PERIODIC_SYNC_BATCH_SIZE: z.coerce.number().default(10),
    
    // Cluster Configuration
    CLUSTER_MODE: z.enum(['auto', 'manual', 'single']).default('auto'),
    CLUSTER_WORKERS: z.coerce.number().min(1).max(20).default(4),
    MAX_MEMORY_USAGE: z.coerce.number().default(512),
    CPU_THRESHOLD: z.coerce.number().default(80),
    AUTO_SCALE: z.coerce.boolean().default(false),
    MIN_WORKERS: z.coerce.number().default(2),
    MAX_WORKERS: z.coerce.number().default(10),
    CLUSTER_HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
    CLUSTER_SHUTDOWN_TIMEOUT: z.coerce.number().default(30000),
    CLUSTER_STATS_INTERVAL: z.coerce.number().default(60000),
    
    // Alchemy Configuration
    ALCHEMY_API_KEY: z.string().default(''),
    ALCHEMY_WEBHOOK_ID: z.string().optional(),
    ALCHEMY_WEBHOOK_SIGNING_KEY: z.string().optional(),
    ALCHEMY_RATE_LIMIT_RPM: z.coerce.number().default(300),
    ALCHEMY_TIMEOUT: z.coerce.number().default(10000),
    ALCHEMY_RETRY_ATTEMPTS: z.coerce.number().default(3),
    ALCHEMY_RETRY_DELAY: z.coerce.number().default(300),
    
    // External API Configuration
    COINGECKO_API_KEY: z.string().optional(),
    COINGECKO_BASE_URL: z.string().default('https://api.coingecko.com/api/v3'),
    COINGECKO_TIMEOUT: z.coerce.number().default(10000),
    
    // Performance Configuration
    ENABLE_CIRCUIT_BREAKER: z.coerce.boolean().default(false),
    RATE_LIMIT_WINDOW: z.coerce.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    CACHE_TTL: z.coerce.number().default(300),
    CACHE_MAX_SIZE: z.coerce.number().default(1000),
    ENABLE_CACHE_WARMING: z.coerce.boolean().default(false),
    
    // Monitoring Configuration
    MONITORING_ENABLE_HEALTH_CHECKS: z.coerce.boolean().default(false),
    MONITORING_HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
    MONITORING_METRICS_INTERVAL: z.coerce.number().default(15000),
    MONITORING_ENABLE_PROMETHEUS: z.coerce.boolean().default(false),
    MONITORING_PROMETHEUS_PORT: z.coerce.number().default(9090),
    MONITORING_MEMORY_THRESHOLD: z.coerce.number().default(85),
    MONITORING_CPU_THRESHOLD: z.coerce.number().default(90),
    MONITORING_FAILURE_RATE_THRESHOLD: z.coerce.number().default(20),
    MONITORING_RESPONSE_TIME_THRESHOLD: z.coerce.number().default(5000),
    
    // Cache Configuration
    CACHE_CLEANUP_INTERVAL: z.coerce.number().default(60000),
  }));

export type SyncWorkerConfig = z.infer<typeof SyncWorkerConfigSchema>;

// Create config instance with custom schema
let configManager: any;
try {
  configManager = createConfig(SyncWorkerConfigSchema);
} catch (error) {
  console.error('Failed to create config manager:', error);
  process.exit(1);
}

// Worker-specific configuration
export const workerConfig: WorkerConfig = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
  maxJobs: parseInt(process.env.WORKER_MAX_JOBS || '100'),
  timeout: parseInt(process.env.WORKER_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.WORKER_RETRIES || '3'),
  retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '5000'), // 5 seconds
  backoffMultiplier: parseFloat(process.env.WORKER_BACKOFF_MULTIPLIER || '2.0'),
  circuitBreakerThreshold: parseInt(process.env.WORKER_CIRCUIT_BREAKER_THRESHOLD || '5'),
  circuitBreakerTimeout: parseInt(process.env.WORKER_CIRCUIT_BREAKER_TIMEOUT || '60000'), // 1 minute
  batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '50'),
  rateLimitWindow: parseInt(process.env.WORKER_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  rateLimitMax: parseInt(process.env.WORKER_RATE_LIMIT_MAX || '5'),
  cleanupInterval: parseInt(process.env.WORKER_CLEANUP_INTERVAL || '300000'), // 5 minutes
  statsInterval: parseInt(process.env.WORKER_STATS_INTERVAL || '30000'), // 30 seconds
  // Periodic sync configuration
  periodicSyncEnabled: process.env.PERIODIC_SYNC_ENABLED !== 'false',
  periodicSyncMarketHoursInterval: parseInt(process.env.PERIODIC_SYNC_MARKET_HOURS_INTERVAL || '300000'), // 5 minutes
  periodicSyncOffHoursInterval: parseInt(process.env.PERIODIC_SYNC_OFF_HOURS_INTERVAL || '900000'), // 15 minutes
  periodicSyncStaleThreshold: parseInt(process.env.PERIODIC_SYNC_STALE_THRESHOLD || '3600000'), // 1 hour
  periodicSyncBatchSize: parseInt(process.env.PERIODIC_SYNC_BATCH_SIZE || '10')
};

// Cluster configuration
export const clusterConfig: ClusterConfig = {
  mode: (process.env.CLUSTER_MODE as 'auto' | 'manual' | 'single') || 'auto',
  workers: parseInt(process.env.CLUSTER_WORKERS || '4'),
  maxMemory: parseInt(process.env.MAX_MEMORY_USAGE || '512'), // MB
  cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'), // %
  autoScale: process.env.AUTO_SCALE === 'true',
  minWorkers: parseInt(process.env.MIN_WORKERS || '2'),
  maxWorkers: parseInt(process.env.MAX_WORKERS || '10'),
  healthCheckInterval: parseInt(process.env.CLUSTER_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  shutdownTimeout: parseInt(process.env.CLUSTER_SHUTDOWN_TIMEOUT || '30000'), // 30 seconds
  statsInterval: parseInt(process.env.CLUSTER_STATS_INTERVAL || '60000'), // 1 minute
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
  coingecko: {
    ...(process.env.COINGECKO_API_KEY && { apiKey: process.env.COINGECKO_API_KEY }),
    baseUrl: process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3',
    timeout: parseInt(process.env.COINGECKO_TIMEOUT || '10000'),
  },
};

// App configuration
export const appConfig = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
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
  enableHealthChecks: process.env.MONITORING_ENABLE_HEALTH_CHECKS === 'true',
  healthCheckInterval: parseInt(process.env.MONITORING_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  metricsInterval: parseInt(process.env.MONITORING_METRICS_INTERVAL || '15000'), // 15 seconds
  enablePrometheus: process.env.MONITORING_ENABLE_PROMETHEUS === 'true',
  prometheusPort: parseInt(process.env.MONITORING_PROMETHEUS_PORT || '9090'),
  alerting: {
    memoryThreshold: parseInt(process.env.MONITORING_MEMORY_THRESHOLD || '85'), // %
    cpuThreshold: parseInt(process.env.MONITORING_CPU_THRESHOLD || '90'), // %
    failureRateThreshold: parseInt(process.env.MONITORING_FAILURE_RATE_THRESHOLD || '20'), // %
    responseTimeThreshold: parseInt(process.env.MONITORING_RESPONSE_TIME_THRESHOLD || '5000'), // ms
  },
};

// Cache configuration
export const cacheConfig = {
  ttl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000'), // 1 minute
};

// Validation function
export function validateConfig(): void {
  const errors: string[] = [];
  const isDevelopment = appConfig.nodeEnv === 'development';

  // Required configurations (only in production)
  if (!isDevelopment && !alchemyConfig.apiKey) {
    errors.push('ALCHEMY_API_KEY is required in production');
  }

  if (!isDevelopment && (!databaseConfig.password || databaseConfig.password === 'password')) {
    errors.push('DB_PASSWORD must be set and not be the default value in production');
  }

  // Range validations
  if (workerConfig.concurrency < 1 || workerConfig.concurrency > 50) {
    errors.push('WORKER_CONCURRENCY must be between 1 and 50');
  }

  if (clusterConfig.workers < 1 || clusterConfig.workers > 20) {
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
  cache: cacheConfig,
};

// Export the config manager for direct access
export { configManager };

// Validate configuration on module load
validateConfig();

export default config; 