# Home Assistant MCP Server Integration Design

**Date:** 2025-10-23
**Status:** Approved for Implementation

## Overview

This design enables full integration between Claude Code/Desktop and Home Assistant, allowing Claude to analyze data, propose automations, and manage YAML configurations with read/write access to the entire Home Assistant system.

## Requirements

- Full access to Home Assistant data (entity states, history, configs, logs, database)
- Full control to create/modify/delete automations and YAML configurations
- Home Assistant OS on Home Assistant Green
- 24/7 availability
- Accessible from Claude Code (CLI) and Claude Desktop (GUI) on Mac
- Maximum functionality prioritized over security restrictions

## Architecture

### Components

1. **MCP Server (Home Assistant Addon)** - Node.js/TypeScript server running 24/7 on HA Green
2. **Claude Code (Mac)** - Connects via SSH transport
3. **Claude Desktop (Mac)** - Connects via SSH transport
4. **Home Assistant APIs** - MCP server uses REST API, WebSocket API, and CLI commands
5. **SSH Access** - MCP server runs local commands for direct filesystem access

### Communication Flow

```
[Claude Code on Mac] ──┐
                        ├─ SSH transport over local network or Tailscale
[Claude Desktop on Mac] ┘
    ↓
[MCP Server Addon on HA Green]
    ↓ local APIs & filesystem
[Home Assistant Core]
```

### Network Access

- **On Selwa network**: Direct SSH connection to HA Green's local IP
- **Remote via Tailscale**: SSH over Tailscale VPN to HA Green
- MCP server runs inside HA OS as addon with full local access to `/config` and Supervisor APIs

## MCP Server Tools

The MCP server exposes these tool categories:

### Entity & State Tools
- `ha_get_states` - Get current state of entities (all or filtered by domain/entity_id)
- `ha_get_history` - Query historical data for entities with time ranges
- `ha_call_service` - Call any Home Assistant service (turn on/off, set values, etc.)
- `ha_get_entity_details` - Get full details including attributes for specific entities

### Configuration Management Tools
- `ha_read_config` - Read any YAML file from /config directory
- `ha_write_config` - Write/update YAML files (automations, scripts, configuration.yaml)
- `ha_list_files` - List files in config directory and subdirectories
- `ha_validate_config` - Check configuration validity before reloading
- `ha_reload_config` - Reload automations, scripts, or core config

### Automation Tools
- `ha_create_automation` - Create new automation with YAML
- `ha_update_automation` - Modify existing automation
- `ha_delete_automation` - Remove automation
- `ha_list_automations` - Get all automations with their current state

### Database & Analytics Tools
- `ha_query_database` - Execute SQL queries against HA database (read-only by default)
- `ha_get_statistics` - Get statistical data for sensors (min/max/avg over time)

### System & Diagnostics Tools
- `ha_get_logs` - Fetch Home Assistant logs with filtering
- `ha_system_info` - Get system health, supervisor info, addon status
- `ha_restart` - Restart Home Assistant (with confirmation)

## Home Assistant Addon Structure

### Installation Method

The addon will be distributed via a **custom GitHub addon repository** for easy installation:

**User Installation Steps:**
1. In Home Assistant UI: Settings → Add-ons → Add-on Store → ⋮ menu → "Repositories"
2. Add the GitHub repository URL
3. Install "Home Assistant MCP Server" addon from the store
4. Configure authentication token in addon configuration UI
5. Start the addon

**What gets automated:**
- Addon builds automatically from GitHub
- All dependencies installed automatically
- Configuration via simple UI form
- Logs visible in HA addon panel
- Auto-restart on HA reboot

### Addon Configuration

Simple configuration exposed in HA UI:
```yaml
auth_token: "user-defined-secret-token"
port: 8339
log_level: info  # debug/info/warning/error
```

### Package Structure

```
homeassistant-mcp-server/
├── config.yaml          # HA addon configuration metadata
├── Dockerfile          # Container build instructions
├── run.sh              # Addon startup script
├── package.json        # Node.js dependencies
├── tsconfig.json       # TypeScript configuration
└── src/
    ├── index.ts        # MCP server entry point
    ├── tools/          # MCP tool implementations
    │   ├── states.ts       # Entity and state tools
    │   ├── config.ts       # Configuration management tools
    │   ├── automation.ts   # Automation tools
    │   ├── database.ts     # Database query tools
    │   └── system.ts       # System and diagnostic tools
    ├── ha-client.ts    # Home Assistant API client wrapper
    └── types.ts        # TypeScript type definitions
```

### How Addon Works

- Runs in its own container within HA OS
- Has access to `/config` volume (Home Assistant configuration)
- Can access Supervisor API at `http://supervisor/`
- Can execute `ha` CLI commands via supervisor
- Exposes MCP interface via stdio over SSH connection

## Client Configuration

### Claude Code Configuration

