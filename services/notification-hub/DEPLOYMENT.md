# 🚀 MoonX Farm Notification Hub - Deployment Guide

## 📋 **Overview**

This guide covers the complete deployment process for the MoonX Farm Notification Hub in production environments. The Notification Hub is designed as a **Message Processing Engine** in the **Split Architecture (Phase 2)** to scale from 5K to 50K+ users.

## 🏗️ **Architecture Components**

### **Core Services**
- **Message Processing Engine**: Kafka Consumer Pool + Business Logic
- **Delivery Coordinator**: Multi-Channel Delivery (WebSocket, Email, Push, Telegram)
- **Analytics & Monitoring**: Prometheus + Health Checks
- **Redis Integration**: Caching + WebSocket Gateway Communication
- **Database Layer**: PostgreSQL with optimized schema

### **External Integrations**
- **WebSocket Gateway**: Real-time notifications via Redis pub/sub
- **SendGrid**: Professional email delivery
- **Firebase FCM**: Push notifications
- **Telegram Bot**: Telegram notifications
- **Kafka**: Event streaming from other services

## 🚀 **Quick Deployment**

### **1. Prerequisites**

```bash
# Required Services
- PostgreSQL 14+ (Database)
- Redis 7+ (Caching & Communication)
- Kafka 3.0+ (Event Streaming)
- Node.js 18+ (Runtime)

# External Services
- SendGrid Account (Email)
- Firebase Project (Push Notifications)
- Telegram Bot Token (Telegram Notifications)
```

### **2. Environment Setup**

```bash
# Clone repository
git clone https://github.com/moonx-farm/notification-hub
cd services/notification-hub

# Install dependencies
npm install

# Copy configuration
cp config/production.env .env
# Edit .env with your actual values

# Setup database
npm run db:migrate
npm run db:seed:production
```

### **3. Database Migration**

```bash
# Create database
createdb moonx_notifications

# Run migrations (using the SQL file we created earlier)
psql -d moonx_notifications -f database/migrations/001_create_notification_schema.sql

# Verify tables created
psql -d moonx_notifications -c "\dt"
```

### **4. Start Services**

```bash
# Production mode
npm run build
npm start

# With PM2 (recommended)
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🐳 **Docker Deployment**

### **Docker Compose**

Create `docker-compose.production.yml`:

```yaml
version: '3.8'
services:
  # Notification Hub
  notification-hub:
    build: .
    ports:
      - "3008:3008"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
      - KAFKA_BROKERS=kafka-1:9092,kafka-2:9092
    depends_on:
      - postgres
      - redis
      - kafka-1
    volumes:
      - ./config/production.env:/app/.env
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '1'

  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: moonx_notifications
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # Kafka Cluster
  kafka-1:
    image: confluentinc/cp-kafka:7.4.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:9092
      KAFKA_NUM_PARTITIONS: 6
      KAFKA_DEFAULT_REPLICATION_FACTOR: 2
    depends_on:
      - zookeeper

  kafka-2:
    image: confluentinc/cp-kafka:7.4.0
    environment:
      KAFKA_BROKER_ID: 2
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:9092
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    volumes:
      - zookeeper_data:/var/lib/zookeeper

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  zookeeper_data:
  grafana_data:
```

### **Deploy with Docker**

```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d

# Scale notification hub
docker-compose -f docker-compose.production.yml up -d --scale notification-hub=5

# Check logs
docker-compose logs -f notification-hub

# Health check
curl http://localhost:3008/health
```

## ☸️ **Kubernetes Deployment**

### **Kubernetes Manifests**

Create `k8s/notification-hub-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-hub
  labels:
    app: notification-hub
spec:
  replicas: 5
  selector:
    matchLabels:
      app: notification-hub
  template:
    metadata:
      labels:
        app: notification-hub
    spec:
      containers:
      - name: notification-hub
        image: moonx-farm/notification-hub:latest
        ports:
        - containerPort: 3008
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          value: "postgres-service"
        - name: REDIS_HOST
          value: "redis-service"
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
        envFrom:
        - secretRef:
            name: notification-hub-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /health
            port: 3008
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3008
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: notification-hub-service
spec:
  selector:
    app: notification-hub
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3008
  type: LoadBalancer
```

### **Deploy to Kubernetes**

```bash
# Create namespace
kubectl create namespace moonx-farm

