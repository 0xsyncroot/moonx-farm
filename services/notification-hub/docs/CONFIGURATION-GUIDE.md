# ⚙️ Configuration Guide - Notification Hub

## 📋 **Tổng quan**

Notification Hub có 2 tầng cấu hình riêng biệt:
- **Admin Rules**: Do admin tạo, áp dụng cho toàn hệ thống hoặc nhóm users
- **User Configs**: Do user tự quản lý preferences, subscriptions, alerts cá nhân

## 🏗️ **System Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Layer   │    │ Notification    │    │   User Layer    │
│                 │    │   Hub Core      │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Rules Mgmt  │◄┼────┤ │ Processor   │ ├────┼►│ Preferences │ │
│ │ X-API-Key   │ │    │ │             │ │    │ │ JWT Auth    │ │
│ └─────────────┘ │    │ │             │ │    │ └─────────────┘ │
│                 │    │ │             │ │    │ ┌─────────────┐ │
│ System-wide     │    │ │             │ │    │ │Subscriptions│ │
│ Configurations  │    │ │             │ │    │ │             │ │
└─────────────────┘    │ │             │ │    │ └─────────────┘ │
                       │ │             │ │    │ ┌─────────────┐ │
┌─────────────────┐    │ │             │ │    │ │   Alerts    │ │
│ External Events │    │ │             │ │    │ │             │ │
│                 │    │ │             │ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ │             │ │    │                 │
│ │ Kafka Events│◄┼────┤ │             │ │    │ Personal        │
│ │ HTTP API    │ │    │ └─────────────┘ │    │ Configurations  │
│ └─────────────┘ │    └─────────────────┘    └─────────────────┘
└─────────────────┘
```

## 🔧 **1. Admin Rules Management**

### **1.1 Khái niệm Rules**

**Rules** là cấu hình do admin tạo để:
- Thông báo system-wide (maintenance, new features)
- Thông báo targeted (specific user groups)
- Logic xử lý tự động (price movements, system events)
- Thông báo từ external services

### **1.2 Rules API Endpoints**

```bash
# Admin Authentication: X-API-Key header
POST   /api/v1/rules/create           # Tạo rule mới
GET    /api/v1/rules/list             # Lấy danh sách rules
GET    /api/v1/rules/:ruleId          # Lấy rule cụ thể
PUT    /api/v1/rules/:ruleId          # Cập nhật rule
DELETE /api/v1/rules/:ruleId          # Xóa rule
PATCH  /api/v1/rules/:ruleId/toggle   # Bật/tắt rule
POST   /api/v1/rules/:ruleId/test     # Test rule
```

### **1.3 Rule Structure**

```typescript
interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  conditions: {
    type: 'price_change' | 'system_event' | 'user_action' | 'time_based';
    parameters: Record<string, any>;
  };
  actions: Array<{
    type: 'notification' | 'webhook' | 'email';
    parameters: Record<string, any>;
  }>;
  targetUsers?: string[];  // Specific users
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  schedule?: {
    type: 'immediate' | 'delayed' | 'recurring';
    parameters: Record<string, any>;
  };
}
```

### **1.4 Rules Use Cases**

| Rule Type | Description | Example |
|-----------|-------------|---------|
| **System Announcements** | Platform-wide notices | New feature releases, maintenance |
| **Market Events** | Automated market notifications | Major price movements, market news |
| **User Onboarding** | Welcome flows, tutorials | Welcome messages, feature introductions |
| **Security Alerts** | Critical security events | Suspicious login, account changes |

## 👤 **2. User Preferences Management**

### **2.1 Khái niệm User Preferences**

**User Preferences** là cài đặt cá nhân của user:
- Channels muốn nhận thông báo (websocket, email, push, telegram)
- Types of notifications muốn nhận
- Quiet hours settings
- Filtering preferences

### **2.2 Preferences API Endpoints**

```bash
# User Authentication: JWT Bearer token
# UserId được lấy từ JWT payload

GET    /api/v1/preferences            # Lấy preferences của user
PUT    /api/v1/preferences            # Cập nhật toàn bộ preferences  
PATCH  /api/v1/preferences/:section   # Cập nhật section cụ thể
POST   /api/v1/preferences/reset      # Reset về default
```

### **2.3 Preferences Structure**

```typescript
interface UserPreferences {
  userId: string;                      // Từ JWT payload
  channels: {
    websocket: boolean;
    email: boolean;
    push: boolean;
    telegram: boolean;
  };
  notifications: {
    priceAlerts: boolean;
    volumeAlerts: boolean;
    whaleAlerts: boolean;
    walletActivity: boolean;
    systemAlerts: boolean;
    portfolio: boolean;
  };
  frequency: {
    immediate: boolean;
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;               // HH:MM format
    endTime: string;
    timezone: string;
  };
  filters: {
    minPriceChange: number;
    minVolumeThreshold: number;
    watchedTokens: string[];
    ignoredTokens: string[];
  };
}
```

## 📊 **3. User Subscriptions Management**

### **3.1 Khái niệm Subscriptions**

**Subscriptions** là các đăng ký theo dõi cụ thể của user:
- Price alerts cho specific tokens
- Volume alerts
- Wallet tracking
- Portfolio updates

### **3.2 Subscriptions API Endpoints**

```bash
# User Authentication: JWT Bearer token
# UserId được lấy từ JWT payload

