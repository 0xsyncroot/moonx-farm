# 📨 Service Integration Guide - Notification Hub

## 📋 **Tổng quan**

Tài liệu hướng dẫn backend services tích hợp với Notification Hub để gửi thông báo. Hub đóng vai trò message processor trong Split Architecture, nhận events và phân phối đến users qua multiple channels.

## 🏗️ **Integration Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Backend        │    │  Notification   │    │  Delivery       │
│  Services       │───▶│  Hub            │───▶│  Channels       │
│                 │    │                 │    │                 │
│ - Trading       │    │ - Processing    │    │ - WebSocket     │
│ - Portfolio     │    │ - Rules Engine  │    │ - Email         │
│ - Auth          │    │ - User Prefs    │    │ - Push          │
│ - Admin Panel   │    │ - Analytics     │    │ - Telegram      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
     Kafka Events            Processing &                 Multi-channel
     HTTP API               User Filtering               Delivery
```

## 🚀 **1. Kafka Integration (Recommended)**

### **1.1 Supported Topics**

```typescript
const KAFKA_TOPICS = {
  PRICE_ALERTS: 'price.alerts',
  VOLUME_ALERTS: 'volume.alerts',
  WALLET_ACTIVITY: 'wallet.activity',
  SYSTEM_ALERTS: 'system.alerts',
  USER_EVENTS: 'user.events'
};
```

### **1.2 Event Format**

```typescript
interface NotificationEvent {
  type: 'price_alert' | 'volume_alert' | 'wallet_activity' | 'system_alert' | 'user_event';
  userId?: string;                    // For personal notifications
  targetUsers?: string[];             // For targeted notifications  
  data: {
    title: string;
    body: string;
    icon?: string;
    url?: string;                     // Action URL
    [key: string]: any;
  };
  channels: string[];                 // ['websocket', 'push', 'email', 'telegram']
  priority: 'high' | 'medium' | 'low';
  metadata: {
    source: string;                   // Service name
    timestamp: number;
    category?: string;
    tags?: string[];
    expiresAt?: number;
  };
}
```

### **1.3 Producer Setup**

```typescript
// kafka-producer.ts
import { Kafka, Producer } from 'kafkajs';

export class NotificationProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'your-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async publishNotification(topic: string, notification: NotificationEvent): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{
        key: notification.userId || 'system',
        value: JSON.stringify(notification),
        timestamp: notification.metadata.timestamp.toString()
      }]
    });
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}
```

## 📊 **2. Common Integration Patterns**

### **2.1 Trading Service - User Events**

```typescript
// trading-service.ts
export class TradingService {
  private notificationProducer: NotificationProducer;

  async executeTrade(trade: TradeOrder): Promise<void> {
    // Execute trade
    const result = await this.performTrade(trade);

    // Send notification
    await this.notificationProducer.publishNotification('user.events', {
      type: 'user_event',
      userId: trade.userId,
      data: {
        title: 'Trade Executed',
        body: `${trade.side} order for ${trade.amount} ${trade.symbol} executed at $${result.price}`,
        url: `/trades/${result.id}`
      },
      channels: ['websocket', 'push'],
      priority: 'high',
      metadata: {
        source: 'trading-service',
        timestamp: Date.now(),
        category: 'trade_execution',
        tags: ['trading', trade.symbol]
      }
    });
  }
}
```

### **2.2 Price Service - Price Alerts** 

```typescript
// price-service.ts
export class PriceService {
  async checkPriceAlerts(symbol: string, price: number): Promise<void> {
    const alerts = await this.getTriggeredAlerts(symbol, price);

    for (const alert of alerts) {
      await this.notificationProducer.publishNotification('price.alerts', {
        type: 'price_alert',
        userId: alert.userId,
        data: {
          title: `Price Alert: ${symbol}`,
          body: `${symbol} reached $${price}`,
          url: `/charts/${symbol}`
        },
        channels: ['websocket', 'push', 'email'],
        priority: 'high',
        metadata: {
          source: 'price-service',
          timestamp: Date.now(),
          category: 'price_alert',
          tags: ['price', symbol]
        }
      });
    }
  }
}
```

### **2.3 System Service - Announcements**

```typescript
// system-service.ts
export class SystemService {
  async announceNewToken(token: Token): Promise<void> {
    // Broadcast to all active users
    await this.notificationProducer.publishNotification('system.alerts', {
      type: 'system_alert',
      data: {
        title: 'New Token Listed',
        body: `${token.name} (${token.symbol}) is now available for trading`,
        icon: token.logoUrl,
        url: `/trade/${token.symbol}`
      },
      channels: ['websocket', 'push'],
      priority: 'medium',
      metadata: {
        source: 'system-service',
        timestamp: Date.now(),
        category: 'token_listing',
        tags: ['announcement', token.symbol]
      }
    });
  }

