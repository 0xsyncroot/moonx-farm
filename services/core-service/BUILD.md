# Core Service Production Build & Deployment

Production-ready Docker deployment cho **MoonXFarm Core Service**.

## 🏗️ Production Files

### **Created Files:**
```
services/core-service/
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Complete stack với PostgreSQL + Redis
├── .dockerignore           # Build optimization
├── env.production.template # Production environment template
└── BUILD.md               # This guide
```

## 🚀 Quick Production Deployment

### **1. Setup Environment**
```bash
cd services/core-service

# Copy production template
cp env.production.template .env

# Edit 3 critical variables:
nano .env
```

**Required Variables:**
```bash
DATABASE_PASSWORD=your-secure-password-here
JWT_SECRET=your-32-character-minimum-secret-key
ALCHEMY_API_KEY=your-alchemy-api-key-from-website
```

### **2. Deploy with Docker Compose**
```bash
# Build và start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f core-service
```

### **3. Verify Deployment**
```bash
# Health check
curl http://localhost:3007/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "up",
    "cache": "up", 
    "autoSync": "running"
  }
}
```

## 🏗️ Manual Docker Build

### **From Project Root:**
```bash
# Build Core Service image
docker build -f services/core-service/Dockerfile -t moonx/core-service .

# Run with external dependencies
docker run -d \
  --name moonx-core \
  -p 3007:3007 \
  --env-file services/core-service/.env \
  moonx/core-service
```

## 🔧 Production Architecture

### **Docker Stack:**
```yaml
# Services running in production:
┌─────────────────┐
│   Core Service  │ <- Port 3007 (API endpoints)
│   (Node.js)     │
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐ ┌───▼──┐
│ PostgreSQL│ │ Redis │ <- Dependencies
│ (DB)   │ │(Cache)│
└───────┘ └──────┘
```

### **Features Active:**
- ✅ **Order Management**: CRUD orders với execution tracking
- ✅ **Portfolio Sync**: Auto-sync từ Alchemy API (BSC + Base)
- ✅ **P&L Analytics**: Real-time với cost basis calculation  
- ✅ **Health Monitoring**: Database, Redis, Auto-sync status
- ✅ **Production Logging**: JSON format với log levels
- ✅ **Security**: Non-root user, health checks, proper CORS

## 📊 Production Monitoring

### **Health Checks:**
```bash
# Core Service health
curl http://localhost:3007/health

# Container health
docker-compose ps
docker-compose logs core-service

# Database health  
docker exec moonx-core-postgres pg_isready -U postgres

# Redis health
docker exec moonx-core-redis redis-cli ping
```

### **Resource Usage:**
```bash
# Monitor resource usage
docker stats moonx-core-service moonx-core-postgres moonx-core-redis

# Typical production usage:
# Core Service: ~100MB RAM, <5% CPU
# PostgreSQL:  ~50MB RAM, <2% CPU  
# Redis:       ~20MB RAM, <1% CPU
```

## 🔒 Production Security

### **Security Features:**
- ✅ **Non-root user** (moonx:1001)
- ✅ **Alpine Linux** base (minimal attack surface)
- ✅ **Multi-stage build** (no build tools in production)
- ✅ **Health checks** (automatic restart on failure)
- ✅ **Environment isolation** (Docker networks)
- ✅ **Secure defaults** (structured logging, CORS restrictions)

### **Recommended Security:**
```bash
# 1. Use secure passwords (32+ characters)
# 2. Restrict network access (firewall rules)
# 3. Enable database SSL in production
# 4. Use Redis AUTH in production
# 5. Set FRONTEND_URL to your domain only
```

## 🚀 Scaling & Production Tips

### **Horizontal Scaling:**
```bash
# Scale Core Service instances
docker-compose up -d --scale core-service=3

# Load balancer (nginx/haproxy) distributes requests
# Each instance connects to shared PostgreSQL + Redis
```

### **Performance Optimization:**
```bash
# Production environment variables:
DATABASE_MAX_CONNECTIONS=50    # Increase for high load
LOG_LEVEL=warn                 # Reduce logging overhead  
REDIS_PASSWORD=secure-password # Enable Redis auth
DATABASE_SSL=true              # Enable SSL for security
```

### **Backup Strategy:**
```bash
# Database backup
docker exec moonx-core-postgres pg_dump -U postgres moonx_farm > backup.sql

# Redis backup (automatic with appendonly yes)
docker exec moonx-core-redis redis-cli BGSAVE
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Health check failing` | Check environment variables, database connection |
| `Container won't start` | Verify .env file exists với required variables |
| `Database connection error` | Ensure PostgreSQL is healthy, check credentials |
| `Redis connection error` | Verify Redis container is running |
| `Build fails` | Run from project root, check Docker/pnpm versions |
| `Out of memory` | Increase Docker memory limit (4GB+) |

### **Debug Commands:**
```bash
# View container logs
docker-compose logs -f core-service

# Enter container for debugging
docker exec -it moonx-core-service sh

# Check environment inside container
docker exec moonx-core-service env | grep -E "DATABASE|REDIS|JWT|ALCHEMY"
```

---

**Result**: Production-ready Core Service với complete Docker deployment, monitoring, và security! 🚀 