# @moonx/infrastructure

Infrastructure clients and managers for MoonXFarm DEX services.

## Overview

This package provides infrastructure clients and managers for:
- **DatabaseManager**: PostgreSQL connection and query management
- **RedisManager**: Redis caching and pub/sub operations  
- **KafkaManager**: Kafka messaging and event streaming

## ⚠️ Important: Package Name Change

This package was previously named `@moonx/config` which caused confusion with the configuration management package `@moonx-farm/configs`. 

**The package has been renamed to `@moonx/infrastructure` to better reflect its purpose.**

## Difference from @moonx-farm/configs

| Package | Purpose | What it provides |
|---------|---------|------------------|
| `@moonx/infrastructure` | **Infrastructure Clients** | Database, Redis, Kafka connection managers and clients |
| `@moonx-farm/configs` | **Configuration Management** | Environment variables, profiles, validation, utilities |

## Features

- **Database Manager**: PostgreSQL operations with connection pooling
- **Redis Manager**: Redis operations with metrics and failover
- **Simplified Configuration**: URL-based or individual environment variables

## Configuration

### Priority-Based Configuration

Both Redis and Database support flexible configuration with the following priority:
1. **URL-based** (highest priority): `REDIS_URL` or `DATABASE_URL`
2. **Individual settings** (can override URL): Specific environment variables
3. **Defaults** (lowest priority): Built-in defaults

### Redis Configuration

**Option 1: URL-based (Recommended for production)**
```bash
# Single URL contains all connection info
REDIS_URL=redis://user:password@hostname:port/database
# Example: redis://:mypassword@redis.example.com:6379/0
```

**Option 2: Individual variables (Development/Override)**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=mypassword
REDIS_DB=0
REDIS_KEY_PREFIX=moonx:
REDIS_FAMILY=4
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_LAZY_CONNECT=true
REDIS_ENABLE_METRICS=true
REDIS_ENABLE_OFFLINE_QUEUE=true
```

### Database Configuration

**Option 1: URL-based (Recommended for production)**
```bash
# Single URL contains all connection info
DATABASE_URL=postgresql://user:password@hostname:port/database
# Example: postgresql://moonx:secret@db.example.com:5432/moonx_farm
```

**Option 2: Individual variables (Development/Override)**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=moonx_farm
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=60000
DB_QUERY_TIMEOUT=30000
DB_MAX_RETRIES=3
DB_RETRY_DELAY=1000
DB_APPLICATION_NAME=moonx-farm
DB_ENABLE_METRICS=true
DB_ENABLE_QUERY_LOGGING=false
```

### Hybrid Configuration

You can mix URL and individual variables. Individual variables will override URL settings:

```bash
# Base connection from URL
DATABASE_URL=postgresql://user:pass@host:5432/db
# Override specific settings
DB_MAX_CONNECTIONS=50
DB_ENABLE_QUERY_LOGGING=true
```

## Usage Examples

### Database Manager

```typescript
import { DatabaseManager, createDatabase } from '@moonx-farm/infrastructure';

// Create database manager
const db = createDatabase({
  host: 'localhost',
  port: 5432,
  database: 'moonx_farm',
  user: 'postgres',
  password: 'password',
});

// Connect and use
await db.connect();
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Redis Manager

```typescript
import { RedisManager, createRedis } from '@moonx-farm/infrastructure';

// Create Redis manager
const redis = createRedis({
  host: 'localhost',
  port: 6379,
  password: 'password',
});

// Connect and use
await redis.connect();
await redis.set('user:123', { name: 'John', email: 'john@example.com' }, { ttl: 3600 });
const user = await redis.get('user:123');
```

### Kafka Manager

```typescript
import { KafkaManager, createKafka } from '@moonx-farm/infrastructure';

// Create Kafka manager
const kafka = createKafka({
  clientId: 'moonx-service',
  brokers: ['localhost:9092'],
});

// Connect and use
await kafka.connect();

// Publish messages
await kafka.publish(
  { userId: '123', action: 'login' },
  { topic: 'user-events' }
);

// Subscribe to topics
await kafka.subscribe(
  'user-consumer',
  ['user-events'],
  { groupId: 'user-service' },
  async (topic, message) => {
    console.log('Received message:', message);
  }
);
```

## Integration with @moonx-farm/configs

You can use both packages together:

```typescript
import { createConfig } from '@moonx-farm/configs';
import { createDatabase, createRedis, createKafka } from '@moonx-farm/infrastructure';

// Get configuration from @moonx-farm/configs
const config = createConfig('auth-service');

// Create infrastructure clients using config
const db = createDatabase({
  host: config.get('DATABASE_HOST'),
  port: config.get('DATABASE_PORT'),
  database: config.get('DATABASE_NAME'),
  user: config.get('DATABASE_USER'),
  password: config.get('DATABASE_PASSWORD'),
});

const redis = createRedis({
  host: config.get('REDIS_HOST'),
  port: config.get('REDIS_PORT'),
  password: config.get('REDIS_PASSWORD'),
});

const kafka = createKafka({
  clientId: config.get('KAFKA_CLIENT_ID'),
  brokers: config.get('KAFKA_BROKERS').split(','),
});
```

## Migration Guide

If you were using the old `@moonx/config` package:

```typescript
// Old import
import { DatabaseManager } from '@moonx/config';

// New import
import { DatabaseManager } from '@moonx-farm/infrastructure';
```

## Benefits

✅ **Simplified Configuration**: One URL or granular control  
✅ **Production Ready**: Connection pooling, retries, metrics  
✅ **Type Safe**: Full TypeScript support  
✅ **Extensible**: Easy to add features later  
✅ **Debug Friendly**: Comprehensive logging and metrics

## Dependencies

- `pg`: PostgreSQL client
- `ioredis`: Redis client
- `kafkajs`: Kafka client
- `@moonx/common`: Common utilities and logging 