#!/usr/bin/env bash
set -e

CONFIG_PATH=/data/options.json

TRANSPORT=$(jq -r '.transport' $CONFIG_PATH)
PORT=$(jq -r '.port' $CONFIG_PATH)
OAUTH_CLIENT_URL=$(jq -r '.oauth_client_url' $CONFIG_PATH)

export TRANSPORT=$TRANSPORT
export PORT=$PORT
export OAUTH_CLIENT_URL=$OAUTH_CLIENT_URL
export HA_URL="http://supervisor/core"
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

# Write env vars to file for docker exec sessions
cat > /app/.env << EOF
TRANSPORT=$TRANSPORT
PORT=$PORT
OAUTH_CLIENT_URL=$OAUTH_CLIENT_URL
HA_URL=http://supervisor/core
SUPERVISOR_TOKEN=$SUPERVISOR_TOKEN
EOF

echo "MCP Server add-on ready"
echo "Transport: $TRANSPORT"
echo "Connect via: docker exec -i addon_c6043944_ha-mcp-server-v2 sh -c 'source /app/.env && node /app/dist/index.js'"

# Keep container alive for docker exec access
sleep infinity
