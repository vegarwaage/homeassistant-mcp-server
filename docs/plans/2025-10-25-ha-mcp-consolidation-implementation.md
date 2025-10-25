# Home Assistant MCP Server - Consolidation and Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate stdio and HTTP MCP servers into one codebase with 21 comprehensive tools based on Home Assistant's full platform capabilities.

**Architecture:** Monolithic with transport layer abstraction. Single entry point detects transport (stdio/HTTP), initializes appropriate adapter, registers tools once, routes MCP messages through transport layer.

**Tech Stack:** TypeScript, Node.js, Home Assistant REST/WebSocket API, MCP SDK

---

## Phase 1: Consolidation (4 tasks)

### Task 1: Create Unified Directory Structure

**Files:**
- Create: `homeassistant-mcp-server/src/transports/stdio.ts`
- Create: `homeassistant-mcp-server/src/transports/http.ts`
- Create: `homeassistant-mcp-server/src/transports/index.ts`
- Modify: `homeassistant-mcp-server/src/index.ts`

**Step 1: Create transports directory**

```bash
mkdir -p homeassistant-mcp-server/src/transports
```

**Step 2: Move stdio transport code to transports/stdio.ts**

Extract stdio-specific MCP server initialization from current `index.ts`:

```typescript
// ABOUTME: stdio transport implementation for MCP server
// ABOUTME: Handles stdin/stdout communication for Claude Desktop/Code

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export async function createStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Home Assistant MCP Server running on stdio');
}
```

**Step 3: Create HTTP transport placeholder**

```typescript
// ABOUTME: HTTP transport implementation for MCP server (disabled by default)
// ABOUTME: OAuth-based HTTP transport for Claude.ai web/mobile clients

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export async function createHttpTransport(server: Server): Promise<void> {
  throw new Error('HTTP transport not yet implemented. Use TRANSPORT=stdio (default)');
}
```

**Step 4: Create transport index**

```typescript
// ABOUTME: Transport layer exports
// ABOUTME: Provides stdio and HTTP transport creation functions

export { createStdioTransport } from './stdio.js';
export { createHttpTransport } from './http.js';
```

**Step 5: Commit**

```bash
git add homeassistant-mcp-server/src/transports/
git commit -m "feat: create transport layer structure

- Add stdio transport implementation
- Add HTTP transport placeholder
- Prepare for transport abstraction"
```

---

### Task 2: Update Main Entry Point for Transport Detection

**Files:**
- Modify: `homeassistant-mcp-server/src/index.ts`

**Step 1: Add transport detection logic**

Replace current stdio-only implementation with transport detection:

```typescript
// ABOUTME: Main entry point for Home Assistant MCP server
// ABOUTME: Detects transport (stdio/HTTP) and initializes appropriate adapter

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { HomeAssistantClient } from './ha-client.js';
import { registerStateTools } from './tools/states.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerConfigTools } from './tools/config.js';
import { registerSystemTools } from './tools/system.js';
import { createStdioTransport, createHttpTransport } from './transports/index.js';

// Detect transport from environment variable or default to stdio
const transport = process.env.TRANSPORT?.toLowerCase() || 'stdio';

// Validate transport
if (transport !== 'stdio' && transport !== 'http') {
  console.error(`Invalid TRANSPORT value: ${transport}. Must be 'stdio' or 'http'`);
  process.exit(1);
}

// Check HTTP transport is explicitly requested
if (transport === 'http') {
  console.error('HTTP transport is disabled by default. OAuth support pending.');
  console.error('Use TRANSPORT=stdio (default) for Claude Desktop/Code.');
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'homeassistant',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all tools (transport-agnostic)
const tools = new Map<string, Function>();
registerStateTools(tools);
registerAutomationTools(tools);
registerConfigTools(tools);
registerSystemTools(tools);

// Set up tool handlers
server.setRequestHandler('tools/list', async () => ({
  tools: Array.from(tools.keys()).map(name => ({
    name,
    description: `Tool: ${name}`,
    inputSchema: { type: 'object', properties: {} }
  }))
}));

server.setRequestHandler('tools/call', async (request: any) => {
  const toolName = request.params.name;
  const toolFn = tools.get(toolName);

  if (!toolFn) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const client = new HomeAssistantClient(
    process.env.SUPERVISOR_TOKEN || '',
    'http://localhost:8123'
  );

  return await toolFn(client, request.params.arguments || {});
});

// Initialize transport
async function main() {
  try {
    if (transport === 'http') {
      await createHttpTransport(server);
    } else {
      await createStdioTransport(server);
    }
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
```

