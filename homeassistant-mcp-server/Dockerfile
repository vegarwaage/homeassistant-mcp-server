FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache \
    bash \
    jq \
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

CMD ["/app/run.sh"]
