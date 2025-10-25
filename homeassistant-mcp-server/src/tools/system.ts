// ABOUTME: MCP tools for Home Assistant system information, logs, and diagnostics
// ABOUTME: Provides ha_system_info, ha_get_logs, ha_restart

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerSystemTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_system_info',
      description: 'Get Home Assistant system information and health status',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const info = await client.getSystemInfo();
        return info;
      }
    },
    {
      name: 'ha_get_logs',
      description: 'Fetch Home Assistant logs with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          lines: { type: 'number', description: 'Number of log lines (default: 100)' },
          filter: { type: 'string', description: 'Regex pattern to filter logs' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { lines = 100, filter } = args;

        let logs = await client.getLogs(lines);

        if (filter) {
          const regex = new RegExp(filter, 'i');
          logs = logs.filter(log => regex.test(log.message) || regex.test(log.source || ''));
        }

        return {
          count: logs.length,
          logs
        };
      }
    },
    {
      name: 'ha_restart',
      description: 'Restart Home Assistant (requires confirmation)',
      inputSchema: {
        type: 'object',
        properties: {
          confirm: { type: 'string', enum: ['yes'], description: 'Must be "yes" to confirm' }
        },
        required: ['confirm']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { confirm } = args;

        if (!confirm || confirm !== 'yes') {
          return {
            success: false,
            message: 'Restart requires confirmation. Set confirm="yes" to proceed.'
          };
        }

        await client.reloadConfig('core');

        return {
          success: true,
          message: 'Home Assistant restart initiated'
        };
      }
    }
  ];
}
