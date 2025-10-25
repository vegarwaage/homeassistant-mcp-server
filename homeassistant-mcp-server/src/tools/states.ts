// ABOUTME: MCP tools for querying Home Assistant entity states and history
// ABOUTME: Provides ha_get_states, ha_get_history, ha_call_service, ha_get_entity_details

import { HomeAssistantClient } from '../ha-client.js';
import { HAState, ToolDefinition } from '../types.js';

export function registerStateTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_states',
      description: 'Get current state of Home Assistant entities, optionally filtered by entity_id or domain',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Specific entity ID (e.g., "light.living_room")' },
          domain: { type: 'string', description: 'Domain filter (e.g., "light", "sensor", "switch")' }
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
    },
    {
      name: 'ha_get_history',
      description: 'Query historical data for entities with optional time range',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: { type: 'string', description: 'Comma-separated entity IDs' },
          start_time: { type: 'string', description: 'ISO 8601 start time' },
          end_time: { type: 'string', description: 'ISO 8601 end time' },
          minimal_response: { type: 'boolean', description: 'Return minimal data' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_ids, start_time, end_time, minimal_response } = args;

        const history = await client.getHistory({
          entity_ids: entity_ids ? entity_ids.split(',') : undefined,
          start_time,
          end_time,
          minimal_response: minimal_response || false
        });

        return {
          entity_count: history.length,
          history: history
        };
      }
    },
    {
      name: 'ha_call_service',
      description: 'Call any Home Assistant service to control devices',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Service domain (e.g., "light", "switch")' },
          service: { type: 'string', description: 'Service name (e.g., "turn_on", "turn_off")' },
          entity_id: { type: 'string', description: 'Target entity ID' },
          service_data: { type: 'string', description: 'JSON string of additional service data' }
        },
        required: ['domain', 'service']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { domain, service, entity_id, service_data } = args;

        // Parse service_data JSON with error handling
        let parsedData;
        if (service_data) {
          try {
            parsedData = JSON.parse(service_data);
          } catch (error: any) {
            throw new Error(`Invalid service_data JSON: ${error.message}`);
          }
        }

        const result = await client.callService({
          domain,
          service,
          target: entity_id ? { entity_id } : undefined,
          service_data: parsedData
        });

        return {
          success: true,
          result: result
        };
      }
    },
    {
      name: 'ha_get_entity_details',
      description: 'Get full details and attributes for a specific entity',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Entity ID to query' }
        },
        required: ['entity_id']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_id } = args;

        if (!entity_id) {
          throw new Error('entity_id is required');
        }

        const states = await client.getStates(entity_id);
        return states[0];
      }
    }
  ];
}
