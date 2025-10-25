# Home Assistant MCP Server - Root Access Design

**Date:** 2025-10-26
**Status:** Approved for Implementation

## Overview

Expand the Home Assistant MCP server from API-only access (36 tools) to full root-level system access. Package as a Home Assistant add-on with privileged access to filesystem, database, and system commands while maintaining all existing API functionality.

## Goals

- **Complete API Coverage:** Add 7 missing API tools for events, calendars, logbook, blueprints, and notifications (43 API tools total)
- **Root-Level Access:** Add 15 system tools for filesystem, database, and command execution
- **Dual Transport:** Support stdio (SSH for desktop) and HTTP (OAuth for iOS/web)
- **Safety:** Permission system with category-based approvals and filesystem safety constraints
- **Token Efficiency:** Pagination, limits, and smart defaults to prevent context explosion

## Architecture

### Deployment Model

**Home Assistant Add-on** installed via GitHub repository URL.

**Privileges Required:**
- `privileged: true` - Host access
- `apparmor: false` - Bypass restrictions
- `host_network: true` - Network access
- Mapped directories (all read-write): `/config`, `/ssl`, `/backup`, `/share`, `/addons`, `/media`

### Transport Options

**Dual Transport Support:**
- **stdio transport:** SSH-based for Claude Desktop (works today)
- **HTTP transport:** OAuth 2.1 for iOS/web (ready when Anthropic fixes OAuth)
- User selects transport via add-on configuration options

### Directory Structure

```
homeassistant-mcp-server/
├── config.yaml              # Add-on manifest
├── Dockerfile              # Container build with host access
├── run.sh                  # Startup script - transport selection
├── package.json            # Dependencies including sqlite3
├── src/
│   ├── index.ts            # Entry point
│   ├── permissions.ts      # Session permission manager
│   ├── transports/
│   │   ├── stdio.ts        # SSH transport
│   │   └── http.ts         # OAuth transport
│   └── tools/
│       ├── [existing 13 API modules - 36 tools]
│       ├── events.ts       # NEW API: 2 tools
│       ├── calendars.ts    # NEW API: 2 tools
│       ├── logbook.ts      # NEW API: 1 tool
│       ├── blueprints.ts   # NEW API: 2 tools
│       ├── notifications.ts # NEW API: 1 tool
│       ├── filesystem.ts   # NEW SYSTEM: 6 tools
│       ├── database.ts     # NEW SYSTEM: 5 tools
│       └── system.ts       # NEW SYSTEM: 4 tools
└── dist/                   # Compiled JavaScript
```

## Permission System

### Categories

Three permission categories, each requested once per session on first use:

1. **Filesystem Access** - File read/write operations
2. **Database Access** - SQL queries
3. **Command Execution** - Shell commands

### Permission Flow

```
1. User requests operation requiring privileged access
2. Claude calls system tool
3. Tool checks session permissions for category
4. If first use of category:
   a. Return permission request with warning
   b. Claude shows warning to user
   c. User approves or denies
   d. Response sent back to tool
5. If approved or already granted:
   a. Execute operation with safety checks
   b. Return result
6. If denied:
   a. Block all operations in this category for session
   b. Return error
```

### Safety Constraints

**Enforced regardless of permission approval:**

**Filesystem Writes Blocked:**
- `/etc/*`, `/usr/*`, `/bin/*`, `/sbin/*`, `/sys/*`, `/proc/*`

**Filesystem Access Allowed:**
- `/config/*`, `/ssl/*`, `/backup/*`, `/share/*`, `/media/*`, `/addons/*`

**Database Access:**
- Read-write to Home Assistant recorder database only
- Path: `/config/home-assistant_v2.db`

**Command Execution:**
- No restrictions after permission granted (user has approved root access)

## Tool Specifications

### New API Tools (7 tools, 5 modules)

#### events.ts (2 tools)
- `ha_fire_event` - Fire custom events with data payload
- `ha_list_event_listeners` - Get all active event listeners

#### calendars.ts (2 tools)
- `ha_list_calendars` - Get all calendar entities
- `ha_get_calendar_events` - Get events for date range (supports `limit`, `offset`)

#### logbook.ts (1 tool)
- `ha_get_logbook` - Get human-readable logbook entries (supports `limit`, `offset`)

#### blueprints.ts (2 tools)
- `ha_list_blueprints` - List available blueprints by domain
- `ha_import_blueprint` - Import blueprint from URL

#### notifications.ts (1 tool)
- `ha_send_notification` - Send notification to mobile app or service

### New System Tools (15 tools, 3 modules)

#### filesystem.ts (6 tools)
- `ha_read_file` - Read file (text or binary as base64), `max_size` limit (default: 1MB)
- `ha_write_file` - Write/create file with safety checks
- `ha_list_directory` - List files with metadata, supports `limit`, excludes hidden files by default
- `ha_delete_file` - Delete file or directory
- `ha_move_file` - Move/rename files
- `ha_file_info` - Get detailed file metadata (permissions, owner, size, timestamps)

