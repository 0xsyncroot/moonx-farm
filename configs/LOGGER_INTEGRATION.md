# Logger Integration with @moonx/configs

## Overview

The logger system in `@moonx/common` has been integrated with the centralized configuration system in `@moonx/configs` to provide profile-based logging configuration.

## What's Been Implemented

### 1. Logger Configuration Schema (`configs/schemas.ts`)

```typescript
export const LoggerConfigSchema = z.object({
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_ENABLE_CONSOLE: z.coerce.boolean().default(true),
  LOG_ENABLE_FILE: z.coerce.boolean().default(false),
  LOG_DIR: z.string().default('logs'),
  LOG_MAX_FILES: z.coerce.number().default(5),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_FORMAT: z.enum(['json', 'console']).default('console'),
});
```

### 2. Environment Variables (`configs/env.example`)

```bash
# Logger Configuration
LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=false
LOG_DIR=logs
LOG_MAX_FILES=5
LOG_MAX_SIZE=10m
LOG_FORMAT=console
```

### 3. Profile Integration (`configs/index.ts`)

All profiles now include logger configuration:
- `api-gateway`
- `auth-service`
- `wallet-registry`
- `aggregator-service`
- `swap-orchestrator`
- `position-indexer`
- `notify-service`
- `web`
- `full`

### 4. Logger Utilities (`configs/utils.ts`)

```typescript
export function getLoggerConfig() {
  return {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    service: process.env.APP_NAME || 'moonx-farm',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    logDir: process.env.LOG_DIR || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    format: (process.env.LOG_FORMAT as 'json' | 'console') || 'console',
  };
}
```

### 5. Enhanced Logger (`packages/common/src/logger.ts`)

#### New Functions:

1. **`createLoggerForProfile(profile, level?)`** - Creates logger using profile configuration
2. **`getLoggerConfigFromConfigs()`** - Gets config from @moonx/configs with fallback
3. **Enhanced `createLogger()`** - Now tries to use profile config first

#### Features:

- **Profile-based configuration**: Each service can have its own logger settings
- **Fallback mechanism**: Falls back to environment variables if configs package unavailable
- **Type safety**: Full TypeScript support with Zod validation
- **Flexible output**: Console and/or file logging
- **Environment-aware**: Different settings for dev/staging/production

## Usage Examples

### Type-Safe Usage (Recommended)

```typescript
import { createLoggerForService, createLoggerForProfile, ConfigProfile } from '@moonx/common';

// Type-safe service logger creation
const authLogger = createLoggerForService('auth-service');
const aggregatorLogger = createLoggerForService('aggregator-service', 'debug');

// Type-safe profile logger creation
const fullLogger = createLoggerForProfile('full');

// This will cause a TypeScript error:
// const invalidLogger = createLoggerForService('invalid-service'); // ❌ Error
```

### Flexible Usage (Any Service Name)

```typescript
import { createLoggerForAnyService, createLogger } from '@moonx/common';

// Any service name (uses environment variables)
const customLogger = createLoggerForAnyService('my-custom-service');
const debugLogger = createLoggerForAnyService('debug-service', 'debug');

// Legacy usage (still works)
const logger = createLogger('auth-service');
```

### Custom Configuration

```typescript
import { createLoggerWithConfig, LoggerConfig } from '@moonx/common';

const config: LoggerConfig = {
  level: 'debug',
  service: 'custom-service',
  enableConsole: true,
  enableFile: true,
  logDir: 'logs/custom',
  maxFiles: 10,
  maxSize: '20m',
  format: 'json',
};

const logger = createLoggerWithConfig(config);
```

### Environment-Specific Configuration

```typescript
const getLoggerForEnvironment = (service: ConfigProfile) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return createLoggerForService(service, isProduction ? 'info' : 'debug');
};
```

### Child Logger with Context

```typescript
const userLogger = authLogger.child({ userId: 'user123' });
userLogger.info('User action performed', { action: 'login' });
```

## Benefits

1. **Centralized Configuration**: All logger settings in one place
2. **Profile-Based**: Different settings per service
3. **Environment-Aware**: Automatic configuration based on environment
4. **Type Safety**: Full TypeScript and Zod validation
5. **Fallback Support**: Works even without @moonx/configs
6. **Flexible**: Supports both simple and advanced use cases

## Migration Guide

### From Old Logger Usage

```typescript
// Old way
const logger = createLogger('service-name');

// New way (recommended)
const logger = createLoggerForProfile('service-name');
```

### Environment Variables

Add logger configuration to your `.env` file:

```bash
# Logger Configuration
LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=false
LOG_DIR=logs
LOG_MAX_FILES=5
LOG_MAX_SIZE=10m
LOG_FORMAT=console
```

## Testing

Run the test script to see examples:

```bash
cd configs
node test-logger.ts
```

This will show you the expected output and usage patterns. 