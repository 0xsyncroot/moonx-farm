# Redis Infrastructure Quickstart

Hướng dẫn tích hợp và sử dụng Redis infrastructure cho các service trong MoonX Farm.

## Tổng quan

Redis Infrastructure hỗ trợ:
- **Caching**: Key-value storage với TTL
- **Session Management**: Session storage với auto-expiration
- **Rate Limiting**: Counter operations với TTL
- **Queuing**: List operations cho job queues
- **Pub/Sub**: Real-time messaging
- **Metrics & Monitoring**: Performance tracking và health checks

## Cấu hình Environment

```bash
# Option 1: Redis URL (ưu tiên)
REDIS_URL=redis://username:password@localhost:6379/0

# Option 2: Individual variables
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_KEY_PREFIX=moonx:

# Connection settings
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_FAMILY=4

# Features
REDIS_ENABLE_METRICS=true
REDIS_ENABLE_OFFLINE_QUEUE=true
REDIS_LAZY_CONNECT=true
```

## Tích hợp cơ bản

```typescript
// services/redisService.ts
import { 
  RedisManager, 
  createRedis, 
  createRedisConfig 
} from '@moonx-farm/infrastructure';

export class RedisService {
  private redis: RedisManager;

  constructor() {
    const config = createRedisConfig();
    this.redis = createRedis(config);
  }

  async initialize(): Promise<void> {
    await this.redis.connect();
  }

  getRedis(): RedisManager {
    return this.redis;
  }

  async shutdown(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Export singleton
export const redisService = new RedisService();
```

## API Methods

### Basic Operations

- **`get<T>(key: string): Promise<T | null>`** - Lấy giá trị theo key, auto-parse JSON
- **`set(key, value, options?): Promise<string>`** - Set giá trị với TTL options
- **`del(...keys): Promise<number>`** - Xóa key(s), trả về số lượng đã xóa
- **`exists(...keys): Promise<number>`** - Kiểm tra key tồn tại
- **`expire(key, ttl): Promise<boolean>`** - Set TTL cho key
- **`ttl(key): Promise<number>`** - Lấy TTL còn lại (-1: không expire, -2: không tồn tại)

### Batch Operations

- **`mget<T>(...keys): Promise<(T | null)[]>`** - Lấy nhiều keys cùng lúc
- **`mset(keyValues): Promise<string>`** - Set nhiều key-value cùng lúc
- **`pipeline(operations): Promise<any[]>`** - Batch execute commands

### Counter Operations

- **`incr(key): Promise<number>`** - Tăng giá trị lên 1
- **`incrby(key, increment): Promise<number>`** - Tăng giá trị theo số
- **`decr(key): Promise<number>`** - Giảm giá trị xuống 1

### Hash Operations

- **`hget(key, field): Promise<string | null>`** - Lấy field từ hash
- **`hset(key, field, value): Promise<number>`** - Set field trong hash
- **`hgetall(key): Promise<Record<string, string>>`** - Lấy tất cả fields
- **`hdel(key, ...fields): Promise<number>`** - Xóa field(s) từ hash

### List Operations

- **`lpush(key, ...values): Promise<number>`** - Push vào đầu list
- **`rpush(key, ...values): Promise<number>`** - Push vào cuối list
- **`lpop(key): Promise<string | null>`** - Pop từ đầu list
- **`rpop(key): Promise<string | null>`** - Pop từ cuối list
- **`llen(key): Promise<number>`** - Lấy độ dài list

### Set Operations

- **`sadd(key, ...members): Promise<number>`** - Thêm members vào set
- **`srem(key, ...members): Promise<number>`** - Xóa members từ set
- **`smembers(key): Promise<string[]>`** - Lấy tất cả members
- **`sismember(key, member): Promise<boolean>`** - Kiểm tra member trong set

### Advanced Operations

- **`scan(pattern, count?): Promise<string[]>`** - Scan keys an toàn (thay thế KEYS)
- **`flushdb(): Promise<string>`** - Xóa toàn bộ database (cẩn thận!)
- **`getInfo(section?): Promise<string>`** - Lấy thông tin Redis server
- **`command(command, ...args): Promise<any>`** - Execute custom Redis command

### Cache Options

```typescript
interface CacheOptions {
  ttl?: number;        // Time to live (seconds)
  nx?: boolean;        // Only set if key doesn't exist
  xx?: boolean;        // Only set if key exists
  keepTtl?: boolean;   // Keep existing TTL
}
```

## Monitoring & Health Check

```typescript
// Health check
const isHealthy = redisService.getRedis().isHealthy();

// Get metrics
const metrics = redisService.getRedis().getMetrics();
// Returns: { totalCommands, successfulCommands, failedCommands, averageLatency, connectionCount, isConnected, lastError }

// Get Redis info
const info = await redisService.getRedis().getInfo('memory');
```

## Common Use Cases

### 1. Caching
```typescript
const redis = redisService.getRedis();

// Set cache với TTL
await redis.set('user:123', userData, { ttl: 3600 });

// Get từ cache
const cachedData = await redis.get('user:123');
```

### 2. Session Management
```typescript
// Set session
await redis.set(`session:${sessionId}`, sessionData, { ttl: 1800 });

// Extend session
await redis.expire(`session:${sessionId}`, 1800);
```

### 3. Rate Limiting
```typescript
// Increment counter
const count = await redis.incr(`rate_limit:${userId}`);
if (count === 1) {
  await redis.expire(`rate_limit:${userId}`, 60); // 1 minute window
}
```

### 4. Job Queue
```typescript
// Add job
await redis.lpush('jobs:queue', JSON.stringify(jobData));

// Process job
const job = await redis.rpop('jobs:queue');
```

## Error Handling

Tất cả methods tự động throw `ServiceUnavailableError` khi Redis không khả dụng. Sử dụng try-catch để handle:

```typescript
try {
  const result = await redis.get('key');
} catch (error) {
  if (error instanceof ServiceUnavailableError) {
    // Handle Redis unavailable
  }
}
```

## Best Practices

1. **Key Naming**: Sử dụng key prefix để tránh conflict
2. **TTL**: Luôn set TTL cho cache để tránh memory leak
3. **Batch Operations**: Sử dụng `mget`/`mset` cho multiple operations
4. **Pipeline**: Sử dụng pipeline cho batch commands
5. **Scan**: Sử dụng `scan()` thay vì `KEYS` trong production

## Troubleshooting

- **Connection Issues**: Kiểm tra `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **Timeout**: Tăng `REDIS_CONNECT_TIMEOUT` và `REDIS_COMMAND_TIMEOUT`
- **Performance**: Monitor `averageLatency` trong metrics
- **Memory**: Sử dụng `getInfo('memory')` để kiểm tra memory usage

---

Để hỗ trợ hoặc báo cáo lỗi, liên hệ team phát triển MoonX Farm. 