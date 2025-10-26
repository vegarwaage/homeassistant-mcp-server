// ABOUTME: Home Assistant Supervisor add-on management tools
// ABOUTME: Install, start, stop, update, and configure add-ons

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createAddonTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_addon_list',
      description: 'List all add-ons',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const response = await client.get<any>('/hassio/addons');
        return response.addons || [];
      },
    },

    info: {
      name: 'ha_addon_info',
      description: 'Get add-on details',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        return await client.get(`/hassio/addons/${addon}/info`);
      },
    },

    start: {
      name: 'ha_addon_start',
      description: 'Start add-on',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/start`);
        return { success: true, addon };
      },
    },

    stop: {
      name: 'ha_addon_stop',
      description: 'Stop add-on',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/stop`);
        return { success: true, addon };
      },
    },

    restart: {
      name: 'ha_addon_restart',
      description: 'Restart add-on',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/restart`);
        return { success: true, addon };
      },
    },

    install: {
      name: 'ha_addon_install',
      description: 'Install add-on',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/install`);
        return { success: true, addon };
      },
    },

    uninstall: {
      name: 'ha_addon_uninstall',
      description: 'Uninstall add-on',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/uninstall`);
        return { success: true, addon };
      },
    },

    update: {
      name: 'ha_addon_update',
      description: 'Update add-on to latest version',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
        },
        required: ['addon'],
      },
      handler: async ({ addon }: { addon: string }) => {
        await client.post(`/hassio/addons/${addon}/update`);
        return { success: true, addon };
      },
    },

    set_options: {
      name: 'ha_addon_set_options',
      description: 'Update add-on configuration options',
      inputSchema: {
        type: 'object' as const,
        properties: {
          addon: { type: 'string', description: 'Add-on slug' },
          options: {
            type: 'object',
            description: 'Configuration options',
            additionalProperties: true,
          },
          boot: { type: 'string', enum: ['auto', 'manual'], description: 'Boot mode' },
          auto_update: { type: 'boolean', description: 'Auto update enabled' },
        },
        required: ['addon'],
      },
      handler: async ({
        addon,
        options,
        boot,
        auto_update,
      }: {
        addon: string;
        options?: Record<string, any>;
        boot?: string;
        auto_update?: boolean;
      }) => {
        const data: any = {};
        if (options) data.options = options;
        if (boot) data.boot = boot;
        if (auto_update !== undefined) data.auto_update = auto_update;

        await client.post(`/hassio/addons/${addon}/options`, data);
        return { success: true, addon };
      },
    },
  };
}
