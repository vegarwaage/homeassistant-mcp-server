// ABOUTME: MCP tools for querying Home Assistant organizational structures
// ABOUTME: Provides ha_list_areas, ha_list_labels, ha_list_devices using template API

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

/**
 * Sanitize a string ID to prevent template injection.
 * Only allows alphanumeric characters, underscores, and hyphens.
 */
function sanitizeId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('ID must be a string');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid ID format: ${id}. Only alphanumeric, underscore, and hyphen allowed.`);
  }
  return id;
}

/**
 * Sanitize a search string to prevent template injection.
 * Escapes single quotes and backslashes.
 */
function sanitizeSearchString(search: string): string {
  if (typeof search !== 'string') {
    throw new Error('Search must be a string');
  }
  return search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function registerOrganizationTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_list_areas',
      description: 'List all areas/rooms defined in Home Assistant with entity counts',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        try {
          // Get all areas in a single template call using Jinja2 loop
          const template = `
{%- set result = [] -%}
{%- for area_id in areas() -%}
  {%- set _ = result.append({
    'area_id': area_id,
    'name': area_name(area_id),
    'entity_count': area_entities(area_id) | count
  }) -%}
{%- endfor -%}
{{ result | tojson }}
`;

          const areas = await client.renderTemplate(template);

          if (!Array.isArray(areas)) {
            return {
              count: 0,
              areas: []
            };
          }

          return {
            count: areas.length,
            areas: areas
          };
        } catch (error: any) {
          throw new Error(`Failed to list areas: ${error.message}`);
        }
      }
    },
    {
      name: 'ha_list_labels',
      description: 'List all labels/tags defined in Home Assistant with entity counts',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        try {
          // Get all labels in a single template call using Jinja2 loop
          const template = `
{%- set result = [] -%}
{%- for label_id in labels() -%}
  {%- set _ = result.append({
    'label_id': label_id,
    'name': label_name(label_id),
    'entity_count': label_entities(label_id) | count
  }) -%}
{%- endfor -%}
{{ result | tojson }}
`;

          const labels = await client.renderTemplate(template);

          if (!Array.isArray(labels)) {
            return {
              count: 0,
              labels: []
            };
          }

          return {
            count: labels.length,
            labels: labels
          };
        } catch (error: any) {
          throw new Error(`Failed to list labels: ${error.message}`);
        }
      }
    },
    {
      name: 'ha_list_devices',
      description: 'List devices in Home Assistant. Filter by area or search by name.',
      inputSchema: {
        type: 'object',
        properties: {
          area_id: { type: 'string', description: 'Filter devices by area ID' },
          search: { type: 'string', description: 'Search in device name' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { area_id, search } = args;

        try {
          // Validate inputs if provided
          const sanitizedAreaId = area_id ? sanitizeId(area_id) : null;
          const sanitizedSearch = search ? sanitizeSearchString(search) : null;

          // Build template to get devices using Home Assistant template functions
          let template: string;

          if (sanitizedAreaId) {
            // Get devices for a specific area
            template = `
{%- set result = [] -%}
{%- for device_id in area_devices('${sanitizedAreaId}') -%}
  {%- set device_name = device_attr(device_id, 'name') -%}
  {%- set device_entities = device_entities(device_id) | list -%}
  {%- set _ = result.append({
    'device_id': device_id,
    'name': device_name,
    'area_id': '${sanitizedAreaId}',
    'entity_ids': device_entities,
    'entity_count': device_entities | count
  }) -%}
{%- endfor -%}
{{ result | tojson }}
`;
          } else {
            // Get all devices from all areas
            template = `
{%- set result = [] -%}
{%- for area_id in areas() -%}
  {%- for device_id in area_devices(area_id) -%}
    {%- set device_name = device_attr(device_id, 'name') -%}
    {%- set device_entities = device_entities(device_id) | list -%}
    {%- set _ = result.append({
      'device_id': device_id,
      'name': device_name,
      'area_id': area_id,
      'entity_ids': device_entities,
      'entity_count': device_entities | count
    }) -%}
  {%- endfor -%}
{%- endfor -%}
{{ result | tojson }}
`;
          }

          let devices = await client.renderTemplate(template);

          if (!Array.isArray(devices)) {
            devices = [];
          }

          // Apply search filter if specified
          if (sanitizedSearch) {
            const searchLower = sanitizedSearch.toLowerCase();
            devices = devices.filter((device: any) =>
              device.name && device.name.toLowerCase().includes(searchLower)
            );
          }

          return {
            count: devices.length,
            devices: devices
          };
        } catch (error: any) {
          throw new Error(`Failed to list devices: ${error.message}`);
        }
      }
    }
  ];
}
