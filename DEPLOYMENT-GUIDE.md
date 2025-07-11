# MoonX Farm WebSocket Gateway & Notification Hub Deployment Guide

## 🚀 Overview

This guide covers the complete deployment of the MoonX Farm DEX notification system, including WebSocket Gateway and Notification Hub services with production-ready configurations.

## 🏗️ Architecture

The notification system uses a dual-channel approach:

- **Kafka Channel**: Backend Services → Kafka Topics → WebSocket Gateway → Clients
- **Redis Channel**: Notification Hub → Redis Gateway Commands → WebSocket Gateway → Clients

```mermaid
graph TB
    subgraph "Backend Services"
        BS[Backend Services]
        TH[Topic Handlers]
    end
    
    subgraph "Messaging Layer"
        K[Kafka Topics]
        R[Redis Commands]
    end
    
    subgraph "WebSocket Gateway"
        WG[WebSocket Gateway]
        EB[Event Broadcaster]
        CB[Circuit Breakers]
        SM[Security Middleware]
        PM[Prometheus Metrics]
    end
    
    subgraph "Clients"
        WC[WebSocket Clients]
        MA[Mobile Apps]
        WA[Web Apps]
    end
    
    BS --> K
    TH --> R
    K --> EB
    R --> EB
    EB --> WG
    WG --> WC
    WG --> MA
    WG --> WA
    
    CB -.-> EB
    SM -.-> WG
    PM -.-> WG
```

## 🔧 Prerequisites

### System Requirements

**For Development:**
- Node.js 18+ with TypeScript support
- Redis 6+
- Kafka 2.8+
- Docker & Docker Compose
- 4GB RAM minimum

**For Production:**
- Node.js 18+ (LTS recommended)
- Redis Cluster (3+ nodes)
- Kafka Cluster (3+ brokers)
- Kubernetes 1.24+
- 16GB RAM minimum per instance
- SSD storage for low latency

### Environment Variables

Create `.env` files for each service:

**WebSocket Gateway (.env):**
```bash
# Basic Configuration
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Performance Profile
PERFORMANCE_MODE=high_frequency  # low, medium, high, high_frequency
SECURITY_LEVEL=high             # low, medium, high, critical

# Database & Cache
REDIS_URL=redis://redis-cluster:6379
REDIS_CLUSTER=true
REDIS_SENTINEL=false

# Kafka Configuration
KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092
KAFKA_CLIENT_ID=websocket-gateway
KAFKA_GROUP_ID=websocket-gateway-group
KAFKA_TOPICS=price.updates,order.book.updates,trade.notifications,portfolio.updates,system.alerts

# Authentication
AUTH_SERVICE_URL=http://auth-service:3000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=24h

# CORS Configuration
CORS_ORIGINS=https://moonx-farm.com,https://app.moonx-farm.com
CORS_CREDENTIALS=true

# Connection Limits
MAX_CONNECTIONS=100000
CONNECTION_TIMEOUT=30000
PING_TIMEOUT=20000
PING_INTERVAL=8000

# Security Settings
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=50

# Monitoring
ENABLE_PROMETHEUS=true
METRICS_PORT=9090
LOG_LEVEL=info
```

**Notification Hub (.env):**
```bash
# Basic Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/notifications
REDIS_URL=redis://redis-cluster:6379

# External Services
EMAIL_SERVICE_URL=http://email-service:3002
PUSH_SERVICE_URL=http://push-service:3003
WEBSOCKET_GATEWAY_URL=http://websocket-gateway:8080

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

## 📦 Docker Deployment

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Redis Cluster
  redis-master:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  # Kafka
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  # PostgreSQL for Notification Hub
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: notifications
      POSTGRES_USER: moonx
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # WebSocket Gateway
  websocket-gateway:
    build:
      context: ./services/websocket-gateway
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
      - "9090:9090"  # Metrics
    depends_on:
      - redis-master
      - kafka
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis-master:6379
      - KAFKA_BROKERS=kafka:9092
      - PERFORMANCE_MODE=medium
      - SECURITY_LEVEL=medium
    volumes:
      - ./services/websocket-gateway:/app
      - /app/node_modules

  # Notification Hub
  notification-hub:
    build:
      context: ./services/notification-hub
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis-master
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://moonx:secure_password@postgres:5432/notifications
      - REDIS_URL=redis://redis-master:6379
    volumes:
      - ./services/notification-hub:/app
      - /app/node_modules

  # Prometheus for monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  redis-data:
  postgres-data:
  prometheus-data:
  grafana-data:
```

