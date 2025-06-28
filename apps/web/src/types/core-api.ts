// Core Service API Response Types

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
}

// Portfolio Types
export interface TokenHolding {
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  chainId: number
  balance: string
  balanceFormatted: string
  valueUSD: number
  priceUSD: number
  logoUrl?: string
  isSpam: boolean
}

export interface Portfolio {
  totalValueUSD: number
  holdings: TokenHolding[]
  lastSynced: string
}

export interface QuickPortfolio {
  totalValueUSD: number
  holdingsCount: number
  topHoldings: TokenHolding[]
  lastSynced: string
  status: 'ready' | 'syncing'
}

// P&L Types
export interface PnLData {
  timeframe: string
  realizedPnlUSD: number
  unrealizedPnlUSD: number
  netPnlUSD: number
  totalFeesUSD: number
  winRate: number
  totalTrades: number
  profitableTrades: number
  currentPortfolioValueUSD: number
  portfolioChangePercent: number
  biggestWinUSD: number
  biggestLossUSD: number
}

export interface PortfolioAnalytics {
  pnl: PnLData
  analytics: {
    topTokens: TokenHolding[]
  }
  summary: {
    totalPortfolioValue: number
    totalTokens: number
    lastUpdated: string
  }
}

// Trading History Types
export interface TradeToken {
  symbol: string
  amount: string
  valueUSD: number
}

export interface TradePnL {
  realizedPnlUSD: number
  feesPaidUSD: number
  netPnlUSD: number
}

export interface Trade {
  id: string
  txHash: string
  timestamp: string
  chainId: number
  type: string
  status: string
  fromToken: TradeToken
  toToken: TradeToken
  gasFeeETH: number
  gasFeeUSD: number
  dexName: string
  slippage: number
  pnl?: TradePnL
}

export interface TradesResponse {
  trades: Trade[]
  count: number
  filters: {
    limit: number
    days: number
    chainIds: number[]
  }
}

// Order Types
export interface Order {
  orderId: string
  type: 'LIMIT' | 'DCA'
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED'
  walletAddress: string
  chainId: number
  fromToken: string
  toToken: string
  fromAmount: string
  targetPrice?: string
  frequency?: string
  maxExecutions?: number
  executionCount: number
  createdAt: string
  updatedAt: string
  cancelledAt?: string
}

export interface OrderExecution {
  executionId: string
  executionIndex: number
  transactionHash: string
  outputAmount: string
  gasUsed: number
  gasPriceGwei: number
  executedAt: string
}

export interface OrderDetails {
  order: Order
  executions: OrderExecution[]
}

export interface OrdersResponse {
  orders: Order[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface OrderStats {
  total: number
  active: number
  completed: number
  cancelled: number
  totalVolume: string
  avgOrderSize: string
  successRate: number
}

// Sync Status Types
export interface SyncStats {
  totalSyncsToday: number
  activeSyncs: number
  avgSyncTimeSeconds: number
  syncQueues: {
    triggered: number
    scheduled: number
    stale: number
  }
  lastProcessedAt: string
}

// Health Check Types
export interface HealthCheck {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  checks: {
    database: {
      status: 'healthy' | 'unhealthy'
      responseTime: number
    }
    redis: {
      status: 'healthy' | 'unhealthy'
      responseTime: number
    }
    alchemy: {
      status: 'healthy' | 'unhealthy'
      responseTime: number
    }
  }
} 