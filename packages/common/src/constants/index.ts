import { NetworkConfig, ChainId } from '../types';

/**
 * Supported blockchain networks
 */
export const NETWORKS: Record<ChainId, NetworkConfig> = {
  // Base Mainnet
  8453: {
    chainId: 8453,
    name: 'Base',
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.blockpi.network/v1/rpc/public',
      'https://1rpc.io/base',
      'https://base.meowrpc.com',
    ],
    privateRpcUrl: process.env.BASE_MAINNET_RPC,
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },
  // Base Sepolia
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia.blockpi.network/v1/rpc/public',
      'https://base-sepolia.publicnode.com',
    ],
    privateRpcUrl: process.env.BASE_TESTNET_RPC,
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
  // BSC Mainnet
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrls: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc-dataseed4.binance.org',
      'https://bsc.nodereal.io',
      'https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3',
    ],
    privateRpcUrl: process.env.BSC_MAINNET_RPC,
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    isTestnet: false,
  },
  // BSC Testnet
  97: {
    chainId: 97,
    name: 'BNB Smart Chain Testnet',
    rpcUrls: [
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://data-seed-prebsc-2-s1.binance.org:8545',
      'https://data-seed-prebsc-1-s2.binance.org:8545',
      'https://data-seed-prebsc-2-s2.binance.org:8545',
    ],
    privateRpcUrl: process.env.BSC_TESTNET_RPC,
    blockExplorer: 'https://testnet.bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'tBNB',
      decimals: 18,
    },
    isTestnet: true,
  },
};

/**
 * Default tokens for each network
 */
export const NATIVE_TOKENS = {
  [8453]: { // Base
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 8453 as ChainId,
  },
  [84532]: { // Base Sepolia
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 84532 as ChainId,
  },
  [56]: { // BSC
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    chainId: 56 as ChainId,
  },
  [97]: { // BSC Testnet
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'tBNB',
    name: 'BNB',
    decimals: 18,
    chainId: 97 as ChainId,
  },
};

/**
 * Common ERC20 tokens on supported networks
 */
export const COMMON_TOKENS = {
  // Base Mainnet
  [8453]: {
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453 as ChainId,
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 8453 as ChainId,
    },
  },
  // Base Sepolia
  [84532]: {
    USDC: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 84532 as ChainId,
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 84532 as ChainId,
    },
  },
  // BSC Mainnet
  [56]: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      chainId: 56 as ChainId,
    },
    WBNB: {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      chainId: 56 as ChainId,
    },
  },
  // BSC Testnet
  [97]: {
    USDT: {
      address: '0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      chainId: 97 as ChainId,
    },
    WBNB: {
      address: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      chainId: 97 as ChainId,
    },
  },
};

/**
 * Application constants
 */
export const APP_CONFIG = {
  NAME: 'MoonXFarm',
  VERSION: '1.0.0',
  API_VERSION: 'v1',
  MAX_SLIPPAGE: 50, // 50%
  DEFAULT_SLIPPAGE: 2, // 2%
  MIN_SLIPPAGE: 0.1, // 0.1%
  MAX_DEADLINE: 3600, // 1 hour in seconds
  DEFAULT_DEADLINE: 1200, // 20 minutes in seconds
  MAX_GAS_PRICE: '100', // 100 gwei
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

/**
 * Service ports (for development)
 */
export const SERVICE_PORTS = {
  API_GATEWAY: 3000,
  NOTIFY_SERVICE: 3001,
  AUTH_SERVICE: 3002,
  WALLET_REGISTRY: 3003,
  QUOTE_SERVICE: 3004,
  SWAP_ORCHESTRATOR: 3005,
  POSITION_INDEXER: 3006,
  PRICE_CRAWLER: 4001,
  ORDER_EXECUTOR: 4002,
} as const;

/**
 * Kafka topics
 */
export const KAFKA_TOPICS = {
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_FILLED: 'order.filled',
  ORDER_CANCELLED: 'order.cancelled',
  
  // Price events
  PRICE_UPDATED: 'price.updated',
  PRICE_ALERT: 'price.alert',
  
  // User events
  USER_CREATED: 'user.created',
  USER_SIGNED_IN: 'user.signed_in',
  USER_SIGNED_OUT: 'user.signed_out',
  
  // Transaction events
  TRANSACTION_PENDING: 'transaction.pending',
  TRANSACTION_CONFIRMED: 'transaction.confirmed',
  TRANSACTION_FAILED: 'transaction.failed',
  
  // System events
  SYSTEM_ALERT: 'system.alert',
} as const;

/**
 * Cache keys and TTLs
 */
export const CACHE = {
  KEYS: {
    USER_PROFILE: (userId: string) => `user:profile:${userId}`,
    USER_WALLETS: (userId: string) => `user:wallets:${userId}`,
    TOKEN_PRICE: (chainId: ChainId, address: string) => `price:${chainId}:${address}`,
    QUOTE: (request: string) => `quote:${request}`,
    PORTFOLIO: (userId: string) => `portfolio:${userId}`,
  },
  TTL: {
    USER_PROFILE: 300, // 5 minutes
    TOKEN_PRICE: 60, // 1 minute
    QUOTE: 30, // 30 seconds
    PORTFOLIO: 120, // 2 minutes
  },
} as const;

/**
 * Validation constants
 */
export const VALIDATION = {
  MIN_ORDER_AMOUNT: '0.000001', // Minimum order amount
  MAX_ORDER_AMOUNT: '1000000', // Maximum order amount
  MAX_OPEN_ORDERS: 100, // Maximum open orders per user
  MAX_DCA_FREQUENCY: 86400, // Maximum DCA frequency (1 day)
  MIN_DCA_FREQUENCY: 3600, // Minimum DCA frequency (1 hour)
  MAX_DCA_EXECUTIONS: 365, // Maximum DCA executions
  ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/, // Ethereum address regex
  TRANSACTION_HASH_REGEX: /^0x[a-fA-F0-9]{64}$/, // Transaction hash regex
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Error codes for API responses
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_SLIPPAGE: 'INVALID_SLIPPAGE',
  
  // Business Logic
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  MARKET_CLOSED: 'MARKET_CLOSED',
  
  // Technical
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * Regular expressions for validation
 */
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  NUMERIC_STRING: /^\d+(\.\d+)?$/,
} as const;

/**
 * RPC URL utilities
 */
export const RPC_UTILS = {
  /**
   * Get the best available RPC URL for a network
   * Priority: privateRpcUrl > first public RPC URL
   */
  getBestRpcUrl: (network: NetworkConfig): string => {
    return network.privateRpcUrl || network.rpcUrls[0];
  },

  /**
   * Get all available RPC URLs for a network (private first, then public)
   */
  getAllRpcUrls: (network: NetworkConfig): string[] => {
    const urls = [];
    if (network.privateRpcUrl) {
      urls.push(network.privateRpcUrl);
    }
    urls.push(...network.rpcUrls);
    return urls;
  },

  /**
   * Get public RPC URLs only (excluding private)
   */
  getPublicRpcUrls: (network: NetworkConfig): string[] => {
    return [...network.rpcUrls];
  },

  /**
   * Check if network has private RPC configured
   */
  hasPrivateRpc: (network: NetworkConfig): boolean => {
    return !!network.privateRpcUrl;
  },
} as const; 