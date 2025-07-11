# Kafka Single Topic Pattern Implementation

## Overview

Hệ thống đã được refactor từ **multiple topics** sang **single topic pattern** với **message type discrimination**. Thay vì sử dụng nhiều topics khác nhau, tất cả events giờ đây được gửi qua một topic chính `moonx.ws.events`.

## Architecture Changes

### Before (Multiple Topics)
```
moonx.price.updates    → Price events
moonx.order.updates    → Order events  
moonx.portfolio.updates → Portfolio events
moonx.trade.updates    → Trade events
```

### After (Single Topic)
```
moonx.ws.events        → All events với type discrimination
moonx.ws.events.dlq    → Dead letter queue cho failed events
```

## Event Structure

### Message Envelope Pattern
Tất cả events theo cấu trúc `EventEnvelope<T>`:

```typescript
interface EventEnvelope<T> {
  metadata: EventMetadata;  // System/technical information
  data: T;                  // Domain/business data
}
```

### Event Metadata
```typescript
interface EventMetadata {
  eventId: string;          // Unique identifier (UUID)
  eventType: EventType;     // Type discriminator
  eventVersion: string;     // Schema version
  correlationId: string;    // Tracing across services
  timestamp: number;        // Event creation timestamp
  source: string;           // Service that generated event
  userId?: string;          // User context
  dataClassification: DataClassification;
  partition: string;        // Kafka partition key
  // ... more fields
}
```

## Event Types

### Supported Event Types
```typescript
type EventType = 
  | 'price.updated'
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'portfolio.updated'
  | 'trade.executed'
  | 'trade.failed'
  | 'user.connected'
  | 'user.disconnected'
  | 'system.health_check'
  | 'system.error';
```

### Data Classification
```typescript
type DataClassification = 
  | 'public'      // Price data
  | 'internal'    // System events
  | 'confidential' // Order/trade data
  | 'restricted'  // Portfolio data
```

## Creating Events

### Using EventFactory
```typescript
import { eventFactory } from '../utils/eventFactory';

// Create a price update event
const priceEvent = eventFactory.createEvent('price.updated', {
  token: 'USDT',
  chainId: 1,
  price: '1.0000',
  priceUsd: '1.0000',
  change24h: '0.0001',
  volume24h: '1000000'
});

// Create an order event with user context
const orderEvent = eventFactory.createEvent('order.created', {
  orderId: 'order-123',
  userId: 'user-456',
  tokenIn: 'ETH',
  tokenOut: 'USDT',
  amountIn: '1.0',
  amountOutExpected: '3000.0',
  chainId: 1,
  orderType: 'market',
  status: 'pending'
}, { userId: 'user-456' });
```

### Helper Functions
```typescript
// Convenience functions for common events
import { 
  createPriceUpdatedEvent,
  createOrderCreatedEvent,
  createTradeExecutedEvent 
} from '../utils/eventFactory';

const priceEvent = createPriceUpdatedEvent(priceData);
const orderEvent = createOrderCreatedEvent(orderData, { userId: 'user-123' });
```

## Consumer Implementation

### Single Topic Consumer
```typescript
class KafkaConsumerService {
  private mainTopic = 'moonx.ws.events';
  private eventHandlers = new Map<EventType, AnyEventHandler>();

  // Event type discrimination
  private async messageHandler(topic: string, message: any): Promise<void> {
    const event = this.parseEventEnvelope(message);
    
    // Route to appropriate handler based on event type
    const handler = this.eventHandlers.get(event.metadata.eventType);
    if (handler) {
      await handler(event, context);
    }
  }
}
```

### Event Handler Registration
```typescript
// Built-in handlers
this.eventHandlers.set('price.updated', this.handlePriceUpdated.bind(this));
this.eventHandlers.set('order.created', this.handleOrderCreated.bind(this));
this.eventHandlers.set('portfolio.updated', this.handlePortfolioUpdated.bind(this));

// Custom handlers
kafkaConsumer.registerEventHandler('custom.event', customHandler);
```

## Configuration

### Environment Variables
```bash
# Main topic
KAFKA_MAIN_TOPIC=moonx.ws.events

# Event processing
EVENT_PROCESSING_ENABLED=true
EVENT_VALIDATION_ENABLED=true

# Dead letter queue
EVENT_DEAD_LETTER_QUEUE_ENABLED=true
EVENT_DEAD_LETTER_QUEUE_TOPIC=moonx.ws.events.dlq

# Consumer group
KAFKA_CONSUMER_GROUP_ID=websocket-consumers
```

