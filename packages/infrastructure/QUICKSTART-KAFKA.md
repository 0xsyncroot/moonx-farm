# Kafka Infrastructure Quickstart

Hướng dẫn tích hợp và sử dụng **Enhanced Kafka Manager** cho các service trong MoonX Farm.

## ⚠️ Important Changes

**Version 2.0+**: Infrastructure package không còn tự động setup global signal handlers. Mỗi service cần tự quản lý lifecycle để tránh unexpected consumer disconnections.

## Tổng quan

Enhanced Kafka Infrastructure hỗ trợ:
- **Message Publishing**: Publish messages với compression và batch operations
- **Message Consumption**: Subscribe topics với Dead Letter Queue support
- **Connection Pooling**: Thread-safe pooling với LRU eviction và active consumer protection
- **Circuit Breaker**: Protection against cascade failures
- **Error Isolation**: Batch processing với selective error handling
- **Enhanced Metrics**: Moving average và thread-safe statistics
- **Graceful Shutdown**: Configurable timeout với force protection (manual control)
- **Admin Operations**: Topic management và metadata fetching

## Cấu hình Environment

```bash
# Basic connection
KAFKA_BROKERS=localhost:9092,localhost:9093
KAFKA_CLIENT_ID=moonx-farm

# Authentication (optional)
KAFKA_SSL=false
KAFKA_USERNAME=your_username
KAFKA_PASSWORD=your_password
KAFKA_SASL_MECHANISM=plain

# Connection settings
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_MAX_CONNECTIONS=10
KAFKA_IDLE_TIMEOUT=300000

# Performance
KAFKA_COMPRESSION=gzip
KAFKA_LOG_LEVEL=info
KAFKA_ENABLE_METRICS=true

# Enhanced features (optional, có defaults)
KAFKA_ENABLE_CIRCUIT_BREAKER=true
KAFKA_CIRCUIT_BREAKER_THRESHOLD=5
KAFKA_CIRCUIT_BREAKER_RESET_TIMEOUT=30000
KAFKA_MAX_TOPIC_STATS=1000
KAFKA_HEALTH_CHECK_INTERVAL=30000
KAFKA_SHUTDOWN_TIMEOUT=30000
KAFKA_BATCH_ERROR_ISOLATION=true
KAFKA_ENABLE_MOVING_AVERAGE=true
KAFKA_MOVING_AVERAGE_WINDOW=100

# Retry configuration
KAFKA_RETRY_INITIAL_TIME=100
KAFKA_RETRY_COUNT=8
```

## Tích hợp cơ bản

```typescript
import { KafkaManager, createKafkaConfig } from '@moonx-farm/infrastructure';

// Simple setup với enhanced features
const kafka = new KafkaManager(createKafkaConfig());

// Connect
await kafka.connect();

// Use (automatically gets all enhancements)
await kafka.publish(data, { topic: 'events' });
await kafka.subscribe('consumer-id', ['events'], { groupId: 'group' }, handler);

// IMPORTANT: Manual shutdown control (no automatic signal handlers)
await kafka.gracefulShutdown();
```

## 🔧 Proper Lifecycle Management

**⚠️ BREAKING CHANGE**: Infrastructure không còn tự động setup signal handlers. Mỗi service cần tự quản lý:

```typescript
// ✅ Correct pattern - Service manages its own lifecycle
export class MyKafkaService {
  private kafka = new KafkaManager(createKafkaConfig());
  private isShuttingDown = false;

  async initialize() {
    await this.kafka.connect();
    
    // Setup your own signal handlers
    this.setupLifecycleHandlers();
    
    // Subscribe to topics
    await this.kafka.subscribe('my-consumer', ['events'], {
      groupId: 'my-service'
    }, this.handleMessage.bind(this));
  }

  private setupLifecycleHandlers(): void {
    const gracefulShutdown = async () => {
      if (this.isShuttingDown) return;
      
      console.log('Starting graceful shutdown...');
      this.isShuttingDown = true;
      
      try {
        await this.kafka.gracefulShutdown();
        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register signal handlers at service level
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }

  private async handleMessage(topic: string, message: any) {
    // Process message
  }
}
```

## Enhanced Connection Pool Protection

Connection pool giờ đây bảo vệ active consumers khỏi bị cleanup:

```typescript
// Active consumers không bị disconnect khi idle
const consumer = await kafka.createConsumer('my-consumer', {
  groupId: 'my-service',
  sessionTimeout: 60000,
  heartbeatInterval: 3000,
});

// Consumer sẽ được đánh dấu là "active" và protected khỏi cleanup
await kafka.subscribe('my-consumer', ['events'], options, handler);
```

## 📋 Migration Guide

### From Version 1.x to 2.0+

```typescript
// ❌ Old pattern (v1.x) - automatic signal handlers
const kafka = new KafkaManager(config);
await kafka.connect();
// Infrastructure tự động shutdown - có thể gây disconnect không mong muốn

// ✅ New pattern (v2.0+) - explicit lifecycle management
const kafka = new KafkaManager(config);
await kafka.connect();

// Setup your own signal handlers
process.on('SIGINT', async () => {
  await kafka.gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await kafka.gracefulShutdown();
  process.exit(0);
});
```

## API Methods

