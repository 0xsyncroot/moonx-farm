# @moonx/configs Package - Centralized Configuration Management

## Tổng Quan

`@moonx/configs` là centralized configuration management system cho toàn bộ MoonXFarm DEX monorepo, cung cấp profile-based loading và type-safe configuration management.

## Kiến Trúc Package

### File Structure
```
configs/
├── package.json                # @moonx/configs package definition
├── tsconfig.json              # TypeScript configuration
├── README.md                  # Package documentation
├── index.ts                   # Main config manager with profiles
├── utils.ts                   # Configuration utility functions
├── env.ts                     # Environment variable schemas (Zod)
└── example.ts                 # Usage examples
```

### Core Philosophy
- **Profile-Based Loading**: Mỗi service chỉ load config cần thiết
- **Type Safety**: Zod schemas với TypeScript type inference
- **Environment Management**: Centralized .env handling
- **Utility Functions**: Helper functions cho common config tasks

## Profile-Based Configuration Loading

### Available Profiles

| Profile | Includes | Use Case |
|---------|----------|----------|
| `api-gateway` | Base + Services + JWT + Redis | API Gateway routing |
| `auth-service` | Base + Database + Redis + JWT | User authentication |
| `wallet-registry` | Base + Database + Blockchain | Wallet management |
| `aggregator-service` | Base + Redis + APIs + Blockchain | Price quotes |
| `swap-orchestrator` | Base + DB + Redis + Kafka + Blockchain + Trading | Trade execution |
| `position-indexer` | Base + DB + Redis + Kafka + Blockchain | Portfolio tracking |
| `notify-service` | Base + Redis + Kafka | Real-time notifications |
| `price-crawler` | Base + Redis + Kafka + APIs + Blockchain | Price aggregation |
| `order-executor` | Base + DB + Redis + Kafka + Blockchain + Trading | Order processing |
| `web` | Base + Frontend | Next.js frontend |
| `full` | All schemas | Development/testing |

### Usage Examples

#### Service-Specific Config Loading
```typescript
// Auth Service - chỉ load database, Redis, JWT config
import { createAuthServiceConfig } from '@moonx/configs';
const config = createAuthServiceConfig();

// Access typed config values
const dbUrl = config.get('DATABASE_URL');           // string
const redisHost = config.get('REDIS_HOST');         // string
const jwtSecret = config.get('JWT_SECRET');         // string
const port = config.get('PORT');                    // number
```

#### Quote Service Configuration
```typescript
// Quote Service - cần Redis, external APIs, blockchain
import { createQuoteServiceConfig } from '@moonx/configs';
const config = createQuoteServiceConfig();

// Blockchain config
const baseRpc = config.get('BASE_MAINNET_RPC');     // string
const bscRpc = config.get('BSC_MAINNET_RPC');       // string

// API keys
const lifiApiKey = config.get('LIFI_API_KEY');      // string | undefined
const oneInchKey = config.get('ONEINCH_API_KEY');   // string | undefined

// Redis config
const redisUrl = config.get('REDIS_URL');           // string
```

#### Full Config (Development)
```typescript
// Load all schemas for development/testing
import { createFullConfig } from '@moonx/configs';
const config = createFullConfig();

// Access any config value
const dbUrl = config.get('DATABASE_URL');
const kafkaUrl = config.get('KAFKA_URL');
const privyKey = config.get('PRIVY_APP_SECRET');
```

## Configuration Schemas (env.ts)

### Schema Categories

#### Base Schema
```typescript
export const BaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('*'),
  REQUEST_TIMEOUT: z.coerce.number().default(30000)
});
```

#### Database Schema
```typescript
export const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string(),
  DATABASE_USER: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_SSL: z.boolean().default(false),
  DATABASE_POOL_SIZE: z.coerce.number().default(10)
});
```

#### Redis Schema
```typescript
export const RedisSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_TTL_DEFAULT: z.coerce.number().default(300)
});
```

