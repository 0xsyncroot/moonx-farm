# MoonXFarm WebSocket Service - Docker Compose Setup

## 🚀 Quick Start

### 1. Environment Variables

Tạo file `.env` trong thư mục `services/websocket-service/` với nội dung:

```bash
# =============================================================================
# Production Environment Variables
# =============================================================================

# Redis Configuration
REDIS_PASSWORD=your-secure-redis-password-at-least-32-chars

# Authentication Service
AUTH_SERVICE_URL=http://your-auth-service:3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Swagger Documentation (false for production)
SWAGGER_ENABLED=false

# Logging
LOG_LEVEL=info
```

### 2. Start Services

```bash
# Chạy tất cả services
docker-compose up -d

# Chỉ chạy websocket service (nếu đã có Redis & Kafka)
docker-compose up -d websocket-service

# Xem logs
docker-compose logs -f websocket-service
```

### 3. Health Check

```bash
# Check WebSocket service health
curl http://localhost:3008/health

# Check Redis
docker-compose exec redis redis-cli ping

# Check Kafka
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │      Redis      │    │     Kafka       │
│   Service       │◄──►│    Cache        │    │   Message       │
│   (Port 3008)   │    │  (Port 6379)    │    │   Broker        │
└─────────────────┘    └─────────────────┘    │ (Port 9092)     │
                                               └─────────────────┘
                                                       ▲
                                               ┌─────────────────┐
                                               │   Zookeeper     │
                                               │  (Port 2181)    │
                                               └─────────────────┘
```

## 🔧 Services Configuration

### WebSocket Service
- **Port**: 3008
- **Health Check**: `/health`
- **WebSocket Endpoint**: `/ws`
- **Swagger Docs**: `/docs` (nếu enabled)

### Redis
- **Port**: 6379
- **Password**: Configured via `REDIS_PASSWORD`
- **Persistence**: Yes (AOF enabled)

### Kafka
- **Port**: 9092 (internal), 29092 (external)
- **Topics**: Auto-created
  - `moonx.ws.events` (6 partitions)
  - `moonx.ws.events.dlq` (2 partitions)

### Zookeeper
- **Port**: 2181
- **Required**: For Kafka coordination

## 🌐 Network Configuration

Services communicate via dedicated network `moonx-websocket-network`.

## 💾 Data Persistence

Persistent volumes:
- `moonx-websocket-redis-data` - Redis data
- `moonx-websocket-kafka-data` - Kafka logs
- `moonx-websocket-zookeeper-data` - Zookeeper data

## 🔐 Security Configuration

### Production Security Checklist

- [ ] Change default Redis password
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Disable Swagger in production
- [ ] Use secure logging level
- [ ] Configure firewall rules
- [ ] Enable container security scanning
- [ ] Regular security updates

### Environment Variables Security

```bash
# Strong password (minimum 32 characters)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Production CORS (specific domains)
CORS_ORIGIN=https://your-production-domain.com

# Production auth service
AUTH_SERVICE_URL=https://your-auth-service.com
```

## 📊 Monitoring

### Health Checks

```bash
# WebSocket service
curl http://localhost:3008/health

# Redis
docker-compose exec redis redis-cli ping

# Kafka topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f websocket-service
docker-compose logs -f redis
docker-compose logs -f kafka
```

### Metrics

```bash
# Container stats
docker-compose stats

# Redis info
docker-compose exec redis redis-cli info

# Kafka consumer groups
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

## 🚨 Troubleshooting

### Common Issues

1. **WebSocket service fails to start**
   ```bash
   # Check dependencies
   docker-compose logs redis kafka
   
   # Check network connectivity
   docker-compose exec websocket-service ping redis
   docker-compose exec websocket-service ping kafka
   ```

2. **Redis connection issues**
   ```bash
   # Check Redis logs
   docker-compose logs redis
   
   # Test connection
   docker-compose exec redis redis-cli ping
   ```

3. **Kafka connection issues**
   ```bash
   # Check Kafka logs
   docker-compose logs kafka zookeeper
   
   # Test Kafka connectivity
   docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
   ```

4. **Port conflicts**
   ```bash
   # Check port usage
   netstat -tlnp | grep -E "3008|6379|9092|2181"
   
   # Modify ports in docker-compose.yml if needed
   ```

### Recovery Procedures

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart websocket-service

# Recreate services (careful with data)
docker-compose down && docker-compose up -d

# Reset all data (DANGER: data loss)
docker-compose down -v && docker-compose up -d
```

## 🎯 Testing

### WebSocket Connection Test

```javascript
// Test WebSocket connection
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3008/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data));
});
```

### Load Testing

```bash
# Install dependencies
npm install -g artillery

# Run load test
artillery run websocket-load-test.yml
```

## 🔄 Updates

### Service Updates

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Check service versions
docker-compose exec websocket-service node -v
```

### Configuration Updates

```bash
# Update .env file
vim .env

# Recreate services with new config
docker-compose up -d --force-recreate
```

## 🛑 Shutdown

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (data loss!)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## 📚 Additional Resources

- [WebSocket Service API Documentation](./API.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Redis Documentation](https://redis.io/documentation) 