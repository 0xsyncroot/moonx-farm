// =================================
// Sync Worker Types & Interfaces
// =================================

export interface SyncJob {
  id: string;
  type: 'portfolio' | 'trades' | 'metadata' | 'batch' | 'chain';
  priority: 'high' | 'medium' | 'low';
  userId: string;
  walletAddress: string;
  chainIds?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  error?: string;
  result?: any;
}

export interface SyncJobData {
  userId: string;
  walletAddress: string;
  chainIds?: string[];
  forceRefresh?: boolean;
  batchSize?: number;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export interface SyncJobResult {
  success: boolean;
  jobId: string;
  userId: string;
  walletAddress: string;
  processingTime: number;
  tokensSync: number;
  chainsSync: number;
  totalValueUsd: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BatchSyncJob {
  id: string;
  type: 'batch';
  jobs: SyncJobData[];
  priority: 'high' | 'medium' | 'low';
  batchSize: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface WorkerConfig {
  concurrency: number;
  maxJobs: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  backoffMultiplier: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  batchSize: number;
  cleanupInterval: number;
  statsInterval: number;
  // Periodic sync configuration
  periodicSyncEnabled: boolean;
  periodicSyncMarketHoursInterval: number;
  periodicSyncOffHoursInterval: number;
  periodicSyncStaleThreshold: number;
  periodicSyncBatchSize: number;
  periodicSyncMaxUsers: number;
}

export interface WorkerStats {
  workerId: string;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalJobs: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  queueSize: number;
  lastProcessedAt?: Date;
  errors: WorkerError[];
}

export interface WorkerError {
  jobId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
  userId?: string;
  walletAddress?: string;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface ClusterConfig {
  mode: 'auto' | 'manual' | 'single';
  workers: number;
  maxMemory: number;
  cpuThreshold: number;
  autoScale: boolean;
  minWorkers: number;
  maxWorkers: number;
  healthCheckInterval: number;
  shutdownTimeout: number;
  statsInterval: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  queueHealth: QueueStats[];
  workerHealth: WorkerStats[];
  lastCheck: Date;
  errors: string[];
}

export interface MetricsData {
  timestamp: Date;
  jobsProcessed: number;
  avgProcessingTime: number;
  errorRate: number;
  queueSize: number;
  workerUtilization: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Database Models
export interface SyncOperation {
  id: string;
  userId: string;
  walletAddress: string;
  type: 'portfolio' | 'trades' | 'metadata' | 'batch' | 'chain';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  tokensSync?: number;
  chainsSync?: number;
  totalValueUsd?: number;
  error?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface UserTokenHolding {
  id: string;
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  chainId: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  valueUsd: number;
  logoUrl?: string;
  metadata?: Record<string, any>;
  lastUpdated: Date;
}

export interface TokenMetadata {
  address: string;
  chainId: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  marketCap?: number;
  totalSupply?: string;
  verified?: boolean;
  metadata?: Record<string, any>;
}

export interface PriceData {
  tokenAddress: string;
  chainId: string;
  priceUsd: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  source: 'binance' | 'coingecko' | 'dexscreener' | 'fallback';
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface SyncTriggerResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  estimatedTime?: number;
  rateLimitInfo?: {
    remainingRequests: number;
    resetTime?: Date;
  };
}

// Circuit Breaker Types
export interface CircuitBreakerState {
  state: 'open' | 'closed' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

// Configuration Types
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
  maxRetriesPerRequest: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  max: number;
  min: number;
  idle: number;
}

export interface AlchemyConfig {
  apiKey: string;
  webhookId?: string;
  webhookSigningKey?: string;
  rateLimitRpm: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ExternalApiConfig {
  binance?: {
    apiKey?: string;
    apiSecret?: string;
    baseUrl: string;
    timeout: number;
  };
  coingecko: {
    apiKey?: string;
    baseUrl: string;
    timeout: number;
  };
  dexscreener?: {
    apiKey?: string;
    baseUrl: string;
    timeout: number;
  };
}

// Export all types
export type JobType = 'portfolio' | 'trades' | 'metadata' | 'batch' | 'chain';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';
export type WorkerState = 'healthy' | 'unhealthy' | 'degraded';
export type CircuitState = 'closed' | 'open' | 'half-open'; 