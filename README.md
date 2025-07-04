# MoonXFarm DEX

**Next-Generation Decentralized Exchange Platform**

MoonXFarm is a comprehensive decentralized exchange (DEX) platform featuring **Account Abstraction**, **AI-Powered Trading Assistant**, and **Cross-Chain Liquidity Aggregation**. Built with modern microservices architecture, the platform delivers enterprise-grade performance, security, and user experience for DeFi trading.

## 🎯 Platform Overview

MoonXFarm DEX bridges the gap between traditional finance user experience and decentralized finance capabilities through innovative technologies:

- **Account Abstraction**: Gasless transactions and smart wallet automation
- **AI Trading Assistant**: Intelligent DeFi guidance with contextual responses  
- **Cross-Chain Trading**: Seamless asset swaps across multiple blockchains
- **Advanced Order Types**: Market, limit, and DCA (Dollar Cost Averaging) orders
- **Social Authentication**: Web2-style login with Web3 wallet creation
- **MEV Protection**: Optimized routing to minimize front-running and sandwich attacks
- **Real-Time Analytics**: Comprehensive portfolio tracking and P&L calculation

## 🏗️ System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Application<br/>Next.js 14]
        MOBILE[Mobile App<br/>React Native]
        LANDING[Landing Page<br/>Marketing Site]
    end
    
    subgraph "AI Services"
        AI_AGENT[AI Agent Service<br/>Lili Assistant]
        LANGCHAIN[LangChain API<br/>Streaming Responses]
    end
    
    subgraph "Core Backend Services"
        AUTH[Auth Service<br/>JWT + Social Auth]
        CORE[Core Service<br/>Orders & Portfolio]
        AGG[Aggregator Service<br/>Quote Routing]
        NOTIFY[Notification Service<br/>Real-time Alerts]
    end
    
    subgraph "Background Workers"
        PRICE_WORKER[Price Crawler<br/>Market Data]
        ORDER_WORKER[Order Executor<br/>Automated Trading]
    end
    
    subgraph "Blockchain Layer"
        DIAMOND[Diamond Proxy Router<br/>EIP-2535]
        FACETS[Aggregator Facets<br/>LiFi, 1inch, Relay]
    end
    
    subgraph "External Integrations"
        PRIVY[Privy API<br/>Social Auth]
        ZERODEV[ZeroDev API<br/>Account Abstraction]
        ALCHEMY[Alchemy API<br/>Blockchain Data]
        DEX_AGGS[DEX Aggregators<br/>LiFi, 1inch, Relay]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL<br/>Transactional Data)]
        REDIS[(Redis<br/>Cache & Sessions)]
        KAFKA[(Kafka<br/>Event Streaming)]
    end
    
    WEB --> AUTH
    WEB --> CORE
    WEB --> AGG
    WEB --> AI_AGENT
    MOBILE --> AUTH
    MOBILE --> CORE
    
    AI_AGENT --> LANGCHAIN
    
    AUTH --> PRIVY
    CORE --> ALCHEMY
    CORE --> POSTGRES
    CORE --> REDIS
    
    AGG --> DEX_AGGS
    AGG --> REDIS
    
    NOTIFY --> REDIS
    NOTIFY --> KAFKA
    
    PRICE_WORKER --> KAFKA
    ORDER_WORKER --> KAFKA
    ORDER_WORKER --> DIAMOND
    
    WEB --> DIAMOND
    WEB --> ZERODEV
    
    DIAMOND --> FACETS
    FACETS --> DEX_AGGS
