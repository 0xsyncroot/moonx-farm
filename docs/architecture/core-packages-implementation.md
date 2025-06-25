# Core Shared Packages Implementation

## Tổng Quan

Core Shared Packages bao gồm 2 packages chính được thiết kế để cung cấp utilities, types và configurations dùng chung cho toàn bộ hệ thống MoonXFarm DEX:

- **@moonx/common**: Utilities, types, error handling, logging, validation
- **@moonx/config**: Database, Redis, Kafka configuration managers

## 1. @moonx/common Package

### 1.1. Environment Validation (`env.ts`)

#### Tính năng:
- Validation biến môi trường với Zod schema
- Base schema có thể extend cho từng service
- Type-safe environment variables
- Helper functions để check environment

#### Sử dụng:
```typescript
import { BaseEnvSchema, createEnvValidator, isDevelopment } from '@moonx/common';

// Extend cho service cụ thể
const AuthServiceEnvSchema = BaseEnvSchema.extend({
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
  AUTH_SERVICE_PORT: z.coerce.number().default(3002)
});

export const env = createEnvValidator(AuthServiceEnvSchema);
```

#### Lợi ích:
- **Type Safety**: Đảm bảo type an toàn cho env vars
- **Early Validation**: Phát hiện missing/invalid env vars ngay khi khởi động
- **Centralized**: Tập trung quản lý validation logic
- **Extensible**: Dễ dàng extend cho từng service

### 1.2. Structured Logging (`logger.ts`)

#### Tính năng:
- Winston-based logging với structured format
- Development vs Production formats
- Child loggers với default context
- Performance timing utilities
- Error logging wrappers

#### Sử dụng:
```typescript
import { createLogger, startTimer, withErrorLogging } from '@moonx/common';

const logger = createLogger('auth-service');

// Basic logging
logger.info('User authenticated', { userId: '123', traceId: 'abc' });

// Child logger với default context
const userLogger = logger.child({ userId: '123' });
userLogger.info('Profile updated'); // Tự động include userId

// Performance timing
const endTimer = startTimer('database-query');
await database.query('SELECT * FROM users');
endTimer(); // Logs timing

// Error wrapping
const safeDbQuery = withErrorLogging(
  async (userId: string) => database.findUser(userId),
  { action: 'find-user' }
);
```

#### Lợi ích:
- **Consistent Format**: Chuẩn hóa log format across services
- **Structured Data**: JSON format cho production, human-readable cho dev
- **Context Preservation**: Trace requests qua nhiều services
- **Performance Monitoring**: Built-in timing utilities

### 1.3. Error Handling (`errors.ts`)

#### Tính năng:
- Hierarchical error classes với HTTP status codes
- Structured error information
- Type guards và error factories
- Context preservation

#### Sử dụng:
```typescript
import { 
  BadRequestError, 
  ValidationError, 
  ErrorFactory,
  isAppError 
} from '@moonx/common';

// Basic usage
throw new BadRequestError('Invalid input', { field: 'email' });

// Validation errors với field details
throw new ValidationError('Validation failed', {
  email: ['Invalid format'],
  age: ['Must be >= 18']
});

// Factory methods
throw ErrorFactory.fromZodError(zodError);
throw ErrorFactory.databaseError('Query failed', 'SELECT * FROM users');

// Error handling
try {
  await riskyOperation();
} catch (error) {
  if (isAppError(error)) {
    // Handle known errors
    res.status(error.statusCode).json(error.toJSON());
  } else {
    // Handle unknown errors
    logger.error('Unexpected error', { error });
  }
}
```

#### Lợi ích:
- **HTTP Compliance**: Tự động map tới HTTP status codes
- **Rich Context**: Attach arbitrary context data
- **Type Safety**: TypeScript type guards
- **Serializable**: JSON serialization cho API responses

### 1.4. Type Definitions (`types/index.ts`)

#### Tính năng:
- Core domain types cho DEX operations
- Blockchain và network types
- Event types cho Kafka messaging
- API response types
- Utility types

