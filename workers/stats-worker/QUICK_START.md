# 🚀 Quick Start Guide - Stats Worker Service

## 📋 Prerequisites

- Node.js 18+ installed
- MongoDB running (local or remote)
- Kafka running (local or remote)
- Alchemy API Key (free at [dashboard.alchemy.com](https://dashboard.alchemy.com/))

## ⚡ 1-Minute Setup

### Option 1: Automated Setup (Recommended)

```bash
# 1. Navigate to stats-worker directory
cd workers/stats-worker

# 2. Run automated setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Start the service
npm start
```

### Option 2: Manual Setup

```bash
# 1. Copy environment template
cp env.template .env

# 2. Edit .env file with your configuration
nano .env

# 3. Install dependencies
npm install

# 4. Build the project
npm run build

# 5. Start the service
npm start
```

## 🐳 Docker Setup (All-in-One)

```bash
# 1. Set your Alchemy API key in .env.docker
echo "ALCHEMY_API_KEY=your_api_key_here" > .env.docker

# 2. Start all services
docker-compose up -d

# 3. Check service status
docker-compose ps
```

## 📝 Essential Configuration

### Minimum Required Variables

```bash
# .env file
NODE_ENV=development
ALCHEMY_API_KEY=your_alchemy_api_key_here
MONGODB_URI=mongodb://localhost:27017/moonx-farm
KAFKA_BROKERS=localhost:9092
```

### Development vs Production

#### Development (Fast intervals for testing)
```bash
NODE_ENV=development
STATS_COLLECTION_INTERVAL=*/30 * * * * *     # Every 30 seconds
CHAIN_PERFORMANCE_INTERVAL=*/15 * * * * *    # Every 15 seconds
BRIDGE_LATENCY_INTERVAL=*/20 * * * * *       # Every 20 seconds
CLUSTER_MODE=false
LOG_LEVEL=debug
```

#### Production (Optimal intervals)
```bash
NODE_ENV=production
STATS_COLLECTION_INTERVAL=0 */5 * * * *      # Every 5 minutes
CHAIN_PERFORMANCE_INTERVAL=0 */1 * * * *     # Every 1 minute
BRIDGE_LATENCY_INTERVAL=0 */2 * * * *        # Every 2 minutes
CLUSTER_MODE=true
CLUSTER_WORKERS=2
LOG_LEVEL=info
```

## 🔧 Service Commands

### NPM Scripts
```bash
npm start          # Start production service
npm run dev        # Start development service
npm run build      # Build TypeScript
npm test           # Run tests
npm run lint       # Run ESLint
```

### Helper Scripts
```bash
./scripts/start.sh           # Start production service
./scripts/dev.sh             # Start development service
./scripts/health-check.sh    # Check service health
```

## 📊 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| MongoDB Express | http://localhost:8081 | Database UI (development) |
| Kafka UI | http://localhost:8080 | Message queue UI (development) |

## 🔍 Health Monitoring

### Check Service Health (Background Worker)
```bash
# Check if worker process is running
ps aux | grep stats-worker

# Check Docker container status
docker ps | grep stats-worker

# Check logs for activity
tail -f logs/stats-worker.log
```

### Expected Log Output
```
[INFO] Stats Worker started in cluster mode
[INFO] Worker 1234 started
[INFO] Scheduled job: stats-collection
[INFO] Chain stats collected: Base, BSC, Ethereum
[INFO] Bridge latency collected: LI.FI, Relay.link
```

## 📈 Data Collection

### Chain Performance Stats
- **Base**: Block time, volume, TPS
- **BSC**: Block time, volume, TPS  
- **Ethereum**: Block time, volume, TPS

### Bridge Latency Stats
- **LI.FI**: Cross-chain latency
- **Relay.link**: Cross-chain latency
- **1inch**: Same-chain latency

### Collection Intervals
- **Chain Stats**: Every 1-5 minutes
- **Bridge Stats**: Every 2-5 minutes
- **Overview**: Every 5 minutes

## 🛠️ Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error
```bash
# Check MongoDB is running
docker ps | grep mongo
# or
systemctl status mongod

# Fix: Start MongoDB
docker-compose up -d mongodb
# or
sudo systemctl start mongod
```

#### 2. Kafka Connection Error
```bash
# Check Kafka is running
docker ps | grep kafka

# Fix: Start Kafka
docker-compose up -d kafka
```

#### 3. Alchemy API Rate Limit
```bash
# Check API key in .env
grep ALCHEMY_API_KEY .env

# Fix: Get a new API key from Alchemy dashboard
# Update .env file with new key
```

#### 4. Service Won't Start
```bash
# Check logs
npm run dev

# Common fixes:
# 1. Missing dependencies
npm install

# 2. Build errors
npm run build

# 3. Check if already running
ps aux | grep stats-worker
```

### Log Levels
```bash
# Debug mode for troubleshooting
LOG_LEVEL=debug npm run dev

# Production logging
LOG_LEVEL=info npm start
```

## 🔄 Development Workflow

### 1. Start Development Environment
```bash
# Start dependencies
docker-compose up -d mongodb kafka

# Start service in development mode
npm run dev
```

### 2. Monitor Data Collection
```bash
# Watch logs
tail -f logs/stats-worker.log

# Check MongoDB data
docker exec -it moonx-mongodb mongosh moonx-farm
```

### 3. Testing Collection
```bash
# Force collection (development intervals)
# Chain stats: Every 15 seconds
# Bridge stats: Every 20 seconds
# Overview: Every 30 seconds
```

## 🌟 Advanced Features

### Cluster Mode
```bash
# Enable for production
CLUSTER_MODE=true
CLUSTER_WORKERS=4
npm start
```

### Custom Intervals
```bash
# Custom cron schedules
STATS_COLLECTION_INTERVAL="0 */10 * * * *"    # Every 10 minutes
CHAIN_PERFORMANCE_INTERVAL="0 */3 * * * *"    # Every 3 minutes
```

### Performance Tuning
```bash
# MongoDB connection pool
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=5

# Kafka optimization
KAFKA_RETRY_ATTEMPTS=5
KAFKA_REQUEST_TIMEOUT=30000
```

## 🚀 Production Deployment

### 1. Environment Preparation
```bash
# Set production environment
NODE_ENV=production
CLUSTER_MODE=true
CLUSTER_WORKERS=2

# Set production intervals
STATS_COLLECTION_INTERVAL="0 */5 * * * *"
CHAIN_PERFORMANCE_INTERVAL="0 */1 * * * *"
BRIDGE_LATENCY_INTERVAL="0 */2 * * * *"
```

### 2. Database Setup
```bash
# Initialize MongoDB
docker exec -it moonx-mongodb mongosh moonx-farm < scripts/mongo-init.js
```

### 3. Health Monitoring
```bash
# Add to monitoring system
ps aux | grep -v grep | grep 'stats-worker' || alert

# Or check logs for recent activity
tail -n 10 logs/stats-worker.log | grep -q "$(date '+%Y-%m-%d')" || alert
```

## 📚 Next Steps

1. **Review Logs**: Check `logs/stats-worker.log` for collection status
2. **Monitor Data**: Use MongoDB Express to verify data collection
3. **Integrate WebSocket**: Connect to WebSocket service for real-time updates
4. **Configure Alerts**: Set up monitoring for service health
5. **Scale**: Enable cluster mode for production workloads

## 📞 Support

- **Documentation**: [README.md](./README.md)
- **Implementation**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Issues**: Check logs in `logs/stats-worker.log`

---

✅ **Service Ready**: Stats Worker is now collecting blockchain and bridge performance data!

The service will automatically:
- Collect chain performance stats from Base, BSC, and Ethereum
- Monitor bridge latency for LI.FI and Relay.link
- Store data in MongoDB with TTL expiration
- Publish events to Kafka for real-time updates
- Provide health monitoring endpoints 