File: `~/.claude/mcp_settings.json`

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

### Claude Desktop Configuration

File: `~/Library/Application Support/Claude/claude_desktop_config.json`

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

**Setup Requirements:**
- SSH key authentication configured to Home Assistant
- Correct addon container name determined during installation
- Connection tested and verified

## Data Flow & Workflows

### Analysis Workflow (Read-Only)

1. User asks: "Show me temperature trends in the living room over the last week"
2. Claude calls: `ha_get_history` tool → retrieves sensor data
3. Claude analyzes and visualizes the data
4. Completely safe, no system changes

### Automation Creation Workflow (Write)

1. User asks: "Create an automation to turn on lights at sunset"
2. Claude calls: `ha_get_states` to understand available light entities
3. Claude generates YAML automation
4. Claude shows automation to user for review
5. User approves
6. Claude calls: `ha_create_automation` → writes YAML file
7. Claude calls: `ha_validate_config` → checks validity
8. Claude calls: `ha_reload_config` → applies changes
9. Automation active immediately

## Safety Mechanisms

1. **Config Validation**: Always run `ha_validate_config` before `ha_reload_config`
2. **Automatic Backup**: Addon backs up configs before modifying them
3. **Rollback Capability**: Keep last 5 versions of each modified file
4. **Destructive Action Confirmation**: Operations like restart or delete require explicit user confirmation
5. **Read-Only Database**: SQL queries are read-only by default to prevent accidents
6. **Error Preservation**: If validation fails, changes aren't applied and previous config remains active
7. **Operation Logging**: All operations logged for troubleshooting and audit

## Development Plan

### Initial Development Deliverables

1. **MCP Server Core** - TypeScript server using MCP SDK
2. **Home Assistant Client Library** - Wrapper for REST/WebSocket/CLI access
3. **Tool Implementations** - All tools described in this design
4. **Home Assistant Addon Package** - Complete addon with Dockerfile and config
5. **GitHub Repository** - Public repo for easy addon installation
6. **Documentation** - Setup guide, tool reference, troubleshooting guide

### Testing Approach

- Test each tool individually against live HA instance
- Verify read operations work correctly
- Test write operations on non-critical test automations first
- Validate error handling and rollback mechanisms
- Confirm functionality from both Claude Code and Claude Desktop
- Test over local network and Tailscale

### Maintenance

- Addon auto-updates when changes pushed to GitHub (if auto-update enabled)
- Logs available in HA addon panel for troubleshooting
- Version pinning available for stability
- Ongoing support for new tools and features as needed

### Future Enhancements

- Real-time streaming updates (WebSocket events pushed to Claude)
- Custom dashboard generation
- Integration with other HA addons (Node-RED, AppDaemon, etc.)
- Backup/restore automation sets
- Template and script management tools
- Scene and zone management

## Security Considerations

Given the "maximum access" requirement:

**Accepted Risks:**
- Full filesystem read/write access to Home Assistant configuration
- Ability to execute system commands via HA CLI
- Database query access
- Service call capabilities (can control all devices)

**Mitigations in Place:**
- Authentication token required for MCP server access
- SSH key authentication for transport layer
- Network isolation (only accessible on local network or via Tailscale)
- All operations logged
- Automatic backups before modifications
- Config validation before applying changes

**Not Implemented** (by design):
- Rate limiting (trusted client)
- Permission granularity (full access required for use case)
- Read-only mode (defeats purpose)

## Success Criteria

- [ ] Claude Code can query entity states and history
- [ ] Claude Code can read all configuration files
- [ ] Claude Code can create/modify/delete automations
- [ ] Claude Code can query database for analytics
- [ ] Claude Desktop has same capabilities as Claude Code
- [ ] Changes persist across Home Assistant restarts
- [ ] Error handling prevents invalid configurations from being applied
- [ ] Accessible both locally and remotely via Tailscale
- [ ] Installation process simple enough for beginner user
- [ ] All operations complete in under 5 seconds (except large history queries)

## Technical Decisions

### Why MCP Server as Addon (vs other approaches)?
- 24/7 availability without Mac being on
- Native access to HA filesystem and APIs
- Clean integration with both Claude Code and Desktop
- No sync delays or network share complexity
- Most idiomatic for Claude ecosystem

### Why SSH Transport (vs stdio or SSE)?
- Works reliably over network
- Secure authentication built-in
- Compatible with both local and Tailscale access
- No need to expose HTTP endpoints
- Standard approach for remote MCP servers

### Why TypeScript/Node.js?
- MCP SDK officially supports Node.js
- Large ecosystem for Home Assistant API clients
- Familiar for HA addon development
- Good async/await support for API calls
- Easy to maintain and extend

### Why Custom Addon Repository (vs official store)?
- Faster iteration during development
- No approval process required
- Can maintain breaking changes more freely
- Easy for single user or small group
- Can submit to official store later if desired