### Topic Configuration
```javascript
// Main topic - 6 partitions for high throughput
{
  topic: 'moonx.ws.events',
  numPartitions: 6,
  replicationFactor: 1,
  configs: {
    'cleanup.policy': 'delete',
    'retention.ms': '604800000', // 7 days
    'compression.type': 'gzip',
    'max.message.bytes': '1000000' // 1MB
  }
}

// Dead letter queue - 2 partitions
{
  topic: 'moonx.ws.events.dlq',
  numPartitions: 2,
  replicationFactor: 1,
  configs: {
    'retention.ms': '2592000000' // 30 days
  }
}
```

## Partitioning Strategy

### Automatic Partition Assignment
```typescript
// User-specific events → partition by userId
if (userId && ['order.created', 'order.updated', 'portfolio.updated'].includes(eventType)) {
  return userId;
}

// Price events → partition by 'prices'
if (eventType === 'price.updated') {
  return 'prices';
}

// System events → partition by 'system'
if (eventType.startsWith('system.')) {
  return 'system';
}
```

## Migration & Backward Compatibility

### Legacy Message Support
```typescript
// Consumer supports both new and old message formats
private parseEventEnvelope(message: any): EventEnvelope<any> | null {
  // New envelope format
  if (message.metadata && message.data) {
    return message as EventEnvelope<any>;
  }

  // Legacy format migration
  if (message.type && message.timestamp) {
    return this.migrateLegacyMessage(message);
  }
}
```

### Legacy Topic Support
Legacy topics vẫn được tạo để hỗ trợ backward compatibility:
- `moonx.price.updates`
- `moonx.order.updates`
- `moonx.portfolio.updates`
- `moonx.trade.updates`

## Benefits

### 1. Simplified Architecture
- Single consumer thay vì multiple consumers
- Unified event processing logic
- Centralized error handling

### 2. Enhanced Observability
- Rich metadata với correlation IDs
- Comprehensive event tracing
- Data classification for compliance

### 3. Better Performance
- Optimal partition utilization
- Reduced connection overhead
- Efficient message routing

### 4. Type Safety
- Full TypeScript support
- Compile-time event validation
- IDE autocomplete for event types

### 5. Extensibility
- Easy to add new event types
- Consistent event structure
- Pluggable event handlers

## Running the System

### 1. Build the Service
```bash
cd services/websocket-service
npm run build
```

### 2. Create Kafka Topics
```bash
npm run create-topics
```

### 3. Start the Service
```bash
npm run dev
# or
npm start
```

### 4. Health Check
```bash
curl http://localhost:3008/health
```

### 5. Metrics
```bash
curl http://localhost:3008/metrics
```

## Testing Events

### Send Test Event
```typescript
// Example: Create and send a price update
const priceEvent = eventFactory.createEvent('price.updated', {
  token: 'ETH',
  chainId: 1,
  price: '3000.00',
  priceUsd: '3000.00',
  change24h: '0.05',
  volume24h: '1000000'
});

// Send to Kafka topic
await kafkaProducer.send('moonx.ws.events', priceEvent);
```

### WebSocket Client Testing
```javascript
const ws = new WebSocket('ws://localhost:3008/ws');

ws.on('open', () => {
  // Subscribe to price updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## Monitoring & Debugging

### Event Processing Metrics
```typescript
// Consumer metrics
const metrics = kafkaConsumer.getMetrics();
console.log({
  totalProcessed: metrics.processing.totalProcessed,
  successRate: metrics.processing.successCount / metrics.processing.totalProcessed,
  errorCount: metrics.processing.errorCount
});
```

### Event Validation
```typescript
// Validate event structure
const validation = eventFactory.validateEvent(event);
if (!validation.isValid) {
  console.error('Invalid event:', validation.errors);
}
```

### Dead Letter Queue
Failed events được tự động gửi tới `moonx.ws.events.dlq` topic để debugging.

## Best Practices

### 1. Event Design
- Always include correlation IDs
- Use proper data classification
- Include sufficient context in metadata

### 2. Error Handling
- Implement comprehensive error handling
- Use dead letter queue for failed events
- Log detailed error information

### 3. Performance
- Use appropriate partition keys
- Monitor consumer lag
- Optimize message size

### 4. Security
- Classify data appropriately
- Include user context when needed
- Implement proper authentication

## Troubleshooting

### Common Issues

1. **Consumer Not Receiving Messages**
   - Check topic existence
   - Verify consumer group configuration
   - Check Kafka connectivity

2. **Event Validation Errors**
   - Verify event structure
   - Check required fields
   - Validate data types

3. **Performance Issues**
   - Monitor partition distribution
   - Check consumer lag
   - Optimize message processing

### Debug Commands
```bash
# Check topic status
kafka-topics --list --bootstrap-server localhost:9092

# Check consumer group
kafka-consumer-groups --bootstrap-server localhost:9092 --group websocket-consumers --describe

# Monitor messages
kafka-console-consumer --bootstrap-server localhost:9092 --topic moonx.ws.events
``` 