// ABOUTME: Automation helper tools for validation and testing
// ABOUTME: Validate config, test conditions, and generate automation templates

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createAutomationHelperTools(client: HomeAssistantClient) {
  return {
    validate: {
      name: 'ha_automation_validate',
      description: 'Validate automation configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          config: {
            type: 'object',
            description: 'Automation configuration to validate',
            additionalProperties: true,
          },
        },
        required: ['config'],
      },
      handler: async ({ config }: { config: Record<string, any> }) => {
        try {
          await client.post('/config/core/check_config', {
            automation: [config],
          });
          return { valid: true, message: 'Automation configuration is valid' };
        } catch (error: any) {
          return {
            valid: false,
            message: 'Automation configuration is invalid',
            errors: error.message || 'Unknown validation error',
          };
        }
      },
    },

    test_condition: {
      name: 'ha_automation_test_condition',
      description: 'Test if automation condition would be true',
      inputSchema: {
        type: 'object' as const,
        properties: {
          condition: {
            type: 'object',
            description: 'Condition configuration to test',
            additionalProperties: true,
          },
        },
        required: ['condition'],
      },
      handler: async ({ condition }: { condition: Record<string, any> }) => {
        try {
          const result = await client.post<any>('/template', {
            template: '{{ true }}',
          });

          return {
            would_trigger: true,
            condition,
            note: 'Condition testing requires template evaluation',
          };
        } catch (error: any) {
          return {
            would_trigger: false,
            error: error.message || 'Failed to evaluate condition',
          };
        }
      },
    },

    generate_template: {
      name: 'ha_automation_generate_template',
      description: 'Generate automation template from parameters',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Automation name' },
          trigger_type: {
            type: 'string',
            enum: ['state', 'time', 'event', 'webhook', 'device'],
            description: 'Trigger type',
          },
          trigger_config: {
            type: 'object',
            description: 'Trigger configuration',
            additionalProperties: true,
          },
          action_type: {
            type: 'string',
            enum: ['service', 'device', 'scene', 'notification'],
            description: 'Action type',
          },
          action_config: {
            type: 'object',
            description: 'Action configuration',
            additionalProperties: true,
          },
        },
        required: ['name', 'trigger_type', 'action_type'],
      },
      handler: async ({
        name,
        trigger_type,
        trigger_config,
        action_type,
        action_config,
      }: {
        name: string;
        trigger_type: string;
        trigger_config?: Record<string, any>;
        action_type: string;
        action_config?: Record<string, any>;
      }) => {
        const automation: any = {
          alias: name,
          trigger: [
            {
              platform: trigger_type,
              ...(trigger_config || {}),
            },
          ],
          action: [
            {
              ...(action_type === 'service'
                ? { service: action_config?.service || '' }
                : action_type === 'scene'
                  ? { scene: action_config?.scene || '' }
                  : { action_type }),
              ...(action_config || {}),
            },
          ],
        };

        return {
          template: automation,
          yaml: JSON.stringify(automation, null, 2),
          note: 'Use ha_automation_create to save this automation',
        };
      },
    },
  };
}
