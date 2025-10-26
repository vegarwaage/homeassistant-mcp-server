// ABOUTME: Integration management tools for Home Assistant
// ABOUTME: Discover, install, configure, and remove integrations

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createIntegrationTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_integration_list',
      description: 'List all configured integrations',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        return await client.get<any[]>('/config/config_entries/entry');
      },
    },

    discover: {
      name: 'ha_integration_discover',
      description: 'Discover available integrations',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        return await client.get('/config/integrations/discover');
      },
    },

    setup: {
      name: 'ha_integration_setup',
      description: 'Set up new integration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: { type: 'string', description: 'Integration domain' },
        },
        required: ['domain'],
      },
      handler: async ({ domain }: { domain: string }) => {
        const result = await client.post('/config/config_entries/flow', { handler: domain });
        return { success: true, flow_id: result.flow_id, ...result };
      },
    },

    configure: {
      name: 'ha_integration_configure',
      description: 'Configure integration flow',
      inputSchema: {
        type: 'object' as const,
        properties: {
          flow_id: { type: 'string', description: 'Configuration flow ID' },
          user_input: {
            type: 'object',
            description: 'Configuration input',
            additionalProperties: true,
          },
        },
        required: ['flow_id', 'user_input'],
      },
      handler: async ({ flow_id, user_input }: { flow_id: string; user_input: Record<string, any> }) => {
        const result = await client.post(`/config/config_entries/flow/${flow_id}`, user_input);
        return { success: true, ...result };
      },
    },

    reload: {
      name: 'ha_integration_reload',
      description: 'Reload integration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Config entry ID' },
        },
        required: ['entry_id'],
      },
      handler: async ({ entry_id }: { entry_id: string }) => {
        await client.post(`/config/config_entries/entry/${entry_id}/reload`);
        return { success: true, entry_id };
      },
    },

    remove: {
      name: 'ha_integration_remove',
      description: 'Remove integration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Config entry ID' },
        },
        required: ['entry_id'],
      },
      handler: async ({ entry_id }: { entry_id: string }) => {
        await client.delete(`/config/config_entries/entry/${entry_id}`);
        return { success: true, entry_id };
      },
    },

    options: {
      name: 'ha_integration_options',
      description: 'Update integration options',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Config entry ID' },
          options: {
            type: 'object',
            description: 'Integration options',
            additionalProperties: true,
          },
        },
        required: ['entry_id', 'options'],
      },
      handler: async ({ entry_id, options }: { entry_id: string; options: Record<string, any> }) => {
        await client.post(`/config/config_entries/options/flow`, {
          handler: entry_id,
          ...options,
        });
        return { success: true, entry_id };
      },
    },
  };
}
