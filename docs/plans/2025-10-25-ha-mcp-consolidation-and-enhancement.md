# Home Assistant MCP Server - Consolidation and Enhancement Design

**Date:** 2025-10-25
**Status:** Design Approved
**Author:** Claude (with Vegar)

## Executive Summary

Consolidate the stdio and HTTP MCP server implementations into a single codebase with comprehensive tool enhancements based on Home Assistant's full platform capabilities. The HTTP transport will be included but disabled by default until Claude.ai OAuth support is fixed.

## Goals

1. **Consolidate**: Merge stdio and HTTP server implementations into one maintainable codebase
2. **Enhance**: Add 21 new/improved tools based on comprehensive HA API research
3. **Clean**: Remove duplicate code and improve repo organization
4. **Document**: Update all documentation to reflect Claude Code vs Claude Desktop configuration differences

## Background

### Current State
- **stdio version** (`homeassistant-mcp-server/`) - Working perfectly with Claude Desktop/Code via SSH
- **HTTP version** (`.worktrees/ha-mcp-http/`) - RFC-compliant but blocked by Claude.ai OAuth bugs
- **Issue**: Two separate codebases to maintain, documentation confusion about Claude Code setup

### Problems Identified
1. Documentation shows `~/.claude/mcp_settings.json` for Claude Code, but Claude Code uses `~/.claude.json` managed by CLI
2. No search/filter tools - listing all states returns 356k tokens
3. Missing integration with HA's conversation API, areas, labels, helpers
4. No access to Supervisor API, energy data, statistics, or advanced features

## Architecture

### Repository Structure

