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

# MoonX Farm Kafka Infrastructure

Enhanced Kafka infrastructure package for all MoonX Farm services with production-ready features including connection pooling, metrics, dead letter queues, and graceful shutdown.

## Features

🚀 **Production Ready**
- Connection pooling with automatic cleanup
- Comprehensive metrics and monitoring
- Dead letter queue support
- Graceful shutdown handling
- Health checks and auto-recovery

⚡ **High Performance**
- Batch processing optimization
- Connection reuse and pooling
- Compression support (gzip, snappy, lz4, zstd)
- Efficient resource management

🔧 **Developer Friendly**
- TypeScript support with full type definitions
- Extensive configuration options
- Built-in error handling and retries
- Comprehensive logging

## Installation

```bash
npm install @moonx-farm/infrastructure
```

## Quick Start

### Basic Setup

```typescript
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

// Create Kafka manager with default config
const kafka = createKafka(createKafkaConfig());

// Connect to Kafka
await kafka.connect();

// Basic producer
const producer = await kafka.createProducer();

// Basic consumer
const consumer = await kafka.createConsumer('my-consumer', {
  groupId: 'my-service-group',
});

// Publish message
await kafka.publish({ userId: 123, action: 'login' }, {
  topic: 'user-events',
  key: 'user-123',
});

// Subscribe to topics
await kafka.subscribe('my-consumer', ['user-events'], {
  groupId: 'my-service-group',
}, async (topic, message, rawMessage) => {
  console.log(`Received message from ${topic}:`, message);
});
```

## Configuration

### Environment Variables

Create a `.env` file in your service root:

```bash
# Basic Kafka Configuration
KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094
KAFKA_CLIENT_ID=my-service
KAFKA_SSL=false
KAFKA_USERNAME=
KAFKA_PASSWORD=
KAFKA_SASL_MECHANISM=plain

# Connection Settings
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_MAX_CONNECTIONS=10
KAFKA_IDLE_TIMEOUT=300000

# Performance Settings
KAFKA_COMPRESSION=gzip
KAFKA_LOG_LEVEL=info
KAFKA_ENABLE_METRICS=true
KAFKA_TRANSACTION_TIMEOUT=30000

# Retry Configuration
KAFKA_RETRY_INITIAL_TIME=100
KAFKA_RETRY_COUNT=8

# Schema Registry (Optional)
KAFKA_SCHEMA_REGISTRY_URL=http://localhost:8081
KAFKA_SCHEMA_REGISTRY_USERNAME=
KAFKA_SCHEMA_REGISTRY_PASSWORD=
```

### Custom Configuration

```typescript
import { createKafka, KafkaManagerConfig } from '@moonx-farm/infrastructure';

const config: KafkaManagerConfig = {
  clientId: 'my-service',
  brokers: ['localhost:9092'],
  ssl: false,
  logLevel: 'info',
  maxConnections: 10,
  compression: 'gzip',
  enableMetrics: true,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
};

const kafka = createKafka(config);
```

## Usage Examples

### 1. Simple Producer Service

```typescript
// services/notificationService.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class NotificationService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    await this.kafka.createProducer('notification-producer', {
      compression: 'gzip',
      idempotent: true,
    });
  }

  async sendNotification(userId: string, message: string) {
    await this.kafka.publish(
      { userId, message, timestamp: new Date().toISOString() },
      {
        topic: 'notifications',
        key: `user-${userId}`,
        headers: { 'content-type': 'application/json' },
      },
      'notification-producer'
    );
  }

  async shutdown() {
    await this.kafka.gracefulShutdown();
  }
}
```

### 2. Consumer Service with Dead Letter Queue

```typescript
// services/emailService.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class EmailService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Subscribe with DLQ support
    await this.kafka.subscribe(
      'email-consumer',
      ['notifications'],
      {
        groupId: 'email-service-group',
        enableDeadLetterQueue: true,
        deadLetterQueueTopic: 'email-dlq',
        retry: {
          retries: 3,
          initialRetryTime: 1000,
          maxRetryTime: 10000,
        },
      },
      this.handleNotification.bind(this)
    );
  }

  private async handleNotification(topic: string, message: any) {
    try {
      // Process email notification
      await this.sendEmail(message.userId, message.message);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error; // Will be sent to DLQ after retries
    }
  }

  private async sendEmail(userId: string, message: string) {
    // Email sending logic
    console.log(`Sending email to user ${userId}: ${message}`);
  }
}
```

### 3. High-Throughput Batch Processing

