// ABOUTME: Event firing and listener management tools
// ABOUTME: Allows triggering custom events and viewing active listeners

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const HA_URL = process.env.HA_URL || 'http://supervisor/core';
const TOKEN = process.env.SUPERVISOR_TOKEN || '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

export const eventsTools: Tool[] = [
  {
    name: 'ha_fire_event',
    description: 'Fire a custom event with optional data payload.',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: { type: 'string', description: 'Event type to fire' },
        event_data: { type: 'object', description: 'Event data payload (optional)', default: {} }
      },
      required: ['event_type']
    }
  },
  {
    name: 'ha_list_event_listeners',
    description: 'Get all active event listeners and their counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

export async function handleEventsTool(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case 'ha_fire_event': {
        const { event_type, event_data = {} } = args;

        await axios.post(
          `${HA_URL}/api/events/${event_type}`,
          event_data,
          { headers }
        );

        return {
          event_type,
          event_data,
          fired: true
        };
      }

      case 'ha_list_event_listeners': {
        const response = await axios.get(`${HA_URL}/api/events`, { headers });

        return {
          listeners: response.data,
          count: response.data.length
        };
      }

      default:
        return { error: 'unknown_tool', tool: name };
    }
  } catch (error: any) {
    return {
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
}
