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

echo "Starting MCP Server..."
echo "Transport: $TRANSPORT"
echo "Port: $PORT"

cd /app
node dist/index.js
