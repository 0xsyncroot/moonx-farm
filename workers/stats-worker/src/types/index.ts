// Chain performance stats
export interface ChainPerformanceStats {
  chainId: number;
  chainName: string;
  chainSlug: string;
  logoUrl: string;
  blockTime: {
    current: number;
    change: string;
    changePercent: number;
    timestamp: number;
  };
  volume24h: string;
  volumeUSD: number;
  defiLlamaSlug: string;
  rpcUrl: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  updatedAt: Date;
}

// Bridge latency stats
export interface BridgeLatencyStats {
  provider: 'LI.FI' | 'Relay.link' | '1inch';
  latency: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  route?: string;
  fromChain?: number;
  toChain?: number;
  error?: string;
  updatedAt: Date;
}

// Overall stats overview
export interface StatsOverview {
  chainPerformance: ChainPerformanceStats[];
  bridgeLatency: BridgeLatencyStats[];
  lastUpdated: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

// Chain configuration
export interface ChainConfig {
  name: string;
  chainId: number;
  chainSlug: string;
  logoUrl: string;
  rpc: string;
  defiLlamaSlug: string;
  enabled: boolean;
}

// Bridge configuration
export interface BridgeConfig {
  name: string;
  provider: string;
  endpoint: string;
  enabled: boolean;
  timeout: number;
}

// Job configuration
export interface JobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
}

// Stats collection result
export interface StatsCollectionResult {
  success: boolean;
  timestamp: number;
  duration: number;
  chainStats: ChainPerformanceStats[];
  bridgeStats: BridgeLatencyStats[];
  errors: string[];
}

// Database document interfaces
export interface ChainStatsDocument extends ChainPerformanceStats {
  _id?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface BridgeStatsDocument extends BridgeLatencyStats {
  _id?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface StatsOverviewDocument extends StatsOverview {
  _id?: string;
  isLatest?: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

// Service configuration
export interface StatsWorkerConfig {
  serviceName: string;
  serviceVersion: string;
  mongodb: {
    uri: string;
    database: string;
    maxPoolSize: number;
    minPoolSize: number;
    enableMetrics: boolean;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topicEvents: string;
  };
  chains: ChainConfig[];
  bridges: BridgeConfig[];
  jobs: JobConfig[];
  apis: {
    defiLlama: string;
    lifi: string;
    lifiApiKey?: string;
    relay: string;
  };
  logging: {
    level: string;
    format: string;
  };
}

// Error types
export class StatsCollectionError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'StatsCollectionError';
  }
}

export class EventPublishError extends Error {
  constructor(
    message: string,
    public readonly eventType: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'EventPublishError';
  }
}

// Utility types
export type StatsType = 'chain_performance' | 'bridge_latency' | 'overview';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// Metrics interface
export interface StatsMetrics {
  collectionsTotal: number;
  collectionsSuccess: number;
  collectionsError: number;
  lastCollectionDuration: number;
  averageCollectionDuration: number;
  eventsPublished: number;
  eventsPublishErrors: number;
  chainStatsCount: number;
  bridgeStatsCount: number;
  lastHealthCheck: Date;
  uptime: number;
} 