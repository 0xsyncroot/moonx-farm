# Stage 1: build code, không quan tâm node_modules service
FROM node:18-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY . .
# Clean turbo cache to ensure fresh build
RUN rm -rf .turbo/
RUN pnpm install --frozen-lockfile
RUN pnpm run build
RUN ls -la
# Stage 2: chỉ copy dist + package.json, rồi cài lại prod dep (từ registry, không symlink)
FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
RUN corepack enable
COPY --from=build /repo/dist ./dist
COPY --from=build /repo/package.json ./
RUN pnpm install --prod
USER node
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start application using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
