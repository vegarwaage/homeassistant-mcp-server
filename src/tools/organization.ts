// ABOUTME: MCP tools for querying Home Assistant organizational structures
// ABOUTME: Provides ha_list_areas, ha_list_labels, ha_list_devices using template API

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';
import { sanitizeId, sanitizeSearchString } from '../validation.js';

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
          // Use namespace to build list (append is unsafe in HA sandbox)
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
          // Use namespace to build list (append is unsafe in HA sandbox)
          const template = `
{%- set ns = namespace(result=[]) -%}
{%- for label_id in labels() -%}
  {%- set ns.result = ns.result + [{
    'label_id': label_id,
    'name': label_name(label_id),
    'entity_count': label_entities(label_id) | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
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
      description: 'List devices in Home Assistant. Filter by area or search by name. Use include_entities=false to reduce response size.',
      inputSchema: {
        type: 'object',
        properties: {
          area_id: { type: 'string', description: 'Filter devices by area ID' },
          search: { type: 'string', description: 'Search in device name' },
          limit: { type: 'number', description: 'Maximum devices to return (default: 50, max: 200)' },
          include_entities: { type: 'boolean', description: 'Include entity_ids array for each device (default: false to reduce context usage)' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { area_id, search, limit = 50, include_entities = false } = args;

        try {
          // Validate inputs if provided
          const sanitizedAreaId = area_id ? sanitizeId(area_id) : null;
          const sanitizedSearch = search ? sanitizeSearchString(search) : null;
          const actualLimit = Math.min(Math.max(1, limit), 200);

          // Build template to get devices using Home Assistant template functions
          let template: string;

          if (sanitizedAreaId) {
            // Get devices for a specific area
            template = include_entities ? `
{%- set ns = namespace(result=[]) -%}
{%- for device_id in area_devices('${sanitizedAreaId}') -%}
  {%- set device_name = device_attr(device_id, 'name') -%}
  {%- set device_entities = device_entities(device_id) | list -%}
  {%- set ns.result = ns.result + [{
    'device_id': device_id,
    'name': device_name,
    'area_id': '${sanitizedAreaId}',
    'entity_ids': device_entities,
    'entity_count': device_entities | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
` : `
{%- set ns = namespace(result=[]) -%}
{%- for device_id in area_devices('${sanitizedAreaId}') -%}
  {%- set device_name = device_attr(device_id, 'name') -%}
  {%- set ns.result = ns.result + [{
    'device_id': device_id,
    'name': device_name,
    'area_id': '${sanitizedAreaId}',
    'entity_count': device_entities(device_id) | count
  }] -%}
{%- endfor -%}
{{ ns.result | tojson }}
`;
          } else {
            // Get all devices from all areas
            template = include_entities ? `
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
` : `
{%- set ns = namespace(result=[]) -%}
{%- for area_id in areas() -%}
  {%- for device_id in area_devices(area_id) -%}
    {%- set device_name = device_attr(device_id, 'name') -%}
    {%- set ns.result = ns.result + [{
      'device_id': device_id,
      'name': device_name,
      'area_id': area_id,
      'entity_count': device_entities(device_id) | count
    }] -%}
  {%- endfor -%}
{%- endfor -%}
{{ ns.result | tojson }}
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

          const totalCount = devices.length;
          devices = devices.slice(0, actualLimit);

          return {
            count: devices.length,
            total_available: totalCount,
            limit: actualLimit,
            has_more: totalCount > actualLimit,
            devices: devices
          };
        } catch (error: any) {
          throw new Error(`Failed to list devices: ${error.message}`);
        }
      }
    }
  ];
}