```

### Microservices Architecture

#### Frontend Layer
- **Web Application**: Next.js 14 with App Router, TypeScript, and modern React patterns
- **Mobile Application**: React Native with cross-platform compatibility (planned)
- **Landing Page**: Marketing website with professional design and team information

#### Backend Services
- **Auth Service**: User authentication, authorization, and session management
- **Core Service**: Order management, portfolio tracking, and P&L calculation
- **Aggregator Service**: Multi-tier quote aggregation and routing optimization
- **Notification Service**: Real-time alerts, copy trading, and WebSocket connections

#### AI Integration
- **AI Agent Service**: Intelligent trading assistant with contextual DeFi guidance
- **LangChain Integration**: Streaming responses and conversation management

#### Background Workers
- **Price Crawler**: Continuous market data aggregation from multiple sources
- **Order Executor**: Automated execution of limit orders and DCA strategies

#### Blockchain Infrastructure
- **Diamond Proxy Router**: Upgradeable smart contract system (EIP-2535)
- **Aggregator Facets**: Modular integration with DEX aggregators

## 🔧 Technology Stack

### Frontend Technologies
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Next.js 14+ | React framework with App Router |
| **Language** | TypeScript | Type safety and developer experience |
| **Styling** | TailwindCSS | Utility-first CSS framework |
| **UI Components** | shadcn/ui | Accessible component library |
| **State Management** | React Query + Context | Server state and client state |
| **Blockchain** | wagmi + viem | Ethereum interaction libraries |
| **Authentication** | Privy SDK | Social login and wallet creation |
| **Account Abstraction** | ZeroDev SDK | Gasless transactions and session keys |

### Backend Technologies
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime environment |
| **Language** | TypeScript | Type-safe backend development |
| **Framework** | Fastify v5 | High-performance web framework |
| **Database** | PostgreSQL 15+ | ACID-compliant relational database |
| **Cache** | Redis 7+ | In-memory data structure store |
| **Message Queue** | Apache Kafka | Event streaming platform |
| **Configuration** | Custom Config Manager | Environment-based configuration |

### Smart Contract Technologies
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Language** | Solidity 0.8.23 | Smart contract programming |
| **Pattern** | Diamond Proxy (EIP-2535) | Upgradeable contract architecture |
| **Development** | Hardhat | Smart contract development environment |
| **Testing** | JavaScript + Hardhat | Contract testing framework |
| **Deployment** | Multi-network Scripts | Automated deployment system |

### Infrastructure & DevOps
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Containerization** | Docker + Docker Compose | Application containerization |
| **Package Management** | pnpm Workspaces | Monorepo dependency management |
| **Build System** | Turborepo | Incremental build optimization |
| **CI/CD** | GitHub Actions | Continuous integration and deployment |
| **Monitoring** | Custom Health Checks | Service health and performance monitoring |

## 🌐 Supported Networks

### Mainnet Networks
- **Base**: Layer 2 Ethereum solution
- **Binance Smart Chain (BSC)**: High-performance blockchain
- **Ethereum**: Primary Ethereum mainnet (planned)
- **Polygon**: Ethereum scaling solution (planned)
- **Arbitrum**: Optimistic rollup solution (planned)

### Testnet Networks
- **Base Sepolia**: Base testnet for development
- **BSC Testnet**: BSC testnet for development

## 🔑 Core Features

### Account Abstraction
- **Gasless Transactions**: ZeroDev paymaster integration for fee-free trading
- **Session Keys**: Automated trading permissions with time and amount limits
- **Social Recovery**: Web2-style account recovery mechanisms
- **Multi-Signature Support**: Enhanced security for institutional users

### AI Trading Assistant (Lili)
- **Contextual Guidance**: DeFi-specific responses and platform assistance
- **Streaming Responses**: Real-time conversation with character-by-character typing
- **Interactive Avatar**: Animated assistant with personality and engagement
- **Strategy Recommendations**: Intelligent trading suggestions based on market conditions

### Advanced Order Management
- **Market Orders**: Instant execution at current market prices
- **Limit Orders**: Execute trades when price conditions are met
- **DCA Orders**: Automated dollar-cost averaging with customizable intervals
- **Order History**: Comprehensive tracking of all trading activities

### Cross-Chain Liquidity Aggregation
- **Multi-Tier Routing**: Fast quotes (<800ms) and comprehensive analysis (<3s)
- **Circuit Breaker Protection**: Automatic failover for unreliable aggregators
- **Price Impact Optimization**: Minimize slippage through intelligent routing
- **MEV Protection**: Built-in protection against front-running attacks

### Portfolio Management
- **Real-Time Tracking**: Live portfolio valuation across multiple chains
- **P&L Analytics**: Detailed profit and loss calculations with cost basis tracking
- **Historical Analysis**: Performance tracking over time with visual charts
- **Auto-Sync System**: Background synchronization with smart triggers

## 📊 Development Status

### Production-Ready Components (97%)
| Component | Completion | Key Features |
|-----------|------------|--------------|
| **Frontend Application** | 100% | Complete UI, Account Abstraction, AI integration |
| **AI Assistant** | 100% | Streaming chat, avatar system, context awareness |
| **Auth Service** | 100% | JWT + Privy integration, social login |
| **Core Service** | 100% | Order management, portfolio tracking, P&L |
| **Aggregator Service** | 100% | Multi-tier quotes, circuit breaker patterns |
| **Smart Contracts** | 100% | Diamond proxy, multi-aggregator support |
| **Landing Page** | 100% | Professional marketing website |
| **Configuration System** | 100% | Centralized config management |
| **Database Schema** | 100% | Orders, portfolio, analytics tables |

### In Development (3%)
| Component | Status | Timeline |
|-----------|--------|----------|
| **Notification Service** | In Progress | Real-time alerts, WebSocket integration |
| **Price Crawler Worker** | Planned | Background market data aggregation |
| **Order Executor Worker** | Planned | Automated order execution system |

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 20 or higher
- **pnpm**: Package manager for workspaces
- **Docker**: Container runtime environment
- **PostgreSQL**: Version 15 or higher
- **Redis**: Version 7 or higher

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/moonx-farm.git
   cd moonx-farm
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Configure required variables
   nano .env
   ```

