# MoonX Farm WebSocket Service - Integration Guide

## Tổng quan

WebSocket Service cung cấp kết nối real-time cho MoonX Farm DEX, hỗ trợ các cập nhật giá cả, orders, portfolio và trades theo thời gian thực.

### Thông tin Service
- **Port**: 3008 (mặc định)
- **Host**: 0.0.0.0
- **Protocol**: WebSocket over HTTP/HTTPS
- **Authentication**: JWT-based qua Auth Service
- **Rate Limiting**: Có hỗ trợ
- **Clustering**: Hỗ trợ Redis-based clustering

## Cấu hình môi trường

### Environment Variables cần thiết:

```env
# Server Configuration
PORT=3008
HOST=0.0.0.0
NODE_ENV=production

# Auth Service Integration
AUTH_SERVICE_URL=http://localhost:3001
AUTH_SERVICE_VERIFY_ENDPOINT=/api/v1/auth/verify
AUTH_SERVICE_TIMEOUT=5000

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_CONNECTIONS_PER_IP=100
RATE_LIMIT_WINDOW_SIZE=60000
RATE_LIMIT_MAX_MESSAGES_PER_MINUTE=120

# WebSocket Configuration
WS_PING_INTERVAL=30000
WS_PONG_TIMEOUT=5000
WS_MAX_CONNECTIONS=10000
WS_HEARTBEAT_INTERVAL=60000

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=websocket-service
KAFKA_CONSUMER_GROUP_ID=websocket-consumers
KAFKA_TOPIC_PRICES=price.updates
KAFKA_TOPIC_ORDERS=order.updates
KAFKA_TOPIC_PORTFOLIO=portfolio.updates
KAFKA_TOPIC_TRADES=trade.updates

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=moonx:ws:

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Documentation
SWAGGER_ENABLED=true
SWAGGER_PATH=/docs
```

## Hướng dẫn tích hợp Client

### 1. Kết nối WebSocket

```javascript
// Kết nối không cần token trong URL - sử dụng post-connection authentication
const ws = new WebSocket('ws://localhost:3008/ws');

ws.onopen = function(event) {
  console.log('WebSocket connected, waiting for auth request...');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.type === 'auth_required') {
    // Server yêu cầu authentication
    const authMessage = {
      id: generateUUID(),
      type: 'authenticate',
      timestamp: Date.now(),
      data: {
        token: 'your-jwt-token'
      }
    };
    ws.send(JSON.stringify(authMessage));
  }
};
```

### 2. Authentication Flow

**Modern Post-Connection Authentication:**
1. Client kết nối WebSocket (không có token trong URL)
2. Server gửi `auth_required` message
3. Client gửi `authenticate` message với JWT token
4. Server verify token qua Auth Service endpoint: `/api/v1/auth/verify`
5. Server gửi `auth_success` hoặc `auth_failed` message
6. Timeout 10 giây cho authentication process

### 3. Message Structure

Tất cả messages phải tuân theo cấu trúc:

```typescript
interface WebSocketMessage {
  id: string;        // Unique message ID
  type: string;      // Message type
  timestamp: number; // Unix timestamp
  data: any;        // Message payload
}
```

### 4. Subscription Management

#### Subscribe to channel:
```javascript
const subscribeMessage = {
  id: generateUUID(),
  type: 'subscribe',
  timestamp: Date.now(),
  data: {
    channel: 'prices',  // hoặc 'orders', 'portfolio', 'trades', 'user_specific'
    params: {
      // Optional parameters
    }
  }
};
ws.send(JSON.stringify(subscribeMessage));
```

#### Unsubscribe from channel:
```javascript
const unsubscribeMessage = {
  id: generateUUID(),
  type: 'unsubscribe',
  timestamp: Date.now(),
  data: {
    channel: 'prices'
  }
};
ws.send(JSON.stringify(unsubscribeMessage));
```

### 5. Heartbeat

Client nên gửi heartbeat messages định kỳ:

```javascript
const heartbeatMessage = {
  id: generateUUID(),
  type: 'heartbeat',
  timestamp: Date.now(),
  data: {}
};

setInterval(() => {
  ws.send(JSON.stringify(heartbeatMessage));
}, 30000); // Mỗi 30 giây
```

