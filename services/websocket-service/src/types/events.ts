/**
 * WebSocket Service Specific Event Types
 * - Kế thừa từ shared infrastructure events
 * - Định nghĩa business-specific event data types
 * - Service-specific event type registry
 */

import {
  EventEnvelope,
  EventMetadata,
  EventFactoryOptions,
  EventHandler,
  EventHandlerContext,
  EventValidationResult,
  DataClassification
} from '@moonx-farm/infrastructure';

// WebSocket Service Event Types
export type WebSocketEventType = 
  | 'price.updated'
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'portfolio.updated'
  | 'trade.executed'
  | 'trade.failed'
  | 'user.connected'
  | 'user.disconnected'
  | 'system.health_check'
  | 'system.error'
  // Sync events from sync-worker
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'user.activity'
  | 'system.alert';

// Service-specific Event Data Types
export interface PriceUpdatedEventData {
  token: string;
  chainId: number;
  price: string;
  priceUsd: string;
  change24h: string;
  volume24h: string;
  marketCap?: string;
  liquidity?: string;
  exchange?: string;
}

export interface OrderCreatedEventData {
  orderId: string;
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutExpected: string;
  chainId: number;
  orderType: 'market' | 'limit' | 'stop';
  status: 'pending';
  slippage?: string;
  deadline?: number;
}

export interface OrderUpdatedEventData {
  orderId: string;
  userId: string;
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'expired';
  amountFilled?: string;
  amountRemaining?: string;
  averagePrice?: string;
  fees?: string;
  reason?: string;
}

export interface OrderCancelledEventData {
  orderId: string;
  userId: string;
  reason: 'user_cancelled' | 'expired' | 'insufficient_balance' | 'system_error';
  cancelledAt: number;
}

export interface PortfolioUpdatedEventData {
  userId: string;
  chainId: number;
  tokens: Array<{
    address: string;
    symbol: string;
    balance: string;
    valueUsd: string;
    change24h?: string;
  }>;
  totalValueUsd: string;
  change24h?: string;
  updateReason: 'trade_executed' | 'price_change' | 'deposit' | 'withdrawal';
}

export interface TradeExecutedEventData {
  tradeId: string;
  orderId: string;
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
  txHash: string;
  executionPrice: string;
  fees: string;
  slippage: string;
  executedAt: number;
}

export interface TradeFailedEventData {
  tradeId: string;
  orderId: string;
  userId: string;
  reason: 'insufficient_liquidity' | 'slippage_exceeded' | 'gas_limit' | 'network_error' | 'unknown';
  error: string;
  failedAt: number;
}

export interface UserConnectedEventData {
  userId: string;
  userAddress: string;
  connectionId: string;
  metadata: {
    userAgent?: string;
    ip?: string;
    origin?: string;
  };
}

export interface UserDisconnectedEventData {
  userId: string;
  connectionId: string;
  reason: 'user_logout' | 'timeout' | 'network_error' | 'server_shutdown';
  duration: number; // Connection duration in ms
}

export interface SystemHealthCheckEventData {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    kafka: boolean;
    redis: boolean;
    auth: boolean;
    database?: boolean;
  };
  metrics: {
    uptime: number;
    connections: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface SystemErrorEventData {
  error: string;
  stack?: string;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers?: string[];
  metadata?: Record<string, any>;
}

// Sync Worker Event Data Types
export interface SyncStartedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  syncType: 'manual' | 'automatic' | 'scheduled';
  chains: string[];
  startedAt: number;
}

export interface SyncCompletedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  processingTime: number;
  tokensSync: number;
  chainsSync: number;
  totalValueUsd: number;
  success: boolean;
  completedAt: number;
}

export interface SyncFailedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  error: string;
  processingTime: number;
  retryCount: number;
  failedAt: number;
}

export interface UserActivityEventData {
  userId: string;
  activityType: 'sync_triggered' | 'portfolio_viewed' | 'manual_sync';
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface SystemAlertEventData {
  alertType: 'high_error_rate' | 'service_degradation' | 'maintenance';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

// WebSocket Service Event Registry
export interface WebSocketEventTypes {
  'price.updated': PriceUpdatedEventData;
  'order.created': OrderCreatedEventData;
  'order.updated': OrderUpdatedEventData;
  'order.cancelled': OrderCancelledEventData;
  'portfolio.updated': PortfolioUpdatedEventData;
  'trade.executed': TradeExecutedEventData;
  'trade.failed': TradeFailedEventData;
  'user.connected': UserConnectedEventData;
  'user.disconnected': UserDisconnectedEventData;
  'system.health_check': SystemHealthCheckEventData;
  'system.error': SystemErrorEventData;
  // Sync events
  'sync.started': SyncStartedEventData;
  'sync.completed': SyncCompletedEventData;
  'sync.failed': SyncFailedEventData;
  'user.activity': UserActivityEventData;
  'system.alert': SystemAlertEventData;
}

// Type-safe event types using shared envelope
export type PriceUpdatedEvent = EventEnvelope<PriceUpdatedEventData>;
export type OrderCreatedEvent = EventEnvelope<OrderCreatedEventData>;
export type OrderUpdatedEvent = EventEnvelope<OrderUpdatedEventData>;
export type OrderCancelledEvent = EventEnvelope<OrderCancelledEventData>;
export type PortfolioUpdatedEvent = EventEnvelope<PortfolioUpdatedEventData>;
export type TradeExecutedEvent = EventEnvelope<TradeExecutedEventData>;
export type TradeFailedEvent = EventEnvelope<TradeFailedEventData>;
export type UserConnectedEvent = EventEnvelope<UserConnectedEventData>;
export type UserDisconnectedEvent = EventEnvelope<UserDisconnectedEventData>;
export type SystemHealthCheckEvent = EventEnvelope<SystemHealthCheckEventData>;
export type SystemErrorEvent = EventEnvelope<SystemErrorEventData>;
// Sync events
export type SyncStartedEvent = EventEnvelope<SyncStartedEventData>;
export type SyncCompletedEvent = EventEnvelope<SyncCompletedEventData>;
export type SyncFailedEvent = EventEnvelope<SyncFailedEventData>;
export type UserActivityEvent = EventEnvelope<UserActivityEventData>;
export type SystemAlertEvent = EventEnvelope<SystemAlertEventData>;

// Union type for all WebSocket service events
export type WebSocketEvent = 
  | PriceUpdatedEvent
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderCancelledEvent
  | PortfolioUpdatedEvent
  | TradeExecutedEvent
  | TradeFailedEvent
  | UserConnectedEvent
  | UserDisconnectedEvent
  | SystemHealthCheckEvent
  | SystemErrorEvent
  // Sync events
  | SyncStartedEvent
  | SyncCompletedEvent
  | SyncFailedEvent
  | UserActivityEvent
  | SystemAlertEvent;

// Re-export shared types for convenience
export type {
  EventEnvelope,
  EventMetadata,
  EventFactoryOptions,
  EventHandler,
  EventHandlerContext,
  EventValidationResult,
  DataClassification
}; 