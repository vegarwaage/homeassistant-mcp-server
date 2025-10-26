# Home Assistant MCP Server

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

## About

This server provides **59 tools** (44 API-level + 15 root-level) that allow Claude AI to interact with your Home Assistant instance with comprehensive access to both the Home Assistant API and the underlying system.

### Tool Categories

#### API Tools (44 tools)
- **Entity Management**: Query states, history, and control devices
- **Configuration**: Read, write, and validate Home Assistant configuration files
- **Automations**: Create, update, delete, and list automations
- **Search & Discovery**: Find entities by name, domain, area, state, and more
- **Organization**: Manage areas, labels, and devices
- **Activity Monitoring**: Track recent entity state changes
- **Natural Language**: Process commands and render Jinja2 templates
- **System Information**: Get diagnostics, logs, and system health
- **Lists & Helpers**: Manage shopping lists, todo lists, and input helpers
- **Media & Cameras**: Control media players and get camera snapshots
- **Energy & Statistics**: Query energy data and long-term statistics
- **Person Tracking**: Get person locations and device trackers
- **Events**: Fire custom events and list event listeners
- **Calendars**: List calendars and retrieve calendar events
- **Logbook**: Get human-readable event history
- **Blueprints**: List and import automation blueprints
- **Notifications**: Send notifications to mobile apps and services

#### Root-Level Tools (15 tools)
- **Filesystem Access** (6 tools): Read, write, list, delete, move files with safety constraints
- **Database Access** (5 tools): Execute SQL queries on Home Assistant recorder database
- **System Commands** (4 tools): Execute shell commands, read logs, check disk usage, restart HA

### Permission System

Root-level tools use a category-based permission system that prompts for one-time approval per session:
- **Filesystem**: Grants access to /config, /ssl, /backup, /share, /media, /addons (blocks /etc, /usr, /bin, /sbin, /sys, /proc)
- **Database**: Grants access to execute SQL queries on the HA recorder database
- **Commands**: Grants access to execute shell commands on the host system

## Installation Options

### Option 1: Home Assistant Add-on (Recommended)

See [ADDON_INSTALL.md](ADDON_INSTALL.md) for complete installation instructions for the Home Assistant add-on.

### Option 2: Manual Deployment

Deploy directly on your Home Assistant OS installation via SSH.

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

### HTTP Transport
For web and mobile clients, the server supports HTTP transport with OAuth 2.1:

```bash
TRANSPORT=http PORT=3000 OAUTH_CLIENT_URL=https://your-ha-url.com node dist/index.js
```

### Authentication
Requires a Home Assistant long-lived access token set as `SUPERVISOR_TOKEN` environment variable.

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
