/**
 * Core domain types for MoonXFarm DEX
 */

// =====================
// Blockchain Types
// =====================

export type ChainId = 8453 | 84532 | 56 | 97; // Base Mainnet, Base Sepolia, BSC Mainnet, BSC Testnet

export interface NetworkConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: ChainId;
  logoUri?: string;
  coingeckoId?: string;
}

// =====================
// User & Wallet Types
// =====================

export interface User {
  id: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface SmartWallet {
  id: string;
  userId: string;
  address: string;
  chainId: ChainId;
  factory: string;
  implementation: string;
  salt: string;
  isDeployed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionKey {
  id: string;
  walletId: string;
  keyAddress: string;
  permissions: string[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

// =====================
// Order & Trading Types
// =====================

export type OrderType = 'market' | 'limit' | 'dca';
export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'expired' | 'failed';
export type OrderSide = 'buy' | 'sell';

export interface BaseOrder {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: ChainId;
  type: OrderType;
  status: OrderStatus;
  side: OrderSide;
  
  // Token information
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string; // BigNumber string
  amountOut?: string; // BigNumber string
  
  // Execution data
  executedAt?: Date;
  transactionHash?: string;
  gasUsed?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface MarketOrder extends BaseOrder {
  type: 'market';
  slippage: number; // Percentage
  deadline: Date;
}

export interface LimitOrder extends BaseOrder {
  type: 'limit';
  price: string; // Target price
  expiresAt?: Date;
}

export interface DCAOrder extends BaseOrder {
  type: 'dca';
  frequency: number; // Seconds between executions
  totalExecutions: number;
  executedCount: number;
  nextExecutionAt: Date;
  isActive: boolean;
}

export type Order = MarketOrder | LimitOrder | DCAOrder;

// =====================
// Quote & Swap Types
// =====================

export interface QuoteRequest {
  chainId: ChainId;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage?: number;
  userAddress?: string;
}

export interface QuoteResponse {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  priceImpact: number;
  fee: string;
  gas: string;
  route: RouteStep[];
  aggregator: string;
  validUntil: Date;
}

export interface RouteStep {
  protocol: string;
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  fee?: string;
}

export interface SwapRequest {
  quote: QuoteResponse;
  userAddress: string;
  deadline?: Date;
  referrer?: string;
}

export interface SwapResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  quote: QuoteResponse;
}

// =====================
// Position & Portfolio Types
// =====================

export interface Position {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: ChainId;
  token: TokenInfo;
  amount: string;
  value: string; // USD value
  cost: string; // Original cost in USD
  pnl: string; // Profit/Loss in USD
  pnlPercentage: number;
  updatedAt: Date;
}

export interface Portfolio {
  userId: string;
  totalValue: string; // USD
  totalPnl: string; // USD
  totalPnlPercentage: number;
  positions: Position[];
  updatedAt: Date;
}

// =====================
// Notification Types
// =====================

export type NotificationType = 
  | 'order_filled'
  | 'order_cancelled'
  | 'order_expired'
  | 'price_alert'
  | 'portfolio_update'
  | 'system_alert';

export type NotificationChannel = 'websocket' | 'email' | 'push';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationSubscription {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  isActive: boolean;
  config?: Record<string, any>;
  createdAt: Date;
}

// =====================
// Event Types (Kafka)
// =====================

export interface BaseEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
}

export interface OrderEvent extends BaseEvent {
  type: 'order.created' | 'order.updated' | 'order.filled' | 'order.cancelled';
  data: {
    orderId: string;
    userId: string;
    walletAddress: string;
    order: Order;
    previousStatus?: OrderStatus;
  };
}

export interface PriceEvent extends BaseEvent {
  type: 'price.updated';
  data: {
    chainId: ChainId;
    token: string;
    price: string;
    change24h: number;
    volume24h: string;
    marketCap?: string;
  };
}

export interface UserEvent extends BaseEvent {
  type: 'user.created' | 'user.signed_in' | 'user.signed_out';
  data: {
    userId: string;
    address: string;
    metadata?: Record<string, any>;
  };
}

export interface TransactionEvent extends BaseEvent {
  type: 'transaction.pending' | 'transaction.confirmed' | 'transaction.failed';
  data: {
    userId: string;
    walletAddress: string;
    chainId: ChainId;
    hash: string;
    type: 'swap' | 'transfer' | 'approve';
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed?: string;
    gasPrice?: string;
  };
}

export type SystemEvent = OrderEvent | PriceEvent | UserEvent | TransactionEvent;

// =====================
// API Response Types
// =====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    timestamp: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: string[];
  type?: string[];
  chainId?: ChainId[];
  dateFrom?: string;
  dateTo?: string;
}

// =====================
// Utility Types
// =====================

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}; 