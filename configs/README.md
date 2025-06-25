# MoonX Farm DEX - Configuration Manager

Hệ thống quản lý cấu hình tập trung cho toàn bộ monorepo MoonX Farm DEX. Cho phép mỗi service chỉ load những configuration cần thiết.

## 🎯 Tính năng

- **Configuration Profiles**: Mỗi service chỉ load config cần thiết
- **Type Safety**: Validation với Zod schema
- **Environment Variables**: Quản lý tập trung từ file `.env` root
- **Flexible Usage**: Dễ dàng extend và customize cho từng service
- **Validation**: Kiểm tra config bắt buộc cho từng service

## 📁 Cấu trúc

```
configs/
├── index.ts          # Main config manager
├── utils.ts          # Utility functions
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
└── README.md         # Documentation
```

## 🚀 Sử dụng

### 1. Tạo file .env ở root project

```bash
# Copy từ env.example
cp env.example .env

# Điền các giá trị thực tế
nano .env
```

### 2. Sử dụng trong service

#### Auth Service
```typescript
import { createAuthServiceConfig, getDatabaseConfig, getRedisConfig, getJwtConfig } from '@moonx/configs';

// Tạo config cho auth service
const config = createAuthServiceConfig();

// Lấy database config
const dbConfig = getDatabaseConfig('auth-service');
console.log(dbConfig.host); // localhost

// Lấy Redis config
const redisConfig = getRedisConfig('auth-service');
console.log(redisConfig.port); // 6379

// Lấy JWT config
const jwtConfig = getJwtConfig('auth-service');
console.log(jwtConfig.secret); // your-jwt-secret
```

#### Quote Service
```typescript
import { createQuoteServiceConfig, getRedisConfig, getApiKeys, getNetworkConfigs } from '@moonx/configs';

const config = createQuoteServiceConfig();

// Redis cho caching
const redisConfig = getRedisConfig('quote-service');

// API keys cho external services
const apiKeys = getApiKeys('quote-service');
console.log(apiKeys.coingecko); // your-coingecko-api-key

// Blockchain networks
const networks = getNetworkConfigs('quote-service');
console.log(networks.base.mainnet.rpc); // https://mainnet.base.org
```

#### Swap Orchestrator
```typescript
import { 
  createSwapOrchestratorConfig, 
  getDatabaseConfig, 
  getRedisConfig, 
  getKafkaConfig,
  getTradingConfig 
} from '@moonx/configs';

const config = createSwapOrchestratorConfig();

// Database
const dbConfig = getDatabaseConfig('swap-orchestrator');

// Redis
const redisConfig = getRedisConfig('swap-orchestrator');

// Kafka
const kafkaConfig = getKafkaConfig('swap-orchestrator');

// Trading parameters
const tradingConfig = getTradingConfig('swap-orchestrator');
console.log(tradingConfig.defaultSlippageTolerance); // 0.5
```

### 3. Sử dụng với @moonx/config package

```typescript
import { createDatabase, createRedis, createKafka } from '@moonx/config';
import { getDatabaseConfig, getRedisConfig, getKafkaConfig } from '@moonx/configs';

// Tạo database connection
const dbConfig = getDatabaseConfig('auth-service');
const database = createDatabase(dbConfig);

// Tạo Redis connection
const redisConfig = getRedisConfig('auth-service');
const redis = createRedis(redisConfig);

// Tạo Kafka connection
const kafkaConfig = getKafkaConfig('swap-orchestrator');
const kafka = createKafka(kafkaConfig);
```

## 📋 Configuration Profiles

### Available Profiles

| Profile | Description | Includes |
|---------|-------------|----------|
| `api-gateway` | API Gateway service | Base, Services, JWT, Redis |
| `auth-service` | Authentication service | Base, Database, Redis, JWT |
| `wallet-registry` | Wallet management | Base, Database, Blockchain |
| `quote-service` | Price quotes | Base, Redis, External APIs, Blockchain |
| `swap-orchestrator` | Trade execution | Base, Database, Redis, Kafka, Blockchain, Trading |
| `position-indexer` | Portfolio tracking | Base, Database, Redis, Kafka, Blockchain |
| `notify-service` | Notifications | Base, Redis, Kafka |
| `price-crawler` | Price aggregation worker | Base, Redis, Kafka, External APIs, Blockchain |
| `order-executor` | Order processing worker | Base, Database, Redis, Kafka, Blockchain, Trading |
| `web` | Frontend Next.js app | Base, Frontend |
| `full` | Full configuration | All schemas |

### Profile Usage

```typescript
import { createConfig } from '@moonx/configs';

// Tạo config cho service cụ thể
const authConfig = createConfig('auth-service');
const quoteConfig = createConfig('quote-service');
const webConfig = createConfig('web');

// Hoặc sử dụng helper functions
import { 
  createAuthServiceConfig,
  createQuoteServiceConfig,
  createWebConfig 
} from '@moonx/configs';

const authConfig = createAuthServiceConfig();
const quoteConfig = createQuoteServiceConfig();
const webConfig = createWebConfig();
```

## 🔧 Configuration Schemas

### Base Configuration
```typescript
NODE_ENV: 'development' | 'production' | 'test'
LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug'
APP_NAME: string
```

