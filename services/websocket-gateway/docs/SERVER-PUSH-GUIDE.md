# Server Push Notifications Guide

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Kafka Integration](#kafka-integration)
4. [Event Types](#event-types)
5. [Service Implementation](#service-implementation)
6. [API Reference](#api-reference)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

---

## 🎯 **Overview**

WebSocket Gateway supports server-side push notifications from backend services to connected clients via Kafka event streaming. This allows real-time updates for:

- **Price updates** (ultra-low latency)
- **Trade notifications** (real-time execution)
- **Portfolio updates** (balance changes)
- **Order book updates** (bid/ask changes)
- **System alerts** (platform announcements)

**Flow**: Backend Service → Kafka → WebSocket Gateway → Connected Clients

---

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend       │    │     Kafka       │    │   WebSocket     │
│   Services      │───▶│   Cluster       │───▶│   Gateway       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │ Event Sourcing  │    │   Connected     │
                    │ & Analytics     │    │   Clients       │
                    │                 │    │                 │
                    └─────────────────┘    └─────────────────┘
```

### Communication Patterns

1. **Event Streaming**: Backend services publish to Kafka topics
2. **Room-based Broadcasting**: Events routed to specific WebSocket rooms
3. **User-specific Events**: Direct user targeting via user rooms
4. **Broadcast Events**: System-wide announcements
5. **Event Sourcing**: Complete audit trail via Kafka retention

---

## 🔴 **Kafka Integration**

### Kafka Topics

WebSocket Gateway subscribes to these Kafka topics:

```typescript
// Topic naming convention
const TOPICS = {
  PRICE_UPDATES: 'price.updates',
  ORDER_BOOK_UPDATES: 'order.book.updates',
  TRADE_NOTIFICATIONS: 'trade.notifications',
  PORTFOLIO_UPDATES: 'portfolio.updates',
  SYSTEM_ALERTS: 'system.alerts'
};
```

### Event Format

All Kafka events must follow this standard format:

```typescript
interface DEXEvent {
  type: 'price_update' | 'order_book_update' | 'trade_notification' | 'portfolio_update' | 'system_alert';
  symbol?: string;                 // Trading pair symbol (e.g., "BTC-USDC")
  userId?: string;                 // User ID for user-specific events
  data: Record<string, any>;       // Event payload
  timestamp: number;               // Unix timestamp
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    source?: string;               // Source service name
    version?: string;              // Event schema version
  };
}
```

---

## 📢 **Event Types**

### 1. Price Updates

```typescript
// Price update event
{
  type: 'price_update',
  symbol: 'BTC-USDC',
  data: {
    price: 45000.50,
    change: 125.30,
    changePercent: 0.28,
    volume: 1234567.89,
    high24h: 45500.00,
    low24h: 44200.00,
    lastUpdated: 1703123456789
  },
  timestamp: Date.now(),
  metadata: {
    priority: 'high',
    source: 'price-service'
  }
}
```

### 2. Order Book Updates

```typescript
// Order book update event
{
  type: 'order_book_update',
  symbol: 'ETH-USDC',
  data: {
    bids: [
      [2500.00, 1.5],
      [2499.50, 2.0],
      [2498.00, 0.8]
    ],
    asks: [
      [2501.00, 1.2],
      [2501.50, 0.9],
      [2502.00, 2.5]
    ],
    lastUpdated: 1703123456789
  },
  timestamp: Date.now(),
  metadata: {
    priority: 'high',
    source: 'orderbook-service'
  }
}
```

### 3. Trade Notifications

```typescript
// Trade notification event
{
  type: 'trade_notification',
  symbol: 'BTC-USDC',
  userId: 'user-123', // Optional: for personal trades
  data: {
    tradeId: 'trade-456',
    price: 45000.00,
    amount: 0.1,
    side: 'buy',
    txHash: '0x...',
    gasUsed: '21000',
    fees: {
      gas: '0.001',
      platform: '0.0005'
    }
  },
  timestamp: Date.now(),
  metadata: {
    priority: 'high',
    source: 'trading-service'
  }
}
```

### 4. Portfolio Updates

```typescript
// Portfolio update event
{
  type: 'portfolio_update',
  userId: 'user-123',
  data: {
    totalValue: 15420.75,
    totalValueChange: 297.55,
    totalValueChangePercent: 1.97,
    positions: [
      {
        symbol: 'BTC-USDC',
        amount: 0.35,
        value: 15750.00,
        pnl: 125.30,
        pnlPercent: 0.8
      },
      {
        symbol: 'ETH-USDC',
        amount: 3.2,
        value: 8000.00,
        pnl: -50.25,
        pnlPercent: -0.62
      }
    ],
    lastUpdated: 1703123456789
  },
  timestamp: Date.now(),
  metadata: {
    priority: 'medium',
    source: 'portfolio-service'
  }
}
```

### 5. System Alerts

```typescript
// System alert event
{
  type: 'system_alert',
  data: {
    alertId: 'alert-789',
    level: 'info', // 'info', 'warning', 'error'
    title: 'New Token Listed',
    message: 'PEPE token is now available for trading on MoonX Farm',
    category: 'new_listing',
    actionUrl: '/trade/PEPE-USDC',
    actionText: 'Trade Now',
    expiresAt: Date.now() + 86400000 // 24 hours
  },
  timestamp: Date.now(),
  metadata: {
    priority: 'medium',
    source: 'admin-service'
  }
}
```

---

## 🔧 **Service Implementation**

### 1. Kafka Producer Setup

```typescript
// kafka-producer.ts
import { Kafka, Producer, ProducerRecord } from 'kafkajs';

export class KafkaEventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'backend-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      // Performance optimizations
      connectionTimeout: 1000,
      requestTimeout: 5000,
      retry: {
        initialRetryTime: 100,
        retries: 3,
        maxRetryTime: 1000
      }
    });

    this.producer = this.kafka.producer({
      // Performance settings for real-time events
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 5000,
      allowAutoTopicCreation: false
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log('🔗 Kafka producer connected');
    } catch (error) {
      console.error('❌ Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async publishEvent(
    topic: string, 
    event: DEXEvent,
    partition?: number
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer not connected');
    }

    try {
      const record: ProducerRecord = {
        topic,
        messages: [{
          key: event.symbol || event.userId || 'system',
          value: JSON.stringify(event),
          partition,
          timestamp: event.timestamp.toString()
        }]
      };

      await this.producer.send(record);
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log('🔌 Kafka producer disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Kafka producer:', error);
    }
  }
}
```

### 2. Event Service

```typescript
// event-service.ts
import { KafkaEventProducer } from './kafka-producer';

export class DEXEventService {
  private kafkaProducer: KafkaEventProducer;

  constructor() {
    this.kafkaProducer = new KafkaEventProducer();
  }

  async initialize(): Promise<void> {
    await this.kafkaProducer.connect();
  }

  // Publish price update
  async publishPriceUpdate(
    symbol: string,
    priceData: any,
    metadata?: any
  ): Promise<void> {
    const event: DEXEvent = {
      type: 'price_update',
      symbol,
      data: priceData,
      timestamp: Date.now(),
      metadata
    };

    await this.kafkaProducer.publishEvent('price.updates', event);
  }

  // Publish order book update
  async publishOrderBookUpdate(
    symbol: string,
    orderBookData: any,
    metadata?: any
  ): Promise<void> {
    const event: DEXEvent = {
      type: 'order_book_update',
      symbol,
      data: orderBookData,
      timestamp: Date.now(),
      metadata
    };

    await this.kafkaProducer.publishEvent('order.book.updates', event);
  }

  // Publish trade notification
  async publishTradeNotification(
    symbol: string,
    tradeData: any,
    userId?: string,
    metadata?: any
  ): Promise<void> {
    const event: DEXEvent = {
      type: 'trade_notification',
      symbol,
      userId,
      data: tradeData,
      timestamp: Date.now(),
      metadata
    };

    await this.kafkaProducer.publishEvent('trade.notifications', event);
  }

  // Publish portfolio update
  async publishPortfolioUpdate(
    userId: string,
    portfolioData: any,
    metadata?: any
  ): Promise<void> {
    const event: DEXEvent = {
      type: 'portfolio_update',
      userId,
      data: portfolioData,
      timestamp: Date.now(),
      metadata
    };

    await this.kafkaProducer.publishEvent('portfolio.updates', event);
  }

  // Publish system alert
  async publishSystemAlert(
    alertData: any,
    metadata?: any
  ): Promise<void> {
    const event: DEXEvent = {
      type: 'system_alert',
      data: alertData,
      timestamp: Date.now(),
      metadata
    };

    await this.kafkaProducer.publishEvent('system.alerts', event);
  }

  async shutdown(): Promise<void> {
    await this.kafkaProducer.disconnect();
  }
}
```

### 3. Service Integration Examples

#### Trading Service Integration

```typescript
// trading-service.ts
import { DEXEventService } from './event-service';

export class TradingService {
  private eventService: DEXEventService;

  constructor() {
    this.eventService = new DEXEventService();
  }

  async initialize(): Promise<void> {
    await this.eventService.initialize();
  }

  async executeTrade(tradeOrder: TradeOrder): Promise<TradeResult> {
    try {
      // Execute trade logic
      const result = await this.performTrade(tradeOrder);

      // Publish trade notification
      await this.eventService.publishTradeNotification(
        tradeOrder.symbol,
        {
          tradeId: tradeOrder.id,
          price: result.executedPrice,
          amount: result.executedAmount,
          side: tradeOrder.side,
          txHash: result.txHash,
          gasUsed: result.gasUsed,
          fees: result.fees
        },
        tradeOrder.userId,
        { priority: 'high', source: 'trading-service' }
      );

      // Update portfolio
      await this.updatePortfolioAfterTrade(tradeOrder.userId, result);

      return result;
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to publish trade notification:', error);
      throw error;
    }
  }

  private async updatePortfolioAfterTrade(userId: string, tradeResult: TradeResult): Promise<void> {
    // Calculate new portfolio values
    const portfolioData = await this.calculatePortfolio(userId);

    // Publish portfolio update
    await this.eventService.publishPortfolioUpdate(
      userId,
      portfolioData,
      { priority: 'medium', source: 'trading-service' }
    );
  }
}
```

#### Price Service Integration

```typescript
// price-service.ts
import { DEXEventService } from './event-service';

export class PriceService {
  private eventService: DEXEventService;

  constructor() {
    this.eventService = new DEXEventService();
  }

  async initialize(): Promise<void> {
    await this.eventService.initialize();
  }

  async updatePrice(symbol: string, priceData: PriceData): Promise<void> {
    try {
      // Store price in database
      await this.storePriceUpdate(symbol, priceData);

      // Publish price update event (real-time)
      await this.eventService.publishPriceUpdate(
        symbol,
        {
          price: priceData.price,
          change: priceData.change,
          changePercent: priceData.changePercent,
          volume: priceData.volume,
          high24h: priceData.high24h,
          low24h: priceData.low24h,
          lastUpdated: Date.now()
        },
        { priority: 'high', source: 'price-service' }
      );

      // Check for triggered alerts
      await this.checkPriceAlerts(symbol, priceData);

    } catch (error) {
      console.error('Failed to process price update:', error);
      throw error;
    }
  }

  private async checkPriceAlerts(symbol: string, priceData: PriceData): Promise<void> {
    // Get alerts that match the price condition
    const triggeredAlerts = await this.getTriggeredAlerts(symbol, priceData.price);

    // Send system alerts for triggered price alerts
    for (const alert of triggeredAlerts) {
      await this.eventService.publishSystemAlert({
        alertId: alert.id,
        level: 'info',
        title: 'Price Alert Triggered',
        message: `${symbol} has reached your target price of $${alert.targetPrice}`,
        category: 'price_alert',
        actionUrl: `/trade/${symbol}`,
        actionText: 'Trade Now'
      }, { priority: 'medium', source: 'price-service' });

      // Mark alert as triggered
      await this.markAlertAsTriggered(alert.id);
    }
  }
}
```

---

## 📖 **API Reference**

### Kafka Topics

| Topic | Description | Event Types |
|-------|-------------|-------------|
| `price.updates` | Real-time price updates | price_update |
| `order.book.updates` | Order book changes | order_book_update |
| `trade.notifications` | Trade executions | trade_notification |
| `portfolio.updates` | Portfolio changes | portfolio_update |
| `system.alerts` | System messages | system_alert |

### Event Routing

| Event Type | WebSocket Room Pattern | Target Audience |
|------------|------------------------|-----------------|
| `price_update` | `price:{symbol}`, `price_updates` | All price subscribers |
| `order_book_update` | `orderbook:{symbol}` | Order book subscribers |
| `trade_notification` | `trade:{symbol}`, `user:{userId}` | Symbol traders, personal trades |
| `portfolio_update` | `user:{userId}` | Specific user |
| `system_alert` | Broadcast to all | All connected clients |

### Event Priorities

| Priority | Description | Use Cases |
|----------|-------------|-----------|
| `high` | Critical real-time events | Price updates, trade executions |
| `medium` | Important notifications | Portfolio updates, system alerts |
| `low` | Informational events | General announcements |

### Event Metadata

| Field | Type | Description |
|-------|------|-------------|
| `priority` | string | Event priority (high, medium, low) |
| `source` | string | Source service name |
| `version` | string | Event schema version |

---

## 🎯 **Best Practices**

### 1. Message Design

```typescript
// ✅ Good: Structured, typed data
{
  type: 'swap_completed',
  target: { type: 'user', id: 'user-123' },
  data: {
    swapId: 'swap-456',
    fromToken: 'ETH',
    toToken: 'USDC',
    fromAmount: '1.5',
    toAmount: '2500.0'
  }
}

// ❌ Bad: Unstructured, hard to parse
{
  type: 'swap',
  message: 'Swap completed: 1.5 ETH -> 2500 USDC'
}
```

### 2. Error Handling

```typescript
// Always handle Redis connection errors
try {
  await notificationService.notifyUser(userId, 'swap_completed', data);
} catch (error) {
  // Log error but don't fail the main operation
  console.error('Failed to send notification:', error);
  
  // Optional: Queue for retry
  await queueNotificationForRetry(userId, 'swap_completed', data);
}
```

### 3. Performance Considerations

```typescript
// Batch notifications when possible
const notifications = users.map(userId => ({
  type: 'system_announcement',
  target: { type: 'user', id: userId },
  data: announcementData
}));

// Send in batches to avoid overwhelming Redis
for (const batch of chunk(notifications, 100)) {
  await Promise.all(
    batch.map(notification => 
      notificationService.publishNotification(notification)
    )
  );
}
```

### 4. Security

```typescript
// Validate user permissions before sending
async function notifyUserSecure(userId: string, type: string, data: any) {
  // Check if user has permission for this notification type
  if (!await hasNotificationPermission(userId, type)) {
    throw new Error('User does not have permission for this notification');
  }
  
  // Sanitize data before sending
  const sanitizedData = sanitizeNotificationData(data);
  
  await notificationService.notifyUser(userId, type, sanitizedData);
}
```

---

## 💡 **Examples**

### Complete Integration Example

```typescript
// Complete service integration
import { NotificationService } from '@moonx-farm/websocket-gateway';

class SwapService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async processSwap(swapOrder: SwapOrder): Promise<void> {
    try {
      // 1. Execute swap
      const result = await this.executeSwap(swapOrder);

      // 2. Update database
      await this.updateSwapRecord(swapOrder.id, result);

      // 3. Send success notification
      await this.notificationService.notifySwapCompleted(
        swapOrder.userId,
        {
          swapId: swapOrder.id,
          fromToken: swapOrder.fromToken,
          toToken: swapOrder.toToken,
          fromAmount: swapOrder.fromAmount,
          toAmount: result.toAmount,
          txHash: result.txHash,
          gasUsed: result.gasUsed,
          timestamp: Date.now()
        }
      );

      // 4. Notify trading room if public
      if (swapOrder.isPublic) {
        await this.notificationService.notifyRoom(
          'trading-room-general',
          'trading',
          'public_swap_completed',
          {
            fromToken: swapOrder.fromToken,
            toToken: swapOrder.toToken,
            fromAmount: swapOrder.fromAmount,
            toAmount: result.toAmount,
            timestamp: Date.now()
          }
        );
      }

    } catch (error) {
      // Send failure notification
      await this.notificationService.notifyUser(
        swapOrder.userId,
        'swap_failed',
        {
          swapId: swapOrder.id,
          error: error.message,
          errorCode: error.code,
          fromToken: swapOrder.fromToken,
          toToken: swapOrder.toToken,
          fromAmount: swapOrder.fromAmount
        },
        { priority: 'high', source: 'swap-service' }
      );

      throw error;
    }
  }
}
```

### Notification Queue (Advanced)

```typescript
// Notification queue with retry logic
class NotificationQueue {
  private queue: Array<QueuedNotification> = [];
  private processing = false;