**Step 2: Test stdio transport still works**

Run:
```bash
cd homeassistant-mcp-server
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | SUPERVISOR_TOKEN='test' node dist/index.js
```

Expected: Server starts, lists tools, outputs on stderr "Home Assistant MCP Server running on stdio"

**Step 3: Test HTTP transport is blocked**

Run:
```bash
TRANSPORT=http SUPERVISOR_TOKEN='test' node dist/index.js
```

Expected: Error message about HTTP being disabled, exit code 1

**Step 4: Commit**

```bash
git add homeassistant-mcp-server/src/index.ts
git commit -m "feat: add transport detection to main entry point

- Detect TRANSPORT env var (default: stdio)
- Block HTTP transport with clear error message
- Maintain backward compatibility with stdio"
```

---

### Task 3: Update Tool Registration System

**Files:**
- Modify: `homeassistant-mcp-server/src/tools/states.ts`
- Modify: `homeassistant-mcp-server/src/tools/automation.ts`
- Modify: `homeassistant-mcp-server/src/tools/config.ts`
- Modify: `homeassistant-mcp-server/src/tools/system.ts`

**Step 1: Update states.ts to use proper MCP tool schema**

```typescript
// ABOUTME: MCP tools for querying Home Assistant entity states and history
// ABOUTME: Provides ha_get_states, ha_get_history, ha_call_service, ha_get_entity_details

import { HomeAssistantClient } from '../ha-client.js';
import { HAState } from '../types.js';

export function registerStateTools(tools: Map<string, any>) {
  tools.set('ha_get_states', {
    description: 'Get current state of Home Assistant entities, optionally filtered by entity_id or domain',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'Specific entity ID (e.g., "light.living_room")'
        },
        domain: {
          type: 'string',
          description: 'Domain filter (e.g., "light", "sensor", "switch")'
        }
      }
    },
    handler: async (client: HomeAssistantClient, args: any) => {
      const { entity_id, domain } = args;
      let states = await client.getStates(entity_id);

      if (domain && !entity_id) {
        states = states.filter(state => state.entity_id.startsWith(`${domain}.`));
      }

      return {
        count: states.length,
        states: states
      };
    }
  });

  // Continue for other tools...
}
```

**Step 2: Update tool handler in index.ts to use new schema**

In `index.ts`, update `tools/list` handler:

```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: Array.from(tools.entries()).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

server.setRequestHandler('tools/call', async (request: any) => {
  const toolName = request.params.name;
  const tool = tools.get(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const client = new HomeAssistantClient(
    process.env.SUPERVISOR_TOKEN || '',
    'http://localhost:8123'
  );

  return await tool.handler(client, request.params.arguments || {});
});
```

**Step 3: Test tool registration**

Run:
```bash
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | SUPERVISOR_TOKEN='test' node dist/index.js | head -50
```

Expected: JSON response with tools array showing proper descriptions and schemas

**Step 4: Commit**

```bash
git add homeassistant-mcp-server/src/tools/ homeassistant-mcp-server/src/index.ts
git commit -m "refactor: update tool registration to use proper MCP schema

- Tools now include description and inputSchema
- Handler separated from tool metadata
- Prepare for tool additions"
```

---

### Task 4: Update Package Version and Documentation

**Files:**
- Modify: `homeassistant-mcp-server/package.json`
- Modify: `homeassistant-mcp-server/README.md`

**Step 1: Bump version to 0.2.0**

In `package.json`:
```json
{
  "name": "homeassistant-mcp-server",
  "version": "0.2.0",
  "description": "Home Assistant MCP Server with stdio and HTTP transports",
  ...
}
```

**Step 2: Update README with transport info**

Add transport section to README.md:

