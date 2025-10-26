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

# Check if git repo exists, if not initialize it
if [ ! -d "${DEPLOY_PATH}/.git" ]; then
    echo "Initializing GitHub deployment..."
    cd ${DEPLOY_PATH}
    git init
    git remote add origin https://github.com/vegarwaage/homeassistant-mcp-server.git
    git fetch origin main
    git checkout -b main origin/main
else
    echo "Pulling latest code from GitHub..."
    cd ${DEPLOY_PATH}
    git fetch origin main
    git reset --hard origin/main
fi

# Install dependencies and build
echo "Installing dependencies and building..."
npm install --no-audit --no-fund 2>&1 | grep -v "npm warn" || true
npm run build 2>&1 || true

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
