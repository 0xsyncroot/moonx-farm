# WebSocket Gateway - Implementation Plan

## 🎯 Current Status

### ✅ Completed
- **Rate limiting optimization** - Loại bỏ hoàn toàn rate limiting
- **Performance configuration** - Config tối ưu cho high performance
- **Architecture refactoring** - Dependency injection pattern
- **Docker performance setup** - Multi-instance với load balancer
- **Documentation** - README cho performance và refactoring

### ⏳ In Progress
- **Service extraction** - Tách các services riêng biệt
- **Dependency injection** - Container pattern implementation

### 🔄 Cần hoàn thành

## 📋 Implementation Roadmap

### Phase 1: Core Services (Week 1)

#### 1.1 ConnectionManager Service
```typescript
// services/connectionManager.ts
export class ConnectionManager {
  private connections: Map<string, SocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  
  async addConnection(socket: Socket): Promise<void> { /* ... */ }
  async removeConnection(connectionId: string): Promise<void> { /* ... */ }
  async getUserConnections(userId: string): Promise<SocketConnection[]> { /* ... */ }
  async getConnectionCount(): Promise<number> { /* ... */ }
  async addToRoom(connectionId: string, room: string): Promise<void> { /* ... */ }
  async removeFromRoom(connectionId: string, room: string): Promise<void> { /* ... */ }
}
```

#### 1.2 MessageRouter Service
```typescript
// services/messageRouter.ts
export class MessageRouter {
  constructor(
    private io: Server,
    private connectionManager: ConnectionManager,
    private metrics: PrometheusMetrics
  ) {}
  
  async routeMessage(socket: Socket, event: string, data: any): Promise<void> { /* ... */ }
  async sendToConnections(connectionIds: string[], message: any): Promise<void> { /* ... */ }
  async broadcast(message: any): Promise<void> { /* ... */ }
  async sendToRoom(room: string, message: any): Promise<void> { /* ... */ }
  async sendToUser(userId: string, message: any): Promise<void> { /* ... */ }
}
```

#### 1.3 AuthService Service
```typescript
// services/authService.ts
export class AuthService {
  constructor(private httpClient: HttpClient) {}
  
  async validateToken(token: string): Promise<User | null> {
    // Call auth-service API endpoint
    const response = await this.httpClient.post('/api/v1/auth/verify', { token });
    return response.data.user;
  }
  
  async refreshToken(refreshToken: string): Promise<string | null> { /* ... */ }
  async getUserInfo(userId: string): Promise<User | null> { /* ... */ }
}
```

### Phase 2: Support Services (Week 2)

#### 2.1 LoadBalancer Service
```typescript
// services/loadBalancer.ts
export class LoadBalancer {
  private instances: Map<string, InstanceInfo> = new Map();
  private currentConnections = 0;
  
  async registerConnection(connectionId: string): Promise<void> { /* ... */ }
  async unregisterConnection(connectionId: string): Promise<void> { /* ... */ }
  async getOptimalInstance(): Promise<string> { /* ... */ }
  async getStatus(): Promise<LoadBalancerStatus> { /* ... */ }
}
```

#### 2.2 PrometheusMetrics Service
```typescript
// services/prometheusMetrics.ts
export class PrometheusMetrics {
  private connectionGauge: Gauge;
  private messageCounter: Counter;
  private errorCounter: Counter;
  
  incrementConnections(): void { /* ... */ }
  decrementConnections(): void { /* ... */ }
  incrementMessages(type: string): void { /* ... */ }
  incrementErrors(): void { /* ... */ }
  async getMetrics(): Promise<string> { /* ... */ }
}
```

#### 2.3 HealthService Service
```typescript
// services/healthService.ts
export class HealthService {
  constructor(private dependencies: HealthCheckable[]) {}
  
  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.all(
      this.dependencies.map(dep => dep.healthCheck())
    );
    
    return {
      status: checks.every(check => check.healthy) ? 'healthy' : 'unhealthy',
      checks: checks,
      timestamp: new Date().toISOString()
    };
  }
}
```

### Phase 3: Infrastructure (Week 3)

#### 3.1 Redis Manager Integration
```typescript
// Use @moonx-farm/infrastructure
import { RedisManager } from '@moonx-farm/infrastructure';

// In container.ts
this.redisManager = new RedisManager({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  keyPrefix: 'ws-gateway:',
  retryDelayOnFailover: 50, // Fast for performance
  maxRetriesPerRequest: 1   // Minimal retries
});
```