```markdown
## Transport Configuration

### stdio (Default)
For Claude Desktop and Claude Code:

```bash
SUPERVISOR_TOKEN='your_token' node dist/index.js
```

### HTTP (Disabled)
HTTP transport is currently disabled pending Claude.ai OAuth support.
To enable in future: `TRANSPORT=http node dist/index.js`
```

**Step 3: Commit**

```bash
git add homeassistant-mcp-server/package.json homeassistant-mcp-server/README.md
git commit -m "chore: bump version to 0.2.0 and document transports

- Version 0.2.0 marks consolidation complete
- Document stdio (default) and HTTP (disabled) transports"
```

---

## Phase 2: Core Enhancement Tools (3 tasks)

### Task 5: Implement ha_search_entities

**Files:**
- Create: `homeassistant-mcp-server/src/tools/search.ts`
- Modify: `homeassistant-mcp-server/src/index.ts`

**Step 1: Create search.ts with ha_search_entities**

```typescript
// ABOUTME: MCP tools for searching and filtering Home Assistant entities
// ABOUTME: Provides ha_search_entities with fuzzy search and filtering

import { HomeAssistantClient } from '../ha-client.js';

export function registerSearchTools(tools: Map<string, any>) {
  tools.set('ha_search_entities', {
    description: 'Search entities by name, device class, domain, state, area, or label',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Fuzzy search in entity_id and friendly_name (case-insensitive)'
        },
        device_class: {
          type: 'string',
          description: 'Filter by device_class (e.g., "motion", "door", "temperature")'
        },
        domain: {
          type: 'string',
          description: 'Filter by domain (e.g., "binary_sensor", "climate", "light")'
        },
        state: {
          type: 'string',
          description: 'Filter by current state (e.g., "on", "off", "home")'
        },
        area: {
          type: 'string',
          description: 'Filter by area name (e.g., "kitchen", "bedroom")'
        },
        label: {
          type: 'string',
          description: 'Filter by label name'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20, max: 100)'
        }
      }
    },
    handler: async (client: HomeAssistantClient, args: any) => {
      const {
        query,
        device_class,
        domain,
        state,
        area,
        label,
        limit = 20
      } = args;

      // Get all states
      let states = await client.getStates();

      // Apply filters
      if (query) {
        const lowerQuery = query.toLowerCase();
        states = states.filter(s =>
          s.entity_id.toLowerCase().includes(lowerQuery) ||
          s.attributes.friendly_name?.toLowerCase().includes(lowerQuery)
        );
      }

      if (device_class) {
        states = states.filter(s =>
          s.attributes.device_class === device_class
        );
      }

      if (domain) {
        states = states.filter(s =>
          s.entity_id.startsWith(`${domain}.`)
        );
      }

      if (state) {
        states = states.filter(s => s.state === state);
      }

      if (area) {
        // Note: Area filtering requires entity registry access
        // For now, filter by area in friendly_name as workaround
        const lowerArea = area.toLowerCase();
        states = states.filter(s =>
          s.attributes.friendly_name?.toLowerCase().includes(lowerArea)
        );
      }

      if (label) {
        // Note: Label filtering requires entity registry access
        // Placeholder for future implementation
      }

      // Apply limit
      const maxLimit = Math.min(limit, 100);
      states = states.slice(0, maxLimit);

      return {
        count: states.length,
        entities: states.map(s => ({
          entity_id: s.entity_id,
          state: s.state,
          friendly_name: s.attributes.friendly_name,
          device_class: s.attributes.device_class,
          last_changed: s.last_changed,
          last_updated: s.last_updated
        }))
      };
    }
  });
}
```

**Step 2: Register search tools in index.ts**

```typescript
import { registerSearchTools } from './tools/search.js';

// After other tool registrations:
registerSearchTools(tools);
```

**Step 3: Build and test**

```bash
npm run build
```

Test with search query (requires HA connection):
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ha_search_entities","arguments":{"query":"motion","limit":5}}}' | SUPERVISOR_TOKEN='your_token' node dist/index.js
```

**Step 4: Commit**

```bash
git add homeassistant-mcp-server/src/tools/search.ts homeassistant-mcp-server/src/index.ts
git commit -m "feat: add ha_search_entities tool

