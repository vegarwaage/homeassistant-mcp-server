# Home Assistant MCP Server: Comprehensive Feature Expansion

**Date:** October 26, 2025
**Status:** Design
**Target:** Version 2.0.0

## Executive Summary

This design expands our Home Assistant MCP server from 36 tools to approximately 70 tools by adding 14 high-value feature categories. The expansion uses a layered service architecture to maintain code quality while doubling capability.

**Goals:**
- Achieve most comprehensive Home Assistant MCP server available
- Maintain solid architecture and efficient performance
- Enable full Home Assistant control without manual YAML editing

**Approach:** Big-bang implementation with all features developed together for architectural consistency.

## Current State

**Version 1.1.0 provides:**
- 36 tools across 12 categories
- Configuration management with automatic backups
- System diagnostics and health monitoring
- Natural language processing via Jinja2
- Energy data and statistics
- Media control and person tracking
- File operations and database queries

**Architecture:**
- Monolithic design with category-based tool files (states.ts, config.ts, automation.ts, system.ts)
- Single HA REST API client (ha-client.ts)
- Stdio transport (SSH-based, working)
- HTTP transport (OAuth, disabled pending Claude.ai support)

## Feature Gap Analysis

**Research into competing implementations revealed these valuable additions:**

| Feature | Source | Priority | Impact |
|---------|--------|----------|--------|
| Real-Time Updates (SSE) | tevonsb, cronus42 | High | Enables reactive LLM responses |
| Scene Management | cronus42 | High | Simplifies multi-device control |
| Helper Entity Management | homeassistant-ai | High | Dynamic automation configuration |
| Script Management | homeassistant-ai, cronus42 | High | Reusable automation sequences |
| Area & Zone Management | cronus42 | High | Better spatial organization |
| Add-on Management | tevonsb | Medium | Full HA lifecycle control |
| HACS Integration | tevonsb | Medium | Community integration access |
| Device Registry Management | cronus42 | Medium | Advanced device organization |
| Integration Management | cronus42 | Medium | Dynamic integration control |
| Automation Duplication | tevonsb | Medium | Faster automation creation |
| Backup & Restore (full) | homeassistant-ai | Medium | System-level safety net |
| Automation Trace Debugging | cronus42 | Medium | Better troubleshooting |
| Configuration Search | homeassistant-ai | Medium | Improved discoverability |
| Bulk Device Control | homeassistant-ai | Medium | Multi-device efficiency |

## Proposed Architecture

### Layer Design

The system divides into four layers, each with a single responsibility:

```
┌─────────────────────────────────────────┐
│  MCP INTERFACE (index.ts)               │
│  - Tool registration & routing          │
│  - Schema validation                    │
└─────────────────────────────────────────┘
           ↓ calls
┌─────────────────────────────────────────┐
│  ADVANCED LAYER                         │
│  - Bulk operations                      │
│  - Configuration search                 │
│  - Trace debugging                      │
│  - Automation helpers                   │
└─────────────────────────────────────────┘
           ↓ uses
┌─────────────────────────────────────────┐
│  DOMAIN LAYER                           │
│  - Scenes                               │
│  - Scripts                              │
│  - Helpers (input_*)                    │
│  - Areas & Zones                        │
│  - Device Registry                      │
└─────────────────────────────────────────┘
           ↓ uses
┌─────────────────────────────────────────┐
│  SYSTEM LAYER                           │
│  - Add-on Management                    │
│  - Integration Management               │
│  - Backup & Restore                     │
│  - HACS Integration                     │
└─────────────────────────────────────────┘
           ↓ uses
┌─────────────────────────────────────────┐
│  CORE LAYER                             │
│  - HA Client (REST API)                 │
│  - SSE Manager (real-time events)       │
│  - WebSocket Client (bulk ops)          │
│  - Transport (stdio/http)               │
└─────────────────────────────────────────┘
```

**Layer Responsibilities:**

- **Core:** Connection primitives (REST, SSE, WebSocket), transport management
- **System:** Home Assistant lifecycle operations (add-ons, integrations, backups)
- **Domain:** Entity and configuration operations (scenes, scripts, helpers, areas, devices)
- **Advanced:** Composed operations leveraging lower layers (bulk control, search, debugging)
- **MCP Interface:** Tool registration, schema validation, routing to layers

**Layer Rules:**
1. Layers call only downward, never upward
2. Each layer exports typed interfaces
3. No cross-layer dependencies at same level
4. Shared utilities live in Core

### Core Layer

**Location:** `src/core/`

**Components:**

