# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy manifests first so the layer is cached unless deps change
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source (excluding everything in .dockerignore)
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

# DB migrations run separately (npm run migrate) before starting the server
CMD ["node", "src/server.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