### Basic Operations
- **`connect(): Promise<void>`** - Kết nối với circuit breaker protection
- **`gracefulShutdown(): Promise<void>`** - Manual shutdown với configurable timeout
- **`isHealthy(): Promise<boolean>`** - Health check với enhanced monitoring
- **`getMetrics(): KafkaMetrics`** - Enhanced metrics với circuit breaker state
- **`resetMetrics(): void`** - Reset thread-safe metrics

### Producer Operations
- **`publish<T>(data, options, producerId?): Promise<void>`** - Publish với moving average metrics
- **`publishBatch<T>(messages, producerId?): Promise<void>`** - Batch với error isolation

### Consumer Operations  
- **`subscribe(consumerId, topics, options, handler): Promise<void>`** - Subscribe với enhanced DLQ và connection protection
- **`processMessagesBatch(messages, topic, handler, consumerId, options?): Promise<void>`** - Batch processing với error isolation

### Admin Operations
- **`createTopics(topics): Promise<void>`** - Create topics
- **`deleteTopics(topics): Promise<void>`** - Delete topics  
- **`listTopics(): Promise<string[]>`** - List topics

## Configuration Interfaces

### KafkaManagerConfig (Enhanced)
```typescript
interface KafkaManagerConfig {
  clientId: string;
  brokers: string[];
  // Original options
  ssl?: boolean;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'nothing';
  
  // Enhanced options (optional, có defaults)
  enableCircuitBreaker?: boolean;           // default: true
  circuitBreakerThreshold?: number;         // default: 5
  maxTopicStats?: number;                   // default: 1000
  shutdownTimeout?: number;                 // default: 30000
  batchErrorIsolation?: boolean;            // default: true
  enableMovingAverage?: boolean;            // default: true
  movingAverageWindow?: number;             // default: 100
}
```

### ConsumerOptions (Enhanced)
```typescript
interface ConsumerOptions {
  groupId: string;
  enableDeadLetterQueue?: boolean;
  deadLetterQueueTopic?: string;
  // Batch error isolation tự động active
}
```

## Usage Examples

### Basic Usage

```typescript
import { KafkaManager, createKafkaConfig } from '@moonx-farm/infrastructure';

const kafka = new KafkaManager(createKafkaConfig());
await kafka.connect();

// Publishing (với circuit breaker protection)
await kafka.publish(userData, {
  topic: 'user.events',
  key: userId
});

// Consuming (với error isolation)
await kafka.subscribe(
  'consumer-id',
  ['user.events'],
  {
    groupId: 'user-service',
    enableDeadLetterQueue: true,
    deadLetterQueueTopic: 'dlq'
  },
  async (topic, message) => {
    // Process message - errors isolated automatically
    console.log('Processing:', message);
  }
);

// Enhanced metrics
const metrics = kafka.getMetrics();
console.log('Circuit breaker state:', metrics.circuitBreaker);

// Graceful shutdown
await kafka.gracefulShutdown();
```

## Enhanced Features

### Circuit Breaker Protection
```typescript
// Circuit breaker automatically protects against cascade failures
const metrics = kafka.getMetrics();
if (metrics.circuitBreaker?.state === 'open') {
  console.log('Circuit breaker open, backing off...');
}
```

### Batch Error Isolation
```typescript
// Bad messages won't fail entire batch (configurable)
await kafka.subscribe('consumer', ['topic'], {
  batchErrorIsolation: true, // default: true
  enableDeadLetterQueue: true
}, handler);
```

### Enhanced Metrics
```typescript
const metrics = kafka.getMetrics();
// Returns enhanced metrics:
{
  messagesProduced: 1000,
  messagesConsumed: 950,
  averageProduceTime: 15.5,      // Moving average
  averageConsumeTime: 8.2,       // Moving average  
  circuitBreaker: { state: 'closed', failures: 0 },
  activeProducers: 3,
  activeConsumers: 2,
  topicStats: { /* LRU-managed */ }
}
```

## Key Features

### ✅ **Thread Safety**
- All operations thread-safe với proper locking
- Moving average metrics thay vì simple average
- Memory-managed topic stats với LRU eviction

### ✅ **Circuit Breaker**  
- Automatic protection against cascade failures
- Configurable thresholds và reset timeouts
- State tracking trong metrics

### ✅ **Error Isolation**
- Batch processing với selective error handling
- Enhanced DLQ với retry count tracking  
- Individual message failures không affect entire batch

### ✅ **Enhanced Connection Pool**
- Thread-safe pooling với async locking
- Automatic cleanup của idle connections
- Better error handling và logging

## Best Practices

1. **Use defaults**: Enhanced features enabled by default với smart configurations
2. **Monitor circuit breaker**: Check `metrics.circuitBreaker.state` 
3. **Enable DLQ**: Always use Dead Letter Queue cho production
4. **Graceful shutdown**: Use `gracefulShutdown()` thay vì `disconnect()`
5. **Environment config**: Configure enhanced options via environment variables

## Migration từ Old Version

```typescript
// Old code works unchanged - gets all enhancements automatically
const kafka = new KafkaManager(config);

// No API changes required
await kafka.publish(data, { topic: 'events' });
await kafka.subscribe('consumer', ['events'], { groupId: 'group' }, handler);
```

---

**Enhanced Kafka Manager**: Backward compatible với immediate performance và reliability improvements! 