#### Blockchain Schema
```typescript
export const BlockchainSchema = z.object({
  // Base Network
  BASE_MAINNET_RPC: z.string().url(),
  BASE_TESTNET_RPC: z.string().url(),
  
  // BSC Network
  BSC_MAINNET_RPC: z.string().url(),
  BSC_TESTNET_RPC: z.string().url(),
  
  // Deployment
  PRIVATE_KEY: z.string().optional(),
  FEE_RECIPIENT: z.string().optional(),
  
  // API Keys for verification
  BASESCAN_API_KEY: z.string().optional(),
  BSCSCAN_API_KEY: z.string().optional()
});
```

#### External APIs Schema
```typescript
export const ApiKeysSchema = z.object({
  // Aggregators
  LIFI_API_KEY: z.string().optional(),
  ONEINCH_API_KEY: z.string().optional(),
  RELAY_API_KEY: z.string().optional(),
  
  // Price feeds
  COINGECKO_API_KEY: z.string().optional(),
  DEXSCREENER_API_KEY: z.string().optional(),
  
  // Auth providers
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  
  // Account Abstraction
  ZERODEV_PROJECT_ID: z.string().optional(),
  ZERODEV_API_KEY: z.string().optional()
});
```

#### JWT Schema
```typescript
export const JwtSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRY: z.string().default('7d')
});
```

#### Kafka Schema
```typescript
export const KafkaSchema = z.object({
  KAFKA_URL: z.string(),
  KAFKA_CLIENT_ID: z.string().default('moonx-farm'),
  KAFKA_GROUP_ID: z.string(),
  KAFKA_TOPICS: z.object({
    ORDER_CREATED: z.string().default('order.created'),
    ORDER_UPDATED: z.string().default('order.updated'),
    PRICE_UPDATED: z.string().default('price.updated'),
    SWAP_EXECUTED: z.string().default('swap.executed')
  }).default({})
});
```

## Utility Functions (utils.ts)

### Database Utilities
```typescript
export function getDatabaseConfig(service: ServiceProfile) {
  const config = createConfigForService(service);
  
  return {
    url: config.get('DATABASE_URL'),
    host: config.get('DATABASE_HOST'),
    port: config.get('DATABASE_PORT'),
    database: config.get('DATABASE_NAME'),
    username: config.get('DATABASE_USER'),
    password: config.get('DATABASE_PASSWORD'),
    ssl: config.get('DATABASE_SSL'),
    pool: {
      max: config.get('DATABASE_POOL_SIZE'),
      min: 2,
      idle: 10000
    }
  };
}
```

### Redis Utilities
```typescript
export function getRedisConfig(service: ServiceProfile) {
  const config = createConfigForService(service);
  
  return {
    url: config.get('REDIS_URL'),
    host: config.get('REDIS_HOST'),
    port: config.get('REDIS_PORT'),
    password: config.get('REDIS_PASSWORD'),
    db: config.get('REDIS_DB'),
    ttl: {
      default: config.get('REDIS_TTL_DEFAULT'),
      session: 86400, // 24 hours
      cache: 300      // 5 minutes
    }
  };
}
```

### Network Configuration
```typescript
export function getNetworkConfigs(service: ServiceProfile) {
  const config = createConfigForService(service);
  
  return {
    base: {
      mainnet: {
        chainId: 8453,
        rpc: config.get('BASE_MAINNET_RPC'),
        explorer: 'https://basescan.org'
      },
      testnet: {
        chainId: 84532,
        rpc: config.get('BASE_TESTNET_RPC'),
        explorer: 'https://sepolia.basescan.org'
      }
    },
    bsc: {
      mainnet: {
        chainId: 56,
        rpc: config.get('BSC_MAINNET_RPC'),
        explorer: 'https://bscscan.com'
      },
      testnet: {
        chainId: 97,
        rpc: config.get('BSC_TESTNET_RPC'),
        explorer: 'https://testnet.bscscan.com'
      }
    }
  };
}
```

### Trading Configuration
```typescript
export function getTradingConfig(service: ServiceProfile) {
  const config = createConfigForService(service);
  
  return {
    limits: {
      maxOrderSize: ethers.parseEther('1000'),
      minOrderSize: ethers.parseEther('0.001'),
      maxSlippage: 500, // 5%
      priceImpactWarning: 300 // 3%
    },
    timeouts: {
      quoteTimeout: 30000,
      executionTimeout: 120000,
      confirmationTimeout: 300000
    },
    fees: {
      defaultFeeBps: 30, // 0.3%
      maxFeeBps: 100     // 1%
    }
  };
}
```

