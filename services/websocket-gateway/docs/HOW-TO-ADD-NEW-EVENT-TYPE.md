# 🔧 Hướng dẫn bổ sung Event Type mới

## 📋 Tổng quan

Tài liệu này hướng dẫn chi tiết cách bổ sung một event type mới vào hệ thống WebSocket Gateway đã được chuẩn hóa. Mọi thay đổi sẽ được tự động propagate qua toàn bộ hệ thống nhờ architecture tập trung.

## 🎯 Ví dụ minh họa

Chúng ta sẽ thêm event type `LIQUIDITY_UPDATE` để thông báo thay đổi thanh khoản của trading pairs.

---

## 🚀 Bước 1: Bổ sung Event Type vào Enum

**📁 File:** `src/types/events.ts`

```typescript
// Event Types - Centralized enum để dễ mở rộng
export enum DEXEventType {
  PRICE_UPDATE = 'price_update',
  ORDER_BOOK_UPDATE = 'order_book_update',
  TRADE_NOTIFICATION = 'trade_notification',
  PORTFOLIO_UPDATE = 'portfolio_update',
  SYSTEM_ALERT = 'system_alert',
  LIQUIDITY_UPDATE = 'liquidity_update'  // 🆕 Thêm event type mới
}
```

**⚠️ Lưu ý:** Sử dụng snake_case cho consistency với existing types.

---

## 🔧 Bước 2: Cập nhật Constants Mapping

**📁 File:** `src/types/events.ts`

### 2.1 WebSocket Event Mapping

```typescript
// WebSocket Event Names - Mapping từ DEXEventType sang WebSocket event names
export const WEBSOCKET_EVENTS = {
  [DEXEventType.PRICE_UPDATE]: 'price_update',
  [DEXEventType.ORDER_BOOK_UPDATE]: 'order_book_update',
  [DEXEventType.TRADE_NOTIFICATION]: 'trade_notification',
  [DEXEventType.PORTFOLIO_UPDATE]: 'portfolio_update',
  [DEXEventType.SYSTEM_ALERT]: 'system_alert',
  [DEXEventType.LIQUIDITY_UPDATE]: 'liquidity_update'  // 🆕 Thêm mapping
} as const;
```

### 2.2 Kafka Topic Mapping

```typescript
// Kafka Topics - Mapping từ DEXEventType sang Kafka topic names
export const KAFKA_TOPICS = {
  [DEXEventType.PRICE_UPDATE]: 'price.updates',
  [DEXEventType.ORDER_BOOK_UPDATE]: 'order.book.updates',
  [DEXEventType.TRADE_NOTIFICATION]: 'trade.notifications',
  [DEXEventType.PORTFOLIO_UPDATE]: 'portfolio.updates',
  [DEXEventType.SYSTEM_ALERT]: 'system.alerts',
  [DEXEventType.LIQUIDITY_UPDATE]: 'liquidity.updates'  // 🆕 Thêm topic
} as const;
```

### 2.3 General Room (nếu cần)

```typescript
// General Room Names - Shared rooms không cần symbol/userId
export const GENERAL_ROOMS = {
  PRICE_UPDATES: 'price_updates',
  TRADE_NOTIFICATIONS: 'trade_notifications',
  PORTFOLIO_UPDATES: 'portfolio_updates',
  SYSTEM_ALERTS: 'system_alerts',
  ORDER_UPDATES: 'order_updates',
  LIQUIDITY_UPDATES: 'liquidity_updates'  // 🆕 Nếu cần general room
} as const;
```

### 2.4 Subscription Types (nếu cần)

```typescript
// Subscription Types - Valid subscription types for clients
export const SUBSCRIPTION_TYPES = {
  PRICE_UPDATES: 'price_updates',
  TRADE_NOTIFICATIONS: 'trade_notifications',
  PORTFOLIO_UPDATES: 'portfolio_updates',
  SYSTEM_ALERTS: 'system_alerts',
  ORDER_UPDATES: 'order_updates',
  LIQUIDITY_UPDATES: 'liquidity_updates'  // 🆕 Nếu cần subscription
} as const;
```

---

## 📊 Bước 3: Định nghĩa Data Interface

**📁 File:** `src/types/events.ts`

```typescript
// Specific Event Data Types - Type-safe data structures for each event type
export interface LiquidityUpdateData {
  symbol: string;
  totalLiquidity: number;
  liquidityChange: number;
  liquidityChangePercent: number;
  providers: Array<{
    address: string;
    contribution: number;
    percentage: number;
  }>;
  apr: number;
  volume24h: number;
  fees24h: number;
  lastUpdated: number;
}
```

