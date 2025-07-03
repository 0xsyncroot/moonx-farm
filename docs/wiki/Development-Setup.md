# Development Setup

**Complete development environment setup guide for MoonXFarm DEX**

This guide provides detailed instructions for setting up a local development environment to contribute to MoonXFarm DEX.

## 🛠️ Prerequisites

### Required Software

Before starting, ensure you have the following installed:

| Software | Version | Download Link | Purpose |
|----------|---------|---------------|---------|
| **Node.js** | 20.x LTS | [nodejs.org](https://nodejs.org) | JavaScript runtime |
| **pnpm** | 8.x+ | [pnpm.io](https://pnpm.io) | Package manager |
| **Docker** | 24.x+ | [docker.com](https://docker.com) | Containerization |
| **Docker Compose** | 2.x+ | Included with Docker | Multi-container orchestration |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com) | Version control |
| **VSCode** | Latest | [code.visualstudio.com](https://code.visualstudio.com) | Recommended IDE |

### Operating System Support

| OS | Status | Notes |
|----|--------|-------|
| **macOS** | ✅ Fully Supported | Recommended for development |
| **Linux** | ✅ Fully Supported | Ubuntu 20.04+ recommended |
| **Windows** | ✅ Supported | WSL2 required for best experience |

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 8GB | 16GB+ |
| **Storage** | 20GB free | 50GB+ SSD |
| **CPU** | 4 cores | 8+ cores |
| **Network** | Stable internet | High-speed broadband |

## 📥 Repository Setup

### 1. Clone Repository

```bash
# Clone the main repository
git clone https://github.com/0xsyncroot/moonx-farm.git
cd moonx-farm

# Verify repository structure
ls -la
```

### 2. Install pnpm (if not installed)

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

### 3. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This will install dependencies for:
# - Root workspace
# - All apps (web, landing)
# - All services (auth, core, aggregator)
# - All packages (common, configs, infrastructure)
# - Smart contracts
```

## 🔧 Environment Configuration

### 1. Environment Variables Setup

```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env  # or use your preferred editor
```

### 2. Required Environment Variables

#### Database Configuration
```bash
# PostgreSQL Database
DATABASE_URL=postgresql://moonx_user:moonx_password@localhost:5432/moonx_farm
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=moonx_farm
DATABASE_USER=moonx_user
DATABASE_PASSWORD=moonx_password

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

#### Authentication & Security
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Privy Authentication
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_VERIFICATION_KEY=your-privy-verification-key
```

#### Account Abstraction
```bash
# ZeroDev Configuration
ZERODEV_PROJECT_ID=your-zerodev-project-id
ZERODEV_BUNDLER_RPC=https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID
ZERODEV_PAYMASTER_RPC=https://rpc.zerodev.app/api/v2/paymaster/YOUR_PROJECT_ID
```

#### Blockchain Networks
```bash
# Base Network
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_TESTNET_RPC=https://sepolia.base.org
BASE_CHAIN_ID=8453

# BSC Network
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_CHAIN_ID=56

# Ethereum Network
ETHEREUM_MAINNET_RPC=https://ethereum-rpc.publicnode.com
ETHEREUM_TESTNET_RPC=https://ethereum-sepolia-rpc.publicnode.com
ETHEREUM_CHAIN_ID=1
```

#### External API Keys
```bash
# Alchemy (Blockchain Data)
ALCHEMY_API_KEY=your-alchemy-api-key
ALCHEMY_BASE_URL=https://base-mainnet.g.alchemy.com/v2/

# LI.FI (Cross-chain)
LIFI_API_KEY=your-lifi-api-key
LIFI_API_URL=https://li.quest/v1

# 1inch (DEX Aggregation)
ONEINCH_API_KEY=your-1inch-api-key
ONEINCH_API_URL=https://api.1inch.dev/swap/v6.0

# DexScreener (Price Data)
DEXSCREENER_API_URL=https://api.dexscreener.com/latest
```

#### Smart Contract Addresses
```bash
# Diamond Contract Addresses (per network)
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x1234567890123456789012345678901234567890
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x1234567890123456789012345678901234567890
NEXT_PUBLIC_DIAMOND_CONTRACT_ETHEREUM=0x1234567890123456789012345678901234567890
```

### 3. Automated Environment Setup

Use our automated setup script:

```bash
# Run the setup script
chmod +x scripts/setup-env.sh
./scripts/setup-env.sh

# The script will:
# 1. Copy env.example to .env
# 2. Generate secure JWT secrets
# 3. Prompt for API keys
# 4. Validate configuration
# 5. Create service-specific configs
```

## 🐳 Infrastructure Setup

### 1. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and other infrastructure
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Database Setup

```bash
# Run database migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Verify database connection
pnpm db:status
```

### 3. Redis Setup

```bash
# Test Redis connection
docker exec -it moonx-redis redis-cli ping
# Expected output: PONG
```

## 🚀 Development Workflow

### 1. Start Development Servers

#### Option A: Start All Services
```bash
# Start everything in development mode
pnpm dev

# This starts:
# - Web App (http://localhost:3000)
# - Auth Service (http://localhost:3001)
# - Core Service (http://localhost:3007)
# - Aggregator Service (http://localhost:3003)
```

#### Option B: Start Individual Services
```bash
# Frontend only
pnpm dev:web

# Backend services only
pnpm dev:services

# Specific service
pnpm --filter auth-service dev
pnpm --filter core-service dev
pnpm --filter aggregator-service dev
```

### 2. Available Development Scripts

```bash
# Development
pnpm dev                    # Start all services
pnpm dev:web               # Frontend only
pnpm dev:services          # Backend services only

# Building
pnpm build                 # Build all packages
pnpm build:web            # Build web app only
pnpm build:services       # Build services only

# Testing
pnpm test                 # Run all tests
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests only
pnpm test:e2e           # End-to-end tests
pnpm test:watch         # Watch mode

# Database
pnpm db:migrate         # Run migrations
pnpm db:seed           # Seed data
pnpm db:reset          # Reset database
pnpm db:generate       # Generate migration

# Code Quality
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix linting issues
pnpm format           # Format with Prettier
pnpm type-check       # TypeScript type checking

# Smart Contracts
pnpm contracts:compile    # Compile contracts
pnpm contracts:test      # Test contracts
pnpm contracts:deploy    # Deploy to local network
```

### 3. Service Health Checks

```bash
# Check all services
curl http://localhost:3000/api/health   # Web App
curl http://localhost:3001/health       # Auth Service
curl http://localhost:3007/health       # Core Service
curl http://localhost:3003/health       # Aggregator Service
```

## 🔍 Development Tools

### 1. VSCode Extensions

Install these recommended extensions:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "ms-vscode-remote.remote-containers",
    "GitHub.copilot",
    "ms-playwright.playwright"
  ]
}
```

### 2. VSCode Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 3. Browser Development Tools

#### Recommended Chrome Extensions
- **React Developer Tools**: Debug React components
- **Redux DevTools**: Debug Redux state
- **Web3 Provider**: Test Web3 interactions
- **MetaMask**: Wallet for testing

## 🧪 Testing Setup

### 1. Unit Testing

```bash
# Run unit tests
pnpm test:unit

# Run specific test file
pnpm test packages/common/src/utils.test.ts

# Watch mode for TDD
pnpm test:unit --watch
```

### 2. Integration Testing

```bash
# Setup test database
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/moonx_test pnpm db:migrate

# Run integration tests
pnpm test:integration
```

### 3. E2E Testing

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run in headed mode
pnpm test:e2e --headed
```

### 4. Smart Contract Testing

```bash
# Test contracts
cd contracts
npx hardhat test

# Test with gas reporting
REPORT_GAS=true npx hardhat test

# Test specific contract
npx hardhat test test/MoonXFarmRouter.test.js
```

## 🐛 Debugging

### 1. Application Debugging

#### VSCode Debug Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/auth-service/src/index.ts",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### Browser Debugging
```javascript
// Enable debug logging in browser
localStorage.setItem('debug', 'moonx:*');

// View logs in console
// Debug specific modules
localStorage.setItem('debug', 'moonx:api,moonx:wallet');
```

### 2. Database Debugging

```bash
# Connect to database
psql postgresql://moonx_user:moonx_password@localhost:5432/moonx_farm

# View recent logs
docker logs moonx-postgres

# Query slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 3. Network Debugging

```bash
# Monitor API calls
curl -X GET http://localhost:3007/api/v1/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -v

# Test aggregator service
curl -X POST http://localhost:3003/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "from_token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "to_token": "0x4200000000000000000000000000000000000006",
    "amount": "1000000",
    "from_chain_id": 8453
  }'
```

## 🔧 Advanced Configuration

### 1. Custom Service Configuration

Create service-specific config files:

```typescript
// services/auth-service/.env.local
JWT_SECRET=service-specific-secret
LOG_LEVEL=debug
PORT=3001

// services/core-service/.env.local
DATABASE_POOL_SIZE=20
ALCHEMY_RETRY_COUNT=3
PORT=3007
```

### 2. Development Proxy Setup

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:3001/api/v1/:path*'
      },
      {
        source: '/api/core/:path*',
        destination: 'http://localhost:3007/api/v1/:path*'
      }
    ];
  }
};
```

### 3. Hot Reload Configuration

```bash
# Enable hot reload for services
export NODE_ENV=development
export HOT_RELOAD=true

