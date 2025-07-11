# MoonX Farm WebSocket Service

WebSocket service thời gian thực cho MoonX Farm DEX với luồng đơn giản và hiệu quả.

## 🚀 Tính năng chính

- **Post-connection Authentication**: Xác thực sau khi kết nối
- **Subscription-based**: Chỉ nhận tin nhắn từ channels đã đăng ký
- **User-specific Rooms**: Mỗi user có room riêng biệt
- **Kafka Integration**: Xử lý events qua Kafka single topic
- **Redis Clustering**: Hỗ trợ clustering và scaling

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

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
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