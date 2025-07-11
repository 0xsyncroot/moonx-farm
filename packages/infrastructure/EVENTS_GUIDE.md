# Shared Events System Guide

## Overview

Shared Events System cung cấp **generic event infrastructure** cho tất cả microservices trong MoonX Farm. System này implement **Message Envelope Pattern** với **type discrimination**, cho phép các services publish/subscribe events một cách consistent và type-safe.

## Architecture

### Event Envelope Pattern

Tất cả events đều follow cấu trúc `EventEnvelope<T>`:

```typescript
interface EventEnvelope<T> {
  metadata: EventMetadata;  // System/technical information
  data: T;                  // Domain/business data
}
```

### Event Metadata

```typescript
interface EventMetadata {
  // Core identification
  eventId: string;          // Unique identifier (UUID)
  eventType: string;        // Type discriminator (extensible)
  eventVersion: string;     // Schema version
  
  // Tracing & correlation
  correlationId: string;    // For tracing across services
  causationId?: string;     // Event that caused this event
  
  // Timing & source
  timestamp: number;        // Event creation timestamp
  source: string;           // Service that generated event
  
  // Context
  userId?: string;          // User context
  sessionId?: string;       // Session context
  tenantId?: string;        // For multi-tenant scenarios
  
  // Technical metadata
  dataClassification?: DataClassification;
  partition?: string;       // Kafka partition key
  context?: Record<string, any>;
}
```

## Basic Usage

### 1. Install Dependencies

```bash
npm install @moonx-farm/infrastructure
```

### 2. Create Service-Specific Event Types

Mỗi service định nghĩa **business-specific event types** riêng:

```typescript
// services/my-service/src/types/events.ts
import { EventEnvelope } from '@moonx-farm/infrastructure';

// Service-specific event types
export type MyServiceEventType = 
  | 'user.registered'
  | 'payment.processed'
  | 'order.completed';

// Service-specific data interfaces
export interface UserRegisteredEventData {
  userId: string;
  email: string;
  registeredAt: number;
}

export interface PaymentProcessedEventData {
  paymentId: string;
  userId: string;
  amount: string;
  currency: string;
  processedAt: number;
}

// Type-safe events
export type UserRegisteredEvent = EventEnvelope<UserRegisteredEventData>;
export type PaymentProcessedEvent = EventEnvelope<PaymentProcessedEventData>;

// Service event registry
export interface MyServiceEventTypes {
  'user.registered': UserRegisteredEventData;
  'payment.processed': PaymentProcessedEventData;
  'order.completed': OrderCompletedEventData;
}
```

### 3. Publishing Events

#### Setup EventPublisher

```typescript
// services/my-service/src/events/publisher.ts
import { KafkaEventPublisher, EventPublisherConfig } from '@moonx-farm/infrastructure';

const publisherConfig: EventPublisherConfig = {
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  kafka: {
    brokers: ['localhost:9092'],
    clientId: 'my-service-publisher',
  },
  topic: {
    main: 'moonx.events',
    deadLetterQueue: 'moonx.ws.events.dlq',
  },
  options: {
    enableValidation: true,
    enableBatching: false,
    enableRetry: true,
    retryAttempts: 3,
  },
};

export const eventPublisher = new KafkaEventPublisher(publisherConfig);
```

#### Publish Events

```typescript
// services/my-service/src/services/userService.ts
import { eventPublisher } from '../events/publisher';

export class UserService {
  async registerUser(userData: CreateUserData) {
    // Business logic...
    const user = await this.createUser(userData);
    
    // Publish event
    await eventPublisher.publish('user.registered', {
      userId: user.id,
      email: user.email,
      registeredAt: Date.now(),
    }, {
      userId: user.id,  // For partition key
      correlationId: userData.requestId,
    });
    
    return user;
  }
  
  // Batch publishing
  async processPayments(payments: PaymentData[]) {
    const events = payments.map(payment => ({
      eventType: 'payment.processed',
      data: {
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        processedAt: Date.now(),
      },
      options: { userId: payment.userId },
    }));
    
    await eventPublisher.publishBatch(events);
  }
}
```

