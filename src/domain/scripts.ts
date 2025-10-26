// ABOUTME: Script management tools for Home Assistant
// ABOUTME: List, execute, reload, create, update, and delete scripts

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createScriptTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_script_list',
      description: 'List all scripts',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const states = await client.get<any[]>('/states');
        return states
          .filter((state: any) => state.entity_id.startsWith('script.'))
          .map((state: any) => ({
            entity_id: state.entity_id,
            name: state.attributes.friendly_name || state.entity_id,
            mode: state.attributes.mode,
            icon: state.attributes.icon,
            last_triggered: state.attributes.last_triggered,
          }));
      },
    },

    execute: {
      name: 'ha_script_execute',
      description: 'Execute a script with optional variables',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Script entity ID' },
          variables: {
            type: 'object',
            description: 'Variables to pass to script',
            additionalProperties: true,
          },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id, variables }: { entity_id: string; variables?: Record<string, any> }) => {
        const data: any = { entity_id };
        if (variables) {
          data.variables = variables;
        }

        await client.post('/services/script/turn_on', data);
        return { success: true, entity_id };
      },
    },

    reload: {
      name: 'ha_script_reload',
      description: 'Reload all scripts from configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        await client.post('/services/script/reload');
        return { success: true };
      },
    },

    create: {
      name: 'ha_script_create',
      description: 'Create a new script',
      inputSchema: {
        type: 'object' as const,
        properties: {
          script_id: { type: 'string', description: 'Script ID (e.g., "my_script")' },
          name: { type: 'string', description: 'Friendly name' },
          sequence: {
            type: 'array',
            description: 'Script sequence steps',
            items: { type: 'object' },
          },
          mode: {
            type: 'string',
            enum: ['single', 'restart', 'queued', 'parallel'],
            description: 'Script execution mode',
          },
        },
        required: ['script_id', 'sequence'],
      },
      handler: async ({
        script_id,
        name,
        sequence,
        mode,
      }: {
        script_id: string;
        name?: string;
        sequence: any[];
        mode?: string;
      }) => {
        const config: any = { sequence };
        if (name) config.alias = name;
        if (mode) config.mode = mode;

        await client.post(`/config/script/config/${script_id}`, config);
        return { success: true, entity_id: `script.${script_id}` };
      },
    },

    update: {
      name: 'ha_script_update',
      description: 'Update an existing script',
      inputSchema: {
        type: 'object' as const,
        properties: {
          script_id: { type: 'string', description: 'Script ID' },
          name: { type: 'string', description: 'Friendly name' },
          sequence: {
            type: 'array',
            description: 'Script sequence steps',
            items: { type: 'object' },
          },
          mode: {
            type: 'string',
            enum: ['single', 'restart', 'queued', 'parallel'],
            description: 'Script execution mode',
          },
        },
        required: ['script_id'],
      },
      handler: async ({
        script_id,
        name,
        sequence,
        mode,
      }: {
        script_id: string;
        name?: string;
        sequence?: any[];
        mode?: string;
      }) => {
        const config: any = {};
        if (name) config.alias = name;
        if (sequence) config.sequence = sequence;
        if (mode) config.mode = mode;

        await client.post(`/config/script/config/${script_id}`, config);
        return { success: true, entity_id: `script.${script_id}` };
      },
    },

    delete: {
      name: 'ha_script_delete',
      description: 'Delete a script',
      inputSchema: {
        type: 'object' as const,
        properties: {
          script_id: { type: 'string', description: 'Script ID (without script. prefix)' },
        },
        required: ['script_id'],
      },
      handler: async ({ script_id }: { script_id: string }) => {
        await client.delete(`/config/script/config/${script_id}`);
        return { success: true, entity_id: `script.${script_id}` };
      },
    },
  };
}
