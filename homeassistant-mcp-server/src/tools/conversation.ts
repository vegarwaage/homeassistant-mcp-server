// ABOUTME: MCP tools for Home Assistant conversation and template rendering
// ABOUTME: Provides ha_process_conversation for natural language processing and ha_render_template for Jinja2 templates

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerConversationTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_process_conversation',
      description: 'Process natural language text with Home Assistant\'s conversation/intent API to control devices or get information',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Natural language text to process (e.g., "turn on the living room lights")'
          },
          conversation_id: {
            type: 'string',
            description: 'Optional conversation ID to maintain context across multiple requests'
          },
          agent_id: {
            type: 'string',
            description: 'Optional agent ID to use a specific conversation agent'
          },
          language: {
            type: 'string',
            description: 'Optional language code (e.g., "en", "de", "fr")'
          }
        },
        required: ['text']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { text, conversation_id, agent_id, language } = args;

        if (!text) {
          throw new Error('text is required');
        }

        const result = await client.processConversation({
          text,
          conversation_id,
          agent_id,
          language
        });

        return result;
      }
    },
    {
      name: 'ha_render_template',
      description: 'Render a Jinja2 template using Home Assistant\'s template engine to access state data and perform calculations',
      inputSchema: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            description: 'Jinja2 template string (e.g., "{{ states(\'sensor.temperature\') }}")'
          }
        },
        required: ['template']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { template } = args;

        if (!template) {
          throw new Error('template is required');
        }

        const result = await client.renderTemplate(template);

        return {
          rendered: result
        };
      }
    }
  ];
}