4. **Infrastructure Setup**
   ```bash
   # Start development infrastructure
   docker-compose up -d
   
   # Run database migrations
   pnpm db:migrate
   ```

5. **Start Development Server**
   ```bash
   # Start all services
   pnpm dev
   ```

### Environment Configuration

#### Core Configuration
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_farm
REDIS_URL=redis://localhost:6379

# Authentication & Security
JWT_SECRET=your-secure-jwt-secret
PRIVY_APP_ID=your-privy-application-id
PRIVY_APP_SECRET=your-privy-secret

# Account Abstraction
ZERODEV_PROJECT_ID=your-zerodev-project-id
ZERODEV_BUNDLER_RPC=your-bundler-endpoint
ZERODEV_PAYMASTER_RPC=your-paymaster-endpoint
```

#### Blockchain Configuration
```bash
# Network RPC Endpoints
BASE_MAINNET_RPC=https://mainnet.base.org
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org
BASE_SEPOLIA_RPC=https://sepolia.base.org
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org

# Smart Contract Addresses
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...
```

#### External API Configuration
```bash
# Blockchain Data
ALCHEMY_API_KEY=your-alchemy-api-key

# DEX Aggregators
LIFI_API_KEY=your-lifi-api-key
ONEINCH_API_KEY=your-1inch-api-key

# AI Services
LANGCHAIN_API_URL=https://api.moonx.farm/api/agent
LANGCHAIN_API_KEY=your-langchain-api-key
```

## 🗂️ Project Structure

```
moonx-farm/
├── apps/                              # Client Applications
│   ├── web/                          # Next.js Web Application
│   │   ├── src/components/           # React Components
│   │   │   ├── ai/                   # AI Assistant Components
│   │   │   ├── wallet/               # Wallet Management UI
│   │   │   ├── trading/              # Trading Interface
│   │   │   └── portfolio/            # Portfolio Components
│   │   ├── src/lib/                  # Utility Libraries
│   │   │   ├── session-keys.ts       # Session Key Management
│   │   │   ├── contracts.ts          # Smart Contract Integration
│   │   │   └── api-client.ts         # API Client
│   │   └── src/config/               # Application Configuration
│   ├── mobile/                       # React Native Application (planned)
│   └── landing/                      # Marketing Landing Page
├── services/                         # Backend Microservices
│   ├── auth-service/                 # Authentication & Authorization
│   ├── core-service/                 # Order Management & Portfolio
│   ├── aggregator-service/           # Quote Aggregation & Routing
│   └── notify-service/               # Real-time Notifications
├── workers/                          # Background Processing
│   ├── price-crawler/                # Market Data Aggregation
│   └── order-executor/               # Automated Order Execution
├── contracts/                        # Smart Contracts
│   ├── src/                          # Solidity Source Code
│   │   ├── Diamond.sol               # Main Router Contract
│   │   ├── facets/                   # Modular Contract Facets
│   │   └── libraries/                # Shared Contract Libraries
│   ├── scripts/                      # Deployment Scripts
│   └── test/                         # Contract Tests
├── packages/                         # Shared Libraries
│   ├── common/                       # Common Types & Utilities
│   ├── infrastructure/               # Infrastructure Managers
│   └── api-client/                   # API Client SDK
├── configs/                          # Configuration Management
├── database/                         # Database Schemas & Migrations
├── docs/                             # Project Documentation
└── infrastructure/                   # DevOps & Deployment
```

## 🔨 Development Commands

### Development Workflow
```bash
# Start development environment
pnpm dev                    # All services in development mode
pnpm dev:web                # Frontend only
pnpm dev:services           # Backend services only