### Database Configuration
```typescript
DATABASE_HOST: string
DATABASE_PORT: number
DATABASE_NAME: string
DATABASE_USER: string
DATABASE_PASSWORD: string
DATABASE_SSL: boolean
DATABASE_MAX_CONNECTIONS: number
```

### Redis Configuration
```typescript
REDIS_HOST: string
REDIS_PORT: number
REDIS_PASSWORD?: string
REDIS_DB: number
REDIS_KEY_PREFIX: string
```

### Kafka Configuration
```typescript
KAFKA_BROKERS: string (comma-separated)
KAFKA_CLIENT_ID: string
KAFKA_SSL: boolean
KAFKA_USERNAME?: string
KAFKA_PASSWORD?: string
```

## 🛠️ Utility Functions

### getDatabaseConfig(profile)
Lấy database configuration cho service.

### getRedisConfig(profile)
Lấy Redis configuration cho service.

### getKafkaConfig(profile)
Lấy Kafka configuration cho service.

### getJwtConfig(profile)
Lấy JWT configuration cho service.

### getServiceUrls(profile)
Lấy URLs của tất cả services.

### getNetworkConfigs(profile)
Lấy blockchain network configurations.

### getTradingConfig(profile)
Lấy trading parameters.

### getApiKeys(profile)
Lấy external API keys.

### getServerConfig(profile)
Lấy server host/port cho service.

### validateServiceConfig(profile, requiredConfigs)
Validate config bắt buộc cho service.

## 📝 Ví dụ thực tế

### Setup Auth Service

```typescript
// services/auth-service/src/index.ts
import express from 'express';
import { createDatabase } from '@moonx/config';
import { createRedis } from '@moonx/config';
import { 
  createAuthServiceConfig,
  getDatabaseConfig,
  getRedisConfig,
  getJwtConfig,
  getServerConfig 
} from '@moonx/config-manager';

async function startAuthService() {
  // Load config
  const config = createAuthServiceConfig();
  
  // Setup database
  const dbConfig = getDatabaseConfig('auth-service');
  const database = createDatabase(dbConfig);
  await database.connect();
  
  // Setup Redis
  const redisConfig = getRedisConfig('auth-service');
  const redis = createRedis(redisConfig);
  await redis.connect();
  
  // Setup JWT
  const jwtConfig = getJwtConfig('auth-service');
  
  // Setup server
  const serverConfig = getServerConfig('auth-service');
  const app = express();
  
  app.listen(serverConfig.port, () => {
    console.log(`Auth service running on port ${serverConfig.port}`);
  });
}

startAuthService();
```

### Setup Quote Service

```typescript
// services/quote-service/src/index.ts
import { 
  createQuoteServiceConfig,
  getRedisConfig,
  getApiKeys,
  getNetworkConfigs,
  getServerConfig 
} from '@moonx/config-manager';

async function startQuoteService() {
  const config = createQuoteServiceConfig();
  
  // Redis for caching
  const redisConfig = getRedisConfig('quote-service');
  
  // External API keys
  const apiKeys = getApiKeys('quote-service');
  
  // Blockchain networks
  const networks = getNetworkConfigs('quote-service');
  
  // Server config
  const serverConfig = getServerConfig('quote-service');
  
  console.log('Quote service configuration loaded:', {
    redis: redisConfig.host,
    coingecko: !!apiKeys.coingecko,
    baseRpc: networks.base.mainnet.rpc,
    port: serverConfig.port
  });
}
```

## 🔄 Dynamic Configuration

### Reload Configuration
```typescript
const config = createAuthServiceConfig();

// Reload configuration (useful for testing)
config.reload();
```

### Environment-specific Configuration
```typescript
const config = createAuthServiceConfig();

if (config.isDevelopment()) {
  console.log('Running in development mode');
}

if (config.isProduction()) {
  console.log('Running in production mode');
}
```

## 🧪 Testing

```typescript
// test/config.test.ts
import { createConfig, validateServiceConfig } from '@moonx/config-manager';

describe('Configuration', () => {
  test('should load auth service config', () => {
    const config = createConfig('auth-service');
    expect(config.get('NODE_ENV')).toBeDefined();
  });
  
  test('should validate required configs', () => {
    expect(() => {
      validateServiceConfig('auth-service', ['JWT_SECRET']);
    }).not.toThrow();
  });
});
```

## 🚨 Best Practices

1. **Single Source of Truth**: Tất cả environment variables trong file `.env` root
2. **Profile-based Loading**: Mỗi service chỉ load config cần thiết
3. **Type Safety**: Sử dụng TypeScript types từ config schemas
4. **Validation**: Validate config khi service khởi động
5. **Environment Separation**: Sử dụng `.env.development`, `.env.production` khi cần

## 🔗 Integration với Services

### package.json của service
```json
{
  "dependencies": {
    "@moonx/config-manager": "workspace:*",
    "@moonx/config": "workspace:*"
  }
}
```

### Service index.ts
```typescript
import { createServiceConfig, getServerConfig } from '@moonx/config-manager';

const config = createServiceConfig('your-service-name');
const serverConfig = getServerConfig('your-service-name');

// Your service logic here
```

Hệ thống này giúp quản lý configuration một cách tập trung, type-safe và dễ bảo trì cho toàn bộ monorepo! 🎉 