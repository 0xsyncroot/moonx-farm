# Configuration Guide - Stats Worker Service

## 📋 Tổng Quan

Stats Worker Service là **pure background worker** thu thập stats blockchain performance, không có HTTP server.

## 🔧 Cấu Hình Cần Thiết

### 1. Environment Variables

#### **Core Configuration**
```bash
# Service Identity
NODE_ENV=production                    # development/staging/production
SERVICE_NAME=stats-worker
SERVICE_VERSION=1.0.0

# No PORT needed - Pure background worker
```

#### **Cluster Configuration**
```bash
# Cluster Mode (recommended for production)
CLUSTER_MODE=true                      # Enable cluster mode
CLUSTER_WORKERS=2                      # Number of worker processes (0 = auto)
WORKER_RESTART_THRESHOLD=5             # Max restarts per worker
```

#### **Database Configuration**
```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/moonx-farm
MONGODB_DATABASE=moonx-farm
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=1
MONGODB_ENABLE_METRICS=true
```

#### **Message Queue Configuration**
```bash
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=stats-worker
KAFKA_GROUP_ID=stats-worker-group
KAFKA_TOPIC_EVENTS=moonx.ws.events
```

#### **Blockchain Configuration**
```bash
# Alchemy API Key (REQUIRED)
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Chain RPC URLs
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Enabled Chains
ENABLED_CHAINS=base,bsc,ethereum,polygon,arbitrum,optimism

# Chain Logo URLs (Optional - uses reliable CDN defaults if not provided)
BASE_LOGO_URL=https://your-cdn.com/base.png          # Optional custom logo URL
BSC_LOGO_URL=https://your-cdn.com/bsc.png            # Optional custom logo URL  
ETHEREUM_LOGO_URL=https://your-cdn.com/eth.png       # Optional custom logo URL
POLYGON_LOGO_URL=https://your-cdn.com/matic.png      # Optional custom logo URL
ARBITRUM_LOGO_URL=https://your-cdn.com/arbitrum.png  # Optional custom logo URL
OPTIMISM_LOGO_URL=https://your-cdn.com/optimism.png  # Optional custom logo URL
```

#### **External API Configuration**
```bash
# DeFi Data APIs
DEFILLAMA_API_URL=https://api.llama.fi
LIFI_API_URL=https://li.quest/v1
RELAY_API_URL=https://api.relay.link
```

#### **Job Scheduling**
```bash
# Production Intervals (cron format)
STATS_COLLECTION_INTERVAL=0 */5 * * * *     # Every 5 minutes
CHAIN_PERFORMANCE_INTERVAL=0 */1 * * * *    # Every 1 minute
BRIDGE_LATENCY_INTERVAL=0 */2 * * * *       # Every 2 minutes

# Development Intervals (for testing)
# STATS_COLLECTION_INTERVAL=*/30 * * * * *   # Every 30 seconds
# CHAIN_PERFORMANCE_INTERVAL=*/15 * * * * *  # Every 15 seconds
# BRIDGE_LATENCY_INTERVAL=*/20 * * * * *     # Every 20 seconds
```

#### **Logging Configuration**
```bash
# Logging
LOG_LEVEL=info                          # error/warn/info/debug/trace
LOG_FORMAT=json                         # json/text/pretty
LOG_OUTPUT=console                      # console/file/both
```

## 🚀 Quick Setup

### Option 1: Automated Setup
```bash
# Clone và chạy setup script
cd workers/stats-worker
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Option 2: Manual Setup
```bash
# Copy template và chỉnh sửa
cp env.template .env
nano .env

# Cấu hình tối thiểu cần thiết:
# 1. ALCHEMY_API_KEY
# 2. MONGODB_URI
# 3. KAFKA_BROKERS
```

## 🐳 Docker Configuration

### Docker Compose (Recommended)
```yaml
# docker-compose.yml
version: '3.8'

services:
  stats-worker:
    build: .
    environment:
      - NODE_ENV=production
      - CLUSTER_MODE=true
      - CLUSTER_WORKERS=2
      - ALCHEMY_API_KEY=${ALCHEMY_API_KEY}
      - MONGODB_URI=mongodb://mongodb:27017/moonx-farm
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - mongodb
      - kafka
    volumes:
      - ./logs:/app/logs
```

### Environment File
```bash
# .env.docker
ALCHEMY_API_KEY=your_api_key_here
MONGODB_ROOT_PASSWORD=secure_password
```

## 🔍 Environment-Specific Configuration

### **Development Environment**
```bash
NODE_ENV=development
CLUSTER_MODE=false
LOG_LEVEL=debug
LOG_FORMAT=pretty

# Faster intervals for testing
STATS_COLLECTION_INTERVAL=*/30 * * * * *
CHAIN_PERFORMANCE_INTERVAL=*/15 * * * * *
BRIDGE_LATENCY_INTERVAL=*/20 * * * * *
```

### **Staging Environment**
```bash
NODE_ENV=staging
CLUSTER_MODE=true
CLUSTER_WORKERS=2
LOG_LEVEL=info