---

## 🎭 Bước 4: Tạo Typed Event Interface

**📁 File:** `src/types/events.ts`

```typescript
// Typed DEX Events - Type-safe event interfaces
export interface LiquidityUpdateEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.LIQUIDITY_UPDATE;
  data: LiquidityUpdateData;
}

// Cập nhật Union type
export type TypedDEXEvent = 
  | PriceUpdateEvent
  | OrderBookUpdateEvent
  | TradeNotificationEvent
  | PortfolioUpdateEvent
  | SystemAlertEvent
  | LiquidityUpdateEvent;  // 🆕 Thêm vào union type
```

---

## 📡 Bước 5: Cập nhật EventBroadcaster Service

**📁 File:** `src/services/eventBroadcaster.ts`

### 5.1 Thêm Case vào Switch Statement

```typescript
async broadcastEvent(event: DEXEvent): Promise<void> {
  try {
    const startTime = Date.now();
    
    switch (event.type) {
      case DEXEventType.PRICE_UPDATE:
        await this.broadcastPriceUpdate(event);
        break;
      case DEXEventType.ORDER_BOOK_UPDATE:
        await this.broadcastOrderBookUpdate(event);
        break;
      case DEXEventType.TRADE_NOTIFICATION:
        await this.broadcastTradeNotification(event);
        break;
      case DEXEventType.PORTFOLIO_UPDATE:
        await this.broadcastPortfolioUpdate(event);
        break;
      case DEXEventType.SYSTEM_ALERT:
        await this.broadcastSystemAlert(event);
        break;
      case DEXEventType.LIQUIDITY_UPDATE:  // 🆕 Thêm case mới
        await this.broadcastLiquidityUpdate(event);
        break;
      default:
        logger.warn('Unknown event type', { type: event.type });
    }

    // Record metrics - increment messages processed
    this.prometheusMetrics.incrementMessagesSent();
    
  } catch (error) {
    logger.error('Error broadcasting event', {
      type: event.type,
      symbol: event.symbol,
      error: error instanceof Error ? error.message : String(error)
    });
    
    this.prometheusMetrics.incrementErrors();
  }
}
```

### 5.2 Implement Broadcast Method

```typescript
private async broadcastLiquidityUpdate(event: DEXEvent): Promise<void> {
  const { symbol, data } = event;
  
  if (!symbol) {
    logger.warn('Liquidity update missing symbol', { event });
    return;
  }

  // Broadcast to symbol-specific room
  const symbolRoom = createRoomName.price(symbol); // Sử dụng price room hoặc tạo liquidity room
  this.io.to(symbolRoom).emit(WEBSOCKET_EVENTS[DEXEventType.LIQUIDITY_UPDATE], {
    symbol,
    totalLiquidity: data.totalLiquidity,
    liquidityChange: data.liquidityChange,
    liquidityChangePercent: data.liquidityChangePercent,
    providers: data.providers,
    apr: data.apr,
    volume24h: data.volume24h,
    fees24h: data.fees24h,
    timestamp: event.timestamp
  });

  // Broadcast to general liquidity room (nếu cần)
  if (GENERAL_ROOMS.LIQUIDITY_UPDATES) {
    this.io.to(GENERAL_ROOMS.LIQUIDITY_UPDATES).emit(WEBSOCKET_EVENTS[DEXEventType.LIQUIDITY_UPDATE], {
      symbol,
      totalLiquidity: data.totalLiquidity,
      liquidityChange: data.liquidityChange,
      liquidityChangePercent: data.liquidityChangePercent,
      timestamp: event.timestamp
    });
  }

  logger.debug('Liquidity update broadcasted', { 
    symbol, 
    totalLiquidity: data.totalLiquidity,
    clientsCount: await this.getClientsCount(symbolRoom)
  });
}
```

### 5.3 Cập nhật getBroadcastStats (nếu cần)

```typescript
async getBroadcastStats(): Promise<{
  totalRooms: number;
  totalClients: number;
  roomStats: Array<{ room: string; clients: number }>;
}> {
  try {
    const rooms = [
      GENERAL_ROOMS.PRICE_UPDATES,
      GENERAL_ROOMS.TRADE_NOTIFICATIONS,
      GENERAL_ROOMS.PORTFOLIO_UPDATES,
      GENERAL_ROOMS.SYSTEM_ALERTS,
      GENERAL_ROOMS.LIQUIDITY_UPDATES  // 🆕 Thêm room mới
    ];
    const roomStats = [];
    let totalClients = 0;

    for (const room of rooms) {
      const clients = await this.getClientsCount(room);
      roomStats.push({ room, clients });
      totalClients += clients;
    }

    return {
      totalRooms: rooms.length,
      totalClients,
      roomStats
    };
  } catch (error) {
    logger.error('Error getting broadcast stats', { 
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      totalRooms: 0,
      totalClients: 0,
      roomStats: []
    };
  }
}
```

