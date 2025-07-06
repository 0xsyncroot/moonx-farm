# 🔧 Development Guide - Notification Hub

## 📋 **Tổng quan**

Tài liệu hướng dẫn developers maintain và extend Notification Hub. Tập trung vào architecture thực tế, common tasks, và best practices.

## 🏗️ **Current Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Hub Core                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Entry Layer   │ Processing Layer│     Delivery Layer          │
│                 │                 │                             │
│ Routes:         │ Services:       │ Channels:                   │
│ - rules.ts      │ - processor.ts  │ - emailService.ts           │
│ - preferences.ts│ - scheduler.ts  │ - pushService.ts            │
│ - subscriptions.ts - analytics.ts │ - telegramService.ts        │
│ - alerts.ts     │ - database.ts   │ - websocket (external)      │
│                 │                 │                             │
│ Auth:           │ Queue:          │ Storage:                    │
│ - JWT (users)   │ - kafkaService  │ - PostgreSQL                │
│ - X-API-Key     │ - redisService  │ - Redis Cache               │
│   (admin)       │ - worker system │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## 📁 **Project Structure**

```
notification-hub/
├── src/
│   ├── routes/                     # API endpoints
│   │   ├── index.ts               # Route registration với /v1 prefix
│   │   ├── rules.ts               # Admin rules (X-API-Key auth)
│   │   ├── preferences.ts         # User preferences (JWT auth)
│   │   ├── subscriptions.ts       # User subscriptions (JWT auth)
│   │   ├── alerts.ts              # User alerts (JWT auth)
│   │   └── system.ts              # Health checks (no auth)
│   │
│   ├── middleware/
│   │   └── auth.ts                # JWT + X-API-Key authentication
│   │
│   ├── services/                  # Core business logic
│   │   ├── databaseService.ts     # Database operations
│   │   ├── deliveryService.ts     # Multi-channel delivery
│   │   ├── emailService.ts        # Email delivery
│   │   ├── pushNotificationService.ts # Push notifications
│   │   ├── telegramService.ts     # Telegram delivery
│   │   └── prometheusService.ts   # Metrics collection
│   │
│   └── server.ts                  # Main entry point
│
├── config/
│   └── production.env             # Environment variables (65 vars)
│
├── database/
│   ├── schema.sql                 # Complete DB schema
│   └── migrations/                # Database migrations
│
└── docs/                          # Documentation
```

## 🚀 **Common Development Tasks**

### **1. Adding New Notification Types**

#### **Step 1: Add Type Definition**
```typescript
// Add to existing enum in services/databaseService.ts
enum NotificationType {
  PRICE_ALERT = 'price_alert',
  VOLUME_ALERT = 'volume_alert', 
  NEW_TYPE = 'new_type'  // Add here
}
```

#### **Step 2: Add Database Migration**
```sql
-- migrations/00X_add_new_type.sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS new_type_data JSONB;
CREATE INDEX IF NOT EXISTS idx_notifications_new_type ON notifications(type) WHERE type = 'new_type';
```

#### **Step 3: Add Processing Logic**
```typescript
// In services/notificationProcessor.ts
async processNotification(notification: any): Promise<void> {
  switch (notification.type) {
    case 'new_type':
      await this.processNewType(notification);
      break;
    // ... existing cases
  }
}
```

### **2. Adding New Delivery Channels**

#### **Step 1: Create Channel Service**
```typescript
// services/newChannelService.ts
export class NewChannelService {
  async sendNotification(notification: any): Promise<DeliveryResult> {
    // Implementation here
    return {
      channel: 'new_channel',
      success: true,
      deliveryTime: Date.now()
    };
  }
}
```

#### **Step 2: Register in DeliveryService**
```typescript
// services/deliveryService.ts
private async deliverToChannel(notification: any, channel: string): Promise<DeliveryResult> {
  switch (channel) {
    case 'new_channel':
      return await this.newChannelService.sendNotification(notification);
    // ... existing cases
  }
}
```

### **3. Adding New API Endpoints**

#### **For User Endpoints (JWT Auth)**
```typescript
// routes/newUserRoute.ts
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export async function newUserRoutes(fastify: FastifyInstance, options: any) {
  const { authService } = options;
  requireAuth(fastify, authService);

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const userId = authenticatedRequest.user.id; // Always from JWT payload
    // Implementation
  });
}
```

#### **For Admin Endpoints (X-API-Key Auth)**
```typescript
// routes/newAdminRoute.ts  
import { requireAdminAuth } from '../middleware/auth';

export async function newAdminRoutes(fastify: FastifyInstance) {
  requireAdminAuth(fastify);

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Implementation - admin functionality
  });
}
```

### **4. Database Operations**

#### **Adding New Database Methods**
```typescript
// services/databaseService.ts
export class DatabaseService {
  async createNewEntity(data: any): Promise<any> {
    const query = `
      INSERT INTO new_table (column1, column2) 
      VALUES ($1, $2) 
      RETURNING *
    `;
    const result = await this.pool.query(query, [data.value1, data.value2]);
    return result.rows[0];
  }
}
```