1. **HAClient** (enhanced `ha-client.ts`)
   - REST API operations (GET, POST, DELETE, PATCH)
   - Connection pooling to prevent "too many connections" errors
   - Request queuing with rate limiting
   - Exponential backoff retry logic
   - Request/response logging for debugging

2. **SSEManager** (new `sse-manager.ts`)
   - Connects to `/api/stream` endpoint for Server-Sent Events
   - Subscribes to entity state changes by entity ID or domain
   - Buffers recent events for LLM consumption
   - Automatic reconnection with exponential backoff
   - Event filtering and transformation

   ```typescript
   interface SSEManager {
     subscribe(entityId: string, callback: (state: State) => void): string
     subscribeByDomain(domain: string, callback: (state: State) => void): string
     unsubscribe(subscriptionId: string): void
     getRecentEvents(filter?: EventFilter): Event[]
     disconnect(): void
   }
   ```

3. **WebSocketClient** (new `websocket-client.ts`)
   - Connects to Home Assistant WebSocket API
   - Executes bulk operations efficiently
   - Subscribes to state changes (alternative to SSE)
   - Transaction support (all-or-nothing operations)
   - Connection state management

   ```typescript
   interface WebSocketClient {
     connect(): Promise<void>
     executeBulk(commands: Command[]): Promise<Result[]>
     subscribeStates(): AsyncIterator<StateChange>
     disconnect(): void
   }
   ```

4. **Transport** (existing, no changes)
   - Stdio transport for SSH connections (current implementation)
   - HTTP transport for OAuth (disabled, future)

**Benefits:**
- SSE eliminates polling overhead
- WebSocket reduces connection count for bulk operations
- Connection pooling prevents resource exhaustion
- All upper layers inherit these optimizations

**File Structure:**
```
src/core/
├── ha-client.ts          (enhanced)
├── sse-manager.ts        (new)
├── websocket-client.ts   (new)
├── types.ts              (core type definitions)
└── index.ts              (exports)
```

### Domain Layer

**Location:** `src/domain/`

**Purpose:** Entity and configuration operations within Home Assistant

**Components:**

1. **Scenes** (`scenes.ts`) - 4 tools
   - `ha_scene_list`: List all scenes
   - `ha_scene_activate`: Activate scene
   - `ha_scene_create`: Create scene from current device states
   - `ha_scene_delete`: Remove scene

2. **Scripts** (`scripts.ts`) - 6 tools
   - `ha_script_list`: List all scripts
   - `ha_script_create`: Create script with sequence of actions
   - `ha_script_update`: Modify existing script
   - `ha_script_delete`: Remove script
   - `ha_script_execute`: Run script with variables
   - `ha_script_reload`: Reload scripts from configuration

3. **Helpers** (`helpers.ts`) - 8 tools
   - `ha_helper_list`: List all input_* entities (enhance existing)
   - `ha_helper_create_boolean`: Create input_boolean
   - `ha_helper_create_number`: Create input_number with min/max/step
   - `ha_helper_create_text`: Create input_text with pattern validation
   - `ha_helper_create_select`: Create input_select with options
   - `ha_helper_create_datetime`: Create input_datetime
   - `ha_helper_update`: Modify helper configuration
   - `ha_helper_delete`: Remove helper

4. **Areas & Zones** (`areas.ts`) - 9 tools
   - `ha_area_list`: List areas (enhance existing)
   - `ha_area_create`: Create area with aliases
   - `ha_area_update`: Rename area, modify aliases
   - `ha_area_delete`: Remove area
   - `ha_area_assign_entity`: Move entity to area
   - `ha_zone_list`: List zones
   - `ha_zone_create`: Create zone with GPS coordinates and radius
   - `ha_zone_update`: Modify zone location/radius
   - `ha_zone_delete`: Remove zone

5. **Device Registry** (`devices.ts`) - 7 tools
   - `ha_device_list`: List devices (enhance existing)
   - `ha_device_get`: Get device details
   - `ha_device_update`: Rename device, change area
   - `ha_device_enable`: Enable device
   - `ha_device_disable`: Disable device
   - `ha_entity_registry_list`: List entity registry entries
   - `ha_entity_registry_update`: Update entity metadata

**Total Domain Tools:** 34 tools (4 + 6 + 8 + 9 + 7)

**API Endpoints:**
- Scenes: `/api/services/scene/*`
- Scripts: `/api/services/script/*`, `/api/config/script/config/*`
- Helpers: `/api/services/input_*/*`, `/api/config/entity_registry/*`
- Areas: `/api/config/area_registry/*`
- Zones: `/api/config/zone/*`
- Devices: `/api/config/device_registry/*`, `/api/config/entity_registry/*`