- Fuzzy search by entity_id and friendly_name
- Filter by device_class, domain, state, area
- Configurable result limit (max 100)
- Returns simplified entity information"
```

---

### Task 6: Implement ha_get_recent_activity

**Files:**
- Create: `homeassistant-mcp-server/src/tools/activity.ts`
- Modify: `homeassistant-mcp-server/src/ha-client.ts`
- Modify: `homeassistant-mcp-server/src/index.ts`

**Step 1: Add history endpoint to ha-client.ts**

```typescript
// Add to HomeAssistantClient class:

async getHistory(options: {
  entity_ids?: string[];
  start_time?: string;
  end_time?: string;
  minimal_response?: boolean;
  significant_changes_only?: boolean;
}): Promise<any[]> {
  const params = new URLSearchParams();

  if (options.minimal_response) {
    params.append('minimal_response', 'true');
  }

  if (options.significant_changes_only) {
    params.append('significant_changes_only', 'true');
  }

  if (options.end_time) {
    params.append('end_time', options.end_time);
  }

  const url = options.start_time
    ? `/api/history/period/${options.start_time}`
    : '/api/history/period';

  const fullUrl = `${url}?${params.toString()}`;

  const response = await fetch(`${this.baseUrl}${fullUrl}`, {
    headers: this.headers
  });

  if (!response.ok) {
    throw new Error(`History request failed: ${response.statusText}`);
  }

  return response.json();
}
```

**Step 2: Create activity.ts**

```typescript
// ABOUTME: MCP tools for querying recent Home Assistant activity
// ABOUTME: Provides ha_get_recent_activity with time-based filtering

import { HomeAssistantClient } from '../ha-client.js';

function parseTimeOffset(since: string): string {
  const match = since.match(/^(\d+)(h|m|d)$/);
  if (!match) {
    throw new Error('Invalid time format. Use format like "1h", "30m", "24h"');
  }

  const [, amount, unit] = match;
  const now = new Date();
  const offset = parseInt(amount);

  switch (unit) {
    case 'h':
      now.setHours(now.getHours() - offset);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() - offset);
      break;
    case 'd':
      now.setDate(now.getDate() - offset);
      break;
  }

  return now.toISOString();
}

export function registerActivityTools(tools: Map<string, any>) {
  tools.set('ha_get_recent_activity', {
    description: 'Get entities that changed state recently, with time-based filtering',
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'Time period: "1h", "30m", "24h" (default: "1h")'
        },
        device_class: {
          type: 'string',
          description: 'Filter by device_class'
        },
        domain: {
          type: 'string',
          description: 'Filter by domain'
        },
        state: {
          type: 'string',
          description: 'Only show entities currently in this state'
        },
        area: {
          type: 'string',
          description: 'Filter by area name'
        },
        significant_only: {
          type: 'boolean',
          description: 'Use HA significant_changes_only filter (default: true)'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)'
        }
      }
    },
    handler: async (client: HomeAssistantClient, args: any) => {
      const {
        since = '1h',
        device_class,
        domain,
        state,
        area,
        significant_only = true,
        limit = 50
      } = args;

      // Parse time offset
      const startTime = parseTimeOffset(since);

      // Get history
      const history = await client.getHistory({
        start_time: startTime,
        minimal_response: true,
        significant_changes_only: significant_only
      });

      // Flatten history (it's grouped by entity)
      let activities: any[] = [];
      for (const entityHistory of history) {
        if (!entityHistory || entityHistory.length === 0) continue;

        // Get latest state change for this entity
        const latest = entityHistory[entityHistory.length - 1];
        const previous = entityHistory[entityHistory.length - 2];

        activities.push({
          entity_id: latest.entity_id,
          state: latest.state,
          previous_state: previous?.state,
          last_changed: latest.last_changed,
          friendly_name: latest.attributes?.friendly_name,
          device_class: latest.attributes?.device_class
        });
      }

      // Apply filters
      if (device_class) {
        activities = activities.filter(a => a.device_class === device_class);
      }

      if (domain) {
        activities = activities.filter(a => a.entity_id.startsWith(`${domain}.`));
      }

      if (state) {
        activities = activities.filter(a => a.state === state);
      }

      if (area) {
        const lowerArea = area.toLowerCase();
        activities = activities.filter(a =>
          a.friendly_name?.toLowerCase().includes(lowerArea)
        );
      }

      // Sort by last_changed desc
      activities.sort((a, b) =>
        new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime()
      );

      // Apply limit
      activities = activities.slice(0, Math.min(limit, 100));

      return {
        count: activities.length,
        since: startTime,
        activities
      };
    }
  });
}
```

**Step 3: Register activity tools**

In `index.ts`:
```typescript
import { registerActivityTools } from './tools/activity.js';

