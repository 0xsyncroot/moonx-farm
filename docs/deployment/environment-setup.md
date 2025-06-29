# Environment Setup - MoonXFarm DEX

**Status**: Production Ready  
**Last Updated**: January 2025

## 🎯 Quick Setup

### Automated Setup (Recommended)
```bash
# Clone repository
git clone https://github.com/your-org/moonx-farm.git
cd moonx-farm

# Install dependencies
pnpm install

# Setup environment
cp env.example .env
./scripts/setup-env.sh

# Start development
docker-compose up -d
npm run db:migrate
pnpm dev
```

## 🔧 Environment Variables

### Required Variables

```bash
# Authentication & Session
PRIVY_APP_ID=your-privy-app-id
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret

# ZeroDev Account Abstraction
ZERODEV_PROJECT_ID=your-zerodev-project-id
ZERODEV_BUNDLER_RPC=your-zerodev-bundler-url
ZERODEV_PAYMASTER_RPC=your-zerodev-paymaster-url

# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/moonx_farm
REDIS_URL=redis://localhost:6379

# Blockchain Networks
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_TESTNET_RPC=https://sepolia.base.org
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545

# Smart Contract Addresses
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...

# External APIs
ALCHEMY_API_KEY=your-alchemy-api-key
LIFI_API_KEY=your-lifi-api-key
ONEINCH_API_KEY=your-1inch-api-key

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
NEXT_PUBLIC_CORE_API_URL=http://localhost:3007
NEXT_PUBLIC_AGGREGATOR_API_URL=http://localhost:3003
```

## 🐳 Docker Development

### Start Services
```bash
# Start infrastructure
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### Service Ports
| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Core Service | 3007 | http://localhost:3007 |
| Auth Service | 3001 | http://localhost:3001 |
| Aggregator | 3003 | http://localhost:3003 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

## 📊 Database Setup

### Migrations
```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
npm run db:reset
```

### Database Schema
- ✅ Users & Sessions
- ✅ Orders & Executions  
- ✅ Portfolio & Trades
- ✅ Optimized Indexes

## 🚀 Production Environment

### Environment Variables
```bash
# Production overrides
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:prod-pass@prod-host:5432/moonx_farm_prod
REDIS_URL=redis://prod-redis:6379

# Security
JWT_SECRET=super-secure-production-secret
SESSION_SECRET=super-secure-session-secret

# API URLs
NEXT_PUBLIC_APP_URL=https://app.moonxfarm.com
NEXT_PUBLIC_AUTH_API_URL=https://auth-api.moonxfarm.com
NEXT_PUBLIC_CORE_API_URL=https://core-api.moonxfarm.com
NEXT_PUBLIC_AGGREGATOR_API_URL=https://aggregator-api.moonxfarm.com
```

### Health Checks
```bash
# Service health
curl http://localhost:3007/api/v1/health
curl http://localhost:3001/health
curl http://localhost:3003/health

# Database health
npm run db:health

# Redis health
redis-cli ping
```

## 🔒 Security Setup

### Secrets Management
- Use environment variables for all secrets
- Rotate JWT secrets regularly
- Use secure random generation for session secrets
- Never commit secrets to version control

### API Keys
- ZeroDev: Account Abstraction services
- Privy: Social authentication
- Alchemy: Blockchain data across 5 chains
- LI.FI: Cross-chain aggregation
- 1inch: Same-chain aggregation

## 🧪 Testing Environment

### Test Configuration
```bash
# Test database
DATABASE_URL=postgresql://test-user:test-pass@localhost:5432/moonx_farm_test

# Test Redis
REDIS_URL=redis://localhost:6380

# Test mode
NODE_ENV=test
```

### Run Tests
```bash
# All tests
pnpm test

# Service-specific tests
cd services/core-service && npm test
cd services/auth-service && npm test
```

## 📋 Troubleshooting

### Common Issues

**Services won't start**
```bash
# Reset Docker environment
docker-compose down
docker system prune -f
docker-compose up -d
```

**Database connection failed**
```bash
# Check PostgreSQL
docker ps | grep postgres
docker logs moonx-farm-postgres
```

**Redis connection failed**
```bash
# Check Redis
docker ps | grep redis
redis-cli ping
```

**Frontend can't connect to backend**
```bash
# Check environment variables
grep -E "(API_URL|PRIVY|ZERODEV)" .env
```

### Logs
```bash
# Service logs
docker-compose logs core-service
docker-compose logs auth-service
docker-compose logs aggregator-service

# Application logs
tail -f logs/application.log
```

---

**Complete environment setup for MoonXFarm DEX development and production deployment.** 