# Home Assistant MCP Server

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

## About

**Version 2.3.0** introduces production-ready OAuth 2.1 support for Claude.ai and mobile access, with **133 total tools** - 73 API-level tools in domain/system/advanced layers, 45 legacy API tools (including ha_mcp_capabilities), and 15 root-level tools.

### V2.0.0 Layered Architecture (73 new tools)

#### Domain Layer: Entity Management (34 tools)
- **Scenes** (4 tools): List, activate, create, delete scenes
- **Scripts** (6 tools): List, execute, reload, create, update, delete scripts
- **Input Helpers** (8 tools): Create and manage boolean, number, text, select, datetime helpers
- **Areas & Zones** (9 tools): Create, update, delete areas and zones; assign devices
- **Device Registry** (7 tools): List, get, update, enable/disable devices; manage entity registry

#### System Layer: Lifecycle Management (26 tools)
- **Add-on Management** (9 tools): List, start, stop, restart, install, uninstall, update, configure add-ons
- **Integration Management** (7 tools): List, discover, setup, configure, reload, remove integrations
- **HACS** (5 tools): Browse, install, update, remove Home Assistant Community Store repositories
- **Backup & Restore** (5 tools): List, create, restore, get info, delete backups

#### Advanced Layer: Power User Features (13 tools)
- **Bulk Operations** (3 tools): Bulk service calls, turn on/off multiple entities via WebSocket
- **Configuration Search** (4 tools): Search entities, services, automations, configuration
- **Automation Debugging** (3 tools): Get execution traces, list traces, get diagnostics
- **Automation Helpers** (3 tools): Validate config, test conditions, generate templates

### Legacy API Tools (44 tools)
- **Entity Management**: Query states, history, and control devices
- **Configuration**: Read, write, and validate Home Assistant configuration files
- **Automations**: Create, update, delete, and list automations (file-based)
- **Search & Discovery**: Find entities by name, domain, area, state
- **Organization**: Manage areas, labels, and devices
- **Activity Monitoring**: Track recent entity state changes
- **Natural Language**: Process commands and render Jinja2 templates
- **System Information**: Get diagnostics, logs, and system health
- **Lists & Helpers**: Manage shopping lists, todo lists
- **Media & Cameras**: Control media players and get camera snapshots
- **Energy & Statistics**: Query energy data and long-term statistics
- **Person Tracking**: Get person locations and device trackers
- **Events**: Fire custom events and list event listeners
- **Calendars**: List calendars and retrieve calendar events
- **Logbook**: Get human-readable event history
- **Blueprints**: List and import automation blueprints
- **Notifications**: Send notifications to mobile apps and services

### Root-Level Tools (15 tools)
- **Filesystem Access** (6 tools): Read, write, list, delete, move files with safety constraints
- **Database Access** (5 tools): Execute SQL queries on Home Assistant recorder database
- **System Commands** (4 tools): Execute shell commands, read logs, check disk usage, restart HA

### Permission System

⚠️ **Security Notice:** Root-level tools currently **auto-grant all permissions** for single-user deployments. This is appropriate for personal home automation systems but should be reviewed before multi-user or internet-exposed deployments.

Root-level tools are organized into three permission categories with safety constraints:
- **Filesystem**: Access to /config, /ssl, /backup, /share, /media, /addons (blocks /etc, /usr, /bin, /sbin, /sys, /proc)
- **Database**: SQL queries limited to Home Assistant recorder tables (whitelisted)
- **Commands**: Shell command execution on the host system

**Intended Use:** Single-user home automation systems where the user owns the hardware and is the sole operator.

## Installation Options

### Option 1: Home Assistant Add-on (Recommended)

See [ADDON_INSTALL.md](ADDON_INSTALL.md) for complete installation instructions for the Home Assistant add-on.

### Option 2: Manual Deployment

Deploy directly on your Home Assistant OS installation via SSH.

**Note:** The add-on (Option 1) is recommended as it auto-deploys on updates from GitHub.

```bash
# Build on your Mac
npm run build

# Deploy to Home Assistant (use /config for persistence)
scp -r dist/* root@homeassistant.local:/config/mcp-server/dist/
scp package*.json root@homeassistant.local:/config/mcp-server/

# SSH in and install dependencies
ssh root@homeassistant.local "cd /config/mcp-server && npm install --production"
```

