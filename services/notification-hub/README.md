# 🚀 Notification Hub Service

## 📋 **Tổng quan**

**Notification Hub** là thành phần trung tâm trong **Split Architecture (Phase 2)** của hệ thống thông báo MoonXFarm. Nó đóng vai trò như một **Message Processing Engine** chuyên xử lý business logic và phân phối thông báo đến các kênh khác nhau.

## 🎯 **Vai trò & Mục đích**

### **🔄 Tại sao cần Split Architecture?**

| **Phase 1 (Single Service)** | **Phase 2 (Split Architecture)** |
|---|---|
| ✅ Đơn giản, dễ deploy | ✅ Scalable, dễ maintain |
| ✅ Phù hợp 5K users | ✅ Phù hợp 50K+ users |
| ❌ Bottleneck khi scale | ✅ Tách biệt responsibilities |
| ❌ Connection + Logic cùng process | ✅ Dedicated connection handling |

### **🏗️ Kiến trúc Split**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  WebSocket      │    │  Notification   │    │  External       │
│  Gateway        │◄──►│  Hub           │◄──►│  Services       │
│  (Connections)  │    │  (Processing)   │    │  (Email/Push)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                        ▲                        ▲
        │                        │                        │
    50K+ Users           Redis Pub/Sub            SMTP/FCM APIs
```

## 🔧 **Core Components**

### **1. 📨 Message Processing Engine**
- **Kafka Consumer Pool**: Nhận events từ các services khác
- **Business Logic**: Áp dụng rules, user preferences, rate limiting
- **Notification Processor**: Tạo và validate notifications

### **2. 🎯 Delivery Coordinator**
- **Multi-Channel Delivery**: WebSocket, Push, Email, SMS
- **Smart Routing**: Chọn kênh phù hợp based on user preferences
- **Retry Logic**: Xử lý failed deliveries với exponential backoff

### **3. 🔄 Background Workers**
- **Priority Worker**: Xử lý high-priority notifications immediately
- **Batch Worker**: Xử lý bulk operations (email campaigns)
- **Retry Worker**: Xử lý failed deliveries
- **Scheduler**: Xử lý scheduled notifications

### **4. 📊 Analytics & Monitoring**
- **Prometheus Metrics**: Performance monitoring
- **Delivery Tracking**: Success/failure rates
- **User Behavior**: Connection patterns, engagement

## 🚀 **Workflow**

### **📋 Notification Flow**
```
1. 📥 Kafka Event → Notification Hub
2. 🔍 Process Business Logic (preferences, rate limiting)
3. 🎯 Create Notification Object
4. 🔄 Route to Delivery Channels:
   ├── WebSocket → Gateway Service
   ├── Push → FCM Service
   ├── Email → SMTP Service
   └── SMS → SMS Service
5. 📊 Track Delivery Results
6. 🔄 Handle Retries if needed
```

### **⚡ Real-time Events**
```
📈 Price Updates → Chart Subscribers
💰 Swap Completed → User + Push Notification
📊 Portfolio Changes → User Dashboard
🚨 System Alerts → Broadcast to All Users
```

## 🎛️ **Configuration**

### **Environment Variables**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=moonx_notifications
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
EMAIL_FROM=MoonXFarm <noreply@moonx.farm>

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Server
PORT=3008
HOST=0.0.0.0
LOG_LEVEL=info
```

## 🏃 **Running the Service**

### **Development**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### **Docker**
```bash
# Build image
docker build -t moonx-notification-hub .

# Run container
docker run -p 3008:3008 moonx-notification-hub

# Using docker-compose
docker-compose up notification-hub
```

## 📊 **API Endpoints**

### **Health Check**
```bash
GET /health
```

### **Metrics**
```bash
GET /metrics          # Prometheus metrics
GET /analytics        # Delivery analytics
```

### **Manual Notification** (Admin)
```bash
POST /notifications/send
{
  "userId": "user123",
  "type": "test",
  "title": "Test Notification",
  "body": "This is a test",
  "priority": "high",
  "channels": ["websocket", "push"]
}
```

## 📈 **Performance Benchmarks**

### **Capacity**
| Metric | Single Service | Split Architecture |
|---|---|---|
| **Concurrent Users** | ~5,000 | ~50,000+ |
| **Messages/Second** | ~1,000 | ~10,000+ |
| **Latency** | 50-100ms | 20-50ms |
| **Memory Usage** | ~512MB | ~256MB per service |

### **Scaling Strategy**
- **Horizontal Scaling**: Multiple Hub instances
- **Vertical Scaling**: More CPU/RAM per instance
- **Database Sharding**: Partition by user regions
- **Cache Optimization**: Redis cluster for high availability

## 🔒 **Security Features**

### **Authentication**
- JWT token validation
- User permission checks
- Rate limiting per user/IP

### **Data Protection**
- Encrypted sensitive data
- PII masking in logs
- Secure communication (TLS/SSL)

## 📋 **Monitoring & Alerting**

### **Key Metrics**
- **Delivery Success Rate**: >95%
- **Processing Latency**: <100ms
- **Queue Depth**: <1000 messages
- **Error Rate**: <1%

### **Alerts**
- High queue depth
- Failed delivery rate >5%
- Database connection issues
- Redis connection issues

## 🔧 **Troubleshooting**

### **Common Issues**

1. **High Memory Usage**
   - Check queue depths
   - Optimize batch sizes
   - Review retention policies

2. **Slow Delivery**
   - Check database performance
   - Review Redis performance
   - Verify network connectivity

3. **Failed Deliveries**
   - Check external service status
   - Review rate limiting
   - Verify credentials

### **Debug Commands**
```bash
# Check queue status
redis-cli LLEN delivery_queue:high

# Check notification status
redis-cli HGETALL notification:123:status

# Check user connections
redis-cli SMEMBERS user:123:connections
```

## 🚀 **Future Enhancements**

### **Planned Features**
- [ ] **Machine Learning**: Smart delivery timing
- [ ] **A/B Testing**: Notification content optimization
- [ ] **Geographic Routing**: Location-based delivery
- [ ] **Voice Notifications**: Integration with voice assistants
- [ ] **Rich Media**: Images, videos in notifications

### **Performance Improvements**
- [ ] **Event Sourcing**: Better audit trail
- [ ] **CQRS Pattern**: Separate read/write models
- [ ] **gRPC Communication**: Faster inter-service calls
- [ ] **Connection Pooling**: Optimized database connections

---

## 🎉 **Kết luận**

**Notification Hub** là trái tim của hệ thống thông báo MoonXFarm, đảm bảo:
- ⚡ **Performance**: Xử lý hàng nghìn notifications/giây
- 🔄 **Reliability**: Retry logic và error handling
- 📊 **Scalability**: Horizontal scaling ready
- 🔒 **Security**: Enterprise-grade security features

Với kiến trúc Split, chúng ta có thể scale từ 5K users lên 50K+ users một cách dễ dàng! 