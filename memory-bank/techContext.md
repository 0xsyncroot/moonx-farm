# MoonXFarm DEX - Technical Context

**Ngày cập nhật**: 25/06/2025  
**Phiên bản**: v1.0  

## 🚀 Technology Stack Overview

### **Frontend**
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Framework** | Next.js | 14+ | App Router, SSR, performance optimized |
| **UI Library** | shadcn/ui | Latest | Modern, accessible, customizable |
| **Styling** | TailwindCSS | 3.4+ | Utility-first, responsive design |
| **Blockchain** | wagmi + viem | 2.x + 2.x | Type-safe Ethereum interactions |
| **State Management** | Redux Toolkit | 2.0+ | Predictable state, DevTools |
| **Auth** | Privy SDK | 1.x | Social login, wallet abstraction |
| **Deployment** | Vercel | - | Edge functions, global CDN |

### **Backend Services**
| Service | Language | Framework | Database | Rationale |
|---------|----------|-----------|----------|-----------|
| **API Gateway** | TypeScript | Fastify/Nginx | - | High performance, routing |
| **Auth Service** | TypeScript | Fastify | PostgreSQL | JWT, Privy integration |
| **Wallet Registry** | TypeScript | Fastify | PostgreSQL | AA wallet management |
| **Aggregator Service** | Go | Gin/Fiber | Redis | High performance quotes |
| **Swap Orchestrator** | TypeScript | Fastify | PostgreSQL | Complex business logic |
| **Position Indexer** | TypeScript | Fastify | PostgreSQL | Event processing |
| **Notify Service** | TypeScript | Socket.IO | Redis | Real-time notifications |

### **Workers & Background Jobs**
| Worker | Language | Framework | Purpose |
|--------|----------|-----------|---------|
| **Price Crawler** | Go | - | Multi-source price aggregation |
| **Order Executor** | TypeScript | - | Automated order execution |

### **Infrastructure**
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL 15+ | Primary data storage |
| **Cache** | Redis 7+ | Session, cache, pub/sub |
| **Message Queue** | Apache Kafka | Event streaming |
| **Container** | Docker | Containerization |
| **Orchestration** | Kubernetes | Container orchestration |
| **Service Mesh** | Istio (Optional) | Traffic management |
| **Monitoring** | Prometheus + Grafana | Metrics & dashboards |
| **Tracing** | Jaeger | Distributed tracing |
| **Logging** | Grafana Loki | Centralized logging |

### **Blockchain & Web3**
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Smart Contracts** | Solidity 0.8.23 | MoonXFarmRouter (Diamond proxy) |
| **Testing Framework** | Foundry | Contract testing & deployment |
| **Account Abstraction** | ZeroDev | AA wallets, bundler, paymaster |
| **Networks** | Base, BSC, Ethereum, Polygon | Multi-chain support |
| **Aggregators** | LI.FI, 1inch, Relay.link | 3 aggregator integrations |

## 🏗️ Development Environment

### **Monorepo Structure**
```bash
moonx-farm/
├── packages/               # Shared packages
│   ├── common/            # @moonx/common
│   ├── api-client/        # @moonx/api-client  
│   └── configs/           # @moonx-farm/configs
├── services/              # Backend services
├── workers/               # Background workers
├── apps/web/              # Frontend application
├── contracts/             # Smart contracts
└── infrastructure/        # DevOps configs
```

### **Build System**
- **Package Manager**: pnpm (workspace support)
- **Build Tool**: Turborepo (incremental builds)
- **Bundler**: Webpack 5 (Next.js), esbuild (services)
- **TypeScript**: 5.0+ (strict mode)

### **Development Tools**
```json
{
  "linting": "ESLint + Prettier",
  "testing": "Jest + Vitest + Playwright",
  "ci_cd": "GitHub Actions",
  "container": "Docker + Docker Compose",
  "documentation": "Markdown + Mermaid diagrams"
}
```

## 🔧 Technical Decisions & Rationale

### **1. Programming Language Choices**

#### **TypeScript cho Backend Services**
**Rationale**:
- Type safety giảm runtime errors
- Ecosystem phong phú với npm packages
- Team familiar với JavaScript/TypeScript
- Rapid development và prototyping

**Trade-offs**:
- ✅ Faster development, rich ecosystem
- ❌ Slower runtime so với Go/Rust

#### **Go cho Performance-Critical Services**
**Rationale**:
- Aggregator Service cần <200ms response time
- Price Crawler xử lý high-frequency data
- Better performance cho concurrent operations

**Implementation**:
- Aggregator Service: Go với Gin framework
- Price Crawler: Go với goroutines

### **2. Database Choices**

