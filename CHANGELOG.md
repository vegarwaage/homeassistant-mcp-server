# Changelog

All notable changes to the Home Assistant MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-01-08

### Added

#### Floor & Label Registry (12 new tools)
- **Floor Management** (5 tools): List, create, update, delete floors; get entities by floor
- **Label Management** (7 tools): List, create, update, delete labels; get entities/devices/areas by label

#### Service Call Enhancements
- `ha_call_service` now supports `floor_id` and `label_id` targeting (HA 2024.4+)
- Multiple target types can be combined (entity_id, device_id, area_id, floor_id, label_id)

#### WebSocket Improvements
- Generic `sendCommand()` method for registry operations

### Changed
- Total tool count increased from 135 to 147 tools

---

## [2.5.0] - 2026-01-08

### Added
- Context-aware response limiting and pagination
- `limit`, `offset`, and `minimal` parameters to ha_get_states (default: 50)
- `limit` and `minimal` mode to ha_search_services (default: 50)
- `limit` and `include_entities` option to ha_list_devices (default: 50)
- `max_lines` and `line_offset` pagination to ha_read_config
- `limit`, `type` filter, and `minimal` mode to ha_list_input_helpers
- Global response size limiter with truncation at 200k chars
- Standardized sanitization utilities (sanitizeId, sanitizeEntityId, etc.)
- validateLimit, validateOffset, estimateTokens helpers

### Changed
- Remove duplicate ha_search_entities from advanced layer

---

## [2.4.0] - 2025-12-10

### Added

#### REST API Enhancements
- `return_response` parameter to ha_call_service for services that return data (HA 2024.8+)
- `no_attributes` parameter to ha_get_history for minimal responses
- ha_get_components tool (GET /api/components)
- ha_get_error_log tool (GET /api/error_log)
- ha_check_config_rest tool (POST /api/config/core/check_config)

#### WebSocket Improvements
- `coalesce_messages` support for batched responses
- `extract_from_target` command for resolving areas/floors/labels to entity IDs (HA 2025+)
- `validateConfig` method for syntax validation
- `getStates` method for efficient state retrieval

#### Automation Template Enhancements
- Support HA 2025.12 domain-specific triggers (light, climate, fan)
- Target-first approach with area_id, floor_id, label_id support
- condition_config and mode parameters

#### History API Improvements
- `state_filter` parameter for filtering by state values
- `limit/offset` pagination parameters
- ha_find_unavailable_devices tool for efficient offline detection

### Changed
- Dynamic transport imports to reduce bundle size

---

## [2.3.0] - 2025-11-xx

### Added
- Production-ready OAuth 2.1 for Claude.ai and mobile

---

## [2.2.0] - 2025-11-xx

### Changed
- Version bump for add-on update detection

---

## [2.1.0] - 2025-11-xx

### Added
- Improved Claude Code awareness
- Production-ready HTTP transport with OAuth refresh and SQLite persistence

### Fixed
- Documentation improvements

---

## [2.0.0] - 2025-10-26

### Added

#### Core Layer
- **SSEManager**: Real-time event subscriptions with filtering and auto-reconnection
- **WebSocketClient**: Bulk operations over single persistent WebSocket connection
- **Connection Pooling**: Queue-based concurrency limiting for API requests
- **Retry Logic**: Exponential backoff with configurable max attempts

#### Domain Layer (34 new tools)
- **Scene Management** (4 tools): List, activate, create, delete scenes
- **Script Management** (6 tools): List, execute, reload, create, update, delete scripts
- **Input Helpers** (8 tools): Create and manage boolean, number, text, select, datetime helpers
- **Areas & Zones** (9 tools): Create, update, delete areas and zones; assign devices
- **Device Registry** (7 tools): List, get, update, enable/disable devices; manage entity registry

#### System Layer (26 new tools)
- **Add-on Management** (9 tools): List, start, stop, restart, install, uninstall, update, configure add-ons
- **Integration Management** (7 tools): List, discover, setup, configure, reload, remove integrations
- **HACS Management** (5 tools): Browse, install, update, remove HACS repositories
- **Backup & Restore** (5 tools): List, create, restore, get info, delete backups

#### Advanced Layer (13 new tools)
- **Bulk Operations** (3 tools): Bulk service calls, turn on/off multiple entities via WebSocket
- **Configuration Search** (4 tools): Search entities, services, automations, configuration
- **Automation Debugging** (3 tools): Get execution traces, list traces, get diagnostics
- **Automation Helpers** (3 tools): Validate config, test conditions, generate templates

### Changed
- Reorganized codebase into layered architecture (core/domain/system/advanced)
- Total tool count increased from 59 to 132 tools
- Improved type safety across all layers
- Enhanced error handling and retry logic

### Technical Details
- 46 unit tests covering core and domain layers
- TypeScript strict mode enabled
- ESM module system with proper type exports
- Factory pattern for tool creation
- Adapter pattern for legacy tool compatibility

## [1.1.0] - Previous Release

### Added
- HTTP transport with OAuth 2.1 support
- Root-level tools (filesystem, database, system commands)
- Permission system for root-level operations
- Auto-deployment via Home Assistant add-on

### Changed
- Improved error handling and logging
- Enhanced documentation

## [1.0.0] - Initial Release

### Added
- Initial MCP server implementation
- 44 API-level tools
- stdio transport for Claude Desktop/Code
- Basic Home Assistant API integration