---

## 🔄 Bước 6: Cập nhật MessageRouter (nếu cần)

**📁 File:** `src/services/messageRouter.ts`

Nếu cần client subscribe trực tiếp:

```typescript
private setupDefaultHandlers(): void {
  // ... existing handlers

  // Liquidity subscription handler
  this.handlers.set('subscribe_liquidity', async (socket, data) => {
    const { symbol } = data;
    if (symbol && typeof symbol === 'string') {
      await socket.join(createRoomName.price(symbol.toUpperCase()));
      socket.emit('liquidity_subscribed', { symbol: symbol.toUpperCase() });
      logger.debug('Liquidity subscription', { userId: socket.userId, symbol });
    }
  });

  // ... other handlers
}
```

---

## ⚙️ Bước 7: Cập nhật Config (nếu cần)

**📁 File:** `src/config.ts`

Config tự động cập nhật nhờ `ALL_KAFKA_TOPICS` constant, không cần thay đổi gì.

---

## 🧪 Bước 8: Testing

### 8.1 Unit Test cho EventBroadcaster

**📁 File:** `tests/services/eventBroadcaster.test.ts`

```typescript
import { DEXEventType } from '../../src/types';

describe('EventBroadcasterService', () => {
  it('should broadcast liquidity update correctly', async () => {
    const mockEvent = {
      type: DEXEventType.LIQUIDITY_UPDATE,
      symbol: 'BTC-USDC',
      data: {
        totalLiquidity: 1000000,
        liquidityChange: 50000,
        liquidityChangePercent: 5.0,
        providers: [
          {
            address: '0x123...',
            contribution: 500000,
            percentage: 50
          }
        ],
        apr: 12.5,
        volume24h: 2000000,
        fees24h: 1000,
        lastUpdated: Date.now()
      },
      timestamp: Date.now()
    };

    await eventBroadcaster.broadcastEvent(mockEvent);

    // Verify emit was called with correct parameters
    expect(mockIo.to).toHaveBeenCalledWith('price:BTC-USDC');
    expect(mockIo.emit).toHaveBeenCalledWith('liquidity_update', expect.objectContaining({
      symbol: 'BTC-USDC',
      totalLiquidity: 1000000,
      liquidityChange: 50000
    }));
  });
});
```

### 8.2 Integration Test

**📁 File:** `tests/integration/liquidityUpdate.test.ts`

```typescript
import { KafkaProducer } from '@moonx-farm/kafka';
import { DEXEventType, KAFKA_TOPICS } from '../../src/types';

describe('Liquidity Update Integration', () => {
  it('should receive liquidity update from Kafka and broadcast via WebSocket', async () => {
    const producer = new KafkaProducer();
    
    // Publish to Kafka
    await producer.publish(KAFKA_TOPICS[DEXEventType.LIQUIDITY_UPDATE], {
      type: DEXEventType.LIQUIDITY_UPDATE,
      symbol: 'ETH-USDC',
      data: {
        totalLiquidity: 500000,
        liquidityChange: 25000,
        liquidityChangePercent: 5.0,
        providers: [],
        apr: 15.0,
        volume24h: 1000000,
        fees24h: 500,
        lastUpdated: Date.now()
      },
      timestamp: Date.now()
    });

    // Verify WebSocket client receives the event
    await new Promise(resolve => {
      mockWebSocketClient.on('liquidity_update', (data) => {
        expect(data.symbol).toBe('ETH-USDC');
        expect(data.totalLiquidity).toBe(500000);
        resolve();
      });
    });
  });
});
```

---

## 📖 Bước 9: Cập nhật Documentation

### 9.1 Cập nhật README.md

**📁 File:** `README.md`

Thêm vào phần "API Reference":

```markdown
#### Liquidity Update Events

| Event | Payload | Description | Latency |
|-------|---------|-------------|---------|
| `liquidity_update` | `{ symbol, totalLiquidity, liquidityChange, providers, apr }` | Liquidity pool changes | <10ms |
```

Thêm vào phần examples:

