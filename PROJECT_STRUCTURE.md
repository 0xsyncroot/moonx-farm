# MoonXFarm DEX - Cấu Trúc Thư Mục Toàn Diện

## Tổng Quan Kiến Trúc
Hệ thống MoonXFarm được tổ chức theo mô hình **Monorepo** với kiến trúc **Microservices**, hỗ trợ CI/CD độc lập cho từng service và khả năng mở rộng theo chiều ngang.

## Cây Thư Mục Chi Tiết

```
moonx-farm/
├── README.md                           # Tài liệu tổng quan dự án
├── .gitignore                          # Git ignore patterns
├── .github/                            # GitHub Actions workflows
│   ├── workflows/
│   │   ├── ci-contracts.yml           # CI cho smart contracts
│   │   ├── ci-backend-services.yml    # CI cho backend services
│   │   ├── ci-frontend.yml            # CI cho frontend
│   │   ├── ci-workers.yml             # CI cho async workers
│   │   └── security-scan.yml          # Security & dependency scan
│   └── templates/                      # Issue/PR templates
│
├── docs/                               # Tài liệu dự án
│   ├── architecture/                   # Kiến trúc hệ thống
│   │   ├── system-design.md
│   │   ├── api-specs/                 # OpenAPI specifications
│   │   │   ├── auth-service.yaml
│   │   │   ├── quote-service.yaml
│   │   │   ├── swap-orchestrator.yaml
│   │   │   └── wallet-registry.yaml
│   │   └── diagrams/                  # Mermaid diagrams
│   ├── deployment/                     # Deployment guides
│   ├── security/                       # Security assessments
│   └── user-guides/                    # User documentation
│
├── packages/                           # Shared packages
│   ├── common/                         # Common utilities (✅ UPDATED)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── constants/
│   │   │   │   └── index.ts           # Application constants
│   │   │   ├── types/
│   │   │   │   └── index.ts           # Shared TypeScript types
│   │   │   ├── utils/
│   │   │   │   └── index.ts           # Utility functions
│   │   │   ├── validation/             # Validation schemas
│   │   │   │   ├── api.ts             # API validation
│   │   │   │   ├── base.ts            # Base validation schemas
│   │   │   │   ├── blockchain.ts      # Blockchain validation
│   │   │   │   ├── index.ts           # Validation exports
│   │   │   │   ├── orders.ts          # Order validation
│   │   │   │   ├── trading.ts         # Trading validation
│   │   │   │   └── utils.ts           # Validation utilities
│   │   │   ├── errors.ts              # Error definitions
│   │   │   ├── logger.ts              # Centralized logging
│   │   │   └── index.ts               # Package exports
│   │   ├── tsconfig.json
│   │   └── tests/
│   ├── api-client/                     # API client SDK
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── clients/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   └── tests/
│   └── infrastructure/                 # Infrastructure managers (✅ UPDATED)
│       ├── package.json
│       ├── README.md                  # Infrastructure documentation
│       └── src/
│           ├── database.ts            # Database connection manager
│           ├── redis.ts               # Redis connection manager
│           ├── kafka.ts               # Kafka connection manager
│           └── index.ts               # Infrastructure exports
│
├── configs/                            # Centralized Configuration Management (✅ IMPLEMENTED)
│   ├── package.json                   # @moonx/configs package
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── README.md                      # Configuration documentation
│   ├── LOGGER_INTEGRATION.md         # Logger integration guide
│   ├── index.ts                       # Generic config manager with profiles
│   ├── schemas.ts                     # Zod validation schemas
│   ├── utils.ts                       # Configuration utility functions
│   ├── example.ts                     # Configuration examples
│   └── test-logger.ts                 # Logger testing utilities
│
├── contracts/                          # Smart Contracts (Diamond Proxy Pattern)
│   ├── package.json                   # Node.js dependencies & Hardhat setup
│   ├── hardhat.config.js              # Hardhat configuration với multi-network
│   ├── README.md                      # Comprehensive contracts documentation
│   ├── .env                           # Environment variables (not in repo)
│   ├── src/                           # Solidity contracts
│   │   ├── Diamond.sol                # MoonXFarmRouter (main Diamond contract)
│   │   ├── MockERC20.sol              # Test token contract
│   │   ├── interfaces/                # Contract interfaces
│   │   │   ├── IDiamondCut.sol
│   │   │   ├── IDiamondLoupe.sol
│   │   │   ├── IERC165.sol
│   │   │   └── IERC173.sol
│   │   ├── facets/                    # Diamond facets (ACTUAL IMPLEMENTATION)
│   │   │   ├── DiamondCutFacet.sol    # Upgrade functionality
│   │   │   ├── DiamondLoupeFacet.sol  # Introspection
│   │   │   ├── OwnershipFacet.sol     # Access control
│   │   │   ├── FeeCollectorFacet.sol  # Fee management
│   │   │   ├── LifiProxyFacet.sol     # LI.FI aggregator integration
│   │   │   ├── OneInchProxyFacet.sol  # 1inch aggregator integration
│   │   │   ├── RelayProxyFacet.sol    # Relay.link aggregator integration
│   │   │   ├── Test1Facet.sol         # Test facet for upgrades
│   │   │   └── Test2Facet.sol         # Test facet for upgrades
│   │   ├── helpers/                   # Helper contracts
│   │   │   ├── AggregatorProxy.sol    # Base proxy for aggregators
│   │   │   ├── ReentrancyGuard.sol    # Reentrancy protection
│   │   │   └── test/                  # Test utility contracts
│   │   │       ├── BadInit.sol        # Test initialization failure
│   │   │       ├── ComplexStorage*.sol # Diamond upgrade testing
│   │   │       ├── RecursiveInit.sol  # Recursive call testing
│   │   │       └── StorageInitializer.sol # Storage layout testing
│   │   ├── libraries/                 # Shared libraries
│   │   │   ├── LibDiamond.sol         # Diamond storage & management
│   │   │   ├── LibFeeCollector.sol    # Fee collection logic
│   │   │   ├── LibReentrancyGuard.sol # Reentrancy protection
│   │   │   ├── LibUtil.sol            # General utilities
│   │   │   └── LibBytes.sol           # Byte manipulation
│   │   ├── errors/                    # Custom error definitions
│   │   │   ├── GenericErrors.sol      # General errors
│   │   │   └── RouterErrors.sol       # Router-specific errors
│   │   ├── mocks/                     # Mock contracts for testing
│   │   │   ├── MockAggregator.sol     # Mock aggregator
│   │   │   └── MockERC20.sol          # Mock ERC20 token
│   │   └── upgradeInitializers/       # Contract upgrade initializers
│   ├── script/                        # Deployment & management scripts
│   │   ├── deploy.js                  # Main deployment script (Hardhat)
│   │   ├── deploy-and-verify.js       # Deploy with verification
│   │   ├── manageFacets.js            # Facet management
│   │   ├── add-aggregator-facets.sh   # Add aggregator facets
│   │   ├── manage-facets.sh           # Facet management shell script
│   │   ├── test-deployed.js           # Test deployed contracts
│   │   ├── test-deployed.sh           # Test deployment shell script
│   │   ├── fund-accounts.js           # Fund test accounts
│   │   ├── setup-test-tokens.js       # Setup test tokens
│   │   └── libraries/
│   │       └── diamond.js             # Diamond utilities
│   ├── test/                          # Contract tests
│   │   ├── unit/                      # Unit tests
│   │   │   └── MoonXFarmRouter.test.js # Main router tests
│   │   └── {integration}/             # Integration tests (future)
│   └── deployments/                   # Deployment artifacts
│       ├── base-mainnet/              # Base mainnet deployments
│       ├── base-testnet/              # Base testnet deployments
│       ├── bsc-mainnet/               # BSC mainnet deployments
│       └── bsc-testnet/               # BSC testnet deployments
│
├── services/                          # Core Backend Services
│   ├── api-gateway/                   # API Gateway (Nginx/Fastify)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── cors.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── validation.ts
│   │   │   ├── proxies/               # Service proxies
│   │   │   └── server.ts
│   │   ├── nginx/                     # Nginx configs
│   │   │   └── nginx.conf
│   │   └── tests/
│   │
│   ├── notify-service/                # Notification Service (Socket.IO)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── socketManager.ts
│   │   │   │   ├── notificationService.ts
│   │   │   │   ├── emailService.ts
│   │   │   │   └── pushNotificationService.ts
│   │   │   ├── events/
│   │   │   │   ├── swapEvents.ts
│   │   │   │   ├── orderEvents.ts
│   │   │   │   ├── priceEvents.ts
│   │   │   │   └── walletEvents.ts
│   │   │   ├── consumers/             # Kafka consumers
│   │   │   │   ├── swapConsumer.ts
│   │   │   │   ├── priceConsumer.ts
│   │   │   │   └── orderConsumer.ts
│   │   │   ├── models/
│   │   │   │   ├── notification.ts
│   │   │   │   └── subscription.ts
│   │   │   └── server.ts
│   │   └── tests/
│   │
│   ├── auth-service/                  # Authentication Service (✅ IMPLEMENTED)
│   │   ├── Dockerfile
│   │   ├── package.json               # Fastify v5 + modern plugins
│   │   ├── ENV_SETUP.md              # Comprehensive setup guide
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── authController.ts  # Login, refresh, verify endpoints
│   │   │   │   ├── sessionController.ts # Session management
│   │   │   │   └── userController.ts  # User profile management
│   │   │   ├── services/
│   │   │   │   ├── privyService.ts    # Privy integration with config
│   │   │   │   ├── jwtService.ts      # JWT token management
│   │   │   │   ├── databaseService.ts # Database operations
│   │   │   │   └── redisService.ts    # Redis operations
│   │   │   ├── middleware/
│   │   │   │   ├── authMiddleware.ts  # JWT validation & user context
│   │   │   │   ├── errorHandler.ts    # Global error handling
│   │   │   │   └── requestLogger.ts   # Request logging plugin
│   │   │   ├── schemas/
│   │   │   │   └── index.ts          # JSON schemas for OpenAPI
│   │   │   ├── types/
│   │   │   │   └── index.ts          # TypeScript type definitions
│   │   │   └── server.ts             # Fastify server with Swagger
│   │   └── tests/
│   │       └── unit/
│   │           └── jwtService.test.ts
│   │
│   ├── wallet-registry/               # Wallet Registry Service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── zeroDevClient.ts
│   │   │   │   ├── sessionKeyManager.ts
│   │   │   │   └── walletService.ts
│   │   │   ├── models/
│   │   │   └── server.ts
│   │   └── tests/
│   │
│   ├── quote-service/                 # Quote Service (Go) - ✅ OPTIMIZED
│   │   ├── Dockerfile
│   │   ├── go.mod                     # Go dependencies với performance optimization
│   │   ├── go.sum
│   │   ├── .env.example
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── handlers/
│   │   │   │   └── quote.go           # HTTP handlers cho quotes
│   │   │   ├── services/
│   │   │   │   ├── aggregator.go      # ✅ Multi-tier aggregation với circuit breaker
│   │   │   │   ├── lifi.go            # ✅ LiFi integration với cross-chain support
│   │   │   │   ├── oneinch.go         # ✅ 1inch integration (same-chain only)
│   │   │   │   ├── relay.go           # ✅ Relay integration với cross-chain support
│   │   │   │   ├── external.go        # External API service (DexScreener, etc.)
│   │   │   │   └── cache.go           # Redis caching với TTL optimization
│   │   │   ├── models/
│   │   │   │   └── quote.go           # ✅ Cross-chain models với ToChainID support
│   │   │   └── config/
│   │   └── tests/
│   │
│   ├── swap-orchestrator/             # Swap Orchestrator
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── userOpBuilder.ts
│   │   │   │   ├── bundlerClient.ts
│   │   │   │   ├── paymasterService.ts
│   │   │   │   └── gasEstimator.ts
│   │   │   └── server.ts
│   │   └── tests/
│   │
│   └── position-indexer/              # Position Indexer
│       ├── Dockerfile
│       ├── package.json
│       ├── .env.example
│       ├── src/
│       │   ├── indexer/
│       │   │   ├── eventListener.ts
│       │   │   └── blockProcessor.ts
│       │   ├── services/
│       │   │   ├── positionCalculator.ts
│       │   │   └── pnlTracker.ts
│       │   └── server.ts
│       └── tests/
│
├── workers/                           # Async Workers
│   ├── price-crawler/                 # Price Crawler Worker
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── .env.example
│   │   ├── cmd/
│   │   │   └── crawler/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── crawlers/
│   │   │   │   ├── binance.go
│   │   │   │   ├── dexscreener.go
│   │   │   │   └── coingecko.go
│   │   │   ├── publishers/
│   │   │   │   └── kafka.go
│   │   │   └── storage/
│   │   │       └── redis.go
│   │   └── tests/
│   │
│   └── order-executor/                # Order Executor Worker
│       ├── Dockerfile
│       ├── package.json
│       ├── .env.example
│       ├── src/
│       │   ├── executors/
│       │   │   ├── limitOrderExecutor.ts
│       │   │   └── dcaExecutor.ts
│       │   ├── services/
│       │   │   ├── orderMatcher.ts
│       │   │   └── userOpSubmitter.ts
│       │   ├── consumers/
│       │   │   └── priceTickConsumer.ts
│       │   └── worker.ts
│       └── tests/
│
├── apps/                              # Frontend Applications
│   └── web/                           # Next.js Web App
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── .env.example
│       ├── .env.local.example
│       ├── public/
│       │   ├── icons/
│       │   └── images/
│       ├── src/
│       │   ├── app/                   # Next.js App Router
│       │   │   ├── globals.css
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── swap/
│       │   │   ├── limit-orders/
│       │   │   ├── dca/
│       │   │   └── portfolio/
│       │   ├── components/
│       │   │   ├── ui/                # shadcn/ui components
│       │   │   ├── swap/
│       │   │   ├── wallet/
│       │   │   └── layout/
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useWallet.ts
│       │   │   └── useQuote.ts
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   ├── wagmi.ts
│       │   │   ├── privy.ts
│       │   │   └── utils.ts
│       │   ├── providers/
│       │   │   ├── AuthProvider.tsx
│       │   │   ├── WagmiProvider.tsx
│       │   │   └── QueryProvider.tsx
│       │   ├── store/                 # State management
│       │   │   ├── slices/
│       │   │   └── store.ts
│       │   └── types/
│       ├── tests/
│       │   ├── __mocks__/
│       │   ├── components/
│       │   └── pages/
│       └── Dockerfile
│
├── infrastructure/                    # DevOps & Infrastructure
│   ├── docker/                        # Docker configurations
│   │   ├── docker-compose.yml         # Local development
│   │   ├── docker-compose.prod.yml    # Production setup
│   │   └── environments/
│   │       ├── development.env
│   │       ├── staging.env
│   │       └── production.env
│   │
│   ├── kubernetes/                    # Kubernetes manifests
│   │   ├── namespaces/
│   │   ├── services/
│   │   │   ├── api-gateway/
│   │   │   ├── notify-service/
│   │   │   ├── auth-service/
│   │   │   ├── wallet-registry/
│   │   │   ├── quote-service/
│   │   │   ├── swap-orchestrator/
│   │   │   └── position-indexer/
│   │   ├── workers/
│   │   │   ├── price-crawler/
│   │   │   └── order-executor/
│   │   ├── databases/
│   │   │   ├── postgresql/
│   │   │   ├── redis/
│   │   │   └── kafka/
│   │   └── ingress/
│   │
│   ├── helm/                          # Helm charts
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   ├── values-staging.yaml
│   │   ├── values-production.yaml
│   │   └── templates/
│   │       ├── services/
│   │       ├── workers/
│   │       ├── configmaps/
│   │       ├── secrets/
│   │       └── ingress/
│   │
│   ├── terraform/                     # Infrastructure as Code
│   │   ├── environments/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   ├── modules/
│   │   │   ├── eks/
│   │   │   ├── rds/
│   │   │   ├── elasticache/
│   │   │   └── kafka/
│   │   └── variables.tf
│   │
│   └── monitoring/                    # Monitoring & Observability
│       ├── prometheus/
│       │   ├── prometheus.yml
│       │   └── rules/
│       ├── grafana/
│       │   ├── dashboards/
│       │   └── datasources/
│       ├── alertmanager/
│       │   └── alertmanager.yml
│       └── jaeger/
│           └── jaeger.yml
│
├── scripts/                           # Utility scripts
│   ├── setup/
│   │   ├── install-dependencies.sh
│   │   ├── setup-local-env.sh
│   │   └── generate-env-files.sh
│   ├── setup-env.sh                   # Automated environment setup script
│   ├── deployment/
│   │   ├── deploy-staging.sh
│   │   ├── deploy-production.sh
│   │   └── rollback.sh
│   ├── database/
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── backup-restore.sh
│   └── testing/
│       ├── run-integration-tests.sh
│       ├── load-test.sh
│       └── security-scan.sh
│
├── tests/                             # Integration & E2E tests
│   ├── integration/
│   │   ├── swap-flow.test.ts
│   │   ├── limit-order.test.ts
│   │   └── dca.test.ts
│   ├── e2e/
│   │   ├── playwright.config.ts
│   │   ├── swap.spec.ts
│   │   └── auth.spec.ts
│   └── performance/
│       ├── k6/
│       └── artillery/
│
├── database/                          # Database schemas & migrations (✅ PARTIAL)
│   ├── migrations/
│   │   ├── 001_create_users.sql       # User authentication tables
│   │   └── 002_create_user_sessions.sql # User session management
│   ├── seeds/
│   │   ├── test-data.sql
│   │   └── demo-data.sql
│   └── schemas/
│       ├── users.sql                  # User schema definition
│       ├── sessions.sql               # Session schema definition
│       ├── wallets.sql                # Wallet schema (future)
│       ├── orders.sql                 # Order schema (future)
│       └── positions.sql              # Position schema (future)
│
└── tools/                             # Development tools
    ├── generators/                    # Code generators
    │   ├── service-template/
    │   └── api-client-generator/
    ├── linters/
    │   ├── .eslintrc.js
    │   ├── .prettierrc
    │   └── solhint.config.js
    └── security/
        ├── audit-reports/
        └── security-checklist.md
```

