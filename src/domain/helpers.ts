// ABOUTME: Input helper management tools for Home Assistant
// ABOUTME: Create and manage boolean, number, text, select, and datetime helpers

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createHelperTools(client: HomeAssistantClient) {
  return {
    list: {
      name: 'ha_helper_list',
      description: 'List all input helpers (boolean, number, text, select, datetime)',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async (_args?: {}) => {
        const states = await client.get<any[]>('/states');
        return states
          .filter((state: any) => state.entity_id.startsWith('input_'))
          .map((state: any) => ({
            entity_id: state.entity_id,
            name: state.attributes.friendly_name || state.entity_id,
            state: state.state,
            ...state.attributes,
          }));
      },
    },

    create_boolean: {
      name: 'ha_helper_create_boolean',
      description: 'Create input_boolean helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Helper name' },
          initial: { type: 'boolean', description: 'Initial value' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name'],
      },
      handler: async ({ name, initial, icon }: { name: string; initial?: boolean; icon?: string }) => {
        const helper_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name };
        if (initial !== undefined) config.initial = initial;
        if (icon) config.icon = icon;

        await client.post(`/config/input_boolean/config/${helper_id}`, config);
        return { success: true, entity_id: `input_boolean.${helper_id}` };
      },
    },

    create_number: {
      name: 'ha_helper_create_number',
      description: 'Create input_number helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Helper name' },
          min: { type: 'number', description: 'Minimum value' },
          max: { type: 'number', description: 'Maximum value' },
          step: { type: 'number', description: 'Step size' },
          initial: { type: 'number', description: 'Initial value' },
          mode: { type: 'string', enum: ['box', 'slider'], description: 'Display mode' },
          unit_of_measurement: { type: 'string', description: 'Unit' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name', 'min', 'max'],
      },
      handler: async ({
        name,
        min,
        max,
        step,
        initial,
        mode,
        unit_of_measurement,
        icon,
      }: {
        name: string;
        min: number;
        max: number;
        step?: number;
        initial?: number;
        mode?: string;
        unit_of_measurement?: string;
        icon?: string;
      }) => {
        const helper_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name, min, max };
        if (step !== undefined) config.step = step;
        if (initial !== undefined) config.initial = initial;
        if (mode) config.mode = mode;
        if (unit_of_measurement) config.unit_of_measurement = unit_of_measurement;
        if (icon) config.icon = icon;

        await client.post(`/config/input_number/config/${helper_id}`, config);
        return { success: true, entity_id: `input_number.${helper_id}` };
      },
    },

    create_text: {
      name: 'ha_helper_create_text',
      description: 'Create input_text helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Helper name' },
          initial: { type: 'string', description: 'Initial value' },
          min: { type: 'number', description: 'Min length' },
          max: { type: 'number', description: 'Max length' },
          mode: { type: 'string', enum: ['text', 'password'], description: 'Display mode' },
          pattern: { type: 'string', description: 'Regex pattern' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name'],
      },
      handler: async ({
        name,
        initial,
        min,
        max,
        mode,
        pattern,
        icon,
      }: {
        name: string;
        initial?: string;
        min?: number;
        max?: number;
        mode?: string;
        pattern?: string;
        icon?: string;
      }) => {
        const helper_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name };
        if (initial) config.initial = initial;
        if (min !== undefined) config.min = min;
        if (max !== undefined) config.max = max;
        if (mode) config.mode = mode;
        if (pattern) config.pattern = pattern;
        if (icon) config.icon = icon;

        await client.post(`/config/input_text/config/${helper_id}`, config);
        return { success: true, entity_id: `input_text.${helper_id}` };
      },
    },

    create_select: {
      name: 'ha_helper_create_select',
      description: 'Create input_select helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Helper name' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of options',
          },
          initial: { type: 'string', description: 'Initial value' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name', 'options'],
      },
      handler: async ({
        name,
        options,
        initial,
        icon,
      }: {
        name: string;
        options: string[];
        initial?: string;
        icon?: string;
      }) => {
        const helper_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name, options };
        if (initial) config.initial = initial;
        if (icon) config.icon = icon;

        await client.post(`/config/input_select/config/${helper_id}`, config);
        return { success: true, entity_id: `input_select.${helper_id}` };
      },
    },

    create_datetime: {
      name: 'ha_helper_create_datetime',
      description: 'Create input_datetime helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Helper name' },
          has_date: { type: 'boolean', description: 'Include date' },
          has_time: { type: 'boolean', description: 'Include time' },
          initial: { type: 'string', description: 'Initial value (ISO format)' },
          icon: { type: 'string', description: 'Icon' },
        },
        required: ['name'],
      },
      handler: async ({
        name,
        has_date,
        has_time,
        initial,
        icon,
      }: {
        name: string;
        has_date?: boolean;
        has_time?: boolean;
        initial?: string;
        icon?: string;
      }) => {
        const helper_id = name.toLowerCase().replace(/\s+/g, '_');
        const config: any = { name };
        if (has_date !== undefined) config.has_date = has_date;
        if (has_time !== undefined) config.has_time = has_time;
        if (initial) config.initial = initial;
        if (icon) config.icon = icon;

        await client.post(`/config/input_datetime/config/${helper_id}`, config);
        return { success: true, entity_id: `input_datetime.${helper_id}` };
      },
    },

    update: {
      name: 'ha_helper_update',
      description: 'Update input helper configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Helper entity ID' },
          config: {
            type: 'object',
            description: 'Configuration to update',
            additionalProperties: true,
          },
        },
        required: ['entity_id', 'config'],
      },
      handler: async ({ entity_id, config }: { entity_id: string; config: Record<string, any> }) => {
        const [domain, helper_id] = entity_id.split('.');
        await client.post(`/config/${domain}/config/${helper_id}`, config);
        return { success: true, entity_id };
      },
    },

    delete: {
      name: 'ha_helper_delete',
      description: 'Delete input helper',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Helper entity ID' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        const [domain, helper_id] = entity_id.split('.');
        await client.delete(`/config/${domain}/config/${helper_id}`);
        return { success: true, entity_id };
      },
    },
  };
}