# Moderate intervals
STATS_COLLECTION_INTERVAL=0 */2 * * * *
CHAIN_PERFORMANCE_INTERVAL=0 */1 * * * *
BRIDGE_LATENCY_INTERVAL=0 */1 * * * *
```

### **Production Environment**
```bash
NODE_ENV=production
CLUSTER_MODE=true
CLUSTER_WORKERS=4
LOG_LEVEL=warn

# Optimal intervals
STATS_COLLECTION_INTERVAL=0 */5 * * * *
CHAIN_PERFORMANCE_INTERVAL=0 */1 * * * *
BRIDGE_LATENCY_INTERVAL=0 */2 * * * *
```

## 🎯 Performance Tuning

### **High-Load Configuration**
```bash
# MongoDB Optimization
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=5

# Kafka Optimization
KAFKA_RETRY_ATTEMPTS=5
KAFKA_REQUEST_TIMEOUT=30000

# Job Configuration
MAX_CONCURRENT_COLLECTIONS=1
COLLECTION_QUEUE_SIZE=10
```

### **Memory Optimization**
```bash
# Memory Limits
MAX_MEMORY_USAGE=512                    # MB
MEMORY_WARNING_THRESHOLD=0.8           # 80%
MEMORY_CRITICAL_THRESHOLD=0.9          # 90%
```

### **Timeout Configuration**
```bash
# Job Timeouts
STATS_COLLECTION_TIMEOUT=120000         # 2 minutes
CHAIN_PERFORMANCE_TIMEOUT=60000         # 1 minute
BRIDGE_LATENCY_TIMEOUT=90000            # 1.5 minutes
```

## 📊 Monitoring Configuration

### **Health Checks**
```bash
# Health Check Intervals
HEALTH_CHECK_INTERVAL=60000             # 1 minute
WORKER_HEALTH_CHECK_INTERVAL=30000      # 30 seconds

# Health Thresholds
HEALTH_CHECK_FAILURE_THRESHOLD=3        # Consecutive failures
HEALTH_CHECK_SUCCESS_THRESHOLD=2        # Consecutive successes
```

### **Performance Thresholds**
```bash
# Chain Performance Thresholds
CHAIN_HEALTHY_BLOCK_TIME=3              # <= 3s = healthy
CHAIN_DEGRADED_BLOCK_TIME=10            # <= 10s = degraded

# Bridge Latency Thresholds
BRIDGE_HEALTHY_LATENCY=1000             # <= 1s = healthy
BRIDGE_DEGRADED_LATENCY=3000            # <= 3s = degraded
```

## 🔐 Security Configuration

### **API Security**
```bash
# Request Limits
MAX_REQUEST_SIZE=1048576                # 1MB
REQUEST_TIMEOUT=30000                   # 30 seconds

# Rate Limiting
API_RATE_LIMIT_RPM=60                   # Requests per minute
API_RATE_LIMIT_BURST=10                 # Burst requests
```

### **Process Security**
```bash
# Resource Limits
MAX_CPU_USAGE=80                        # Percentage
RESTART_ON_ERROR=true
MAX_RESTART_ATTEMPTS=5
```

## 🛠️ Validation

### **Required Variables**
```bash
# These variables MUST be set:
✅ ALCHEMY_API_KEY
✅ MONGODB_URI
✅ KAFKA_BROKERS
```

### **Validation Script**
```bash
#!/bin/bash
# Validate configuration
./scripts/validate-config.sh
```

## 🚨 Common Issues & Solutions

### **1. MongoDB Connection Issues**
```bash
# Check MongoDB is running
docker ps | grep mongo

# Test connection
mongosh $MONGODB_URI
```

### **2. Kafka Connection Issues**
```bash
# Check Kafka is running
docker ps | grep kafka

# Test connection
kafka-console-producer --bootstrap-server $KAFKA_BROKERS --topic test
```

### **3. Alchemy API Issues**
```bash
# Test API key
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $BASE_RPC_URL
```

### **4. Worker Process Issues**
```bash
# Check if workers are running
ps aux | grep stats-worker

# Check logs
tail -f logs/stats-worker.log
```

## 📝 Configuration Templates

### **Minimal Configuration**
```bash
# Required only
NODE_ENV=development
ALCHEMY_API_KEY=your_key
MONGODB_URI=mongodb://localhost:27017/moonx-farm
KAFKA_BROKERS=localhost:9092
```

### **Full Configuration**
```bash
# Complete setup with all options
# See env.template for comprehensive example
```

## 🔄 Configuration Updates

### **Runtime Updates**
```bash
# Restart service after config changes
docker-compose restart stats-worker

# Or for manual deployment
npm run build
npm start
```

### **Zero-Downtime Updates**
```bash
# Rolling restart with cluster mode
kill -USR2 $(cat stats-worker.pid)
```

---

**Note**: Stats Worker là background service, không có HTTP endpoints. Tất cả monitoring thông qua logs và process checks. 