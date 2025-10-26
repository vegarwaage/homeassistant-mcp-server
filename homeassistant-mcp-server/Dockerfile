FROM node:20-alpine

# Install dependencies (including jq for config parsing and git for GitHub auto-deployment)
# Cache bust: 2025-10-26-v3
RUN apk add --no-cache \
    bash \
    jq \
    git \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript compiler)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies to reduce image size
RUN npm prune --production

# Make run script executable
RUN chmod +x /app/run.sh

# Run script sets up env vars and keeps container alive
CMD ["/app/run.sh"]
