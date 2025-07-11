# MoonX Farm Notification Service - API Guide

## 📋 Tổng quan

Notification Service là hệ thống thông báo đa kênh cho MoonX Farm DEX, hỗ trợ gửi thông báo qua WebSocket, FCM (Firebase Cloud Messaging), Email (SendGrid), và Telegram.

### ✨ Tính năng chính

- **Multi-channel delivery**: WebSocket, FCM, Email, Telegram
- **Template system**: Handlebars templates với helpers formatting
- **User preferences**: Cấu hình channel theo user
- **Delivery tracking**: Theo dõi và retry logic
- **Queue management**: Lập lịch thông báo
- **Real-time**: WebSocket integration với Kafka
- **Production-ready**: Monitoring, metrics, health checks

## 🚀 Quick Start

### 1. Cài đặt Dependencies

```bash
cd services/notify-service
npm install
```

### 2. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_notifications

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=no-reply@moonx.farm
SENDGRID_FROM_NAME=MoonX Farm

# Firebase (FCM)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# App
NEXT_PUBLIC_APP_URL=https://moonx.farm
NODE_ENV=development
```

### 3. Database Setup

```bash
# Run migrations
npm run migrate
```

### 4. Start Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📡 API Endpoints

### Base URL: `http://localhost:3004`

### 🔔 Notifications

#### Create Notification
```http
POST /notifications
Content-Type: application/json

{
  "userId": "user123",
  "notificationType": "trading",
  "title": "Order Filled",
  "content": "Your order for {{amount}} {{tokenSymbol}} has been filled",
  "data": {
    "amount": "100",
    "tokenSymbol": "USDC",
    "orderType": "buy",
    "transactionHash": "0x123...",
    "explorerUrl": "https://etherscan.io/tx/0x123..."
  },
  "priority": "high",
  "channels": ["websocket", "fcm", "email"],
  "templateKey": "order_filled"
}
```

**Response:**
```json
{
  "id": 1,
  "userId": "user123",
  "title": "Order Filled",
  "content": "Your order for 100 USDC has been filled",
  "notificationType": "trading",
  "priority": "high",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Get User Notifications
```http
GET /notifications/user/{userId}?page=1&limit=20&type=trading&isRead=false
```

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "userId": "user123",
      "title": "Order Filled",
      "content": "Your order has been filled",
      "notificationType": "trading",
      "priority": "high",
      "isRead": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### Mark as Read
```http
PATCH /notifications/{id}/read
Content-Type: application/json

{
  "userId": "user123"
}
```

#### Delete Notification
```http
DELETE /notifications/{id}
Content-Type: application/json

{
  "userId": "user123"
}
```

#### Manual Send
```http
POST /notifications/{id}/send
Content-Type: application/json

