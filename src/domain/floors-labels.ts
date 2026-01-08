// ABOUTME: Floor and label registry management tools for Home Assistant
// ABOUTME: Provides floor CRUD, label CRUD, and entity queries by floor/label (HA 2024.4+)

import type { HomeAssistantClient } from '../core/ha-client.js';
import { WebSocketClient } from '../core/websocket-client.js';
import { validateLimit, sanitizeId, sanitizeSearchString } from '../validation.js';

// Get WebSocket config from environment
function getWSConfig() {
  const baseUrl = process.env.HA_BASE_URL || 'http://homeassistant:8123';
  const token = process.env.SUPERVISOR_TOKEN || '';
  return { baseUrl, token };
}

/**
 * Create floor management tools
 */
export function createFloorTools(client: HomeAssistantClient) {
  return {
    floor_list: {
      name: 'ha_floor_list',
      description: 'List all floors in Home Assistant with their areas. Floors represent building levels (HA 2024.4+).',
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
        // Use WebSocket API for floor registry
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const floors = await wsClient.sendCommand('config/floor_registry/list');

          if (!include_areas) {
            return {
              count: floors.length,
              floors: floors.map((f: any) => ({
                floor_id: f.floor_id,
                name: f.name,
                level: f.level,
                icon: f.icon
              }))
            };
          }

          // Enrich with area counts using template
          const template = `
{%- set ns = namespace(result=[]) -%}
{%- for floor_id in floors() -%}
  {%- set floor_areas = floor_areas(floor_id) | list -%}
  {%- set ns.result = ns.result + [{
    'floor_id': floor_id,
    'areas': floor_areas,
    'area_count': floor_areas | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
          const areaData = await client.renderTemplate(template);
          const areaMap = new Map<string, { floor_id: string; areas: string[]; area_count: number }>(
            (Array.isArray(areaData) ? areaData : JSON.parse(areaData)).map((a: any) => [a.floor_id, a])
          );

          return {
            count: floors.length,
            floors: floors.map((f: any) => {
              const areaInfo = areaMap.get(f.floor_id);
              return {
                floor_id: f.floor_id,
                name: f.name,
                level: f.level,
                icon: f.icon,
                aliases: f.aliases || [],
                areas: areaInfo?.areas || [],
                area_count: areaInfo?.area_count || 0
              };
            })
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    floor_create: {
      name: 'ha_floor_create',
      description: 'Create a new floor in Home Assistant (HA 2024.4+).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Floor name (e.g., "Ground Floor", "First Floor")' },
          icon: { type: 'string', description: 'MDI icon (e.g., "mdi:home-floor-0")' },
          level: { type: 'number', description: 'Floor level number (e.g., 0 for ground, 1 for first floor)' },
          aliases: {
            type: 'array',
            items: { type: 'string' },
            description: 'Alternative names for the floor'
          }
        },
        required: ['name']
      },
      handler: async ({ name, icon, level, aliases }: {
        name: string;
        icon?: string;
        level?: number;
        aliases?: string[];
      }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const result = await wsClient.sendCommand('config/floor_registry/create', {
            name,
            ...(icon && { icon }),
            ...(level !== undefined && { level }),
            ...(aliases && { aliases })
          });
          return {
            success: true,
            floor: result
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    floor_update: {
      name: 'ha_floor_update',
      description: 'Update an existing floor in Home Assistant (HA 2024.4+).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          floor_id: { type: 'string', description: 'Floor ID to update' },
          name: { type: 'string', description: 'New floor name' },
          icon: { type: 'string', description: 'New MDI icon' },
          level: { type: 'number', description: 'New floor level number' },
          aliases: {
            type: 'array',
            items: { type: 'string' },
            description: 'New alternative names'
          }
        },
        required: ['floor_id']
      },
      handler: async ({ floor_id, name, icon, level, aliases }: {
        floor_id: string;
        name?: string;
        icon?: string;
        level?: number;
        aliases?: string[];
      }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const result = await wsClient.sendCommand('config/floor_registry/update', {
            floor_id: sanitizeId(floor_id, 'floor_id'),
            ...(name && { name }),
            ...(icon !== undefined && { icon }),
            ...(level !== undefined && { level }),
            ...(aliases && { aliases })
          });
          return {
            success: true,
            floor: result
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    floor_delete: {
      name: 'ha_floor_delete',
      description: 'Delete a floor from Home Assistant (HA 2024.4+). Areas on this floor will become unassigned.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          floor_id: { type: 'string', description: 'Floor ID to delete' }
        },
        required: ['floor_id']
      },
      handler: async ({ floor_id }: { floor_id: string }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          await wsClient.sendCommand('config/floor_registry/delete', {
            floor_id: sanitizeId(floor_id, 'floor_id')
          });
          return {
            success: true,
            deleted: floor_id
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    floor_entities: {
      name: 'ha_floor_entities',
      description: 'Get all entities on a specific floor. Useful for floor-wide automations (HA 2024.4+).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          floor_id: { type: 'string', description: 'Floor ID or name' },
          domain: { type: 'string', description: 'Filter by domain (e.g., "light", "sensor")' },
          limit: { type: 'number', description: 'Maximum entities to return (default: 100)' }
        },
        required: ['floor_id']
      },
      handler: async ({ floor_id, domain, limit = 100 }: {
        floor_id: string;
        domain?: string;
        limit?: number;
      }) => {
        const actualLimit = validateLimit(limit, 100, 500);
        const safeFloorId = sanitizeSearchString(floor_id);
        const domainFilter = domain ? `| select('match', '${sanitizeId(domain, 'domain')}\\\\.')` : '';

        const template = `
{%- set entities = floor_entities('${safeFloorId}') ${domainFilter} | list -%}
{{ {'count': entities | count, 'entities': entities[:${actualLimit}]} | tojson }}
`;
        const result = await client.renderTemplate(template);
        return typeof result === 'string' ? JSON.parse(result) : result;
      }
    }
  };
}

/**
 * Create label management tools
 */
export function createLabelTools(client: HomeAssistantClient) {
  return {
    label_list: {
      name: 'ha_label_list',
      description: 'List all labels in Home Assistant with entity/device/area counts (HA 2024.4+). Labels are custom tags for cross-cutting categorization.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          include_counts: {
            type: 'boolean',
            description: 'Include entity/device/area counts for each label (default: true)'
          }
        }
      },
      handler: async ({ include_counts = true }: { include_counts?: boolean } = {}) => {
        // Use WebSocket API for label registry
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const labels = await wsClient.sendCommand('config/label_registry/list');

          if (!include_counts) {
            return {
              count: labels.length,
              labels: labels.map((l: any) => ({
                label_id: l.label_id,
                name: l.name,
                color: l.color,
                icon: l.icon,
                description: l.description
              }))
            };
          }

          // Enrich with counts using template
          const template = `
{%- set ns = namespace(result=[]) -%}
{%- for label_id in labels() -%}
  {%- set ns.result = ns.result + [{
    'label_id': label_id,
    'entity_count': label_entities(label_id) | count,
    'device_count': label_devices(label_id) | count,
    'area_count': label_areas(label_id) | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
          const countData = await client.renderTemplate(template);
          const countMap = new Map<string, { label_id: string; entity_count: number; device_count: number; area_count: number }>(
            (Array.isArray(countData) ? countData : JSON.parse(countData)).map((c: any) => [c.label_id, c])
          );

          return {
            count: labels.length,
            labels: labels.map((l: any) => {
              const countInfo = countMap.get(l.label_id);
              return {
                label_id: l.label_id,
                name: l.name,
                color: l.color,
                icon: l.icon,
                description: l.description,
                entity_count: countInfo?.entity_count || 0,
                device_count: countInfo?.device_count || 0,
                area_count: countInfo?.area_count || 0
              };
            })
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    label_create: {
      name: 'ha_label_create',
      description: 'Create a new label in Home Assistant (HA 2024.4+). Labels enable cross-cutting categorization.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Label name (e.g., "Security", "Guest Room")' },
          icon: { type: 'string', description: 'MDI icon (e.g., "mdi:shield")' },
          color: { type: 'string', description: 'Label color (e.g., "red", "blue", "green")' },
          description: { type: 'string', description: 'Label description' }
        },
        required: ['name']
      },
      handler: async ({ name, icon, color, description }: {
        name: string;
        icon?: string;
        color?: string;
        description?: string;
      }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const result = await wsClient.sendCommand('config/label_registry/create', {
            name,
            ...(icon && { icon }),
            ...(color && { color }),
            ...(description && { description })
          });
          return {
            success: true,
            label: result
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    label_update: {
      name: 'ha_label_update',
      description: 'Update an existing label in Home Assistant (HA 2024.4+).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label_id: { type: 'string', description: 'Label ID to update' },
          name: { type: 'string', description: 'New label name' },
          icon: { type: 'string', description: 'New MDI icon' },
          color: { type: 'string', description: 'New label color' },
          description: { type: 'string', description: 'New description' }
        },
        required: ['label_id']
      },
      handler: async ({ label_id, name, icon, color, description }: {
        label_id: string;
        name?: string;
        icon?: string;
        color?: string;
        description?: string;
      }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          const result = await wsClient.sendCommand('config/label_registry/update', {
            label_id: sanitizeId(label_id, 'label_id'),
            ...(name && { name }),
            ...(icon !== undefined && { icon }),
            ...(color !== undefined && { color }),
            ...(description !== undefined && { description })
          });
          return {
            success: true,
            label: result
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    label_delete: {
      name: 'ha_label_delete',
      description: 'Delete a label from Home Assistant (HA 2024.4+). Entities with this label will have it removed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label_id: { type: 'string', description: 'Label ID to delete' }
        },
        required: ['label_id']
      },
      handler: async ({ label_id }: { label_id: string }) => {
        const wsClient = new WebSocketClient(getWSConfig());
        try {
          await wsClient.sendCommand('config/label_registry/delete', {
            label_id: sanitizeId(label_id, 'label_id')
          });
          return {
            success: true,
            deleted: label_id
          };
        } finally {
          wsClient.disconnect();
        }
      }
    },

    label_entities: {
      name: 'ha_label_entities',
      description: 'Get all entities with a specific label. Useful for label-based automations (HA 2024.4+).',
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
        label_id: string;
        domain?: string;
        limit?: number;
        include_state?: boolean;
      }) => {
        const actualLimit = validateLimit(limit, 100, 500);
        const safeLabelId = sanitizeSearchString(label_id);
        const domainFilter = domain ? `| select('match', '${sanitizeId(domain, 'domain')}\\\\.')` : '';

        if (include_state) {
          const template = `
{%- set entities = label_entities('${safeLabelId}') ${domainFilter} | list -%}
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
          const result = await client.renderTemplate(template);
          return typeof result === 'string' ? JSON.parse(result) : result;
        } else {
          const template = `
{%- set entities = label_entities('${safeLabelId}') ${domainFilter} | list -%}
{{ {'count': entities | count, 'entities': entities[:${actualLimit}]} | tojson }}
`;
          const result = await client.renderTemplate(template);
          return typeof result === 'string' ? JSON.parse(result) : result;
        }
      }
    },

    label_devices: {
      name: 'ha_label_devices',
      description: 'Get all devices with a specific label (HA 2024.4+).',
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
        const safeLabelId = sanitizeSearchString(label_id);

        const template = `
{%- set devices = label_devices('${safeLabelId}') | list -%}
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
        const result = await client.renderTemplate(template);
        return typeof result === 'string' ? JSON.parse(result) : result;
      }
    },

    label_areas: {
      name: 'ha_label_areas',
      description: 'Get all areas with a specific label (HA 2024.4+).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label_id: { type: 'string', description: 'Label ID or name' },
          limit: { type: 'number', description: 'Maximum areas to return (default: 100)' }
        },
        required: ['label_id']
      },
      handler: async ({ label_id, limit = 100 }: { label_id: string; limit?: number }) => {
        const actualLimit = validateLimit(limit, 100, 500);
        const safeLabelId = sanitizeSearchString(label_id);

        const template = `
{%- set areas = label_areas('${safeLabelId}') | list -%}
{%- set ns = namespace(result=[]) -%}
{%- for area_id in areas[:${actualLimit}] -%}
  {%- set ns.result = ns.result + [{
    'area_id': area_id,
    'name': area_name(area_id)
  }] -%}
{%- endfor -%}
{{ {'count': areas | count, 'returned': ns.result | count, 'areas': ns.result} | tojson }}
`;
        const result = await client.renderTemplate(template);
        return typeof result === 'string' ? JSON.parse(result) : result;
      }
    }
  };
}
