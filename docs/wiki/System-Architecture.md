# System Architecture

**Complete system design and architecture overview for MoonXFarm DEX**

MoonXFarm uses a modern, scalable microservices architecture optimized for performance, security, and developer experience.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web App       │   Mobile App    │      Landing Page          │
│  (Next.js 14)   │   (Planned)     │    (Next.js 14)            │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
┌───────────────────▼───────────────────▼───────────────────────────┐
│                    AI Services Layer                              │
├─────────────────────────┬─────────────────────────────────────────┤
│     AI Agent (Lili)     │           LangChain API                 │
│   Interactive Avatar    │       (LangGraph Streaming)            │
└─────────────────────────┴─────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                 Core Backend Services                             │
├─────────────┬─────────────┬─────────────┬─────────────────────────┤
│Auth Service │Core Service │ Aggregator  │   Notification          │
│  (Node.js)  │ (Node.js)   │ Service(Go) │   Service (Planned)     │
│             │             │             │                         │
│• JWT Mgmt   │• Orders     │• Multi-tier │• Socket.IO              │
│• Privy      │• Portfolio  │  Quotes     │• Real-time Alerts       │
│• User Auth  │• P&L Track  │• Circuit    │• Copy Trading           │
│             │• Analytics  │  Breaker    │                         │
└─────────────┴─────────────┴─────────────┴─────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                  Background Workers                               │
├─────────────────────────┬─────────────────────────────────────────┤
│    Price Crawler        │           Order Executor               │
│      (Go Lang)          │           (Node.js)                    │
│                         │                                         │
│• Multi-source data      │• Limit order execution                 │
│• Real-time updates      │• DCA automation                        │
│• Kafka publishing       │• User operation submission             │
└─────────────────────────┴─────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                   Blockchain Layer                                │
├─────────────────────────┬─────────────────────────────────────────┤
│   Diamond Proxy Router  │              Facets                    │
│  (EIP-2535 Standard)    │                                         │
│                         │• LiFi Proxy    • 1inch Proxy           │
│• Upgradeable design     │• Relay Proxy   • Fee Collector         │
│• Gas optimization       │• Ownership     • Diamond Cut            │
│• Multi-aggregator       │• Diamond Loupe                         │
└─────────────────────────┴─────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                 External Integrations                             │
├─────────────┬─────────────┬─────────────┬─────────────────────────┤
│   Privy     │  ZeroDev    │   Alchemy   │    DEX Aggregators      │
│             │             │             │                         │
│• Social     │• Account    │• Multi-     │• LI.FI (Cross-chain)    │
│  Login      │  Abstract.  │  chain Data │• 1inch (Same-chain)     │
│• Wallet     │• Session    │• Portfolio  │• Relay (Cross-chain)    │
│  Creation   │  Keys       │  Sync       │• DexScreener (Prices)   │
│• Auth       │• Gasless TX │• 5 Chains   │                         │
└─────────────┴─────────────┴─────────────┴─────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                      Data Layer                                   │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   PostgreSQL    │      Redis      │           Kafka               │
│                 │                 │                               │
│• User data      │• Session cache  │• Price feeds                  │
│• Order history  │• Quote cache    │• Order events                 │
│• Trade records  │• Portfolio cache│• Notification queue           │
│• P&L tracking   │• Rate limiting  │• Analytics events             │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

## 🔄 Data Flow Architecture

### Trading Flow
```
User Initiates Trade
        ↓
Frontend (Next.js) → Auth Service (JWT validation)
        ↓
Aggregator Service → External APIs (LiFi, 1inch, Relay)
        ↓
Quote Comparison → Best Route Selection
        ↓
User Approval → Smart Contract Execution
        ↓
Diamond Proxy → Appropriate Facet
        ↓
External DEX → Trade Execution
        ↓
Event Emission → Core Service (Order tracking)
        ↓
Portfolio Update → User Notification
```

### Account Abstraction Flow
```
User Social Login (Privy)
        ↓
ZeroDev AA Wallet Creation
        ↓
Session Key Generation
        ↓
Permission Assignment
        ↓
Gasless Transaction Execution
        ↓
Paymaster Gas Sponsorship
        ↓
Transaction Bundling
        ↓
On-chain Execution
```

## 📊 Component Deep Dive

