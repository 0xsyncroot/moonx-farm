# ================================
# MoonXFarm DEX - Production Dockerfile
# ================================
# Multi-stage build for Next.js 14+ with workspace packages
# Optimized for production deployment with Account Abstraction integration

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
COPY configs/package.json ./configs/

# Copy web app package.json
COPY apps/web/package.json ./apps/web/

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
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy workspace packages source code
COPY packages/common ./packages/common
COPY configs ./configs

# Copy web application source code
COPY apps/web ./apps/web

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Build workspace packages first
RUN pnpm --filter @moonx/common build
RUN pnpm --filter @moonx/configs build

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build web application
WORKDIR /app/apps/web
RUN pnpm build

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:18-alpine AS runner

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 moonx
RUN adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy built application from builder stage
COPY --from=builder /app/apps/web/public ./public

# Copy built assets and set ownership
COPY --from=builder --chown=nextjs:moonx /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:moonx /app/apps/web/.next/static ./.next/static

# Create logs directory
RUN mkdir -p /app/logs && chown nextjs:moonx /app/logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# ================================
# Labels for container management
# ================================
LABEL maintainer="MoonXFarm Team"
LABEL version="1.0.0"
LABEL description="MoonXFarm DEX - Account Abstraction Trading Platform"
LABEL org.opencontainers.image.source="https://github.com/0xsyncroot/moonx-farm" 