# Getting Started with MoonXFarm DEX

**Quick setup guide for developers and users**

This guide will help you get started with MoonXFarm DEX, whether you're a developer looking to contribute or a user wanting to understand the platform.

## 🎯 For Users

### What is MoonXFarm DEX?

MoonXFarm is a next-generation decentralized exchange that makes DeFi trading as simple as traditional finance:

- **No Seed Phrases**: Login with Google, Twitter, or Apple
- **Gasless Trading**: First 10 transactions completely free
- **AI Assistant**: Get help from Lili, our intelligent trading assistant
- **Cross-Chain Trading**: Swap assets across multiple blockchains
- **Advanced Orders**: Set limit orders and dollar-cost averaging strategies

### Quick Start for Users

1. **Visit the Platform**: Go to [app.moonx.farm](https://app.moonx.farm)
2. **Connect Your Account**: Use social login (no wallet needed)
3. **Get Your Smart Wallet**: Automatically created with Account Abstraction
4. **Start Trading**: Begin with gasless transactions
5. **Meet Lili**: Chat with our AI assistant for guidance

### First Trade Tutorial

1. **Login**: Click "Connect Wallet" and choose social login
2. **Fund Your Wallet**: Transfer crypto or use fiat on-ramp
3. **Select Tokens**: Choose tokens to swap
4. **Get Quote**: See multiple quotes from aggregators
5. **Execute Trade**: Confirm transaction (gasless for first 10)
6. **Track Performance**: View your portfolio and P&L

## 🔧 For Developers

### Prerequisites

Before you begin, ensure you have:

- **Node.js 20+**: JavaScript runtime
- **pnpm**: Package manager for workspaces
- **Docker**: Container runtime environment
- **Git**: Version control system

### Quick Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/0xsyncroot/moonx-farm.git
cd moonx-farm

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp env.example .env
# Edit .env with your configuration

# 4. Start infrastructure
docker-compose up -d

# 5. Run migrations
pnpm db:migrate

# 6. Start development server
pnpm dev
```

### Environment Configuration

#### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_farm
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-key-here
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret

# Account Abstraction
ZERODEV_PROJECT_ID=your-zerodev-project-id
ZERODEV_BUNDLER_RPC=your-bundler-endpoint
ZERODEV_PAYMASTER_RPC=your-paymaster-endpoint

# Blockchain Networks
BASE_MAINNET_RPC=https://mainnet.base.org
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org

# External APIs
ALCHEMY_API_KEY=your-alchemy-api-key
LIFI_API_KEY=your-lifi-api-key
```

#### Getting API Keys

1. **Privy**: Sign up at [privy.io](https://privy.io) for social authentication
2. **ZeroDev**: Register at [zerodev.app](https://zerodev.app) for Account Abstraction
3. **Alchemy**: Get API key from [alchemy.com](https://alchemy.com) for blockchain data
4. **LI.FI**: Request API access at [li.fi](https://li.fi) for cross-chain routing

### Development Workflow

#### Running Services

```bash
# Start all services
pnpm dev

# Start specific services
pnpm dev:web        # Frontend only
pnpm dev:services   # Backend services only

# Check service health
curl http://localhost:3000/api/health
curl http://localhost:3001/health
curl http://localhost:3003/health
```

#### Available Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **Web App** | 3000 | http://localhost:3000 | Frontend application |
| **Auth Service** | 3001 | http://localhost:3001 | Authentication API |
| **Core Service** | 3007 | http://localhost:3007 | Orders & Portfolio API |
| **Aggregator** | 3003 | http://localhost:3003 | Quote aggregation API |

#### Database Operations

```bash
# Run migrations
pnpm db:migrate

# Seed test data
pnpm db:seed

# Reset database
pnpm db:reset

# Generate migration
pnpm db:generate "add_new_table"
```

#### Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit           # Unit tests
pnpm test:integration    # Integration tests
pnpm test:contracts      # Smart contract tests

# Watch mode for development
pnpm test:watch
```

## 🏗️ Architecture Overview

### High-Level Components

```
Frontend (Next.js 14)
    ↓
Backend Services (Node.js + TypeScript)
    ↓
Smart Contracts (Solidity + Diamond Proxy)
    ↓
External Integrations (Privy, ZeroDev, Alchemy)
```

### Key Technologies

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, wagmi
- **Backend**: Node.js, Fastify, PostgreSQL, Redis
- **Blockchain**: Solidity, Hardhat, Diamond Proxy Pattern
- **Infrastructure**: Docker, pnpm Workspaces, Turborepo

## 📚 Next Steps

### For Users
- **[User Guide](User-Guide)** - Detailed platform usage
- **[Trading Tutorial](Trading-Tutorial)** - Advanced trading features
- **[AI Assistant Guide](AI-Assistant)** - Working with Lili
- **[FAQ](FAQ)** - Common questions

### For Developers
- **[Development Setup](Development-Setup)** - Detailed setup guide
- **[API Reference](API-Reference)** - Complete API documentation
- **[Contributing Guide](Contributing-Guide)** - How to contribute
- **[Code Standards](Code-Standards)** - Coding conventions

### Architecture Deep Dive
- **[System Architecture](System-Architecture)** - Detailed system design
- **[Microservices Overview](Microservices-Overview)** - Service architecture
- **[Smart Contracts](Smart-Contracts)** - Blockchain infrastructure
- **[Database Schema](Database-Schema)** - Data models

## 🆘 Getting Help

### Community Support
- **[Discord Server](https://discord.gg/moonxfarm)** - Real-time chat support
- **[GitHub Discussions](https://github.com/0xsyncroot/moonx-farm/discussions)** - Community Q&A
- **[GitHub Issues](https://github.com/0xsyncroot/moonx-farm/issues)** - Bug reports

### Documentation
- **[Troubleshooting](Troubleshooting)** - Common issues and solutions
- **[FAQ](FAQ)** - Frequently asked questions
- **[Support Channels](Support-Channels)** - How to get help

---

**Ready to start?** Choose your path above and dive into the world of next-generation DeFi trading! 