```typescript
// services/analyticsService.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class AnalyticsService {
  private kafka = createKafka(createKafkaConfig());
  private eventBuffer: any[] = [];

  async initialize() {
    await this.kafka.connect();
    
    // Producer optimized for batch processing
    await this.kafka.createProducer('analytics-producer', {
      batchSize: 16384,
      lingerMs: 100,
      compression: 'lz4',
      idempotent: true,
    });

    // Start batch processing
    this.startBatchProcessor();
  }

  async trackEvent(event: any) {
    this.eventBuffer.push(event);
    
    // Trigger batch if buffer is full
    if (this.eventBuffer.length >= 100) {
      await this.flushEvents();
    }
  }

  private async flushEvents() {
    if (this.eventBuffer.length === 0) return;

    const batch = this.eventBuffer.splice(0, 100);
    const messages = batch.map(event => ({
      data: event,
      options: {
        topic: 'analytics-events',
        key: event.sessionId,
        headers: { 'event-type': event.type },
      },
    }));

    await this.kafka.publishBatch(messages, 'analytics-producer');
  }

  private startBatchProcessor() {
    // Flush events every 5 seconds
    setInterval(() => {
      this.flushEvents().catch(console.error);
    }, 5000);
  }
}
```

### 4. Transactional Producer

```typescript
// services/orderService.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class OrderService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Transactional producer
    await this.kafka.createProducer('order-producer', {
      enableTransactions: true,
      transactionalId: 'order-service-tx',
      idempotent: true,
    });
  }

  async processOrder(order: any) {
    const producer = await this.kafka.createProducer('order-producer');
    
    try {
      // Begin transaction
      await producer.transaction({
        timeout: 30000,
      });

      // Multiple related events in single transaction
      await producer.send({
        topic: 'order-created',
        messages: [{
          key: order.id,
          value: JSON.stringify(order),
        }],
      });

      await producer.send({
        topic: 'inventory-reserved',
        messages: [{
          key: order.id,
          value: JSON.stringify({
            orderId: order.id,
            items: order.items,
          }),
        }],
      });

      // Commit transaction
      await producer.commit();
    } catch (error) {
      // Abort transaction on error
      await producer.abort();
      throw error;
    }
  }
}
```

### 5. Multiple Topic Consumer

```typescript
// services/eventProcessor.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class EventProcessor {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Consumer for multiple topics
    await this.kafka.subscribe(
      'event-processor',
      ['user-events', 'order-events', 'payment-events'],
      {
        groupId: 'event-processor-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        autoCommit: false, // Manual commit for better control
      },
      this.handleEvent.bind(this)
    );
  }

  private async handleEvent(topic: string, message: any, rawMessage: any) {
    switch (topic) {
      case 'user-events':
        await this.processUserEvent(message);
        break;
      case 'order-events':
        await this.processOrderEvent(message);
        break;
      case 'payment-events':
        await this.processPaymentEvent(message);
        break;
    }
  }

  private async processUserEvent(event: any) {
    // User event processing logic
    console.log('Processing user event:', event);
  }

  private async processOrderEvent(event: any) {
    // Order event processing logic
    console.log('Processing order event:', event);
  }

  private async processPaymentEvent(event: any) {
    // Payment event processing logic
    console.log('Processing payment event:', event);
  }
}
```

## Service Integration Patterns

### 1. Service-to-Service Communication

```typescript
// In your service main file
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

class MyService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Setup producers for outbound events
    await this.kafka.createProducer('service-events');
    
    // Setup consumers for inbound events
    await this.kafka.subscribe(
      'service-consumer',
      ['external-events'],
      { groupId: 'my-service-group' },
      this.handleExternalEvent.bind(this)
    );
  }

  // Publish events to other services
  async publishEvent(eventType: string, data: any) {
    await this.kafka.publish(
      { eventType, data, timestamp: new Date().toISOString() },
      {
        topic: 'service-events',
        key: eventType,
        headers: { 'source-service': 'my-service' },
      }
    );
  }

  // Handle events from other services
  private async handleExternalEvent(topic: string, message: any) {
    // Process external event
    console.log('Received external event:', message);
  }
}
```

### 2. Event Sourcing Pattern