  async addNotification(notification: QueuedNotification): Promise<void> {
    this.queue.push(notification);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const notification = this.queue.shift()!;
      
      try {
        await this.sendNotification(notification);
      } catch (error) {
        // Retry logic
        if (notification.retryCount < 3) {
          notification.retryCount++;
          notification.nextRetry = Date.now() + (1000 * Math.pow(2, notification.retryCount));
          this.queue.push(notification);
        } else {
          console.error('Failed to send notification after 3 retries:', error);
        }
      }
    }

    this.processing = false;
  }
}
```

---

## 🚀 **Getting Started**

### 1. Install Dependencies

```bash
npm install kafkajs
npm install @types/kafkajs --save-dev
```

### 2. Configure Environment

```env
# Kafka configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=your-service
KAFKA_GROUP_ID=your-service-group

# WebSocket Gateway
WEBSOCKET_GATEWAY_URL=http://localhost:3007
```

### 3. Initialize Event Service

```typescript
// In your service constructor
import { DEXEventService } from './event-service';

export class YourService {
  private eventService: DEXEventService;

  constructor() {
    this.eventService = new DEXEventService();
  }

  async initialize(): Promise<void> {
    await this.eventService.initialize();
  }

  async yourMethod(): Promise<void> {
    // Your business logic
    
    // Publish event
    await this.eventService.publishPriceUpdate(
      'BTC-USDC',
      {
        price: 45000.50,
        change: 125.30,
        volume: 1234567.89
      },
      { priority: 'high', source: 'your-service' }
    );
  }

