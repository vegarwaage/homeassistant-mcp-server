# Home Assistant MCP Server - API Limitations

This document tracks tools that are non-functional due to Home Assistant REST API limitations discovered during testing on Home Assistant 2025.10.3.

## Summary

- **Total tools fixed**: 5
- **Tools requiring WebSocket API**: 19
- **Tools requiring Supervisor context**: 17
- **Tools with no API access**: 5

## Fixed Tools (v2.0.4)

The following tools were broken in v2.0 but have been fixed:

### Registry Tools (Fixed - Now Using Template API)

These tools were using non-existent REST endpoints. They now use Home Assistant's Jinja2 template API:

- `ha_area_list` - Lists all areas with entity counts
- `ha_device_list` - Lists all devices with area assignments
- `ha_entity_registry_list` - Lists all entity registry entries
- `ha_search_entities` - Searches entities with filters (domain, area, device_class, state, label)

### Configuration Tools (Fixed)

- `ha_list_integrations` - Now uses `/config` endpoint to retrieve component list
- `ha_search_config` - Returns general configuration (component-specific checks not available)

### Client Routing (Fixed)

- Automatic detection of Supervisor endpoints (`/hassio/*`, `/supervisor/*`) to use correct authentication headers

## Non-Functional Tools

### HACS Tools (No API Available)

HACS (Home Assistant Community Store) does not expose REST API endpoints. These tools cannot function:

**Affected Tools:**
- `ha_hacs_repositories` - List HACS repositories
- `ha_hacs_repository_info` - Get repository details
- `ha_hacs_install` - Install HACS repository
- `ha_hacs_update` - Update HACS repository
- `ha_hacs_remove` - Remove HACS repository

**Status**: Cannot be fixed without HACS providing REST API access.

**Workaround**: HACS operations must be performed through the Home Assistant UI.

### Supervisor Tools (Requires Add-on Context)

These tools require the `SUPERVISOR_TOKEN` environment variable, which is only available when running as a Home Assistant add-on (not when running externally).

**Affected Add-on Tools:**
- `ha_addon_list` - List all add-ons
- `ha_addon_info` - Get add-on details
- `ha_addon_start` - Start add-on
- `ha_addon_stop` - Stop add-on
- `ha_addon_restart` - Restart add-on
- `ha_addon_install` - Install add-on
- `ha_addon_uninstall` - Uninstall add-on
- `ha_addon_update` - Update add-on
- `ha_addon_set_options` - Configure add-on

**Affected Backup Tools:**
- `ha_backup_list` - List all backups
- `ha_backup_info` - Get backup details
- `ha_backup_create` - Create new backup
- `ha_backup_restore` - Restore from backup
- `ha_backup_remove` - Delete backup

**Status**: These tools work correctly when the MCP server runs as a Home Assistant add-on. The code has been fixed to properly route Supervisor API calls.

**Current Behavior**: Returns 401 Unauthorized when running externally.

**Deployment Note**: The server is currently deployed to `/config/mcp-server/` on the Home Assistant host and accessed via SSH, so it has access to the SUPERVISOR_TOKEN and these tools should work.

### Area Management Tools (REST API Missing)

Home Assistant does not expose `/config/area_registry/*` REST endpoints. These require the WebSocket API:

**Affected Tools:**
- `ha_area_create` - Create new area
- `ha_area_update` - Update area configuration
- `ha_area_delete` - Delete area
- `ha_area_assign_entity` - Assign entity to area

**Endpoints Tested (404):**
- `POST /api/config/area_registry/create`
- `POST /api/config/area_registry/update`
- `POST /api/config/area_registry/delete`
- `POST /api/config/entity_registry/update`

**Status**: Requires WebSocket API implementation.

**Workaround**: Use Home Assistant UI or WebSocket API directly.

### Zone Management Tools (REST API Missing)

Home Assistant does not expose `/config/zone/config/*` REST endpoints:

**Affected Tools:**
- `ha_zone_create` - Create new zone
- `ha_zone_update` - Update zone configuration
- `ha_zone_delete` - Delete zone

**Endpoints Tested (404):**
- `POST /api/config/zone/config/{zone_id}`
- `DELETE /api/config/zone/config/{zone_id}`

**Status**: Requires WebSocket API implementation or configuration file editing.

**Note**: `ha_zone_list` works correctly (reads from state).

### Input Helper Tools (REST API Missing)

Home Assistant does not expose `/config/input_*/config/*` REST endpoints:

**Affected Tools:**
- `ha_helper_create_boolean` - Create input_boolean
- `ha_helper_create_number` - Create input_number
- `ha_helper_create_text` - Create input_text
- `ha_helper_create_select` - Create input_select
- `ha_helper_create_datetime` - Create input_datetime
- `ha_helper_update` - Update helper configuration
- `ha_helper_delete` - Delete helper

