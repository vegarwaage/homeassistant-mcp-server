# Home Assistant MCP Server Addon

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

## About

This addon provides a bridge between your Home Assistant instance and Claude AI assistants, allowing Claude to:
- Query entity states and history
- Read and modify configuration files
- Create and manage automations
- Access system logs and diagnostics

## Installation

This addon is installed via the Home Assistant addon store after adding the custom repository.

## Configuration

```yaml
log_level: info  # Options: debug, info, warning, error
```

## Transport Configuration

### stdio (Default)
For Claude Desktop and Claude Code:

```bash
SUPERVISOR_TOKEN='your_token' node dist/index.js
```

### HTTP (Disabled)
HTTP transport is currently disabled pending Claude.ai OAuth support.
To enable in future: `TRANSPORT=http node dist/index.js`

## Usage

After installation, configure Claude Code or Claude Desktop to connect via SSH. See the main repository README for detailed setup instructions.
