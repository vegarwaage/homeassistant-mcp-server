// ABOUTME: Configuration search tools for finding entities, services, and config
// ABOUTME: Search across entity registry, services, automations, and configuration files

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createConfigurationSearchTools(client: HomeAssistantClient) {
  return {
    search_entities: {
      name: 'ha_search_entities',
      description: 'Search through entity registry with filters',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query (entity_id, name, etc.)' },
          domain: { type: 'string', description: 'Filter by domain' },
          platform: { type: 'string', description: 'Filter by platform' },
          area_id: { type: 'string', description: 'Filter by area' },
          device_id: { type: 'string', description: 'Filter by device' },
        },
      },
      handler: async ({
        query,
        domain,
        platform,
        area_id,
        device_id,
      }: {
        query?: string;
        domain?: string;
        platform?: string;
        area_id?: string;
        device_id?: string;
      } = {}) => {
        const entities = await client.get<any[]>('/api/config/entity_registry/list');

        let filtered = entities;

        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(
            (entity: any) =>
              entity.entity_id?.toLowerCase().includes(lowerQuery) ||
              entity.name?.toLowerCase().includes(lowerQuery) ||
              entity.original_name?.toLowerCase().includes(lowerQuery)
          );
        }

        if (domain) {
          filtered = filtered.filter((entity: any) => entity.entity_id?.startsWith(`${domain}.`));
        }

        if (platform) {
          filtered = filtered.filter((entity: any) => entity.platform === platform);
        }

        if (area_id) {
          filtered = filtered.filter((entity: any) => entity.area_id === area_id);
        }

        if (device_id) {
          filtered = filtered.filter((entity: any) => entity.device_id === device_id);
        }

        return filtered;
      },
    },

    search_services: {
      name: 'ha_search_services',
      description: 'Search through available services',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query (service name)' },
          domain: { type: 'string', description: 'Filter by domain' },
        },
      },
      handler: async ({ query, domain }: { query?: string; domain?: string } = {}) => {
        const services = await client.get<any>('/api/services');

        let results: any[] = [];

        for (const [serviceDomain, serviceData] of Object.entries(services)) {
          if (domain && serviceDomain !== domain) {
            continue;
          }

          const domainServices = (serviceData as any) || {};
          for (const [serviceName, serviceInfo] of Object.entries(domainServices)) {
            if (
              !query ||
              serviceName.toLowerCase().includes(query.toLowerCase()) ||
              serviceDomain.toLowerCase().includes(query.toLowerCase())
            ) {
              results.push({
                domain: serviceDomain,
                service: serviceName,
                ...(serviceInfo as any),
              });
            }
          }
        }

        return results;
      },
    },

    search_automations: {
      name: 'ha_search_automations',
      description: 'Search through automations by name, trigger, or action',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query (name, trigger, action)' },
          enabled_only: { type: 'boolean', description: 'Only show enabled automations' },
        },
      },
      handler: async ({ query, enabled_only }: { query?: string; enabled_only?: boolean } = {}) => {
        const states = await client.get<any[]>('/api/states');
        let automations = states.filter((state: any) => state.entity_id.startsWith('automation.'));

        if (enabled_only) {
          automations = automations.filter((auto: any) => auto.state !== 'unavailable');
        }

        if (query) {
          const lowerQuery = query.toLowerCase();
          automations = automations.filter((auto: any) => {
            const name = auto.attributes?.friendly_name?.toLowerCase() || '';
            const entityId = auto.entity_id.toLowerCase();

            return name.includes(lowerQuery) || entityId.includes(lowerQuery);
          });
        }

        return automations.map((auto: any) => ({
          entity_id: auto.entity_id,
          name: auto.attributes?.friendly_name || auto.entity_id,
          state: auto.state,
          last_triggered: auto.attributes?.last_triggered,
          mode: auto.attributes?.mode,
        }));
      },
    },

    search_config: {
      name: 'ha_search_config',
      description: 'Search through configuration for specific settings',
      inputSchema: {
        type: 'object' as const,
        properties: {
          component: {
            type: 'string',
            description: 'Component to check configuration for',
          },
        },
      },
      handler: async ({ component }: { component?: string } = {}) => {
        if (component) {
          return await client.get(`/api/config/core/check_config/${component}`);
        }
        return await client.get('/api/config');
      },
    },
  };
}
