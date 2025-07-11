# Stats Worker Service

**Pure Background Worker** để thu thập và publish stats cho MoonX Farm platform.

## 🚀 Tính năng

- **Pure Background Worker**: Không có HTTP server, chỉ tập trung vào data collection
- **Chain Performance Monitoring**: Theo dõi block time, network performance với metadata đầy đủ
- **Chain Metadata Collection**: Thu thập chainSlug, logoUrl từ GitHub/CDN đáng tin cậy
- **Bridge Latency Tracking**: Đo độ trễ của các bridge aggregator (LI.FI, Relay.link)
- **Stats Aggregation**: Thu thập và lưu trữ thống kê vào MongoDB với schema mở rộng
- **Kafka Event Publishing**: Publish stats updates qua Kafka cho WebSocket service
- **Cronjob Scheduling**: Tự động thu thập stats theo schedule định sẵn
- **Cluster Mode**: Production-ready với multiple worker processes
- **Health Monitoring**: Process-based health checks và logging
- **Flexible Chain Configuration**: Support nhiều chains với logo URLs có thể customize

## 📁 Cấu trúc thư mục

```
workers/stats-worker/
├── src/
│   ├── types/
│   │   ├── index.ts              # Types cho stats data
│   │   └── events.ts             # Event types cho WebSocket
│   ├── models/
│   │   ├── statsModels.ts        # MongoDB models
│   │   └── index.ts              # Model exports
│   ├── services/
│   │   ├── chainStatsService.ts  # Chain performance collection
│   │   ├── bridgeStatsService.ts # Bridge latency collection
│   │   ├── statsAggregator.ts    # Stats aggregation logic
│   │   └── eventPublisher.ts     # Kafka event publishing
│   ├── jobs/
│   │   ├── statsCollector.ts     # Stats collection implementation
│   │   └── scheduler.ts          # Job scheduling
│   ├── utils/
│   │   ├── logger.ts             # Logging utilities
│   │   └── helpers.ts            # Helper functions
│   ├── cluster.ts                # Cluster management
│   └── index.ts                  # Main entry point
├── scripts/
│   ├── setup.sh                  # Automated setup script
│   ├── start.sh                  # Production start script
│   ├── dev.sh                    # Development start script
│   └── health-check.sh           # Health check script
├── package.json
├── tsconfig.json
├── env.template                  # Environment template
├── docker-compose.yml            # Docker setup
├── Dockerfile                    # Container image
├── README.md                     # Documentation
└── QUICK_START.md               # Quick start guide
```

## 🔧 Environment Variables

```env
# Service Configuration
NODE_ENV=development
SERVICE_NAME=stats-worker
SERVICE_VERSION=1.0.0
# No PORT needed for background worker

# Cluster Configuration
CLUSTER_MODE=false
CLUSTER_WORKERS=0

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/moonx-farm
MONGODB_DATABASE=moonx-farm
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=1
MONGODB_ENABLE_METRICS=true

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=stats-worker
KAFKA_GROUP_ID=stats-worker-group
KAFKA_TOPIC_EVENTS=moonx.ws.events

# Chain RPC Configuration
ALCHEMY_API_KEY=your_alchemy_api_key_here
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/your_key
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key

# Cronjob Intervals
STATS_COLLECTION_INTERVAL=0 */5 * * * * # Every 5 minutes
CHAIN_PERFORMANCE_INTERVAL=0 */1 * * * * # Every 1 minute
BRIDGE_LATENCY_INTERVAL=0 */2 * * * * # Every 2 minutes

# External APIs
DEFILLAMA_API_URL=https://api.llama.fi
LIFI_API_URL=https://li.quest/v1
RELAY_API_URL=https://api.relay.link
```

## 🚀 Chạy service

### Quick Start
```bash
# Automated setup
./scripts/setup.sh

# Start service
npm start
```

### Manual Setup
```bash
# Development
cp env.template .env
npm install
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose up -d

# With environment file
docker run --env-file .env stats-worker
```

## 🔗 Cluster Mode

Service hỗ trợ cluster mode để tăng performance và reliability:

```bash
# Enable cluster mode
export CLUSTER_MODE=true
export CLUSTER_WORKERS=4
npm start

# Hoặc sử dụng environment variables
CLUSTER_MODE=true CLUSTER_WORKERS=4 npm start
```

## 📊 Stats Data Structure

### Chain Performance Stats
```json
{
  "chainId": 8453,
  "chainName": "Base",
  "blockTime": {
    "current": 2.05,
    "change": "+0.12%",
    "changePercent": 0.12,
    "timestamp": 1234567890
  },
  "volume24h": "$125.5M",
  "volumeUSD": 125500000,
  "status": "healthy",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Bridge Latency Stats
```json
{
  "provider": "LI.FI",
  "latency": 850,
  "status": "healthy",
  "timestamp": 1234567890,
  "route": "Base->BSC",
  "fromChain": 8453,
  "toChain": 56,
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## 🔄 Event Publishing

Worker publish các events sau qua Kafka:

- `stats.chain_performance_updated`
- `stats.bridge_latency_updated`
- `stats.overview_updated`

WebSocket service sẽ consume và forward events này tới frontend.

## 📈 Health Monitoring

### Process-based Health Checks
```bash
# Check if worker is running
ps aux | grep stats-worker

# Check Docker container
docker ps | grep stats-worker

# Check logs
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

## 🛠️ Development

### Scripts
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

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f stats-worker

# Stop services
docker-compose down
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection**
   ```bash
   # Check if MongoDB is running
   docker ps | grep mongo
   ```

2. **Kafka Connection**
   ```bash
   # Check if Kafka is running
   docker ps | grep kafka
   ```

3. **Alchemy API Rate Limit**
   ```bash
   # Check API key
   grep ALCHEMY_API_KEY .env
   ```

### Log Levels
```bash
# Debug mode
LOG_LEVEL=debug npm run dev

# Production logging
LOG_LEVEL=info npm start
```

## 🏗️ Architecture

```
Stats Worker (Background Process)
├── Cluster Manager
│   ├── Worker Process 1
│   ├── Worker Process 2
│   └── Worker Process N
├── Job Scheduler
│   ├── Stats Collection Job
│   ├── Chain Performance Job
│   └── Bridge Latency Job
├── Data Collection
│   ├── Chain Stats Service
│   ├── Bridge Stats Service
│   └── Stats Aggregator
└── Data Output
    ├── MongoDB Storage
    └── Kafka Event Publishing
```

## 📝 Integration

### WebSocket Service Integration
Stats Worker publishs events qua Kafka, WebSocket service consume và forward:

```bash
# Kafka Topic: moonx.ws.events
# Event Types:
# - stats.chain_performance_updated
# - stats.bridge_latency_updated
# - stats.overview_updated
```

### Frontend Integration
Frontend connects tới WebSocket service để receive real-time stats updates.

---

**Note**: Đây là pure background worker service, không có HTTP API endpoints. Tất cả monitoring được thực hiện qua logs và process checks. 