### Frontend Layer

#### Web Application (Next.js 14)
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS with Jupiter-inspired design
- **State Management**: React Context + Custom hooks
- **Authentication**: Privy integration with social login
- **Blockchain**: wagmi/viem for Web3 interactions
- **UI Components**: shadcn/ui component library

**Key Features:**
- Account Abstraction integration with ZeroDev
- Session key management for automated trading
- Multi-chain support (Base, BSC)
- Real-time portfolio tracking
- AI assistant (Lili) integration

#### Mobile Application (Planned)
- **Framework**: React Native with Expo
- **Shared Logic**: Common business logic with web app
- **Native Features**: Biometric authentication, push notifications

### AI Services Layer

#### AI Agent (Lili)
- **Avatar System**: Anime-style interactive avatar
- **Conversation Engine**: LangChain LangGraph integration
- **Context Awareness**: DeFi-specific knowledge base
- **Real-time Chat**: Streaming responses with typewriter effect
- **Screen Walker**: Interactive avatar with safe boundaries

**API Integration:**
```typescript
POST https://api.moonx.farm/api/agent/threads/{session_id}/runs/stream
```

### Backend Services

#### Authentication Service (Node.js + Fastify)
- **Port**: 3001
- **Framework**: Fastify v5 with TypeScript
- **Authentication**: Privy integration for social login
- **Token Management**: JWT with refresh token rotation
- **Session Management**: Redis-backed sessions
- **OpenAPI**: Auto-generated documentation

**Core Responsibilities:**
- User authentication and authorization
- JWT token lifecycle management
- Session management and cleanup
- User profile management

#### Core Service (Node.js + Fastify)
- **Port**: 3007
- **Framework**: Fastify v5 with TypeScript
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis for performance optimization
- **External APIs**: Alchemy for blockchain data

**Core Responsibilities:**
- Order management (CRUD operations)
- Portfolio synchronization across 5 chains
- P&L calculation with cost basis tracking
- Trading history and analytics
- Auto-sync mechanisms

#### Aggregator Service (Go)
- **Port**: 3003
- **Framework**: Go with Gin HTTP framework
- **Performance**: Sub-second response times
- **Reliability**: Circuit breaker pattern
- **Caching**: Redis with intelligent TTL

**Core Responsibilities:**
- Multi-tier quote aggregation
- Cross-chain route optimization
- Price impact analysis
- Slippage protection
- Provider health monitoring

### Smart Contracts

#### Diamond Proxy Architecture (EIP-2535)
- **Router Contract**: MoonXFarmRouter (main entry point)
- **Upgradeability**: Diamond Cut pattern for facet management
- **Gas Optimization**: Efficient storage layout
- **Multi-aggregator**: Support for multiple DEX aggregators

**Facets:**
- **LiFi Proxy Facet**: Cross-chain trading via LI.FI
- **1inch Proxy Facet**: Same-chain optimal routing
- **Relay Proxy Facet**: Cross-chain bridge integration
- **Fee Collector Facet**: Revenue collection mechanism
- **Ownership Facet**: Access control and governance
- **Diamond Cut Facet**: Upgrade functionality
- **Diamond Loupe Facet**: Introspection capabilities

### External Integrations

#### Privy (Authentication)
- **Social Login**: Google, Apple, Twitter, Discord
- **Wallet Creation**: Automatic smart wallet generation
- **Security**: Enterprise-grade authentication
- **Developer Experience**: Simple SDK integration

#### ZeroDev (Account Abstraction)
- **Smart Wallets**: ERC-4337 compatible accounts
- **Session Keys**: Automated trading permissions
- **Gasless Transactions**: Paymaster integration
- **Multi-chain**: Support across all networks

#### Alchemy (Blockchain Data)
- **Portfolio Sync**: Real-time token balances
- **Multi-chain**: 5 supported networks
- **Performance**: Cached responses with smart refresh
- **Reliability**: Automatic failover mechanisms

#### DEX Aggregators
- **LI.FI**: Cross-chain liquidity aggregation
- **1inch**: Same-chain optimal routing
- **Relay**: Cross-chain bridge protocols
- **DexScreener**: Real-time price data

### Data Layer

#### PostgreSQL
- **Version**: PostgreSQL 15+
- **Connection**: Connection pooling with pgbouncer
- **Performance**: Optimized indexes and queries
- **Backup**: Automated daily backups with point-in-time recovery

