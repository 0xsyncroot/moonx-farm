# ============================================
# Sync Worker Service - Simple Docker Configuration
# ============================================
# 
# Single-stage build for simplicity:
# - Easy to build and debug
# - Security (non-root user)
# - Health checks
# ============================================

FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5555
ENV LOG_LEVEL=info

# Install system dependencies and dumb-init
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S syncworker && \
    adduser -S syncworker -u 1001 -G syncworker

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Install tsc-alias for path resolution
RUN pnpm add -D tsc-alias

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Resolve path aliases to relative paths
RUN npx tsc-alias -p tsconfig.json

# Remove dev dependencies to reduce image size
RUN pnpm prune --prod

# Create required directories and set ownership
RUN mkdir -p /app/logs /app/tmp && \
    chown -R syncworker:syncworker /app

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

# Start the application normally (no tsconfig-paths needed)
CMD ["node", "dist/main.js"] 