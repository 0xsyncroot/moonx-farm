# ================================
# MoonXFarm Auth Service - Production Dockerfile
# ================================
# Multi-stage build for Fastify auth service with workspace support
# Optimized for production deployment

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

# Copy auth service package.json
COPY services/auth-service/package.json ./services/auth-service/

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
COPY --from=deps /app/services/auth-service/node_modules ./services/auth-service/node_modules

# Copy workspace packages source code
COPY packages/common ./packages/common
COPY packages/infrastructure ./packages/infrastructure
COPY configs ./configs

# Copy auth service source code
COPY services/auth-service ./services/auth-service

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Build workspace packages first
RUN pnpm --filter @moonx/common build
RUN pnpm --filter @moonx/infrastructure build  
RUN pnpm --filter @moonx/configs build

# Build auth service with production settings
RUN pnpm --filter @moonx/auth-service build:production

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:18-alpine AS runner

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 moonx
RUN adduser --system --uid 1001 authservice

# Set environment variables
ENV NODE_ENV=production
ENV AUTH_SERVICE_PORT=3001

# Copy built application from builder stage
COPY --from=builder --chown=authservice:moonx /app/services/auth-service/dist ./dist
COPY --from=builder --chown=authservice:moonx /app/services/auth-service/package.json ./package.json

# Copy production dependencies (only what's needed)
COPY --from=builder --chown=authservice:moonx /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p /app/logs && chown authservice:moonx /app/logs

# Switch to non-root user
USER authservice

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start application using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# ================================
# Labels for container management
# ================================
LABEL maintainer="MoonXFarm Team"
LABEL version="1.0.0"
LABEL description="MoonXFarm Auth Service - JWT Authentication with Privy Integration"
LABEL org.opencontainers.image.source="https://github.com/0xsyncroot/moonx-farm"