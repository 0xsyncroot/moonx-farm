# MoonX Farm DEX - Configuration Manager

Hệ thống quản lý cấu hình tập trung cho toàn bộ monorepo MoonX Farm DEX. Cho phép mỗi service chỉ load những configuration cần thiết với hỗ trợ RPC fallback và private RPC URLs.

## 🎯 Tính năng

- **Configuration Profiles**: Mỗi service chỉ load config cần thiết
- **Type Safety**: Validation với Zod schema
- **Environment Variables**: Quản lý tập trung từ file `.env` root
- **RPC Management**: Hỗ trợ private RPC và fallback RPC URLs
- **Flexible Usage**: Dễ dàng extend và customize cho từng service
- **Validation**: Kiểm tra config bắt buộc cho từng service

## 📁 Cấu trúc

```
configs/
├── index.ts          # Main config manager & profiles
├── schemas.ts        # Zod schemas cho validation
├── utils.ts          # Utility functions & RPC management
├── example.ts        # Usage examples
├── package.json      # @moonx/configs
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

#### Quote Service với RPC Management
```typescript
import { 
  createAggregatorServiceConfig, 
  getRedisConfig, 
  getApiKeys, 
  getNetworkConfigs,
  getRpcConfig,
  getBestRpcUrl 
} from '@moonx/configs';

const config = createAggregatorServiceConfig();

// Redis cho caching
const redisConfig = getRedisConfig('aggregator-service');

// API keys cho external services
const apiKeys = getApiKeys('aggregator-service');
console.log(apiKeys.coingecko); // your-coingecko-api-key

// Blockchain networks với RPC management
const networks = getNetworkConfigs('aggregator-service');
const baseMainnet = networks.base.mainnet;

// Lấy RPC URL tốt nhất (private trước, fallback sau)
const bestRpcUrl = getBestRpcUrl(baseMainnet);
console.log('Best RPC URL:', bestRpcUrl);

