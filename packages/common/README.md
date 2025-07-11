# @moonx-farm/common

Shared utilities and types for MoonXFarm DEX - A comprehensive package providing logging, error handling, types, utilities, and constants for all MoonXFarm services.

## 🚀 Quick Start

```bash
npm install @moonx-farm/common
```

## 📦 What's Included

This package provides a complete toolkit for building MoonXFarm services:

- **🔍 Structured Logging** - Winston-based logging with multiple transports
- **🚨 Error Handling** - Comprehensive error classes with HTTP status codes
- **📝 Type Definitions** - Complete TypeScript types for DEX operations
- **🛠️ Utilities** - String, number, validation, and blockchain utilities
- **⚙️ Constants** - Network configs, tokens, and application constants
- **📚 External Dependencies** - Re-exports of `zod`, `nanoid`, and `ethers`

## 🔍 Logging

### Basic Usage

```typescript
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('my-service');

logger.info('Service started');
logger.error('Something went wrong', { userId: '123', action: 'swap' });
logger.warn('High memory usage', { memoryUsage: '85%' });
logger.debug('Debug information', { requestId: 'req-123' });
```

### Advanced Configuration

```typescript
import { createLoggerWithConfig } from '@moonx-farm/common';

const logger = createLoggerWithConfig({
  level: 'info',
  service: 'swap-service',
  enableConsole: true,
  enableFile: true,
  logDir: 'logs',
  maxFiles: 10,
  maxSize: '20m',
  format: 'json'
});
```

### Profile-based Logging

```typescript
import { createLoggerForProfile } from '@moonx-farm/common';

// Auto-configured for specific services
const logger = createLoggerForProfile('swap-orchestrator');
```

### Structured Logging with Context

```typescript
import { LogContext } from '@moonx-farm/common';

const context: LogContext = {
  traceId: 'trace-123',
  userId: 'user-456',
  service: 'swap-service',
  action: 'executeSwap'
};

logger.info('Swap executed successfully', context);

// Child loggers with default context
const childLogger = logger.child({ userId: 'user-456' });
childLogger.info('User action'); // Automatically includes userId
```

## 🚨 Error Handling

### Available Error Classes

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalApiError,
  BlockchainError
} from '@moonx-farm/common';
```

### Usage Examples

```typescript
// Basic errors
throw new BadRequestError('Invalid swap parameters');
throw new NotFoundError('Token not found');
throw new UnauthorizedError('Authentication required');

// Errors with context
throw new ValidationError('Invalid input', {
  amount: ['Must be greater than 0'],
  token: ['Invalid token address']
});

// Blockchain-specific errors
throw new BlockchainError(
  'Transaction failed',
  'base',
  '0x123...',
  { gasUsed: '21000' }
);

// External API errors
throw new ExternalApiError(
  'Price feed unavailable',
  'coingecko',
  originalError
);
```

### Error Utilities

```typescript
import { isAppError, isOperationalError, ErrorFactory } from '@moonx-farm/common';

// Check error types
if (isAppError(error)) {
  console.log(error.statusCode); // HTTP status code
  console.log(error.toJSON()); // Serialized error
}

// Create errors from common sources
const validationError = ErrorFactory.fromZodError(zodError);
const dbError = ErrorFactory.databaseError('Query failed', query, params);
```

## 📝 Type Definitions

### Blockchain Types

```typescript
import { ChainId, NetworkConfig, TokenInfo } from '@moonx-farm/common';

const chainId: ChainId = 8453; // Base Mainnet
const token: TokenInfo = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  chainId: 8453
};
```

### Trading Types

```typescript
import { 
  Order, 
  MarketOrder, 
  LimitOrder, 
  DCAOrder,
  QuoteRequest,
  QuoteResponse,
  SwapRequest 
} from '@moonx-farm/common';

const quoteRequest: QuoteRequest = {
  chainId: 8453,
  tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  tokenOut: '0x4200000000000000000000000000000000000006',
  amountIn: '1000000', // 1 USDC
  slippage: 0.5,
  userAddress: '0x...'
};
```

### User & Wallet Types

```typescript
import { User, SmartWallet, SessionKey } from '@moonx-farm/common';

