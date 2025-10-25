// ABOUTME: MCP tools for managing Home Assistant blueprints
// ABOUTME: Provides ha_list_blueprints and ha_import_blueprint

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerBlueprintsTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_list_blueprints',
      description: 'List available blueprints by domain (automation or script)',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            enum: ['automation', 'script'],
            description: 'Blueprint domain to list (automation or script)'
          }
        },
        required: ['domain']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { domain } = args;

        if (domain !== 'automation' && domain !== 'script') {
          throw new Error('domain must be either "automation" or "script"');
        }

        const blueprints = await client.listBlueprints(domain);

        return {
          domain,
          blueprints,
          count: Object.keys(blueprints).length,
          timestamp: new Date().toISOString()
        };
      }
    },
    {
      name: 'ha_import_blueprint',
      description: 'Import blueprint from URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the blueprint to import (e.g., GitHub gist URL)'
          }
        },
        required: ['url']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { url } = args;

        if (!url || typeof url !== 'string') {
          throw new Error('url must be a non-empty string');
        }

        const result = await client.importBlueprint(url);

        return {
          success: true,
          url,
          result,
          timestamp: new Date().toISOString()
        };
      }
    }
  ];
}
