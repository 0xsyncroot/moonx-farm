# --- Stage 1: deps ---
  FROM node:18-alpine AS deps
  WORKDIR /app
  ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
  RUN corepack enable
  
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install
  
  # --- Stage 2: build ---
  FROM node:18-alpine AS builder
  WORKDIR /app
  ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
  RUN corepack enable
  
  # Copy dependencies và manifest
  COPY --from=deps /app/node_modules ./node_modules
  COPY package.json pnpm-lock.yaml ./
  
  # Copy file env production vào root as .env
  # (Next.js sẽ tự load .env hoặc .env.production)
  COPY .env.production .env
  
  # Copy mã nguồn
  COPY next.config.js   ./
  COPY tsconfig.json*   ./
  COPY tailwind.config.js ./
  COPY postcss.config.js  ./
  COPY public           ./public
  COPY src              ./src
  COPY healthcheck.js   ./healthcheck.js
  
  # Build
  RUN pnpm run build
  
  # --- Stage 3: runner ---
  FROM node:18-alpine AS runner
  WORKDIR /app
  ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
  RUN corepack enable
  
  COPY --from=deps /app/package.json /app/pnpm-lock.yaml ./
  RUN pnpm install --prod
  
  COPY --from=builder /app/.next ./.next
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/healthcheck.js ./
  
  ENV NODE_ENV=production PORT=3000
  EXPOSE 3000
  CMD ["pnpm", "start"]
  