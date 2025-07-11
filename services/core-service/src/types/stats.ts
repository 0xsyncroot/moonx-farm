// Stats data types for chain performance and bridge latency tracking

export interface ChainPerformanceStats {
  // Basic chain info
  chainId: number;
  chainName: string;
  chainSymbol: string;
  
  // Block information
  blockNumber: number;
  blockTime: number; // current block time in seconds
  avgBlockTime: number; // average block time over period
  blockSize: number; // average block size in bytes
  blocksProduced: number; // blocks produced in time period
  
  // Gas metrics
  gasPrice: number; // current gas price in gwei
  avgGasPrice: number; // average gas price over period
  gasUsed: number; // gas used in current block
  gasLimit: number; // gas limit for current block
  gasUtilization: number; // percentage of gas used vs limit
  
  // Transaction metrics
  transactionCount: number; // transactions in current block
  totalTransactions: number; // total transactions in time period
  pendingTransactionCount: number; // pending in mempool
  failedTransactionCount: number; // failed transactions
  transactionSuccessRate: number; // percentage of successful transactions
  avgTransactionFee: number; // average transaction fee in USD
  
  // Volume metrics (24h rolling)
  volume24h: number; // total volume in USD (last 24h)
  volumeChange24h: number; // percentage change from previous 24h
  transactionVolume: number; // transaction volume in native token
  bridgeVolumeIn: number; // incoming bridge volume in USD
  bridgeVolumeOut: number; // outgoing bridge volume in USD
  dexVolume: number; // DEX trading volume in USD
  
  // Network activity
  activeAddresses: number; // unique active addresses in 24h
  newAddresses: number; // new addresses created in 24h
  activeContracts: number; // active smart contracts in 24h
  
  // Price & Market Data
  nativeTokenPrice: number; // native token price in USD
  nativeTokenPriceChange24h: number; // price change percentage
  marketCap: number; // market cap in USD
  circulatingSupply: number; // circulating supply of native token
  
  // DeFi & Ecosystem Metrics
  tvl: number; // Total Value Locked in USD
  tvlChange24h: number; // TVL change percentage
  activeProtocols: number; // number of active DeFi protocols
  topProtocolsByTVL: {
    name: string;
    tvl: number;
    change24h: number;
  }[];
  
  // Node & RPC Health
  timestamp: Date;
  rpcLatency: number; // RPC response time in ms
  rpcErrors: number; // number of RPC errors
  rpcSuccessRate: number; // percentage of successful RPC calls
  nodeVersion: string; // node software version
  nodeStatus: 'healthy' | 'degraded' | 'unhealthy';
  syncStatus: 'synced' | 'syncing' | 'behind'; // node sync status
  peerCount: number; // number of connected peers
  
  // Alerts
  alerts: ChainAlert[];
}

export interface BridgeLatencyStats {
  // Bridge identification
  bridgeId: string;
  bridgeName: string;
  bridgeProtocol: string; // e.g., "LayerZero", "Hyperlane", "Wormhole"
  bridgeType: 'native' | 'lock_mint' | 'liquidity'; // bridge mechanism type
  
  // Route information
  fromChainId: number;
  fromChainName: string;
  fromChainSymbol: string;
  toChainId: number;
  toChainName: string;
  toChainSymbol: string;
  
  // Latency metrics (in seconds)
  avgLatency: number; // average completion time
  minLatency: number; // fastest completion time
  maxLatency: number; // slowest completion time
  p95Latency: number; // 95th percentile latency
  p99Latency: number; // 99th percentile latency
  medianLatency: number; // median completion time
  
  // Success metrics
  successRate: number; // percentage of successful transfers
  failureRate: number; // percentage of failed transfers
  timeoutRate: number; // percentage of transfers that timed out
  totalTransactions: number; // total transactions in time period
  successfulTransactions: number; // successful transactions
  failedTransactions: number; // failed transactions
  pendingTransactions: number; // currently pending transactions
  
  // Volume metrics (24h rolling)
  volume24h: number; // total volume in USD (last 24h)
  volumeChange24h: number; // percentage change from previous 24h
  transactionVolume: number; // volume in terms of transaction count
  avgTransactionSize: number; // average transaction size in USD
  largestTransaction: number; // largest transaction in 24h (USD)
  
  // Popular tokens bridged
  topTokensByVolume: {
    tokenSymbol: string;
    tokenAddress: string;
    volume: number; // in USD
    percentage: number; // percentage of total volume
  }[];
  