### 6. Xử lý Messages từ Server

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'auth_required':
      // Server yêu cầu authentication
      sendAuthenticationMessage();
      break;
    case 'auth_success':
      console.log('✅ Authentication successful');
      // Bắt đầu subscribe các channels cần thiết
      handleAuthSuccess(message.data);
      break;
    case 'auth_failed':
      console.error('❌ Authentication failed:', message.data?.error);
      handleAuthFailure(message.data);
      break;
    case 'subscribed':
      console.log('✅ Subscription confirmed:', message.data.channel);
      break;
    case 'unsubscribed':
      console.log('❌ Unsubscription confirmed:', message.data.channel);
      break;
    case 'price_update':
      handlePriceUpdate(message.data);
      break;
    case 'order_update':
      handleOrderUpdate(message.data);
      break;
    case 'portfolio_update':
      handlePortfolioUpdate(message.data);
      break;
    case 'trade_update':
      handleTradeUpdate(message.data);
      break;
    case 'pong':
      // Heartbeat response từ server
      updateLastHeartbeat();
      break;
    case 'error':
      handleError(message.data);
      break;
    default:
      console.log('📩 Unknown message type:', message.type);
  }
};
```

## Hướng dẫn tích hợp Server

### 1. HTTP Endpoints

#### Health Check
```
GET /health
Response: {
  status: 'healthy' | 'unhealthy',
  timestamp: number,
  services: {
    redis: boolean,
    kafka: boolean,
    auth: boolean
  },
  metrics: WebSocketMetrics
}
```

#### Metrics
```
GET /metrics
Response: {
  websocket: WebSocketMetrics,
  kafka: KafkaMetrics,
  rateLimit: RateLimitStatus,
  uptime: number
}
```

#### Connection Status
```
GET /connections
Response: {
  totalConnections: number,
  kafkaConsumerRunning: boolean,
  timestamp: string
}
```

#### Service Info
```
GET /
Response: {
  service: string,
  version: string,
  status: string,
  endpoints: object
}
```

### 2. Kafka Integration

Service tự động consume messages từ các Kafka topics:

- **price.updates**: Cập nhật giá token
- **order.updates**: Cập nhật trạng thái orders
- **portfolio.updates**: Cập nhật portfolio users
- **trade.updates**: Cập nhật trade history

### 3. Redis Integration

Service sử dụng Redis cho:
- Connection tracking (clustering support)
- Rate limiting
- Subscription management
- Metrics storage

## Message Types và Structures

### 1. Price Update Message
```typescript
// Backend gửi từ Kafka:
interface PriceUpdateMessage {
  token: string;          // Token symbol (e.g., "ETH")
  chainId: number;        // Chain ID (e.g., 8453 for Base)
  price: string;          // Native price
  priceUsd: string;       // USD price
  change24h: string;      // 24h change percentage
  volume24h: string;      // 24h volume
  timestamp: number;      // Unix timestamp
}

// Frontend nhận được:
interface PriceUpdate {
  symbol: string;         // token hoặc symbol
  price: number;          // priceUsd được parse thành number
  change: number;         // change24h được parse thành number
  volume: number;         // volume24h được parse thành number
  timestamp: number;      // message timestamp
}
```

### 2. Order Update Message
```typescript
// Backend gửi từ Kafka:
interface OrderUpdateMessage {
  orderId: string;
  userId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  tokenIn: string;        // Input token symbol
  tokenOut: string;       // Output token symbol
  amountIn: string;       // Input amount (string for precision)
  amountOut?: string;     // Output amount (optional)
  chainId: number;
  timestamp: number;
}

// Frontend nhận được:
interface OrderUpdate {
  orderId: string;
  symbol: string;         // "${tokenIn}/${tokenOut}"
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;         // amountIn parsed to number
  price?: number;         // calculated from amountOut/amountIn
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  timestamp: number;
}
```

### 3. Portfolio Update Message
```typescript
// Backend gửi từ Kafka:
interface PortfolioUpdateMessage {
  userId: string;
  chainId: number;
  tokens: Array<{
    address: string;
    symbol: string;
    balance: string;
    valueUsd: string;
  }>;
  totalValueUsd: string;
  timestamp: number;
}

// Frontend nhận được:
interface PortfolioUpdate {
  totalValue: number;     // totalValueUsd parsed to number
  change24h: number;      // calculated if available
  tokens: Array<{
    symbol: string;
    balance: number;
    value: number;
    change24h: number;
  }>;
  timestamp: number;
}
```

### 4. Trade Update Message
```typescript
// Backend gửi từ Kafka:
interface TradeUpdateMessage {
  tradeId: string;
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
  txHash: string;
  timestamp: number;
}

