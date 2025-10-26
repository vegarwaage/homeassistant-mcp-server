// ABOUTME: HACS (Home Assistant Community Store) management tools
// ABOUTME: Browse, install, update, and remove HACS repositories

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createHACSTools(client: HomeAssistantClient) {
  return {
    repositories: {
      name: 'ha_hacs_repositories',
      description: 'List HACS repositories',
      inputSchema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            enum: ['integration', 'plugin', 'theme', 'appdaemon', 'python_script', 'netdaemon'],
            description: 'Repository category',
          },
        },
      },
      handler: async ({ category }: { category?: string } = {}) => {
        const response = await client.get<any>('/api/hacs/repositories');
        if (category) {
          return response.filter((repo: any) => repo.category === category);
        }
        return response;
      },
    },

    repository_info: {
      name: 'ha_hacs_repository_info',
      description: 'Get HACS repository details',
      inputSchema: {
        type: 'object' as const,
        properties: {
          repository_id: { type: 'string', description: 'Repository ID' },
        },
        required: ['repository_id'],
      },
      handler: async ({ repository_id }: { repository_id: string }) => {
        return await client.get(`/api/hacs/repository/${repository_id}`);
      },
    },

    install: {
      name: 'ha_hacs_install',
      description: 'Install HACS repository',
      inputSchema: {
        type: 'object' as const,
        properties: {
          repository_id: { type: 'string', description: 'Repository ID' },
          version: { type: 'string', description: 'Specific version (optional)' },
        },
        required: ['repository_id'],
      },
      handler: async ({ repository_id, version }: { repository_id: string; version?: string }) => {
        const data: any = {};
        if (version) data.version = version;

        await client.post(`/api/hacs/repository/${repository_id}/install`, data);
        return { success: true, repository_id };
      },
    },

    update: {
      name: 'ha_hacs_update',
      description: 'Update HACS repository',
      inputSchema: {
        type: 'object' as const,
        properties: {
          repository_id: { type: 'string', description: 'Repository ID' },
        },
        required: ['repository_id'],
      },
      handler: async ({ repository_id }: { repository_id: string }) => {
        await client.post(`/api/hacs/repository/${repository_id}/update`);
        return { success: true, repository_id };
      },
    },

    remove: {
      name: 'ha_hacs_remove',
      description: 'Remove HACS repository',
      inputSchema: {
        type: 'object' as const,
        properties: {
          repository_id: { type: 'string', description: 'Repository ID' },
        },
        required: ['repository_id'],
      },
      handler: async ({ repository_id }: { repository_id: string }) => {
        await client.delete(`/api/hacs/repository/${repository_id}`);
        return { success: true, repository_id };
      },
    },
  };
}