  // Fee metrics
  avgFee: number; // average bridge fee in USD
  avgFeePercentage: number; // average fee as percentage of transaction
  totalFeesCollected: number; // total fees collected in 24h (USD)
  
  // Liquidity metrics (for liquidity-based bridges)
  liquidityFrom: number; // available liquidity on source chain (USD)
  liquidityTo: number; // available liquidity on destination chain (USD)
  liquidityUtilization: number; // percentage of liquidity being used
  liquidityImbalance: number; // difference between source and destination liquidity
  
  // Security & Health metrics
  timestamp: Date;
  status: 'optimal' | 'slow' | 'degraded' | 'down' | 'maintenance';
  lastSuccessfulTransaction: Date; // timestamp of last successful transaction
  maxCapacity: number; // maximum transaction capacity per hour
  currentCapacity: number; // current transaction capacity
  capacityUtilization: number; // percentage of capacity being used
  
  // Validator/Relayer information (for applicable bridges)
  activeValidators: number; // number of active validators
  requiredValidators: number; // required number of validators for consensus
  validatorUptime: number; // percentage uptime of validators
  
  // Alerts
  alerts: BridgeAlert[];
}

export interface ChainAlert {
  id: string;
  chainId: number;
  type: 'block_time' | 'gas_price' | 'rpc_latency' | 'transaction_pool' | 'node_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface BridgeAlert {
  id: string;
  bridgeId: string;
  type: 'high_latency' | 'low_success_rate' | 'bridge_down' | 'timeout' | 'low_liquidity' | 'high_fees' | 'validator_down';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

// DEX Performance Stats
export interface DEXPerformanceStats {
  // DEX identification
  dexId: string;
  dexName: string;
  dexProtocol: string; // e.g., "Uniswap V3", "PancakeSwap", "Curve"
  chainId: number;
  chainName: string;
  
  // Volume metrics (24h rolling)
  volume24h: number; // total trading volume in USD
  volumeChange24h: number; // percentage change from previous 24h
  volume7d: number; // 7-day trading volume in USD
  volumeChange7d: number; // 7-day volume change percentage
  
  // Liquidity metrics
  tvl: number; // Total Value Locked in USD
  tvlChange24h: number; // TVL change percentage (24h)
  activeLiquidityPools: number; // number of active pools
  totalLiquidityPools: number; // total number of pools
  
  // Trading metrics
  totalTrades24h: number; // number of trades in 24h
  avgTradeSize: number; // average trade size in USD
  largestTrade24h: number; // largest trade in 24h (USD)
  uniqueTraders24h: number; // unique wallet addresses trading
  
  // Top trading pairs
  topPairsByVolume: {
    pairAddress: string;
    token0Symbol: string;
    token1Symbol: string;
    volume24h: number; // volume in USD
    volumePercentage: number; // percentage of total DEX volume
    liquidity: number; // pool liquidity in USD
    apr: number; // annual percentage rate for LPs
  }[];
  
  // Fee metrics
  totalFeesGenerated24h: number; // total fees in USD
  avgFeePerTrade: number; // average fee per trade in USD
  protocolRevenue24h: number; // protocol revenue in USD
  lpRewards24h: number; // liquidity provider rewards in USD
  
  // Performance metrics
  avgSlippage: number; // average slippage percentage
  failedTransactionRate: number; // percentage of failed transactions
  avgGasUsed: number; // average gas used per swap
  
  // Health metrics
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'issues';
  uptime24h: number; // percentage uptime in last 24h
  lastTrade: Date; // timestamp of last successful trade
}

// Token Performance Stats
export interface TokenPerformanceStats {
  // Token identification
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: number;
  chainName: string;
  
  // Price metrics
  priceUSD: number; // current price in USD
  priceChange1h: number; // 1-hour price change percentage
  priceChange24h: number; // 24-hour price change percentage
  priceChange7d: number; // 7-day price change percentage
  priceChange30d: number; // 30-day price change percentage
  
  // Volume metrics
  volume24h: number; // 24-hour trading volume in USD
  volumeChange24h: number; // volume change percentage
  volume7d: number; // 7-day trading volume in USD
  
  // Market metrics
  marketCap: number; // market capitalization in USD
  marketCapRank: number; // market cap ranking
  fullyDilutedValuation: number; // FDV in USD
  circulatingSupply: number; // circulating supply
  totalSupply: number; // total supply
  maxSupply?: number; // maximum supply (if applicable)
  
  // Trading metrics
  holders: number; // number of token holders
  holdersChange24h: number; // change in holders (24h)
  totalTransfers24h: number; // number of transfers in 24h
  uniqueTraders24h: number; // unique addresses trading
  