#### **PostgreSQL as Primary Database**
**Rationale**:
- ACID compliance cho financial data
- Advanced features: JSON, arrays, functions
- Mature ecosystem và tooling
- Horizontal scaling với partitioning

**Schema Design**:
```sql
-- User data
CREATE TABLE wallets (
    aa_address BYTEA PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading data  
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type ORDER_TYPE NOT NULL,
    status ORDER_STATUS NOT NULL,
    -- ... other fields
);

-- Performance indexes
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_pending ON orders(status) WHERE status = 'PENDING';
```

#### **Redis as Cache & Session Store**
**Use Cases**:
- Session storage cho JWT tokens
- Quote caching (TTL 30s)
- Price data caching
- Rate limiting counters
- Pub/Sub cho real-time events

**Configuration**:
```javascript
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: 6379,
  keyPrefix: 'moonx:',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};
```

### **3. Microservices Communication**

#### **REST APIs cho External Communication**
**API Design Principles**:
- RESTful endpoints với proper HTTP methods
- JSON request/response format
- Consistent error responses
- API versioning với `/v1` prefix

#### **gRPC cho Internal Communication**
**Rationale**:
- Type-safe với Protocol Buffers
- Better performance so với REST
- Built-in streaming support

**Example Service Definition**:
```protobuf
service AggregatorService {
  rpc GetQuote(QuoteRequest) returns (QuoteResponse);
  rpc GetBestRoute(RouteRequest) returns (RouteResponse);
}

message QuoteRequest {
  string token_in = 1;
  string token_out = 2;
  string amount = 3;
  int32 chain_id = 4;
}
```

### **4. Event-Driven Architecture**

#### **Apache Kafka cho Event Streaming**
**Topics Structure**:
```
moonx.swaps.initiated
moonx.swaps.completed
moonx.orders.created
moonx.orders.filled
moonx.prices.updated
moonx.positions.updated
```

**Producer Example**:
```typescript
await kafka.producer.send({
  topic: 'moonx.swaps.initiated',
  messages: [{
    key: swap.userId,
    value: JSON.stringify({
      userId: swap.userId,
      swapId: swap.id,
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      amountIn: swap.amountIn,
      timestamp: new Date().toISOString()
    })
  }]
});
```

## 🔒 Security Architecture

### **Authentication & Authorization**

#### **JWT Token Strategy**
```typescript
interface JWTPayload {
  userId: string;
  walletAddress: string;
  sessionId: string;
  permissions: Permission[];
  iat: number;
  exp: number;
}
```

#### **Session Key Management**
```typescript
interface SessionKey {
  publicKey: string;
  encryptedPrivateKey: string; // KMS encrypted
  permissions: {
    maxAmount: BigNumber;
    allowedTokens: string[];
    expiresAt: Date;
  };
}
```

### **Input Validation & Sanitization**
```typescript
// Zod schemas cho input validation
const SwapRequestSchema = z.object({
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountIn: z.string().regex(/^\d+$/),
  slippage: z.number().min(0.1).max(5.0)
});
```

### **Rate Limiting Strategy**
```typescript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ':' + req.user?.id
};
```

## 🎯 Performance Optimizations

### **Frontend Performance**

#### **Next.js Optimizations**
```javascript
// next.config.js
module.exports = {
  experimental: {
    appDir: true
  },
  images: {
    domains: ['assets.moonxfarm.com']
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
};
```

#### **Bundle Optimization**
- Code splitting với dynamic imports
- Tree shaking cho unused code
- Image optimization với Next.js Image
- CDN caching cho static assets

### **Backend Performance**

#### **Database Query Optimization**
```sql
-- Efficient pagination
SELECT * FROM orders 
WHERE user_id = $1 AND created_at < $2
ORDER BY created_at DESC 
LIMIT 20;

-- Covering indexes
CREATE INDEX idx_orders_user_created_status 
ON orders(user_id, created_at DESC) 
INCLUDE (status, amount, token_in, token_out);
```

#### **Caching Strategy**
```typescript
// Multi-level caching
class AggregatorService {
  async getQuote(tokenIn: string, tokenOut: string, amount: string) {
    // L1: In-memory cache (1s TTL)
    const memoryKey = `${tokenIn}:${tokenOut}:${amount}`;
    if (this.memoryCache.has(memoryKey)) {
      return this.memoryCache.get(memoryKey);
    }
    
    // L2: Redis cache (30s TTL)
    const redisKey = `quote:${memoryKey}`;
    const cached = await redis.get(redisKey);
    if (cached) {
      this.memoryCache.set(memoryKey, JSON.parse(cached), 1000);
      return JSON.parse(cached);
    }
    
    // L3: External aggregators
    const quote = await this.fetchFromAggregators(tokenIn, tokenOut, amount);
    
    // Cache results
    await redis.setex(redisKey, 30, JSON.stringify(quote));
    this.memoryCache.set(memoryKey, quote, 1000);
    
    return quote;
  }
}
```