#### database.ts (5 tools)
- `ha_execute_sql` - Raw SQL query execution, warns if SELECT without LIMIT
- `ha_get_state_history` - Query states table with filters, built-in `limit` (default: 100)
- `ha_get_statistics` - Query statistics tables, built-in `limit`
- `ha_purge_database` - Remove old records with configurable retention
- `ha_database_info` - Get database size, table counts, row counts

#### system.ts (4 tools)
- `ha_execute_command` - Run shell commands with timeout (default: 30s)
- `ha_read_logs` - Read HA logs with filtering, `lines` parameter (default: 100)
- `ha_get_disk_usage` - Show disk space for key directories
- `ha_restart_homeassistant` - Trigger HA restart (requires confirmation)

### Total Tool Count

- **43 API tools** (36 existing + 7 new)
- **15 system tools** (new)
- **58 total tools**

## Token Efficiency

### Pagination Standards

All tools returning lists implement:
- `limit` parameter (default: 100, max: 1000)
- `offset` parameter (default: 0)

### File Operation Limits

- `ha_read_file`: `max_size` parameter (default: 1MB), returns error if file exceeds limit
- `ha_list_directory`: `limit` parameter, excludes hidden files by default
- `ha_read_logs`: `lines` parameter (default: 100)

### Database Efficiency

- `ha_execute_sql`: Warns if SELECT query has no LIMIT clause
- All database helpers: Built-in `limit` parameter
- Large result sets: Return row count + first N rows with pagination suggestion

### Response Summaries

- Tools returning >100 items: Include total count + suggest pagination
- Large file reads: Offer summary mode (first/last N lines)

## Data Flow Example

**Scenario:** User on iOS asks to read `automations.yaml`

```
1. User: "Show me my automations.yaml"
2. Claude → MCP Request → HTTP OAuth → Add-on
3. Add-on permissions.ts: Check session
   → First filesystem operation? YES
   → Return permission request
4. Claude → Display warning about filesystem access
5. User: Approves
6. Claude → Retry request with approval → Add-on
7. Add-on:
   a. permissions.ts: Record filesystem approval for session
   b. filesystem.ts: Check path safety (/config/automations.yaml → allowed)
   c. Check file size (under 1MB limit)
   d. fs.readFile('/config/automations.yaml')
   e. Return content
8. Claude → Show file to user
9. Subsequent file operations in session: No permission prompt needed
```

## Configuration

**Add-on Options (config.yaml):**
- `transport`: "stdio" or "http"
- `port`: HTTP port (default: 3000)
- `oauth_client_url`: OAuth callback URL (required for HTTP transport)
- `supervisor_token`: Auto-injected by HA Supervisor
- `ha_url`: Home Assistant URL (default: "http://supervisor/core")

## Error Handling

- **Permission denied:** Clear message explaining which category was denied
- **Safety violations:** Explain why path is blocked and which paths are allowed
- **Database errors:** Include SQL context and query
- **Command timeouts:** Default 30s, configurable per command
- **File size exceeded:** Suggest using summary mode or direct file access
- All errors logged to add-on logs for debugging

## Testing Strategy

1. **Local Development:** Test each tool in local HA installation
2. **Permission Flow:** Verify each category triggers approval correctly
3. **Safety Constraints:** Attempt blocked operations, verify rejection
4. **Token Efficiency:** Test large file/database operations, verify limits work
5. **Dual Transport:** Test both stdio (desktop) and HTTP (when OAuth fixed)
6. **Documentation:** Document example tool calls for each new tool

## Deployment

1. **Repository Structure:** Add-on files in `homeassistant-mcp-server/` directory
2. **GitHub Repository:** Push to `homeassistant-assistant` repo
3. **Installation:** Users add repository URL to HA Supervisor
4. **Documentation:** Update README with installation instructions and add-on configuration
5. **Versioning:** Bump to v0.3.0 (new major features)

## Implementation Sequence

1. Add 7 new API tools (events, calendars, logbook, blueprints, notifications)
2. Add permissions.ts session manager
3. Add 15 root-level tools with permission checks
4. Create add-on structure (config.yaml, Dockerfile, run.sh)
5. Add pagination/limits to all list-returning tools
6. Test locally in Home Assistant
7. Update documentation
8. Commit and deploy

## Success Criteria

- ✅ All 58 tools work correctly
- ✅ Permission system prompts once per category
- ✅ Safety constraints prevent system file corruption
- ✅ No token explosions from large responses
- ✅ Both stdio and HTTP transports functional
- ✅ Add-on installable via GitHub repository URL
- ✅ Clear documentation for all new tools