// Frontend nhận được (mapped to TradeNotification):
interface TradeNotification {
  id: string;             // tradeId
  symbol: string;         // "${tokenIn}/${tokenOut}"
  type: 'buy' | 'sell';
  amount: number;         // amountIn parsed
  price: number;          // amountOut / amountIn (safe division)
  value: number;          // amountOut parsed
  status: 'completed';    // always completed for trades
  timestamp: number;
}
```

## Subscription Channels

### Available Channels:
- **prices**: Nhận cập nhật giá token real-time từ tất cả chains
- **orders**: Nhận cập nhật order status cho orders của user
- **portfolio**: Nhận cập nhật portfolio balance của user
- **trades**: Nhận cập nhật trade history của user
- **user_specific**: Nhận cập nhật riêng cho user (user-specific messages từ backend)

### Channel Behavior:
- Client phải subscribe để nhận data
- Server tự động route messages đến subscribers dựa trên channel
- User-specific data (orders, portfolio, trades) chỉ gửi đến connections của user đó
- Prices channel công khai cho tất cả authenticated clients

### Subscription Flow:
1. Client authenticate thành công
2. Client gửi subscribe message với channels mong muốn
3. Server gửi `subscribed` confirmation
4. Backend bắt đầu broadcast messages theo subscriptions
5. Client có thể unsubscribe bất kỳ lúc nào

## Authentication Flow

### 1. Client Authentication
```
Client → WebSocket Connection (không token)
WebSocket Service → Gửi auth_required message
Client → Gửi authenticate message với JWT token
WebSocket Service → Auth Service (/api/v1/auth/verify)
Auth Service → Verify Token + Return User Info
WebSocket Service → Send auth_success/auth_failed
```

### 2. Token Verification
- Method: POST request với token trong body
- Endpoint: `/api/v1/auth/verify`
- Timeout: 5 seconds (configurable)
- Auth timeout: 10 seconds cho toàn bộ auth process

### 3. Authentication Messages
- `auth_required`: Server yêu cầu authentication (sau khi connect)
- `authenticate`: Client gửi JWT token
- `auth_success`: Connection authenticated với user info
- `auth_failed`: Authentication failed với error details

## Rate Limiting

### Connection Limits
- **Max connections per IP**: 100 (configurable)
- **Window size**: 60 seconds
- **Applies to**: WebSocket connections

### Message Limits  
- **Max messages per minute per IP**: 120
- **Max messages per minute per user**: 96 (80% of IP limit)
- **Window**: 1 minute sliding window

### Rate Limit Headers
Service tracks client IP through:
1. `X-Real-IP` header (nginx $remote_addr)
2. `X-Forwarded-For` header (first IP in chain)
3. `X-Forwarded` header
4. Fastify parsed IP (fallback)

## Error Handling

### Client Error Handling
```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Implement reconnection logic
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
  // Implement reconnection logic
};
```

### Server Error Codes
- **1008**: Authentication failed
- **1011**: Internal server error
- **1012**: Service restart
- **1013**: Service overloaded

### Error Message Structure
```typescript
interface WebSocketError {
  code: string;
  message: string;
  details?: any;
}
```

### Common Error Codes
- `MESSAGE_PARSE_ERROR`: Invalid message format
- `MESSAGE_PROCESSING_ERROR`: Server processing error
- `INVALID_CHANNEL`: Invalid subscription channel
- `SUBSCRIPTION_FAILED`: Subscription error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AUTHENTICATION_FAILED`: Auth error
- `UNSUPPORTED_OPERATION`: Invalid operation

## Monitoring và Debugging

### Health Check
- Endpoint: `GET /health`
- Checks: Redis, Kafka, Auth Service
- Frequency: 30 seconds (configurable)

### Metrics Collection
- Connection count
- Message throughput
- Error rates
- Authentication attempts
- Subscription statistics

### Logging
- Structured logging với timestamps
- Log levels: debug, info, warn, error
- Request tracing với correlation IDs

## Best Practices

### Client-side
1. Implement exponential backoff for reconnections
2. Handle authentication token refresh
3. Use heartbeat để detect connection issues
4. Implement proper error handling và user feedback
5. Subscribe chỉ đến các channels cần thiết

### Server-side
1. Monitor connection counts và resource usage
2. Implement proper graceful shutdown
3. Use Redis clustering cho high availability
4. Monitor Kafka consumer lag
5. Implement proper security headers

### Performance
1. Batch messages khi có thể
2. Use compression cho large payloads
3. Implement connection pooling
4. Monitor memory usage
5. Use load balancing cho multiple instances

## Troubleshooting

### Common Issues
1. **Connection refused**: Check service running và network connectivity
2. **Authentication failed**: Verify JWT token validity
3. **Rate limit exceeded**: Reduce connection/message frequency
4. **Messages not received**: Check subscription status
5. **High latency**: Monitor Redis và Kafka performance

### Debug Tools
- WebSocket client testing: `wscat`, browser dev tools
- Health check: `curl http://localhost:3008/health`
- Metrics: `curl http://localhost:3008/metrics`
- Connection status: `curl http://localhost:3008/connections`
- Logs: Check service logs for errors

### WebSocket Testing với wscat
```bash
# Connect và test authentication flow
wscat -c "ws://localhost:3008/ws"

# Expect: {"type":"auth_required","data":{"timeout":10000}}
# Send: {"id":"auth_1","type":"authenticate","timestamp":1701234567890,"data":{"token":"your-jwt-token"}}
# Expect: {"type":"auth_success","data":{"user":{...}}}

# Subscribe to prices
# Send: {"id":"sub_1","type":"subscribe","timestamp":1701234567890,"data":{"channel":"prices"}}
# Expect: {"type":"subscribed","data":{"channel":"prices"}}

# Send ping
# Send: {"id":"ping_1","type":"ping","timestamp":1701234567890,"data":{}}
# Expect: {"type":"pong","data":{}}
```

### Performance Monitoring
- Connection count trends
- Message throughput
- Error rates
- Response times
- Resource utilization (CPU, memory, network) 