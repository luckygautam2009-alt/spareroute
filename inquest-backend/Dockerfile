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

EXPOSE 5001

# Run DB migrations then start the server
CMD ["sh", "-c", "node src/db/migrate.js && node src/app.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1
