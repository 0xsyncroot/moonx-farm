import { EventEnvelope } from '@moonx-farm/infrastructure';
import { JsonRpcRequest, JsonRpcNotification } from '@moonx-farm/shared';
import { ChainPerformanceStats, BridgeLatencyStats, StatsOverview } from './index';

// Stats event types
export type StatsEventType = 
  | 'stats.chain_performance_updated'
  | 'stats.bridge_latency_updated'
  | 'stats.overview_updated'
  | 'stats.health_check'
  | 'stats.collection_started'
  | 'stats.collection_completed'
  | 'stats.collection_failed';

// Event data interfaces
export interface ChainPerformanceUpdatedEventData {
  chainId: number;
  chainName: string;
  stats: ChainPerformanceStats;
  previousStats?: ChainPerformanceStats;
  changeDetected: boolean;
  timestamp: number;
}

export interface BridgeLatencyUpdatedEventData {
  provider: string;
  stats: BridgeLatencyStats;
  previousStats?: BridgeLatencyStats;
  changeDetected: boolean;
  timestamp: number;
}

export interface StatsOverviewUpdatedEventData {
  overview: StatsOverview;
  previousOverview?: StatsOverview;
  changeDetected: boolean;
  timestamp: number;
  summary: {
    totalChains: number;
    healthyChains: number;
    totalBridges: number;
    healthyBridges: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export interface StatsHealthCheckEventData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  metrics: {
    collectionsTotal: number;
    collectionsSuccess: number;
    collectionsError: number;
    lastCollectionDuration: number;
    eventsPublished: number;
  };
  services: {
    mongodb: boolean;
    kafka: boolean;
    chains: Record<string, boolean>;
    bridges: Record<string, boolean>;
  };
}

export interface StatsCollectionStartedEventData {
  collectionId: string;
  timestamp: number;
  jobName: string;
  scope: 'chain_performance' | 'bridge_latency' | 'full';
}

export interface StatsCollectionCompletedEventData {
  collectionId: string;
  timestamp: number;
  duration: number;
  jobName: string;
  scope: 'chain_performance' | 'bridge_latency' | 'full';
  results: {
    chainStats: number;
    bridgeStats: number;
    errors: number;
  };
}

export interface StatsCollectionFailedEventData {
  collectionId: string;
  timestamp: number;
  duration: number;
  jobName: string;
  scope: 'chain_performance' | 'bridge_latency' | 'full';
  error: string;
  retryAttempt: number;
  maxRetries: number;
}

// Type-safe event envelopes
export type ChainPerformanceUpdatedEvent = EventEnvelope<ChainPerformanceUpdatedEventData>;
export type BridgeLatencyUpdatedEvent = EventEnvelope<BridgeLatencyUpdatedEventData>;
export type StatsOverviewUpdatedEvent = EventEnvelope<StatsOverviewUpdatedEventData>;
export type StatsHealthCheckEvent = EventEnvelope<StatsHealthCheckEventData>;
export type StatsCollectionStartedEvent = EventEnvelope<StatsCollectionStartedEventData>;
export type StatsCollectionCompletedEvent = EventEnvelope<StatsCollectionCompletedEventData>;
export type StatsCollectionFailedEvent = EventEnvelope<StatsCollectionFailedEventData>;

// Stats event registry
export interface StatsEventTypes {
  'stats.chain_performance_updated': ChainPerformanceUpdatedEventData;
  'stats.bridge_latency_updated': BridgeLatencyUpdatedEventData;
  'stats.overview_updated': StatsOverviewUpdatedEventData;
  'stats.health_check': StatsHealthCheckEventData;
  'stats.collection_started': StatsCollectionStartedEventData;
  'stats.collection_completed': StatsCollectionCompletedEventData;
  'stats.collection_failed': StatsCollectionFailedEventData;
}

// WebSocket JSON-RPC message types for stats
export interface StatsSubscribeRequest extends JsonRpcRequest {
  method: 'stats.subscribe';
  params: {
    types: StatsEventType[];
    chains?: number[];
    bridges?: string[];
  };
}

export interface StatsUnsubscribeRequest extends JsonRpcRequest {
  method: 'stats.unsubscribe';
  params: {
    types?: StatsEventType[];
    subscriptionId?: string;
  };
}

export interface StatsGetLatestRequest extends JsonRpcRequest {
  method: 'stats.getLatest';
  params: {
    type: 'chain_performance' | 'bridge_latency' | 'overview';
    chainId?: number;
    provider?: string;
  };
}

// WebSocket notification types
export interface StatsNotification extends JsonRpcNotification {
  method: StatsEventType;
  params: {
    eventData: any;
    subscriptionId: string;
    timestamp: number;
  };
}

// Event publishing options
export interface StatsEventPublishOptions {
  subscriptionId?: string;
  targetChains?: number[];
  targetBridges?: string[];
  priority?: 'low' | 'normal' | 'high';
  broadcast?: boolean;
}

// Event subscription management
export interface StatsSubscription {
  id: string;
  userId?: string;
  sessionId?: string;
  types: StatsEventType[];
  chains?: number[];
  bridges?: string[];
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Event filter conditions
export interface StatsEventFilter {
  types?: StatsEventType[];
  chains?: number[];
  bridges?: string[];
  minLatency?: number;
  maxLatency?: number;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  changeThreshold?: number;
}

// Event transformation types
export interface StatsEventTransformOptions {
  includeHistory?: boolean;
  includeComparisons?: boolean;
  includeTrends?: boolean;
  format?: 'full' | 'summary' | 'minimal';
}

// Batch event types
export interface StatsBatchEventData {
  events: Array<{
    type: StatsEventType;
    data: any;
    timestamp: number;
  }>;
  batchId: string;
  totalEvents: number;
  batchTimestamp: number;
}

export type StatsBatchEvent = EventEnvelope<StatsBatchEventData>;

// Event aggregation types
export interface StatsEventAggregation {
  timeWindow: '1m' | '5m' | '15m' | '1h' | '24h';
  aggregations: {
    chainPerformance: Record<number, ChainPerformanceStats>;
    bridgeLatency: Record<string, BridgeLatencyStats>;
    eventCounts: Record<StatsEventType, number>;
    lastUpdated: Date;
  };
}

// Event history types
export interface StatsEventHistory {
  eventType: StatsEventType;
  events: Array<{
    data: any;
    timestamp: number;
    eventId: string;
  }>;
  totalEvents: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
} 