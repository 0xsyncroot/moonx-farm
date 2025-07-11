# Generic Event Routing Guide

## 🎯 **Why Generic Approach?**

**Before**: Mỗi khi có event type mới → phải sửa code websocket service  
**After**: Event type mới → chỉ cần add routing rule (không sửa code core)

## 🔄 **How It Works**

### 1. **Pattern-Based Routing**
```typescript
// Thay vì hardcode handlers, dùng patterns
{
  eventTypePattern: /^sync\./,        // Match tất cả sync.* events
  userExtractor: defaultUserExtractor, // Extract userId từ event
  messageTransformer: (event) => ({   // Transform sang WebSocket format
    id: `sync_${event.data.syncOperationId}`,
    type: 'sync_update',
    data: { ...event.data, status: event.metadata.eventType.split('.')[1] }
  })
}
```

### 2. **Built-in Routing Rules**
```typescript
// Default rules support common patterns
[
  /^price\./     → broadcast to 'prices' channel
  /^order\./     → send to user + broadcast to 'orders' 
  /^portfolio\./ → send to user only
  /^trade\./     → send to user + broadcast to 'trades'
  /^sync\./      → send to user only  
  /^system\./    → log only (no forwarding)
]
```

## 🚀 **Adding New Event Types**

### Example 1: Payment Service Events
```typescript
import { kafkaConsumer } from '../services/kafkaConsumer';

// No code changes needed!
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^payment\./,
  userExtractor: (event) => event.data.userId,
  channelMapping: 'payments',
  messageTransformer: (event) => ({
    id: `payment_${event.data.paymentId}`,
    type: 'payment_update', 
    timestamp: event.metadata.timestamp,
    data: {
      paymentId: event.data.paymentId,
      status: event.metadata.eventType.split('.')[1], // created, processed, failed
      amount: event.data.amount,
      currency: event.data.currency
    }
  })
});
```

### Example 2: Notification Service Events
```typescript
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^notification\./,
  userExtractor: (event) => event.data.recipientId,
  messageTransformer: (event) => ({
    id: `notification_${event.data.notificationId}`,
    type: 'notification_update',
    timestamp: event.metadata.timestamp,
    data: {
      title: event.data.title,
      message: event.data.message,
      priority: event.data.priority,
      read: false
    }
  })
});
```

### Example 3: Analytics Events (Log Only)
```typescript
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^analytics\./,
  filter: () => false, // Don't forward to clients, just log
});
```

## 🎛️ **Advanced Features**

### 1. **Conditional Routing**
```typescript
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^admin\./,
  userExtractor: (event) => event.data.adminId,
  filter: (event) => {
    // Only forward to admin users
    return event.data.userRole === 'admin';
  }
});
```

### 2. **Channel Broadcasting + User Targeting**
```typescript
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^order\./,
  userExtractor: (event) => event.data.userId,    // Send to specific user
  channelMapping: 'orders',                       // Also broadcast to orders channel
  messageTransformer: (event) => ({ ... })
});
```

### 3. **Dynamic Configuration**
```typescript
// Load rules from external config/API
const externalConfig = [
  {
    eventPattern: "^inventory\\.",
    userField: "storeManagerId",
    channel: "inventory", 
    messageType: "inventory_update"
  }
];

applyExternalRoutingConfig(externalConfig);
```

## 📊 **Routing Rule Interface**

```typescript
interface EventRoutingRule {
  eventTypePattern: string | RegExp;                          // Pattern to match event types
  userExtractor?: (event: EventEnvelope<any>) => string;     // Extract userId for targeting
  channelMapping?: string;                                    // Channel for broadcasting
  messageTransformer?: (event: EventEnvelope<any>) => WebSocketMessage; // Transform event to WS message
  filter?: (event: EventEnvelope<any>) => boolean;          // Filter condition
}
```

## 🔧 **Management API**

### Add Rule
```typescript
kafkaConsumer.addRoutingRule(rule);
```

### Remove Rule
```typescript
kafkaConsumer.removeRoutingRule(/^payment\./);
```

### Get Current Rules
```typescript
const rules = kafkaConsumer.getRoutingRules();
console.log(`${rules.length} routing rules active`);
```

### Get Metrics
```typescript
const metrics = kafkaConsumer.getMetrics();
console.log('Routing info:', metrics.routing);
```

## 🎯 **Benefits**

### ✅ **Zero Code Changes**
- New services can add events without modifying websocket service
- No need to redeploy websocket service for new event types

### ✅ **Pattern Flexibility** 
- Use RegExp patterns to match multiple event types
- Single rule can handle entire service namespaces (`/^payment\./`)

