# Implementation Plan: Floor & Label Registry Tools

## Overview

Add comprehensive floor and label management tools to the Home Assistant MCP server. These features were added to Home Assistant in version 2024.4 and are not yet implemented in this MCP.

**Target Version:** 2.6.0
**Estimated New Tools:** 12-14 tools

---

## Background

### Floor Registry (Added HA 2024.4)
Floors represent building levels (e.g., "Ground Floor", "First Floor", "Basement"). Areas are assigned to floors. Floors can be used as targets in automations and service calls.

### Label Registry (Added HA 2024.4)
Labels are custom tags that can be assigned to areas, devices, entities, automations, scripts, and helpers. Labels enable cross-cutting categorization independent of physical location (e.g., "Security", "Energy Monitoring", "Guest Room").

---

## API Reference

### Floor Registry WebSocket Commands

All floor commands require admin privileges except `list`.

#### 1. `config/floor_registry/list`
```json
{
  "type": "config/floor_registry/list",
  "id": 1
}
```
**Response:** Array of floor objects with `floor_id`, `name`, `icon`, `level`, `aliases`

#### 2. `config/floor_registry/create`
```json
{
  "type": "config/floor_registry/create",
  "id": 2,
  "name": "Ground Floor",
  "icon": "mdi:home-floor-0",
  "level": 0,
  "aliases": ["Downstairs", "Main Level"]
}
```
**Required:** `name`
**Optional:** `icon` (string|null), `level` (integer|null), `aliases` (array)

#### 3. `config/floor_registry/update`
```json
{
  "type": "config/floor_registry/update",
  "id": 3,
  "floor_id": "ground_floor",
  "name": "Main Floor",
  "icon": "mdi:home-floor-g",
  "level": 0
}
```
**Required:** `floor_id`
**Optional:** `name`, `icon`, `level`, `aliases`

#### 4. `config/floor_registry/delete`
```json
{
  "type": "config/floor_registry/delete",
  "id": 4,
  "floor_id": "ground_floor"
}
```

#### 5. `config/floor_registry/reorder`
```json
{
  "type": "config/floor_registry/reorder",
  "id": 5,
  "floor_ids": ["basement", "ground_floor", "first_floor", "attic"]
}
```

### Label Registry WebSocket Commands

All label commands require admin privileges except `list`.

#### 1. `config/label_registry/list`
```json
{
  "type": "config/label_registry/list",
  "id": 1
}
```
**Response:** Array of label objects with `label_id`, `name`, `icon`, `color`, `description`

#### 2. `config/label_registry/create`
```json
{
  "type": "config/label_registry/create",
  "id": 2,
  "name": "Security",
  "icon": "mdi:shield",
  "color": "red",
  "description": "Security-related devices and sensors"
}
```
**Required:** `name`
**Optional:** `icon` (string|null), `color` (string|null), `description` (string|null)

#### 3. `config/label_registry/update`
```json
{
  "type": "config/label_registry/update",
  "id": 3,
  "label_id": "security",
  "name": "Security System",
  "color": "orange"
}
```
**Required:** `label_id`
**Optional:** `name`, `icon`, `color`, `description`

#### 4. `config/label_registry/delete`
```json
{
  "type": "config/label_registry/delete",
  "id": 4,
  "label_id": "security"
}
```

### Template Functions for Querying

These can be used via `ha_render_template` or implemented as dedicated tools:

```jinja2
{# Floor functions #}
{{ floors() }}                           {# List all floor IDs #}
{{ floor_id('Ground Floor') }}           {# Get floor_id from name #}
{{ floor_name('ground_floor') }}         {# Get name from floor_id #}
{{ floor_areas('ground_floor') }}        {# Get area IDs on floor #}
{{ floor_entities('ground_floor') }}     {# Get entity IDs on floor #}

{# Label functions #}
{{ labels() }}                           {# List all label IDs #}
{{ labels('area.living_room') }}         {# Labels for an area #}
{{ labels('device_id_here') }}           {# Labels for a device #}
{{ labels('light.kitchen') }}            {# Labels for an entity #}
{{ label_id('Security') }}               {# Get label_id from name #}
{{ label_name('security') }}             {# Get name from label_id #}
{{ label_description('security') }}      {# Get description (2025.7+) #}
{{ label_areas('security') }}            {# Get area IDs with label #}
{{ label_devices('security') }}          {# Get device IDs with label #}
{{ label_entities('security') }}         {# Get entity IDs with label #}
```

