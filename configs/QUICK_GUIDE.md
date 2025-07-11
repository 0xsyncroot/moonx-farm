# Quick Guide: Config Package

## 1. Cách dùng cơ bản - Tạo config tự định nghĩa cho service

### Ví dụ: Tạo config cho service mới
```typescript
// src/config.ts
import { createConfig, BaseConfigSchema, DatabaseConfigSchema, RedisConfigSchema } from '@moonx-farm/configs';
import { z } from 'zod';

// Định nghĩa schema cho service của bạn
const MyServiceConfigSchema = BaseConfigSchema
  .merge(DatabaseConfigSchema)
  .merge(RedisConfigSchema)
  .extend({
    // Service specific configs
    MY_SERVICE_PORT: z.coerce.number().default(3010),
    MY_SERVICE_HOST: z.string().default('localhost'),
    MY_API_KEY: z.string(),
    MY_FEATURE_ENABLED: z.coerce.boolean().default(true),
  });

// ❌ KHÔNG làm thế này - sẽ lỗi vì chạy ngay khi import:
// export const config = createConfig(MyServiceConfigSchema);

// ✅ Pattern 1: Lazy load (Recommended)
let configInstance: ReturnType<typeof createConfig<typeof MyServiceConfigSchema>> | null = null;

export function getConfig() {
  if (!configInstance) {
    configInstance = createConfig(MyServiceConfigSchema);
  }
  return configInstance;
}

// ✅ Pattern 2: Simple function (Alternative)
export function createMyServiceConfig() {
  return createConfig(MyServiceConfigSchema);
}

// Export type cho TypeScript
export type MyServiceConfig = ReturnType<typeof getConfig>;
```

### Sử dụng trong service:
```typescript
// src/app.ts
import { getConfig } from './config';
// hoặc: import { createMyServiceConfig } from './config';

// Pattern 1: Lazy load
const config = getConfig();

// Pattern 2: Simple function
// const config = createMyServiceConfig();

// Lấy config values
const port = config.get('MY_SERVICE_PORT');
const dbHost = config.get('DATABASE_HOST');
const redisHost = config.get('REDIS_HOST');
const apiKey = config.get('MY_API_KEY');

// Kiểm tra environment
if (config.isDevelopment()) {
  console.log('Running in development mode');
}

// Sử dụng trong Express app
app.listen(port, () => {
  console.log(`Service running on port ${port}`);
});
```

### Environment Variables cần thiết:
```bash
# .env file ở root project
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=my_service_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres123
REDIS_HOST=localhost
REDIS_PORT=6379
MY_API_KEY=your-api-key-here
MY_FEATURE_ENABLED=true
```

## 2. Các schema có sẵn

```typescript
import { 
  BaseConfigSchema,        // NODE_ENV, LOG_LEVEL, APP_NAME, APP_VERSION
  DatabaseConfigSchema,    // DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, ...
  RedisConfigSchema,       // REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, ...
  KafkaConfigSchema,       // KAFKA_BROKERS, KAFKA_CLIENT_ID, ...
  JwtConfigSchema,         // JWT_SECRET, JWT_EXPIRES_IN, ...
  PrivyConfigSchema,       // PRIVY_APP_ID, PRIVY_APP_SECRET
  ServicesConfigSchema,    // Service ports và URLs
  BlockchainConfigSchema,  // RPC URLs cho Base/BSC mainnet/testnet
  ExternalApisConfigSchema,// ALCHEMY_API_KEY, FIREBASE_SERVER_KEY, ...
  TradingConfigSchema,     // DEFAULT_SLIPPAGE_TOLERANCE, GAS_PRICE_MULTIPLIER, ...
  FrontendConfigSchema,    // NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, ...
  CacheConfigSchema,       // CACHE_TTL_*, CACHE_MAX_KEYS
  ZeroDevConfigSchema,     // ZERODEV_PROJECT_ID
  LoggerConfigSchema,      // LOG_LEVEL, LOG_ENABLE_CONSOLE, LOG_DIR, ...
} from '@moonx-farm/configs';

// Combine theo nhu cầu
const MySchema = BaseConfigSchema
  .merge(DatabaseConfigSchema)
  .merge(RedisConfigSchema)
  .extend({
    MY_CUSTOM_CONFIG: z.string()
  });
```

## 3. Utility methods

```typescript
// Kiểm tra environment
config.isDevelopment();
config.isProduction();
config.isTest();

// Reload config với schema mới
config.reload(MySchema);
```

## 4. Utility functions có sẵn

```typescript
import { 
  getDatabaseConfig, 
  getRedisConfig, 
  getJwtConfig,
  getServiceUrls,
  getBestRpcUrl,
  validateServiceConfig 
} from '@moonx-farm/configs';

// Lấy config specific
const dbConfig = getDatabaseConfig();
const redisConfig = getRedisConfig();
const rpcUrl = getBestRpcUrl('mainnet');
```

## 5. Sử dụng profile có sẵn

```typescript
// Dùng profile name
const config = createConfig('auth-service');

// Hoặc dùng helper functions
import { createAuthServiceConfig } from '@moonx-farm/configs';
const config = createAuthServiceConfig();
```

## 6. Error Handling

```typescript
try {
  const config = createConfig(MyServiceSchema);
} catch (error) {
  console.error('Config validation failed:', error);
  // Handle missing or invalid env vars
}
```

## 7. Environment Variables

Đảm bảo file `.env` ở root project có các biến cần thiết theo schema. Config sẽ tự động validate và báo lỗi nếu thiếu.

---

## Reference: Service profiles có sẵn

| Profile | Helper Function | Config bao gồm |
|---------|----------------|----------------|
| `'api-gateway'` | `createApiGatewayConfig()` | Services, JWT, Redis, Logger |
| `'auth-service'` | `createAuthServiceConfig()` | Database, Redis, JWT, Privy |
| `'wallet-registry'` | `createWalletRegistryConfig()` | Database, Blockchain, JWT, ZeroDev |
| `'core-service'` | `createCoreServiceConfig()` | Database, Redis, Blockchain, External APIs |
| `'aggregator-service'` | `createAggregatorServiceConfig()` | Redis, External APIs, Blockchain, Cache |
| `'swap-orchestrator'` | `createSwapOrchestratorConfig()` | Database, Redis, Kafka, Blockchain, Trading |
| `'position-indexer'` | `createPositionIndexerConfig()` | Database, Redis, Kafka, Blockchain |
| `'notify-service'` | `createNotifyServiceConfig()` | Redis, Kafka |
| `'websocket-gateway'` | `createWebSocketGatewayConfig()` | Redis, Services |
| `'notification-hub'` | `createNotificationHubConfig()` | Redis, Kafka, Firebase |
| `'price-crawler'` | `createPriceCrawlerConfig()` | Redis, Kafka, External APIs, Blockchain |
| `'order-executor'` | `createOrderExecutorConfig()` | Database, Redis, Kafka, Blockchain, Trading |
| `'web'` | `createWebConfig()` | Frontend config |
| `'full'` | `createFullConfig()` | Tất cả config | 