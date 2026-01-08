// ABOUTME: MCP tools for querying Home Assistant entity states and history
// ABOUTME: Provides ha_get_states, ha_get_history, ha_call_service, ha_get_entity_details

import { HomeAssistantClient, HAState } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerStateTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_states',
      description: 'Read current states of Home Assistant entities. Filter by domain (e.g., "light", "sensor") or specify entity_id for a single entity. Use minimal=true for smaller responses (entity_id, state, friendly_name only). Default limit is 50 entities to avoid flooding context.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Specific entity ID (e.g., "light.living_room")' },
          domain: { type: 'string', description: 'Domain filter to list all entities of a type (e.g., "light", "sensor", "switch", "climate", "automation")' },
          limit: { type: 'number', description: 'Maximum entities to return (default: 50, max: 500). Use 0 for unlimited (not recommended).' },
          offset: { type: 'number', description: 'Number of entities to skip for pagination (default: 0)' },
          minimal: { type: 'boolean', description: 'Return minimal data (entity_id, state, friendly_name only) to reduce context usage. Default: false' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_id, domain, limit = 50, offset = 0, minimal = false } = args;

        let states = await client.getStates(entity_id);

        if (domain && !entity_id) {
          states = states.filter(state => state.entity_id.startsWith(`${domain}.`));
        }

        const totalCount = states.length;

        // Apply pagination
        const actualLimit = limit === 0 ? states.length : Math.min(Math.max(1, limit), 500);
        const actualOffset = Math.max(0, offset);
        states = states.slice(actualOffset, actualOffset + actualLimit);

        // Apply minimal transformation if requested
        const resultStates = minimal
          ? states.map(s => ({
              entity_id: s.entity_id,
              state: s.state,
              friendly_name: s.attributes?.friendly_name,
              last_changed: s.last_changed
            }))
          : states;

        const response: any = {
          count: resultStates.length,
          total_available: totalCount,
          states: resultStates
        };

        // Add pagination info if relevant
        if (totalCount > actualLimit || actualOffset > 0) {
          response.pagination = {
            limit: actualLimit,
            offset: actualOffset,
            has_more: actualOffset + actualLimit < totalCount,
            next_offset: actualOffset + actualLimit < totalCount ? actualOffset + actualLimit : null
          };
        }

        // Add warning if large unbounded request
        if (limit === 0 && totalCount > 100) {
          response.warning = `Returning ${totalCount} entities. Consider using domain filter, limit, or minimal=true to reduce context usage.`;
        }

        return response;
      }
    },
    {
      name: 'ha_get_history',
      description: 'Query historical state changes for entities over time. Use this to see when lights were turned on/off, track sensor value changes over time, analyze device usage patterns, or debug automation triggers. Supports time range filtering with ISO 8601 timestamps. Useful for understanding device behavior and troubleshooting. WARNING: Can return large datasets for multiple entities over long periods. Consider using state_filter or limit parameters, or ha_find_unavailable_devices for offline detection.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: { type: 'string', description: 'Comma-separated entity IDs to query history for (e.g., "sensor.temperature,light.living_room")' },
          start_time: { type: 'string', description: 'ISO 8601 start time (e.g., "2024-01-01T00:00:00Z")' },
          end_time: { type: 'string', description: 'ISO 8601 end time (optional, defaults to now)' },
          minimal_response: { type: 'boolean', description: 'Return minimal data (states only, reduced attributes)' },
          no_attributes: { type: 'boolean', description: 'Exclude all attributes from response (more aggressive than minimal_response, smallest response size)' },
          state_filter: { type: 'string', description: 'Comma-separated list of states to filter by (e.g., "unavailable,unknown" for offline detection, "on,off" for binary states)' },
          limit: { type: 'number', description: 'Maximum number of state changes to return per entity (default: 100, max: 1000)' },
          offset: { type: 'number', description: 'Number of state changes to skip per entity for pagination (default: 0)' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_ids, start_time, end_time, minimal_response, no_attributes, state_filter, limit = 100, offset = 0 } = args;

        // Validate limit
        const actualLimit = Math.min(Math.max(1, limit), 1000);

        const history = await client.getHistory({
          entity_ids: entity_ids ? entity_ids.split(',') : undefined,
          start_time,
          end_time,
          minimal_response: minimal_response || false,
          no_attributes: no_attributes || false
        });

        // Apply state filter if provided
        let filteredHistory = history;
        if (state_filter) {
          const allowedStates = state_filter.split(',').map((s: string) => s.trim());
          filteredHistory = history.map(entityHistory =>
            entityHistory.filter((state: HAState) => allowedStates.includes(state.state))
          );
        }

        // Apply pagination (limit/offset) per entity
        const paginatedHistory = filteredHistory.map(entityHistory =>
          entityHistory.slice(offset, offset + actualLimit)
        );

        // Estimate response size
        const jsonStr = JSON.stringify(paginatedHistory);
        const estimatedTokens = Math.ceil(jsonStr.length / 4);
        const totalRecords = filteredHistory.reduce((sum, eh) => sum + eh.length, 0);
        const returnedRecords = paginatedHistory.reduce((sum, eh) => sum + eh.length, 0);

        const response: any = {
          entity_count: paginatedHistory.length,
          history: paginatedHistory,
          pagination: {
            limit: actualLimit,
            offset: offset,
            returned_records: returnedRecords,
            total_records: totalRecords,
            has_more: returnedRecords < totalRecords
          },
          estimated_tokens: estimatedTokens
        };

        // Add warning if response is large
        if (estimatedTokens > 15000) {
          response.warning = `Large response (${estimatedTokens} estimated tokens). Consider using state_filter, smaller limit, or querying fewer entities.`;
        }

        return response;
      }
    },
    {
      name: 'ha_call_service',
      description: 'Control Home Assistant devices by calling services. Common uses: turn lights on/off (light.turn_on/turn_off), control switches (switch.turn_on/turn_off), set climate temperature (climate.set_temperature), control media players (media_player.play/pause), trigger automations (automation.trigger), run scripts (script.turn_on). This is your primary tool for controlling and automating devices. Use return_response=true to get response data from services that support it (HA 2024.8+).',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Service domain matching the entity type (e.g., "light", "switch", "climate", "automation", "script")' },
          service: { type: 'string', description: 'Service name - action to perform (e.g., "turn_on", "turn_off", "toggle", "set_temperature", "trigger")' },
          entity_id: { type: 'string', description: 'Target entity ID to control (e.g., "light.living_room", "switch.bedroom_fan")' },
          service_data: { type: 'string', description: 'JSON string of additional parameters (e.g., \'{"brightness": 255}\' for lights, \'{"temperature": 21}\' for climate)' },
          return_response: { type: 'boolean', description: 'If true, returns response data from services that support it (HA 2024.8+). Required for services that always return data.' }
        },
        required: ['domain', 'service']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { domain, service, entity_id, service_data, return_response } = args;

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
          service_data: parsedData,
          return_response: return_response || false
        });

        return {
          success: true,
          result: result,
          ...(return_response && { response_data: result })
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
    },
    {
      name: 'ha_find_unavailable_devices',
      description: 'Efficiently find devices that are currently offline or went offline during a time period. Returns summary statistics and device details WITHOUT returning full history data. Use this instead of ha_get_history when you want to check device availability/health. Much more token-efficient than ha_get_history for offline detection.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: { type: 'string', description: 'Comma-separated entity IDs to check (e.g., "climate.panel_soverom3,sensor.temperature")' },
          since: { type: 'string', description: 'How far back to look for offline events. ISO 8601 time or relative like "24h", "7d", "30d". Defaults to "7d"' }
        },
        required: ['entity_ids']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_ids, since = '7d' } = args;

        if (!entity_ids) {
          throw new Error('entity_ids is required');
        }

        const entityList = entity_ids.split(',').map((id: string) => id.trim());

        // Parse relative time like "7d", "24h" to ISO timestamp
        let start_time: string;
        const relativeTimeMatch = since.match(/^(\d+)([hdwm])$/);
        if (relativeTimeMatch) {
          const value = parseInt(relativeTimeMatch[1]);
          const unit = relativeTimeMatch[2];
          const now = new Date();

          switch(unit) {
            case 'h': now.setHours(now.getHours() - value); break;
            case 'd': now.setDate(now.getDate() - value); break;
            case 'w': now.setDate(now.getDate() - (value * 7)); break;
            case 'm': now.setMonth(now.getMonth() - value); break;
          }
          start_time = now.toISOString();
        } else {
          start_time = since;
        }

        // Get current states
        const currentStates = await client.getStates();
        const monitoredStates = currentStates.filter(s => entityList.includes(s.entity_id));

        // Get history to find offline events
        const history = await client.getHistory({
          entity_ids: entityList,
          start_time,
          minimal_response: true
        });

        // Analyze each device
        const offline_now: string[] = [];
        const went_offline_recently: any[] = [];
        const always_online: string[] = [];

        monitoredStates.forEach((currentState, idx) => {
          const entity_id = currentState.entity_id;
          const entityHistory = history[idx] || [];

          const isCurrentlyOffline = ['unavailable', 'unknown'].includes(currentState.state);

          // Count offline events
          const offlineStates = entityHistory.filter((s: HAState) =>
            ['unavailable', 'unknown'].includes(s.state)
          );

          if (isCurrentlyOffline) {
            offline_now.push(entity_id);

            // Find when it went offline
            const lastOnlineState = entityHistory.reverse().find((s: HAState) =>
              !['unavailable', 'unknown'].includes(s.state)
            );

            went_offline_recently.push({
              entity_id,
              friendly_name: currentState.attributes?.friendly_name || entity_id,
              current_state: currentState.state,
              last_seen: lastOnlineState?.last_changed || start_time,
              offline_duration_ms: lastOnlineState
                ? Date.now() - new Date(lastOnlineState.last_changed).getTime()
                : null,
              offline_events_in_period: offlineStates.length
            });
          } else if (offlineStates.length > 0) {
            // Was offline during period but is online now
            went_offline_recently.push({
              entity_id,
              friendly_name: currentState.attributes?.friendly_name || entity_id,
              current_state: currentState.state,
              last_offline: offlineStates[offlineStates.length - 1]?.last_changed,
              offline_events_in_period: offlineStates.length
            });
          } else {
            always_online.push(entity_id);
          }
        });

        return {
          summary: {
            total_monitored: entityList.length,
            currently_offline: offline_now.length,
            went_offline_in_period: went_offline_recently.length,
            always_online: always_online.length,
            period_checked: since
          },
          offline_now,
          offline_or_recently_offline: went_offline_recently,
          always_online
        };
      }
    }
  ];
}