{
  "channels": ["email", "telegram"]
}
```

### ⚙️ User Preferences

#### Get Preferences
```http
GET /preferences/{userId}
```

**Response:**
```json
{
  "id": 1,
  "userId": "user123",
  "websocketEnabled": true,
  "fcmEnabled": true,
  "emailEnabled": false,
  "telegramEnabled": true,
  "emailAddress": null,
  "telegramChatId": "123456789",
  "fcmToken": "fcm_token_here",
  "preferences": {},
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update Preferences
```http
PATCH /preferences/{userId}
Content-Type: application/json

{
  "emailEnabled": true,
  "emailAddress": "user@example.com",
  "fcmToken": "new_fcm_token"
}
```

#### Link Telegram
```http
POST /preferences/{userId}/telegram/link
Content-Type: application/json

{
  "telegramChatId": "123456789",
  "telegramUsername": "username"
}
```

#### Get Channel Statuses
```http
GET /preferences/{userId}/channels
```

**Response:**
```json
{
  "websocket": {
    "enabled": true,
    "configured": true
  },
  "fcm": {
    "enabled": true,
    "configured": true
  },
  "email": {
    "enabled": false,
    "configured": false
  },
  "telegram": {
    "enabled": true,
    "configured": true
  }
}
```

#### Enable/Disable Channel
```http
PATCH /preferences/{userId}/channels/{channel}
Content-Type: application/json

{
  "enabled": true
}
```

### 🏥 Health Check

```http
GET /health
```

**Response:**
```json
{
  "healthy": true,
  "services": {
    "database": true,
    "websocket": true,
    "fcm": true,
    "email": true,
    "telegram": false
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 📋 Notification Types

| Type | Description | Auto Channels |
|------|-------------|---------------|
| `trading` | Trading activities (orders, fills) | WebSocket, FCM |
| `price_alert` | Price threshold alerts | WebSocket, FCM, Email |
| `portfolio` | Portfolio changes | WebSocket, FCM |
| `security` | Security events | All channels |
| `system` | System announcements | WebSocket, Email |

## 🔧 Channel Configuration

### WebSocket
- **Auto-enabled**: ✅ Bật mặc định
- **Configuration**: Không cần config đặc biệt
- **Delivery**: Real-time qua Kafka

### FCM (Firebase Cloud Messaging)
- **Auto-enabled**: ✅ Bật mặc định
- **Configuration**: Cần FCM token từ client
- **Features**: Push notifications, custom data

### Email (SendGrid)
- **Manual setup**: ❌ User phải cấu hình
- **Configuration**: Cần email address
- **Features**: HTML templates, tracking

### Telegram
- **Manual setup**: ❌ User phải link account
- **Configuration**: Cần chat ID từ bot
- **Features**: Rich formatting, inline buttons

## 💡 Usage Examples

### Basic Notification
```javascript
// Tạo thông báo đơn giản
const response = await fetch('http://localhost:3004/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    notificationType: 'system',
    title: 'Welcome to MoonX Farm!',
    content: 'Your account has been successfully created.',
    priority: 'normal'
  })
});
```

### Trading Notification with Template
```javascript
// Thông báo trading với template
const notification = {
  userId: 'trader456',
  notificationType: 'trading',
  templateKey: 'order_filled',
  title: 'Order Executed',
  content: 'Order {{orderType}} {{amount}} {{tokenSymbol}} filled at {{price}}',
  data: {
    orderType: 'BUY',
    amount: '1,000',
    tokenSymbol: 'USDC',
    price: '$1.00',
    transactionHash: '0x742d35Cc6C4C9c0532a88c5e8c38B0D5B1F0c2A3E',
    explorerUrl: 'https://etherscan.io/tx/0x742d35Cc6C4C9c0532a88c5e8c38B0D5B1F0c2A3E'
  },
  priority: 'high',
  channels: ['websocket', 'fcm', 'email']
};
```

### Price Alert
```javascript
// Thông báo price alert
const priceAlert = {
  userId: 'trader789',
  notificationType: 'price_alert',
  templateKey: 'price_threshold',
  title: 'Price Alert Triggered',
  content: '{{tokenSymbol}} đã {{direction}} {{changePercent}} và đạt {{currentPrice}}',
  data: {
    tokenSymbol: 'ETH',
    currentPrice: '$2,500',
    previousPrice: '$2,300',
    changePercent: '+8.7%',
    direction: 'tăng',
    threshold: '$2,400'
  },
  priority: 'urgent'
};
```

### Scheduled Notification
```javascript
// Lập lịch thông báo
const scheduled = {
  userId: 'user123',
  notificationType: 'system',
  title: 'Maintenance Notice',
  content: 'System maintenance sẽ bắt đầu vào {{maintenanceStart}}',
  data: {
    maintenanceStart: '2024-01-01 02:00 UTC',
    maintenanceEnd: '2024-01-01 04:00 UTC'
  },
  scheduledAt: '2024-01-01T01:00:00Z',
  priority: 'normal'
};
```

## 🎨 Template System

### Handlebars Helpers

```handlebars
{{!-- Currency formatting --}}
{{currency 1000}} → $1,000.00

{{!-- Percentage --}}
{{percentage 8.5}} → 8.50%

{{!-- Numbers --}}
{{number 1000000}} → 1,000,000