  // Liquidity metrics
  totalLiquidity: number; // total liquidity across all pools (USD)
  liquidityChange24h: number; // liquidity change percentage
  mainPoolLiquidity: number; // liquidity in main trading pool
  poolCount: number; // number of liquidity pools
  
  // DEX presence
  listedOnDEXs: {
    dexName: string;
    pairAddress: string;
    liquidity: number; // liquidity in this pool (USD)
    volume24h: number; // volume in this pool (USD)
    priceImpact1k: number; // price impact for $1k trade
    priceImpact10k: number; // price impact for $10k trade
  }[];
  
  // Social & Development metrics
  socialScore: number; // composite social media activity score
  githubCommits30d?: number; // GitHub commits in last 30 days
  twitterFollowers?: number; // Twitter followers count
  
  // Security metrics
  isVerified: boolean; // contract verification status
  auditScore?: number; // security audit score (if available)
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'; // overall risk assessment
  
  // Timestamp
  timestamp: Date;
}

export interface StatsOverview {
  timestamp: Date;
  
  // Chain metrics summary
  chainStats: ChainPerformanceStats[];
  totalChains: number;
  healthyChains: number;
  
  // Bridge metrics summary
  bridgeStats: BridgeLatencyStats[];
  totalBridges: number;
  activeBridges: number;
  
  // DEX metrics summary
  dexStats: DEXPerformanceStats[];
  totalDEXs: number;
  activeDEXs: number;
  
  // Token metrics summary
  topTokens: TokenPerformanceStats[]; // top 10 tokens by market cap
  totalTokensTracked: number;
  
  // Volume summary (24h, all chains)
  totalVolume24h: number; // total cross-chain volume in USD
  volumeChange24h: number; // volume change percentage
  totalTVL: number; // total TVL across all chains
  tvlChange24h: number; // TVL change percentage
  
  // Activity summary
  totalTransactions24h: number; // total transactions across all chains
  totalActiveAddresses24h: number; // total active addresses
  totalBridgeTransfers24h: number; // total bridge transfers
  
  // Alert summary
  totalAlerts: number;
  criticalAlerts: number;
  chainAlerts: number;
  bridgeAlerts: number;
  dexAlerts: number;
  
  // Overall system health
  systemStatus: 'healthy' | 'degraded' | 'critical';
  overallUptime: number; // percentage uptime across all services
}

export interface ChainRPCConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  backupRpcUrls?: string[];
  websocketUrl?: string;
  explorerUrl: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
  };
  isTestnet: boolean;
  isEnabled: boolean;
}

export interface BridgeConfig {
  bridgeId: string;
  bridgeName: string;
  protocol: string;
  supportedChains: number[];
  monitoringEnabled: boolean;
  alertThresholds: {
    maxLatency: number;
    minSuccessRate: number;
  };
}

export interface StatsCollectionConfig {
  chainStats: {
    enabled: boolean;
    interval: number; // seconds
    retentionDays: number;
    alertThresholds: {
      maxBlockTime: number;
      maxRpcLatency: number;
      minSuccessRate: number;
    };
  };
  bridgeStats: {
    enabled: boolean;
    interval: number; // seconds
    retentionDays: number;
    alertThresholds: {
      maxLatency: number;
      minSuccessRate: number;
    };
  };
  kafka: {
    enabled: boolean;
    topics: {
      chainStats: string;
      bridgeStats: string;
      alerts: string;
    };
  };
}

export interface StatsFilters {
  // General filters
  chainIds?: number[];
  startTime?: Date;
  endTime?: Date;
  
  // Bridge filters
  bridgeIds?: string[];
  bridgeProtocols?: string[]; // e.g., ["LayerZero", "Wormhole"]
  bridgeTypes?: ('native' | 'lock_mint' | 'liquidity')[]; 
  
  // DEX filters
  dexIds?: string[];
  dexProtocols?: string[]; // e.g., ["Uniswap V3", "PancakeSwap"]
  minVolume24h?: number; // minimum 24h volume in USD
  minTVL?: number; // minimum TVL in USD
  
  // Token filters  
  tokenAddresses?: string[];
  tokenSymbols?: string[];
  minMarketCap?: number; // minimum market cap in USD
  maxMarketCap?: number; // maximum market cap in USD
  riskLevels?: ('low' | 'medium' | 'high' | 'extreme')[];
  
  // Alert filters
  alertSeverity?: 'low' | 'medium' | 'high' | 'critical';
  alertTypes?: string[]; // specific alert types to filter
  
