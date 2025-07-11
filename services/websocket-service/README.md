# MoonX Farm WebSocket Service

WebSocket service thời gian thực cho MoonX Farm DEX với luồng đơn giản và hiệu quả.

## 🚀 Tính năng chính

- **Post-connection Authentication**: Xác thực sau khi kết nối
- **Subscription-based**: Chỉ nhận tin nhắn từ channels đã đăng ký
- **User-specific Rooms**: Mỗi user có room riêng biệt
- **Kafka Integration**: Xử lý events qua Kafka single topic
- **Redis Clustering**: Hỗ trợ clustering và scaling
- **Smart URL Handling**: Tự động xử lý WebSocket URLs (HTTP→WS, thêm /ws path)
- **Flexible Connection**: Hỗ trợ kết nối ở cả `/` và `/ws` paths

## 🔧 URL Configuration

The WebSocket service automatically handles URL formatting:

```javascript
// All these formats work:
'http://localhost:3008'     → 'ws://localhost:3008/ws'
'https://ws.moonx.farm'     → 'wss://ws.moonx.farm/ws'
'ws://localhost:3008/ws'    → 'ws://localhost:3008/ws'
'wss://ws.moonx.farm/ws'    → 'wss://ws.moonx.farm/ws'
```

## 🔄 Luồng hoạt động

### 1. Kết nối và xác thực
```
Client → WebSocket Connect → Server yêu cầu auth → Client gửi token → Server xác thực
```

### 2. Subscription channels
```
Client → Subscribe request → Server validation → Join room → Receive messages
```

### 3. Message broadcasting
```
Kafka Event → Server routing → Send to subscribers only
```

## 📡 Supported Channels

- `prices` - Cập nhật giá token
- `orders` - Cập nhật đơn hàng
- `portfolio` - Cập nhật portfolio
- `trades` - Cập nhật giao dịch
- `chain_stats` - Thống kê blockchain
- `bridge_stats` - Thống kê bridge
- `stats_overview` - Tổng quan thống kê
- `user:{userId}` - Tin nhắn user cụ thể

## 🛠️ Cấu hình

### Environment Variables
```bash
# Server
PORT=3001
HOST=0.0.0.0

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_MAIN_TOPIC=moonx.events
KAFKA_GROUP_ID=websocket-service
```

### Docker
```bash
# Build
docker build -t moonx-websocket-service .

# Run
docker run -p 3001:3001 moonx-websocket-service
```

## �� Testing

```bash
# Quick connection test
node quick-test.js

# Full connection test
node test-connection-fix.js

# Debug connection issues
node debug-connection.js
```

## 📊 Monitoring

### Health Check
```
GET /health
```

### Metrics
```
GET /metrics
```

### WebSocket Endpoint
```
WS /ws
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build
npm run build

# Start production
npm start
```

## 📝 Logging

Service sử dụng structured logging với các levels:
- `error` - Lỗi hệ thống
- `warn` - Cảnh báo
- `info` - Thông tin chung
- `debug` - Chi tiết debug

## 🏗️ Architecture

```
Client ←→ WebSocket Service ←→ Kafka ←→ Other Services
                ↓
              Redis
```

## 🔗 Related Services

- **Authentication Service**: Xác thực JWT tokens
- **Order Service**: Xử lý đơn hàng
- **Price Service**: Cập nhật giá
- **Portfolio Service**: Quản lý portfolio

## 📄 Documentation

- [API Documentation](./API.md)
- [Integration Guide](./INTEGRATION_GUIDE.md) 