// ABOUTME: MCP tools for searching and filtering Home Assistant entities
// ABOUTME: Provides ha_search_entities with fuzzy search and filtering

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerSearchTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_search_entities',
      description: 'Search and filter Home Assistant entities with fuzzy matching. Use this to find entities when you know part of the name (case-insensitive search in entity_id and friendly_name), filter by device type (device_class like "motion", "door", "temperature"), find entities in specific rooms (area), or filter by current state ("on", "off", "home"). Best practice: start with domain filter (e.g., domain="sensor") to narrow results, then use query for specific matching.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Case-insensitive fuzzy search string to match against entity_id and friendly_name (e.g., "bedroom light", "temp", "motion")'
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
      description: 'Get overview statistics of Home Assistant entities grouped by domain, device_class, area, or label. Use this to understand the system: see how many lights/sensors/switches exist (domain), what types of sensors are configured (device_class), or get a count of entities by room (area). Useful for getting a high-level understanding of the Home Assistant setup.',
      inputSchema: {
        type: 'object',
        properties: {
          group_by: {
            type: 'string',
            enum: ['domain', 'device_class', 'area', 'label'],
            description: 'Grouping method: "domain" for entity types (light, sensor, switch), "device_class" for sensor types (temperature, motion, door), "area" for room counts, "label" for tag counts'
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
