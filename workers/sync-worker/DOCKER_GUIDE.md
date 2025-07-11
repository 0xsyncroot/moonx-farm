# Sync Worker - Docker Guide

## Overview
Hướng dẫn build và deploy Sync Worker service sử dụng Docker.

## Files Structure
```
workers/sync-worker/
├── Dockerfile                 # Docker image configuration
├── docker-compose.simple.yml  # Simple docker compose (sync-worker + redis)
├── docker-compose.yml         # Full docker compose (with monitoring)
├── .dockerignore              # Files to exclude from build context
├── build-and-push.sh          # Script to build and push to Docker Hub
└── src/                       # Source code
```

## Quick Start

### 1. Build và Run Local
```bash
# Build Docker image
docker build -t sync-worker .

# Run với Docker Compose (simple)
docker-compose -f docker-compose.simple.yml up -d

# Hoặc run full version với monitoring
docker-compose up -d
```

### 2. Build và Push lên Docker Hub
```bash
# Make script executable
chmod +x build-and-push.sh

# Build and push với version tự động (timestamp)
./build-and-push.sh

# Build and push với version cụ thể
./build-and-push.sh v1.0.0
```

### 3. Environment Variables
Tạo file `.env` để config:
```env
# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis123

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
BINANCE_API_KEY=your_binance_key
BINANCE_API_SECRET=your_binance_secret
COINGECKO_API_KEY=your_coingecko_key
DEXSCREENER_API_KEY=your_dexscreener_key

# Worker Config
WORKER_CONCURRENCY=5
WORKER_TIMEOUT=30000
WORKER_RETRIES=3
WORKER_BATCH_SIZE=20
```

## Docker Compose Options

### Simple Version (docker-compose.simple.yml)
- Sync Worker service
- Redis for caching and message queues
- Minimal setup cho development

### Full Version (docker-compose.yml)
- Sync Worker service
- Redis for caching and message queues
- PostgreSQL database
- Prometheus metrics collection
- Grafana dashboard

## Health Checks
Service có health check endpoint tại: `http://localhost:3000/health`

## Monitoring
- Prometheus metrics: `http://localhost:9091` (full version)
- Grafana dashboard: `http://localhost:3001` (full version)
  - Username: admin
  - Password: admin123

## Troubleshooting

### Common Issues:
1. **Docker not running**: Ensure Docker is started
2. **Port conflicts**: Change ports in docker-compose.yml
3. **Build failures**: Check .dockerignore for excluded files
4. **Permission denied**: Make sure build-and-push.sh is executable

### Logs:
```bash
# View logs
docker-compose logs -f sync-worker

# View specific container logs
docker logs sync-worker
```

### Cleanup:
```bash
# Stop and remove containers
docker-compose down

# Remove volumes
docker-compose down -v

# Remove images
docker rmi sync-worker
```

## Production Deployment

### Security Considerations:
- Use secrets for sensitive environment variables
- Run with non-root user (already configured)
- Use TLS for external connections
- Regularly update base images

### Scaling:
```bash
# Scale sync-worker service
docker-compose up -d --scale sync-worker=3
```

## Development

### Local Development:
```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Test
npm test
```

### Debug trong Container:
```bash
# Execute bash in running container
docker exec -it sync-worker /bin/sh

# View container processes
docker exec -it sync-worker ps aux
``` 