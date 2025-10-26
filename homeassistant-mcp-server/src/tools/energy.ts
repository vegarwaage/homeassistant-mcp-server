// ABOUTME: MCP tools for energy dashboard and long-term statistics
// ABOUTME: Provides ha_get_energy_data and ha_get_statistics

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerEnergyTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_energy_data',
      description: 'Get energy dashboard data including solar, battery, grid consumption and return data',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            description: 'Time period for energy data aggregation (default: day)'
          },
          start_time: {
            type: 'string',
            description: 'Start time in ISO format (optional)'
          },
          end_time: {
            type: 'string',
            description: 'End time in ISO format (optional)'
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { period = 'day', start_time, end_time } = args;

        try {
          const energyData = await client.getEnergyData({
            period,
            start_time,
            end_time
          });

          return {
            period,
            start_time,
            end_time,
            data: energyData,
            timestamp: new Date().toISOString()
          };
        } catch (error: any) {
          if (error.response?.status === 404) {
            throw new Error('Energy dashboard not configured. Please set up the Energy dashboard in Home Assistant first.');
          }
          throw error;
        }
      }
    },
    {
      name: 'ha_get_statistics',
      description: 'Get long-term historical statistics for entities (efficient for queries > 10 days)',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of entity IDs to get statistics for'
          },
          start_time: {
            type: 'string',
            description: 'Start time in ISO format (e.g., "2024-01-01T00:00:00Z")'
          },
          end_time: {
            type: 'string',
            description: 'End time in ISO format (optional, defaults to now)'
          },
          period: {
            type: 'string',
            enum: ['hour', 'day', 'month'],
            description: 'Aggregation period (default: hour)'
          }
        },
        required: ['entity_ids']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_ids, start_time, end_time, period = 'hour' } = args;

        if (!entity_ids || entity_ids.length === 0) {
          throw new Error('entity_ids parameter must contain at least one entity ID');
        }

        try {
          const statistics = await client.getStatistics({
            entity_ids,
            start_time,
            end_time,
            period
          });

          // Transform the statistics data for better readability
          const result: any = {
            period,
            start_time,
            end_time,
            entity_count: entity_ids.length,
            statistics: {}
          };

          // Home Assistant returns statistics keyed by entity_id
          for (const entityId of entity_ids) {
            if (statistics[entityId]) {
              result.statistics[entityId] = {
                data_points: statistics[entityId].length,
                values: statistics[entityId]
              };
            } else {
              result.statistics[entityId] = {
                data_points: 0,
                values: [],
                message: 'No statistics available for this entity'
              };
            }
          }

          return result;
        } catch (error: any) {
          if (error.response?.status === 400) {
            throw new Error('Invalid request. Make sure entity_ids are valid and support statistics.');
          }
          throw error;
        }
      }
    }
  ];
}