## Mô Tả Chi Tiết Các Thư Mục Chính

### 1. `/contracts` - Smart Contracts (Multi-Aggregator Router)
**Mục đích**: MoonXFarmRouter - Diamond Proxy với multi-aggregator integration
- **Diamond.sol**: MoonXFarmRouter contract chính triển khai EIP-2535
- **Aggregator Facets**: LifiProxyFacet, OneInchProxyFacet, RelayProxyFacet cho liquidity aggregation
- **Core Facets**: DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet, FeeCollectorFacet
- **AggregatorProxy**: Base contract với sophisticated fee collection system
- **Libraries**: LibDiamond, LibFeeCollector, LibUtil cho shared functionality
- **Scripts**: Hardhat deployment scripts với multi-network support
- **Testing**: Unit tests với comprehensive facet testing

### 2. `/services` - Core Backend Services
**Mục đích**: Các microservices xử lý logic nghiệp vụ chính
- **api-gateway**: Cổng vào duy nhất, xử lý CORS, rate limiting, authentication
- **notify-service**: Hệ thống thông báo real-time với Socket.IO, xử lý notifications toàn hệ thống
- **auth-service**: ✅ **IMPLEMENTED** - Xác thực với Privy, quản lý JWT, Fastify v5, auto-generated OpenAPI docs
- **wallet-registry**: Quản lý AA wallets và session keys
- **quote-service**: ✅ **OPTIMIZED** - Multi-tier quote aggregation với circuit breaker, cross-chain support (LiFi, Relay), industry-standard optimization
- **swap-orchestrator**: Xây dựng và gửi UserOperations
- **position-indexer**: Theo dõi events on-chain, tính P&L