### Service Call Targeting

The `ha_call_service` tool should support `floor_id` and `label_id` as targets:

```json
{
  "domain": "light",
  "service": "turn_off",
  "target": {
    "floor_id": ["ground_floor", "first_floor"],
    "label_id": ["guest_room"]
  }
}
```

---

## Implementation Plan

### File Structure

Create new file: `src/domain/floors-labels.ts`

This follows the existing pattern in `src/domain/` for entity management tools.

### New Tools to Implement

#### Floor Tools (6 tools)

| Tool Name | Description | WebSocket/Template |
|-----------|-------------|-------------------|
| `ha_floor_list` | List all floors with areas count | WebSocket `config/floor_registry/list` |
| `ha_floor_create` | Create a new floor | WebSocket `config/floor_registry/create` |
| `ha_floor_update` | Update floor properties | WebSocket `config/floor_registry/update` |
| `ha_floor_delete` | Delete a floor | WebSocket `config/floor_registry/delete` |
| `ha_floor_reorder` | Reorder floors | WebSocket `config/floor_registry/reorder` |
| `ha_floor_entities` | Get all entities on a floor | Template `floor_entities()` |

#### Label Tools (6 tools)

| Tool Name | Description | WebSocket/Template |
|-----------|-------------|-------------------|
| `ha_label_list` | List all labels with counts | WebSocket `config/label_registry/list` |
| `ha_label_create` | Create a new label | WebSocket `config/label_registry/create` |
| `ha_label_update` | Update label properties | WebSocket `config/label_registry/update` |
| `ha_label_delete` | Delete a label | WebSocket `config/label_registry/delete` |
| `ha_label_entities` | Get entities with a label | Template `label_entities()` |
| `ha_label_devices` | Get devices with a label | Template `label_devices()` |

### Code Implementation

#### 1. Create `src/domain/floors-labels.ts`

```typescript
// ABOUTME: Floor and label registry management tools
// ABOUTME: Provides floor CRUD, label CRUD, and entity queries by floor/label

import type { HomeAssistantClient } from '../core/ha-client.js';
import { validateLimit } from '../validation.js';

export function createFloorTools(client: HomeAssistantClient) {
  return {
    floor_list: {
      name: 'ha_floor_list',
      description: 'List all floors in Home Assistant with their areas. Floors represent building levels.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          include_areas: {
            type: 'boolean',
            description: 'Include list of area IDs for each floor (default: true)'
          }
        }
      },
      handler: async ({ include_areas = true }: { include_areas?: boolean } = {}) => {
        // Use WebSocket API via REST wrapper or template
        const template = `
{%- set ns = namespace(result=[]) -%}
{%- for floor_id in floors() -%}
  {%- set floor_areas = floor_areas(floor_id) | list -%}
  {%- set ns.result = ns.result + [{
    'floor_id': floor_id,
    'name': floor_name(floor_id),
    'area_count': floor_areas | count
    ${include_areas ? ",'areas': floor_areas" : ''}
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
        const floors = await client.renderTemplate(template);
        return {
          count: Array.isArray(floors) ? floors.length : 0,
          floors: floors || []
        };
      }
    },

    floor_entities: {
      name: 'ha_floor_entities',
      description: 'Get all entities on a specific floor. Useful for floor-wide automations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          floor_id: { type: 'string', description: 'Floor ID or name' },
          domain: { type: 'string', description: 'Filter by domain (e.g., "light", "sensor")' },
          limit: { type: 'number', description: 'Maximum entities to return (default: 100)' }
        },
        required: ['floor_id']
      },
      handler: async ({ floor_id, domain, limit = 100 }: { floor_id: string; domain?: string; limit?: number }) => {
        const actualLimit = validateLimit(limit, 100, 500);
        const domainFilter = domain ? `| select('match', '${domain}.')` : '';

        const template = `
{%- set entities = floor_entities('${floor_id}') ${domainFilter} | list -%}
{{ {'count': entities | count, 'entities': entities[:${actualLimit}]} | tojson }}
`;
        return await client.renderTemplate(template);
      }
    },

    // ... implement floor_create, floor_update, floor_delete, floor_reorder
    // These require WebSocket API calls - see WebSocket client usage below
  };
}

