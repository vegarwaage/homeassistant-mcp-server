// ABOUTME: MCP tools for monitoring Home Assistant system health and status
// ABOUTME: Provides supervisor info, integrations list, and diagnostics tools

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerMonitoringTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_supervisor_info',
      description: 'Get supervisor, core, OS, or host information from Home Assistant Supervisor API',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            enum: ['supervisor', 'core', 'os', 'host'],
            description: 'Specific component to query, or omit to get all'
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { component } = args;

        try {
          const info = await client.getSupervisorInfo(component);
          return info;
        } catch (error: any) {
          return {
            error: error.message,
            note: 'Supervisor API may not be available on all Home Assistant installations'
          };
        }
      }
    },
    {
      name: 'ha_list_integrations',
      description: 'List all loaded integrations and components in Home Assistant',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const integrations = await client.getIntegrations();

        return {
          count: integrations.length,
          integrations: integrations.sort()
        };
      }
    },
    {
      name: 'ha_get_diagnostics',
      description: 'Get system diagnostics, health information, and resolution suggestions',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        try {
          const diagnostics = await client.getDiagnostics();
          return diagnostics;
        } catch (error: any) {
          return {
            error: error.message,
            note: 'Diagnostics may not be available on all Home Assistant installations'
          };
        }
      }
    }
  ];
}
