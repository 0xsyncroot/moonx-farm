# ============================================
# Sync Worker Service - Docker Configuration
# ============================================
# 
# Multi-stage build optimized for:
# - Production deployment
# - Security (non-root user)
# - Performance (minimal layers)
# - Monitoring (health checks)
# - Horizontal scaling
# ============================================

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S syncworker && \
    adduser -S syncworker -u 1001 -G syncworker

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=syncworker:syncworker /app/dist ./dist
COPY --from=builder --chown=syncworker:syncworker /app/node_modules ./node_modules
COPY --from=builder --chown=syncworker:syncworker /app/package*.json ./

# Create required directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R syncworker:syncworker /app/logs /app/tmp

# Switch to non-root user
USER syncworker

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1); \
  }).on('error', () => process.exit(1));"

# Labels for metadata
LABEL maintainer="MoonX Farm Team"
LABEL service="sync-worker"
LABEL version="1.0.0"
LABEL description="Sync Worker Service for Portfolio Synchronization"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"] 