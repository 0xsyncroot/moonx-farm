# @moonx/infrastructure

Infrastructure clients and managers for MoonXFarm DEX services.

## Overview

This package provides infrastructure clients and managers for:
- **DatabaseManager**: PostgreSQL connection and query management
- **RedisManager**: Redis caching and pub/sub operations  
- **KafkaManager**: Kafka messaging and event streaming

## ⚠️ Important: Package Name Change

This package was previously named `@moonx/config` which caused confusion with the configuration management package `@moonx/configs`. 

**The package has been renamed to `@moonx/infrastructure` to better reflect its purpose.**

## Difference from @moonx/configs

| Package | Purpose | What it provides |
|---------|---------|------------------|
| `@moonx/infrastructure` | **Infrastructure Clients** | Database, Redis, Kafka connection managers and clients |
| `@moonx/configs` | **Configuration Management** | Environment variables, profiles, validation, utilities |

## Usage Examples

### Database Manager

```typescript
import { DatabaseManager, createDatabase } from '@moonx/infrastructure';

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
import { RedisManager, createRedis } from '@moonx/infrastructure';

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
import { KafkaManager, createKafka } from '@moonx/infrastructure';

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

## Integration with @moonx/configs

You can use both packages together:

```typescript
import { createConfig } from '@moonx/configs';
import { createDatabase, createRedis, createKafka } from '@moonx/infrastructure';

// Get configuration from @moonx/configs
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
import { DatabaseManager } from '@moonx/infrastructure';
```

## Features

- **Connection Management**: Automatic connection pooling and health checks
- **Error Handling**: Comprehensive error handling with retry logic
- **Logging**: Integrated logging with @moonx/common
- **Type Safety**: Full TypeScript support
- **Graceful Shutdown**: Proper cleanup on process termination
- **Performance**: Optimized for high-throughput applications

## Dependencies

- `pg`: PostgreSQL client
- `ioredis`: Redis client
- `kafkajs`: Kafka client
- `@moonx/common`: Common utilities and logging 