## Configuration

### stdio Transport
For Claude Desktop and Claude Code, the server uses stdio transport over SSH.

When installed as an add-on, it auto-deploys to `/config/mcp-server`:

```bash
ssh root@homeassistant.local \
  "cd /config/mcp-server && SUPERVISOR_TOKEN='your_token' node dist/index.js"
```

### HTTP Transport with OAuth 2.1

**Version 2.3.0** introduces production-ready OAuth 2.1 support for Claude.ai and mobile clients.

#### OAuth Implementation Details

This server implements the **June 18, 2025 OAuth 2.1 specification** for MCP servers:

- **RFC 8414**: OAuth 2.0 Authorization Server Metadata (`.well-known/oauth-authorization-server`)
- **RFC 9728**: OAuth 2.0 Protected Resource Metadata (`.well-known/oauth-protected-resource/mcp`)
- **RFC 7591**: Dynamic Client Registration (`/mcp/oauth/register`)
- **RFC 8707**: Resource Indicators for OAuth 2.0 (audience validation)
- **Protocol Version**: `MCP-Protocol-Version: 2025-06-18` header on HEAD requests

#### Security Architecture: Token Wrapping

The server uses **token wrapping** to protect Home Assistant credentials:

1. **Client receives**: Opaque tokens (cryptographically secure random strings)
2. **Server stores**: Home Assistant access/refresh tokens in SQLite (`/config/mcp-sessions.db`)
3. **Token lifecycle**: New opaque tokens issued on refresh, old tokens revoked
4. **Session persistence**: Survives server restarts via SQLite storage

This ensures Home Assistant tokens never leave the server and cannot be extracted from clients.

#### Known Limitation: Claude.ai OAuth Connection

**⚠️ Current Status (November 2025):** Claude.ai remote MCP connections fail with `step=start_error` when using Home Assistant's native OAuth.

**What Works:**
- ✅ OAuth 2.1 spec compliance (June 2025 / 2025-06-18)
- ✅ Dynamic Client Registration (RFC 7591)
- ✅ OAuth discovery endpoints (RFC 8414, RFC 9728)
- ✅ Token wrapping with SQLite persistence
- ✅ Audience binding (RFC 8707)
- ✅ All OAuth endpoints return valid responses

**What Fails:**
- ❌ Claude.ai's OAuth proxy stops after client registration
- ❌ Never redirects to authorization endpoint
- ❌ Error: `step=start_error` in Claude.ai URL

