# Multi-stage build for cloud-agnostic TEE workload
# Compatible with GCP Confidential Space, AWS Nitro Enclaves, Azure Confidential VMs

# ==================== Stage 1: Base Image ====================
FROM node:20-alpine AS base

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# ==================== Stage 2: Dependencies ====================
FROM base AS dependencies

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --production --ignore-scripts && \
    npm cache clean --force

# ==================== Stage 3: Production Image ====================
FROM base AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN addgroup -g 1001 tee && \
    adduser -D -u 1001 -G tee tee

# Copy dependencies from previous stage
COPY --from=dependencies --chown=tee:tee /app/node_modules ./node_modules

# Copy application code
COPY --chown=tee:tee src ./src
COPY --chown=tee:tee package.json ./

# Switch to non-root user
USER tee

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "src/index.js"]

# Metadata labels
LABEL maintainer="Communique <security@communi.email>"
LABEL org.opencontainers.image.title="Communique TEE Workload"
LABEL org.opencontainers.image.description="Cloud-agnostic TEE for XChaCha20-Poly1305 decryption and CWC forwarding"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.licenses="MIT"