# Create secrets
kubectl create secret generic notification-hub-secrets \
  --from-env-file=config/production.env \
  -n moonx-farm

# Deploy
kubectl apply -f k8s/ -n moonx-farm

# Check status
kubectl get pods -n moonx-farm
kubectl get services -n moonx-farm

# Scale up
kubectl scale deployment notification-hub --replicas=10 -n moonx-farm
```

## 🔧 **Configuration Management**

### **Environment Variables**

Copy `config/production.env` and update these critical values:

```bash
# Database
DB_HOST=your-postgres-host
DB_PASSWORD=your-secure-password

# Redis
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password

# Kafka
KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092

# SendGrid
SENDGRID_API_KEY=SG.your-actual-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALLOWED_CHATS=chat1,chat2,chat3

# Security
API_SECRET_KEY=your-super-secret-key
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-encryption-key
```

### **Secrets Management**

```bash
# Using AWS Secrets Manager
aws secretsmanager create-secret \
  --name moonx-farm/notification-hub/production \
  --secret-string file://config/production.env

# Using Kubernetes Secrets
kubectl create secret generic notification-hub-secrets \
  --from-env-file=config/production.env

# Using HashiCorp Vault
vault kv put secret/moonx-farm/notification-hub \
  sendgrid_api_key="SG.your-key" \
  telegram_bot_token="your-token"
```

## 📊 **Monitoring & Observability**

### **Health Checks**

```bash
# Service health
curl http://localhost:3008/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "redis": true,
    "database": true,
    "kafka": true,
    "kafkaConsumerPool": true
  }
}
```

### **Prometheus Metrics**

```bash
# Metrics endpoint
curl http://localhost:3008/metrics

