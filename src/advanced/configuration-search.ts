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
          area: { type: 'string', description: 'Filter by area name' },
          device_class: { type: 'string', description: 'Filter by device_class' },
          state: { type: 'string', description: 'Filter by current state' },
          label: { type: 'string', description: 'Filter by label name' },
          limit: { type: 'number', description: 'Maximum number of results (default: 20)' },
        },
      },
      handler: async ({
        query,
        domain,
        area,
        device_class,
        state,
        label,
        limit = 20,
      }: {
        query?: string;
        domain?: string;
        area?: string;
        device_class?: string;
        state?: string;
        label?: string;
        limit?: number;
      } = {}) => {
        // Build filter conditions
        const filters: string[] = [];

        if (query) {
          const safeQuery = query.toLowerCase().replace(/'/g, "\\'");
          filters.push(`('${safeQuery}' in state_obj.entity_id.lower() or '${safeQuery}' in state_obj.name.lower())`);
        }

        if (domain) {
          filters.push(`state_obj.domain == '${domain}'`);
        }

        if (area) {
          const safeArea = area.replace(/'/g, "\\'");
          filters.push(`area_name(area_id(state_obj.entity_id)) == '${safeArea}'`);
        }

        if (device_class) {
          filters.push(`state_obj.attributes.device_class == '${device_class}'`);
        }

        if (state) {
          filters.push(`state_obj.state == '${state}'`);
        }

        if (label) {
          const safeLabel = label.replace(/'/g, "\\'");
          filters.push(`'${safeLabel}' in state_attr(state_obj.entity_id, 'labels') | default([])`);
        }

        const filterCondition = filters.length > 0 ? filters.join(' and ') : 'true';

        const template = `
{%- set ns = namespace(result=[]) -%}
{%- for state_obj in states -%}
  {%- if ${filterCondition} -%}
    {%- set ns.result = ns.result + [{
      'entity_id': state_obj.entity_id,
      'name': state_obj.name,
      'state': state_obj.state,
      'domain': state_obj.domain,
      'device_class': state_obj.attributes.device_class | default(none),
      'area': area_name(area_id(state_obj.entity_id)) | default(none),
      'last_changed': state_obj.last_changed | string,
      'last_updated': state_obj.last_updated | string
    }] -%}
  {%- endif -%}
  {%- if ns.result | length >= ${limit} -%}
    {%- break -%}
  {%- endif -%}
{%- endfor -%}
{{ {'count': ns.result | length, 'entities': ns.result} | tojson }}
`;
        return await client.renderTemplate(template);
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
        const services = await client.get<any>('/services');

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