#### 3.2 Configuration Management
```typescript
// config/index.ts
export const config = {
  server: {
    port: process.env.PORT || 3007,
    host: process.env.HOST || '0.0.0.0'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'ws-gateway:'
  },
  performance: {
    rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED === 'true',
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000000'),
    securityLevel: process.env.SECURITY_LEVEL || 'minimal'
  }
};
```

### Phase 4: Testing & Validation (Week 4)

#### 4.1 Unit Tests
```typescript
// tests/unit/connectionManager.test.ts
describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockRedis: jest.Mocked<RedisManager>;
  
  beforeEach(() => {
    mockRedis = createMockRedis();
    connectionManager = new ConnectionManager(mockRedis);
  });
  
  it('should add connection successfully', async () => {
    const socket = createMockSocket();
    await connectionManager.addConnection(socket);
    expect(mockRedis.set).toHaveBeenCalled();
  });
});
```

#### 4.2 Integration Tests
```typescript
// tests/integration/gateway.test.ts
describe('WebSocket Gateway Integration', () => {
  let gateway: WebSocketGateway;
  let container: Container;
  
  beforeEach(async () => {
    container = new Container();
    const services = await container.initialize();
    gateway = new WebSocketGateway(services);
  });
  
  it('should handle connection flow', async () => {
    const client = io('http://localhost:3007');
    await new Promise(resolve => client.on('connected', resolve));
    expect(client.connected).toBe(true);
  });
});
```

## 🔧 Technical Implementation Details

### 1. **Service Interfaces**
```typescript
// types/services.ts
export interface HealthCheckable {
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

export interface ConnectionManager {
  addConnection(socket: Socket): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  getUserConnectionCount(userId: string): Promise<number>;
}

export interface MessageRouter {
  routeMessage(socket: Socket, event: string, data: any): Promise<void>;
  sendToConnections(connectionIds: string[], message: any): Promise<void>;
}
```

### 2. **Error Handling**
```typescript
// middleware/errorHandler.ts
export class ErrorHandler {
  static handleSocketError(socket: Socket, error: Error): void {
    logger.error('Socket error:', error);
    socket.emit('error', {
      message: 'Internal server error',
      timestamp: Date.now()
    });
  }
  
  static handleServiceError(service: string, error: Error): void {
    logger.error(`Service ${service} error:`, error);
    // Implement circuit breaker logic
  }
}
```

### 3. **Performance Monitoring**
```typescript
// monitoring/performance.ts
export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  
  trackLatency(operation: string, duration: number): void {
    this.metrics.set(`${operation}_latency`, duration);
  }
  
  trackThroughput(operation: string, count: number): void {
    this.metrics.set(`${operation}_throughput`, count);
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}
```

## 🚀 Deployment Strategy

### 1. **Development Environment**
```bash
# Install dependencies
npm install

# Run with development config
npm run dev

# Run tests
npm run test
```

### 2. **Production Environment**
```bash
# Build for production
npm run build

# Run with performance config
NODE_ENV=production \
PERFORMANCE_MODE=true \
RATE_LIMITING_ENABLED=false \
npm start
```

### 3. **Docker Deployment**
```yaml
# docker-compose.yml
version: '3.8'
services:
  websocket-gateway:
    build: .
    environment:
      - NODE_ENV=production
      - PERFORMANCE_MODE=true
      - RATE_LIMITING_ENABLED=false
      - MAX_CONNECTIONS=1000000
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
```

## 📊 Success Metrics

### Performance Targets
- **Connections**: 1,000,000+ concurrent
- **Latency**: <10ms average
- **Throughput**: 100,000+ messages/second
- **Memory**: <1GB per 100k connections
- **CPU**: <80% utilization

### Code Quality Targets
- **Test Coverage**: >80%
- **Code Complexity**: <10 per function
- **File Size**: <300 lines per file
- **Documentation**: 100% public APIs

### Reliability Targets
- **Uptime**: 99.9%
- **Error Rate**: <0.1%
- **Recovery Time**: <30 seconds
- **Data Loss**: 0%

## 🎯 Immediate Next Steps

### Today
1. **Review architecture** - Approve dependency injection approach
2. **Prioritize services** - Which services to implement first
3. **Assign resources** - Who will work on what

### This Week
1. **Implement ConnectionManager** - Core service for connection handling
2. **Implement MessageRouter** - Message routing and broadcasting
3. **Create unit tests** - Test each service independently

### Next Week
1. **Integration testing** - Test services working together
2. **Performance testing** - Load testing with new architecture
3. **Production deployment** - Deploy to staging environment

---

**Current Status:** Architecture designed ✅ | Services planned ✅ | Ready for implementation ✅ 