### 4. Consuming Events

#### Create Custom EventFactory

```typescript
// services/my-service/src/events/factory.ts
import { 
  EventFactory, 
  DefaultPartitionStrategy,
  DefaultDataClassificationStrategy 
} from '@moonx-farm/infrastructure';

// Custom partition strategy for your service
class MyServicePartitionStrategy extends DefaultPartitionStrategy {
  getPartitionKey(eventType: string, data: any, userId?: string): string {
    // Custom logic for your service
    if (eventType.startsWith('payment.')) {
      return data.paymentId || 'default';
    }
    
    return super.getPartitionKey(eventType, data, userId);
  }
}

// Custom data classification
class MyServiceDataClassification extends DefaultDataClassificationStrategy {
  getDataClassification(eventType: string, data: any): DataClassification {
    if (eventType.startsWith('payment.')) {
      return 'confidential';
    }
    
    return super.getDataClassification(eventType, data);
  }
}

export const myServiceEventFactory = new EventFactory(
  'my-service',
  '1.0.0',
  new MyServicePartitionStrategy(),
  new MyServiceDataClassification()
);
```

#### Consumer Implementation

```typescript
// services/my-service/src/events/consumer.ts
import { KafkaManager, EventEnvelope, EventHandler } from '@moonx-farm/infrastructure';
import { MyServiceEventTypes } from '../types/events';

export class MyServiceEventConsumer {
  private kafkaManager: KafkaManager;
  private eventHandlers = new Map<string, EventHandler>();

  constructor() {
    this.kafkaManager = new KafkaManager({
      brokers: ['localhost:9092'],
      clientId: 'my-service-consumer',
    });
    
    this.registerHandlers();
  }

  private registerHandlers() {
    this.eventHandlers.set('user.registered', this.handleUserRegistered.bind(this));
    this.eventHandlers.set('payment.processed', this.handlePaymentProcessed.bind(this));
  }

  async start() {
    await this.kafkaManager.connect();
    
    await this.kafkaManager.subscribe(
      'my-service-consumer',
      ['moonx.ws.events'],
      {
        groupId: 'my-service-consumers',
        autoCommit: true,
      },
      this.messageHandler.bind(this)
    );
  }

  private async messageHandler(topic: string, message: any): Promise<void> {
    try {
      const event = this.parseEvent(message);
      if (!event) return;

      const handler = this.eventHandlers.get(event.metadata.eventType);
      if (!handler) {
        console.warn(`No handler for event type: ${event.metadata.eventType}`);
        return;
      }

      await handler(event, {
        topic,
        partition: 0,
        offset: '0',
        timestamp: Date.now(),
        service: 'my-service',
      });
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private parseEvent(message: any): EventEnvelope<any> | null {
    if (message.metadata && message.data) {
      return message as EventEnvelope<any>;
    }
    return null;
  }

  // Event handlers
  private async handleUserRegistered(
    event: EventEnvelope<MyServiceEventTypes['user.registered']>
  ) {
    console.log('User registered:', event.data.userId);
    // Handle user registration logic...
  }

  private async handlePaymentProcessed(
    event: EventEnvelope<MyServiceEventTypes['payment.processed']>
  ) {
    console.log('Payment processed:', event.data.paymentId);
    // Handle payment processing logic...
  }
}
```

## Advanced Features

### 1. Custom Partition Strategies

```typescript
import { PartitionStrategy } from '@moonx-farm/infrastructure';

export class CustomPartitionStrategy implements PartitionStrategy {
  getPartitionKey(eventType: string, data: any, userId?: string): string {
    // Partition by tenant for multi-tenant events
    if (data.tenantId) {
      return data.tenantId;
    }
    
    // Partition by geographic region
    if (data.region) {
      return data.region;
    }
    
    // Default to userId or event type
    return userId || eventType.split('.')[0];
  }
}
```