  async scheduleMaintenance(maintenance: MaintenanceSchedule): Promise<void> {
    const affectedUsers = await this.getAffectedUsers(maintenance.services);

    await this.notificationProducer.publishNotification('system.alerts', {
      type: 'system_alert',
      targetUsers: affectedUsers,
      data: {
        title: 'Scheduled Maintenance',
        body: `Platform maintenance: ${maintenance.startTime}. Duration: ${maintenance.duration}`,
        url: '/maintenance'
      },
      channels: ['websocket', 'email'],
      priority: 'high',
      metadata: {
        source: 'system-service',
        timestamp: Date.now(),
        category: 'maintenance'
      }
    });
  }
}
```

## 🔗 **3. HTTP API Integration**

### **3.1 API Endpoints**

```bash
# Direct notification sending
POST https://notification-hub.moonx.farm/api/v1/notifications/send

# Headers
Content-Type: application/json
Authorization: Bearer <SERVICE_JWT_TOKEN>
```

### **3.2 HTTP Client**

```typescript
// notification-client.ts
import axios, { AxiosInstance } from 'axios';

export class NotificationClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NOTIFICATION_HUB_URL || 'http://localhost:3005',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SERVICE_JWT_TOKEN}`
      },
      timeout: 5000
    });
  }

  async sendNotification(notification: NotificationEvent): Promise<void> {
    await this.client.post('/api/v1/notifications/send', notification);
  }

  async sendBulkNotifications(notifications: NotificationEvent[]): Promise<void> {
    await this.client.post('/api/v1/notifications/bulk', { notifications });
  }
}
```

### **3.3 HTTP Usage Example**

```typescript
// user-service.ts
export class UserService {
  private notificationClient: NotificationClient;

  async createUser(user: User): Promise<void> {
    await this.saveUser(user);

    // Send welcome notification
    await this.notificationClient.sendNotification({
      type: 'user_event',
      userId: user.id,
      data: {
        title: 'Welcome to MoonX Farm!',
        body: 'Start trading with your favorite tokens',
        url: '/dashboard'
      },
      channels: ['websocket', 'email'],
      priority: 'medium',
      metadata: {
        source: 'user-service',
        timestamp: Date.now(),
        category: 'onboarding'
      }
    });
  }
}
```

## 📋 **4. Admin Rules vs User Configs**

### **4.1 Rules (Admin-managed)**

Rules được tạo bởi admin để:
- System-wide announcements (maintenance, new features)
- Automated market notifications (price movements)
- Security alerts (unusual activities)

```typescript
// Admin creates rules via X-API-Key authenticated endpoints
const systemRule = {
  name: 'High Volume Alert',
  conditions: {
    type: 'volume_spike',
    parameters: { threshold: 1000000, timeframe: '1h' }
  },
  actions: [{
    type: 'notification',
    parameters: {
      title: 'High Volume Detected',
      body: 'Unusual trading volume detected',
      channels: ['websocket', 'push'],
      priority: 'medium'
    }
  }],
  enabled: true
};
```

### **4.2 User Configs (User-managed)**

Users tự quản lý:
- Personal preferences (channels, notification types)
- Individual alerts (price alerts, portfolio updates) 
- Subscriptions (specific tokens, wallets)

```typescript
// Users manage via JWT authenticated endpoints
const userPreference = {
  channels: { websocket: true, email: false, push: true },
  notifications: { priceAlerts: true, systemAlerts: true },
  quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' }
};

const userAlert = {
  type: 'price_alert',
  symbol: 'BTC',
  targetPrice: 50000,
  direction: 'above',
  channels: ['websocket', 'push']
};
```

## 🔧 **5. Configuration & Setup**

### **5.1 Environment Variables**

```env
# Kafka Configuration  
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=your-service-name

# HTTP Configuration
NOTIFICATION_HUB_URL=http://localhost:3005
SERVICE_JWT_TOKEN=your-service-jwt-token

# Service Discovery (optional)
CONSUL_HOST=localhost
CONSUL_PORT=8500
```

### **5.2 Service Initialization**