### Production Dockerfile

**WebSocket Gateway Dockerfile:**
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Set security headers
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV UV_THREADPOOL_SIZE=64

USER nodejs

EXPOSE 8080 9090

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## ☸️ Kubernetes Deployment

### Production Kubernetes Manifests

**WebSocket Gateway Deployment:**
```yaml
# k8s/websocket-gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-gateway
  labels:
    app: websocket-gateway
    version: v1.0.0
spec:
  replicas: 6  # Scale based on load
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: websocket-gateway
  template:
    metadata:
      labels:
        app: websocket-gateway
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      nodeSelector:
        node.kubernetes.io/instance-type: "c5.2xlarge"  # High-performance nodes
      
      containers:
      - name: websocket-gateway
        image: moonx-farm/websocket-gateway:v1.0.0
        ports:
        - containerPort: 8080
          name: websocket
        - containerPort: 9090
          name: metrics
        
        env:
        - name: NODE_ENV
          value: "production"
        - name: PERFORMANCE_MODE
          value: "high_frequency"
        - name: SECURITY_LEVEL
          value: "high"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: KAFKA_BROKERS
          valueFrom:
            configMapKeyRef:
              name: kafka-config
              key: brokers
        
        resources:
          requests:
            memory: "4Gi"
            cpu: "1000m"
          limits:
            memory: "8Gi"
            cpu: "2000m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

      # Pod disruption budget
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - websocket-gateway
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: websocket-gateway-service
  labels:
    app: websocket-gateway
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
    name: websocket
  - port: 9090
    targetPort: 9090
    name: metrics
  selector:
    app: websocket-gateway

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: websocket-gateway-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "websocket-gateway-service"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - ws.moonx-farm.com
    secretName: websocket-tls
  rules:
  - host: ws.moonx-farm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: websocket-gateway-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/websocket-gateway-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: websocket_connections_active
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## 🔐 Security Configuration

### Network Security

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: websocket-gateway-netpol
spec:
  podSelector:
    matchLabels:
      app: websocket-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: kafka
    ports:
    - protocol: TCP
      port: 9092
```

### Pod Security Policy

