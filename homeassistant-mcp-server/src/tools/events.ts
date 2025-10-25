// ABOUTME: MCP tools for firing custom events and viewing event listeners
// ABOUTME: Provides ha_fire_event and ha_list_event_listeners

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerEventsTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_fire_event',
      description: 'Fire a custom event with optional data payload',
      inputSchema: {
        type: 'object',
        properties: {
          event_type: {
            type: 'string',
            description: 'Event type to fire'
          },
          event_data: {
            type: 'object',
            description: 'Event data payload (optional)',
            default: {}
          }
        },
        required: ['event_type']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { event_type, event_data = {} } = args;

        if (!event_type || typeof event_type !== 'string') {
          throw new Error('event_type must be a non-empty string');
        }

        await client.fireEvent(event_type, event_data);

        return {
          success: true,
          event_type,
          event_data,
          fired_at: new Date().toISOString()
        };
      }
    },
    {
      name: 'ha_list_event_listeners',
      description: 'Get all active event listeners and their counts',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const listeners = await client.getEventListeners();

        return {
          listeners,
          count: listeners.length,
          timestamp: new Date().toISOString()
        };
      }
    }
  ];
}
