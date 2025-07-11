# Notification Service

Multi-channel notification service for MoonXFarm DEX với real-time delivery system.

## 🏗️ Kiến Trúc

### Multi-Channel Delivery System
- **WebSocket**: Real-time notifications cho users online
- **FCM (Firebase Cloud Messaging)**: Push notifications cho mobile/web apps
- **Email**: SendGrid integration với template system
- **Telegram**: Bot notifications với user subscription

### Event-Driven Architecture
- **Kafka Consumers**: Lắng nghe events từ các services khác
- **Redis**: Caching user preferences và notification queues
- **PostgreSQL**: Storage cho notifications, user settings, delivery tracking

## 🚀 Features

### Core Features
- ✅ Multi-channel delivery với intelligent routing
- ✅ User preference management (per-channel on/off)
- ✅ Template system cho HTML/Text notifications
- ✅ Delivery tracking và retry mechanism
- ✅ Rate limiting và deduplication
- ✅ Batch processing cho performance

### Auto-Configuration
- **WebSocket/FCM**: Auto-enabled, user có thể disable
- **Email/Telegram**: User tự setup, có thể on/off

### Notification Types
- **Trading**: Order filled, swap completed, limit order executed
- **Price Alerts**: Token price thresholds
- **Portfolio**: P&L changes, balance updates
- **Security**: Login attempts, wallet changes
- **System**: Maintenance, updates, announcements

## 📋 Environment Variables

```bash
# Service Configuration
NODE_ENV=development
NOTIFY_SERVICE_PORT=3004
NOTIFY_SERVICE_HOST=localhost
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_farm
DATABASE_MAX_CONNECTIONS=20
DATABASE_SSL=false

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=moonx:notify:

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=notify-service
KAFKA_GROUP_ID=notify-service-group

# Auth Service Integration
AUTH_SERVICE_URL=http://localhost:3001
JWT_SECRET=your-jwt-secret-key

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@moonx.farm
SENDGRID_FROM_NAME=MoonXFarm

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram

# Notification Templates
NOTIFICATION_TEMPLATE_DIR=templates

# Rate Limiting
NOTIFICATION_RATE_LIMIT_PER_MINUTE=100
NOTIFICATION_RATE_LIMIT_PER_HOUR=1000
```

## 🏥 Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Setup database tables
psql -U postgres -d moonx_farm -f migrations/001_create_notifications.sql

# Start service
pnpm dev
```

## 📊 API Endpoints

### User Preferences
```
GET    /api/v1/preferences      # Get user notification preferences
PUT    /api/v1/preferences      # Update user preferences
POST   /api/v1/preferences/reset # Reset to default preferences
```

### Telegram Integration
```
POST   /api/v1/telegram/link    # Link Telegram account
DELETE /api/v1/telegram/unlink  # Unlink Telegram account
POST   /webhook/telegram        # Telegram webhook
```

### Notification Management
```
GET    /api/v1/notifications    # Get user notifications
POST   /api/v1/notifications/mark-read # Mark notifications as read
DELETE /api/v1/notifications/:id # Delete notification
```

### Health & Monitoring
```
GET    /health                  # Service health check
GET    /metrics                 # Service metrics
```

## 🔔 Notification Channels

### WebSocket
- **Target**: Users online
- **Method**: Real-time websocket connection
- **Fallback**: Store in Redis queue cho khi user online

### FCM (Firebase Cloud Messaging)
- **Target**: Users offline hoặc có FCM token
- **Method**: Firebase Admin SDK
- **Fallback**: None (silent fail)

### Email
- **Target**: Users có email trong preferences
- **Method**: SendGrid API với templates
- **Fallback**: Store in failed queue cho retry

### Telegram
- **Target**: Users có Telegram linked
- **Method**: Telegram Bot API
- **Fallback**: Store in failed queue cho retry

## 📊 Performance

- **Throughput**: 10,000+ notifications/minute
- **Latency**: <100ms cho WebSocket, <5s cho external channels
- **Reliability**: 99.9% delivery rate với retry mechanism
- **Scalability**: Horizontal scaling với Kafka consumers

## 🔒 Security

- **Authentication**: JWT verification với auth-service
- **Rate Limiting**: Per-user và per-channel limits
- **Data Protection**: Encrypted sensitive data trong database
- **Audit Logging**: Complete notification delivery audit trail

## 🐛 Troubleshooting

### Common Issues

1. **SendGrid Delivery Failed**
   ```bash
   # Check SendGrid API key
   curl -X GET https://api.sendgrid.com/v3/user/profile \
     -H "Authorization: Bearer $SENDGRID_API_KEY"
   ```

2. **Firebase Connection Failed**
   ```bash
   # Verify Firebase credentials
   echo $FIREBASE_PRIVATE_KEY | base64 -d
   ```

3. **Telegram Bot Issues**
   ```bash
   # Check bot token
   curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
   ```

## 📈 Monitoring

Service exposes metrics cho:
- Notification delivery rates by channel
- Failed delivery counts và reasons
- Processing latency by notification type
- User preference distribution
- Queue sizes và processing times 