**File Structure:**
```
src/domain/
├── scenes.ts      (new - 4 tools)
├── scripts.ts     (new - 6 tools)
├── helpers.ts     (new - 8 tools)
├── areas.ts       (new - 9 tools)
├── devices.ts     (new - 7 tools)
├── types.ts       (domain type definitions)
└── index.ts       (exports all domain tools)
```

### System Layer

**Location:** `src/system/`

**Purpose:** Home Assistant lifecycle and system-level operations

**Components:**

1. **Add-on Management** (`addons.ts`) - 9 tools
   - `ha_addon_list`: List all add-ons (installed and available)
   - `ha_addon_info`: Get add-on details (version, options, status)
   - `ha_addon_install`: Install add-on from store
   - `ha_addon_uninstall`: Remove add-on (check dependencies first)
   - `ha_addon_start`: Start add-on
   - `ha_addon_stop`: Stop add-on
   - `ha_addon_restart`: Restart add-on
   - `ha_addon_update`: Update to latest version
   - `ha_addon_configure`: Update add-on options

2. **Integration Management** (`integrations.ts`) - 7 tools
   - `ha_integration_list`: List integrations (enhance existing)
   - `ha_integration_info`: Get integration details and config entries
   - `ha_integration_enable`: Enable integration
   - `ha_integration_disable`: Disable integration
   - `ha_integration_reload`: Reload integration
   - `ha_integration_delete`: Remove integration and config entries
   - `ha_integration_setup`: Configure new integration

3. **HACS Management** (`hacs.ts`) - 5 tools
   - `ha_hacs_repositories`: List HACS repositories by category
   - `ha_hacs_install`: Install HACS integration/theme/script
   - `ha_hacs_update`: Update HACS repository
   - `ha_hacs_uninstall`: Remove HACS repository
   - `ha_hacs_info`: Get repository details

4. **Backup & Restore** (`backup.ts`) - 5 tools
   - `ha_backup_list`: List backups (enhance existing for full system)
   - `ha_backup_create_full`: Create complete system backup
   - `ha_backup_create_partial`: Backup specific add-ons/folders
   - `ha_backup_restore`: Restore from backup (requires confirmation)
   - `ha_backup_delete`: Remove backup file

**Total System Tools:** 26 tools (9 + 7 + 5 + 5)

**Safety Features:**
- Destructive operations require explicit confirmation parameter
- Add-on uninstall checks for dependent add-ons
- Integration disable/delete warns about automations using it
- Backup created automatically before system-level changes
- HACS operations validate repository before install

**API Endpoints:**
- Add-ons: `/supervisor/addons/*`
- Integrations: `/api/config/config_entries/*`
- HACS: `/api/hacs/*` (custom component)
- Backup: `/supervisor/backups/*`

**File Structure:**
```
src/system/
├── addons.ts         (new - 9 tools)
├── integrations.ts   (new - 7 tools)
├── hacs.ts          (new - 5 tools)
├── backup.ts        (enhance existing + 5 new tools)
├── types.ts         (system type definitions)
└── index.ts         (exports)
```

### Advanced Layer

**Location:** `src/advanced/`

**Purpose:** Composed operations and power features

**Components:**

1. **Bulk Operations** (`bulk.ts`) - 3 tools
   - `ha_bulk_control_devices`: Control multiple devices in one call
     - Uses WebSocketClient for efficiency
     - Transaction support (all succeed or all rollback)
     - Returns detailed per-entity results
   - `ha_bulk_assign_areas`: Move multiple entities to areas
   - `ha_bulk_enable_entities`: Enable/disable multiple entities

2. **Configuration Search** (`search.ts`) - 4 tools
   - `ha_search_automations`: Deep search in automation YAML
   - `ha_search_scripts`: Search script definitions
   - `ha_search_helpers`: Search helper configurations
   - `ha_search_all_config`: Search across all YAML files
   - Returns matched content with surrounding context
   - Supports regex patterns

3. **Automation Debugging** (`debug.ts`) - 3 tools
   - `ha_automation_trace_list`: Get recent automation runs
   - `ha_automation_trace_get`: Get full execution trace
     - Shows each step executed
     - Displays condition evaluations (true/false)
     - Includes action results and timing
   - `ha_automation_get_last_triggered`: When automation last ran

4. **Automation Helpers** (`automation-helpers.ts`) - 3 tools
   - `ha_automation_duplicate`: Clone automation with entity replacements
   - `ha_automation_bulk_enable`: Enable/disable multiple automations
   - `ha_automation_test_condition`: Test if condition would pass now

