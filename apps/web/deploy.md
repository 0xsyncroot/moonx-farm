# MoonXFarm Web App - Deployment Guide

## 🚀 Quick Deploy

### 1. Build & Push Image

```bash
# From apps/web directory
./build-and-push.sh

# Or with specific version
./build-and-push.sh v1.0.0
```

### 2. Deploy with Docker Compose

```bash
# Copy environment file
cp .env.production.example .env

# Configure environment variables (required)
nano .env

# Start the application
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f moonx-web
```

## ⚙️ Configuration

### Required Environment Variables

```bash
# Authentication & Web3 (MUST configure)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id

# Smart Contract Addresses (MUST configure)
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...

# Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Recommended RPC Configuration

```bash
# For better performance and reliability
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
NEXT_PUBLIC_BSC_RPC=https://bsc-dataseed1.binance.org
```

## 🏗️ Build Process

### Local Build & Test

```bash
# Test build locally first
docker build -f Dockerfile -t moonx-web:test ../../

# Test run
docker run -p 3000:3000 --env-file .env moonx-web:test
```

### Automated Build & Push

The `build-and-push.sh` script:
1. ✅ Validates environment
2. ✅ Builds from project root (workspace support)
3. ✅ Tags with version + latest
4. ✅ Pushes to Docker Hub
5. ✅ Cleans up local images

## 📦 Available Images

```bash
# Latest version
docker pull hiepht/moonx-farm:moonx-web-latest

# Specific version
docker pull hiepht/moonx-farm:moonx-web-20250116-123000
docker pull hiepht/moonx-farm:moonx-web-v1.0.0
```

## 🔧 Docker Compose Options

### Basic Deployment

```bash
# Web app only
docker-compose up -d moonx-web
```

### With Redis (for caching)

```bash
# Web app + Redis
docker-compose --profile with-redis up -d
```

### Custom Configuration

```yaml
# Override compose settings
# docker-compose.override.yml
version: '3.8'
services:
  moonx-web:
    environment:
      - CUSTOM_VAR=value
    ports:
      - "8080:3000"  # Custom port
```

## 🔍 Monitoring & Health

### Health Check

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Docker health status
docker-compose ps
```

### Logs

```bash
# View logs
docker-compose logs -f moonx-web

# Follow specific lines
docker-compose logs -f --tail=100 moonx-web
```

### Resource Usage

```bash
# Monitor resource usage
docker stats moonx-web-app
```

## 🚀 Production Deployment

### Environment Setup

```bash
# Production server setup
scp .env production-server:/opt/moonx-web/
scp docker-compose.yml production-server:/opt/moonx-web/

# On production server
cd /opt/moonx-web
docker-compose up -d
```

### Load Balancer Configuration

```nginx
# nginx.conf
upstream moonx_web {
    server 127.0.0.1:3000;
    # Add more instances for scaling
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name app.moonxfarm.com;
    
    location / {
        proxy_pass http://moonx_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /api/health {
        proxy_pass http://moonx_web;
        access_log off;
    }
}
```

### Scaling

```bash
# Scale to multiple instances
docker-compose up -d --scale moonx-web=3

# Use different ports
# Update docker-compose.yml with port ranges: "3000-3002:3000"
```

## 🐛 Troubleshooting

### Build Issues

```bash
# Check workspace packages
ls ../../packages/

# Clean Docker build
docker builder prune
./build-and-push.sh --no-cache
```

### Runtime Issues

```bash
# Check container logs
docker-compose logs moonx-web

# Debug environment
docker-compose exec moonx-web env | grep NEXT_PUBLIC_

# Check health
curl -f http://localhost:3000/api/health || echo "Health check failed"
```

### Network Issues

```bash
# Check network connectivity
docker-compose exec moonx-web ping google.com

# Check port binding
netstat -tlnp | grep :3000
```

## 🔄 Updates & Rollback

### Update to Latest

```bash
# Pull latest image
docker-compose pull

# Restart with latest
docker-compose up -d
```

### Rollback

```bash
# Use specific version
# Edit docker-compose.yml: image: hiepht/moonx-farm:moonx-web-v1.0.0
docker-compose up -d
```

---

**Features**: Account Abstraction, Session Keys, Multi-chain Support (Base + BSC)  
**Performance**: <2s startup, Health monitoring, Graceful shutdown  
**Security**: Non-root user, Minimal attack surface, Environment validation 