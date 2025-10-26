# Changelog

All notable changes to the Home Assistant MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
