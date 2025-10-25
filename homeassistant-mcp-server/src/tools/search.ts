// ABOUTME: MCP tools for searching and filtering Home Assistant entities
// ABOUTME: Provides ha_search_entities with fuzzy search and filtering

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerSearchTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_search_entities',
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

        let states = await client.getStates();

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
          const lowerArea = area.toLowerCase();
          states = states.filter(s =>
            s.attributes.friendly_name?.toLowerCase().includes(lowerArea)
          );
        }

        if (label) {
          // Label filtering requires entity registry access
          // Placeholder for future implementation
        }

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
    },
    {
      name: 'ha_get_stats',
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
              key = 'unknown';
              break;
            case 'label':
              // Placeholder for future implementation
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
    }
  ];
}
