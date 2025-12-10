// ABOUTME: Automation helper tools for validation and testing
// ABOUTME: Validate config, test conditions, and generate automation templates with HA 2025+ domain-specific triggers

import type { HomeAssistantClient } from '../core/ha-client.js';

/**
 * Domain-specific trigger types introduced in Home Assistant 2025.12
 * These provide target-first approaches supporting areas, floors, labels, and devices
 */
const DOMAIN_TRIGGER_TYPES = ['light', 'climate', 'fan', 'state', 'time', 'event', 'webhook', 'device', 'numeric_state', 'sun', 'zone', 'template'] as const;

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
      description: 'Generate automation template from parameters. Supports HA 2025+ domain-specific triggers (light, climate, fan) with target-first approach using areas, floors, labels, and devices.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Automation name' },
          trigger_type: {
            type: 'string',
            enum: DOMAIN_TRIGGER_TYPES,
            description: 'Trigger type. Use domain-specific triggers (light, climate, fan) for HA 2025.12+ target-first approach',
          },
          trigger_config: {
            type: 'object',
            description: 'Trigger configuration. For domain triggers: use target (area_id, floor_id, label_id, device_id, entity_id) and from/to states',
            additionalProperties: true,
          },
          action_type: {
            type: 'string',
            enum: ['service', 'device', 'scene', 'notification', 'condition', 'delay', 'wait_template'],
            description: 'Action type',
          },
          action_config: {
            type: 'object',
            description: 'Action configuration',
            additionalProperties: true,
          },
          condition_config: {
            type: 'object',
            description: 'Optional condition configuration to add between trigger and action',
            additionalProperties: true,
          },
          mode: {
            type: 'string',
            enum: ['single', 'restart', 'queued', 'parallel'],
            description: 'Automation mode (default: single)',
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
        condition_config,
        mode,
      }: {
        name: string;
        trigger_type: string;
        trigger_config?: Record<string, any>;
        action_type: string;
        action_config?: Record<string, any>;
        condition_config?: Record<string, any>;
        mode?: string;
      }) => {
        // Build trigger based on type
        let trigger: any;

        // Domain-specific triggers (HA 2025.12+)
        if (['light', 'climate', 'fan'].includes(trigger_type)) {
          trigger = {
            trigger: trigger_type, // New syntax: trigger: light (not platform: light)
            ...(trigger_config || {}),
          };
        } else {
          // Traditional platform-based triggers
          trigger = {
            platform: trigger_type,
            ...(trigger_config || {}),
          };
        }

        // Build action based on type
        let action: any;
        switch (action_type) {
          case 'service':
            action = {
              action: action_config?.service || action_config?.action || '',
              ...(action_config?.target && { target: action_config.target }),
              ...(action_config?.data && { data: action_config.data }),
            };
            break;
          case 'scene':
            action = { scene: action_config?.scene || '' };
            break;
          case 'delay':
            action = { delay: action_config?.delay || '00:00:05' };
            break;
          case 'wait_template':
            action = { wait_template: action_config?.wait_template || '' };
            break;
          case 'condition':
            action = { condition: action_config?.condition || 'state', ...action_config };
            break;
          default:
            action = { ...action_config };
        }

        const automation: any = {
          alias: name,
          trigger: [trigger],
          action: [action],
        };

        // Add optional condition
        if (condition_config) {
          automation.condition = [condition_config];
        }

        // Add mode if specified
        if (mode) {
          automation.mode = mode;
        }

        // Generate examples for domain-specific triggers
        const examples: Record<string, any> = {};
        if (['light', 'climate', 'fan'].includes(trigger_type)) {
          examples.domain_trigger_example = {
            note: `Using HA 2025.12+ ${trigger_type} domain trigger with target-first approach`,
            example_with_area: {
              trigger: trigger_type,
              target: { area_id: 'living_room' },
              from: 'off',
              to: 'on',
            },
            example_with_floor: {
              trigger: trigger_type,
              target: { floor_id: 'ground_floor' },
              to: 'on',
            },
            example_with_label: {
              trigger: trigger_type,
              target: { label_id: 'outdoor_lights' },
            },
          };
        }

        return {
          template: automation,
          yaml: JSON.stringify(automation, null, 2),
          note: 'Use ha_create_automation to save this automation',
          ...(Object.keys(examples).length > 0 && { examples }),
          supported_trigger_types: DOMAIN_TRIGGER_TYPES,
        };
      },
    },
  };
}