// Hoặc sử dụng RPC config helper
const rpcConfig = getRpcConfig('aggregator-service', 'base', 'mainnet');
console.log('Private RPC:', rpcConfig.privateRpc);
console.log('Fallback RPCs:', rpcConfig.fallbackRpcs);
console.log('Best URL:', rpcConfig.getBestUrl());
```

#### Swap Orchestrator với RPC Fallback
```typescript
import { 
  createSwapOrchestratorConfig, 
  getDatabaseConfig, 
  getRedisConfig, 
  getKafkaConfig,
  getTradingConfig,
  getAllRpcUrls 
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

// RPC URLs cho fallback
const networks = getNetworkConfigs('swap-orchestrator');
const baseAllRpcs = getAllRpcUrls(networks.base.mainnet);
console.log('All Base RPCs:', baseAllRpcs); // [privateRpc, fallback1, fallback2, ...]
```

### 3. RPC Management

#### Private RPC vs Fallback RPCs
```typescript
import { getRpcConfig, hasPrivateRpc, getPublicRpcUrls } from '@moonx/configs';

const rpcConfig = getRpcConfig('aggregator-service', 'base', 'mainnet');

// Kiểm tra có private RPC không
if (rpcConfig.hasPrivate()) {
  console.log('Using private RPC for high-speed operations');
  // Sử dụng private RPC cho operations cần tốc độ
} else {
  console.log('Using public fallback RPCs');
  // Sử dụng fallback RPCs
}

// Lấy chỉ public RPC URLs
const publicRpcs = rpcConfig.getPublicUrls();
console.log('Public RPCs:', publicRpcs);
```

#### Fallback Implementation
```typescript
import { getAllRpcUrls } from '@moonx/configs';

const networks = getNetworkConfigs('swap-orchestrator');
const baseAllRpcs = getAllRpcUrls(networks.base.mainnet);

// Thử từng RPC URL theo thứ tự
for (const rpcUrl of baseAllRpcs) {
  try {
    console.log(`Trying RPC: ${rpcUrl}`);
    
    // Thực hiện RPC call
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    if (response.ok) {
      console.log(`✅ RPC ${rpcUrl} is working`);
      return rpcUrl; // Sử dụng RPC URL này
    }
  } catch (error) {
    console.log(`❌ RPC ${rpcUrl} failed:`, error.message);
    continue; // Thử RPC URL tiếp theo
  }
}

throw new Error('All RPC URLs failed');
```

## 📋 Configuration Profiles

### Available Profiles

| Profile | Description | Includes |
|---------|-------------|----------|
| `api-gateway` | API Gateway service | Base, Services, JWT, Redis |
| `auth-service` | Authentication service | Base, Database, Redis, JWT |
| `wallet-registry` | Wallet management | Base, Database, Blockchain |
| `aggregator-service` | Price quotes | Base, Redis, External APIs, Blockchain |
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
const aggregatorConfig = createConfig('aggregator-service');
const webConfig = createConfig('web');

// Hoặc sử dụng helper functions
import { 
  createAuthServiceConfig,
  createAggregatorServiceConfig,
  createWebConfig 
} from '@moonx/configs';

const authConfig = createAuthServiceConfig();
const aggregatorConfig = createAggregatorServiceConfig();
const webConfig = createWebConfig();
```

## 🔧 Configuration Schemas

### Base Configuration
```typescript
NODE_ENV: 'development' | 'production' | 'test'
LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug'
APP_NAME: string
APP_VERSION: string
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
DATABASE_IDLE_TIMEOUT_MS: number
DATABASE_CONNECTION_TIMEOUT_MS: number
```

### Redis Configuration
```typescript
REDIS_HOST: string
REDIS_PORT: number
REDIS_PASSWORD?: string
REDIS_DB: number
REDIS_KEY_PREFIX: string
REDIS_ENABLE_READY_CHECK: boolean
REDIS_LAZY_CONNECT: boolean
REDIS_MAX_RETRIES_PER_REQUEST: number
REDIS_CONNECT_TIMEOUT: number
REDIS_COMMAND_TIMEOUT: number
```

### Blockchain Configuration
```typescript
// Base Mainnet
BASE_MAINNET_RPC?: string (private RPC URL)
BASE_MAINNET_FALLBACK_RPCS: string (comma-separated public RPCs)
BASE_MAINNET_CHAIN_ID: number
BASE_MAINNET_EXPLORER: string

// Base Testnet
BASE_TESTNET_RPC?: string (private RPC URL)
BASE_TESTNET_FALLBACK_RPCS: string (comma-separated public RPCs)
BASE_TESTNET_CHAIN_ID: number
BASE_TESTNET_EXPLORER: string

// BSC Mainnet
BSC_MAINNET_RPC?: string (private RPC URL)
BSC_MAINNET_FALLBACK_RPCS: string (comma-separated public RPCs)
BSC_MAINNET_CHAIN_ID: number
BSC_MAINNET_EXPLORER: string

// BSC Testnet
BSC_TESTNET_RPC?: string (private RPC URL)
BSC_TESTNET_FALLBACK_RPCS: string (comma-separated public RPCs)
BSC_TESTNET_CHAIN_ID: number
BSC_TESTNET_EXPLORER: string
```

## 🛠️ Utility Functions

### Configuration Utilities
```typescript
import {
  getDatabaseConfig,
  getRedisConfig,
  getKafkaConfig,
  getJwtConfig,
  getServiceUrls,
  getNetworkConfigs,
  getTradingConfig,
  getApiKeys,
  getCacheConfig,
  validateServiceConfig,
  getServerConfig,
} from '@moonx/configs';

// Lấy config cho từng service
const dbConfig = getDatabaseConfig('auth-service');
const redisConfig = getRedisConfig('aggregator-service');
const networks = getNetworkConfigs('swap-orchestrator');
```

### RPC Management Utilities
```typescript
import {
  getBestRpcUrl,
  getAllRpcUrls,
  getPublicRpcUrls,
  hasPrivateRpc,
  getRpcConfig,
} from '@moonx/configs';

// Lấy RPC URL tốt nhất
const bestUrl = getBestRpcUrl(networkConfig);

// Lấy tất cả RPC URLs (private trước, fallback sau)
const allUrls = getAllRpcUrls(networkConfig);

// Lấy chỉ public RPC URLs
const publicUrls = getPublicRpcUrls(networkConfig);

// Kiểm tra có private RPC không
const hasPrivate = hasPrivateRpc(networkConfig);

// Lấy RPC config hoàn chỉnh
const rpcConfig = getRpcConfig('aggregator-service', 'base', 'mainnet');
```

## 🔄 Migration từ Common Package

### Trước (Legacy)
```typescript
import { validateEnv, BaseEnvSchema } from '@moonx/common';

const AuthServiceEnvSchema = BaseEnvSchema.extend({
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
});

export const env = validateEnv(AuthServiceEnvSchema);
```

### Sau (Configs Package)
```typescript
import { createAuthServiceConfig } from '@moonx/configs';

const config = createAuthServiceConfig();
const privyAppId = config.get('PRIVY_APP_ID');
const privyAppSecret = config.get('PRIVY_APP_SECRET');
```

## 📝 Environment Variables

### Blockchain RPC Configuration
```bash
# Base Mainnet
BASE_MAINNET_RPC=https://your-private-base-rpc.com
BASE_MAINNET_FALLBACK_RPCS=https://mainnet.base.org,https://base.blockpi.network/v1/rpc/public,https://1rpc.io/base,https://base.meowrpc.com
BASE_MAINNET_CHAIN_ID=8453
BASE_MAINNET_EXPLORER=https://basescan.org

# Base Testnet
BASE_TESTNET_RPC=https://your-private-base-testnet-rpc.com
BASE_TESTNET_FALLBACK_RPCS=https://sepolia.base.org,https://base-sepolia.blockpi.network/v1/rpc/public,https://base-sepolia.publicnode.com
BASE_TESTNET_CHAIN_ID=84532
BASE_TESTNET_EXPLORER=https://sepolia.basescan.org

# BSC Mainnet
BSC_MAINNET_RPC=https://your-private-bsc-rpc.com
BSC_MAINNET_FALLBACK_RPCS=https://bsc-dataseed1.binance.org,https://bsc-dataseed2.binance.org,https://bsc-dataseed3.binance.org,https://bsc-dataseed4.binance.org,https://bsc.nodereal.io
BSC_MAINNET_CHAIN_ID=56
BSC_MAINNET_EXPLORER=https://bscscan.com

# BSC Testnet
BSC_TESTNET_RPC=https://your-private-bsc-testnet-rpc.com
BSC_TESTNET_FALLBACK_RPCS=https://data-seed-prebsc-1-s1.binance.org:8545,https://data-seed-prebsc-2-s1.binance.org:8545,https://data-seed-prebsc-1-s2.binance.org:8545,https://data-seed-prebsc-2-s2.binance.org:8545
BSC_TESTNET_CHAIN_ID=97
BSC_TESTNET_EXPLORER=https://testnet.bscscan.com
```

## 🚀 Setup

### 1. Automated Setup
```bash
# Chạy script setup tự động
./scripts/setup-env.sh

# Script sẽ:
# - Tạo .env từ env.example
# - Generate secure JWT/session secrets
# - Prompt cho database, Redis, Kafka config
# - Tạo environment-specific files
```

### 2. Manual Setup
```bash
# Copy environment template
cp env.example .env

# Điền các giá trị thực tế
nano .env

# Install dependencies
pnpm install

# Build packages
pnpm build
```

## 🔒 Security Best Practices

1. **Private RPC URLs**: Sử dụng private RPC cho production
2. **Fallback RPCs**: Luôn có fallback RPCs cho reliability
3. **Environment Separation**: Sử dụng different configs cho dev/staging/prod
4. **Secret Management**: Không commit secrets vào version control
5. **Validation**: Luôn validate environment variables với Zod schemas

## 📚 Examples

Xem file `example.ts` để có thêm examples chi tiết về:
- Basic network configuration
- RPC utilities usage
- Service-specific RPC usage
- Environment-specific configuration
- Fallback RPC implementation 

## Logger Configuration

The system includes centralized logger configuration with the following features:

### Environment Variables

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Enable console logging
LOG_ENABLE_CONSOLE=true

# Enable file logging (recommended for production)
LOG_ENABLE_FILE=false

# Log directory
LOG_DIR=logs

# Maximum number of log files to keep
LOG_MAX_FILES=5

# Maximum size of each log file (e.g., 10m, 100m, 1g)
LOG_MAX_SIZE=10m

# Log format (json, console)
LOG_FORMAT=console
```

### Usage Examples

```typescript
import { createLogger, createLoggerForProfile, createLoggerWithConfig, LoggerConfig } from '@moonx/common';

// Basic usage with default configuration
const logger = createLogger('auth-service');
logger.info('Service started', { port: 3001 });

// Profile-based configuration (recommended)
const authLogger = createLoggerForProfile('auth-service');
authLogger.info('Auth service started', { port: 3001 });

const aggregatorLogger = createLoggerForProfile('aggregator-service');
aggregatorLogger.debug('Aggregator calculation started', { 
  tokenIn: 'USDC', 
  tokenOut: 'ETH',
  amount: '1000'
});

// Custom configuration
const customConfig: LoggerConfig = {
  level: 'debug',
  service: 'aggregator-service',
  enableConsole: true,
  enableFile: true,
  logDir: 'logs/aggregator',
  maxFiles: 10,
  maxSize: '20m',
  format: 'json',
};

const customLogger = createLoggerWithConfig(customConfig);

// Environment-specific configuration
const getLoggerForEnvironment = (service: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const config: LoggerConfig = {
    level: isProduction ? 'info' : 'debug',
    service,
    enableConsole: !isProduction,
    enableFile: isProduction,
    logDir: 'logs',
    maxFiles: isProduction ? 10 : 5,
    maxSize: isProduction ? '50m' : '10m',
    format: isProduction ? 'json' : 'console',
  };
  
  return createLoggerWithConfig(config);
};

// Child logger with context
const userLogger = authLogger.child({ userId: 'user123' });
userLogger.info('User action performed', { action: 'login' });
```

### Features

- **Profile-based**: Each service can have its own logger configuration
- **Environment-aware**: Different settings for development, staging, and production
- **Flexible output**: Console and/or file logging
- **Structured logging**: JSON format for production, colored console for development
- **Context support**: Child loggers with default context
- **Performance timing**: Built-in timing utilities
- **Error handling**: Automatic error logging with context

## Environment Variables 