// ABOUTME: Area and zone management tools for Home Assistant
// ABOUTME: Organize spaces and define geographic zones

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createAreaZoneTools(client: HomeAssistantClient) {
  return {
    // Area Management
    area_list: {
      name: 'ha_area_list',
      description: 'List all areas',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const template = `
{%- set ns = namespace(result=[]) -%}
{%- for area_id in areas() -%}
  {%- set ns.result = ns.result + [{
    'area_id': area_id,
    'name': area_name(area_id),
    'entity_count': area_entities(area_id) | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
        const areas = await client.renderTemplate(template);
        return Array.isArray(areas) ? areas : [];
      },
    },

    area_create: {
      name: 'ha_area_create',
      description: 'Create new area',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Area name' },
          picture: { type: 'string', description: 'Picture URL' },
        },
        required: ['name'],
      },
      handler: async ({ name, picture }: { name: string; picture?: string }) => {
        const data: any = { name };
        if (picture) data.picture = picture;

        const result = await client.post('/config/area_registry/create', data);
        return { success: true, ...result };
      },
    },

    area_update: {
      name: 'ha_area_update',
      description: 'Update area configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          area_id: { type: 'string', description: 'Area ID' },
          name: { type: 'string', description: 'New name' },
          picture: { type: 'string', description: 'Picture URL' },
        },
        required: ['area_id'],
      },
      handler: async ({ area_id, name, picture }: { area_id: string; name?: string; picture?: string }) => {
        const data: any = { area_id };
        if (name) data.name = name;
        if (picture) data.picture = picture;

        await client.post('/config/area_registry/update', data);
        return { success: true, area_id };
      },
    },

    area_delete: {
      name: 'ha_area_delete',
      description: 'Delete area',
      inputSchema: {
        type: 'object' as const,
        properties: {
          area_id: { type: 'string', description: 'Area ID' },
        },
        required: ['area_id'],
      },
      handler: async ({ area_id }: { area_id: string }) => {
        await client.post('/config/area_registry/delete', { area_id });
        return { success: true, area_id };
      },
    },

    area_assign_entity: {
      name: 'ha_area_assign_entity',
      description: 'Assign entity to area',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Entity ID' },
          area_id: { type: 'string', description: 'Area ID (null to unassign)' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id, area_id }: { entity_id: string; area_id?: string | null }) => {
        await client.post('/config/entity_registry/update', {
          entity_id,
          area_id: area_id || null,
        });
        return { success: true, entity_id, area_id };
      },
    },

    // Zone Management
    zone_list: {
      name: 'ha_zone_list',
      description: 'List all zones',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const states = await client.get<any[]>('/states');
        return states
          .filter((state: any) => state.entity_id.startsWith('zone.'))
          .map((state: any) => ({
            entity_id: state.entity_id,
            name: state.attributes.friendly_name || state.entity_id,
            latitude: state.attributes.latitude,
            longitude: state.attributes.longitude,
            radius: state.attributes.radius,
            passive: state.attributes.passive,
            icon: state.attributes.icon,
          }));
      },
    },

    zone_create: {
      name: 'ha_zone_create',
      description: 'Create new zone',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Zone name' },
          latitude: { type: 'number', description: 'Latitude' },
          longitude: { type: 'number', description: 'Longitude' },
          radius: { type: 'number', description: 'Radius in meters' },
          passive: { type: 'boolean', description: 'Passive zone (no enter/leave events)' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name', 'latitude', 'longitude', 'radius'],
      },
      handler: async ({
        name,
        latitude,
        longitude,
        radius,
        passive,
        icon,
      }: {
        name: string;
        latitude: number;
        longitude: number;
        radius: number;
        passive?: boolean;
        icon?: string;
      }) => {
        const zone_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name, latitude, longitude, radius };
        if (passive !== undefined) config.passive = passive;
        if (icon) config.icon = icon;

        await client.post(`/config/zone/config/${zone_id}`, config);
        return { success: true, entity_id: `zone.${zone_id}` };
      },
    },

    zone_update: {
      name: 'ha_zone_update',
      description: 'Update zone configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          zone_id: { type: 'string', description: 'Zone ID (without zone. prefix)' },
          name: { type: 'string', description: 'Zone name' },
          latitude: { type: 'number', description: 'Latitude' },
          longitude: { type: 'number', description: 'Longitude' },
          radius: { type: 'number', description: 'Radius in meters' },
          passive: { type: 'boolean', description: 'Passive zone' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['zone_id'],
      },
      handler: async ({
        zone_id,
        name,
        latitude,
        longitude,
        radius,
        passive,
        icon,
      }: {
        zone_id: string;
        name?: string;
        latitude?: number;
        longitude?: number;
        radius?: number;
        passive?: boolean;
        icon?: string;
      }) => {
        const config: any = {};
        if (name) config.name = name;
        if (latitude !== undefined) config.latitude = latitude;
        if (longitude !== undefined) config.longitude = longitude;
        if (radius !== undefined) config.radius = radius;
        if (passive !== undefined) config.passive = passive;
        if (icon) config.icon = icon;

        await client.post(`/config/zone/config/${zone_id}`, config);
        return { success: true, entity_id: `zone.${zone_id}` };
      },
    },

    zone_delete: {
      name: 'ha_zone_delete',
      description: 'Delete zone',
      inputSchema: {
        type: 'object' as const,
        properties: {
          zone_id: { type: 'string', description: 'Zone ID (without zone. prefix)' },
        },
        required: ['zone_id'],
      },
      handler: async ({ zone_id }: { zone_id: string }) => {
        await client.delete(`/config/zone/config/${zone_id}`);
        return { success: true, entity_id: `zone.${zone_id}` };
      },
    },
  };
}
