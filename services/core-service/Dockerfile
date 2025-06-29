# ================================
# MoonXFarm Core Service - Production Dockerfile
# ================================
# Multi-stage build for Fastify core service with workspace support
# Features: Order Management, Portfolio Sync, P&L Analytics

# ================================
# Stage 1: Dependencies & Workspace Setup
# ================================
FROM node:18-alpine AS deps

# Install security updates and required dependencies
RUN apk add --no-cache libc6-compat openssl

# Set working directory
WORKDIR /app

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy workspace packages
COPY packages/common/package.json ./packages/common/
COPY packages/infrastructure/package.json ./packages/infrastructure/
COPY configs/package.json ./configs/

# Copy core service package.json
COPY services/core-service/package.json ./services/core-service/

# Install dependencies using pnpm with frozen lockfile
RUN pnpm install --frozen-lockfile --production=false

# ================================
# Stage 2: Build Application
# ================================
FROM node:18-alpine AS builder

# Install security updates
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/configs ./configs
COPY --from=deps /app/services/core-service/node_modules ./services/core-service/node_modules

# Copy workspace packages source code
COPY packages/common ./packages/common
COPY packages/infrastructure ./packages/infrastructure
COPY configs ./configs

# Copy core service source code
COPY services/core-service ./services/core-service

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Build workspace packages first
RUN pnpm --filter @moonx/common build
RUN pnpm --filter @moonx/infrastructure build  
RUN pnpm --filter @moonx/configs build

# Build core service with production settings
RUN pnpm --filter @moonx/core-service build:production

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:18-alpine AS runner

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 moonx
RUN adduser --system --uid 1001 coreservice

# Set environment variables
ENV NODE_ENV=production
ENV CORE_SERVICE_PORT=3007
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Copy built application from builder stage
COPY --from=builder --chown=coreservice:moonx /app/services/core-service/dist ./dist
COPY --from=builder --chown=coreservice:moonx /app/services/core-service/package.json ./package.json

# Copy production dependencies (only what's needed)
COPY --from=builder --chown=coreservice:moonx /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p /app/logs && chown coreservice:moonx /app/logs

# Switch to non-root user
USER coreservice

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start application using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ================================
# Labels for container management
# ================================
LABEL maintainer="MoonXFarm Team"
LABEL version="1.0.0"
LABEL description="MoonXFarm Core Service - Order Management & Portfolio Analytics"
LABEL org.opencontainers.image.source="https://github.com/0xsyncroot/moonx-farm" 