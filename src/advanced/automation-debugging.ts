// ABOUTME: Automation debugging tools for troubleshooting and tracing
// ABOUTME: Trace execution, get diagnostics, and test automation triggers

import type { HomeAssistantClient } from '../core/ha-client.js';

export function createAutomationDebuggingTools(client: HomeAssistantClient) {
  return {
    get_trace: {
      name: 'ha_automation_get_trace',
      description: 'Get automation execution trace for debugging',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: {
            type: 'string',
            description: 'Automation entity ID (e.g., "automation.morning_routine")',
          },
          run_id: {
            type: 'string',
            description: 'Specific run ID (optional, gets latest if omitted)',
          },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id, run_id }: { entity_id: string; run_id?: string }) => {
        const automationId = entity_id.replace('automation.', '');

        if (run_id) {
          return await client.get(`/api/config/automation/trace/${automationId}/${run_id}`);
        }

        const traces = await client.get<any>(`/api/config/automation/trace/${automationId}`);
        if (traces && traces.length > 0) {
          return traces[0];
        }

        return { message: 'No trace found for this automation' };
      },
    },

    list_traces: {
      name: 'ha_automation_list_traces',
      description: 'List recent automation execution traces',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: {
            type: 'string',
            description: 'Automation entity ID (e.g., "automation.morning_routine")',
          },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        const automationId = entity_id.replace('automation.', '');
        return await client.get(`/api/config/automation/trace/${automationId}`);
      },
    },

    get_diagnostics: {
      name: 'ha_automation_get_diagnostics',
      description: 'Get automation diagnostics and debug information',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: {
            type: 'string',
            description: 'Automation entity ID (e.g., "automation.morning_routine")',
          },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        const state = await client.get<any>(`/api/states/${entity_id}`);

        if (!state) {
          return { error: 'Automation not found' };
        }

        const automationId = entity_id.replace('automation.', '');
        let traces: any[] = [];
        try {
          traces = await client.get(`/api/config/automation/trace/${automationId}`);
        } catch (error) {
          // Traces might not be available
        }

        return {
          entity_id,
          state: state.state,
          attributes: state.attributes,
          last_triggered: state.attributes?.last_triggered,
          current: state.attributes?.current,
          mode: state.attributes?.mode,
          max_exceeded: state.attributes?.max_exceeded,
          recent_traces: traces?.length || 0,
          diagnostics: {
            is_enabled: state.state !== 'unavailable',
            has_recent_activity: !!state.attributes?.last_triggered,
            execution_mode: state.attributes?.mode || 'single',
            max_runs_exceeded: state.attributes?.max_exceeded === 'warning',
          },
        };
      },
    },
  };
}
