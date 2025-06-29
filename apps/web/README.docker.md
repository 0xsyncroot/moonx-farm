# MoonXFarm Web App - Docker Deployment

## 🚀 Quick Start

### Build & Run Production Container

```bash
# From project root
docker build -f apps/web/Dockerfile -t moonx-web:latest .

# Run container with environment file
docker run -p 3000:3000 \
  --env-file apps/web/.env \
  --name moonx-web \
  moonx-web:latest
```

### Using Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f web
```

## ⚙️ Configuration

### Required Environment Variables

```bash
# Copy environment template
cp apps/web/.env.docker.example apps/web/.env

# Configure minimum required variables
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...
```

### Custom RPC URLs (Recommended)

```bash
# Avoid rate limiting with custom RPCs
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
NEXT_PUBLIC_BSC_RPC=https://bsc-dataseed1.binance.org
```

## 🏗️ Build Architecture

- **Multi-stage build**: Optimized for production
- **Workspace support**: Handles `@moonx/common` and `@moonx/configs` packages
- **Security**: Non-root user, minimal attack surface
- **Performance**: Next.js standalone output

## 🔍 Health Monitoring

```bash
# Health check endpoint
curl http://localhost:3000/api/health

# Manual container health check
docker exec moonx-web node healthcheck.js
```

## 🐛 Troubleshooting

### Build Issues
```bash
# Clean build
docker build --no-cache -f apps/web/Dockerfile .

# Check build logs
docker build -f apps/web/Dockerfile . --progress=plain
```

### Runtime Issues
```bash
# Check container logs
docker logs moonx-web

# Debug environment variables
docker exec moonx-web env | grep NEXT_PUBLIC_
```

---

**Features**: Account Abstraction with ZeroDev, Session Keys, Multi-chain support (Base + BSC) 