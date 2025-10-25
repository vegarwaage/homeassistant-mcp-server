// ABOUTME: MCP tools for querying Home Assistant organizational structures
// ABOUTME: Provides ha_list_areas, ha_list_labels, ha_list_devices using template API

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

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
          // Get list of all area IDs
          const areaIds = await client.renderTemplate('{{ areas() | list }}');

          if (!Array.isArray(areaIds) || areaIds.length === 0) {
            return {
              count: 0,
              areas: []
            };
          }

          // For each area, get name and entity count
          const areas = await Promise.all(
            areaIds.map(async (areaId: string) => {
              const name = await client.renderTemplate(`{{ area_name('${areaId}') }}`);
              const entities = await client.renderTemplate(`{{ area_entities('${areaId}') | list }}`);

              return {
                area_id: areaId,
                name: name,
                entity_count: Array.isArray(entities) ? entities.length : 0
              };
            })
          );

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
          // Get list of all label IDs
          const labelIds = await client.renderTemplate('{{ labels() | list }}');

          if (!Array.isArray(labelIds) || labelIds.length === 0) {
            return {
              count: 0,
              labels: []
            };
          }

          // For each label, get name and entity count
          const labels = await Promise.all(
            labelIds.map(async (labelId: string) => {
              const name = await client.renderTemplate(`{{ label_name('${labelId}') }}`);
              const entities = await client.renderTemplate(`{{ label_entities('${labelId}') | list }}`);

              return {
                label_id: labelId,
                name: name,
                entity_count: Array.isArray(entities) ? entities.length : 0
              };
            })
          );

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
      description: 'List devices in Home Assistant. Filter by area or search by name/manufacturer.',
      inputSchema: {
        type: 'object',
        properties: {
          area_id: { type: 'string', description: 'Filter devices by area ID' },
          search: { type: 'string', description: 'Search in device name or manufacturer' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { area_id, search } = args;

        try {
          // Get all entities to extract unique device IDs
          const states = await client.getStates();

          // Extract unique device IDs from entity attributes
          const deviceMap = new Map<string, any>();

          for (const state of states) {
            const deviceId = state.attributes.device_id;
            if (deviceId && !deviceMap.has(deviceId)) {
              // Store device info
              deviceMap.set(deviceId, {
                device_id: deviceId,
                name: state.attributes.friendly_name || state.entity_id,
                area_id: state.attributes.area_id,
                entity_ids: [state.entity_id]
              });
            } else if (deviceId) {
              // Add entity to existing device
              deviceMap.get(deviceId)!.entity_ids.push(state.entity_id);
            }
          }

          let devices = Array.from(deviceMap.values());

          // Filter by area if specified
          if (area_id) {
            devices = devices.filter(device => device.area_id === area_id);
          }

          // Filter by search term if specified
          if (search) {
            const searchLower = search.toLowerCase();
            devices = devices.filter(device =>
              device.name.toLowerCase().includes(searchLower)
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
