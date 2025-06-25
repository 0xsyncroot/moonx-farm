# MoonXFarm DEX

MoonXFarm is a decentralized exchange (DEX) platform with microservices architecture, supporting multiple blockchain networks including Base and BSC. Built with modern technologies and focuses on performance, scalability, and real-time operations.

## 🚀 Features

- **Multi-chain Support**: Base Mainnet/Testnet, BSC Mainnet/Testnet
- **Order Types**: Market Orders, Limit Orders, DCA (Dollar Cost Averaging)
- **Real-time Notifications**: Socket.IO-powered notification system
- **Microservices Architecture**: Scalable, maintainable service-oriented design
- **Smart Account Integration**: Advanced wallet management
- **High Performance**: Redis caching, Kafka messaging, PostgreSQL database
- **Comprehensive Monitoring**: Prometheus, Grafana, Jaeger tracing

## 🏗️ Architecture

### Core Services
- **API Gateway**: Request routing and load balancing (Nginx)
- **Auth Service**: Authentication and authorization
- **Wallet Registry**: Smart account management
- **Quote Service**: Real-time price quotes and market data
- **Swap Orchestrator**: Trade execution and order management
- **Position Indexer**: Portfolio tracking and analytics
- **Notify Service**: Real-time notifications via Socket.IO

### Workers
- **Price Crawler**: Multi-source price aggregation
- **Order Executor**: Automated order processing

### Infrastructure
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for high-performance caching
- **Message Queue**: Kafka for event streaming
- **Monitoring**: Prometheus + Grafana + Jaeger

## 🛠️ Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Next.js, React, TailwindCSS
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Queue**: Apache Kafka
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes, Helm
- **Infrastructure**: Terraform
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Build System**: Turborepo
- **Package Manager**: pnpm

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 6+
- Apache Kafka 2.8+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/moonx-farm.git
   cd moonx-farm
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build shared packages**
   ```bash
   pnpm build
   ```

4. **Start development environment**
   ```bash
   # Start all services with Docker Compose
   make dev-up
   
   # Or manually
   docker-compose up -d
   ```

5. **Initialize database**
   ```bash
   make db-migrate
   make db-seed
   ```

6. **Start development servers**
   ```bash
   # Start all services
   pnpm dev
   
   # Or start individual services
   cd services/api-gateway && pnpm dev
   cd services/auth-service && pnpm dev
   # ... etc
   ```

### Environment Configuration

Create `.env` files in each service directory:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/moonx_farm
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=moonx_farm
DATABASE_USER=username
DATABASE_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=moonx-farm

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Blockchain Networks
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_TESTNET_RPC=https://goerli.base.org
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/

# External APIs
COINGECKO_API_KEY=your-api-key
COINMARKETCAP_API_KEY=your-api-key
```

## 📁 Project Structure

```
moonx-farm/
├── packages/                    # Shared packages
│   ├── common/                 # Common utilities, types, errors
│   ├── config/                 # Database, Redis, Kafka configs
│   └── api-client/             # API client library
├── services/                   # Microservices
│   ├── api-gateway/           # Request routing
│   ├── auth-service/          # Authentication
│   ├── wallet-registry/       # Wallet management
│   ├── quote-service/         # Price quotes
│   ├── swap-orchestrator/     # Trade execution
│   ├── position-indexer/      # Portfolio tracking
│   └── notify-service/        # Real-time notifications
├── workers/                   # Background workers
│   ├── price-crawler/         # Price aggregation
│   └── order-executor/        # Order processing
├── apps/                      # Frontend applications
│   └── web/                   # Next.js web app
├── contracts/                 # Smart contracts
├── infrastructure/            # DevOps configs
├── database/                  # Database schemas & migrations
└── tests/                     # Test suites
```

## 🔧 Development

### Available Commands

```bash
# Development
make dev-up          # Start development environment
make dev-down        # Stop development environment
pnpm dev             # Start all services in development mode

# Building
pnpm build           # Build all packages and services
pnpm build:packages  # Build only shared packages
make build-services  # Build all services

# Testing
pnpm test            # Run all tests
pnpm test:unit       # Run unit tests
pnpm test:integration # Run integration tests
make test-e2e        # Run end-to-end tests

# Database
make db-migrate      # Run database migrations
make db-seed         # Seed database with test data
make db-reset        # Reset database

# Linting & Formatting
pnpm lint            # Lint all code
pnpm lint:fix        # Fix linting issues
pnpm format          # Format code with Prettier

# Docker
make docker-build    # Build all Docker images
make docker-push     # Push images to registry

# Deployment
make deploy-staging  # Deploy to staging
make deploy-prod     # Deploy to production
```

### Adding a New Service

1. **Create service directory**
   ```bash
   mkdir services/my-new-service
   cd services/my-new-service
   ```

2. **Initialize package.json**
   ```bash
   pnpm init
   ```

3. **Add dependencies**
   ```bash
   pnpm add @moonx/common @moonx/config
   pnpm add -D typescript @types/node
   ```

4. **Create basic structure**
   ```
   services/my-new-service/
   ├── src/
   │   ├── controllers/
   │   ├── services/
   │   ├── middleware/
   │   └── index.ts
   ├── tests/
   ├── Dockerfile
   └── package.json
   ```

5. **Update configurations**
   - Add to `turbo.json`
   - Add to `docker-compose.yml`
   - Add Kubernetes manifests

## 🚀 Deployment

### Docker Deployment

```bash
# Build images
make docker-build

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f infrastructure/kubernetes/

# Using Helm
helm install moonx-farm infrastructure/helm/moonx-farm/
```

### Production Deployment

```bash
# Deploy to staging
make deploy-staging

# Deploy to production (requires approval)
make deploy-prod
```

## 📊 Monitoring

Access monitoring dashboards:

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Kafka UI**: http://localhost:8080

## 🧪 Testing

### Running Tests

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
make test-e2e

# Performance tests
make test-performance
```

### Test Coverage

```bash
pnpm test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write unit tests for new features
- Update documentation as needed
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/moonx-farm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/moonx-farm/discussions)

## 🛣️ Roadmap

- [ ] Mobile app development
- [ ] Additional blockchain networks
- [ ] Advanced trading features
- [ ] DeFi protocol integrations
- [ ] Governance token
- [ ] Cross-chain swaps

---

**MoonXFarm DEX** - Building the future of decentralized trading 🚀 