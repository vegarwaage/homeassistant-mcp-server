#!/usr/bin/with-contenv bashio

# Get config from addon options
LOG_LEVEL=$(bashio::config 'log_level')

# Export supervisor token for API access
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

# Log startup
bashio::log.info "Starting Home Assistant MCP Server..."
bashio::log.info "Log level: ${LOG_LEVEL}"

# Start MCP server
cd /app
exec node dist/index.js
