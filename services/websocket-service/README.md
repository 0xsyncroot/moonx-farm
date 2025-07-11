# MoonX Farm WebSocket Service

A high-performance WebSocket service built for MoonX Farm Cross-chain DEX, providing real-time data streaming for prices, orders, portfolio updates, and trade notifications.

## 🚀 Features

- **Real-time Data Streaming**: Live price updates, order status, portfolio changes, and trade notifications
- **JWT Authentication**: Secure authentication via Auth Service integration
- **Redis-backed Rate Limiting**: Configurable rate limits per IP and user
- **Kafka Integration**: Consumes real-time data from Kafka topics
- **Connection Management**: Redis-backed connection state with clustering support
- **Health Monitoring**: Comprehensive health checks for all dependencies
- **Auto-scaling**: Horizontal scaling with Redis clustering
- **Graceful Shutdown**: Proper cleanup and connection management
- **TypeScript**: Full type safety and modern development experience

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Auth Service  │    │   Kafka Broker  │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ WebSocket            │ JWT                  │ Messages
          │                      │ Verification         │
          │                      │                      │
┌─────────▼──────────────────────▼──────────────────────▼───────┐
│                WebSocket Service                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ Connection  │  │ Rate Limit  │  │ Message Handlers    │   │
│  │ Manager     │  │ Middleware  │  │                     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                    ┌─────────▼───────┐
                    │   Redis Cache   │
                    │                 │
                    └─────────────────┘
```

## 📦 Installation

### Prerequisites

- Node.js 18+
- Redis 7+
- Kafka 2.8+
- Auth Service running
- MoonX Farm packages

### Development Setup

1. **Install dependencies**:
```bash
cd services/websocket-service
pnpm install
```

2. **Configure environment**:
```bash
cp ../../env.example .env
# Edit .env with your configuration
```

3. **Start development server**:
```bash
pnpm run dev
```

### Production Setup

1. **Build the service**:
```bash
pnpm run build
```

2. **Start production server**:
```bash
pnpm start
```

## ⚙️ Configuration

### Environment Variables

All configuration is done through environment variables. See `env.example` for the complete list.

#### Core Configuration
```env
# Server Configuration
WEBSOCKET_SERVICE_PORT=3008
WEBSOCKET_SERVICE_HOST=0.0.0.0

# Authentication
AUTH_SERVICE_URL=http://localhost:3001
AUTH_SERVICE_VERIFY_ENDPOINT=/api/v1/auth/verify

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=moonx:ws:

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CONSUMER_GROUP_ID=websocket-consumers
```

#### Rate Limiting
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_CONNECTIONS_PER_IP=100
RATE_LIMIT_MAX_MESSAGES_PER_MINUTE=120
```

#### WebSocket Settings
```env
WS_PING_INTERVAL=30000
WS_PONG_TIMEOUT=5000
WS_MAX_CONNECTIONS=10000
WS_HEARTBEAT_INTERVAL=60000
```

## 🔌 Usage

### WebSocket Connection

Connect to the WebSocket service:

```javascript
// Kết nối trực tiếp - không cần token trong URL
const ws = new WebSocket('ws://localhost:3008/ws');

ws.onopen = function(event) {
  console.log('Connected to WebSocket, waiting for auth request...');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  // Xử lý yêu cầu authentication từ server
  if (message.type === 'auth_required') {
    const authMessage = {
      id: 'auth_' + Date.now(),
      type: 'authenticate',
      timestamp: Date.now(),
      data: {
        token: 'your-jwt-token'
      }
    };
    ws.send(JSON.stringify(authMessage));
  }
  
  console.log('Message received:', message);
};

ws.onclose = function(event) {
  console.log('Connection closed:', event.code, event.reason);
};
```

### Authentication

**Post-Connection Authentication:**
1. Client kết nối WebSocket (không cần token)
2. Server tự động gửi `auth_required` message
3. Client gửi `authenticate` message với JWT token
4. Server verify token và gửi response
5. Authentication timeout: 10 seconds