### 2. Event Transformation

```typescript
import { EventTransformer, EventEnvelope } from '@moonx-farm/infrastructure';

export class EventEnrichmentTransformer implements EventTransformer {
  transform<T, U>(event: EventEnvelope<T>): EventEnvelope<U> {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        context: {
          ...event.metadata.context,
          enrichedAt: Date.now(),
          enrichedBy: 'my-service',
        },
      },
    };
  }
}
```

### 3. Event Filtering

```typescript
import { EventFilter, EventEnvelope } from '@moonx-farm/infrastructure';

export class BusinessHoursFilter implements EventFilter {
  shouldProcess(event: EventEnvelope<any>): boolean {
    const hour = new Date().getHours();
    
    // Only process business events during business hours
    if (event.metadata.eventType.startsWith('business.')) {
      return hour >= 9 && hour <= 17;
    }
    
    // Process all other events
    return true;
  }
}
```

### 4. Event Serialization

```typescript
import { EventSerializer, EventEnvelope } from '@moonx-farm/infrastructure';

export class CompressedEventSerializer implements EventSerializer {
  serialize<T>(event: EventEnvelope<T>): string {
    const compressed = this.compress(JSON.stringify(event));
    return compressed;
  }

  deserialize<T>(data: string): EventEnvelope<T> {
    const decompressed = this.decompress(data);
    return JSON.parse(decompressed);
  }

  private compress(data: string): string {
    // Implement compression logic
    return data;
  }

  private decompress(data: string): string {
    // Implement decompression logic
    return data;
  }
}
```

## Best Practices

### 1. Event Type Naming

```typescript
// ✅ Good: Clear, hierarchical naming
'user.registered'
'order.created'
'payment.processed'
'system.health_check'

// ❌ Bad: Unclear, flat naming
'userReg'
'newOrder'
'paymentDone'
```

### 2. Event Data Design

```typescript
// ✅ Good: Immutable, complete data
export interface OrderCreatedEventData {
  orderId: string;
  userId: string;
  products: Array<{
    productId: string;
    quantity: number;
    price: string;
  }>;
  totalAmount: string;
  currency: string;
  createdAt: number;
  // Include all data needed by consumers
}

// ❌ Bad: Mutable references, incomplete data
export interface OrderCreatedEventData {
  order: Order; // Mutable object reference
  // Missing essential data
}
```

### 3. Error Handling

```typescript
export class RobustEventConsumer {
  private async handleEvent(event: EventEnvelope<any>) {
    try {
      // Process event
      await this.processEvent(event);
    } catch (error) {
      // Log error with context
      console.error('Event processing failed', {
        eventId: event.metadata.eventId,
        eventType: event.metadata.eventType,
        correlationId: event.metadata.correlationId,
        error: error.message,
      });
      
      // Send to dead letter queue or retry
      await this.handleEventError(event, error);
    }
  }
}
```

### 4. Testing Events

```typescript
// Test event creation
describe('EventFactory', () => {
  it('should create valid events', () => {
    const factory = new EventFactory('test-service');
    
    const event = factory.createEvent('user.registered', {
      userId: 'user-123',
      email: 'test@example.com',
    });
    
    expect(event.metadata.eventType).toBe('user.registered');
    expect(event.metadata.source).toBe('test-service');
    expect(event.data.userId).toBe('user-123');
  });
});

// Test event handling
describe('EventConsumer', () => {
  it('should handle events correctly', async () => {
    const consumer = new MyServiceEventConsumer();
    const mockEvent = createMockEvent('user.registered', {
      userId: 'user-123',
    });
    
    const result = await consumer.handleEvent(mockEvent);
    
    expect(result).toBeDefined();
  });
});
```

## Migration Guide

### From Old System to Shared Events

1. **Install shared package:**
   ```bash
   npm install @moonx-farm/infrastructure
   ```

