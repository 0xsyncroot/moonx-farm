# @moonx/common Package Implementation

## Tổng Quan

`@moonx/common` là shared utilities package cung cấp core functionality được sử dụng across toàn bộ MoonXFarm DEX ecosystem, bao gồm types, error handling, logging, và utility functions.

## Package Structure

### File Organization
```
packages/common/
├── package.json               # Package configuration
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── constants/            # Application constants
│   │   └── index.ts
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/                # Utility functions
│   │   └── index.ts
│   └── validation/           # Validation helpers
│       └── index.ts
└── tests/                    # Package tests
```

### Design Philosophy
- **Zero External Dependencies**: Minimal dependencies để giảm bundle size
- **Type Safety**: Strong TypeScript typing throughout
- **Tree Shaking**: Optimal exports cho bundle optimization
- **Reusability**: Functions designed for maximum reuse

## Core Modules

### 1. Type Definitions (`types/index.ts`)

#### Blockchain Types
```typescript
// Chain identifiers
export type ChainId = 8453 | 84532 | 56 | 97; // Base & BSC focused

// Token information
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: ChainId;
  logoURI?: string;
}

// Network configuration
export interface NetworkConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}
```

#### DEX Operation Types
```typescript
// Order types với union discrimination
export type OrderType = 'market' | 'limit' | 'dca';

export interface BaseOrder {
  id: string;
  userId: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketOrder extends BaseOrder {
  type: 'market';
  slippage: number;
}

export interface LimitOrder extends BaseOrder {
  type: 'limit';
  limitPrice: string;
  expiresAt?: Date;
}

export interface DCAOrder extends BaseOrder {
  type: 'dca';
  frequency: 'daily' | 'weekly' | 'monthly';
  totalOrders: number;
  executedOrders: number;
}

export type Order = MarketOrder | LimitOrder | DCAOrder;
```

#### Event Types
```typescript
// Base event structure cho Kafka
export interface BaseEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  traceId?: string;
}

// Order events
export interface OrderEvent extends BaseEvent {
  type: 'order.created' | 'order.updated' | 'order.filled' | 'order.cancelled';
  data: {
    orderId: string;
    order: Order;
    reason?: string;
  };
}

// Price events
export interface PriceEvent extends BaseEvent {
  type: 'price.updated' | 'price.alert';
  data: {
    token: TokenInfo;
    price: string;
    change24h: number;
    volume24h: string;
  };
}

// Swap events
export interface SwapEvent extends BaseEvent {
  type: 'swap.initiated' | 'swap.completed' | 'swap.failed';
  data: {
    swapId: string;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: string;
    amountOut?: string;
    txHash?: string;
    error?: string;
  };
}
```

#### API Response Types
```typescript
// Standardized API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationInfo;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 2. Constants (`constants/index.ts`)

#### Network Configurations
```typescript
export const NETWORKS: Record<ChainId, NetworkConfig> = {
  8453: { // Base Mainnet
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  84532: { // Base Sepolia
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  56: { // BSC Mainnet
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    }
  },
  97: { // BSC Testnet
    chainId: 97,
    name: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    }
  }
};
```

#### Application Constants
```typescript
// Cache TTL configurations
export const CACHE_TTL = {
  TOKEN_PRICE: 60,        // 1 minute
  QUOTE: 30,              // 30 seconds
  USER_SESSION: 86400,    // 24 hours
  TOKEN_LIST: 3600,       // 1 hour
  NETWORK_STATUS: 300     // 5 minutes
} as const;

// Kafka topic names
export const KAFKA_TOPICS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_FILLED: 'order.filled',
  PRICE_UPDATED: 'price.updated',
  SWAP_INITIATED: 'swap.initiated',
  SWAP_COMPLETED: 'swap.completed',
  USER_REGISTERED: 'user.registered'
} as const;

// Error codes
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_SLIPPAGE: 'INVALID_SLIPPAGE'
} as const;

// Trading limits
export const TRADING_LIMITS = {
  MIN_ORDER_SIZE: '0.001',    // ETH
  MAX_ORDER_SIZE: '1000',     // ETH
  MAX_SLIPPAGE: 5000,         // 50%
  DEFAULT_SLIPPAGE: 50,       // 0.5%
  MIN_SLIPPAGE: 1,            // 0.01%
  PRICE_IMPACT_WARNING: 300   // 3%
} as const;
```

### 3. Utility Functions (`utils/index.ts`)

#### String Utilities
```typescript
// Address formatting
export function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (address.length <= startLength + endLength) return address;
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
}

// String case conversion
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// URL utilities
export function buildUrl(base: string, params: Record<string, any>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}
```

#### Number Formatting
```typescript
// Token amount formatting
export function formatTokenAmount(
  amount: string | number,
  decimals: number,
  displayDecimals: number = 4
): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  const divisor = Math.pow(10, decimals);
  const formatted = (value / divisor).toFixed(displayDecimals);
  
  // Remove trailing zeros
  return parseFloat(formatted).toString();
}

// Currency formatting
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Percentage formatting
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Large number formatting
export function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toString();
}
```

#### Async Utilities
```typescript
// Retry with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
      attempt++;
    }
  }
  
  throw new Error('Max retry attempts exceeded');
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Timeout wrapper
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

