# Home Assistant MCP Server

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

**Status**: ✅ Fully working with stdio transport (SSH-based)
**Version**: 0.1.3
**Last Updated**: October 25, 2025

## Features

### Entity & State Management
- Query current entity states
- Access historical data with time ranges
- Call any Home Assistant service
- Get detailed entity information

### Configuration Management
- Read any configuration file
- Write and update YAML configs
- Automatic backup before modifications
- Configuration validation
- Selective reload (automations, scripts, core)

### Automation Tools
- Create new automations
- Update existing automations
- Delete automations
- List all automations

### System & Diagnostics
- System information and health
- Log fetching and filtering
- Restart capabilities

## Installation

### Via Custom Repository (Recommended)

1. In Home Assistant: **Settings** → **Add-ons** → **Add-on Store** → **⋮ menu** → **Repositories**
2. Add repository URL: `https://github.com/selwa/homeassistant-mcp-server`
3. Find "Home Assistant MCP Server" in the add-on store
4. Click **Install**
5. Configure addon (see Configuration section)
6. Start the addon

### Manual Installation

1. SSH into your Home Assistant
2. Clone this repository to `/addons/homeassistant-mcp-server`
3. Refresh addon store
4. Install from Local Add-ons

## Configuration

Configure via addon configuration UI:

```yaml
log_level: info  # debug, info, warning, error
```

## Architecture

The server uses a **monolithic with transport layer** design:
- **Core**: Unified codebase with all Home Assistant tools
- **Transport**: stdio (SSH-based) - fully working
- **Future**: HTTP transport with OAuth (disabled, pending Claude.ai OAuth completion)

## Connecting Claude Clients

### Claude Code (Recommended Method)

Use the CLI to configure MCP server:

```bash
claude mcp add --transport stdio --scope user homeassistant \
  ssh root@homeassistant.local \
  "cd /root/ha-mcp-server && SUPERVISOR_TOKEN='your_token_here' node dist/index.js"
```

This updates `~/.claude.json` with the correct configuration.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "-p", "22",
        "-i", "~/.ssh/id_rsa",
        "root@homeassistant.local",
        "docker", "exec", "-i", "addon_local_homeassistant_mcp", "node", "/app/dist/index.js"
      ]
    }
  }
}
```

**Note:** Replace `homeassistant.local` with your HA IP address if needed. Adjust container name if different.

## Available Tools

### State Tools
- `ha_get_states` - Get entity states
- `ha_get_history` - Query historical data
- `ha_call_service` - Control devices
- `ha_get_entity_details` - Get entity details

### Config Tools
- `ha_read_config` - Read config files
- `ha_write_config` - Write config files
- `ha_list_files` - List config directory
- `ha_validate_config` - Validate configuration
- `ha_reload_config` - Reload configs
- `ha_list_backups` - List file backups

### Automation Tools
- `ha_create_automation` - Create automation
- `ha_update_automation` - Update automation
- `ha_delete_automation` - Delete automation
- `ha_list_automations` - List all automations

### System Tools
- `ha_system_info` - System information
- `ha_get_logs` - Fetch logs
- `ha_restart` - Restart Home Assistant

## Safety Features

- **Automatic Backups**: All config modifications backed up automatically
- **Validation**: Config validated before applying changes
- **Rollback**: Last 5 versions kept for each file
- **Confirmation**: Destructive actions require explicit confirmation

## Project Structure

```
homeassistant-mcp-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── ha-client.ts          # Home Assistant client
│   ├── types.ts              # TypeScript interfaces
│   ├── backup.ts             # Backup system
│   └── tools/                # Tool implementations
│       ├── states.ts         # Entity & state tools
│       ├── config.ts         # Configuration tools
│       ├── automation.ts     # Automation tools
│       └── system.ts         # System & diagnostic tools
├── docs/
│   ├── plans/                # Current implementation plans
│   └── archive/              # Historical design documents
└── package.json
```

## Recent Changes

### October 25, 2025 - Refactoring Release
- ✅ Extracted tool definitions to eliminate duplication (DRY)
- ✅ Made environment variables explicit with validation
- ✅ Improved error handling with clear warnings
- ✅ Reduced index.ts from 289 to 124 lines
- ✅ All 17 tools now have co-located schemas and handlers

## Development

```bash
cd homeassistant-mcp-server
npm install
npm run build
npm start
```

## Troubleshooting

### Check addon logs
Home Assistant → Settings → Add-ons → Home Assistant MCP Server → Logs

### Test SSH connection
```bash
ssh root@homeassistant.local "docker exec -i addon_local_homeassistant_mcp node /app/dist/index.js"
```

### Verify addon is running
Home Assistant → Settings → Add-ons → Check status

## License

MIT

## Author

Vegar Selvik Wavik