### ✅ **Configurable Behavior**
- Custom user extraction logic
- Custom message transformation
- Optional filtering conditions
- Flexible routing (user-only, channel-only, or both)

### ✅ **Hot-Reload Support**
- Add/remove rules at runtime
- Load from external configuration
- No service restart needed

### ✅ **Type Safety**
- Full TypeScript support
- EventEnvelope generic typing
- Compile-time validation

## 🆚 **Before vs After**

### Before (Hardcoded Handlers)
```typescript
// ❌ Need to modify this EVERY time
private registerEventHandlers(): void {
  this.eventHandlers.set('price.updated', this.handlePriceUpdated.bind(this));
  this.eventHandlers.set('order.created', this.handleOrderCreated.bind(this));
  this.eventHandlers.set('sync.started', this.handleSyncStarted.bind(this));
  // ... 50+ hardcoded handlers
}

// ❌ Need to add new handler method
private async handleNewEventType(event: EventEnvelope<NewEventData>): Promise<void> {
  // Custom logic for each event type
}
```

### After (Generic Routing)
```typescript
// ✅ Just add a routing rule - no code changes!
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^new_service\./,
  userExtractor: defaultUserExtractor,
  messageTransformer: defaultMessageTransformer
});
```

## 🎪 **Real-World Examples**

### E-commerce Platform
```typescript
// Order management
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^order\./,
  userExtractor: (event) => event.data.customerId,
  channelMapping: 'orders'
});

// Inventory tracking  
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^inventory\./,
  userExtractor: (event) => event.data.storeManagerId,
  channelMapping: 'inventory'
});

// Shipping updates
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^shipping\./,
  userExtractor: (event) => event.data.customerId,
  messageTransformer: (event) => ({
    id: `shipping_${event.data.trackingNumber}`,
    type: 'shipping_update',
    timestamp: event.metadata.timestamp,
    data: {
      trackingNumber: event.data.trackingNumber,
      status: event.metadata.eventType.split('.')[1],
      estimatedDelivery: event.data.estimatedDelivery
    }
  })
});
```

### Financial Platform
```typescript
// Transaction events
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^transaction\./,
  userExtractor: (event) => event.data.accountId,
  filter: (event) => event.data.amount > 1000, // Only high-value transactions
  messageTransformer: (event) => ({
    id: `transaction_${event.data.transactionId}`,
    type: 'transaction_alert',
    timestamp: event.metadata.timestamp,
    data: {
      amount: event.data.amount,
      currency: event.data.currency,
      type: event.data.transactionType,
      riskLevel: event.data.riskLevel
    }
  })
});

// Compliance alerts
kafkaConsumer.addRoutingRule({
  eventTypePattern: /^compliance\./,
  userExtractor: (event) => event.data.complianceOfficerId,
  channelMapping: 'compliance_alerts',
  filter: (event) => event.data.severity === 'high'
});
```

## 🚦 **Migration Strategy**

### Step 1: Keep existing handlers working
```typescript
// Existing hardcoded handlers still work
// No breaking changes
```

### Step 2: Add routing rules for new events
```typescript
// New events use routing rules
kafkaConsumer.addRoutingRule({...});
```

### Step 3: Gradually replace hardcoded handlers
```typescript
// Replace old handlers with routing rules
// More flexible and maintainable
```

## 🎭 **Testing**

### Test Individual Rules
```typescript
const rule = {
  eventTypePattern: /^test\./,
  userExtractor: (event) => event.data.userId,
  messageTransformer: (event) => ({ type: 'test', data: event.data })
};

const mockEvent = createMockEvent('test.example', { userId: 'user123' });
const message = rule.messageTransformer!(mockEvent);

expect(message.type).toBe('test');
expect(message.data.userId).toBe('user123');
```

### Test Rule Matching
```typescript
const rules = kafkaConsumer.getRoutingRules();
const matchingRules = rules.filter(rule => 
  rule.eventTypePattern.test('payment.created')
);

expect(matchingRules.length).toBeGreaterThan(0);
```

## 🎉 **Summary**

**Generic Event Routing** transforms websocket service from **hardcoded event handlers** to **configurable routing engine**:

- ✅ **No code changes** for new event types
- ✅ **Pattern-based routing** với RegExp flexibility  
- ✅ **Hot-reload capability** for dynamic configuration
- ✅ **Type-safe** với full TypeScript support
- ✅ **Backwards compatible** với existing events

**Result**: WebSocket service becomes a **generic event forwarding engine** that any service can use without modification! 🚀 