**Total Advanced Tools:** 13 tools (3 + 4 + 3 + 3)

**Implementation Pattern:**
```typescript
// Advanced tools compose lower layers
export async function bulkControlDevices(
  wsClient: WebSocketClient,
  entities: string[],
  service: string,
  serviceData?: Record<string, any>
): Promise<BulkResult> {
  const commands = entities.map(entity => ({
    domain: entity.split('.')[0],
    service,
    target: { entity_id: entity },
    service_data: serviceData
  }))

  const results = await wsClient.executeBulk(commands)

  return {
    successful: results.filter(r => r.success),
    failed: results.filter(r => !r.success),
    total: entities.length
  }
}
```

**File Structure:**
```
src/advanced/
├── bulk.ts                (new - 3 tools)
├── search.ts             (new - 4 tools)
├── debug.ts              (new - 3 tools)
├── automation-helpers.ts (new - 3 tools)
├── types.ts              (advanced type definitions)
└── index.ts              (exports)
```

## Tool Count Summary

| Layer | Existing | New | Total |
|-------|----------|-----|-------|
| Core | 36 (via current tools) | 0 (infrastructure) | 36 |
| Domain | 0 | 34 | 34 |
| System | 0 | 26 | 26 |
| Advanced | 0 | 13 | 13 |
| **Total MCP Tools** | **36** | **73** | **~109** |

Note: Some existing tools will be enhanced (like `ha_helper_list`, `ha_area_list`, `ha_device_list`) rather than replaced, reducing actual new tool count to approximately 70 new tools.

## File Organization

```
src/
├── index.ts                    (MCP server entry, tool registration)
├── core/
│   ├── ha-client.ts           (enhanced REST client)
│   ├── sse-manager.ts         (new - Server-Sent Events)
│   ├── websocket-client.ts    (new - WebSocket operations)
│   ├── types.ts               (core type definitions)
│   └── index.ts               (exports)
├── system/
│   ├── addons.ts              (new - 9 tools)
│   ├── integrations.ts        (new - 7 tools)
│   ├── hacs.ts                (new - 5 tools)
│   ├── backup.ts              (enhance + 5 tools)
│   ├── types.ts               (system types)
│   └── index.ts               (exports)
├── domain/
│   ├── scenes.ts              (new - 4 tools)
│   ├── scripts.ts             (new - 6 tools)
│   ├── helpers.ts             (new - 8 tools)
│   ├── areas.ts               (new - 9 tools)
│   ├── devices.ts             (new - 7 tools)
│   ├── types.ts               (domain types)
│   └── index.ts               (exports)
├── advanced/
│   ├── bulk.ts                (new - 3 tools)
│   ├── search.ts              (new - 4 tools)
│   ├── debug.ts               (new - 3 tools)
│   ├── automation-helpers.ts  (new - 3 tools)
│   ├── types.ts               (advanced types)
│   └── index.ts               (exports)
├── tools/                     (existing tools - migrate to layers)
│   ├── states.ts              → move to domain/
│   ├── config.ts              → move to domain/
│   ├── automation.ts          → move to domain/
│   └── system.ts              → move to system/
├── backup.ts                  (move to system/)
├── types.ts                   (global shared types)
└── ha-client.ts               (move to core/)
```

## Migration Strategy

**Existing code requires migration to new structure:**

1. **Core Layer Migration**
   - Move `ha-client.ts` to `src/core/`
   - Add connection pooling and retry logic
   - Create `SSEManager` class
   - Create `WebSocketClient` class

2. **Existing Tools Migration**
   - `tools/states.ts` → split between `domain/` and existing location
   - `tools/config.ts` → `domain/` (config file operations)
   - `tools/automation.ts` → `domain/` (automation CRUD)
   - `tools/system.ts` → `system/` (system operations)
   - `backup.ts` → `system/backup.ts` (enhance for full backups)

3. **Tool Registration Update**
   - Update `index.ts` to import from new layer structure
   - Maintain backward compatibility (tool names unchanged)
   - Add new tools to MCP server registration

## Testing Strategy

**Test Layers Independently:**

1. **Core Layer Tests**
   - Mock Home Assistant REST API responses
   - Test SSE connection, reconnection, event buffering
   - Test WebSocket bulk operations
   - Verify connection pooling and retry logic

2. **System Layer Tests**
   - Mock Supervisor API for add-ons and backups
   - Mock Core API for integrations
   - Verify safety checks (confirmation requirements)
   - Test dependency checking before uninstall

