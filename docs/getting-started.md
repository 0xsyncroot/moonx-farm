# Getting Started with MoonXFarm DEX

**Welcome to MoonXFarm DEX!** This guide will help you get up and running with our Account Abstraction-powered decentralized exchange in just 5 minutes.

## 🎯 What is MoonXFarm DEX?

MoonXFarm is a next-generation DEX with **Account Abstraction** integration, offering:
- 🔑 **Gasless Trading**: First 10 transactions completely free
- 📱 **Social Login**: No seed phrases needed (Google/Twitter/Apple)
- ⚡ **Fast Quotes**: Sub-second response times across multiple aggregators
- 🔒 **Session Keys**: Automated trading with smart wallet delegation
- 🌐 **Multi-chain**: Base + BSC support with seamless switching

## 🚀 Quick Start (5 Minutes)

### For Users

1. **Visit the Platform**
   ```
   https://app.moonxfarm.com
   ```

2. **Connect with Social Login**
   - Click "Connect Wallet"
   - Choose your preferred method: Google, Twitter, or Apple
   - Complete OAuth flow (30 seconds)
   - Your AA wallet is automatically created! 🎉

3. **Make Your First Trade**
   - Select tokens to swap (ETH → USDC recommended)
   - Enter amount
   - See "0 gas fees" badge
   - Click "Swap" and sign once for session key
   - Trade executes in ~3 seconds ⚡

4. **Explore Advanced Features**
   - Set up limit orders
   - Create DCA strategies
   - View portfolio P&L
   - Manage session keys

### For Developers

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/moonx-farm.git
   cd moonx-farm
   ```

2. **Environment Setup**
   ```bash
   # Install dependencies
   pnpm install
   
   # Setup environment
   cp env.example .env
   ./scripts/setup-env.sh
   ```

3. **Start Development**
   ```bash
   # Start infrastructure
   docker-compose up -d
   
   # Run migrations
   npm run db:migrate
   
   # Start all services
   pnpm dev
   ```

4. **Access Services**
   - Frontend: http://localhost:3000
   - Core Service: http://localhost:3007
   - Auth Service: http://localhost:3001
   - Aggregator Service: http://localhost:3003

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "User Experience"
        USER[User]
        WEB[Next.js App<br/>Social Login]
    end
    
    subgraph "Account Abstraction"
        PRIVY[Privy Auth]
        ZERODEV[ZeroDev AA]
        SESSION[Session Keys]
    end
    
    subgraph "Backend Services"
        CORE[Core Service<br/>Orders + Portfolio]
        AUTH[Auth Service<br/>JWT]
        AGG[Aggregator<br/>Quotes]
    end
    
    subgraph "Blockchain"
        DIAMOND[Diamond Router<br/>Smart Contracts]
    end
    
    USER --> WEB
    WEB --> PRIVY
    WEB --> ZERODEV
    WEB --> SESSION
    WEB --> CORE
    WEB --> AUTH
    WEB --> AGG
    ZERODEV --> DIAMOND
```

## 🔑 Key Concepts

### Account Abstraction
- **Smart Wallets**: No seed phrases, social recovery
- **Gasless UX**: Sponsored transactions via paymaster
- **Session Keys**: Automated trading permissions
- **Multi-chain**: Seamless chain switching

### Session Keys
```typescript
// Generate session key for automated trading
const sessionKey = await generateSessionKey({
  duration: 30 * 24 * 60 * 60, // 30 days
  permissions: {
    contracts: [DIAMOND_CONTRACT_ADDRESS],
    methods: ['callLifi', 'callOneInch', 'approve'],
    maxAmount: parseEther('1') // 1 ETH limit
  }
});
```

### Trading Features
- **Swap**: Instant trades with best prices
- **Limit Orders**: Execute at target prices
- **DCA**: Dollar-cost averaging automation
- **Portfolio**: Real-time P&L tracking

## 🛠️ Development Paths

### Frontend Development
```bash
cd apps/web
npm run dev
```
- Next.js 14+ with App Router
- ZeroDev SDK v5.4+ integration
- Privy authentication
- shadcn/ui components

### Backend Development
```bash
cd services/core-service
npm run dev
```
- Fastify v5 framework
- @moonx-farm/configs integration
- PostgreSQL + Redis
- OpenAPI documentation

### Smart Contract Development
```bash
cd contracts
npx hardhat compile
npx hardhat test
```
- Diamond Proxy pattern (EIP-2535)
- Multi-aggregator integration
- Hardhat deployment scripts

## 📊 Service Endpoints

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Frontend** | 3000 | User interface | ✅ Production Ready |
| **Core Service** | 3007 | Order management, portfolio | ✅ Production Ready |
| **Auth Service** | 3001 | Authentication | ✅ Production Ready |
| **Aggregator** | 3003 | Price quotes | ✅ Production Ready |

## 🔧 Configuration

### Required Environment Variables

```bash
# Authentication
PRIVY_APP_ID=your-privy-app-id
JWT_SECRET=your-jwt-secret

# ZeroDev Account Abstraction
ZERODEV_PROJECT_ID=your-zerodev-project-id
ZERODEV_BUNDLER_RPC=your-bundler-url
ZERODEV_PAYMASTER_RPC=your-paymaster-url

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/moonx_farm
REDIS_URL=redis://localhost:6379

# Blockchain Networks
BASE_MAINNET_RPC=https://mainnet.base.org
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org

# Smart Contracts
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...

# External APIs
ALCHEMY_API_KEY=your-alchemy-key
LIFI_API_KEY=your-lifi-key
```

## 🚦 Health Checks

### Service Health
```bash
# Check all services
curl http://localhost:3007/api/v1/health  # Core Service
curl http://localhost:3001/health         # Auth Service
curl http://localhost:3003/health         # Aggregator Service
```

### Database Health
```bash
# Test database connection
npm run db:health

# Check Redis
redis-cli ping
```

## 🧪 Testing

### Quick Test
```bash
# Run all tests
pnpm test

# Test specific service
cd services/core-service && npm test
```

### Integration Test
```bash
# Test swap flow end-to-end
npm run test:integration:swap

# Test order management
npm run test:integration:orders
```

## 📚 Next Steps

1. **[Architecture Deep Dive](architecture/system-overview.md)** - Understand the system design
2. **[API Documentation](api/overview.md)** - Integrate with our APIs
3. **[Frontend Development](development/frontend.md)** - Build UI components
4. **[Smart Contracts](architecture/smart-contracts.md)** - Understand contract interactions
5. **[Deployment Guide](deployment/production.md)** - Deploy to production

## 🆘 Common Issues

### Development Issues

**Issue**: Services won't start
```bash
# Solution: Reset environment
docker-compose down
docker-compose up -d
npm run db:migrate
```

**Issue**: Frontend can't connect to backend
```bash
# Solution: Check environment variables
grep -E "(API_URL|PRIVY|ZERODEV)" .env
```

**Issue**: Database connection failed
```bash
# Solution: Verify PostgreSQL is running
docker ps | grep postgres
```

### User Issues

**Issue**: Can't connect wallet
- Ensure social login popup isn't blocked
- Check network connection
- Try different OAuth provider

**Issue**: Transaction fails
- Check account has sufficient balance
- Verify network selection (Base/BSC)
- Try refreshing session key

## 📞 Support

- **Documentation**: This docs site
- **Issues**: [GitHub Issues](https://github.com/your-org/moonx-farm/issues)
- **Discord**: [MoonXFarm Community](https://discord.gg/moonxfarm)
- **Email**: support@moonxfarm.com

---

**Ready to start building the future of DeFi? Let's go! 🚀** 