### 3. `/workers` - Async Workers
**Mục đích**: Xử lý các tác vụ bất đồng bộ
- **price-crawler**: Lấy giá từ CEX/DEX, publish vào Kafka
- **order-executor**: Lắng nghe price ticks, thực thi limit orders và DCA

### 4. `/apps/web` - Frontend
**Mục đích**: Giao diện người dùng sử dụng Next.js App Router
- Tích hợp Privy cho social login
- Sử dụng wagmi/viem cho blockchain interactions
- UI components từ shadcn/ui
- State management với Redux Toolkit

### 5. `/infrastructure` - DevOps
**Mục đích**: Cấu hình deployment và monitoring
- **kubernetes**: Manifests cho tất cả services
- **helm**: Charts cho deployment linh hoạt
- **terraform**: Infrastructure as Code
- **monitoring**: Prometheus, Grafana, AlertManager

### 6. `/packages` - Shared Libraries
**Mục đích**: Code dùng chung giữa các services
- **common**: ✅ **UPDATED** - Types, constants, utilities, validation schemas, centralized logging
- **api-client**: SDK cho internal API calls
- **infrastructure**: ✅ **UPDATED** - Infrastructure connection managers (Database, Redis, Kafka)

### 7. `/configs` - Centralized Configuration Management
**Mục đích**: ✅ **IMPLEMENTED** - Hệ thống quản lý cấu hình tập trung cho toàn bộ monorepo
- **Profile-based loading**: ✅ Mỗi service chỉ load config cần thiết với generic types
- **Type-safe validation**: ✅ Sử dụng Zod schemas cho validation
- **Environment management**: ✅ Quản lý biến môi trường từ file `.env` root
- **Utility functions**: ✅ Helper functions cho database, Redis, Kafka, JWT, v.v.
- **Configuration profiles**: ✅ `auth-service`, `quote-service`, `swap-orchestrator`, `web`, etc.