```yaml
# k8s/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: websocket-gateway-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## 📊 Monitoring & Observability

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'websocket-gateway'
    static_configs:
      - targets: ['websocket-gateway:9090']
    scrape_interval: 5s
    metrics_path: /metrics
    
  - job_name: 'notification-hub'
    static_configs:
      - targets: ['notification-hub:9090']
    scrape_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Alert Rules

```yaml
# monitoring/alert_rules.yml
groups:
- name: websocket-gateway-alerts
  rules:
  - alert: WebSocketGatewayDown
    expr: up{job="websocket-gateway"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "WebSocket Gateway is down"
      description: "WebSocket Gateway has been down for more than 1 minute"

  - alert: HighConnectionCount
    expr: websocket_connections_active > 50000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High WebSocket connection count"
      description: "WebSocket connections: {{ $value }}"

  - alert: CircuitBreakerOpen
    expr: circuit_breaker_state > 0
    for: 30s
    labels:
      severity: critical
    annotations:
      summary: "Circuit breaker is open"
      description: "Circuit breaker {{ $labels.service }} is open"

  - alert: HighErrorRate
    expr: rate(websocket_errors_total[5m]) > 10
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate: {{ $value }} errors/sec"
```

## 🚀 Deployment Steps

### 1. Pre-deployment Checklist

- [ ] Kubernetes cluster ready (1.24+)
- [ ] Redis cluster configured
- [ ] Kafka cluster configured
- [ ] SSL certificates configured
- [ ] Monitoring stack deployed
- [ ] Secrets and ConfigMaps created
- [ ] Network policies applied

### 2. Infrastructure Setup

```bash
# Create namespace
kubectl create namespace moonx-farm

# Apply secrets
kubectl apply -f k8s/secrets/

# Apply ConfigMaps
kubectl apply -f k8s/configmaps/

# Deploy Redis cluster
kubectl apply -f k8s/redis/

# Deploy Kafka cluster
kubectl apply -f k8s/kafka/
```

### 3. Application Deployment

```bash
# Deploy WebSocket Gateway
kubectl apply -f k8s/websocket-gateway-deployment.yaml

# Deploy Notification Hub
kubectl apply -f k8s/notification-hub-deployment.yaml

# Apply autoscaling
kubectl apply -f k8s/websocket-gateway-hpa.yaml

# Apply network policies
kubectl apply -f k8s/network-policy.yaml
```

### 4. Verification

```bash
# Check deployment status
kubectl get pods -n moonx-farm

# Check services
kubectl get svc -n moonx-farm

# Check ingress
kubectl get ingress -n moonx-farm

# Check metrics
curl -s http://ws.moonx-farm.com/metrics | head -20

# Test WebSocket connection
wscat -c wss://ws.moonx-farm.com
```

## 🔧 Performance Tuning

### High-Frequency Trading Configuration

For ultra-low latency requirements:

```bash
# Environment variables for extreme performance
PERFORMANCE_MODE=high_frequency
NODE_OPTIONS="--max-old-space-size=16384"
UV_THREADPOOL_SIZE=128

# Kernel optimization (on host)
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 12582912 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 12582912 16777216' >> /etc/sysctl.conf
echo 'net.core.netdev_max_backlog = 5000' >> /etc/sysctl.conf
sysctl -p
```

### Database Optimization

```sql
-- PostgreSQL optimization for Notification Hub
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
SELECT pg_reload_conf();
```

## 🛠️ Troubleshooting

### Common Issues

**1. WebSocket Connection Failures**
```bash
# Check ingress configuration
kubectl describe ingress websocket-gateway-ingress

# Check service endpoints
kubectl get endpoints websocket-gateway-service

# Test direct connection
kubectl port-forward svc/websocket-gateway-service 8080:80
wscat -c ws://localhost:8080
```

**2. High Memory Usage**
```bash
# Check memory metrics
kubectl top pods -n moonx-farm

# Review Node.js heap usage
curl -s http://ws.moonx-farm.com/metrics | grep nodejs_heap

# Scale up if needed
kubectl scale deployment websocket-gateway --replicas=8
```

**3. Circuit Breaker Issues**
```bash
# Check circuit breaker status
curl -s http://ws.moonx-farm.com/circuit-breakers

# Reset circuit breakers
curl -X POST http://ws.moonx-farm.com/circuit-breakers/event-broadcaster-price_update/reset
```

### Logs Analysis

```bash
# View application logs
kubectl logs -f deployment/websocket-gateway -n moonx-farm

# Filter error logs
kubectl logs deployment/websocket-gateway -n moonx-farm | grep ERROR

# Monitor real-time logs
stern websocket-gateway -n moonx-farm
```

## 📈 Performance Benchmarks

### Expected Performance Metrics

**WebSocket Gateway:**
- **Connections**: 100,000+ concurrent connections per instance
- **Message Throughput**: 50,000+ messages/second
- **Latency**: < 10ms p99 for message delivery
- **Memory Usage**: ~8GB for 100k connections
- **CPU Usage**: ~2 cores at 70% utilization

**Notification Hub:**
- **Processing Rate**: 10,000+ notifications/second
- **Database Write Rate**: 5,000+ writes/second
- **Redis Operations**: 20,000+ ops/second
- **API Response Time**: < 100ms p95

## 🔄 Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor connection counts and error rates
- Check disk space and memory usage
- Review security alerts
- Verify backup integrity

**Weekly:**
- Update security patches
- Review performance metrics
- Check log rotation
- Update SSL certificates if needed

**Monthly:**
- Performance testing and optimization
- Capacity planning review
- Security audit
- Documentation updates

## 📞 Support

For deployment issues or questions:

- **Documentation**: [https://docs.moonx-farm.com](https://docs.moonx-farm.com)
- **Support Email**: devops@moonx-farm.com
- **Emergency Escalation**: +1-555-MOONX-DEV
- **Status Page**: [https://status.moonx-farm.com](https://status.moonx-farm.com)

---

*This deployment guide covers production-ready deployment of the MoonX Farm WebSocket Gateway and Notification Hub. For development setup, refer to the README files in each service directory.* 