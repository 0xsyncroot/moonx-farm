# 🚀 Environment Setup Guide - Notification Hub

## 📋 Tổng quan

File này hướng dẫn cách setup environment variables cho **MoonX Farm Notification Hub**. Bạn sẽ cần cấu hình tất cả các services và dependencies để chạy notification hub trong production.

## 🔧 Quy trình Setup

### 1. Copy Environment File
```bash
cp env.example .env
```

### 2. Cấu hình Database (PostgreSQL)
```bash
# Required - Database connection
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=moonx_notifications
DB_USER=postgres
DB_PASSWORD=your-secure-password

# Optional - Connection tuning
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=10000
```

### 3. Cấu hình Redis
```bash
# Required - Redis connection
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Or use Redis URL
REDIS_URL=redis://user:password@host:port/db
```

### 4. Cấu hình Kafka
```bash
# Required - Kafka brokers
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092

# Required - Client identification
KAFKA_CLIENT_ID=notification-hub-prod
KAFKA_GROUP_ID=notification-hub-group-prod

# Required - Topics
KAFKA_TOPICS=price.alerts,volume.alerts,whale.alerts,wallet.activity,system.alerts,user.events
```

### 5. Cấu hình Email (SendGrid)
```bash
# Required - SendGrid API
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@moonx.farm
SENDGRID_FROM_NAME=MoonX Farm

# Optional - SMTP fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user@gmail.com
SMTP_PASSWORD=your-smtp-password
```

### 6. Cấu hình Push Notifications (Firebase)
```bash
# Required - Firebase service account
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@your-project.iam.gserviceaccount.com
```

### 7. Cấu hình Telegram Bot
```bash
# Required - Telegram Bot API
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk

# Optional - Webhook và access control
TELEGRAM_WEBHOOK_URL=https://api.moonx.farm/telegram/webhook
TELEGRAM_ALLOWED_CHATS=chat1,chat2,chat3
```

### 8. Cấu hình Security
```bash
# Required - Security keys (minimum 32 characters)
API_SECRET_KEY=your-super-secret-api-key-here-32-chars-minimum
JWT_SECRET=your-jwt-secret-key-here-32-chars-minimum
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Required - CORS
ALLOWED_ORIGINS=https://app.moonx.farm,https://trade.moonx.farm
```

## 🔍 Validation Checklist

### Database Connection
```bash
# Test PostgreSQL connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### Redis Connection
```bash
# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

### Kafka Connection
```bash
# Test Kafka connection
kafka-console-consumer --bootstrap-server $KAFKA_BROKERS --topic test --from-beginning --max-messages 1
```

### SendGrid API
```bash
# Test SendGrid API
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"test@example.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
```

## 🚀 Performance Tuning

### Database Pools
```bash
# Adjust based on your load
DB_MAX_CONNECTIONS=20      # Small: 10, Medium: 20, Large: 50
DB_MIN_CONNECTIONS=5       # Small: 2, Medium: 5, Large: 10
```

### Worker Configuration
```bash
# Adjust based on CPU cores
WORKER_PROCESSES=4         # Number of CPU cores
WORKER_THREADS=8          # 2x CPU cores
WORKER_CONCURRENCY=10     # Max concurrent jobs per worker
```

### Memory Settings
```bash
# Adjust based on available RAM
MAX_MEMORY_USAGE=2048     # MB (2GB)
CACHE_MAX_SIZE=1000       # Number of cache entries
```

## 🔒 Security Best Practices

### 1. Environment Variables
- ✅ Use strong, unique passwords (minimum 16 characters)
- ✅ Generate random API keys and secrets
- ✅ Use different credentials for each environment
- ❌ Never commit secrets to version control

### 2. Database Security
- ✅ Enable SSL/TLS connections (`DB_SSL=true`)
- ✅ Use dedicated database user with limited permissions
- ✅ Enable connection pooling and timeouts
- ❌ Don't use root/admin accounts

### 3. Redis Security
- ✅ Set Redis password
- ✅ Use key prefixes to avoid conflicts
- ✅ Enable connection timeouts
- ❌ Don't expose Redis to public internet

### 4. API Security
- ✅ Use HTTPS for all external connections
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ❌ Don't expose internal endpoints

## 📊 Monitoring Setup

### Required Environment Variables
```bash
# Enable monitoring
ENABLE_METRICS=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_ERROR_TRACKING=true

# Prometheus metrics
PROMETHEUS_PORT=9090
PROMETHEUS_ENDPOINT=/metrics

# Error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Health Checks
```bash
# Configure health check intervals
HEALTH_CHECK_INTERVAL=30000      # 30 seconds
HEALTH_CHECK_TIMEOUT=5000        # 5 seconds
```

## 🧪 Testing Configuration

### Development Environment
```bash
# Copy for development
cp env.example .env.development

# Set development-specific values
NODE_ENV=development
LOG_LEVEL=debug
TEST_MODE=true
MOCK_EXTERNAL_SERVICES=true
```

### Staging Environment
```bash
# Copy for staging
cp env.example .env.staging

# Set staging-specific values
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_TEST_NOTIFICATIONS=true
```

## 🔄 Service Dependencies

### Start Order
1. **PostgreSQL** - Database must be running first
2. **Redis** - Cache and queue storage
3. **Kafka** - Event streaming platform
4. **WebSocket Gateway** - Real-time communication
5. **Notification Hub** - Main application

### Docker Compose Example
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: moonx_notifications
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass your_password
    
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      
  notification-hub:
    build: .
    env_file: .env
    depends_on:
      - postgres
      - redis
      - kafka
```

## 🚨 Common Issues & Solutions

### Database Connection Issues
```bash
# Check if database is running
systemctl status postgresql

# Check network connectivity
telnet $DB_HOST $DB_PORT

# Check credentials
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
```

### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Check authentication
redis-cli -a $REDIS_PASSWORD ping

# Check memory usage
redis-cli info memory
```

### Kafka Connection Issues
```bash
# Check Kafka brokers
kafka-broker-api-versions --bootstrap-server $KAFKA_BROKERS

# List topics
kafka-topics --bootstrap-server $KAFKA_BROKERS --list

# Check consumer group
kafka-consumer-groups --bootstrap-server $KAFKA_BROKERS --group $KAFKA_GROUP_ID --describe
```

## 📞 Support

Nếu bạn gặp vấn đề trong quá trình setup:

1. **Kiểm tra logs**: Xem logs của notification hub và các dependencies
2. **Validate configuration**: Đảm bảo tất cả required env vars đã được set
3. **Test connections**: Sử dụng các commands validation ở trên
4. **Check resources**: Đảm bảo đủ RAM, CPU, disk space
5. **Review security**: Kiểm tra firewall, network policies

## 🎯 Production Deployment

### Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Database schema migrated
- [ ] Redis cache cleared
- [ ] Kafka topics created
- [ ] SSL certificates installed
- [ ] Monitoring setup
- [ ] Backup procedures tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

### Post-deployment Verification
- [ ] Health checks passing
- [ ] All services communicating
- [ ] Metrics being collected
- [ ] Logs being generated
- [ ] Notifications working
- [ ] Performance within limits
- [ ] Error rates acceptable

---

**🚀 Ready for Production!** 

Sau khi hoàn thành tất cả các bước trên, notification hub sẽ sẵn sàng để chạy trong production với full performance và reliability. 