## File Cấu Hình Cần Thiết

### Root Level
- `package.json`: Workspace configuration cho monorepo
- `pnpm-workspace.yaml`: pnpm workspace configuration
- `turbo.json`: Turborepo configuration cho build optimization
- `docker-compose.yml`: Local development environment
- `env.example`: Comprehensive environment variables template (300+ variables) ✅
- `scripts/setup-env.sh`: Automated environment setup script ✅
- `tsconfig.json`: Root TypeScript configuration ✅

### Per Service
- `Dockerfile`: Container configuration
- `.env.example`: Service-specific environment variables (optional, sử dụng root env.example)
- `package.json` hoặc `go.mod`: Dependencies
- `README.md`: Service documentation

### Configuration Management
- `configs/`: Centralized configuration package với profile-based loading
- `env.example`: Comprehensive template với 300+ environment variables
- `scripts/setup-env.sh`: Automated environment setup với secure secret generation
- Configuration profiles cho từng service (auth-service, quote-service, etc.)
- Type-safe validation với Zod schemas

### CI/CD
- `.github/workflows/`: GitHub Actions workflows
- `ArgoCD` manifests trong `/infrastructure/kubernetes/`

## Gợi Ý Mở Rộng Cho Team Lớn

### 1. Multi-Repo Strategy (Khi team > 20 người)
```
moonx-farm-contracts/     # Smart contracts team
moonx-farm-backend/       # Backend services team  
moonx-farm-frontend/      # Frontend team
moonx-farm-workers/       # Data/Worker team
moonx-farm-infrastructure/ # DevOps team
```