#### Blockchain Utilities
```typescript
// Get explorer URL
export function getExplorerUrl(chainId: ChainId, hash: string, type: 'tx' | 'address' = 'tx'): string {
  const network = NETWORKS[chainId];
  if (!network) throw new Error(`Unsupported chain ID: ${chainId}`);
  
  const path = type === 'tx' ? 'tx' : 'address';
  return `${network.explorerUrl}/${path}/${hash}`;
}

// Validate address format
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate transaction hash
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

// Calculate price impact
export function calculatePriceImpact(
  inputAmount: string,
  outputAmount: string,
  inputPrice: string,
  outputPrice: string
): number {
  const expectedOutput = (parseFloat(inputAmount) * parseFloat(inputPrice)) / parseFloat(outputPrice);
  const actualOutput = parseFloat(outputAmount);
  
  return Math.abs((expectedOutput - actualOutput) / expectedOutput) * 100;
}
```

#### Validation Utilities
```typescript
// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone validation (basic)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// URL validation
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// JSON validation
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
```

### 4. Validation Helpers (`validation/index.ts`)

#### Schema Builders
```typescript
import { z } from 'zod';

// Address validation schema
export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');

// Amount validation schema
export const AmountSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format');

// Chain ID validation
export const ChainIdSchema = z.union([
  z.literal(8453),   // Base
  z.literal(84532),  // Base Sepolia
  z.literal(56),     // BSC
  z.literal(97)      // BSC Testnet
]);

// Token validation
export const TokenSchema = z.object({
  address: AddressSchema,
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(50),
  decimals: z.number().min(0).max(18),
  chainId: ChainIdSchema,
  logoURI: z.string().url().optional()
});

// Order validation
export const OrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('market'),
    tokenIn: TokenSchema,
    tokenOut: TokenSchema,
    amountIn: AmountSchema,
    slippage: z.number().min(0.01).max(50)
  }),
  z.object({
    type: z.literal('limit'),
    tokenIn: TokenSchema,
    tokenOut: TokenSchema,
    amountIn: AmountSchema,
    limitPrice: AmountSchema,
    expiresAt: z.date().optional()
  }),
  z.object({
    type: z.literal('dca'),
    tokenIn: TokenSchema,
    tokenOut: TokenSchema,
    amountIn: AmountSchema,
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    totalOrders: z.number().min(1).max(100)
  })
]);
```

#### Validation Functions
```typescript
// Validate input with schema
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    
    throw new ValidationError('Validation failed', { errors });
  }
  
  return result.data;
}

// Sanitize string input
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>\"'&]/g, '');
}

// Validate and sanitize amount
export function validateAmount(amount: string, min?: string, max?: string): string {
  const sanitized = amount.replace(/[^0-9.]/g, '');
  const num = parseFloat(sanitized);
  
  if (isNaN(num) || num <= 0) {
    throw new ValidationError('Invalid amount');
  }
  
  if (min && num < parseFloat(min)) {
    throw new ValidationError(`Amount must be at least ${min}`);
  }
  
  if (max && num > parseFloat(max)) {
    throw new ValidationError(`Amount must not exceed ${max}`);
  }
  
  return sanitized;
}
```

## Error Handling

### Error Classes
```typescript
// Base application error
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: new Date().toISOString()
    };
  }
}

// Specific error types
export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR';
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';
}

export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_SERVER_ERROR';
}
```

### Error Utilities
```typescript
// Type guard for app errors
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Error factory methods
export class ErrorFactory {
  static fromZodError(error: z.ZodError): ValidationError {
    const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    return new ValidationError('Validation failed', { errors: messages });
  }
  
  static networkError(message: string, details?: any): InternalServerError {
    return new InternalServerError(message, { type: 'network', details });
  }
  
  static databaseError(message: string, query?: string): InternalServerError {
    return new InternalServerError(message, { type: 'database', query });
  }
}
```

## Testing Utilities

### Test Helpers
```typescript
// Mock data generators
export const createMockToken = (overrides?: Partial<TokenInfo>): TokenInfo => ({
  address: '0x1234567890123456789012345678901234567890',
  symbol: 'MOCK',
  name: 'Mock Token',
  decimals: 18,
  chainId: 8453,
  ...overrides
});

export const createMockOrder = (overrides?: Partial<Order>): MarketOrder => ({
  id: 'mock-order-id',
  userId: 'mock-user-id',
  type: 'market',
  tokenIn: createMockToken(),
  tokenOut: createMockToken({ symbol: 'USDC' }),
  amountIn: '1000000000000000000',
  slippage: 50,
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Test data validation
export function expectValidToken(token: any): asserts token is TokenInfo {
  expect(TokenSchema.parse(token)).toBeDefined();
}

export function expectValidOrder(order: any): asserts order is Order {
  expect(OrderSchema.parse(order)).toBeDefined();
}
```

## Best Practices

### Usage Guidelines
1. **Import Specific Functions**: Use tree shaking friendly imports
2. **Error Handling**: Always use structured error classes
3. **Type Safety**: Leverage TypeScript types for validation
4. **Performance**: Use utility functions for common operations

### Example Usage
```typescript
// ✅ Good: Specific imports
import { formatTokenAmount, truncateAddress, retry } from '@moonx/common';

// ❌ Bad: Barrel imports
import * as common from '@moonx/common';

// ✅ Good: Structured error handling
try {
  const result = await riskyOperation();
} catch (error) {
  if (isAppError(error)) {
    logger.error('Known error occurred', { error: error.toJSON() });
  } else {
    logger.error('Unknown error', { error });
  }
}
```

---

**Related**: [Shared Packages Overview](./shared-packages-overview.md) | [Configs Package](./configs-package.md)