```typescript
// services/eventStore.ts
export class EventStore {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Ensure event topics exist
    await this.kafka.createTopics([
      { topic: 'user-events', numPartitions: 3 },
      { topic: 'order-events', numPartitions: 3 },
      { topic: 'payment-events', numPartitions: 3 },
    ]);
  }

  async appendEvent(aggregateId: string, event: any) {
    const eventData = {
      aggregateId,
      eventType: event.type,
      eventData: event.data,
      timestamp: new Date().toISOString(),
      version: event.version,
    };

    await this.kafka.publish(eventData, {
      topic: `${event.aggregateType}-events`,
      key: aggregateId,
    });
  }

  async subscribeToEvents(aggregateType: string, handler: Function) {
    await this.kafka.subscribe(
      `${aggregateType}-event-store`,
      [`${aggregateType}-events`],
      { groupId: `${aggregateType}-event-store-group` },
      async (topic, message) => {
        await handler(message);
      }
    );
  }
}
```

## Monitoring and Metrics

### Getting Metrics

```typescript
// Monitor service health
const kafka = createKafka(createKafkaConfig());

// Get comprehensive metrics
const metrics = kafka.getMetrics();
console.log('Kafka Metrics:', {
  messagesProduced: metrics.messagesProduced,
  messagesConsumed: metrics.messagesConsumed,
  averageProduceTime: metrics.averageProduceTime,
  averageConsumeTime: metrics.averageConsumeTime,
  activeProducers: metrics.activeProducers,
  activeConsumers: metrics.activeConsumers,
  errors: {
    producer: metrics.producerErrors,
    consumer: metrics.consumerErrors,
    connection: metrics.connectionErrors,
  },
  topicStats: metrics.topicStats,
});

// Health check
const isHealthy = await kafka.isHealthy();
console.log('Kafka Health:', isHealthy);
```

### Metrics Integration with Monitoring Systems

```typescript
// services/monitoringService.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

export class MonitoringService {
  private kafka = createKafka(createKafkaConfig());

  async startMetricsCollection() {
    await this.kafka.connect();
    
    // Collect metrics every 30 seconds
    setInterval(async () => {
      const metrics = this.kafka.getMetrics();
      
      // Send to monitoring system (Prometheus, DataDog, etc.)
      await this.sendMetricsToMonitoring(metrics);
    }, 30000);
  }

  private async sendMetricsToMonitoring(metrics: any) {
    // Integration with your monitoring system
    console.log('Sending metrics to monitoring system:', metrics);
  }
}
```

## Best Practices

### 1. Topic Management

```typescript
// Setup topics on service startup
export class TopicManager {
  private kafka = createKafka(createKafkaConfig());

  async setupTopics() {
    await this.kafka.connect();
    
    // Create topics with proper configuration
    await this.kafka.createTopics([
      {
        topic: 'user-events',
        numPartitions: 3,
        replicationFactor: 2,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'cleanup.policy', value: 'delete' },
        ],
      },
      {
        topic: 'order-events',
        numPartitions: 6,
        replicationFactor: 2,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'cleanup.policy', value: 'compact' },
        ],
      },
    ]);
  }
}
```

### 2. Error Handling

```typescript
// Comprehensive error handling
export class RobustKafkaService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    try {
      await this.kafka.connect();
      
      // Setup consumer with retry logic
      await this.kafka.subscribe(
        'robust-consumer',
        ['events'],
        {
          groupId: 'robust-service-group',
          retry: {
            retries: 3,
            initialRetryTime: 1000,
            maxRetryTime: 10000,
          },
          enableDeadLetterQueue: true,
          deadLetterQueueTopic: 'events-dlq',
        },
        this.handleMessage.bind(this)
      );
    } catch (error) {
      console.error('Failed to initialize Kafka service:', error);
      // Implement fallback logic or graceful degradation
    }
  }

  private async handleMessage(topic: string, message: any) {
    try {
      // Process message
      await this.processMessage(message);
    } catch (error) {
      console.error('Message processing failed:', error);
      
      // Log for debugging
      console.log('Failed message:', JSON.stringify(message, null, 2));
      
      // Re-throw to trigger retry mechanism
      throw error;
    }
  }
}
```

### 3. Graceful Shutdown

```typescript
// Proper shutdown handling
export class GracefulKafkaService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });
  }

  private async shutdown() {
    console.log('Shutting down Kafka service...');
    
    try {
      await this.kafka.gracefulShutdown();
      console.log('Kafka service shut down successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}
```

## Common Patterns for Different Services

### API Gateway Service

```typescript
// services/apiGateway.ts
export class ApiGatewayKafkaService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // Producer for API events
    await this.kafka.createProducer('api-events', {
      compression: 'gzip',
      idempotent: true,
    });
  }

  async logApiCall(request: any, response: any) {
    await this.kafka.publish(
      {
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        statusCode: response.statusCode,
        duration: response.duration,
        userId: request.user?.id,
      },
      {
        topic: 'api-logs',
        key: `${request.method}-${request.url}`,
      }
    );
  }
}
```

