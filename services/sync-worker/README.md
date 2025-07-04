# MoonXFarm Sync Worker

High-performance, horizontally scalable sync worker service for MoonXFarm DEX platform.

## 🚀 Overview

The Sync Worker is a dedicated service designed to handle portfolio synchronization operations efficiently and at scale. It uses a message queue architecture with Redis and BullMQ for reliable job processing.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │   Core Service  │    │  Sync Worker    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Portfolio  │ │───▶│ │  Sync API   │ │───▶│ │ Job Queue   │ │
│ │     UI      │ │    │ │  Controller │ │    │ │  (Redis)    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    │        │        │
                                              │        ▼        │
                                              │ ┌─────────────┐ │
                                              │ │   Worker    │ │
                                              │ │  Processes  │ │
                                              │ └─────────────┘ │
                                              └─────────────────┘
```

## 🎯 Key Features

### Performance Optimizations
- **Concurrent Processing**: Up to 10 concurrent sync operations
- **Smart Batching**: Efficient batch processing of token metadata
- **Circuit Breaker**: Prevents cascading failures
- **Connection Pooling**: Optimized database connections
- **Caching**: Redis-based caching for frequently accessed data

### Scalability
- **Horizontal Scaling**: Multi-worker cluster support
- **Load Balancing**: Even distribution of sync jobs
- **Resource Management**: Memory and CPU monitoring
- **Auto-scaling**: Kubernetes HPA support

### Reliability
- **Job Retry Logic**: Configurable retry attempts with exponential backoff
- **Dead Letter Queue**: Handle failed jobs gracefully
- **Health Monitoring**: Comprehensive health checks
- **Graceful Shutdown**: Proper cleanup on termination

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd services/sync-worker

# Install dependencies
pnpm install

# Copy environment configuration
cp env.example .env

# Build the service
pnpm build
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development` |
| `PORT` | Service port | `3001` |
| `WORKER_CONCURRENCY` | Max concurrent jobs | `10` |
| `WORKER_MAX_JOBS` | Max jobs per worker | `100` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CLUSTER_MODE` | Enable clustering | `false` |
| `CLUSTER_WORKERS` | Number of worker processes | `4` |

### Worker Configuration

```typescript
// worker.config.ts
export const workerConfig = {
  concurrency: 10,
  maxJobs: 100,
  timeout: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 5000
};
```

## 🚀 Usage

### Development Mode
```bash
pnpm dev
```

### Production Mode
```bash
pnpm build
pnpm start
```

### Cluster Mode
```bash
pnpm start:cluster
```

### Docker
```bash
pnpm docker:build
pnpm docker:run
```

### Kubernetes
```bash
pnpm k8s:deploy
```

## 📊 Monitoring

### Health Checks
- **Liveness**: `/health/live` (Port 3003)
- **Readiness**: `/health/ready` (Port 3003)
- **Metrics**: `/metrics` (Port 3002)

### Metrics
- Job processing rate
- Queue size
- Worker utilization
- Memory usage
- Error rates

## 🔄 Job Types

### Portfolio Sync
- **Priority**: High/Medium/Low
- **Timeout**: 5 minutes
- **Retry**: 3 attempts
- **Backoff**: Exponential

### Batch Operations
- **Bulk User Sync**: Multiple users
- **Chain Sync**: Specific blockchain
- **Token Metadata**: Batch token updates

## 🛠️ Development

### Project Structure
```
src/
├── index.ts           # Main entry point
├── cluster.ts         # Cluster management
├── workers/           # Worker implementations
├── queues/            # Job queue definitions
├── services/          # Business logic services
├── utils/             # Utility functions
├── types/             # TypeScript definitions
└── config/            # Configuration files
```

### Adding New Job Types

1. Define job interface in `types/jobs.ts`
2. Create worker in `workers/`
3. Add queue configuration in `queues/`
4. Register in main worker manager

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t moonx-farm/sync-worker .
```

### Run Container
```bash
docker run -d \
  --name sync-worker \
  --env-file .env \
  -p 3001:3001 \
  moonx-farm/sync-worker
```

### Docker Compose
```yaml
version: '3.8'
services:
  sync-worker:
    image: moonx-farm/sync-worker
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis
      - postgres
```

## ☸️ Kubernetes Deployment

### Basic Deployment
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Auto-scaling
```bash
kubectl apply -f k8s/hpa.yaml
```

### Monitoring
```bash
kubectl apply -f k8s/servicemonitor.yaml
```

## 📈 Performance Benchmarks

### Sync Performance
- **Single User**: ~2-3 seconds
- **Batch (10 users)**: ~15-20 seconds
- **Concurrent (10 workers)**: ~100 users/minute

### Resource Usage
- **Memory**: 256MB - 512MB per worker
- **CPU**: 0.5 - 1.0 cores per worker
- **Network**: 10-50 Mbps depending on chain activity

## 🔍 Troubleshooting

### Common Issues

1. **Queue Backlog**: Increase worker concurrency
2. **Memory Issues**: Reduce batch size or increase memory limits
3. **Connection Errors**: Check Redis/DB connectivity
4. **Rate Limiting**: Implement exponential backoff

### Debug Mode
```bash
NODE_ENV=development LOG_LEVEL=debug pnpm dev
```

## 📝 API Documentation

### Job Management
- `POST /jobs` - Create new sync job
- `GET /jobs/:id` - Get job status
- `DELETE /jobs/:id` - Cancel job

### Worker Management
- `GET /workers` - List active workers
- `POST /workers/pause` - Pause worker
- `POST /workers/resume` - Resume worker

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details 