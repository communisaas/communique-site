# syntax=docker/dockerfile:1

# Base stage
FROM node:20.11.1-slim as base

LABEL fly_launch_runtime="NodeJS/Prisma"

# NodeJS lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Build stage
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential openssl curl

# Install node modules
COPY --link package.json package-lock.json ./
COPY --link prisma ./prisma
RUN npm ci --include=dev

# Copy application code
COPY --link . .

# Build application
# Prisma expects DATABASE_URL at build time; map from SUPABASE_DATABASE_URL if provided
ARG SUPABASE_DATABASE_URL
ENV DATABASE_URL=${SUPABASE_DATABASE_URL}
ARG CWC_API_KEY
ENV CWC_API_KEY=$CWC_API_KEY
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage
FROM base

# Install runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y openssl curl && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
CMD [ "npm", "run", "start" ]