### 2. Workspace Organization
```
packages/
├── @moonx/contracts-sdk/    # Contract interaction SDK
├── @moonx/api-types/        # Shared TypeScript types
├── @moonx/ui-components/    # Reusable UI components
├── @moonx/configs/          # Centralized configuration management
└── @moonx/dev-tools/        # Development utilities
```

### 3. Team-Specific CI/CD
- Mỗi team có workflow CI/CD riêng
- Code owners file (CODEOWNERS) cho review process
- Feature flags để deploy từng phần độc lập

## Hệ Thống Configuration Management

### Centralized Configuration với Profile-Based Loading

Thư mục `/configs` cung cấp hệ thống quản lý cấu hình tập trung với các tính năng:

#### 1. Configuration Profiles
Mỗi service có profile riêng, chỉ load config cần thiết:

```typescript
// Auth Service - chỉ cần database, Redis, JWT
import { createAuthServiceConfig } from '@moonx/configs';
const config = createAuthServiceConfig();

// Quote Service - cần Redis, external APIs, blockchain
import { createQuoteServiceConfig } from '@moonx/configs';  
const config = createQuoteServiceConfig();

// Web App - cần frontend config
import { createWebConfig } from '@moonx/configs';
const config = createWebConfig();
```

#### 2. Available Profiles
| Profile | Includes | Use Case |
|---------|----------|----------|
| `api-gateway` | Base + Services + JWT + Redis | API Gateway routing |
| `auth-service` | Base + Database + Redis + JWT | User authentication |
| `wallet-registry` | Base + Database + Blockchain | Wallet management |
| `quote-service` | Base + Redis + APIs + Blockchain | Price quotes |
| `swap-orchestrator` | Base + DB + Redis + Kafka + Blockchain + Trading | Trade execution |
| `position-indexer` | Base + DB + Redis + Kafka + Blockchain | Portfolio tracking |
| `notify-service` | Base + Redis + Kafka | Real-time notifications |
| `price-crawler` | Base + Redis + Kafka + APIs + Blockchain | Price aggregation |
| `order-executor` | Base + DB + Redis + Kafka + Blockchain + Trading | Order processing |
| `web` | Base + Frontend | Next.js frontend |
| `full` | All schemas | Development/testing |