registerActivityTools(tools);
```

**Step 4: Build and test**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add homeassistant-mcp-server/src/tools/activity.ts homeassistant-mcp-server/src/ha-client.ts homeassistant-mcp-server/src/index.ts
git commit -m "feat: add ha_get_recent_activity tool

- Query entities changed within time period
- Parse time offsets (1h, 30m, 24h format)
- Use HA history API with optimization flags
- Filter by device_class, domain, state, area
- Sort by most recent first"
```

---

### Task 7: Implement ha_get_stats

**Files:**
- Modify: `homeassistant-mcp-server/src/tools/search.ts`

**Step 1: Add ha_get_stats to search.ts**

```typescript
// Add to registerSearchTools function:

tools.set('ha_get_stats', {
  description: 'Get entity count statistics grouped by domain, device_class, area, or label',
  inputSchema: {
    type: 'object',
    properties: {
      group_by: {
        type: 'string',
        enum: ['domain', 'device_class', 'area', 'label'],
        description: 'How to group entities for counting'
      }
    },
    required: ['group_by']
  },
  handler: async (client: HomeAssistantClient, args: any) => {
    const { group_by } = args;

    const states = await client.getStates();
    const stats: Record<string, number> = {};

    for (const state of states) {
      let key: string | undefined;

      switch (group_by) {
        case 'domain':
          key = state.entity_id.split('.')[0];
          break;
        case 'device_class':
          key = state.attributes.device_class || 'none';
          break;
        case 'area':
          // Extract area from friendly_name as workaround
          // TODO: Use entity registry when available
          key = 'unknown';
          break;
        case 'label':
          // TODO: Implement when entity registry available
          key = 'unknown';
          break;
      }

      if (key) {
        stats[key] = (stats[key] || 0) + 1;
      }
    }

    // Sort by count descending
    const sorted = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as Record<string, number>);

    return {
      group_by,
      total_entities: states.length,
      stats: sorted
    };
  }
});
```

**Step 2: Build and test**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add homeassistant-mcp-server/src/tools/search.ts
git commit -m "feat: add ha_get_stats tool

- Group entities by domain or device_class
- Count entities per group
- Sort by count descending
- Return total entity count"
```

---

## Consolidation Complete Summary

After completing Phase 1 and Phase 2 (Tasks 1-7), the following will be achieved:

**Completed:**
- ✅ Transport layer abstraction (stdio working, HTTP disabled)
- ✅ Proper MCP tool schema registration
- ✅ ha_search_entities (fuzzy search with filters)
- ✅ ha_get_recent_activity (time-based activity)
- ✅ ha_get_stats (entity statistics)

**Next Phases:**
- Phase 3: Organization tools (areas, labels, devices) - 3 tasks
- Phase 4: Conversation & AI tools - 2 tasks
- Phase 5: System & monitoring tools - 3 tasks
- Phase 6: Helpers & lists tools - 3 tasks
- Phase 7: Media & camera tools - 2 tasks
- Phase 8: Energy & statistics tools - 2 tasks
- Phase 9: Persons & location tools - 1 task
- Phase 10: Documentation & cleanup - 3 tasks

**Estimate:**
- Phase 1-2 complete: ~3-4 hours
- Remaining phases: ~14-18 hours
- Total: ~17-22 hours

Would you like me to continue with Phase 3 (Organization tools) or would you prefer to pause and test the consolidation first?
