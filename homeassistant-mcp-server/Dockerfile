FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache \
    bash \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Make run script executable
RUN chmod +x /app/run.sh

CMD ["/app/run.sh"]
