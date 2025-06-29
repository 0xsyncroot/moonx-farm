# Core Service Environment Setup Guide

Hướng dẫn thiết lập environment variables cho **MoonXFarm Core Service**.

**Based on actual code analysis**: Core Service chỉ cần **3 variables bắt buộc** và không sử dụng external price APIs (dùng mock prices).

## 🚀 Quick Start

1. **Copy environment template:**
   ```bash
   cp env.example .env
   ```

2. **Configure 3 critical variables:**
   ```bash
   nano .env
   ```

## 📋 Required Variables (Only 3!)

### **Critical (Must Configure)**
```bash
# 1. Database password (for PostgreSQL connection)
DATABASE_PASSWORD=your-postgres-password

# 2. JWT Secret (minimum 32 characters for auth)  
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters

# 3. Alchemy API Key (portfolio sync BSC + Base chains only)
ALCHEMY_API_KEY=your-alchemy-api-key
```

### **NOT NEEDED (Redis runs without auth by default)**
```bash
# Redis password only needed if you configure auth
# REDIS_PASSWORD=your-redis-password-if-configured
```

### **Pre-configured (No changes needed)**
```bash
# @moonx/configs provides defaults for these:
CORE_SERVICE_PORT=3007          # Default from ServicesConfigSchema
CORE_SERVICE_HOST=0.0.0.0       # Default from ServicesConfigSchema  
DATABASE_HOST=localhost         # Default from DatabaseConfigSchema
DATABASE_PORT=5432              # Default from DatabaseConfigSchema
REDIS_HOST=localhost            # Default from RedisConfigSchema
REDIS_PORT=6379                 # Default from RedisConfigSchema
NODE_ENV=development            # Default from BaseConfigSchema
LOG_LEVEL=info                  # Default from LoggerConfigSchema
```

## 🔑 Getting API Keys

### **Alchemy API Key (Only Required API)**
- Visit: https://www.alchemy.com/
- Create account và get API key  
- **Free tier: 300M requests/month** - more than enough for development
- Core Service only uses: BSC + Base chains (AlchemyService line 57-60)

### **❌ NOT USED by Core Service** 
Code analysis shows these APIs are **NOT called** in Core Service:
```bash
# getTokenPrices() uses MOCK PRICES (line 251-291)
# External price APIs are NOT implemented:
# ❌ COINGECKO_API_KEY      - Available in configs but unused
# ❌ COINMARKETCAP_API_KEY  - Available in configs but unused  
# ❌ DEXSCREENER_API_KEY    - Web app uses this, Core Service doesn't
# ❌ ONE_INCH_API_KEY       - Available in configs but unused
# ❌ PARASWAP_API_KEY       - Available in configs but unused
# ❌ INFURA_API_KEY         - Available in configs but unused
# ❌ QUICKNODE_API_KEY      - Available in configs but unused
```

**Result**: Chỉ cần 1 API key duy nhất để tránh giới hạn không cần thiết!

## 🗄️ Database Setup (PostgreSQL)

Core Service sử dụng `getDatabaseConfig('core-service')` từ `@moonx/configs`.

### **Quick Setup**
```bash
# Create database (only thing you need to do)
createdb moonx_farm

# Set password in .env
DATABASE_PASSWORD=your-password
```

**All other database settings have defaults** từ DatabaseConfigSchema.

## 🔴 Redis Setup

Core Service sử dụng `getRedisConfig('core-service')` từ `@moonx/configs`.

### **Quick Setup**
```bash
# Install Redis (Ubuntu/Debian)
sudo apt install redis-server
sudo systemctl start redis-server

# No password needed for local development
# Redis config uses defaults from RedisConfigSchema
```

## 🚀 Production vs Development

### **Development (Default)**
```bash
NODE_ENV=development            # Enables Swagger docs at /docs
LOG_LEVEL=info                  # Console logging
LOG_FORMAT=console              # Pretty logs  
```

### **Production**  
```bash
NODE_ENV=production            # Disables Swagger docs
LOG_LEVEL=warn                 # Less verbose
LOG_FORMAT=json                # Structured logs
DATABASE_SSL=true              # Enable SSL for DB
CORS_ORIGIN=https://yourdomain.com  # Restrict CORS
```

## 🔒 Security Notes

- **JWT_SECRET**: Must be minimum 32 characters (enforced by JwtConfigSchema)
- **ALCHEMY_API_KEY**: Keep secure, has rate limits
- **DATABASE_PASSWORD**: Use strong password in production  
- **Redis**: No auth needed for development, add password for production

## 🔍 Testing & Health Checks

### **Quick Tests**
```bash
# 1. Health check (no auth required)
curl http://localhost:3007/health

# 2. API documentation (development only)
open http://localhost:3007/docs

# 3. Check Core Service logs
npm run dev  # Watch console for any errors
```

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `Database connection failed` | Check `DATABASE_PASSWORD` in .env |
| `Redis connection refused` | Run `sudo systemctl start redis-server` |
| `JWT token invalid` | Ensure `JWT_SECRET` is 32+ characters |
| `Alchemy API errors` | Verify `ALCHEMY_API_KEY` is correct |
| `Auth middleware fails` | Check Auth Service is running on port 3001 |

### **Debug Commands**
```bash
# Check services are running
sudo systemctl status postgresql redis-server

# Test database connection
psql -U postgres -d moonx_farm -c "SELECT NOW();"

# Test Redis
redis-cli ping

# Check environment variables
echo $JWT_SECRET | wc -c  # Should be > 32
```

## 🎯 Next Steps

**Simplified setup (only 3 variables + infrastructure)**:

```bash
# 1. Setup infrastructure  
createdb moonx_farm
sudo systemctl start redis-server

# 2. Configure Core Service
cd services/core-service
cp env.example .env

# 3. Edit 3 variables in .env:
# DATABASE_PASSWORD=your-password
# JWT_SECRET=32-char-minimum-secret  
# ALCHEMY_API_KEY=your-key

# 4. Start Core Service
npm install
npm run dev

# 5. Test (should return healthy status)
curl http://localhost:3007/health
```

---

**Result**: Core Service setup với **ZERO external API limits** (chỉ dùng Alchemy free tier 300M requests/month)! 🚀 