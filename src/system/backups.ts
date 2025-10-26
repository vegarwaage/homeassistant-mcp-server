// ABOUTME: Backup and restore management tools
// ABOUTME: Create, list, restore, download, and delete backups

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createBackupTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_backup_list',
      description: 'List all backups',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const response = await client.get<any>('/hassio/backups');
        return response.backups || [];
      },
    },

    info: {
      name: 'ha_backup_info',
      description: 'Get backup details',
      inputSchema: {
        type: 'object' as const,
        properties: {
          slug: { type: 'string', description: 'Backup slug' },
        },
        required: ['slug'],
      },
      handler: async ({ slug }: { slug: string }) => {
        return await client.get(`/hassio/backups/${slug}/info`);
      },
    },

    create: {
      name: 'ha_backup_create',
      description: 'Create new backup',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Backup name' },
          type: {
            type: 'string',
            enum: ['full', 'partial'],
            description: 'Backup type',
          },
          addons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Add-ons to include (partial backup)',
          },
          folders: {
            type: 'array',
            items: { type: 'string' },
            description: 'Folders to include (partial backup)',
          },
        },
      },
      handler: async ({
        name,
        type,
        addons,
        folders,
      }: {
        name?: string;
        type?: string;
        addons?: string[];
        folders?: string[];
      } = {}) => {
        const data: any = {};
        if (name) data.name = name;
        if (type) data.type = type;
        if (addons) data.addons = addons;
        if (folders) data.folders = folders;

        const result = await client.post('/hassio/backups/new', data);
        return { success: true, slug: result.slug, ...result };
      },
    },

    restore: {
      name: 'ha_backup_restore',
      description: 'Restore from backup',
      inputSchema: {
        type: 'object' as const,
        properties: {
          slug: { type: 'string', description: 'Backup slug' },
          password: { type: 'string', description: 'Backup password (if encrypted)' },
        },
        required: ['slug'],
      },
      handler: async ({ slug, password }: { slug: string; password?: string }) => {
        const data: any = {};
        if (password) data.password = password;

        await client.post(`/hassio/backups/${slug}/restore/full`, data);
        return { success: true, slug };
      },
    },

    remove: {
      name: 'ha_backup_remove',
      description: 'Delete backup',
      inputSchema: {
        type: 'object' as const,
        properties: {
          slug: { type: 'string', description: 'Backup slug' },
        },
        required: ['slug'],
      },
      handler: async ({ slug }: { slug: string }) => {
        await client.delete(`/hassio/backups/${slug}`);
        return { success: true, slug };
      },
    },
  };
}
