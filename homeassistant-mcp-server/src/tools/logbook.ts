// ABOUTME: MCP tools for accessing Home Assistant logbook entries
// ABOUTME: Provides ha_get_logbook for viewing historical events and state changes

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerLogbookTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_logbook',
      description: 'Get logbook entries with optional filters and pagination (limit param, default 100)',
      inputSchema: {
        type: 'object',
        properties: {
          start_time: {
            type: 'string',
            description: 'Start time in ISO 8601 format (e.g., "2024-01-01T00:00:00Z")'
          },
          end_time: {
            type: 'string',
            description: 'End time in ISO 8601 format (e.g., "2024-12-31T23:59:59Z")'
          },
          entity_id: {
            type: 'string',
            description: 'Filter by specific entity ID (e.g., "light.living_room")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of entries to return (default: 100)',
            default: 100
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { start_time, end_time, entity_id, limit = 100 } = args;

        const entries = await client.getLogbook({
          start_time,
          end_time,
          entity_id,
          limit
        });

        return {
          entries,
          count: entries.length,
          limit,
          filters: {
            start_time,
            end_time,
            entity_id
          },
          timestamp: new Date().toISOString()
        };
      }
    }
  ];
}