```typescript
// Subscribe to liquidity updates
socket.emit('join_room', { room: 'price:BTC-USDC' });
socket.on('liquidity_update', (data) => {
  console.log('💧 Liquidity update:', {
    symbol: data.symbol,
    totalLiquidity: data.totalLiquidity,
    liquidityChange: data.liquidityChange,
    apr: data.apr
  });
});
```

### 9.2 Cập nhật Client Integration Guide

**📁 File:** `docs/CLIENT-INTEGRATION-GUIDE.md`

```markdown
### Liquidity Updates

```javascript
// Subscribe to liquidity updates
socket.on('liquidity_update', (data) => {
  console.log('💧 Liquidity update:', data);
  // {
  //   symbol: 'BTC-USDC',
  //   totalLiquidity: 1000000,
  //   liquidityChange: 50000,
  //   liquidityChangePercent: 5.0,
  //   providers: [...],
  //   apr: 12.5,
  //   timestamp: 1641234567890
  // }
});
```

### 9.3 Cập nhật Server Push Guide

**📁 File:** `docs/SERVER-PUSH-GUIDE.md`

```typescript
// Publish liquidity update
await eventService.publishLiquidityUpdate(
  'BTC-USDC',
  {
    totalLiquidity: 1000000,
    liquidityChange: 50000,
    liquidityChangePercent: 5.0,
    providers: [
      {
        address: '0x123...',
        contribution: 500000,
        percentage: 50
      }
    ],
    apr: 12.5,
    volume24h: 2000000,
    fees24h: 1000,
    lastUpdated: Date.now()
  },
  { priority: 'medium', source: 'liquidity-service' }
);
```

---

## ✅ Bước 10: Verification Checklist

### 10.1 Code Quality Checks

- [ ] **TypeScript compile**: `npm run build` - no errors
- [ ] **Linting**: `npm run lint` - no errors  
- [ ] **Type checking**: `npm run type-check` - no errors
- [ ] **Tests pass**: `npm test` - all tests green

### 10.2 Functionality Checks

- [ ] **Kafka consumer** nhận được event từ topic mới
- [ ] **EventBroadcaster** broadcast event đúng room
- [ ] **WebSocket clients** nhận được event với đúng format
- [ ] **Metrics** được record correctly
- [ ] **Logging** hiển thị thông tin debug

### 10.3 Integration Checks

- [ ] **Backend service** có thể publish event mới
- [ ] **Frontend client** có thể subscribe và nhận event
- [ ] **Room management** hoạt động đúng
- [ ] **Error handling** hoạt động khi có lỗi

---

## 🚀 Deployment

### 10.1 Staging Environment

```bash
# Build and test
npm run build
npm run test

# Deploy to staging
npm run deploy:staging

# Verify integration
npm run test:integration:staging
```

### 10.2 Production Environment

```bash
# Deploy to production
npm run deploy:production

# Monitor for errors
npm run monitor:production

# Verify metrics
curl https://websocket-gateway.moonx.farm/metrics | grep liquidity
```

---

## 🔍 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Event not received** | Kafka topic not created | Create topic manually or enable auto-creation |
| **TypeScript errors** | Missing interface updates | Check all TypeScript files for missing imports |
| **WebSocket not emitting** | Missing case in switch statement | Verify broadcastEvent switch statement |
| **Room not found** | Invalid room name | Check room name generation and validation |

### Debug Commands

```bash
# Check Kafka topics
kafka-topics.sh --list --bootstrap-server localhost:9092

# Check WebSocket connections
curl http://localhost:3007/stats

# Check logs
tail -f logs/websocket-gateway.log | grep liquidity
```

---

## 📋 Summary

Với architecture tập trung, việc thêm event type mới chỉ cần:

1. **1 file chính**: `src/types/events.ts` - define types & constants
2. **1 method**: `broadcastLiquidityUpdate()` - handle broadcasting
3. **1 case**: Switch statement trong `broadcastEvent()`
4. **Tests**: Unit và integration tests
5. **Docs**: Cập nhật documentation

**🎯 Tất cả mappings, validations, và configurations tự động cập nhật!**

---

## 🔗 Related Documents

- [Client Integration Guide](./CLIENT-INTEGRATION-GUIDE.md)
- [Server Push Guide](./SERVER-PUSH-GUIDE.md)
- [Architecture Overview](../README.md#centralized-types--constants-architecture)
- [Testing Guide](./TESTING-GUIDE.md)

---

**💡 Tip**: Sử dụng template này cho mọi event type mới để đảm bảo consistency và completeness! 