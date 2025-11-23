# syntax=docker/dockerfile:1

# Base stage
FROM node:20-slim as base

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
# Prisma expects DATABASE_URL at build time; accept either DATABASE_URL or SUPABASE_DATABASE_URL
ARG DATABASE_URL
ARG SUPABASE_DATABASE_URL
# Use DATABASE_URL if set, otherwise fallback to SUPABASE_DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-${SUPABASE_DATABASE_URL}}
ARG CWC_API_KEY
ENV CWC_API_KEY=$CWC_API_KEY
# API keys for content moderation (can be placeholders for build)
ARG OPENAI_API_KEY=sk-test-placeholder
ARG GEMINI_API_KEY=test-placeholder
ARG ANTHROPIC_API_KEY=test-placeholder
ARG CONSENSUS_TYPE=single
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV CONSENSUS_TYPE=$CONSENSUS_TYPE
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