#### Highlights:
```typescript
// Blockchain types
export type ChainId = 8453 | 84532 | 56 | 97; // Base & BSC focused
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: ChainId;
}

// Order types với union discrimination
export type Order = MarketOrder | LimitOrder | DCAOrder;

// Event types cho Kafka
export interface OrderEvent extends BaseEvent {
  type: 'order.created' | 'order.updated' | 'order.filled';
  data: { orderId: string; order: Order; };
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; };
}
```

#### Lợi ích:
- **Single Source of Truth**: Centralized type definitions
- **Type Safety**: Strong typing across services
- **Consistency**: Chuẩn hóa data structures
- **Documentation**: Types serve as living documentation

### 1.5. Utility Functions (`utils/index.ts`)

#### Tính năng:
- String manipulation (truncate, case conversion)
- Number formatting (token amounts, USD, percentages)
- Validation helpers
- Date/time utilities
- Object/array manipulation
- Async utilities (retry, timeout, delay)
- Blockchain utilities

#### Examples:
```typescript
import { 
  formatTokenAmount, 
  truncateAddress, 
  retry, 
  getExplorerUrl 
} from '@moonx/common';

// Token formatting
formatTokenAmount('1000000000000000000', 18, 4); // "1.0000"

// Address display
truncateAddress('0x742d35Cc6486C9F43...'); // "0x742d...C9F43"

// Retry với exponential backoff
const result = await retry(
  () => externalApiCall(),
  3, // max attempts
  1000 // base delay
);

// Blockchain utilities
const explorerUrl = getExplorerUrl(8453, txHash); // Base explorer URL
```

### 1.6. Constants (`constants/index.ts`)

#### Tính năng:
- Network configurations (Base & BSC focus)
- Common tokens per network
- Application constants
- Kafka topics
- Cache configurations
- Validation rules
- Error codes

#### Structure:
```typescript
export const NETWORKS: Record<ChainId, NetworkConfig> = {
  8453: { // Base Mainnet
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    // ...
  }
};

export const KAFKA_TOPICS = {
  ORDER_CREATED: 'order.created',
  PRICE_UPDATED: 'price.updated',
  // ...
};

export const CACHE = {
  TTL: {
    TOKEN_PRICE: 60, // seconds
    QUOTE: 30,
    // ...
  }
};
```

## 2. @moonx/config Package

### 2.1. Database Configuration (`database.ts`)

#### Tính năng:
- PostgreSQL connection pooling
- Transaction management
- Query retry với exponential backoff
- Connection health monitoring
- Structured error handling

#### Sử dụng:
```typescript
import { createDatabase, createDatabaseConfig } from '@moonx/config';

const db = createDatabase(createDatabaseConfig());
await db.connect();

// Basic query
const users = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO orders (...) VALUES (...)', [...]);
  await tx.query('UPDATE balances SET amount = ...', [...]);
  // Auto-commit on success, rollback on error
});

// Health check
console.log(db.isHealthy()); // boolean
console.log(db.getPoolStats()); // { totalCount, idleCount, ... }
```

#### Lợi ích:
- **Connection Pooling**: Hiệu quả sử dụng database connections
- **Auto Retry**: Tự động retry queries khi có lỗi transient
- **Transaction Safety**: ACID transactions với auto-rollback
- **Monitoring**: Built-in health checks và pool statistics

### 2.2. Redis Configuration (`redis.ts`)

#### Tính năng:
- IORedis client với connection management
- Caching utilities
- Pattern-based operations
- Hash, List operations
- Health monitoring

#### Sử dụng:
```typescript
import { createRedis, createRedisConfig } from '@moonx/config';

const redis = createRedis(createRedisConfig());
await redis.connect();

// Basic caching
await redis.set('user:123', userData, { ttl: 300 }); // 5 mins TTL
const user = await redis.get<User>('user:123');

// Pattern operations
await redis.setByPattern('price:*'); // Delete all price keys
const prices = await redis.getByPattern('price:8453:*'); // Get Base prices

// Hash operations
await redis.hset('portfolio:123', 'totalValue', '1000.50');
const portfolio = await redis.hgetall('portfolio:123');
```