# Building
pnpm build                  # Build all packages and applications
pnpm build:web              # Build web application
pnpm build:services         # Build backend services

# Testing
pnpm test                   # Run all tests
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests only
pnpm test:contracts         # Smart contract tests

# Database Operations
pnpm db:migrate             # Run database migrations
pnpm db:seed                # Seed database with test data
pnpm db:reset               # Reset database to clean state

# Code Quality
pnpm lint                   # Lint all code
pnpm format                 # Format code with Prettier
pnpm type-check             # TypeScript type checking
```

### Docker Operations
```bash
# Development Environment
docker-compose up -d        # Start infrastructure services
docker-compose down         # Stop all services
docker-compose logs -f      # View service logs

# Production Deployment
docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Performance Benchmarks

### API Performance Targets
| Metric | Target | Current Achievement |
|--------|--------|-------------------|
| Quote Latency (p95) | ≤ 800ms | 285ms (Fast), 612ms (Comprehensive) |
| Order API Response | ≤ 300ms | 150-250ms average |
| Portfolio API Response | ≤ 500ms | 200-300ms average |
| Authentication Response | ≤ 200ms | 100-150ms average |

### System Performance
| Metric | Target | Status |
|--------|--------|--------|
| Platform Uptime | ≥ 99.9% | Production Ready |
| Database Query Performance | ≤ 50ms p95 | Optimized with indexes |
| Cache Hit Rate | ≥ 90% | 95%+ achieved |
| Concurrent Users | 10,000+ | Scalable architecture |

## 🔐 Security Features

### Authentication & Authorization
- **Multi-Factor Authentication**: Social login with wallet verification
- **Session Management**: Secure JWT tokens with refresh rotation
- **Rate Limiting**: Adaptive rate limiting per endpoint and user
- **CORS Protection**: Configured for secure cross-origin requests

### Smart Contract Security
- **Proxy Pattern**: Upgradeable contracts with controlled access
- **Access Control**: Role-based permissions for contract operations
- **Reentrancy Protection**: Guards against common attack vectors
- **Audit Ready**: Structured for professional security audits

### Data Protection
- **Encryption**: All sensitive data encrypted at rest and in transit
- **Privacy Compliance**: GDPR and privacy regulation adherence
- **Audit Logging**: Comprehensive logging for security monitoring
- **Backup Strategy**: Automated backups with point-in-time recovery

## 🚢 Deployment

### Production Deployment
```bash
# Docker deployment
docker-compose -f docker-compose.yml up -d
```

### Monitoring & Observability
- **Health Checks**: Automated service health monitoring
- **Performance Metrics**: Real-time performance tracking
- **Error Tracking**: Comprehensive error logging and alerting
- **Business Metrics**: Trading volume, user engagement, and revenue tracking

## 🤝 Contributing

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Implement changes with tests
4. Ensure code quality (`pnpm lint && pnpm test`)
5. Commit with conventional commits
6. Push and create a Pull Request

### Code Standards
- **TypeScript**: All new code must be written in TypeScript
- **Testing**: Minimum 80% test coverage for new features
- **Documentation**: Update documentation for API changes
- **Code Review**: All changes require review before merging

## 📚 Documentation

- **[API Documentation](docs/api/README.md)**: Complete API reference
- **[Architecture Guide](docs/architecture/README.md)**: System design documentation
- **[Development Guide](docs/development/README.md)**: Setup and development workflows
- **[Deployment Guide](docs/deployment/README.md)**: Production deployment instructions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/0xsyncroot/moonx-farm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/0xsyncroot/moonx-farm/discussions)
- **Documentation**: [Project Wiki](https://github.com/0xsyncroot/moonx-farm/wiki)

---

**MoonXFarm DEX** - Enterprise-Grade Decentralized Trading Platform

*Combining the power of DeFi with the simplicity of traditional finance*