# Kafka Infrastructure Quickstart

Hướng dẫn tích hợp và sử dụng Kafka infrastructure cho các service trong MoonX Farm.

## Tổng quan

Kafka Infrastructure hỗ trợ:
- **Message Publishing**: Publish messages với compression và batch operations
- **Message Consumption**: Subscribe topics với Dead Letter Queue support
- **Connection Pooling**: Tự động quản lý producers/consumers với LRU eviction
- **Transactions**: ACID compliance cho message processing
- **Admin Operations**: Topic management và metadata fetching
- **Monitoring**: Comprehensive metrics và health checks

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
KAFKA_TRANSACTION_TIMEOUT=30000
KAFKA_LOG_LEVEL=info

# Retry configuration
KAFKA_RETRY_INITIAL_TIME=100
KAFKA_RETRY_COUNT=8

# Monitoring
KAFKA_ENABLE_METRICS=true

# Schema Registry (optional)
KAFKA_SCHEMA_REGISTRY_URL=http://localhost:8081
KAFKA_SCHEMA_REGISTRY_USERNAME=registry_user
KAFKA_SCHEMA_REGISTRY_PASSWORD=registry_password
```

## Tích hợp cơ bản

```typescript
// services/kafkaService.ts
import { 
  KafkaManager, 
  createKafka, 
  createKafkaConfig 
} from '@moonx-farm/infrastructure';

export class KafkaService {
  private kafka: KafkaManager;

  constructor() {
    const config = createKafkaConfig();
    this.kafka = createKafka(config);
  }

  async initialize(): Promise<void> {
    await this.kafka.connect();
  }

  getKafka(): KafkaManager {
    return this.kafka;
  }

  async healthCheck(): Promise<boolean> {
    return await this.kafka.isHealthy();
  }

  async shutdown(): Promise<void> {
    await this.kafka.disconnect();
  }
}

// Export singleton
export const kafkaService = new KafkaService();
```

## API Methods

### Basic Operations

- **`connect(): Promise<void>`** - Kết nối Kafka cluster
- **`disconnect(): Promise<void>`** - Ngắt kết nối và cleanup
- **`isHealthy(): Promise<boolean>`** - Kiểm tra sức khỏe connection
- **`getMetrics(): KafkaMetrics`** - Lấy performance metrics
- **`resetMetrics(): void`** - Reset metrics về 0

### Producer Operations

- **`createProducer(id?, options?): Promise<Producer>`** - Tạo producer với connection pooling
- **`publish<T>(data, options, producerId?): Promise<void>`** - Publish single message
- **`publishBatch<T>(messages, producerId?): Promise<void>`** - Publish multiple messages

### Consumer Operations

- **`createConsumer(id, options): Promise<Consumer>`** - Tạo consumer với enhanced config
- **`subscribe(consumerId, topics, options, handler): Promise<void>`** - Subscribe topics với message handler

### Admin Operations

- **`getAdmin(): Admin`** - Lấy admin client cho topic management
- **`createTopics(topics): Promise<void>`** - Tạo topics với partitions và replication
- **`deleteTopics(topics): Promise<void>`** - Xóa topics
- **`listTopics(): Promise<string[]>`** - List tất cả topics
- **`getTopicMetadata(topics): Promise<any>`** - Lấy metadata của topics

## Configuration Interfaces

### PublishOptions
```typescript
interface PublishOptions {
  topic: string;
  key?: string;
  partition?: number;
  timestamp?: string;
  headers?: Record<string, string>;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  acks?: number;
  timeout?: number;
}
```

### ConsumerOptions
```typescript
interface ConsumerOptions {
  groupId: string;
  sessionTimeout?: number;
  autoCommit?: boolean;
  enableDeadLetterQueue?: boolean;
  deadLetterQueueTopic?: string;
  isolationLevel?: 'read_uncommitted' | 'read_committed';
  // ... other consumer configs
}
```

## Usage Examples

### Publishing Messages

```typescript
const kafka = kafkaService.getKafka();

// Single message
await kafka.publish(userData, {
  topic: 'user.events',
  key: userId,
  headers: { 'event-type': 'user_created' }
});

// Batch messages
await kafka.publishBatch([
  { data: event1, options: { topic: 'events', key: 'key1' } },
  { data: event2, options: { topic: 'events', key: 'key2' } }
]);
```

### Consuming Messages

```typescript
await kafka.subscribe(
  'user-service-consumer',
  ['user.events', 'order.events'],
  {
    groupId: 'user-service-group',
    enableDeadLetterQueue: true,
    deadLetterQueueTopic: 'dead-letter-queue'
  },
  async (topic, message, rawMessage) => {
    console.log(`Processing message from ${topic}:`, message);
    // Process message logic here
  }
);
```

### Topic Management

```typescript
// Create topics
await kafka.createTopics([
  {
    topic: 'user.events',
    numPartitions: 3,
    replicationFactor: 2,
    configEntries: [
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'retention.ms', value: '604800000' }
    ]
  }
]);

// List topics
const topics = await kafka.listTopics();
```

## Error Handling

Kafka operations throw `ServiceUnavailableError` khi có lỗi. Handle bằng try-catch:

```typescript
try {
  await kafka.publish(data, { topic: 'events' });
} catch (error) {
  if (error instanceof ServiceUnavailableError) {
    // Handle Kafka unavailable
  }
}
```

## Monitoring & Metrics

```typescript
// Health check
const isHealthy = await kafkaService.healthCheck();

// Get metrics
const metrics = kafkaService.getKafka().getMetrics();
// Returns: {
//   messagesProduced, messagesConsumed, 
//   producerErrors, consumerErrors,
//   averageProduceTime, averageConsumeTime,
//   activeProducers, activeConsumers,
//   topicStats: { [topic]: { messagesProduced, messagesConsumed, errors } }
// }
```

## Features

### Connection Pooling
- Tự động quản lý producers/consumers
- LRU-based eviction khi đạt max connections
- Cleanup idle connections tự động

### Dead Letter Queue
- Tự động gửi failed messages vào DLQ
- Configurable per consumer
- Error tracking và logging

### Transactions
- ACID compliance cho message processing
- Idempotent producers
- Transactional message publishing

### Compression
- Support gzip, snappy, lz4, zstd
- Configurable per producer/message
- Automatic compression trong batch operations

## Best Practices

1. **Connection Pooling**: Reuse producers/consumers bằng IDs
2. **Batch Publishing**: Sử dụng `publishBatch()` cho multiple messages
3. **Error Handling**: Always handle `ServiceUnavailableError`
4. **Dead Letter Queue**: Enable DLQ cho critical consumers
5. **Monitoring**: Enable metrics trong production
6. **Compression**: Sử dụng compression cho large messages
7. **Partitioning**: Distribute messages evenly với proper keys

## Troubleshooting

- **Connection Issues**: Kiểm tra `KAFKA_BROKERS` và network connectivity
- **Authentication Failures**: Verify `KAFKA_USERNAME`, `KAFKA_PASSWORD`, `KAFKA_SASL_MECHANISM`
- **Timeout Errors**: Tăng `KAFKA_CONNECTION_TIMEOUT` và `KAFKA_REQUEST_TIMEOUT`
- **Consumer Lag**: Monitor `topicStats` trong metrics
- **Producer Failures**: Check `producerErrors` và `averageProduceTime`
- **Memory Issues**: Giảm `KAFKA_MAX_CONNECTIONS` hoặc tăng `KAFKA_IDLE_TIMEOUT`

---

Để hỗ trợ hoặc báo cáo lỗi, liên hệ team phát triển MoonX Farm. 