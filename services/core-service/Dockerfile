# =============================================================================
# MoonXFarm Core Service - Production Dockerfile
# =============================================================================
# Multi-stage build for production-optimized microservice
# Features: Order Management, Portfolio Sync, P&L Analytics
# =============================================================================

# =============================================================================
# Stage 1: Build Dependencies & Workspace Packages
# =============================================================================
FROM node:20-alpine AS dependencies

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace packages (required by Core Service)
COPY packages/common/ ./packages/common/
COPY packages/infrastructure/ ./packages/infrastructure/
COPY configs/ ./configs/

# Copy Core Service package.json
COPY services/core-service/package.json ./services/core-service/

# Install all dependencies (including workspace packages)
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Build Application
# =============================================================================
FROM dependencies AS builder

# Copy Core Service source code
COPY services/core-service/src/ ./services/core-service/src/
COPY services/core-service/tsconfig.json ./services/core-service/

# Build workspace packages first
RUN pnpm -r build

# Build Core Service
WORKDIR /app/services/core-service
RUN pnpm build

# =============================================================================
# Stage 3: Production Runtime
# =============================================================================
FROM node:20-alpine AS production

# Install pnpm for production
RUN npm install -g pnpm

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S moonx -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common/package.json ./packages/common/
COPY packages/infrastructure/package.json ./packages/infrastructure/
COPY configs/package.json ./configs/
COPY services/core-service/package.json ./services/core-service/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built workspace packages
COPY --from=builder /app/packages/common/dist/ ./packages/common/dist/
COPY --from=builder /app/packages/infrastructure/dist/ ./packages/infrastructure/dist/
COPY --from=builder /app/configs/dist/ ./configs/dist/

# Copy built Core Service
COPY --from=builder /app/services/core-service/dist/ ./services/core-service/dist/

# Change ownership to nodejs user
RUN chown -R moonx:nodejs /app

# Switch to non-root user
USER moonx

# Set working directory to service
WORKDIR /app/services/core-service

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e " \
        const http = require('http'); \
        const options = { \
            hostname: 'localhost', \
            port: 3007, \
            path: '/health', \
            timeout: 5000 \
        }; \
        const req = http.request(options, (res) => { \
            process.exit(res.statusCode === 200 ? 0 : 1); \
        }); \
        req.on('error', () => process.exit(1)); \
        req.on('timeout', () => process.exit(1)); \
        req.end(); \
    "

# Production environment
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Start Core Service
CMD ["node", "dist/index.js"]

# =============================================================================
# Build Instructions:
# =============================================================================
# From project root:
# docker build -f services/core-service/Dockerfile -t moonx/core-service .
# docker run -p 3007:3007 --env-file services/core-service/.env moonx/core-service
# ============================================================================= 