// ABOUTME: MCP tools for querying recent Home Assistant activity
// ABOUTME: Provides ha_get_recent_activity with time-based filtering

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

/**
 * Parse time offset string (e.g., "1h", "30m", "24h") to ISO timestamp
 */
function parseTimeOffset(since: string): string {
  const match = since.match(/^(\d+)(h|m|d)$/);
  if (!match) {
    throw new Error('Invalid time format. Use format like "1h", "30m", "24h"');
  }

  const [, amount, unit] = match;
  const now = new Date();
  const offset = parseInt(amount);

  switch (unit) {
    case 'h':
      now.setHours(now.getHours() - offset);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() - offset);
      break;
    case 'd':
      now.setDate(now.getDate() - offset);
      break;
  }

  return now.toISOString();
}

export function registerActivityTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_recent_activity',
      description: 'Get entities that changed state recently, with time-based filtering',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'Time period: "1h", "30m", "24h" (default: "1h")'
          },
          device_class: {
            type: 'string',
            description: 'Filter by device_class'
          },
          domain: {
            type: 'string',
            description: 'Filter by domain'
          },
          state: {
            type: 'string',
            description: 'Only show entities currently in this state'
          },
          area: {
            type: 'string',
            description: 'Filter by area name'
          },
          significant_only: {
            type: 'boolean',
            description: 'Use HA significant_changes_only filter (default: true)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const {
          since = '1h',
          device_class,
          domain,
          state,
          area,
          significant_only = true,
          limit = 50
        } = args;

        const startTime = parseTimeOffset(since);

        const history = await client.getHistory({
          start_time: startTime,
          minimal_response: true,
          significant_changes_only: significant_only
        });

        let activities: any[] = [];
        for (const entityHistory of history) {
          if (!entityHistory || entityHistory.length === 0) continue;

          const latest = entityHistory[entityHistory.length - 1];
          const previous = entityHistory[entityHistory.length - 2];

          activities.push({
            entity_id: latest.entity_id,
            state: latest.state,
            previous_state: previous?.state,
            last_changed: latest.last_changed,
            friendly_name: latest.attributes?.friendly_name,
            device_class: latest.attributes?.device_class
          });
        }

        if (device_class) {
          activities = activities.filter(a => a.device_class === device_class);
        }

        if (domain) {
          activities = activities.filter(a => a.entity_id.startsWith(`${domain}.`));
        }

        if (state) {
          activities = activities.filter(a => a.state === state);
        }

        if (area) {
          const lowerArea = area.toLowerCase();
          activities = activities.filter(a =>
            a.friendly_name?.toLowerCase().includes(lowerArea)
          );
        }

        activities.sort((a, b) =>
          new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime()
        );

        activities = activities.slice(0, Math.min(limit, 100));

        return {
          count: activities.length,
          since: startTime,
          activities
        };
      }
    }
  ];
}