#### Lợi ích:
- **Auto Serialization**: JSON serialize/deserialize
- **TTL Management**: Built-in expiration handling
- **Pattern Operations**: Bulk operations by key patterns
- **Type Safety**: Generic get methods với type inference

## 3. Kiến Trúc Thiết Kế

### 3.1. Dependency Management

```
@moonx/common (zero external deps besides utilities)
    ↑
@moonx/config (depends on @moonx/common)
    ↑
Services (depend on both packages)
```

### 3.2. Error Handling Strategy

```
Application Error
    ├── Operational Errors (expected, recoverable)
    │   ├── BadRequestError (400)
    │   ├── UnauthorizedError (401)
    │   ├── ValidationError (422)
    │   └── RateLimitError (429)
    └── System Errors (unexpected, log & investigate)
        ├── DatabaseError (500)
        ├── ExternalApiError (502)
        └── InternalServerError (500)
```

### 3.3. Logging Strategy

```
Development:
  Format: Human-readable với colors
  Output: Console
  Level: Debug

Production:
  Format: Structured JSON
  Output: Console + Files
  Level: Info
  Fields: timestamp, level, message, service, traceId, context
```

## 4. Best Practices

### 4.1. Environment Variables

```typescript
// ✅ Good: Strong typing với validation
const env = createEnvValidator(ServiceEnvSchema);

// ❌ Bad: Direct process.env access
const port = process.env.PORT || 3000;
```

### 4.2. Error Handling

```typescript
// ✅ Good: Structured errors với context
throw new ValidationError('Invalid order', {
  amount: ['Must be > 0'],
  token: ['Invalid address']
}, { userId, orderId });

// ❌ Bad: Generic errors
throw new Error('Something went wrong');
```

### 4.3. Logging

```typescript
// ✅ Good: Structured logging với context
logger.info('Order created', { 
  orderId, 
  userId, 
  amount: order.amount,
  traceId 
});

// ❌ Bad: String concatenation
console.log(`Order ${orderId} created for user ${userId}`);
```

## 5. Development Workflow

### 5.1. Building Packages

```bash
# Build all packages
npm run build

# Build specific package
cd packages/common && npm run build
cd packages/config && npm run build
```

### 5.2. Testing

```bash
# Test all packages
npm run test

# Watch mode
npm run test:watch
```

### 5.3. Linting

```bash
# Lint all packages
npm run lint

# Auto-fix issues
npm run lint:fix
```

## 6. Monitoring & Observability

### 6.1. Health Checks

```typescript
// Database health
const dbHealth = db.isHealthy();
const dbStats = db.getPoolStats();

// Redis health  
const redisHealth = redis.isHealthy();
const redisInfo = await redis.getInfo();
```

### 6.2. Performance Monitoring

```typescript
// Database query timing
const endTimer = startTimer('user-lookup');
const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
endTimer(); // Logs duration

// Error tracking
const safeQuery = withErrorLogging(
  async () => await externalApi.call(),
  { service: 'external-api', action: 'fetch-quote' }
);
```

## 7. Kết Luận

Core Shared Packages cung cấp foundation vững chắc cho MoonXFarm DEX với:

- **Type Safety**: Strong typing với TypeScript
- **Error Handling**: Structured error management
- **Logging**: Observability-first logging
- **Configuration**: Environment-aware configs
- **Utilities**: Reusable helper functions
- **Constants**: Centralized configuration

Thiết kế này đảm bảo:
- ✅ **Maintainability**: Dễ debug và maintain
- ✅ **Reusability**: Code reuse across services  
- ✅ **Consistency**: Chuẩn hóa patterns
- ✅ **Scalability**: Prepared for team growth
- ✅ **Observability**: Built-in monitoring 