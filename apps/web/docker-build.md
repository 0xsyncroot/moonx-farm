# MoonXFarm Web App - Docker Build & Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ and Docker Compose 2.0+
- pnpm 8.0+ (for local development)
- Node.js 18+ (for local development)

### Environment Setup

1. **Copy environment template:**
```bash
cp apps/web/.env.docker.example apps/web/.env
```

2. **Configure required environment variables:**
```bash
# Minimum required configuration
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...
```

## 🐳 Build & Deploy

### Option 1: Docker Build (Production)

1. **Build the Docker image:**
```bash
# From project root
docker build -f apps/web/Dockerfile -t moonx-web:latest .
```

2. **Run the container:**
```bash
docker run -p 3000:3000 \
  --env-file apps/web/.env \
  --name moonx-web \
  moonx-web:latest
```

### Option 2: Docker Compose (Development)

1. **Build and start all services:**
```bash
docker-compose up --build
```

2. **Start in detached mode:**
```bash
docker-compose up -d
```

3. **View logs:**
```bash
docker-compose logs -f web
```

### Option 3: Development Mode

1. **Install dependencies:**
```bash
pnpm install
```

2. **Build workspace packages:**
```bash
pnpm --filter @moonx/common build
pnpm --filter @moonx/configs build
```

3. **Start development server:**
```bash
cd apps/web
pnpm dev
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | ✅ | Privy authentication app ID |
| `NEXT_PUBLIC_ZERODEV_PROJECT_ID` | ✅ | ZeroDev Account Abstraction project ID |
| `NEXT_PUBLIC_DIAMOND_CONTRACT_BASE` | ✅ | Base chain contract address |
| `NEXT_PUBLIC_DIAMOND_CONTRACT_BSC` | ✅ | BSC chain contract address |
| `NEXT_PUBLIC_BASE_RPC` | ⚠️ | Custom Base RPC URL (recommended) |
| `NEXT_PUBLIC_BSC_RPC` | ⚠️ | Custom BSC RPC URL (recommended) |

### RPC Configuration

**⚠️ Important**: Configure custom RPC URLs to avoid rate limiting:

```bash
# Alchemy (recommended)
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
NEXT_PUBLIC_BSC_RPC=https://bsc-dataseed1.binance.org

# Infura (alternative)
NEXT_PUBLIC_ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR-PROJECT-ID
```

## 🏗️ Build Process

### Multi-Stage Build Architecture

1. **Stage 1 (deps)**: Install dependencies using pnpm
2. **Stage 2 (builder)**: Build workspace packages and Next.js app
3. **Stage 3 (runner)**: Production runtime with optimized image

### Build Optimization

- **Workspace packages**: Built before main app
- **Layer caching**: Optimized for CI/CD
- **Security**: Non-root user, minimal attack surface
- **Performance**: Standalone output for faster startup

## 🔍 Health Monitoring

### Health Check Endpoint

```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-16T10:30:00.000Z",
  "service": "moonx-web",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600.5
}
```

### Docker Health Check

```bash
# Manual health check
docker exec moonx-web node healthcheck.js

# Container status
docker ps --filter name=moonx-web
```

## 🚀 Production Deployment

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: moonx-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: moonx-web
  template:
    metadata:
      labels:
        app: moonx-web
    spec:
      containers:
      - name: moonx-web
        image: moonx-web:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_PRIVY_APP_ID
          valueFrom:
            secretKeyRef:
              name: moonx-secrets
              key: privy-app-id
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Load Balancer Configuration

```nginx
upstream moonx_web {
    server web1:3000;
    server web2:3000;
    server web3:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://moonx_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check exclusion
        location /api/health {
            access_log off;
            proxy_pass http://moonx_web;
        }
    }
}
```

## 🐛 Troubleshooting

### Common Issues

**1. Build failures with workspace packages:**
```bash
# Clean and rebuild
pnpm clean
pnpm --filter @moonx/common build
pnpm --filter @moonx/configs build
docker build --no-cache -f apps/web/Dockerfile -t moonx-web .
```

**2. Environment variable not loading:**
```bash
# Check container environment
docker exec moonx-web env | grep NEXT_PUBLIC_

# Verify .env file
cat apps/web/.env | grep NEXT_PUBLIC_PRIVY_APP_ID
```

**3. Health check failures:**
```bash
# Check application logs
docker logs moonx-web

# Test health endpoint manually
curl http://localhost:3000/api/health
```

**4. Container startup issues:**
```bash
# Check container status
docker ps -a | grep moonx-web

# View detailed logs
docker logs --details moonx-web
```

### Performance Tuning

**Memory optimization:**
```bash
# Set memory limits
docker run --memory=1g --memory-swap=1g moonx-web
```

**Build optimization:**
```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build -f apps/web/Dockerfile .
```

## 📊 Monitoring

### Logs
- Application logs: `/app/logs/`
- Container logs: `docker logs moonx-web`
- Health check logs: Available in container output

### Metrics
- Health endpoint: `/api/health`
- Next.js metrics: Built-in performance monitoring
- Docker stats: `docker stats moonx-web`

## 🔐 Security

### Best Practices
- ✅ Non-root user execution
- ✅ Minimal base image (Alpine Linux)
- ✅ Multi-stage build (no build tools in production)
- ✅ Health checks for early problem detection
- ✅ Environment variable validation
- ✅ Security updates in base image

### Environment Security
- Store sensitive variables in secrets management
- Use encrypted communication (HTTPS)
- Regular security updates
- Monitor for vulnerabilities

---

**Support**: For issues or questions, refer to the main project documentation or create an issue in the repository. 