#### 3. Utility Functions
```typescript
import { 
  getDatabaseConfig,
  getRedisConfig, 
  getKafkaConfig,
  getJwtConfig,
  getNetworkConfigs,
  getTradingConfig,
  getApiKeys 
} from '@moonx/configs';

// Lấy config cho từng service
const dbConfig = getDatabaseConfig('auth-service');
const redisConfig = getRedisConfig('quote-service');
const networks = getNetworkConfigs('swap-orchestrator');
```

#### 4. Environment Setup
```bash
# Automated setup script
./scripts/setup-env.sh

# Tạo .env từ env.example
# Generate secure JWT/session secrets
# Prompt cho database, Redis, Kafka config
# Tạo environment-specific files
```

#### 5. Type Safety & Validation
- Sử dụng Zod schemas cho validation
- Type-safe configuration objects
- Runtime validation cho required configs
- Clear error messages cho missing variables

### Configuration File Structure
```
configs/
├── index.ts          # Main config manager & profiles
├── utils.ts          # Utility functions  
├── env.ts            # Zod schemas cho validation
├── example.ts        # Usage examples
├── package.json      # @moonx/configs
├── tsconfig.json     # TypeScript config
└── README.md         # Detailed documentation
```

## Implementation Status

### ✅ Completed Components
| Component | Status | Description |
|-----------|--------|-------------|
| **configs** | ✅ IMPLEMENTED | Centralized configuration với generic types, Zod validation |
| **packages/common** | ✅ UPDATED | Validation schemas, centralized logging, utilities |
| **packages/infrastructure** | ✅ UPDATED | Database, Redis, Kafka connection managers |
| **auth-service** | ✅ IMPLEMENTED | Fastify v5, Privy integration, auto-generated OpenAPI docs |
| **quote-service** | ✅ OPTIMIZED | Multi-tier aggregation, circuit breaker, cross-chain support |
| **database/migrations** | ✅ PARTIAL | User và session tables |
| **env.example** | ✅ IMPLEMENTED | 300+ environment variables với documentation |
| **scripts/setup-env.sh** | ✅ IMPLEMENTED | Automated environment setup |

