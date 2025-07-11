/**
 * MoonX Farm specific types for WebSocket service
 */

/**
 * WebSocket Method Names for MoonX Farm
 */
export const JsonRpcMethods = {
  // Authentication methods
  AUTHENTICATE: 'authenticate',
  AUTH_REQUIRED: 'auth_required',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILED: 'auth_failed',
  
  // Subscription methods
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  AUTO_SUBSCRIBED: 'auto_subscribed',
  
  // Real-time data methods
  PRICE_UPDATE: 'price_update',
  ORDER_UPDATE: 'order_update',
  PORTFOLIO_UPDATE: 'portfolio_update',
  TRADE_UPDATE: 'trade_update',
  NOTIFICATION: 'notification',
  SYSTEM_ALERT: 'system_alert',
  
  // Connection methods
  HEARTBEAT: 'heartbeat',
  PONG: 'pong',
  
  // Error handling
  ERROR: 'error'
} as const;

/**
 * MoonX Farm Error Codes
 */
export const MoonxErrorCodes = {
  // Custom application errors
  AUTH_REQUIRED: -32001,
  AUTH_FAILED: -32002,
  AUTH_TIMEOUT: -32003,
  RATE_LIMITED: -32004,
  SUBSCRIPTION_FAILED: -32005,
  INVALID_CHANNEL: -32006,
  CONNECTION_ERROR: -32007,
  METHOD_NOT_FOUND: -32008,
  UNSUPPORTED_OPERATION: -32009,
  INTERNAL_ERROR: -32010,
  INVALID_PARAMS: -32011
} as const;

/**
 * Authentication Request Params
 */
export interface AuthenticateParams {
  token: string;
}

/**
 * Authentication Success Result
 */
export interface AuthenticationResult {
  clientId: string;
  userId: string;
  userAddress: string;
  message: string;
}

/**
 * Subscription Request Params
 */
export interface SubscriptionParams {
  channel: string;
  params?: Record<string, any>;
}

/**
 * Subscription Result
 */
export interface SubscriptionResult {
  channel: string;
  subscribed: boolean;
  timestamp: number;
}

/**
 * Auto-subscription Result
 */
export interface AutoSubscriptionResult {
  message: string;
  globalChannels: string[];
  userChannels: string[];
  totalChannels: number;
}

/**
 * Price Update Params
 */
export interface PriceUpdateParams {
  token: string;
  chainId: number;
  price: string;
  priceUsd: string;
  change24h: string;
  volume24h: string;
  timestamp: number;
}

/**
 * Order Update Params
 */
export interface OrderUpdateParams {
  orderId: string;
  userId: string;
  status: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
  timestamp: number;
}

/**
 * Portfolio Update Params
 */
export interface PortfolioUpdateParams {
  userId: string;
  tokens: Array<{
    token: string;
    balance: string;
    valueUsd: string;
  }>;
  totalValueUsd: string;
  timestamp: number;
}

/**
 * Trade Update Params
 */
export interface TradeUpdateParams {
  tradeId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  price: string;
  chainId: number;
  timestamp: number;
  txHash?: string;
}

/**
 * Notification Params
 */
export interface NotificationParams {
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  data?: any;
}

/**
 * System Alert Params
 */
export interface SystemAlertParams {
  type: 'maintenance' | 'update' | 'warning' | 'error';
  message: string;
  timestamp: number;
  data?: any;
}

/**
 * Heartbeat Params
 */
export interface HeartbeatParams {
  timestamp: number;
  clientTime?: number;
} 