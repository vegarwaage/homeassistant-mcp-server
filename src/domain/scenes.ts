// ABOUTME: Scene management tools for Home Assistant
// ABOUTME: List, activate, create, and delete scenes

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createSceneTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_scene_list',
      description: 'List all scenes',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const states = await client.get<any[]>('/states');
        return states
          .filter((state: any) => state.entity_id.startsWith('scene.'))
          .map((state: any) => ({
            entity_id: state.entity_id,
            name: state.attributes.friendly_name || state.entity_id,
            icon: state.attributes.icon,
          }));
      },
    },

    activate: {
      name: 'ha_scene_activate',
      description: 'Activate a scene',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Scene entity ID' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        await client.post('/services/scene/turn_on', {
          entity_id,
        });
        return { success: true, entity_id };
      },
    },

    create: {
      name: 'ha_scene_create',
      description: 'Create scene from current device states',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Scene name' },
          entities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to include',
          },
        },
        required: ['name', 'entities'],
      },
      handler: async ({ name, entities }: { name: string; entities: string[] }) => {
        const scene_id = name.toLowerCase().replace(/\s+/g, '_');

        await client.post('/services/scene/create', {
          scene_id,
          snapshot_entities: entities,
        });

        return {
          success: true,
          entity_id: `scene.${scene_id}`,
          name,
        };
      },
    },

    delete: {
      name: 'ha_scene_delete',
      description: 'Delete a scene',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Scene entity ID' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        await client.post('/services/scene/delete', {
          entity_id,
        });
        return { success: true, entity_id };
      },
    },
  };
}