```typescript
// your-service.ts
export class YourService {
  private notificationProducer: NotificationProducer;
  private notificationClient: NotificationClient;

  constructor() {
    // Choose Kafka or HTTP based on your needs
    this.notificationProducer = new NotificationProducer();
    this.notificationClient = new NotificationClient();
  }

  async initialize(): Promise<void> {
    await this.notificationProducer.connect();
    console.log('Notification integration ready');
  }

  async shutdown(): Promise<void> {
    await this.notificationProducer.disconnect();
  }
}
```

## ⚡ **6. Best Practices**

### **6.1 Error Handling**

```typescript
try {
  await notificationProducer.publishNotification(topic, notification);
} catch (error) {
  // Log error but don't fail main operation
  console.error('Notification failed:', error);
  
  // Optional: Store for retry
  await this.storeFailedNotification(notification);
}
```

### **6.2 Message Validation**

```typescript
function validateNotification(notification: NotificationEvent): boolean {
  if (!notification.type || !notification.data.title || !notification.data.body) {
    return false;
  }

  const validChannels = ['websocket', 'push', 'email', 'telegram'];
  if (!notification.channels.every(ch => validChannels.includes(ch))) {
    return false;
  }

  return ['high', 'medium', 'low'].includes(notification.priority);
}
```

### **6.3 Rate Limiting**

```typescript
// Batch notifications to avoid overwhelming
const notifications = users.map(user => ({
  type: 'system_alert',
  userId: user.id,
  data: { title: 'System Update', body: 'New features available' },
  channels: ['push'],
  priority: 'low'
}));

// Send in batches of 100
for (const batch of chunk(notifications, 100)) {
  await notificationClient.sendBulkNotifications(batch);
  await sleep(1000); // Wait between batches
}
```

## 🎯 **7. Common Use Cases**

### **7.1 Real-time Trading Events**

```typescript
// High-priority, immediate delivery
const tradingEvents = {
  type: 'user_event',
  priority: 'high',
  channels: ['websocket', 'push'],
  metadata: { category: 'trading', realtime: true }
};
```

### **7.2 Daily Summaries**

```typescript
// Scheduled, low-priority notifications
const dailySummary = {
  type: 'user_event', 
  priority: 'low',
  channels: ['email'],
  metadata: { 
    category: 'summary',
    schedule: { type: 'recurring', cron: '0 9 * * *' }
  }
};
```

### **7.3 System Announcements**

```typescript
// Platform-wide, medium priority
const announcement = {
  type: 'system_alert',
  priority: 'medium',
  channels: ['websocket', 'push'],
  metadata: { category: 'announcement', broadcast: true }
};
```

## 📊 **8. Monitoring & Health**

### **8.1 Health Checks**

```typescript
const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${NOTIFICATION_HUB_URL}/api/v1/system/health`);
    return response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
};
```

### **8.2 Metrics Tracking**

```typescript
// Track notification metrics
await this.metrics.recordNotificationSent({
  service: 'trading-service',
  type: 'trade_execution', 
  channel: 'websocket',
  success: true,
  latency: 50
});
```

### **8.3 Structured Logging**

```typescript
console.log('Notification sent', {
  notificationId: notification.id,
  userId: notification.userId,
  type: notification.type,
  channels: notification.channels,
  source: notification.metadata.source,
  timestamp: new Date().toISOString()
});
```

## 🔒 **9. Security Considerations**

### **9.1 Authentication**
- Service JWT tokens for inter-service communication
- X-API-Key for admin operations
- Proper token validation and expiration

### **9.2 Data Protection**
- Sanitize notification content
- Validate user targeting
- Rate limiting per service
- Audit logging for admin actions

### **9.3 Access Control**
- Services can only send notifications, not read user data
- Admin endpoints require separate authentication
- User data isolation enforced by Hub

## 🚀 **10. Getting Started**

### **10.1 Dependencies**

```bash
# For Kafka integration
npm install kafkajs

# For HTTP integration  
npm install axios

# Types
npm install @types/node --save-dev
```

### **10.2 Quick Start**

```typescript
// 1. Initialize producer
const producer = new NotificationProducer();
await producer.connect();

// 2. Send notification
await producer.publishNotification('user.events', {
  type: 'user_event',
  userId: 'user-123',
  data: { title: 'Hello', body: 'Test notification' },
  channels: ['websocket'],
  priority: 'medium',
  metadata: { source: 'my-service', timestamp: Date.now() }
});

// 3. Cleanup
await producer.disconnect();
```

---

**🚀 Integration Ready!** Notification Hub sẽ xử lý delivery, user filtering, và analytics tự động. Focus vào business logic, để Hub lo phần notification delivery. 