```
homeassistant-mcp-server/
├── src/
│   ├── index.ts                  # Main entry, detects transport
│   ├── ha-client.ts              # HA REST/WebSocket API client
│   ├── types.ts                  # Shared TypeScript types
│   ├── transports/
│   │   ├── stdio.ts              # stdio MCP transport
│   │   └── http.ts               # HTTP MCP transport (disabled by default)
│   └── tools/
│       ├── states.ts             # State & search tools (enhanced)
│       ├── activity.ts           # NEW: Recent activity tool
│       ├── organization.ts       # NEW: Areas, labels, devices
│       ├── conversation.ts       # NEW: Conversation & AI tools
│       ├── system.ts             # System tools + supervisor (enhanced)
│       ├── helpers.ts            # NEW: Input helpers, shopping list, todo
│       ├── media.ts              # NEW: Camera & media player tools
│       ├── energy.ts             # NEW: Energy & statistics tools
│       ├── persons.ts            # NEW: Person & location tools
│       ├── automation.ts         # Existing automation tools
│       └── config.ts             # Existing config tools
├── docs/
│   ├── plans/                    # Design documents
│   └── setup/                    # Setup guides
├── dist/                         # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Transport Detection

**Default behavior:** stdio (backward compatible)

**Enable HTTP transport:**
- Environment variable: `TRANSPORT=http`
- Command flag: `--transport=http`
- Config file: `transport: "http"` in config.json

**Why HTTP disabled by default:**
- Claude.ai OAuth client is incomplete (platform bug)
- stdio works perfectly for Claude Desktop and Claude Code
- HTTP code ready to enable when OAuth is fixed

### Monolithic with Transport Layer

Single entry point (`index.ts`) that:
1. Detects transport method (stdio or HTTP)
2. Initializes appropriate transport adapter
3. Registers all tools once
4. Routes MCP messages through transport layer

**Benefits:**
- Tools defined once, work on both transports
- Easy to add SSE transport later
- Simple testing and maintenance
- Clear separation of concerns

## Tool Design

### Design Principles

1. **Hybrid data approach**: Use HA API efficiently (history endpoints), filter in-memory where needed (search)
2. **Leverage HA built-ins**: Use conversation API for NLP, statistics for long-term data
3. **Semantic organization**: Group by areas/labels/devices, not just entity_id
4. **Performance**: Use minimal_response, significant_changes_only flags
5. **User-friendly**: Natural language via conversation API, readable responses

### Complete Tool Suite (21 Tools)

#### Category 1: Core State & Search (3 tools)

**ha_search_entities**
```typescript
{
  query?: string,           // Fuzzy search in entity_id/friendly_name
  device_class?: string,    // Filter by device_class
  domain?: string,          // Filter by domain
  state?: string,           // Filter by current state
  area?: string,            // Filter by area name
  label?: string,           // Filter by label
  limit?: number            // Default 20, max 100
}
```
- Implementation: GET `/api/states`, client-side filtering
- Cross-reference entity registry for areas/labels
- Returns: entity_id, state, friendly_name, last_changed, area, labels

**ha_get_recent_activity**
```typescript
{
  since?: string,           // "1h", "30m", "24h" (default "1h")
  device_class?: string,
  domain?: string,
  state?: string,
  area?: string,
  significant_only?: boolean,  // Use HA's significant_changes_only
  limit?: number
}
```
- Implementation: GET `/api/history/period/<timestamp>`
- Use `minimal_response=true` and `significant_changes_only=true` for efficiency
- Parse `since` to ISO timestamp
- Returns: entity_id, state, last_changed, previous_state

**ha_get_stats**
```typescript
{
  group_by: "domain" | "device_class" | "area" | "label"
}
```
- Implementation: GET `/api/states`, aggregate in-memory
- Returns: `{climate: 12, binary_sensor: 3, ...}`

#### Category 2: Organization (3 tools)

**ha_list_areas**
```typescript
{}  // No parameters
```
- Implementation: Access area registry
- Returns: `[{area_id, name, entity_count}, ...]`

**ha_list_labels**
```typescript
{}  // No parameters
```
- Implementation: Access label registry
- Returns: `[{label_id, name, color, entity_count}, ...]`

**ha_list_devices**
```typescript
{
  area?: string,           // Filter by area
  manufacturer?: string    // Filter by manufacturer
}
```
- Implementation: Access device registry
- Returns: device_id, name, manufacturer, model, area, entities[]

#### Category 3: Conversation & AI (2 tools)

**ha_process_conversation**
```typescript
{
  text: string,              // Natural language input
  conversation_id?: string,  // For multi-turn conversations
  agent_id?: string,         // Specific AI agent
  language?: string
}
```
- Implementation: POST `/api/conversation/process`
- Returns: response_type (action_done/query_answer/error), speech, affected entities
- Enables natural language control via HA's intent engine

**ha_render_template**
```typescript
{
  template: string          // Jinja2 template
}
```
- Implementation: POST `/api/template`
- Returns: rendered output
- Useful for testing templates and complex queries

#### Category 4: System & Monitoring (3 tools)

**ha_get_supervisor_info**
```typescript
{
  component?: "supervisor" | "core" | "os" | "host"  // Default: all
}
```
- Implementation: GET `/supervisor/info`, `/core/info`, etc.
- Returns: versions, update available, disk usage, addons, health status
- Requires SUPERVISOR_TOKEN

**ha_list_integrations**
```typescript
{}  // No parameters
```
- Implementation: GET `/api/components`
- Returns: list of loaded components/integrations

**ha_get_diagnostics**
```typescript
{}  // No parameters
```
- Implementation: GET `/resolution/info`
- Returns: unsupported/unhealthy indicators, suggestions

#### Category 5: Helpers & Lists (3 tools)

**ha_manage_shopping_list**
```typescript
{
  action: "list" | "add" | "remove" | "complete",
  item?: string,
  item_id?: string
}
```
- Implementation: Shopping list service calls
- Returns: current shopping list state

**ha_manage_todo**
```typescript
{
  list: string,              // Todo list entity_id
  action: "list" | "add" | "remove" | "complete",
  item?: string,
  item_id?: string,
  due_date?: string
}
```
- Implementation: todo service calls
- Returns: current todo list state

**ha_set_input_helper**
```typescript
{
  entity_id: string,         // input_boolean, input_number, input_text, input_select
  value: string | number | boolean
}
```
- Implementation: Service calls to input_* domains
- Returns: new state

#### Category 6: Media & Cameras (2 tools)

**ha_get_camera_snapshot**
```typescript
{
  entity_id: string,
  format?: "base64" | "url"  // Default: url
}
```
- Implementation: GET `/api/camera_proxy/<entity_id>`
- Returns: image data or proxy URL

**ha_control_media_player**
```typescript
{
  entity_id: string,
  action: "play" | "pause" | "stop" | "next" | "previous" | "volume_set" | "volume_up" | "volume_down",
  volume?: number            // For volume_set (0-1)
}
```
- Implementation: media_player service calls
- Returns: success/failure

#### Category 7: Energy & Statistics (2 tools)

**ha_get_energy_data**
```typescript
{
  period?: "hour" | "day" | "week" | "month",
  start_time?: string,
  end_time?: string
}
```
- Implementation: Energy dashboard API endpoints
- Returns: solar, battery, grid consumption/return data

**ha_get_long_term_statistics**
```typescript
{
  entity_ids: string[],
  start_time?: string,       // ISO timestamp
  end_time?: string,
  period?: "hour" | "day" | "month"
}
```
- Implementation: Statistics API (hourly aggregates)
- Returns: historical data from long-term statistics table
- Efficient for queries > 10 days

#### Category 8: Persons & Location (1 tool)

**ha_get_persons**
```typescript
{
  person_id?: string        // Optional filter
}
```
- Implementation: GET `/api/states` for person domain
- Returns: person location, zone, device tracker states, GPS coordinates

#### Category 9: Existing Tools (Enhanced)

**Automation tools** (4 existing):
- ha_create_automation
- ha_update_automation
- ha_delete_automation
- ha_list_automations

**Config tools** (6 existing):
- ha_read_config
- ha_write_config
- ha_list_files
- ha_validate_config
- ha_reload_config
- ha_list_backups

**System tools** (3 existing):
- ha_get_states (keep for backward compat, encourage ha_search_entities)
- ha_call_service
- ha_get_entity_details
- ha_get_history (keep for backward compat, encourage ha_get_recent_activity)
- ha_system_info
- ha_get_logs
- ha_restart

## Data Flow Examples

### Example 1: "List recent movements"
```
User → MCP Server
  ↓ ha_get_recent_activity({device_class: "motion", since: "1h"})
  ↓ GET /api/history/period/<1h_ago>?minimal_response=true