# Key metrics to monitor
- notification_hub_messages_processed_total
- notification_hub_delivery_success_rate
- notification_hub_processing_duration_seconds
- notification_hub_queue_depth
- notification_hub_error_rate
```

### **Grafana Dashboard**

Import the provided dashboard: `monitoring/grafana-dashboard.json`

**Key Panels:**
- Message Processing Rate
- Delivery Success Rate by Channel
- Queue Depths by Priority
- Error Rate and Alerts
- Service Health Status

### **Alerting Rules**

Create `monitoring/alerts.yml`:

```yaml
groups:
- name: notification-hub
  rules:
  - alert: HighErrorRate
    expr: rate(notification_hub_errors_total[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: High error rate in notification hub

  - alert: QueueDepthHigh
    expr: notification_hub_queue_depth > 1000
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: Notification queue depth too high

  - alert: ServiceDown
    expr: up{job="notification-hub"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: Notification hub service is down
```

## 🔐 **Security Hardening**

### **Network Security**

```bash
# Firewall rules (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3008/tcp  # Notification Hub
sudo ufw deny 5432/tcp   # PostgreSQL (internal only)
sudo ufw deny 6379/tcp   # Redis (internal only)
sudo ufw enable

# SSL/TLS termination (Nginx)
server {
    listen 443 ssl http2;
    server_name api.moonx.farm;
    
    ssl_certificate /etc/letsencrypt/live/moonx.farm/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/moonx.farm/privkey.pem;
    
    location /notifications/ {
        proxy_pass http://localhost:3008/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### **Application Security**

```bash
# Rate limiting (implemented in app)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# CORS configuration
ALLOWED_ORIGINS=https://app.moonx.farm,https://trade.moonx.farm

# Input validation
- All inputs validated with Joi schemas
- SQL injection prevention with parameterized queries
- XSS protection with content sanitization
```

## 🚀 **Performance Optimization**

### **Database Optimization**

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX CONCURRENTLY idx_notifications_status ON notifications(status);
CREATE INDEX CONCURRENTLY idx_price_alerts_symbol ON price_alerts(symbol, is_active);

-- Connection pooling
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=10000
```

### **Redis Optimization**

```bash
# Redis configuration
redis.conf:
maxmemory 2gb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 0
```

### **Kafka Optimization**

```bash
# Kafka producer config
acks=all
retries=2147483647
max.in.flight.requests.per.connection=5
enable.idempotence=true
compression.type=snappy
batch.size=16384
linger.ms=5
```

### **Node.js Optimization**

```bash
# Runtime optimizations
NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128"
UV_THREADPOOL_SIZE=128

# PM2 configuration
module.exports = {
  apps: [{
    name: 'notification-hub',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
```

## 🔄 **Scaling Strategies**

### **Horizontal Scaling**

```bash
# Docker Swarm
docker service scale moonx-farm_notification-hub=10

# Kubernetes
kubectl scale deployment notification-hub --replicas=10

# AWS Auto Scaling
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name notification-hub-asg \
  --desired-capacity 10
```

### **Vertical Scaling**

```bash
# Increase resources
CPU: 2-4 cores per instance
Memory: 2-4GB per instance
Storage: SSD for database and Redis
```

### **Load Balancing**

```nginx
upstream notification_hub {
    least_conn;
    server 10.0.1.10:3008 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3008 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3008 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name api.moonx.farm;
    
    location /notifications/ {
        proxy_pass http://notification_hub/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
}
```

## 🧪 **Testing in Production**

### **Smoke Tests**

```bash
#!/bin/bash
# test-deployment.sh

BASE_URL="https://api.moonx.farm/notifications"

# Health check
curl -f "$BASE_URL/health" || exit 1

# Metrics check
curl -f "$BASE_URL/metrics" | grep "notification_hub" || exit 1

# Test notification
curl -X POST "$BASE_URL/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "userId": "test-user",
    "type": "test",
    "title": "Deployment Test",
    "body": "Testing notification system",
    "priority": "low",
    "channels": ["websocket"]
  }' || exit 1

echo "✅ All tests passed!"
```

### **Load Testing**

```bash
# Using Artillery.js
npm install -g artillery

# Create load-test.yml
config:
  target: 'https://api.moonx.farm'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Send notifications"
    requests:
      - post:
          url: "/notifications/send"
          headers:
            Authorization: "Bearer {{ $env.API_TOKEN }}"
          json:
            userId: "load-test-user"
            type: "test"
            title: "Load Test"
            body: "Testing system under load"
            priority: "low"
            channels: ["websocket"]

# Run load test
artillery run load-test.yml
```

## 🔧 **Troubleshooting**

### **Common Issues**

1. **High Memory Usage**
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart if needed
   pm2 restart notification-hub
   
   # Increase memory limit
   NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Database Connection Issues**
   ```bash
   # Check connections
   psql -c "SELECT * FROM pg_stat_activity WHERE datname='moonx_notifications';"
   
   # Increase pool size
   DB_POOL_SIZE=30
   ```

3. **Redis Connection Issues**
   ```bash
   # Check Redis
   redis-cli ping
   
   # Check connections
   redis-cli info clients
   
   # Restart Redis
   sudo systemctl restart redis
   ```

4. **Kafka Consumer Lag**
   ```bash
   # Check consumer lag
   kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
     --describe --group notification-hub-group-prod
   
   # Scale consumers
   kubectl scale deployment notification-hub --replicas=8
   ```

### **Debug Commands**

```bash
# Service logs
pm2 logs notification-hub
docker logs notification-hub
kubectl logs -f deployment/notification-hub

# Database queries
psql -d moonx_notifications -c "
  SELECT status, COUNT(*) 
  FROM notifications 
  WHERE created_at > NOW() - INTERVAL '1 hour' 
  GROUP BY status;
"

# Redis keys
redis-cli --scan --pattern "moonx:hub:*" | head -20

# Kafka topics
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

## 📋 **Post-Deployment Checklist**

- [ ] All services healthy
- [ ] Database migrations applied
- [ ] Redis cache working
- [ ] Kafka consumers processing
- [ ] WebSocket Gateway communication
- [ ] Email delivery working (SendGrid)
- [ ] Push notifications working (Firebase)
- [ ] Telegram bot responding
- [ ] Monitoring dashboards active
- [ ] Alerts configured
- [ ] SSL certificates valid
- [ ] Load balancer configured
- [ ] Backup systems active
- [ ] DNS records updated
- [ ] Security hardening applied

## 🚀 **Go Live!**

Your MoonX Farm Notification Hub is now ready to handle **50K+ users** with:

- ⚡ **Ultra-low latency** real-time notifications
- 📊 **Multi-channel delivery** (WebSocket, Email, Push, Telegram)
- 🔄 **Horizontal scaling** capability
- 📈 **Production monitoring** and analytics
- 🛡️ **Enterprise security** features

**Happy notifying! 🎉**

---

For support, visit our [GitHub Issues](https://github.com/moonx-farm/notification-hub/issues) or contact the DevOps team. 