### Message Format

All messages follow this structure:

```typescript
interface WebSocketMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  data: any;
}
```

## 📡 WebSocket Messages

### Client → Server Messages

#### Authentication
```json
{
  "id": "auth_123",
  "type": "authenticate",
  "timestamp": 1701234567890,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Subscribe to Data Stream
```json
{
  "id": "msg_123",
  "type": "subscribe",
  "timestamp": 1701234567890,
  "data": {
    "channel": "prices"
  }
}
```

#### Unsubscribe from Data Stream
```json
{
  "id": "msg_124",
  "type": "unsubscribe",
  "timestamp": 1701234567890,
  "data": {
    "channel": "prices"
  }
}
```

#### Ping (Heartbeat)
```json
{
  "id": "msg_125",
  "type": "ping",
  "timestamp": 1701234567890,
  "data": {}
}
```

### Server → Client Messages

#### Authentication Required
```json
{
  "id": "auth_req_123",
  "type": "auth_required",
  "timestamp": 1701234567890,
  "data": {
    "timeout": 10000
  }
}
```

#### Authentication Success
```json
{
  "id": "auth_success_123",
  "type": "auth_success",
  "timestamp": 1701234567890,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com"
    }
  }
}
```

#### Authentication Failed
```json
{
  "id": "auth_failed_123",
  "type": "auth_failed",
  "timestamp": 1701234567890,
  "data": {
    "error": "Invalid token"
  }
}
```

#### Subscription Confirmed
```json
{
  "id": "sub_confirmed_123",
  "type": "subscribed",
  "timestamp": 1701234567890,
  "data": {
    "channel": "prices"
  }
}
```

#### Price Updates
```json
{
  "id": "price_update_123",
  "type": "price_update",
  "timestamp": 1701234567890,
  "data": {
    "token": "ETH",
    "chainId": 8453,
    "price": "2150.45",
    "priceUsd": "2150.45",
    "change24h": "5.2",
    "volume24h": "1250000",
    "timestamp": 1701234567890
  }
}
```

#### Order Updates
```json
{
  "id": "order_update_123",
  "type": "order_update",
  "timestamp": 1701234567890,
  "data": {
    "orderId": "order_123",
    "userId": "user_123",
    "status": "filled",
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amountIn": "1.0",
    "amountOut": "2150.45",
    "chainId": 8453
  }
}
```

#### Portfolio Updates
```json
{
  "id": "portfolio_update_123",
  "type": "portfolio_update",
  "timestamp": 1701234567890,
  "data": {
    "userId": "user_123",
    "totalValue": 10500.25,
    "tokens": [
      {
        "token": "ETH",
        "balance": "2.5",
        "valueUsd": 5375.25
      }
    ],
    "chainId": 8453
  }
}
```

#### Trade Updates
```json
{
  "id": "trade_update_123",
  "type": "trade_update",
  "timestamp": 1701234567890,
  "data": {
    "tradeId": "trade_123",
    "userId": "user_123",
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amountIn": "1.0",
    "amountOut": "2150.45",
    "txHash": "0x123...",
    "chainId": 8453
  }
}
```

## 🔌 HTTP Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": 1701234567890,
  "services": {
    "redis": true,
    "kafka": true,
    "auth": true
  },
  "metrics": {
    "totalConnections": 150,
    "activeConnections": 148,
    "messagesSent": 25000,
    "messagesReceived": 12500
  }
}
```

### Metrics
```bash
GET /metrics
```

### Connection Status
```bash
GET /connections
```

### API Documentation
```bash
GET /docs
```

## 🐳 Docker Setup

### Build Image
```bash
docker build -t moonx-websocket-service .
```

### Run Container
```bash
docker run -p 3008:3008 \
  -e REDIS_URL=redis://redis:6379 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e AUTH_SERVICE_URL=http://auth-service:3001 \
  moonx-websocket-service
```