3. **Domain Layer Tests**
   - Mock registry APIs (area, device, entity)
   - Test CRUD operations for scenes, scripts, helpers
   - Verify validation logic
   - Test error handling

4. **Advanced Layer Tests**
   - Mock WebSocketClient for bulk operations
   - Test search across YAML files
   - Verify automation trace parsing
   - Test automation duplication logic

5. **Integration Tests**
   - Full stack tests with real Home Assistant test instance
   - Verify tool composition (Advanced → Domain → System → Core)
   - Test error propagation through layers
   - Performance testing with bulk operations

## Performance Considerations

**Efficiency Measures:**

1. **Connection Management**
   - Connection pooling in HAClient (max 10 concurrent)
   - WebSocket persistent connection for bulk operations
   - SSE single connection for all subscriptions

2. **Caching**
   - Cache area/device/entity registry (5-minute TTL)
   - Invalidate cache on create/update/delete operations
   - Cache add-on list (refresh on install/uninstall)

3. **Bulk Operations**
   - Use WebSocket for 3+ operations
   - Use REST for 1-2 operations
   - Transaction support prevents partial failures

4. **Rate Limiting**
   - Queue requests when rate limit hit
   - Exponential backoff (1s, 2s, 4s, 8s)
   - Warn LLM when queue exceeds 50 requests

## Security Considerations

**Safety Mechanisms:**

1. **Confirmation Requirements**
   - All destructive system operations require `confirm: true`
   - Automation/script deletion requires confirmation
   - Full system backup/restore requires confirmation
   - Add-on uninstall requires confirmation

2. **Validation**
   - Schema validation for all tool inputs
   - Entity ID format validation
   - YAML syntax validation before writing configs
   - Check existence before delete operations

3. **Error Handling**
   - Clear error messages for missing permissions
   - Supervisor API errors handled gracefully
   - WebSocket disconnection triggers reconnection
   - SSE disconnection triggers reconnection

4. **Audit Trail**
   - Log all system-level operations
   - Log all configuration changes
   - Include tool name and parameters in logs

## Documentation Updates

**Required Documentation:**

1. **README.md Updates**
   - Add all new tool categories
   - Update tool count (36 → ~109)
   - Document SSE and WebSocket capabilities
   - Add bulk operations examples

2. **API Documentation**
   - Document all 73 new tools
   - Include parameter schemas
   - Provide usage examples
   - Document error conditions

3. **Architecture Documentation**
   - Diagram layer structure
   - Explain layer responsibilities
   - Document layer interfaces
   - Provide extension guide

## Version and Compatibility

**Version:** 2.0.0 (major version due to architectural change)

**Breaking Changes:**
- None for tool consumers (tool names and schemas unchanged)
- Internal architecture completely restructured
- New dependencies: WebSocket library, SSE library

**Backward Compatibility:**
- All existing 36 tools maintain same names and interfaces
- Configuration format unchanged
- Transport configuration unchanged

## Success Criteria

The implementation succeeds when:

1. **Completeness:** All 73 new tools implemented and tested
2. **Architecture:** Layer boundaries enforced, no cross-layer dependencies
3. **Performance:** Bulk operations 5x faster than individual calls
4. **Reliability:** SSE/WebSocket auto-reconnect within 5 seconds
5. **Quality:** 80%+ test coverage across all layers
6. **Documentation:** All new tools documented with examples
7. **Deployment:** Version 2.0.0 deployable via Home Assistant add-on store

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Big-bang integration failures | High | Layer-by-layer integration, comprehensive tests |
| SSE/WebSocket stability issues | Medium | Robust reconnection logic, fallback to polling |
| Performance regression | Medium | Benchmark existing tools, optimize before release |
| HACS API changes | Low | Version-check HACS before operations |
| Supervisor API permission issues | Medium | Clear error messages, permission documentation |

## Timeline Estimate

**Development Phases:**

1. **Core Layer (SSE + WebSocket):** 3-5 days
2. **Domain Layer (34 tools):** 5-7 days
3. **System Layer (26 tools):** 5-7 days
4. **Advanced Layer (13 tools):** 3-4 days
5. **Migration & Integration:** 3-4 days
6. **Testing & Documentation:** 4-5 days

**Total Estimate:** 23-32 days (approximately 1 month)

## Next Steps

After design approval:

1. Create worktree for isolated development
2. Create detailed implementation plan with bite-sized tasks
3. Set up layer structure and interfaces
4. Begin Core Layer implementation
5. Implement layers in order: Core → System → Domain → Advanced
6. Migrate existing tools to new structure
7. Integration testing
8. Documentation
9. Release as version 2.0.0