### 🚧 In Progress
- **api-gateway**: Cần implement với Fastify
- **swap-orchestrator**: Cần implement logic UserOp

### 📋 Pending
- **wallet-registry**: ZeroDev integration
- **notify-service**: Socket.IO real-time notifications
- **position-indexer**: On-chain event tracking
- **workers**: Price crawler và order executor
- **apps/web**: Next.js frontend
- **contracts**: Diamond proxy implementation

### 🔧 Technical Achievements
- ✅ **Type Safety**: Loại bỏ `as any` antipatterns, generic config types
- ✅ **Modern Stack**: Fastify v5, latest plugins, Zod validation  
- ✅ **Documentation**: Auto-generated OpenAPI specs (dev only)
- ✅ **Environment Management**: Comprehensive env setup với validation
- ✅ **Infrastructure**: Simplified, optimized connection managers
- ✅ **Logging**: Centralized logging với structured format
- ✅ **Quote Optimization**: Multi-tier aggregation (<800ms fast quotes, <3s comprehensive), circuit breaker pattern, cross-chain support
- ✅ **Performance Patterns**: Industry-standard validation (1inch/LiFi patterns), metrics-driven provider selection, intelligent caching

Cấu trúc này đảm bảo:
- ✅ **Scalability**: Mỗi service có thể scale độc lập
- ✅ **Maintainability**: Code tổ chức rõ ràng theo domain
- ✅ **Configuration Management**: Tập trung, type-safe, profile-based
- ✅ **CI/CD**: Pipeline tối ưu cho từng component
- ✅ **Security**: Tách biệt secrets và permissions
- ✅ **Monitoring**: Observability toàn diện
