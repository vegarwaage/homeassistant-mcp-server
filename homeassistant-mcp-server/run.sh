#!/usr/bin/env bash
set -e

CONFIG_PATH=/data/options.json
DEPLOY_PATH=/config/mcp-server

TRANSPORT=$(jq -r '.transport' $CONFIG_PATH)
PORT=$(jq -r '.port' $CONFIG_PATH)
OAUTH_CLIENT_URL=$(jq -r '.oauth_client_url' $CONFIG_PATH)

export TRANSPORT=$TRANSPORT
export PORT=$PORT
export OAUTH_CLIENT_URL=$OAUTH_CLIENT_URL
export HA_URL="http://supervisor/core"
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

echo "Deploying MCP Server to ${DEPLOY_PATH}..."

# Create deployment directory
mkdir -p ${DEPLOY_PATH}

# Copy built files
cp -r /app/dist ${DEPLOY_PATH}/
cp /app/package.json ${DEPLOY_PATH}/
cp /app/package-lock.json ${DEPLOY_PATH}/ 2>/dev/null || true

# Install production dependencies
echo "Installing dependencies..."
cd ${DEPLOY_PATH}
npm install --production --no-audit --no-fund 2>&1 | grep -v "npm warn" || true

echo "✓ MCP Server deployed to ${DEPLOY_PATH}"
echo "  Transport: $TRANSPORT"
echo "  Version: $(node -p "require('./package.json').version")"
echo ""
echo "Connect Claude Desktop/Code with:"
echo "  cd /config/mcp-server && SUPERVISOR_TOKEN='***' node dist/index.js"
echo ""
echo "Add-on will remain running to enable auto-updates on restart."

# Keep container alive so add-on stays "started"
sleep infinity