  // Status filters
  chainStatus?: 'healthy' | 'degraded' | 'unhealthy';
  bridgeStatus?: 'optimal' | 'slow' | 'degraded' | 'down' | 'maintenance';
  dexStatus?: 'healthy' | 'degraded' | 'issues';
}

export interface StatsAggregation {
  timeframe: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    avgBlockTime: number;
    avgRpcLatency: number;
    avgBridgeLatency: number;
    alertCount: number;
    successRate: number;
  };
  breakdown: {
    [key: string]: {
      value: number;
      percentage: number;
    };
  };
}

// Request/Response types
export interface GetStatsRequest {
  // General filters
  chainIds?: number[];
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

// Request/Response types
export interface GetBridgeStatsRequest {
  limit?: number;
  offset?: number;
  bridgeIds?: string[];
  bridgeProtocols?: string[];
  minVolume24h?: number;
  minTVL?: number;
  minSuccessRate?: number;
}


export interface GetStatsResponse {
  chainStats: ChainPerformanceStats[];
  totalCount: number;
  hasMore: boolean;
  timestamp: Date;
}

export interface GetBridgeStatsResponse {
  bridgeStats: BridgeLatencyStats[];
  totalCount: number;
  hasMore: boolean;
  timestamp: Date;
}

export interface GetAlertsRequest {
  chainIds?: number[];
  bridgeIds?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  resolved?: boolean;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface GetAlertsResponse {
  chainAlerts: ChainAlert[];
  bridgeAlerts: BridgeAlert[];
  totalCount: number;
  hasMore: boolean;
  timestamp: Date;
}

export interface GetAggregatedStatsRequest {
  timeframe: 'hour' | 'day' | 'week' | 'month';
  chainIds?: number[];
  bridgeIds?: string[];
  startTime?: string;
  endTime?: string;
}

export interface GetAggregatedStatsResponse {
  aggregation: StatsAggregation;
  data: {
    [key: string]: {
      timestamp: Date;
      values: {
        [metric: string]: number;
      };
    };
  };
  timestamp: Date;
}

// Kafka message types
export interface StatsKafkaMessage {
  type: 'chain_stats' | 'bridge_stats' | 'dex_stats' | 'token_stats' | 'alert';
  data: ChainPerformanceStats | BridgeLatencyStats | DEXPerformanceStats | TokenPerformanceStats | ChainAlert | BridgeAlert;
  timestamp: Date;
  source: string;
  version: string; // message schema version
}

export interface ChainStatsKafkaMessage extends StatsKafkaMessage {
  type: 'chain_stats';
  data: ChainPerformanceStats;
}

export interface BridgeStatsKafkaMessage extends StatsKafkaMessage {
  type: 'bridge_stats';
  data: BridgeLatencyStats;
}

export interface DEXStatsKafkaMessage extends StatsKafkaMessage {
  type: 'dex_stats';
  data: DEXPerformanceStats;
}

export interface TokenStatsKafkaMessage extends StatsKafkaMessage {
  type: 'token_stats';
  data: TokenPerformanceStats;
}

export interface AlertKafkaMessage extends StatsKafkaMessage {
  type: 'alert';
  data: ChainAlert | BridgeAlert;
}

// Database document types (for MongoDB)
export interface ChainStatsDocument extends ChainPerformanceStats {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string; // schema version for migrations
}

export interface BridgeStatsDocument extends BridgeLatencyStats {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string;
}

export interface DEXStatsDocument extends DEXPerformanceStats {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string;
}

export interface TokenStatsDocument extends TokenPerformanceStats {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string;
}

export interface ChainAlertDocument extends ChainAlert {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string;
}

export interface BridgeAlertDocument extends BridgeAlert {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
  dataVersion: string;
}

// Additional helper types for worker data collection
export interface DataCollectionJob {
  jobId: string;
  jobType: 'chain_stats' | 'bridge_stats' | 'dex_stats' | 'token_stats';
  chainId?: number;
  targetId?: string; // bridgeId, dexId, or tokenAddress
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: {
    [key: string]: any;
  };
}

export interface CollectionSource {
  sourceId: string;
  sourceName: string;
  sourceType: 'rpc' | 'subgraph' | 'api' | 'websocket';
  endpoint: string;
  reliability: number; // 0-1 score
  latency: number; // average response time in ms
  isActive: boolean;
  supportedChains: number[];
  supportedDataTypes: ('chain_stats' | 'bridge_stats' | 'dex_stats' | 'token_stats')[];
} 