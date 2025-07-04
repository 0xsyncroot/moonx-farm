// Core Service Types

export interface User {
  id: string;
  privyId: string;
  walletAddress: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  userId: string;
  txHash: string;
  chainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountUSD: number;
  toAmountUSD: number;
  provider: string;
  slippage: number;
  priceImpact: number;
  gasUsed: string;
  gasPrice: string;
  gasFeeUSD: number;
  status: TradeStatus;
  executedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum TradeStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Portfolio {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: number;
  totalValueUSD: number;
  holdings: TokenHolding[];
  lastSynced: Date;
  syncStatus: 'syncing' | 'completed' | 'error';
}

export interface Position {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: number;
  balance: string;
  avgBuyPrice: number;
  currentPrice: number;
  valueUSD: number;
  pnlUSD: number;
  pnlPercentage: number;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  txHash: string;
  chainId: number;
  type: TransactionType;
  status: TransactionStatus;
  gasUsed?: string;
  gasPrice?: string;
  gasFeeUSD?: number;
  blockNumber?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  SWAP = 'swap',
  APPROVE = 'approve',
  TRANSFER = 'transfer',
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export interface Analytics {
  userId: string;
  totalTrades: number;
  totalVolumeUSD: number;
  totalFeesUSD: number;
  totalPnlUSD: number;
  avgTradeSize: number;
  favoriteTokens: string[];
  topChains: ChainUsage[];
  monthlyStats: MonthlyStats[];
  updatedAt: Date;
}

export interface ChainUsage {
  chainId: number;
  chainName: string;
  tradeCount: number;
  volumeUSD: number;
  percentage: number;
}

export interface MonthlyStats {
  month: string;
  tradeCount: number;
  volumeUSD: number;
  feesUSD: number;
  pnlUSD: number;
}

export interface UserConfig {
  userId: string;
  slippageTolerance: number;
  gasMode: 'slow' | 'standard' | 'fast';
  defaultChainId: number;
  enableNotifications: boolean;
  enableAnalytics: boolean;
  preferredCurrency: string;
  theme: 'light' | 'dark' | 'auto';
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TradeFilters extends PaginationQuery {
  chainId?: number;
  fromToken?: string;
  toToken?: string;
  status?: TradeStatus;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PortfolioFilters {
  chainIds?: number[];
  minValueUSD?: number;
  hideSmallBalances?: boolean;
  hideSpamTokens?: boolean;
  sortBy?: 'value' | 'symbol' | 'balance';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters extends PaginationQuery {
  chainId?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
}

// Real Portfolio Holdings
export interface TokenHolding {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: string; // Raw balance in token units
  balanceFormatted: number; // Human readable balance
  priceUSD: number;
  valueUSD: number;
  lastUpdated: Date;
  // From Alchemy API
  alchemyData?: {
    logo?: string;
    thumbnail?: string;
    isSpam: boolean;
    possibleSpam: boolean;
  };
}

// Real Trade Tracking (read-only)
export interface RealTrade {
  id: string;
  userId: string;
  walletAddress: string;
  txHash: string;
  chainId: number;
  blockNumber: number;
  timestamp: Date;
  
  // Trade details
  type: 'swap' | 'limit_order' | 'dca' | 'bridge';
  status: 'pending' | 'completed' | 'failed';
  
  // Token details
  fromToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    amount: string; // Raw amount
    amountFormatted: number;
    priceUSD: number;
    valueUSD: number;
  };
  
  toToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    amount: string; // Raw amount  
    amountFormatted: number;
    priceUSD: number;
    valueUSD: number;
  };
  
  // Financial details
  gasFeeETH: number;
  gasFeeUSD: number;
  protocolFeeUSD?: number;
  slippage?: number;
  priceImpact?: number;
  
  // DEX/Protocol info
  dexName?: string;
  routerAddress?: string;
  aggregator?: 'lifi' | '1inch' | 'relay' | 'jupiter';
  
  // P&L calculation
  pnl?: {
    realizedPnlUSD: number; // P&L from this specific trade
    unrealizedPnlUSD?: number; // Current P&L if still holding
    feesPaidUSD: number; // Total fees
    netPnlUSD: number; // Realized P&L - fees
  };
}

// P&L Analytics
export interface PnLSummary {
  userId: string;
  timeframe: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  
  // Trading metrics
  totalTrades: number;
  totalVolumeUSD: number;
  totalFeesUSD: number;
  
  // P&L metrics
  realizedPnlUSD: number;
  unrealizedPnlUSD: number;
  netPnlUSD: number;
  
  // Performance metrics
  winRate: number; // % of profitable trades
  avgTradeSize: number;
  biggestWinUSD: number;
  biggestLossUSD: number;
  
  // Portfolio metrics
  currentPortfolioValueUSD: number;
  portfolioChangeUSD: number;
  portfolioChangePercent: number;
  
  lastCalculated: Date;
}

// Token Price Cache
export interface TokenPrice {
  tokenAddress: string;
  chainId: number;
  symbol: string;
  priceUSD: number;
  priceChange24h: number;
  marketCap?: number;
  volume24h?: number;
  lastUpdated: Date;
  source: 'alchemy' | 'coingecko' | 'dexscreener';
}

// Sync Operations
export interface SyncOperation {
  id: string;
  userId: string;
  walletAddress: string;
  type: 'portfolio' | 'trades' | 'full'; // Fix: match database constraint values
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'; // Fix: match database constraint values
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: {
    chainsCount?: number;
    tokensCount?: number;
    tradesCount?: number;
  };
}

// API Request/Response types
export interface PortfolioSyncRequest {
  walletAddress: string;
  chainIds?: number[]; // If not provided, sync all supported chains
  forceRefresh?: boolean; // Skip cache and force fresh data
}

export interface PnLRequest {
  timeframe: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  walletAddress?: string; // If not provided, use authenticated user's wallet
}

export interface PortfolioFilters {
  chainIds?: number[];
  minValueUSD?: number;
  hideSmallBalances?: boolean; // Hide balances < $1
  hideSpamTokens?: boolean;
  sortBy?: 'value' | 'symbol' | 'balance';
  sortOrder?: 'asc' | 'desc';
}

// Pagination for responses
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Export Fastify type extensions
export * from './fastify'; 