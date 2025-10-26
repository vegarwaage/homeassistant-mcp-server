// ABOUTME: Device and entity registry management tools
// ABOUTME: Manage devices and entity registry entries

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createDeviceTools(client: HomeAssistantClient) {
  return {
    device_list: {
      name: 'ha_device_list',
      description: 'List all devices in device registry',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const template = `
{%- set ns = namespace(result=[]) -%}
{%- for area_id in areas() -%}
  {%- for device_id in area_devices(area_id) -%}
    {%- set device_name = device_attr(device_id, 'name') -%}
    {%- set device_entities = device_entities(device_id) | list -%}
    {%- set ns.result = ns.result + [{
      'device_id': device_id,
      'name': device_name,
      'area_id': area_id,
      'entity_ids': device_entities,
      'entity_count': device_entities | count
    }] -%}
  {%- endfor -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
        const devices = await client.renderTemplate(template);
        return Array.isArray(devices) ? devices : [];
      },
    },

    device_get: {
      name: 'ha_device_get',
      description: 'Get device details by ID',
      inputSchema: {
        type: 'object' as const,
        properties: {
          device_id: { type: 'string', description: 'Device ID' },
        },
        required: ['device_id'],
      },
      handler: async ({ device_id }: { device_id: string }) => {
        return await client.get(`/config/device_registry/device/${device_id}`);
      },
    },

    device_update: {
      name: 'ha_device_update',
      description: 'Update device configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          device_id: { type: 'string', description: 'Device ID' },
          name_by_user: { type: 'string', description: 'Custom name' },
          area_id: { type: 'string', description: 'Area ID' },
          disabled_by: { type: 'string', description: 'Disabled by (user/integration/null)' },
        },
        required: ['device_id'],
      },
      handler: async ({
        device_id,
        name_by_user,
        area_id,
        disabled_by,
      }: {
        device_id: string;
        name_by_user?: string;
        area_id?: string;
        disabled_by?: string | null;
      }) => {
        const data: any = { device_id };
        if (name_by_user !== undefined) data.name_by_user = name_by_user;
        if (area_id !== undefined) data.area_id = area_id;
        if (disabled_by !== undefined) data.disabled_by = disabled_by;

        const result = await client.post('/config/device_registry/update', data);
        return { success: true, ...result };
      },
    },

    device_enable: {
      name: 'ha_device_enable',
      description: 'Enable a device',
      inputSchema: {
        type: 'object' as const,
        properties: {
          device_id: { type: 'string', description: 'Device ID' },
        },
        required: ['device_id'],
      },
      handler: async ({ device_id }: { device_id: string }) => {
        await client.post('/config/device_registry/update', {
          device_id,
          disabled_by: null,
        });
        return { success: true, device_id };
      },
    },

    device_disable: {
      name: 'ha_device_disable',
      description: 'Disable a device',
      inputSchema: {
        type: 'object' as const,
        properties: {
          device_id: { type: 'string', description: 'Device ID' },
        },
        required: ['device_id'],
      },
      handler: async ({ device_id }: { device_id: string }) => {
        await client.post('/config/device_registry/update', {
          device_id,
          disabled_by: 'user',
        });
        return { success: true, device_id };
      },
    },

    entity_registry_list: {
      name: 'ha_entity_registry_list',
      description: 'List all entity registry entries',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const template = `
{%- set ns = namespace(result=[]) -%}
{%- for state in states -%}
  {%- set ns.result = ns.result + [{
    'entity_id': state.entity_id,
    'name': state.name,
    'state': state.state,
    'domain': state.domain,
    'object_id': state.object_id
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
        const entities = await client.renderTemplate(template);
        return Array.isArray(entities) ? entities : [];
      },
    },

    entity_registry_update: {
      name: 'ha_entity_registry_update',
      description: 'Update entity registry entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Entity ID' },
          name: { type: 'string', description: 'Custom name' },
          icon: { type: 'string', description: 'Custom icon' },
          area_id: { type: 'string', description: 'Area ID' },
          disabled_by: { type: 'string', description: 'Disabled by (user/integration/null)' },
          hidden_by: { type: 'string', description: 'Hidden by (user/integration/null)' },
        },
        required: ['entity_id'],
      },
      handler: async ({
        entity_id,
        name,
        icon,
        area_id,
        disabled_by,
        hidden_by,
      }: {
        entity_id: string;
        name?: string;
        icon?: string;
        area_id?: string;
        disabled_by?: string | null;
        hidden_by?: string | null;
      }) => {
        const data: any = { entity_id };
        if (name !== undefined) data.name = name;
        if (icon !== undefined) data.icon = icon;
        if (area_id !== undefined) data.area_id = area_id;
        if (disabled_by !== undefined) data.disabled_by = disabled_by;
        if (hidden_by !== undefined) data.hidden_by = hidden_by;

        const result = await client.post('/config/entity_registry/update', data);
        return { success: true, ...result };
      },
    },
  };
}
