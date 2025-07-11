import { WebSocket } from 'ws';
import { FastifyRequest } from 'fastify';

// Base WebSocket message structure
export interface WebSocketMessage {
  id: string;
  type: string;
  timestamp: number;
  data: any;
}

// WebSocket client connection information
export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  userId: string;
  userAddress: string;
  connectedAt: number;
  lastPing: number;
  subscriptions: Set<string>;
  metadata: {
    userAgent?: string;
    ip?: string;
    origin?: string;
  };
}

// WebSocket connection context
export interface WebSocketContext {
  client: WebSocketClient;
  request: FastifyRequest;
}

// Message types for different data streams
export type MessageType = 
  | 'price_update'
  | 'order_update'
  | 'portfolio_update'
  | 'trade_update'
  | 'sync_update'
  | 'chain_stats_update'
  | 'bridge_stats_update'
  | 'stats_overview_update'
  | 'heartbeat'
  | 'error'
  | 'subscribe'
  | 'unsubscribe'
  | 'auth_required'
  | 'auth_success'
  | 'auth_failed';

// Subscription channel types
export type SubscriptionChannel = 
  | 'prices'
  | 'orders'
  | 'portfolio'
  | 'trades'
  | 'user_specific'
  | 'chain_stats'
  | 'bridge_stats'
  | 'stats_overview';

// Price update message structure
export interface PriceUpdateMessage {
  token: string;
  chainId: number;
  price: string;
  priceUsd: string;
  change24h: string;
  volume24h: string;
  timestamp: number;
}

// Order update message structure
export interface OrderUpdateMessage {
  orderId: string;
  userId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut?: string;
  chainId: number;
  timestamp: number;
}

// Portfolio update message structure
export interface PortfolioUpdateMessage {
  userId: string;
  chainId: number;
  tokens: Array<{
    address: string;
    symbol: string;
    balance: string;
    valueUsd: string;
  }>;
  totalValueUsd: string;
  timestamp: number;
}

// Trade update message structure
export interface TradeUpdateMessage {
  tradeId: string;
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
  txHash: string;
  timestamp: number;
}

// Chain stats update message structure
export interface ChainStatsUpdateMessage {
  chainId: number;
  chainName: string;
  stats: {
    blockNumber: number;
    gasPrice: string;
    avgBlockTime: number;
    tps: number;
    pendingTransactions: number;
  };
  timestamp: number;
  source: string;
}

// Bridge stats update message structure
export interface BridgeStatsUpdateMessage {
  provider: string;
  stats: {
    avgLatency: number;
    successRate: number;
    totalVolume: string;
    totalTransactions: number;
    healthScore: number;
  };
  timestamp: number;
  source: string;
}

// Stats overview update message structure
export interface StatsOverviewUpdateMessage {
  overview: {
    totalValueLocked: string;
    totalTransactions: number;
    activeUsers: number;
    chainPerformance: Array<{
      chainId: number;
      chainName: string;
      blockNumber: number;
      gasPrice: string;
      avgBlockTime: number;
      tps: number;
      pendingTransactions: number;
    }>;
    bridgeLatency: Array<{
      provider: string;
      avgLatency: number;
      successRate: number;
      totalVolume: string;
      totalTransactions: number;
      healthScore: number;
    }>;
    healthStatus: 'healthy' | 'warning' | 'unhealthy';
    lastUpdated: number;
  };
  chainCount: number;
  bridgeCount: number;
  healthStatus: 'healthy' | 'warning' | 'unhealthy';
  lastUpdated: number;
  timestamp: number;
  source: string;
}

// WebSocket message handlers
export interface MessageHandler {
  (message: WebSocketMessage, context: WebSocketContext): Promise<void>;
}

// Rate limiting configuration
export interface RateLimitConfig {
  enabled: boolean;
  maxConnectionsPerIp: number;
  windowSize: number;
  maxMessagesPerMinute: number;
}

// WebSocket service configuration
export interface WebSocketServiceConfig {
  port: number;
  host: string;
  maxConnections: number;
  pingInterval: number;
  pongTimeout: number;
  heartbeatInterval: number;
  rateLimit: RateLimitConfig;
  auth: {
    serviceUrl: string;
    verifyEndpoint: string;
    timeout: number;
  };
  kafka: {
    brokers: string;
    clientId: string;
    consumerGroup: string;
    topics: {
      prices: string;
      orders: string;
      portfolio: string;
      trades: string;
    };
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  cors: {
    origin: string;
    credentials: boolean;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
}

// Connection manager interface
export interface ConnectionManager {
  addConnection(client: WebSocketClient): Promise<void>;
  removeConnection(clientId: string): Promise<void>;
  getConnection(clientId: string): WebSocketClient | null;
  getConnectionsByUserId(userId: string): WebSocketClient[];
  getConnectionCount(): number;
  broadcast(message: WebSocketMessage, filter?: (client: WebSocketClient) => boolean): Promise<void>;
  sendToUser(userId: string, message: WebSocketMessage): Promise<void>;
  sendToSubscribers(channel: SubscriptionChannel, message: WebSocketMessage): Promise<void>;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  userId?: string;
  userAddress?: string;
  error?: string;
}

// Subscription request
export interface SubscriptionRequest {
  channel: SubscriptionChannel;
  params?: Record<string, any>;
}

// WebSocket service metrics
export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  messagesReceived: number;
  authenticationAttempts: number;
  authenticationFailures: number;
  subscriptions: Record<string, number>;
  uptime: number;
  pendingAuth?: number;
}

// Error types
export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
}

// Health check result
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  services: {
    redis: boolean;
    kafka: boolean;
    auth: boolean;
  };
  metrics: WebSocketMetrics;
}

// Event emitter events
export interface WebSocketEvents {
  'client:connected': (client: WebSocketClient) => void;
  'client:disconnected': (clientId: string) => void;
  'client:authenticated': (client: WebSocketClient) => void;
  'message:received': (message: WebSocketMessage, context: WebSocketContext) => void;
  'message:sent': (message: WebSocketMessage, clientId: string) => void;
  'subscription:added': (clientId: string, channel: SubscriptionChannel) => void;
  'subscription:removed': (clientId: string, channel: SubscriptionChannel) => void;
  'error': (error: WebSocketError, context?: WebSocketContext) => void;
}

// Export JSON-RPC types from shared package
export * from '@moonx-farm/shared';

// Export MoonX Farm specific types
export * from './moonxTypes';

// Kafka message structure
export interface KafkaMessage<T = any> {
  topic: string;
  partition: number;
  offset: string;
  key?: string;
  value: T;
  timestamp: string;
  headers?: Record<string, string>;
}

// Data stream handlers
export interface DataStreamHandler<T = any> {
  (data: T, context: { topic: string; partition: number; offset: string }): Promise<void>;
} 