const user: User = {
  id: 'user-123',
  address: '0x...',
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## 🛠️ Utilities

### String Utilities

```typescript
import { 
  capitalize,
  toCamelCase,
  toSnakeCase,
  truncate,
  truncateAddress
} from '@moonx-farm/common';

capitalize('hello world'); // 'Hello world'
toCamelCase('user_name'); // 'userName'
toSnakeCase('userName'); // 'user_name'
truncate('Long text here', 10); // 'Long text...'
truncateAddress('0x1234567890123456789012345678901234567890'); // '0x1234...7890'
```

### Number & Token Utilities

```typescript
import {
  formatNumber,
  formatTokenAmount,
  parseTokenAmount,
  formatPercentage,
  formatUSD,
  calculatePercentageChange
} from '@moonx-farm/common';

formatNumber(1234567.89); // '1,234,567.89'
formatTokenAmount('1000000000000000000', 18); // '1.0000' (1 ETH)
parseTokenAmount('1.5', 18); // '1500000000000000000'
formatPercentage(12.34); // '12.34%'
formatUSD(1234.56); // '$1,234.56'
calculatePercentageChange(100, 150); // 50
```

### Validation Utilities

```typescript
import {
  isValidAddress,
  isValidTransactionHash,
  isValidEmail,
  isValidOrderAmount,
  isValidSlippage
} from '@moonx-farm/common';

isValidAddress('0x1234567890123456789012345678901234567890'); // true
isValidTransactionHash('0xabc123...'); // true
isValidEmail('user@example.com'); // true
isValidOrderAmount('100.50'); // true
isValidSlippage(0.5); // true
```

### Date & Time Utilities

```typescript
import {
  formatDate,
  timeAgo,
  addSeconds,
  delay
} from '@moonx-farm/common';

formatDate(new Date(), 'short'); // 'Dec 1, 2024'
timeAgo(new Date(Date.now() - 60000)); // '1 minute ago'
addSeconds(new Date(), 3600); // Date + 1 hour
await delay(1000); // Wait 1 second
```

### Object & Array Utilities

```typescript
import {
  deepClone,
  pick,
  omit,
  chunk,
  unique,
  groupBy
} from '@moonx-farm/common';

const obj = { a: 1, b: 2, c: 3 };
pick(obj, ['a', 'b']); // { a: 1, b: 2 }
omit(obj, ['c']); // { a: 1, b: 2 }

chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
unique([1, 2, 2, 3, 3, 3]); // [1, 2, 3]
```

### Async Utilities

```typescript
import { retry, withTimeout } from '@moonx-farm/common';

// Retry failed operations
const result = await retry(
  async () => await fetchData(),
  3, // max attempts
  1000 // base delay
);

// Timeout operations
const data = await withTimeout(
  fetch('/api/data'),
  5000 // 5 second timeout
);
```

### Blockchain Utilities

```typescript
import {
  getNetworkName,
  isTestnet,
  getExplorerUrl,
  generateId,
  generateTraceId
} from '@moonx-farm/common';

getNetworkName(8453); // 'Base'
isTestnet(84532); // true
getExplorerUrl(8453, '0x123...', 'tx'); // 'https://basescan.org/tx/0x123...'
generateId(); // 'K2n8Dk7Pq9Lm'
generateTraceId(); // 'trace_R7x4Vc2Hb6Yp'
```

## ⚙️ Constants

### Network Configuration

```typescript
import { NETWORKS, NATIVE_TOKENS, COMMON_TOKENS } from '@moonx-farm/common';

// Get network config
const baseConfig = NETWORKS[8453];
console.log(baseConfig.name); // 'Base'
console.log(baseConfig.rpcUrls); // Array of RPC URLs

// Get native tokens
const ethToken = NATIVE_TOKENS[8453];
console.log(ethToken.symbol); // 'ETH'

// Get common tokens
const usdcOnBase = COMMON_TOKENS[8453].USDC;
console.log(usdcOnBase.address); // '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
```

### Application Constants

```typescript
import { APP_CONFIG, API_ENDPOINTS, VALIDATION } from '@moonx-farm/common';

console.log(APP_CONFIG.NAME); // 'MoonXFarm'
console.log(API_ENDPOINTS.SWAGGER); // '/api/docs'
console.log(VALIDATION.MIN_ORDER_AMOUNT); // Minimum order amount
```

## 📚 External Dependencies

The package re-exports commonly used libraries:

```typescript
import { z, nanoid, ethers } from '@moonx-farm/common';

// Zod for validation
const schema = z.object({
  amount: z.string(),
  token: z.string()
});

// Nanoid for ID generation
const id = nanoid();

// Ethers for blockchain operations
const provider = new ethers.JsonRpcProvider(rpcUrl);
```

## 🔧 Integration with @moonx-farm/configs

The package integrates with `@moonx-farm/configs` for configuration management:

```typescript
// Logger automatically uses configs if available
const logger = createLogger('my-service'); // Uses config from @moonx-farm/configs

// Fallback to environment variables if configs not available
process.env.LOG_LEVEL = 'debug';
process.env.APP_NAME = 'my-service';
```

## 📋 Supported Services

The package supports these MoonXFarm services:

- `api-gateway` - Main API gateway
- `auth-service` - Authentication service
- `wallet-registry` - Wallet management
- `core-service` - Core DEX operations
- `aggregator-service` - Price aggregation
- `swap-orchestrator` - Swap execution
- `position-indexer` - Position tracking
- `notify-service` - Notifications
- `price-crawler` - Price data collection
- `order-executor` - Order execution
- `web` - Frontend application
- `full` - Complete configuration

## 🌍 Supported Networks

- **Base Mainnet** (8453)
- **Base Sepolia** (84532) 
- **BSC Mainnet** (56)
- **BSC Testnet** (97)

## 📖 API Response Format

All services should use the standard API response format:

```typescript
import { ApiResponse } from '@moonx-farm/common';

const response: ApiResponse<Order[]> = {
  success: true,
  data: orders,
  meta: {
    pagination: {
      page: 1,
      limit: 10,
      total: 100,
      pages: 10
    },
    timestamp: new Date().toISOString()
  }
};
```

## 🔄 Event System

Use standardized event types for inter-service communication:

```typescript
import { OrderEvent, PriceEvent, UserEvent } from '@moonx-farm/common';

const orderEvent: OrderEvent = {
  id: 'evt-123',
  timestamp: new Date(),
  version: '1.0',
  source: 'swap-orchestrator',
  type: 'order.filled',
  data: {
    orderId: 'order-123',
    userId: 'user-456',
    walletAddress: '0x...',
    order: filledOrder
  }
};
```

## 🤝 Contributing

1. All new utilities should include comprehensive tests
2. Follow existing patterns for error handling and logging
3. Update type definitions for new features
4. Add JSDoc documentation for all public APIs
5. Maintain backward compatibility when possible

## 📝 License

This package is part of the MoonXFarm DEX ecosystem and is proprietary to MoonXFarm. 