## 🔄 **Worker System**

### **Current Workers**
- **PriorityWorker**: High-priority notifications (real-time)
- **BatchWorker**: Bulk operations (email campaigns)
- **RetryWorker**: Failed notification retry logic

### **Adding New Worker**
```typescript
// workers/newWorker.ts
import { BaseWorker } from './baseWorker';

export class NewWorker extends BaseWorker {
  constructor() {
    super({
      name: 'NewWorker',
      concurrency: 3,
      pollingInterval: 5000
    });
  }

  protected async processJob(job: any): Promise<void> {
    // Worker logic here
  }
}
```

## ⚙️ **Configuration Management**

### **Environment Variables**
```env
# Core (Required)
NODE_ENV=production
PORT=3005
AUTH_SERVICE_URL=http://auth-service:3001
ADMIN_API_KEY=<secure-key>

# Database  
DATABASE_URL=postgresql://...

# Message Queue
KAFKA_BROKERS=localhost:9092
REDIS_URL=redis://localhost:6379

# Channels
SENDGRID_API_KEY=<key>
FIREBASE_PROJECT_ID=<project>
TELEGRAM_BOT_TOKEN=<token>
```

### **Feature Flags**
```typescript
// config/featureFlags.ts
const FEATURES = {
  TELEGRAM_NOTIFICATIONS: process.env.FEATURE_TELEGRAM === 'true',
  ADVANCED_ANALYTICS: process.env.FEATURE_ANALYTICS === 'true',
  PUSH_NOTIFICATIONS: process.env.FEATURE_PUSH === 'true'
};
```

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
// tests/services/emailService.test.ts
describe('EmailService', () => {
  it('should send email notification', async () => {
    const emailService = new EmailService(mockConfig);
    const result = await emailService.sendNotification(mockNotification);
    expect(result.success).toBe(true);
  });
});
```

### **Integration Tests**
```typescript
// tests/integration/api.test.ts
describe('API Integration', () => {
  it('should create user preference', async () => {
    const response = await testServer.inject({
      method: 'PUT',
      url: '/api/v1/preferences',
      headers: { authorization: `Bearer ${validJWT}` },
      payload: mockPreferences
    });
    expect(response.statusCode).toBe(200);
  });
});
```

## 📊 **Monitoring & Debugging**

### **Logging**
```typescript
// utils/logger.ts
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('ServiceName');
logger.info('Operation completed', { userId, operation: 'create_alert' });
logger.error('Operation failed', { error: error.message, userId });
```

### **Metrics Collection**
```typescript
// Track custom metrics
await this.prometheusService.recordCustomMetric('notifications_sent_total', 1, {
  type: notification.type,
  channel: channel,
  success: success.toString()
});
```

### **Health Checks**
```typescript
// Add to system health check
async checkCustomServiceHealth(): Promise<boolean> {
  try {
    await this.customService.ping();
    return true;
  } catch {
    return false;
  }
}
```

## 🚀 **Deployment**

### **Docker Setup**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3005
CMD ["npm", "start"]
```

### **Environment Setup**
```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Database migration
npm run migrate:up
```

## 🔒 **Security Considerations**

### **Authentication**
- JWT tokens cho user endpoints (expire in 1 hour)
- X-API-Key cho admin endpoints (rotate monthly)
- Rate limiting: 1000 req/hour cho users, 5000 cho admin

### **Data Validation**
```typescript
// Always validate inputs
function validateNotificationData(data: any): boolean {
  if (!data.title || !data.body) return false;
  if (!['high', 'medium', 'low'].includes(data.priority)) return false;
  return true;
}
```

### **User Data Protection**
- User chỉ access được data của chính mình (userId từ JWT)
- Log all admin actions
- Encrypt sensitive data trong database

## 📋 **Code Standards**

### **TypeScript**
- Strict mode enabled
- Explicit return types cho public methods
- Interface definitions cho tất cả data structures

### **Error Handling**
```typescript
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', { error: error.message, context });
  reply.status(500).send({ error: 'Internal server error' });
}
```

### **API Response Format**
```typescript
// Success
{ success: true, data: {...}, message?: string }

// Error  
{ success: false, error: string, code?: string }
```

## 🎯 **Performance Optimization**

### **Database**
- Use proper indexes cho frequent queries
- Connection pooling (max 20 connections)
- Query optimization cho large datasets

### **Caching**
- Redis cache cho user preferences
- TTL 1 hour cho cached data
- Cache invalidation on updates

### **Rate Limiting**
- User endpoints: 1000 requests/hour
- Admin endpoints: 5000 requests/hour
- Delivery channels có riêng rate limits

---

**🔧 Development Ready!** Follow patterns này để maintain consistency và reliability trong codebase. 