**Root Cause:**
This is a known issue ([anthropics/claude-code#3515](https://github.com/anthropics/claude-code/issues/3515)) with Claude.ai's OAuth proxy validation after dynamic client registration. The OAuth flow completes: Discovery → Registration → **STOP**. The authorization request never arrives at the MCP server.

**Attempted Fixes (November 7, 2025):**
1. ✅ Fixed audience binding to comply with June 2025 spec
2. ✅ Made `resource` parameter mandatory in authorization requests
3. ✅ Added dual protected resource endpoints (with and without `/mcp` suffix)
4. ✅ Verified `token_endpoint_auth_methods_supported` includes `client_secret_post`
5. ✅ Added HEAD endpoints on `/` and `/mcp` for protocol discovery
6. ❌ Issue persists - appears to be Claude.ai proxy validation, not server implementation

**Recommended Approach:**
Use **stdio transport** via SSH for reliable access from Claude Desktop and Claude Code. See stdio transport configuration below.

**Alternative Approach (Untested):**
Third-party OAuth providers (GitHub OAuth, Auth0) are confirmed working with Claude.ai remote MCP servers. However, this changes the security model:
- All users would share a single Home Assistant account
- User identity comes from GitHub/Auth0, not Home Assistant
- Requires implementing custom authorization logic

For single-user deployments, stdio transport is simpler and more secure.

#### Setup for Claude.ai (Experimental - Currently Non-Functional)

**Note:** The following configuration is complete and spec-compliant, but currently fails due to Claude.ai's OAuth proxy validation issue described above.

1. **Configure Environment Variables**:
   ```bash
   TRANSPORT=http
   PORT=3000
   OAUTH_CLIENT_URL=https://your-public-url.com
   SUPERVISOR_TOKEN=your_ha_supervisor_token
   ```

2. **Expose Server**: Use a reverse proxy (nginx, Cloudflare Tunnel) to expose the server with HTTPS

3. **Add to Claude.ai**:
   - Go to Claude.ai MCP settings
   - Add server URL: `https://your-public-url.com`
   - Claude.ai will discover OAuth endpoints via `.well-known/oauth-authorization-server`
   - **Expected result:** `step=start_error` after client registration

#### OAuth Endpoints

When TRANSPORT=http, the server exposes:

- **Discovery**: `/.well-known/oauth-authorization-server`
- **Resource Metadata**: `/.well-known/oauth-protected-resource/mcp`
- **Dynamic Registration**: `/mcp/oauth/register`
- **Authorization**: `/auth/authorize` (redirects to Home Assistant)
- **Token**: `/auth/token` (issues opaque access/refresh tokens)
- **Revocation**: `/auth/revoke`
- **MCP SSE Endpoint**: `/mcp` (requires Bearer token)

#### Session Storage

Sessions are persisted to `/config/mcp-sessions.db` (SQLite) with:

- **sessions**: Home Assistant access/refresh tokens linked to session IDs
- **opaque_tokens**: Client tokens mapped to sessions
- **auth_codes**: Authorization codes linked to sessions
- **oauth_clients**: Dynamically registered OAuth clients

Sessions survive server restarts and include automatic cleanup of expired tokens.

### Authentication

**stdio transport**: Requires Home Assistant long-lived access token set as `SUPERVISOR_TOKEN` environment variable.

**http transport**: Uses OAuth 2.1 flow to obtain tokens from Home Assistant, then issues opaque tokens to clients.

## Available Tools

### Entity Management (4 tools)
- `ha_get_states` - Get current state of entities
- `ha_get_history` - Query historical data with time range filters
- `ha_call_service` - Call any Home Assistant service to control devices
- `ha_get_entity_details` - Get full details and attributes for specific entities

### Configuration Management (6 tools)
- `ha_read_config` - Read configuration files from /config directory
- `ha_write_config` - Write or update configuration files (automatically backs up)
- `ha_list_files` - List files and directories in /config
- `ha_validate_config` - Validate configuration without applying changes
- `ha_reload_config` - Reload automations, scripts, or core configuration
- `ha_list_backups` - List available backups for configuration files

### Automation Management (4 tools)
- `ha_create_automation` - Create new automation in automations.yaml
- `ha_update_automation` - Update existing automation by ID
- `ha_delete_automation` - Delete automation by ID
- `ha_list_automations` - List all automations with IDs and aliases

### Search & Discovery (2 tools)
- `ha_search_entities` - Search entities by name, device class, domain, state, area, or label
- `ha_get_stats` - Get entity count statistics grouped by domain, device_class, area, or label

### Activity Monitoring (1 tool)
- `ha_get_recent_activity` - Get entities that changed state recently with time-based filtering

### Organization (3 tools)
- `ha_list_areas` - List all areas/rooms with entity counts
- `ha_list_labels` - List all labels/tags with entity counts
- `ha_list_devices` - List devices with area filtering and name search

### Natural Language Processing (2 tools)
- `ha_process_conversation` - Process natural language text to control devices
- `ha_render_template` - Render Jinja2 templates using HA template engine

### System Monitoring (3 tools)
- `ha_system_info` - Get Home Assistant system information and health status
- `ha_get_logs` - Fetch Home Assistant logs with optional filtering
- `ha_restart` - Restart Home Assistant (requires confirmation)

### Advanced System (3 tools)
- `ha_get_supervisor_info` - Get supervisor, core, OS, or host information
- `ha_list_integrations` - List all loaded integrations and components
- `ha_get_diagnostics` - Get system diagnostics, health info, and resolution suggestions

### Lists & Helpers (3 tools)
- `ha_manage_shopping_list` - Manage shopping list items (list, add, remove, complete)
- `ha_manage_todo` - Manage todo list items (list, add, remove, complete)
- `ha_list_input_helpers` - List all input helper entities (boolean, number, text, select, datetime)

### Media & Cameras (2 tools)
- `ha_get_camera_snapshot` - Get camera snapshot URL or base64-encoded image data
- `ha_control_media_player` - Control media players (play, pause, stop, volume, etc.)

### Energy & Statistics (2 tools)
- `ha_get_energy_data` - Get energy dashboard data (solar, battery, grid)
- `ha_get_statistics` - Get long-term historical statistics (efficient for > 10 days)

### Person Tracking (1 tool)
- `ha_get_person_location` - Get location info for persons including zone, GPS, and device trackers

### Events (2 tools)
- `ha_fire_event` - Fire a custom event with optional data payload
- `ha_list_event_listeners` - Get all active event listeners and their counts

### Calendars (2 tools)
- `ha_list_calendars` - Get all calendar entities
- `ha_get_calendar_events` - Get calendar events for a date range with pagination

### Logbook (1 tool)
- `ha_get_logbook` - Get human-readable logbook entries with entity filtering and pagination

### Blueprints (2 tools)
- `ha_list_blueprints` - List available blueprints by domain (automation, script)
- `ha_import_blueprint` - Import blueprint from URL (GitHub gist, etc.)

### Notifications (1 tool)
- `ha_send_notification` - Send notification to mobile app or notification service

### Filesystem Access (6 tools - requires permission)
- `ha_read_file` - Read file contents (text or base64-encoded binary) with size limits
- `ha_write_file` - Write or create file with safety checks (blocks system paths)
- `ha_list_directory` - List files and directories with metadata (size, modified, permissions)
- `ha_delete_file` - Delete file or directory (with optional recursive deletion)
- `ha_move_file` - Move or rename file/directory
- `ha_file_info` - Get detailed file metadata (permissions, owner, timestamps)

**Safety**: Blocks writes to /etc, /usr, /bin, /sbin, /sys, /proc. Allows /config, /ssl, /backup, /share, /media, /addons.

### Database Access (5 tools - requires permission)
- `ha_execute_sql` - Execute raw SQL queries (SELECT, INSERT, UPDATE, DELETE)
- `ha_get_state_history` - Query state history from database with filters
- `ha_get_statistics` - Query statistics tables for sensor data
- `ha_purge_database` - Remove old records with configurable retention (DESTRUCTIVE)
- `ha_database_info` - Get database size, table counts, and row counts

**Safety**: Read-only access to /config/home-assistant_v2.db. All operations logged.

### System Commands (4 tools - requires permission)
- `ha_execute_command` - Execute shell commands with timeout and output limits
- `ha_read_logs` - Read HA logs with line limits and grep filtering
- `ha_get_disk_usage` - Show disk space usage for key directories
- `ha_restart_homeassistant` - Restart Home Assistant (requires confirmation)

**Safety**: Full root access after permission granted. All commands logged.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally (requires HA_BASE_URL and SUPERVISOR_TOKEN)
node dist/index.js
```

## Project Structure

```
src/
├── index.ts              # Main entry point, tool registration
├── ha-client.ts          # Home Assistant API client
├── permissions.ts        # Session-based permission manager
├── types.ts              # TypeScript interfaces
├── transports/           # Transport adapters (stdio, HTTP)
└── tools/                # Tool implementations
    ├── states.ts         # Entity state tools
    ├── config.ts         # Configuration tools
    ├── automation.ts     # Automation management
    ├── system.ts         # System operations (API + root)
    ├── search.ts         # Entity search
    ├── activity.ts       # Recent activity
    ├── organization.ts   # Areas, labels, devices
    ├── conversation.ts   # NLP and templates
    ├── monitoring.ts     # System monitoring
    ├── helpers.ts        # Lists and input helpers
    ├── media.ts          # Media and cameras
    ├── energy.ts         # Energy data
    ├── persons.ts        # Person tracking
    ├── events.ts         # Event firing and listeners
    ├── calendars.ts      # Calendar entities and events
    ├── logbook.ts        # Logbook history
    ├── blueprints.ts     # Blueprint management
    ├── notifications.ts  # Notification services
    ├── filesystem.ts     # Filesystem access (root)
    └── database.ts       # Database access (root)
```

## Security Notes

- Root-level tools require explicit permission approval per session
- Filesystem writes are blocked to critical system paths
- Database operations are limited to HA recorder database
- All privileged operations are logged
- OAuth 2.1 support for secure HTTP transport

## Usage

See the main repository README for Claude Desktop/Code configuration instructions, or see [ADDON_INSTALL.md](ADDON_INSTALL.md) for add-on installation.