{{!-- Dates --}}
{{formatDate timestamp}} → Jan 1, 2024, 10:30 AM
{{shortDate timestamp}} → Jan 1

{{!-- Conditionals --}}
{{#ifEquals direction "up"}}📈{{else}}📉{{/ifEquals}}

{{!-- Crypto helpers --}}
{{tokenSymbol "eth"}} → ETH
{{shortHash "0x742d35Cc..."}} → 0x742d35...742d35

{{!-- Priority styling --}}
{{priorityColor "urgent"}} → #ff4444
{{directionIcon "up"}} → 📈
```

### Email Template Example
```handlebars
<h2 style="color: {{priorityColor priority}}">
  {{directionIcon direction}} {{title}}
</h2>

<p>Xin chào {{userId}},</p>

<p>
  {{#ifEquals notificationType "trading"}}
    Lệnh {{data.orderType}} của bạn đã được thực hiện:
    <br>
    <strong>{{currency data.amount}} {{tokenSymbol data.tokenSymbol}}</strong>
  {{else}}
    {{content}}
  {{/ifEquals}}
</p>

{{#if data.explorerUrl}}
<p>
  <a href="{{data.explorerUrl}}" style="background: #007BFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
    🔍 Xem trên Explorer
  </a>
</p>
{{/if}}

<p><small>{{formatDate timestamp}}</small></p>
```

## 🔌 Integration

### Client-side Setup

```javascript
// 1. Setup FCM token
import { getMessaging, getToken } from 'firebase/messaging';

const messaging = getMessaging();
const fcmToken = await getToken(messaging, {
  vapidKey: 'your-vapid-key'
});

// Update user preferences
await fetch(`/preferences/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fcmToken })
});

// 2. WebSocket connection
const ws = new WebSocket('ws://localhost:3005');
ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Received notification:', notification);
};
```

### Server Integration

```javascript
// Gửi notification từ trading service
const sendTradingNotification = async (order) => {
  await fetch('http://localhost:3004/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: order.userId,
      notificationType: 'trading',
      templateKey: 'order_filled',
      title: 'Order Filled',
      content: 'Your {{orderType}} order has been executed',
      data: {
        orderType: order.type,
        amount: order.amount,
        tokenSymbol: order.token,
        transactionHash: order.txHash,
        explorerUrl: `https://etherscan.io/tx/${order.txHash}`
      },
      priority: 'high'
    })
  });
};
```

## 📊 Monitoring

### Metrics Endpoints
```bash
# Service health
GET /health

# Swagger docs  
GET /docs
```

### Logs
```bash
# View service logs
docker logs moonx-notify-service

# Follow logs
docker logs -f moonx-notify-service
```

## ❗ Error Handling

### Common Errors

| Code | Error | Solution |
|------|-------|----------|
| 400 | Invalid notification request | Check required fields |
| 404 | User preferences not found | Will auto-create default |
| 500 | Channel provider error | Check environment variables |

### Retry Logic
- **Delivery failures**: Exponential backoff (1min, 2min, 4min)
- **Queue processing**: Every 1 minute
- **Max retries**: 3 attempts per channel

## 🔒 Security

### Authentication
- Service-to-service communication qua internal network
- API rate limiting: 100 requests/minute
- Input validation với Zod schemas

### Data Privacy
- Sensitive data (FCM tokens) được obfuscate trong logs
- Email addresses lowercase normalization
- Telegram chat IDs validation

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3004
CMD ["npm", "start"]
```

### Environment
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
KAFKA_BROKERS=kafka:9092
```

## 📋 Next Steps

1. **WebSocket Service**: Real-time delivery
2. **Metrics Dashboard**: Grafana monitoring  
3. **A/B Testing**: Template optimization
4. **Mobile Apps**: Native push integration

---

**🔗 Related Services:**
- [WebSocket Service](../websocket-service/README.md) - Real-time delivery
- [Auth Service](../auth-service/README.md) - User authentication
- [Core Service](../core-service/README.md) - Business logic

**📞 Support:** [GitHub Issues](https://github.com/moonx-farm/issues) 