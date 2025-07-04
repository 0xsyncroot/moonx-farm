# MoonXFarm Notify Service

**Comprehensive Real-time Notification System với Socket.IO, Kafka, Redis**

## 🎯 Overview

MoonXFarm Notify Service cung cấp hệ thống thông báo real-time hoàn chỉnh với khả năng scale cao cho MoonXFarm DEX. Hỗ trợ **2 mô hình triển khai**:

- **Phase 1**: Single Service (Development → Production)
- **Phase 2**: Split Architecture (High Scale) 

## 🏗️ Architecture

### **Phase 1: Single Service**
```
┌─────────────────────────────────────────────────────┐
│                Notify Service                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Socket.IO │  │   Kafka     │  │   Redis     │  │
│  │   Server    │  │  Consumer   │  │   Manager   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │    HTTP     │  │  Notification│  │   Mobile    │  │
│  │    API      │  │   Processor  │  │   Push      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

### **Phase 2: Split Architecture (High Scale)**
```
┌─────────────────────┐    ┌─────────────────────┐
│  WebSocket Gateway  │    │  Notification Hub   │
├─────────────────────┤    ├─────────────────────┤
│  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │   Socket.IO   │  │◄──►│  │ Kafka Consumer│  │
│  │   Cluster     │  │    │  │   Pool        │  │
│  └───────────────┘  │    │  └───────────────┘  │
│  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │  Connection   │  │    │  │ Notification  │  │
│  │   Manager     │  │    │  │  Processor    │  │
│  └───────────────┘  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘
```

## ✨ Features

### **🔄 Real-time Notifications**
- **WebSocket Support**: Socket.IO v4.7+ với mobile compatibility
- **Chart Updates**: Sub-second price/liquidity updates
- **Trading Alerts**: Order fills, swaps, portfolio changes
- **System Messages**: Maintenance, announcements, security alerts

### **📱 Multi-Channel Delivery**
- **WebSocket**: Real-time browser notifications
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Email**: SMTP email notifications
- **SMS**: Optional SMS integration

### **⚡ High Performance**
- **Horizontal Scaling**: Redis adapter cho Socket.IO clustering
- **Load Balancing**: Connection distribution across servers
- **Message Queuing**: Priority-based delivery với Kafka
- **Caching**: Intelligent Redis caching strategies

### **🛡️ Enterprise Features**
- **Authentication**: JWT token validation
- **Rate Limiting**: Connection và message rate limits
- **Monitoring**: Prometheus metrics, health checks
- **Error Handling**: Circuit breakers, retry mechanisms

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- Redis 7+
- Apache Kafka 2.8+
- PostgreSQL 15+ (for logs)

### **Installation**

```bash
# Clone repository
git clone https://github.com/moonxfarm/moonx-farm.git
cd moonx-farm/services/notify-service

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit environment variables
nano .env
```

### **Environment Configuration**

```bash
# Server Configuration
PORT=3006
NODE_ENV=development
SERVICE_NAME=notify-service

# Socket.IO Configuration
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
SOCKET_MAX_BUFFER_SIZE=1048576

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=notify-service
KAFKA_GROUP_ID=notify-service-group

# Firebase Configuration (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
EMAIL_FROM=MoonXFarm <noreply@moonx.farm>
```

### **Development Server**

```bash
# Start development server
npm run dev

# Start with PM2
pm2 start ecosystem.config.js

# Check logs
npm run logs
```

## 📊 API Documentation

### **WebSocket Events**

#### **Client → Server**
```typescript
// Join notification room
socket.emit('join_room', { room: 'price_updates' });

// Subscribe to notification types
socket.emit('subscribe_notifications', {
  types: ['order_filled', 'price_alert', 'portfolio_sync']
});

// Heartbeat
socket.emit('heartbeat');
```

#### **Server → Client**
```typescript
// Real-time notification
socket.on('notification', (data) => {
  console.log('Notification:', data);
});

// Chart updates
socket.on('chart_update', (data) => {
  console.log('Price update:', data);
});

// Portfolio updates
socket.on('portfolio_update', (data) => {
  console.log('Portfolio changed:', data);
});
```

### **HTTP API Endpoints**

#### **Send Notification**
```bash
POST /api/v1/notifications/send
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "userId": "user-123",
  "type": "order_filled",
  "title": "Order Filled",
  "body": "Your limit order has been executed",
  "priority": "high",
  "channels": ["websocket", "push", "email"]
}
```

#### **Broadcast Notification**
```bash
POST /api/v1/notifications/broadcast
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "type": "system_maintenance",
  "title": "System Maintenance",
  "body": "Scheduled maintenance in 1 hour",
  "filters": {
    "roles": ["user", "premium"]
  }
}
```

#### **Health Check**
```bash
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": {
    "redis": true,
    "kafka": true,
    "database": true
  },
  "metrics": {
    "activeConnections": 1250,
    "messagesPerSecond": 150
  }
}
```

## 📱 Mobile Integration

### **React Native Client**
```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3007', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});

// Subscribe to notifications
socket.emit('subscribe_notifications', {
  types: ['order_filled', 'price_alert']
});

// Handle notifications
socket.on('notification', (notification) => {
  // Show in-app notification
  showNotification(notification);
});

// Handle push notifications
socket.on('push_notification', (data) => {
  // Register for push notifications
  registerForPushNotifications(data.token);
});
```

### **Push Notification Setup**
```javascript
// Firebase Cloud Messaging setup
import messaging from '@react-native-firebase/messaging';