export function createLabelTools(client: HomeAssistantClient) {
  return {
    label_list: {
      name: 'ha_label_list',
      description: 'List all labels in Home Assistant with entity/device/area counts.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          include_counts: {
            type: 'boolean',
            description: 'Include entity/device/area counts (default: true)'
          }
        }
      },
      handler: async ({ include_counts = true }: { include_counts?: boolean } = {}) => {
        const template = include_counts ? `
{%- set ns = namespace(result=[]) -%}
{%- for label_id in labels() -%}
  {%- set ns.result = ns.result + [{
    'label_id': label_id,
    'name': label_name(label_id),
    'description': label_description(label_id) | default(none),
    'entity_count': label_entities(label_id) | count,
    'device_count': label_devices(label_id) | count,
    'area_count': label_areas(label_id) | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
` : `
{%- set ns = namespace(result=[]) -%}
{%- for label_id in labels() -%}
  {%- set ns.result = ns.result + [{
    'label_id': label_id,
    'name': label_name(label_id),
    'description': label_description(label_id) | default(none)
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
        const labels = await client.renderTemplate(template);
        return {
          count: Array.isArray(labels) ? labels.length : 0,
          labels: labels || []
        };
      }
    },

    label_entities: {
      name: 'ha_label_entities',
      description: 'Get all entities with a specific label. Useful for label-based automations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label_id: { type: 'string', description: 'Label ID or name' },
          domain: { type: 'string', description: 'Filter by domain (e.g., "light", "sensor")' },
          limit: { type: 'number', description: 'Maximum entities to return (default: 100)' },
          include_state: { type: 'boolean', description: 'Include current state for each entity (default: false)' }
        },
        required: ['label_id']
      },
      handler: async ({ label_id, domain, limit = 100, include_state = false }: {
        label_id: string; domain?: string; limit?: number; include_state?: boolean
      }) => {
        const actualLimit = validateLimit(limit, 100, 500);
        const domainFilter = domain ? `| select('match', '${domain}.')` : '';

        if (include_state) {
          const template = `
{%- set entities = label_entities('${label_id}') ${domainFilter} | list -%}
{%- set ns = namespace(result=[]) -%}
{%- for entity_id in entities[:${actualLimit}] -%}
  {%- set ns.result = ns.result + [{
    'entity_id': entity_id,
    'state': states(entity_id),
    'friendly_name': state_attr(entity_id, 'friendly_name')
  }] -%}
{%- endfor -%}
{{ {'count': entities | count, 'returned': ns.result | count, 'entities': ns.result} | tojson }}
`;
          return await client.renderTemplate(template);
        } else {
          const template = `
{%- set entities = label_entities('${label_id}') ${domainFilter} | list -%}
{{ {'count': entities | count, 'entities': entities[:${actualLimit}]} | tojson }}
`;
          return await client.renderTemplate(template);
        }
      }
    },

    label_devices: {
      name: 'ha_label_devices',
      description: 'Get all devices with a specific label.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label_id: { type: 'string', description: 'Label ID or name' },
          limit: { type: 'number', description: 'Maximum devices to return (default: 100)' }
        },
        required: ['label_id']
      },
      handler: async ({ label_id, limit = 100 }: { label_id: string; limit?: number }) => {
        const actualLimit = validateLimit(limit, 100, 500);

        const template = `
{%- set devices = label_devices('${label_id}') | list -%}
{%- set ns = namespace(result=[]) -%}
{%- for device_id in devices[:${actualLimit}] -%}
  {%- set ns.result = ns.result + [{
    'device_id': device_id,
    'name': device_attr(device_id, 'name'),
    'manufacturer': device_attr(device_id, 'manufacturer'),
    'model': device_attr(device_id, 'model')
  }] -%}
{%- endfor -%}
{{ {'count': devices | count, 'returned': ns.result | count, 'devices': ns.result} | tojson }}
`;
        return await client.renderTemplate(template);
      }
    }

    // ... implement label_create, label_update, label_delete
    // These require WebSocket API calls
  };
}
```

#### 2. Add WebSocket Support for CRUD Operations

The CRUD operations (create, update, delete) require WebSocket API calls. Check if `src/core/websocket-client.ts` supports sending arbitrary commands. If not, add a generic `sendCommand` method:

```typescript
// In src/core/websocket-client.ts
async sendCommand(type: string, data: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = this.nextId++;
    const message = { id, type, ...data };

    this.pendingRequests.set(id, { resolve, reject });
    this.ws.send(JSON.stringify(message));
  });
}
```

Then use it for CRUD:

```typescript
// Example: floor_create handler
handler: async ({ name, icon, level, aliases }: {
  name: string; icon?: string; level?: number; aliases?: string[]
}) => {
  const wsClient = new WebSocketClient(/* config */);
  await wsClient.connect();

  const result = await wsClient.sendCommand('config/floor_registry/create', {
    name,
    ...(icon && { icon }),
    ...(level !== undefined && { level }),
    ...(aliases && { aliases })
  });

  await wsClient.close();
  return result;
}
```

#### 3. Update `src/domain/index.ts`

Add exports for the new tools:

```typescript
export { createFloorTools, createLabelTools } from './floors-labels.js';
```

#### 4. Register Tools in `src/index.ts`

```typescript
import { createFloorTools, createLabelTools } from './domain/index.js';

// In registerTools():
const domainTools = [
  ...this.convertLayeredTools(createSceneTools(this.haClient)),
  ...this.convertLayeredTools(createScriptTools(this.haClient)),
  ...this.convertLayeredTools(createHelperTools(this.haClient)),
  ...this.convertLayeredTools(createAreaZoneTools(this.haClient)),
  ...this.convertLayeredTools(createDeviceTools(this.haClient)),
  ...this.convertLayeredTools(createFloorTools(this.haClient)),  // ADD
  ...this.convertLayeredTools(createLabelTools(this.haClient)),  // ADD
];
```

#### 5. Update `ha_call_service` to Support floor_id and label_id Targets

In `src/tools/states.ts`, update the `ha_call_service` handler:

```typescript
// Current target handling:
target: entity_id ? { entity_id } : undefined,

// New target handling:
target: {
  ...(entity_id && { entity_id }),
  ...(device_id && { device_id }),
  ...(area_id && { area_id }),
  ...(floor_id && { floor_id }),
  ...(label_id && { label_id }),
},
```

And update the inputSchema to include the new target options.

#### 6. Update Existing Label List Tool

The existing `ha_list_labels` in `src/tools/organization.ts` should be updated or deprecated in favor of the new `ha_label_list` which includes counts and descriptions.

---

## Testing Checklist

### Floor Tools
- [ ] `ha_floor_list` returns all floors with area counts
- [ ] `ha_floor_create` creates a floor with name, icon, level
- [ ] `ha_floor_update` updates floor properties
- [ ] `ha_floor_delete` removes a floor
- [ ] `ha_floor_reorder` changes floor order
- [ ] `ha_floor_entities` returns entities filtered by domain

### Label Tools
- [ ] `ha_label_list` returns all labels with counts
- [ ] `ha_label_create` creates label with name, color, icon, description
- [ ] `ha_label_update` updates label properties
- [ ] `ha_label_delete` removes a label
- [ ] `ha_label_entities` returns entities with state option
- [ ] `ha_label_devices` returns devices with metadata

### Service Targeting
- [ ] `ha_call_service` works with `floor_id` target
- [ ] `ha_call_service` works with `label_id` target
- [ ] Mixed targets work (e.g., floor_id + domain filter)

### Context Efficiency
- [ ] All new tools have limit parameters
- [ ] Large responses include pagination info
- [ ] Token warnings appear for large responses

---

## Version Updates

After implementation:

1. Update `package.json` version to `2.6.0`
2. Update `src/index.ts` server version to `2.6.0`
3. Update `src/tools/help.ts`:
   - Version to `2.6.0`
   - Tool count (add ~12 tools)
   - Add floor/label to categories

---

## Notes

- Floor/label CRUD operations require WebSocket API (not REST)
- The existing WebSocket client in `src/core/websocket-client.ts` may need extension
- Template-based queries work via REST API (`/api/template`)
- The `label_description()` template function requires HA 2025.7+
- Consider graceful fallback for older HA versions

---

## References

- [HA 2024.4 Release Notes](https://www.home-assistant.io/blog/2024/04/03/release-20244/)
- [HA Templating Docs](https://www.home-assistant.io/docs/configuration/templating/)
- [WebSocket API Docs](https://developers.home-assistant.io/docs/api/websocket/)
- [Floor Registry Source](https://github.com/home-assistant/core/blob/dev/homeassistant/components/config/floor_registry.py)
