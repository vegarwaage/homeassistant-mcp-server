// ABOUTME: MCP tools for calendar entities and events
// ABOUTME: Provides ha_list_calendars and ha_get_calendar_events

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerCalendarsTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_list_calendars',
      description: 'List all calendar entities',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const calendars = await client.listCalendars();

        return {
          calendars: calendars.map(cal => ({
            entity_id: cal.entity_id,
            friendly_name: cal.attributes.friendly_name,
            state: cal.state,
            all_day: cal.attributes.all_day,
            start_time: cal.attributes.start_time,
            end_time: cal.attributes.end_time,
            location: cal.attributes.location,
            description: cal.attributes.description,
            message: cal.attributes.message
          })),
          count: calendars.length,
          timestamp: new Date().toISOString()
        };
      }
    },
    {
      name: 'ha_get_calendar_events',
      description: 'Get events for date range with pagination (limit param, default 100)',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'Calendar entity ID (e.g., "calendar.personal")'
          },
          start: {
            type: 'string',
            description: 'Start time in ISO 8601 format (e.g., "2024-01-01T00:00:00Z")'
          },
          end: {
            type: 'string',
            description: 'End time in ISO 8601 format (e.g., "2024-12-31T23:59:59Z")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return (default: 100)',
            default: 100
          }
        },
        required: ['entity_id', 'start', 'end']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_id, start, end, limit = 100 } = args;

        if (!entity_id.startsWith('calendar.')) {
          throw new Error('entity_id must be a calendar entity (e.g., calendar.personal)');
        }

        // Verify the calendar entity exists
        const states = await client.getStates(entity_id);
        if (!states || states.length === 0) {
          throw new Error(`Calendar entity "${entity_id}" not found`);
        }

        const calendar = states[0];

        // Fetch calendar events
        const allEvents = await client.getCalendarEvents({
          entityId: entity_id,
          start,
          end
        });

        // Apply pagination limit
        const events = allEvents.slice(0, limit);

        return {
          entity_id,
          friendly_name: calendar.attributes.friendly_name,
          events,
          total_events: allEvents.length,
          returned_events: events.length,
          limit,
          truncated: allEvents.length > limit,
          start,
          end,
          timestamp: new Date().toISOString()
        };
      }
    }
  ];
}
