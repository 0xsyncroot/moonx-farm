# WebSocket Gateway - High Performance Configuration

## Overview
Cấu hình hiệu suất cao cho WebSocket Gateway được thiết kế để xử lý lượng lớn kết nối đồng thời và thông lượng cao cho ứng dụng MoonXFarm DEX.

## 🚀 Performance Optimizations

### Rate Limiting - DISABLED
```typescript
rateLimits: {
  enabled: false, // Hoàn toàn tắt rate limiting
  // Tất cả giới hạn được đặt thành 999999999 (unlimited)
}
```

**Lý do:**
- WebSocket real-time trading cần tốc độ tối đa
- Rate limiting có thể tạo bottleneck cho high-frequency trading
- Ứng dụng cần xử lý burst traffic từ price updates

### Connection Limits - MAXIMIZED
```typescript
connections: {
  maxConnectionsPerUser: {
    admin: 10000,    // Không giới hạn cho admin
    vip: 5000,       // Rất cao cho VIP users
    user: 1000,      // Cao cho users thường
    default: 500     // Cao cho default
  },
  maxConnectionsPerIP: 50000,      // Rất cao cho IP
  maxGlobalConnections: 1000000,   // 1M kết nối đồng thời
}
```

### Socket.IO Optimizations
```typescript
socket: {
  transports: ['websocket'],        // Chỉ WebSocket, không polling
  perMessageDeflate: false,         // Tắt compression để tăng tốc
  compression: false,               // Tắt compression
  serveClient: false,               // Không serve client files
  allowUpgrades: false,             // Tắt transport upgrades
  maxHttpBufferSize: 1e8,          // 100MB buffer
}
```

### Redis Optimizations
```typescript
redis: {
  keyPrefix: 'wsg:',               // Prefix ngắn
  retryDelayOnFailover: 50,        // Retry nhanh
  maxRetriesPerRequest: 1,         // Ít retry
  pipeline: true,                  // Dùng pipeline cho batch operations
  enableReadyCheck: false          // Tắt ready check
}
```

### Security - MINIMAL for Performance
```typescript
security: {
  enableOriginCheck: false,        // Tắt origin check
  enableCSRFProtection: false,     // Tắt CSRF protection
  enableRateLimit: false,          // Tắt rate limiting
  enableDDoSProtection: false,     // Tắt DDoS protection
  enableIPFiltering: false,        // Tắt IP filtering
  maxPayloadSize: 1e8,            // 100MB payload
}
```

## 📊 Performance Benchmarks

### Expected Performance
- **Concurrent Connections**: 1,000,000+
- **Message Throughput**: 100,000+ messages/second
- **Latency**: <10ms for WebSocket messages
- **Memory Usage**: ~1GB per 100,000 connections
- **CPU Usage**: Auto-scale với số CPU cores

### Scaling Capabilities
```typescript
cluster: {
  enabled: true,
  maxWorkers: 'auto',              // Dùng tất cả CPU cores
  restartWorkerOnMemoryUsage: 500, // MB
  maxMemoryUsage: 1000            // MB per worker
}
```

## 🔧 Usage

### 1. Import Performance Config
```typescript
import { performanceConfig, isRateLimitingEnabled, getConnectionLimit } from './config/performance.config';
```

### 2. Check Rate Limiting Status
```typescript
if (!isRateLimitingEnabled()) {
  console.log('Rate limiting is DISABLED for maximum performance');
}
```

### 3. Get Connection Limits
```typescript
const adminLimit = getConnectionLimit('admin');     // 10000
const userLimit = getConnectionLimit('user');       // 1000
const defaultLimit = getConnectionLimit('guest');   // 500
```

### 4. Apply to Socket.IO Server
```typescript
import { getOptimizedSocketConfig } from './config/performance.config';

const io = new Server(httpServer, getOptimizedSocketConfig());
```

## ⚠️ Important Notes

### 1. Security Trade-offs
- **Tất cả security checks đã bị TẮT** để tối ưu hiệu suất
- **Rate limiting hoàn toàn bị loại bỏ**
- **Origin checking bị tắt** - cho phép connections từ mọi nguồn
- **CSRF protection bị tắt**

### 2. Monitoring Requirements
- **Cần monitoring external** vì internal monitoring bị giảm
- **Log level = 'warn'** để giảm I/O overhead
- **Detailed metrics bị tắt** để giảm CPU usage

### 3. Resource Requirements
- **Minimum RAM**: 8GB cho 100,000 connections
- **Minimum CPU**: 4 cores
- **Recommended**: 16GB RAM, 8+ cores cho production

## 🚨 Production Considerations

### 1. Load Balancing
```typescript
// Sử dụng multiple instances với load balancer
const instances = [
  'ws-gateway-1.moonxfarm.com',
  'ws-gateway-2.moonxfarm.com',
  'ws-gateway-3.moonxfarm.com'
];
```

### 2. Health Checks
```typescript
// Health check endpoint vẫn enabled
GET /health
GET /metrics
```

### 3. Graceful Shutdown
```typescript
// Graceful shutdown với connection draining
process.on('SIGTERM', async () => {
  await gateway.gracefulShutdown();
});
```

## 🎯 Use Cases

### Perfect For:
- **High-frequency trading applications**
- **Real-time price feeds**
- **Live portfolio updates**
- **Instant order notifications**
- **Market data streaming**

### NOT Recommended For:
- **Public APIs with unknown traffic**
- **Applications requiring strict security**
- **Rate-limited external services**
- **Development environments**

## 📈 Monitoring

### Key Metrics to Monitor:
1. **Connection count**: Theo dõi số lượng kết nối
2. **Memory usage**: RAM usage per worker
3. **CPU usage**: CPU utilization
4. **Message throughput**: Messages/second
5. **Error rates**: Connection errors

### Alerting Thresholds:
- **Memory > 80%**: Scale up
- **CPU > 90%**: Scale up
- **Connection errors > 1%**: Investigate
- **Latency > 50ms**: Performance issue

## 🔄 Rollback Plan

Nếu cần rollback to safe config:
```typescript
// Thay đổi trong performance.config.ts
rateLimits: {
  enabled: true,  // Enable lại rate limiting
  // Restore normal limits
}
```

---

**⚡ Current Status: Rate Limiting DISABLED - Maximum Performance Mode** 