**Key Tables:**
```sql
users            -- User authentication data
user_sessions    -- Session management
orders           -- Order tracking and history
order_executions -- Detailed execution records
user_trades      -- Trading history with P&L
```

#### Redis
- **Version**: Redis 7+
- **Usage**: Caching, session storage, rate limiting
- **Performance**: Sub-millisecond response times
- **Reliability**: Automatic failover configuration

**Cache Strategy:**
- Quote cache: 30 seconds TTL
- Portfolio cache: 2 minutes TTL
- Session cache: 24 hours TTL
- Rate limiting: Sliding window

#### Kafka (Planned)
- **Purpose**: Event streaming and real-time updates
- **Topics**: Price feeds, order events, notifications
- **Consumers**: Background workers and analytics

## 🛡️ Security Architecture

### Authentication Flow
```
1. User → Social Login (Privy)
2. Privy → Identity Verification
3. Auth Service → JWT Generation
4. Client → JWT Storage (Secure)
5. API Requests → JWT Validation
6. Refresh → Automatic Token Rotation
```

### Authorization Levels
- **Public**: Health checks, basic token data
- **Authenticated**: Portfolio data, order management
- **Admin**: System monitoring, user management

### Data Protection
- **Encryption**: AES-256 for sensitive data
- **Secrets Management**: Environment variables with rotation
- **Network Security**: HTTPS/TLS 1.3 only
- **Input Validation**: Comprehensive request validation

## ⚡ Performance Optimizations

### Response Time Targets
| Operation | Target | Achieved |
|-----------|--------|----------|
| **Quote Aggregation** | <1s | 450ms average |
| **Portfolio Sync** | <2s | 800ms average |
| **Order Creation** | <500ms | 200ms average |
| **Authentication** | <300ms | 150ms average |

### Caching Strategy
- **Multi-tier caching**: Application, Redis, CDN
- **Smart invalidation**: Event-driven cache updates
- **Compression**: gzip/brotli for API responses
- **Connection pooling**: Database and Redis connections

### Scalability Patterns
- **Horizontal scaling**: Stateless service design
- **Load balancing**: Round-robin with health checks
- **Circuit breakers**: Automatic failure handling
- **Rate limiting**: Per-user and global limits

## 🔄 Development Workflow

### Monorepo Structure
```
moonx-farm/
├── apps/web/              # Frontend application
├── services/              # Backend microservices
├── contracts/             # Smart contracts
├── packages/common/       # Shared utilities
├── configs/               # Configuration management
└── infrastructure/        # DevOps and deployment
```

### CI/CD Pipeline
1. **Code Quality**: ESLint, Prettier, TypeScript
2. **Testing**: Unit, integration, contract tests
3. **Security**: SAST, dependency scanning
4. **Build**: Docker image creation
5. **Deploy**: Kubernetes rolling updates

### Environment Management
- **Development**: Local Docker environment
- **Staging**: Kubernetes cluster with test data
- **Production**: Multi-region Kubernetes deployment

## 📈 Monitoring & Observability

### Health Monitoring
- **Service Health**: HTTP health check endpoints
- **Database Health**: Connection and query monitoring
- **External APIs**: Response time and error rate tracking

### Metrics Collection
- **Application Metrics**: Request rate, response time, error rate
- **Business Metrics**: Order volume, user engagement, revenue
- **Infrastructure Metrics**: CPU, memory, network, storage

### Logging Strategy
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Error, warn, info, debug
- **Centralized**: ELK stack or equivalent
- **Retention**: 30 days for debug, 1 year for audit

## 🔮 Future Architecture

### Planned Enhancements
- **Multi-region deployment**: Global latency optimization
- **Event sourcing**: Complete audit trail
- **GraphQL API**: Flexible data querying
- **Machine learning**: Trading insights and recommendations

### Scalability Roadmap
- **Microservices decomposition**: Further service splitting
- **Event-driven architecture**: Async communication patterns
- **Edge computing**: CDN-based execution
- **Blockchain expansion**: Additional network support

---

**Architecture Questions?** Visit our [Developer Guide](Developer-Guide) or join the [Discord community](https://discord.gg/moonxfarm) for technical discussions. 