## 🚧 Technical Constraints & Limitations

### **Current Constraints**

#### **Blockchain Limitations**
- **Gas Costs**: Ethereum mainnet fees cao, cần Layer 2
- **Transaction Speed**: Block confirmation times
- **MEV Attacks**: Front-running và sandwich attacks
- **RPC Rate Limits**: Public RPC có rate limits

#### **Third-party Dependencies**
- **Privy**: Social login rate limits
- **ZeroDev**: Bundler capacity limits  
- **Aggregators**: API rate limits và response times
- **Price Feeds**: Data freshness và accuracy

#### **Infrastructure Constraints**
- **Database**: Single master write bottleneck
- **Redis**: Memory limitations cho caching
- **Kafka**: Message ordering trong partitions
- **Kubernetes**: Resource limits và scheduling

### **Scalability Bottlenecks**

#### **Database Scaling Strategy**
```typescript
// Read replicas cho query load distribution
const readDB = new Pool({ 
  host: 'read-replica.rds.amazonaws.com',
  // ... config
});

const writeDB = new Pool({
  host: 'master.rds.amazonaws.com', 
  // ... config
});

class DatabaseService {
  async read(query: string, params: any[]) {
    return readDB.query(query, params);
  }
  
  async write(query: string, params: any[]) {
    return writeDB.query(query, params);
  }
}
```

#### **Horizontal Scaling Pattern**
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: aggregator-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment  
    name: aggregator-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 🔮 Future Technical Roadmap

### **Phase 2 Improvements (Q2-Q3 2025)**
- **Multi-chain Support**: Ethereum, Polygon, Arbitrum
- **Advanced Caching**: Redis Cluster với sharding
- **Database Sharding**: User-based partitioning
- **Service Mesh**: Istio cho traffic management

### **Phase 3 Optimizations (Q4 2025+)**
- **Edge Computing**: CloudFlare Workers cho geo-distribution
- **AI/ML**: Price prediction models, MEV detection
- **Cross-chain**: Native bridge integrations
- **Advanced Analytics**: Real-time trading insights

## 🛠️ Development Workflow

### **Local Development Setup**
```bash
# Clone repository
git clone https://github.com/moonx-farm/moonx-farm.git
cd moonx-farm

# Install dependencies
pnpm install

# Setup environment
cp env.example .env
./scripts/setup-env.sh

# Start development environment
docker-compose up -d  # Start databases
pnpm dev              # Start all services
```

### **Testing Strategy**
```typescript
// Unit tests với Jest
describe('AggregatorService', () => {
  it('should return cached quote', async () => {
    const service = new AggregatorService();
    const quote = await service.getQuote('ETH', 'USDC', '1000000');
    expect(quote).toBeDefined();
  });
});

// Integration tests với Supertest
describe('Swap API', () => {
  it('should execute swap successfully', async () => {
    const response = await request(app)
      .post('/v1/swap/execute')
      .send(swapRequest)
      .expect(200);
  });
});

// E2E tests với Playwright
test('user can complete swap flow', async ({ page }) => {
  await page.goto('/swap');
  await page.fill('[data-testid=token-in]', 'ETH');
  await page.fill('[data-testid=token-out]', 'USDC');
  await page.click('[data-testid=swap-button]');
  await expect(page.locator('[data-testid=success-message]')).toBeVisible();
});
```

