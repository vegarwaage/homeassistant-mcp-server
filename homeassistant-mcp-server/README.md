# Home Assistant MCP Server

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

## About

This server provides 36 tools that allow Claude AI to interact with your Home Assistant instance:
- Query and control entities (states, history, services)
- Search and organize (areas, labels, devices, entities)
- Manage configurations and automations
- Monitor system health and logs
- Process natural language commands
- Control media players and cameras
- Track energy usage and statistics
- Manage todo and shopping lists
- Get person location data

## Installation

This server is deployed directly on your Home Assistant OS installation via SSH.

### Deployment

```bash
# Build on your Mac
npm run build

# Deploy to Home Assistant
scp -r dist/* root@homeassistant.local:/root/ha-mcp-server/dist/
```

## Configuration

### stdio Transport
For Claude Desktop and Claude Code, the server uses stdio transport over SSH:

```bash
ssh root@homeassistant.local \
  "cd /root/ha-mcp-server && SUPERVISOR_TOKEN='your_token' node dist/index.js"
```

### Authentication
Requires a Home Assistant long-lived access token set as `SUPERVISOR_TOKEN` environment variable.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (if available)
npm test
```

## Project Structure

```
src/
├── index.ts              # Main entry point, tool registration
├── ha-client.ts          # Home Assistant API client
├── types.ts              # TypeScript interfaces
└── tools/                # Tool implementations
    ├── states.ts         # Entity state tools
    ├── config.ts         # Configuration tools
    ├── automation.ts     # Automation management
    ├── system.ts         # System operations
    ├── search.ts         # Entity search
    ├── activity.ts       # Recent activity
    ├── organization.ts   # Areas, labels, devices
    ├── conversation.ts   # NLP and templates
    ├── monitoring.ts     # System monitoring
    ├── helpers.ts        # Lists and input helpers
    ├── media.ts          # Media and cameras
    ├── energy.ts         # Energy data
    └── persons.ts        # Person tracking
```

## Usage

See the main repository README for Claude Desktop/Code configuration instructions.