async function registerDevice() {
  const token = await messaging().getToken();
  
  // Send token to server
  await fetch('/api/v1/notifications/register-device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      deviceToken: token,
      platform: Platform.OS
    })
  });
}
```

## 🔄 Kafka Integration

### **Event Publishing (From Other Services)**
```javascript
// From Core Service
const kafka = new Kafka({
  clientId: 'core-service',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

// Publish swap completion event
await producer.send({
  topic: 'swap-events',
  messages: [{
    value: JSON.stringify({
      type: 'swap_completed',
      userId: 'user-123',
      data: {
        txHash: '0x...',
        fromToken: 'USDC',
        toToken: 'ETH',
        amount: '1000.00'
      }
    })
  }]
});
```

### **Supported Kafka Topics**
```typescript
const KAFKA_TOPICS = {
  SWAP_EVENTS: 'swap-events',           // Trading events
  ORDER_EVENTS: 'order-events',         // Order management
  PRICE_UPDATES: 'price-updates',       // Price feeds
  PORTFOLIO_UPDATES: 'portfolio-updates', // Portfolio changes
  SYSTEM_ALERTS: 'system-alerts',       // System messages
  CHART_UPDATES: 'chart-updates',       // Chart data
  LIQUIDITY_UPDATES: 'liquidity-updates' // Pool updates
};
```

## 🏆 Scaling Strategy

### **Phase 1 → Phase 2 Migration**

#### **1. Assess Load**
```bash
# Monitor connection count
curl http://localhost:3006/metrics | grep websocket_connections

# Check message throughput
curl http://localhost:3006/stats
```

#### **2. Deploy WebSocket Gateway**
```bash
# Deploy WebSocket Gateway
cd ../websocket-gateway
npm install
npm run build
pm2 start dist/server.js --name websocket-gateway

# Deploy Notification Hub
cd ../notification-hub
npm install
npm run build
pm2 start dist/server.js --name notification-hub
```

#### **3. Load Balancer Configuration**
```nginx
# nginx.conf
upstream websocket_backends {
    server 127.0.0.1:3007;
    server 127.0.0.1:3008;
    server 127.0.0.1:3009;
}

server {
    listen 80;
    location /socket.io/ {
        proxy_pass http://websocket_backends;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### **Performance Benchmarks**

| Metric | Single Service | Split Architecture |
|--------|----------------|-------------------|
| **Max Connections** | ~5,000 | ~50,000+ |
| **Latency** | 50-100ms | 20-50ms |
| **Memory Usage** | 1-2GB | 500MB per service |
| **CPU Usage** | 60-80% | 30-50% per service |
| **Throughput** | 1K msg/sec | 10K+ msg/sec |

## 🐳 Docker Deployment

### **Single Service Deployment**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3006 3007
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  notify-service:
    build: .
    ports:
      - "3006:3006"
      - "3007:3007"
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - redis
      - kafka

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    depends_on:
      - zookeeper
```

### **Split Architecture Deployment**
```yaml
# docker-compose.split.yml
version: '3.8'
services:
  websocket-gateway:
    build: ../websocket-gateway
    ports:
      - "3007:3007"
    environment:
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 3

  notification-hub:
    build: ../notification-hub
    ports:
      - "3008:3008"
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - websocket-gateway
```

## 📈 Monitoring & Observability

### **Prometheus Metrics**
```bash
# Connection metrics
websocket_connections_total
websocket_connections_by_room
notification_delivery_duration_seconds

# Message metrics
notifications_sent_total{type="order_filled"}
notifications_failed_total{channel="email"}
kafka_messages_consumed_total

# Performance metrics
redis_operations_duration_seconds
memory_usage_bytes
cpu_usage_percentage
```

### **Grafana Dashboard**
```json
{
  "dashboard": {
    "title": "MoonXFarm Notify Service",
    "panels": [
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "websocket_connections_total"
          }
        ]
      },
      {
        "title": "Notification Throughput",
        "targets": [
          {
            "expr": "rate(notifications_sent_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### **Health Monitoring**
```bash
# Automated health checks
curl -f http://localhost:3006/health || exit 1

# Performance monitoring
curl -s http://localhost:3006/metrics | grep -E "(connections|latency|errors)"

# Log monitoring
tail -f logs/notify-service.log | grep ERROR
```

## 🔧 Troubleshooting

### **Common Issues**

#### **High Memory Usage**
```bash
# Check connection leaks
curl http://localhost:3006/stats

# Monitor Redis usage
redis-cli INFO memory

# Analyze heap dump
node --inspect dist/server.js
```

#### **Slow Message Delivery**
```bash
# Check Kafka lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group notify-service-group

# Monitor Redis performance
redis-cli --latency-history

# Check WebSocket latency
curl http://localhost:3006/metrics | grep delivery_duration
```

#### **Connection Drops**
```bash
# Check nginx logs
tail -f /var/log/nginx/error.log

# Monitor Socket.IO events
curl http://localhost:3006/stats | jq '.events'

# Check network settings
netstat -an | grep :3007
```

## 🔐 Security

### **Authentication**
- JWT token validation cho WebSocket connections
- Rate limiting per IP address
- Connection limits per user

### **Data Protection**
- Encrypted Redis connections (TLS)
- Secure WebSocket connections (WSS)
- Message payload encryption

### **Network Security**
- Firewall rules cho internal services
- VPN access cho production environments
- API key rotation

## 📚 Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Kafka.js Documentation](https://kafka.js.org/)
- [Redis Documentation](https://redis.io/documentation)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/new-notification-type`
3. Commit changes: `git commit -am 'Add new notification type'`
4. Push branch: `git push origin feature/new-notification-type`
5. Submit Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**MoonXFarm Notify Service** - Production-ready real-time notification system với enterprise-grade scalability và reliability. 