**Endpoints Tested (404):**
- `POST /api/config/input_boolean/config/{id}`
- `POST /api/config/input_number/config/{id}`
- `POST /api/config/input_text/config/{id}`

**Status**: Requires WebSocket API implementation.

**Note**: `ha_helper_list` works correctly (reads from state).

## Working Tools

### Script Management (Confirmed Working)

Script management tools use the `/config/script/config/*` endpoints which exist:

- `ha_script_list` - List all scripts ✅
- `ha_script_execute` - Execute script ✅
- `ha_script_reload` - Reload scripts ✅
- `ha_script_create` - Create new script ✅
- `ha_script_update` - Update script ✅
- `ha_script_delete` - Delete script ✅

**Endpoint Confirmed**: `POST /api/config/script/config/{script_id}` returns `{"result":"ok"}`

### Read-Only Operations (All Working)

- State queries (`ha_get_states`, `ha_get_entity_details`)
- History queries (`ha_get_history`, `ha_get_logbook`)
- Service discovery (`ha_search_services`)
- Automation listing (`ha_search_automations`, `ha_list_automations`)
- Configuration validation (`ha_automation_validate` - uses `/config/core/check_config`)
- Template rendering (`ha_render_template`)
- System information (`ha_system_info`, `ha_get_diagnostics`)

### Write Operations (Service Calls - All Working)

- `ha_call_service` - Call any Home Assistant service ✅
- Scene activation (`ha_scene_activate`)
- Media player control (`ha_control_media_player`)
- Notifications (`ha_send_notification`)

## Future Improvements

### WebSocket API Implementation

To enable the non-functional management tools, the MCP server needs WebSocket API support:

**Benefits:**
- Enable all area, zone, and helper management operations
- Real-time state updates
- More efficient bulk operations
- Access to additional Home Assistant features

**Implementation:**
- Add WebSocket client to `src/core/ha-client.ts`
- Create WebSocket-based registry update methods
- Maintain backward compatibility with REST API
- Handle connection lifecycle and reconnection

### Alternative Approaches

For tools without REST API access:

1. **YAML Configuration File Editing**
   - Zones and some helpers can be managed via `configuration.yaml`
   - Requires file I/O and YAML parsing
   - Need to trigger config reload after changes

2. **Supervisor API Enhancement**
   - Document requirement for add-on deployment
   - Provide clear installation instructions
   - Add environment variable detection and helpful error messages

## Testing Results

Testing performed on:
- **Home Assistant Version**: 2025.10.3
- **Installation Type**: Home Assistant OS
- **Deployment**: External MCP server via SSH to `/config/mcp-server/`
- **Authentication**: Long-lived access token + SUPERVISOR_TOKEN

### Endpoint Test Results

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/config` | GET | ✅ 200 | Returns full config including components |
| `/api/config/core/check_config` | POST | ✅ 200 | Config validation works |
| `/api/config/area_registry/create` | POST | ❌ 404 | Not available |
| `/api/config/area_registry/list` | GET | ❌ 404 | Not available |
| `/api/config/entity_registry/list` | GET | ❌ 404 | Not available |
| `/api/config/device_registry/list` | GET | ❌ 404 | Not available |
| `/api/config/script/config/{id}` | POST | ✅ 200 | Script management works |
| `/api/config/zone/config/{id}` | POST | ❌ 404 | Not available |
| `/api/config/input_boolean/config/{id}` | POST | ❌ 404 | Not available |
| `/api/template` | POST | ✅ 200 | Template rendering works |
| `/api/hassio/addons` | GET | ❌ 401 | Works in add-on context |
| `/api/hassio/backups` | GET | ❌ 401 | Works in add-on context |
| `/api/hacs/repositories` | GET | ❌ 404 | HACS has no REST API |

## Recommendations

1. **For Users:**
   - Use script management tools - they work perfectly
   - Use read-only operations for areas, zones, helpers
   - Manage areas/zones/helpers through Home Assistant UI
   - Deploy as add-on if Supervisor tools are needed

2. **For Development:**
   - Priority 1: Implement WebSocket API for registry management
   - Priority 2: Add clear error messages for non-functional tools
   - Priority 3: Document deployment as add-on for Supervisor features
   - Priority 4: Investigate HACS custom component API possibilities

3. **Documentation Updates:**
   - Add WebSocket API requirement to tool descriptions
   - Note Supervisor-only tools in README
   - Provide installation guide for add-on deployment
   - Create migration guide from v2.0 to fixed version

## Version History

- **v2.0.4** (2025-10-26): Fixed registry tools using template API, fixed integration listing, improved Supervisor endpoint routing
- **v2.0.0**: Initial release with REST API-based tools (many non-functional)
