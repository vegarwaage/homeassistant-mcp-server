// ABOUTME: Configuration search tools for finding entities, services, and config
// ABOUTME: Search across entity registry, services, automations, and configuration files

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createConfigurationSearchTools(client: HomeAssistantClient) {
  return {
    // NOTE: ha_search_entities is defined in tools/search.ts to avoid duplication
    // The legacy version has better limit handling and is easier to maintain

    search_services: {
      name: 'ha_search_services',
      description: 'Search through available services. Returns service names and descriptions. Use limit parameter to control response size.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query (service name)' },
          domain: { type: 'string', description: 'Filter by domain' },
          limit: { type: 'number', description: 'Maximum results to return (default: 50, max: 200)' },
          minimal: { type: 'boolean', description: 'Return only domain, service, description (default: false)' },
        },
      },
      handler: async ({ query, domain, limit = 50, minimal = false }: { query?: string; domain?: string; limit?: number; minimal?: boolean } = {}) => {
        const services = await client.get<any>('/services');

        let results: any[] = [];
        const actualLimit = Math.min(Math.max(1, limit), 200);

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
              if (minimal) {
                results.push({
                  domain: serviceDomain,
                  service: serviceName,
                  description: (serviceInfo as any)?.description || null,
                });
              } else {
                results.push({
                  domain: serviceDomain,
                  service: serviceName,
                  ...(serviceInfo as any),
                });
              }
            }

            // Early exit if we've hit the limit
            if (results.length >= actualLimit) break;
          }
          if (results.length >= actualLimit) break;
        }

        return {
          count: results.length,
          limit: actualLimit,
          services: results.slice(0, actualLimit),
        };
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
        const states = await client.get<any[]>('/states');
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
      description: 'Get Home Assistant configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          component: {
            type: 'string',
            description: 'Component to check (note: component-specific checks not available via API)',
          },
        },
      },
      handler: async ({ component }: { component?: string } = {}) => {
        const config = await client.get('/config');
        if (component) {
          return {
            component,
            config,
            note: 'Component-specific configuration checks are not available via REST API. Showing general config.'
          };
        }
        return config;
      },
    },
  };
}