### **CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm lint
  
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: ./scripts/deploy-staging.sh
```

Tech stack này được thiết kế để đảm bảo performance, scalability và maintainability cho MoonXFarm DEX trong quá trình phát triển và vận hành.

## Implemented Services Status

### ✅ Completed Services

#### 1. **Auth Service** (✅ COMPLETED)
- **Tech Stack**: Fastify v5 + TypeScript
- **Features**: Privy integration, JWT management, auto-generated OpenAPI docs
- **Architecture**: Type-safe schemas, modern plugin ecosystem
- **Security**: Secure JWT handling, refresh token strategy

#### 2. **Wallet Registry Service** (✅ COMPLETED)
- **Tech Stack**: Fastify + ZeroDev SDK + TypeScript
- **Features**: Account Abstraction wallets, session key management, gas sponsorship
- **Architecture**: Secure session key lifecycle, intelligent gas policies
- **Integration**: ZeroDev Account Abstraction, automatic gas sponsorship

#### 3. **Aggregator Service** (✅ OPTIMIZED)
- **Tech Stack**: Go + Redis + Circuit Breaker
- **Features**: Multi-tier quote aggregation, cross-chain support
- **Architecture**: Performance-optimized, provider reliability tracking
- **Integration**: LiFi, 1inch, Relay providers

#### 4. **Configuration Management** (✅ IMPLEMENTED)
- **Tech Stack**: TypeScript + Zod validation
- **Features**: Profile-based loading, type-safe configuration
- **Architecture**: Centralized config with service-specific profiles

### 🚧 Services In Development
- **API Gateway**: Fastify-based routing and middleware
- **Swap Orchestrator**: UserOperation building and execution

### 📋 Planned Services
- **Notify Service**: Real-time notifications with Socket.IO
- **Position Indexer**: On-chain event tracking and P&L calculation
- **Price Crawler**: Multi-source price aggregation worker
- **Order Executor**: Limit order and DCA execution worker

## Technical Standards Established

### Code Quality Standards
- **TypeScript**: Strict type safety, eliminating `as any` antipatterns
- **Error Handling**: Comprehensive error boundaries and proper error types
- **Validation**: Zod schemas for all inputs with runtime validation
- **Documentation**: Auto-generated OpenAPI specs (development only)
- **Testing**: Unit tests for core functionality

### Performance Standards
- **Aggregator Service**: <800ms fast tier, <3s comprehensive tier
- **Caching Strategy**: Redis with intelligent TTL (15s quotes, 30s tokens)
- **Concurrent Processing**: Parallel provider calls with staggered execution
- **Early Termination**: Fast-fail strategies when sufficient data available
- **Metrics Tracking**: Real-time provider performance monitoring

### Infrastructure Standards
- **Configuration**: Profile-based loading, only load necessary config
- **Connection Management**: Simplified managers for Database, Redis, Kafka
- **Environment Setup**: Automated script with secure secret generation
- **Logging**: Centralized structured logging with proper correlation IDs

### Security Standards
- **JWT**: Proper token management with refresh strategy
- **Rate Limiting**: Provider-specific rate limits and circuit breakers
- **Validation**: Multi-level validation for different security contexts
- **Secrets**: Environment-based secret management
- **Session Keys**: Encrypted approval storage, zero client exposure

### Cross-Chain Standards
- **ToChainID Support**: Cross-chain quote models and provider matrix
- **Provider Compatibility**: LiFi/Relay (cross-chain), 1inch (same-chain)
- **Error Handling**: Proper validation for unsupported cross-chain requests

## Wallet Registry Service Architecture

### ZeroDev Account Abstraction Integration
- **Kernel Accounts**: v3.1 implementation with paymaster support
- **Session Keys**: Secure lifecycle management with encrypted approval storage
- **Gas Sponsorship**: Automatic policy creation with conservative limits
- **Deployment**: Sponsored first-time wallet deployment for smooth onboarding

### Session Key Management
- **Security**: Encrypted approval strings stored in database, never exposed to clients
- **Workflow**: Correct session key reuse logic preventing unnecessary duplicates
- **Permissions**: Smart compatibility checking for existing session keys
- **Lifecycle**: Auto-expiry handling with database-only revocation for expired keys

### Gas Sponsorship System
- **Automatic Policies**: Conservative limits (daily 0.005 ETH, monthly 0.05 ETH)
- **Intelligent Checking**: Multi-tier eligibility validation
- **Cost Tracking**: Proper user attribution for gas usage accounting
- **Abuse Prevention**: Built-in limits with fallback sponsorship

### API Endpoints
- **Session Management**: Create, revoke, validate session keys
- **Transaction Execution**: Auto-session management with permission reuse
- **Gas Monitoring**: Check sponsorship status and remaining limits
- **Wallet Operations**: Create, deploy, and manage AA wallets

## Implementation Achievements

### Wallet Registry Highlights
- ✅ **Zero Client Exposure**: Session key approvals never leave server
- ✅ **Smart Reuse Logic**: Automatic session key discovery and reuse
- ✅ **Comprehensive Gas Management**: Intelligent sponsorship with proper tracking
- ✅ **Secure Architecture**: Encrypted storage with proper key isolation
- ✅ **Industry Standards**: Following ZeroDev best practices and patterns

### Aggregator Service Highlights
- ✅ **Performance Optimization**: Multi-tier aggregation with early termination
- ✅ **Provider Reliability**: Circuit breaker pattern with automatic recovery
- ✅ **Cross-Chain Support**: Full support matrix with proper error handling
- ✅ **Intelligent Caching**: TTL-based caching with real-time invalidation

### Configuration Highlights
- ✅ **Type Safety**: Generic configuration types with Zod validation
- ✅ **Profile System**: Service-specific configuration loading
- ✅ **Environment Management**: Comprehensive variable management (300+)
- ✅ **Automation**: Secure secret generation and environment setup