### Authentication Service

```typescript
// services/authService.ts
export class AuthKafkaService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    await this.kafka.createProducer('auth-events');
  }

  async publishAuthEvent(eventType: string, userId: string, data: any) {
    await this.kafka.publish(
      {
        eventType,
        userId,
        data,
        timestamp: new Date().toISOString(),
      },
      {
        topic: 'auth-events',
        key: userId,
        headers: { 'event-type': eventType },
      }
    );
  }
}
```

### Database Service

```typescript
// services/databaseService.ts
export class DatabaseKafkaService {
  private kafka = createKafka(createKafkaConfig());

  async initialize() {
    await this.kafka.connect();
    
    // CDC (Change Data Capture) producer
    await this.kafka.createProducer('database-changes', {
      idempotent: true,
      transactionalId: 'database-tx',
    });
  }

  async publishDatabaseChange(table: string, operation: string, data: any) {
    await this.kafka.publish(
      {
        table,
        operation,
        data,
        timestamp: new Date().toISOString(),
      },
      {
        topic: 'database-changes',
        key: `${table}-${data.id}`,
      }
    );
  }
}
```

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-service-dev
KAFKA_LOG_LEVEL=debug
KAFKA_ENABLE_METRICS=true
KAFKA_MAX_CONNECTIONS=5
```

### Production Environment

```bash
# .env.production
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
KAFKA_CLIENT_ID=my-service-prod
KAFKA_SSL=true
KAFKA_USERNAME=prod-user
KAFKA_PASSWORD=secure-password
KAFKA_LOG_LEVEL=info
KAFKA_ENABLE_METRICS=true
KAFKA_MAX_CONNECTIONS=20
KAFKA_COMPRESSION=lz4
```

## Troubleshooting

### Common Issues

1. **Connection Issues**
   ```typescript
   // Check connection health
   const isHealthy = await kafka.isHealthy();
   if (!isHealthy) {
     console.log('Kafka connection is unhealthy');
   }
   ```

2. **Message Processing Errors**
   ```typescript
   // Enable DLQ for failed messages
   const consumerOptions = {
     groupId: 'my-service-group',
     enableDeadLetterQueue: true,
     deadLetterQueueTopic: 'my-service-dlq',
   };
   ```

3. **Performance Issues**
   ```typescript
   // Check metrics for performance bottlenecks
   const metrics = kafka.getMetrics();
   console.log('Average produce time:', metrics.averageProduceTime);
   console.log('Average consume time:', metrics.averageConsumeTime);
   ```

### Debug Mode

```typescript
// Enable debug logging
const kafka = createKafka({
  ...createKafkaConfig(),
  logLevel: 'debug',
});
```

## Testing

### Unit Tests

```typescript
// tests/kafkaService.test.ts
import { createKafka } from '@moonx-farm/infrastructure';

describe('KafkaService', () => {
  let kafka: any;

  beforeEach(() => {
    kafka = createKafka({
      clientId: 'test-client',
      brokers: ['localhost:9092'],
    });
  });

  afterEach(async () => {
    await kafka.disconnect();
  });

  it('should publish and consume messages', async () => {
    await kafka.connect();
    
    // Test implementation
    const testMessage = { test: 'data' };
    await kafka.publish(testMessage, { topic: 'test-topic' });
    
    // Verify message was published
    const metrics = kafka.getMetrics();
    expect(metrics.messagesProduced).toBe(1);
  });
});
```

### Integration Tests

```typescript
// tests/integration/kafka.test.ts
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

describe('Kafka Integration', () => {
  let kafka: any;

  beforeAll(async () => {
    kafka = createKafka(createKafkaConfig());
    await kafka.connect();
  });

  afterAll(async () => {
    await kafka.gracefulShutdown();
  });

  it('should handle end-to-end message flow', async () => {
    // End-to-end test implementation
  });
});
```

## Migration Guide

### From Basic KafkaJS to Enhanced Infrastructure

```typescript
// Before (Basic KafkaJS)
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-service',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'my-group' });

// After (Enhanced Infrastructure)
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';

const kafka = createKafka(createKafkaConfig());
await kafka.connect();

const producer = await kafka.createProducer();
const consumer = await kafka.createConsumer('my-consumer', {
  groupId: 'my-group',
});
```

---

## Support

For questions and support, please refer to the MoonX Farm development team or create an issue in the project repository.

## License

This package is part of the MoonX Farm ecosystem and follows the same licensing terms. 