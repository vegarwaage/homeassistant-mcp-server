// ABOUTME: MCP tools for querying Home Assistant entity states and history
// ABOUTME: Provides ha_get_states, ha_get_history, ha_call_service, ha_get_entity_details

import { HomeAssistantClient, HAState } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerStateTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_states',
      description: 'Read current states of all Home Assistant entities (lights, sensors, switches, climate, media players, etc.). Use this to check if devices are on/off, read sensor values, see current temperatures, check device availability. Filter by domain (e.g., "light", "sensor") to see all entities of that type, or specify entity_id for a single entity. This is your primary tool for discovering what entities exist and reading their current status.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Specific entity ID (e.g., "light.living_room")' },
          domain: { type: 'string', description: 'Domain filter to list all entities of a type (e.g., "light", "sensor", "switch", "climate", "automation")' }
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
      description: 'Query historical state changes for entities over time. Use this to see when lights were turned on/off, track sensor value changes over time, analyze device usage patterns, or debug automation triggers. Supports time range filtering with ISO 8601 timestamps. Useful for understanding device behavior and troubleshooting.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: { type: 'string', description: 'Comma-separated entity IDs to query history for (e.g., "sensor.temperature,light.living_room")' },
          start_time: { type: 'string', description: 'ISO 8601 start time (e.g., "2024-01-01T00:00:00Z")' },
          end_time: { type: 'string', description: 'ISO 8601 end time (optional, defaults to now)' },
          minimal_response: { type: 'boolean', description: 'Return minimal data (states only, no attributes)' }
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
      description: 'Control Home Assistant devices by calling services. Common uses: turn lights on/off (light.turn_on/turn_off), control switches (switch.turn_on/turn_off), set climate temperature (climate.set_temperature), control media players (media_player.play/pause), trigger automations (automation.trigger), run scripts (script.turn_on). This is your primary tool for controlling and automating devices.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Service domain matching the entity type (e.g., "light", "switch", "climate", "automation", "script")' },
          service: { type: 'string', description: 'Service name - action to perform (e.g., "turn_on", "turn_off", "toggle", "set_temperature", "trigger")' },
          entity_id: { type: 'string', description: 'Target entity ID to control (e.g., "light.living_room", "switch.bedroom_fan")' },
          service_data: { type: 'string', description: 'JSON string of additional parameters (e.g., \'{"brightness": 255}\' for lights, \'{"temperature": 21}\' for climate)' }
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
      description: 'Get complete details for a specific entity including all attributes, state, and metadata. Use this to see available capabilities of a device (e.g., supported color modes for lights, current temperature and target for thermostats, track titles for media players). Returns more detail than ha_get_states.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Entity ID to query (e.g., "light.bedroom", "climate.living_room", "sensor.temperature")' }
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
