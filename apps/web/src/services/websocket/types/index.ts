export interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: number;
}

export interface TradeNotification {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  value: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
}

export interface PortfolioUpdate {
  totalValue: number;
  change24h: number;
  tokens: Array<{
    symbol: string;
    balance: number;
    value: number;
    change24h: number;
  }>;
  timestamp: number;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  actionUrl?: string;
}

export interface ChainPerformanceStats {
  chainId: number;
  chainName: string;
  blockTime: {
    current: number;
    change: string;
    changePercent: number;
    timestamp: number;
  };
  volume24h: string;
  volumeUSD: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  updatedAt: string;
}

export interface BridgeLatencyStats {
  provider: 'LI.FI' | 'Relay.link' | '1inch';
  latency: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  route?: string;
  fromChain?: number;
  toChain?: number;
  error?: string;
  updatedAt: string;
}

export interface StatsOverview {
  chainPerformance: ChainPerformanceStats[];
  bridgeLatency: BridgeLatencyStats[];
  lastUpdated: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface OrderUpdate {
  orderId: string;
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  timestamp: number;
}

export interface NotificationConfig {
  enablePriceAlerts: boolean;
  enableTradeNotifications: boolean;
  enablePortfolioUpdates: boolean;
  enableSystemAlerts: boolean;
  enableStatsUpdates: boolean;
  enableChainPerformanceAlerts: boolean;
  enableBridgeLatencyAlerts: boolean;
  offlineNotifications: boolean;
}

export interface ConnectionStatus {
  websocket: 'connected' | 'disconnected' | 'connecting';
  firebase: 'ready' | 'error' | 'requesting-permission';
  online: boolean;
}

// JSON-RPC Methods for MoonX Farm
export const JsonRpcMethods = {
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTH_REQUIRED: 'auth_required',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILED: 'auth_failed',
  
  // Subscription
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  UNSUBSCRIBED: 'unsubscribed',
  AUTO_SUBSCRIBED: 'auto_subscribed',
  
  // Real-time data
  PRICE_UPDATE: 'price_update',
  ORDER_UPDATE: 'order_update',
  PORTFOLIO_UPDATE: 'portfolio_update',
  TRADE_UPDATE: 'trade_update',
  NOTIFICATION: 'notification',
  SYSTEM_ALERT: 'system_alert',
  
  // Stats Worker events
  STATS_CHAIN_PERFORMANCE_UPDATED: 'stats.chain_performance_updated',
  STATS_BRIDGE_LATENCY_UPDATED: 'stats.bridge_latency_updated',
  STATS_OVERVIEW_UPDATED: 'stats.overview_updated',
  
  // Connection
  HEARTBEAT: 'heartbeat',
  PONG: 'pong',
  
  // Error handling
  ERROR: 'error'
} as const;

export type JsonRpcMethod = typeof JsonRpcMethods[keyof typeof JsonRpcMethods];

export interface QueuedMessage {
  type: string;
  data: any;
}

export interface WebSocketConfig {
  websocketUrl: string;
  jwtToken: string;
  userId?: string | null;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface StatsSubscriptionOptions {
  chainIds?: number[];
  bridgeProviders?: Array<'LI.FI' | 'Relay.link' | '1inch'>;
  enableChainPerformance?: boolean;
  enableBridgeLatency?: boolean;
  enableOverview?: boolean;
} 