Home Assistant → Response with motion sensor states
  ↓ Filter by device_class=motion
  ↓ Sort by last_changed desc
MCP Server → User (formatted list)
```

### Example 2: "Turn on kitchen lights" (via conversation)
```
User → MCP Server
  ↓ ha_process_conversation({text: "turn on kitchen lights"})
  ↓ POST /api/conversation/process
Home Assistant → Intent recognition → Executes action
  ↓ Response: action_done, affected entities
MCP Server → User ("Turned on 3 lights in kitchen")
```

### Example 3: "Show me energy usage today"
```
User → MCP Server
  ↓ ha_get_energy_data({period: "day"})
  ↓ GET /api/energy endpoints
Home Assistant → Energy dashboard data
  ↓ Solar, battery, grid consumption
MCP Server → User (formatted energy summary)
```

## Implementation Strategy

### Phase 1: Consolidation
1. Create new unified structure
2. Merge stdio and HTTP transport code
3. Add transport detection logic
4. Migrate existing tools (no changes)
5. Test both transports work

### Phase 2: Core Enhancements
1. Implement ha_search_entities
2. Implement ha_get_recent_activity
3. Implement ha_get_stats
4. Test with real HA instance

### Phase 3: Organization Tools
1. Add area/label/device registry access to ha-client
2. Implement ha_list_areas
3. Implement ha_list_labels
4. Implement ha_list_devices

### Phase 4: Advanced Tools (Priority Order)
1. **High Priority** (most useful):
   - ha_process_conversation
   - ha_get_supervisor_info
   - ha_manage_todo
   - ha_get_persons

2. **Medium Priority**:
   - ha_render_template
   - ha_set_input_helper
   - ha_manage_shopping_list
   - ha_control_media_player

3. **Low Priority** (nice to have):
   - ha_get_camera_snapshot
   - ha_get_energy_data
   - ha_get_long_term_statistics
   - ha_list_integrations
   - ha_get_diagnostics

### Phase 5: Documentation & Cleanup
1. Update README with all tools
2. Document Claude Code vs Claude Desktop setup
3. Clean up worktrees
4. Update WORKING_SETUP_SUMMARY.md
5. Create tool usage examples

## Testing Strategy

### Unit Tests
- Each tool function in isolation
- Mock HA API responses
- Test error handling

### Integration Tests
- Real HA instance (Vegar's setup)
- Test each tool end-to-end
- Verify both stdio and HTTP transports

### Manual Testing Checklist
- [ ] ha_search_entities finds motion sensors
- [ ] ha_get_recent_activity shows latest movements
- [ ] ha_process_conversation executes "turn on lights"
- [ ] ha_list_areas returns all configured areas
- [ ] ha_get_supervisor_info shows system health
- [ ] Both stdio and HTTP transports work
- [ ] Tools accessible via Claude Code

## Documentation Updates

### 1. README.md
- Add complete tool list with examples
- Show both stdio and HTTP setup
- Clarify Claude Desktop vs Claude Code configuration

### 2. WORKING_SETUP_SUMMARY.md
- Remove reference to `~/.claude/mcp_settings.json`
- Add correct Claude Code setup (`claude mcp add` commands)
- Update tool count (17 → 21+)

### 3. New: TOOLS.md
- Detailed documentation for each tool
- Parameter descriptions
- Example usage for each
- Response format examples

### 4. New: CLAUDE_CODE_SETUP.md
- Step-by-step Claude Code installation
- Explain why it's different from Claude Desktop
- Troubleshooting section

## Migration Path

### For Existing stdio Users
- No changes required
- New tools available immediately
- Existing tools continue working

### For HTTP Version Users
- Code merged into main codebase
- Set `TRANSPORT=http` to enable
- Same tools, different transport

### Repo Cleanup
1. Merge `.worktrees/ha-mcp-http` into main
2. Remove `.worktrees/` directory
3. Update .gitignore if needed
4. Archive old documentation

## Success Criteria

- [ ] Single codebase supports both stdio and HTTP
- [ ] All 21+ tools implemented and tested
- [ ] Documentation clearly explains Claude Code vs Desktop
- [ ] Repo structure is clean and maintainable
- [ ] Backward compatible with existing stdio setup
- [ ] HTTP transport ready to enable when OAuth fixed

## Future Enhancements (Not in This Phase)

1. **SSE Transport** - Add Server-Sent Events support
2. **WebSocket Tools** - Real-time entity subscriptions
3. **Blueprint Tools** - Create/import/export blueprints
4. **Scene Tools** - Manage scenes
5. **Notification Actions** - Actionable notifications
6. **Voice Assistant** - Integration with HA Assist
7. **Dashboard Tools** - Manage Lovelace dashboards

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking existing stdio users | High | Maintain backward compatibility, test thoroughly |
| Tool implementation complexity | Medium | Implement in priority order, start with simple tools |
| HA API changes | Medium | Use official endpoints, test with latest HA version |
| Documentation confusion | Low | Clear separation of Claude Code vs Desktop docs |

## Timeline Estimate

- **Phase 1 (Consolidation)**: 2-3 hours
- **Phase 2 (Core Enhancements)**: 3-4 hours
- **Phase 3 (Organization Tools)**: 2-3 hours
- **Phase 4 (Advanced Tools)**: 8-12 hours (depends on priority)
- **Phase 5 (Documentation)**: 2-3 hours

**Total**: 17-27 hours for complete implementation

**Minimum Viable**: Phases 1-3 + high-priority Phase 4 tools = ~12 hours

## Questions for Review

1. Should we implement all 21 tools or prioritize a subset?
2. Do we need WebSocket support in this phase?
3. Should HTTP transport be completely disabled (compile-time) or just default-off (runtime)?

## Approval

This design was reviewed and approved on 2025-10-25 after comprehensive Home Assistant API research.

**Next Step**: Create implementation plan using writing-plans skill.