  async shutdown(): Promise<void> {
    await this.eventService.shutdown();
  }
}
```

### 4. Test Integration

```typescript
// Test event publishing
async function testEventPublishing() {
  const eventService = new DEXEventService();
  
  await eventService.initialize();
  
  // Test price update
  await eventService.publishPriceUpdate(
    'BTC-USDC',
    {
      price: 45000.50,
      change: 125.30,
      changePercent: 0.28,
      volume: 1234567.89,
      lastUpdated: Date.now()
    },
    {
      priority: 'high',
      source: 'test-service'
    }
  );
  
  // Test system alert
  await eventService.publishSystemAlert(
    {
      level: 'info',
      title: 'Test Alert',
      message: 'Hello from backend service!',
      category: 'test'
    },
    {
      priority: 'medium',
      source: 'test-service'
    }
  );
  
  await eventService.shutdown();
  console.log('Test events published successfully');
}
```

---

## 🎉 **Next Steps**

1. **Setup Kafka**: Configure Kafka cluster and topics
2. **Implement DEXEventService**: Add event service to your codebase  
3. **Publish Events**: Integrate event publishing into your business logic
4. **Test Integration**: Verify events are received by WebSocket clients
5. **Monitor Performance**: Add logging and monitoring for event delivery
6. **Scale Horizontally**: Add more Kafka partitions for higher throughput

**Need help?** Check the [Client Integration Guide](./CLIENT-INTEGRATION-GUIDE.md) for frontend implementation.

---

**Happy integrating! 🚀** 