# Start with nodemon
pnpm --filter auth-service dev:hot
```

## 📊 Performance Monitoring

### 1. Development Metrics

```bash
# Monitor service performance
pnpm dev:metrics

# View detailed metrics
open http://localhost:3001/metrics   # Auth Service
open http://localhost:3007/metrics   # Core Service
```

### 2. Memory Profiling

```bash
# Profile Node.js services
node --inspect services/auth-service/src/index.ts

# Open Chrome DevTools
# Go to chrome://inspect
```

### 3. Database Performance

```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity;

-- Check query performance
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%orders%'
ORDER BY mean_exec_time DESC;
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev:web
```

#### Database Connection Issues
```bash
# Reset database
docker-compose down
docker volume rm moonx-farm_postgres_data
docker-compose up -d
pnpm db:migrate
```

#### Permission Issues (macOS/Linux)
```bash
# Fix permission issues
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) node_modules
```

#### Windows WSL2 Issues
```bash
# Enable WSL2 integration in Docker Desktop
# Restart Docker Desktop
# Clone repository in WSL2 filesystem (/home/user/)
```

## 📚 Additional Resources

### Documentation
- **[API Reference](API-Reference)** - Complete API documentation
- **[Contributing Guide](Contributing-Guide)** - How to contribute
- **[Code Standards](Code-Standards)** - Coding conventions
- **[Architecture Guide](System-Architecture)** - System design

### External Resources
- **[Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Next.js Documentation](https://nextjs.org/docs)**
- **[Fastify Documentation](https://www.fastify.io/docs/)**

### Support
- **[Discord Developer Channel](https://discord.gg/moonxfarm-dev)**
- **[GitHub Discussions](https://github.com/0xsyncroot/moonx-farm/discussions)**
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/moonxfarm)**

---

**Ready to contribute?** Follow this setup guide, then check out our [Contributing Guide](Contributing-Guide) to learn about our development workflow and contribution process! 