## Service Profile Definitions

### Core Profiles Implementation

```typescript
// Auth Service Profile
export function createAuthServiceConfig() {
  return createConfig([
    BaseSchema,
    DatabaseSchema,
    RedisSchema,
    JwtSchema
  ]);
}

// Quote Service Profile  
export function createQuoteServiceConfig() {
  return createConfig([
    BaseSchema,
    RedisSchema,
    ApiKeysSchema,
    BlockchainSchema
  ]);
}

// Swap Orchestrator Profile
export function createSwapOrchestratorConfig() {
  return createConfig([
    BaseSchema,
    DatabaseSchema,
    RedisSchema,
    KafkaSchema,
    BlockchainSchema,
    TradingSchema,
    ApiKeysSchema
  ]);
}

// Web Frontend Profile
export function createWebConfig() {
  return createConfig([
    BaseSchema,
    FrontendSchema,
    ApiKeysSchema.pick({
      PRIVY_APP_ID: true,
      ZERODEV_PROJECT_ID: true
    })
  ]);
}
```

## Environment Management

### Environment Loading Strategy
```typescript
// Load from root .env file
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

// Create config instance với validation
function createConfig(schemas: ZodSchema[]) {
  const mergedSchema = schemas.reduce((acc, schema) => acc.merge(schema));
  
  try {
    const validatedEnv = mergedSchema.parse(process.env);
    return new ConfigManager(validatedEnv);
  } catch (error) {
    if (error instanceof ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
}
```

### Environment Variables Documentation
```bash
# Required for all services
NODE_ENV=development
LOG_LEVEL=info
PORT=3000

# Database (for services using database)
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_farm
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=moonx_farm
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# Redis (for caching services)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain networks
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_TESTNET_RPC=https://sepolia.base.org
BSC_MAINNET_RPC=https://bsc-dataseed1.binance.org
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545

# API Keys (optional)
LIFI_API_KEY=your_lifi_api_key
ONEINCH_API_KEY=your_1inch_api_key
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_secret
```

## Best Practices

### Configuration Design
- Use specific profiles cho mỗi service
- Validate environment variables at startup
- Provide sensible defaults where possible
- Document all configuration options

### Security
- Never commit .env files
- Use different configs cho different environments
- Rotate API keys regularly
- Use strong secrets cho JWT

### Performance
- Load configs once at startup
- Cache configuration objects
- Use lazy loading cho expensive operations
- Minimize config reads in hot paths

## Error Handling

### Configuration Validation Errors
```typescript
try {
  const config = createAuthServiceConfig();
} catch (error) {
  if (error.message.includes('Missing or invalid')) {
    logger.error('Configuration validation failed', { error: error.message });
    process.exit(1);
  }
  throw error;
}
```

### Runtime Configuration Checks
```typescript
// Check critical configs at startup
function validateCriticalConfigs(config: ConfigManager) {
  const criticalConfigs = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
  
  for (const key of criticalConfigs) {
    if (!config.has(key)) {
      throw new Error(`Critical configuration missing: ${key}`);
    }
  }
}
```

## Testing

### Configuration Testing
```typescript
// Test configuration loading
describe('Configuration', () => {
  it('should load auth service config', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-secret-32-characters-long';
    
    const config = createAuthServiceConfig();
    
    expect(config.get('DATABASE_URL')).toBe('postgresql://test:test@localhost/test');
    expect(config.get('JWT_SECRET')).toBe('test-secret-32-characters-long');
  });
});
```

## Migration Guide

### From Direct Environment Variables
```typescript
// Before
const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost/db';

// After
import { createAuthServiceConfig } from '@moonx/configs';
const config = createAuthServiceConfig();
const dbUrl = config.get('DATABASE_URL');
```

### From packages/infrastructure
```typescript
// Before
import { databaseConfig } from '@moonx/infrastructure';

// After
import { getDatabaseConfig } from '@moonx/configs';
const dbConfig = getDatabaseConfig('auth-service');
```

---

**Related**: [Shared Packages Overview](./shared-packages-overview.md) | [Common Package](./common-package.md)