2. **Update imports:**
   ```typescript
   // Before
   import { EventEnvelope } from './types/events';
   
   // After
   import { EventEnvelope } from '@moonx-farm/infrastructure';
   ```

3. **Migrate event types:**
   ```typescript
   // Before: Local event types
   export interface MyEvent {
     // local definition
   }
   
   // After: Use shared envelope
   export interface MyEventData {
     // business data only
   }
   export type MyEvent = EventEnvelope<MyEventData>;
   ```

4. **Update publishers:**
   ```typescript
   // Before: Custom publisher
   const kafka = new KafkaJS();
   await kafka.send(topic, data);
   
   // After: Shared publisher
   const publisher = new KafkaEventPublisher(config);
   await publisher.publish(eventType, data, options);
   ```

## Performance Considerations

### 1. Batching

```typescript
// Enable batching for high throughput
const config: EventPublisherConfig = {
  // ...
  options: {
    enableBatching: true,
    batchSize: 100,
    batchTimeout: 5000,
  },
};
```

### 2. Partitioning

```typescript
// Good partitioning spreads load evenly
class LoadBalancedPartitionStrategy implements PartitionStrategy {
  getPartitionKey(eventType: string, data: any, userId?: string): string {
    // Use hash of stable identifier
    const key = userId || data.tenantId || data.id;
    return key ? this.hash(key) : 'default';
  }
  
  private hash(str: string): string {
    // Simple hash for demonstration
    return String(str.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 10);
  }
}
```

### 3. Memory Management

```typescript
// Process events in chunks for large batches
export class EfficientEventProcessor {
  private async processBatch(events: EventEnvelope<any>[]) {
    const CHUNK_SIZE = 50;
    
    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
      const chunk = events.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(event => this.processEvent(event)));
      
      // Allow garbage collection between chunks
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

## Monitoring & Debugging

### 1. Event Metrics

```typescript
export class EventMetricsCollector {
  private metrics = {
    eventsPublished: new Map<string, number>(),
    eventsProcessed: new Map<string, number>(),
    processingTime: new Map<string, number[]>(),
  };

  recordEventPublished(eventType: string) {
    const count = this.metrics.eventsPublished.get(eventType) || 0;
    this.metrics.eventsPublished.set(eventType, count + 1);
  }

  recordProcessingTime(eventType: string, duration: number) {
    const times = this.metrics.processingTime.get(eventType) || [];
    times.push(duration);
    this.metrics.processingTime.set(eventType, times);
  }

  getMetrics() {
    return {
      published: Object.fromEntries(this.metrics.eventsPublished),
      processed: Object.fromEntries(this.metrics.eventsProcessed),
      avgProcessingTime: Object.fromEntries(
        Array.from(this.metrics.processingTime.entries()).map(([type, times]) => [
          type,
          times.reduce((a, b) => a + b, 0) / times.length,
        ])
      ),
    };
  }
}
```

### 2. Correlation Tracing

```typescript
export class EventTracer {
  static traceEvent(event: EventEnvelope<any>, operation: string) {
    console.log('Event trace', {
      eventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      causationId: event.metadata.causationId,
      eventType: event.metadata.eventType,
      operation,
      timestamp: Date.now(),
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Make sure package is built
   cd packages/infrastructure
   npm run build
   ```

2. **Type Errors**
   ```typescript
   // Ensure proper type imports
   import { EventEnvelope } from '@moonx-farm/infrastructure';
   ```

3. **Connection Issues**
   ```typescript
   // Check Kafka connection
   const isHealthy = await eventPublisher.healthCheck();
   console.log('Publisher healthy:', isHealthy);
   ```

4. **Event Not Processed**
   ```typescript
   // Check event structure
   const validation = eventFactory.validateEvent(event);
   if (!validation.isValid) {
     console.error('Invalid event:', validation.errors);
   }
   ```

## Support

For issues or questions:
1. Check this documentation
2. Review code examples in `/examples`
3. Check logs for error details
4. Contact the platform team

---

**Next:** See specific service implementation examples in the services directory. 