GET    /api/v1/subscriptions                    # Lấy user subscriptions
POST   /api/v1/subscriptions                    # Tạo subscription mới
PUT    /api/v1/subscriptions/:subscriptionId    # Cập nhật subscription
DELETE /api/v1/subscriptions/:subscriptionId    # Xóa subscription
PATCH  /api/v1/subscriptions/:subscriptionId/toggle # Bật/tắt subscription
```

### **3.3 Subscription Structure**

```typescript
interface Subscription {
  id: string;
  userId: string;                      // Từ JWT payload
  type: 'price_alert' | 'volume_alert' | 'whale_alert' | 'wallet_tracking';
  target: string;                      // Token symbol, wallet address
  conditions: {
    threshold?: number;
    direction?: 'above' | 'below';
    timeframe?: string;
  };
  channels: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🚨 **4. User Alerts Configuration**

### **4.1 Khái niệm Alerts**

**Alerts** là cấu hình thông báo chi tiết của user:
- Price alerts với conditions cụ thể
- Volume alerts với thresholds
- Whale alerts cho large transactions

### **4.2 Alerts API Endpoints**

```bash
# User Authentication: JWT Bearer token
# UserId được lấy từ JWT payload

GET    /api/v1/alerts                  # Lấy user alerts
POST   /api/v1/alerts/price            # Tạo price alert
POST   /api/v1/alerts/volume           # Tạo volume alert
POST   /api/v1/alerts/whale            # Tạo whale alert
PUT    /api/v1/alerts/:alertId         # Cập nhật alert
DELETE /api/v1/alerts/:alertId         # Xóa alert
```

### **4.3 Alert Configuration Examples**

```typescript
// Price Alert
{
  name: "BTC Price Alert",
  symbol: "BTC",
  targetPrice: 50000,
  direction: "above",
  channels: ["websocket", "push"],
  priority: "high"
}

// Volume Alert  
{
  name: "ETH Volume Spike",
  symbol: "ETH", 
  threshold: 1000000,
  timeframe: "1h",
  channels: ["websocket"],
  priority: "medium"
}
```

## 🔄 **5. Configuration Flow**

### **5.1 Admin Rules Flow**

```
Admin Dashboard → X-API-Key Auth → Rules API → Notification Processor
```

1. Admin tạo/sửa rules qua admin interface
2. Rules được lưu và active ngay lập tức
3. External events trigger rules → notifications

### **5.2 User Config Flow**

```
User Frontend → JWT Auth → User APIs → Personal Settings
```

1. User đăng nhập, JWT chứa userId
2. User config APIs sử dụng userId từ JWT payload
3. User chỉ có thể quản lý data của chính mình

### **5.3 Notification Processing Flow**

```
Event → Rules Engine → User Preferences → Delivery Channels
```

1. Event đến từ Kafka hoặc HTTP API
2. Rules engine xử lý và tạo notifications  
3. Kiểm tra user preferences để filter
4. Gửi qua channels được enable

## 🛠️ **6. Environment Configuration**

### **6.1 Core Settings**

```env
# Application
NODE_ENV=production
PORT=3005

# Authentication  
AUTH_SERVICE_URL=http://auth-service:3001
ADMIN_API_KEY=<secure-admin-key>

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/notifications

# Message Queue
KAFKA_BROKERS=localhost:9092
REDIS_URL=redis://localhost:6379

# Delivery Channels
SENDGRID_API_KEY=<sendgrid-key>
FIREBASE_PROJECT_ID=<firebase-project>
TELEGRAM_BOT_TOKEN=<telegram-token>
```

### **6.2 Security Configuration**

```env
# CORS
ALLOWED_ORIGINS=https://app.moonx.farm,https://admin.moonx.farm

# API Keys
ADMIN_API_KEY=<32-char-secure-key>  # Dùng cho Rules API
SERVICE_JWT_SECRET=<jwt-secret>      # Dùng cho inter-service calls

# Rate Limiting  
RATE_LIMIT_USER=1000                 # requests/hour per user
RATE_LIMIT_ADMIN=5000                # requests/hour per admin
```

## 📋 **Best Practices**

### **1. Security**
- Admin API keys phải được rotate định kỳ
- JWT tokens có expiration time ngắn
- Log tất cả admin actions
- Validate user ownership cho user APIs

### **2. Performance**
- Cache user preferences trong Redis
- Batch process cho bulk notifications
- Rate limit để tránh spam
- Monitor delivery success rates

### **3. Reliability** 
- Retry failed deliveries với exponential backoff
- Dead letter queues cho failed notifications
- Health checks cho tất cả external dependencies
- Graceful degradation khi services unavailable

---

**📚 Tóm tắt**: Admin quản lý Rules cho system-wide notifications, Users quản lý personal preferences/subscriptions/alerts. Notification Hub kết hợp cả hai để deliver notifications phù hợp cho từng user. 