### Docker Compose
```yaml
version: '3.8'
services:
  websocket-service:
    build: .
    ports:
      - "3008:3008"
    depends_on:
      - redis
      - kafka
      - auth-service
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      - AUTH_SERVICE_URL=http://auth-service:3001
```

## 🔧 Development

### Scripts
```bash
# Development with hot reload
pnpm run dev

# Build TypeScript
pnpm run build

# Start production server
pnpm start

# Run tests
pnpm test

# Run linter
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

### Testing WebSocket Connection

Using `wscat`:
```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket (không cần token)
wscat -c "ws://localhost:3008/ws"

# Server sẽ gửi auth_required message
# Gửi authentication message
{"id":"auth_1","type":"authenticate","timestamp":1701234567890,"data":{"token":"your-jwt-token"}}

# Sau khi authenticated, subscribe to channel
{"id":"sub_1","type":"subscribe","timestamp":1701234567890,"data":{"channel":"prices"}}

# Send ping/heartbeat
{"id":"ping_1","type":"ping","timestamp":1701234567890,"data":{}}
```

### Project Structure
```
src/
├── config/           # Configuration management
├── handlers/         # Message handlers
├── middleware/       # Authentication & rate limiting
├── services/         # Core services (connection manager, kafka)
├── types/           # TypeScript type definitions
└── server.ts        # Main server file
```

## 🚨 Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if service is running
curl http://localhost:3008/health

# Check Docker logs
docker logs moonx-websocket

# Check Redis connection
redis-cli ping

# Check Kafka connection
kafka-console-consumer --bootstrap-server localhost:9092 --topic price.updates
```

#### Authentication Failures
```bash
# Verify Auth Service is running
curl http://localhost:3001/health

# Test JWT token
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3001/api/v1/auth/verify
```

#### Rate Limiting Issues
```bash
# Check rate limit status
curl http://localhost:3008/metrics

# Clear rate limits in Redis
redis-cli DEL "moonx:ws:ratelimit:*"
```

### Performance Tuning

#### Redis Optimization
```env
# Increase Redis max memory
REDIS_MAXMEMORY=2gb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Enable AOF persistence
REDIS_APPENDONLY=yes
```

#### Kafka Optimization
```env
# Increase consumer fetch size
KAFKA_CONSUMER_FETCH_MAX_BYTES=1048576
KAFKA_CONSUMER_MAX_PARTITION_FETCH_BYTES=1048576

# Batch processing
KAFKA_CONSUMER_BATCH_SIZE=100
```

## 📈 Monitoring

### Health Checks
The service provides comprehensive health checks:
- Redis connectivity
- Kafka consumer status
- Auth service availability
- WebSocket connection health

### Metrics
Monitor these key metrics:
- Active connections
- Message throughput
- Authentication success/failure rates
- Rate limit violations
- Connection latency

### Logging
Structured logging with correlation IDs:
```javascript
// Log levels: error, warn, info, debug
logger.info('WebSocket client connected', {
  clientId: 'client_123',
  userId: 'user_456',
  ip: '192.168.1.100'
});
```

## 🔒 Security

### Authentication
- JWT token validation via Auth Service
- Token extraction from multiple sources
- Automatic token refresh handling

### Rate Limiting
- IP-based connection limits
- User-based message limits
- Redis-backed distributed rate limiting

### Connection Security
- Origin validation
- IP whitelisting support
- Secure WebSocket (WSS) support

## 🚀 Production Deployment

### Scaling
- Horizontal scaling with Redis clustering
- Load balancing WebSocket connections
- Kafka consumer group partitioning

### Monitoring
- Health check endpoints for load balancers
- Metrics export for Prometheus
- Structured logging for centralized collection

### Performance
- Connection pooling
- Message batching
- Efficient serialization

## 📚 API Reference

For complete API documentation, start the service and visit:
```
http://localhost:3008/docs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Open an issue on GitHub
4. Contact the development team

---

**MoonX Farm WebSocket Service** - Real-time data streaming for cross-chain DEX operations. 