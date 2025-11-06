// ABOUTME: MCP tools for creating, updating, and managing Home Assistant automations
// ABOUTME: Provides ha_create_automation, ha_update_automation, ha_delete_automation, ha_list_automations

import { promises as fs } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { HomeAssistantClient } from '../core/index.js';
import { HAAutomation, ToolDefinition } from '../types.js';
import { backupFile } from '../backup.js';

const AUTOMATIONS_FILE = process.env.HA_AUTOMATIONS_FILE || '/config/automations.yaml';

async function readAutomations(): Promise<HAAutomation[]> {
  try {
    const content = await fs.readFile(AUTOMATIONS_FILE, 'utf-8');
    const automations = yaml.parse(content);
    return Array.isArray(automations) ? automations : [];
  } catch {
    return [];
  }
}

async function writeAutomations(automations: HAAutomation[]): Promise<void> {
  const content = yaml.stringify(automations);
  await fs.writeFile(AUTOMATIONS_FILE, content, 'utf-8');
}

export function registerAutomationTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_create_automation',
      description: 'Create a new persistent automation that will be saved to automations.yaml file. The automation will survive Home Assistant restarts. Provide complete YAML definition with trigger, condition (optional), and action sections. Use this to create automations for turning lights on at sunset, sending notifications when sensors trigger, or any other home automation logic. The automation is automatically validated and reloaded.',
      inputSchema: {
        type: 'object',
        properties: {
          automation_yaml: { type: 'string', description: 'Complete YAML definition with trigger, action, and optional condition. Example: "alias: My Automation\ntrigger:\n  - platform: state\n    entity_id: sensor.motion\naction:\n  - service: light.turn_on\n    entity_id: light.hall"' }
        },
        required: ['automation_yaml']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { automation_yaml } = args;

        if (!automation_yaml) {
          throw new Error('automation_yaml is required');
        }

        // Parse automation YAML
        const automation = yaml.parse(automation_yaml);

        // Generate ID if not provided
        if (!automation.id) {
          automation.id = `mcp_${Date.now()}`;
        }

        // Backup existing file
        const backup = await backupFile(AUTOMATIONS_FILE);

        // Read existing automations
        const automations = await readAutomations();

        // Add new automation
        automations.push(automation);

        // Write back
        await writeAutomations(automations);

        // Validate (skip if CLI access not available)
        try {
          const validation = await client.validateConfig();
          if (!validation.valid) {
            // ROLLBACK: Restore from backup
            await fs.copyFile(backup.path, AUTOMATIONS_FILE);
            console.error(`Rolled back to backup due to validation failure`);
            throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
          }
        } catch (error: any) {
          if (error.message.includes('insufficient permissions') || error.message.includes('invalid token')) {
            console.error('WARNING: Validation skipped - CLI access not available');
            console.error('WARNING: Configuration may be invalid!');
          } else {
            throw error;
          }
        }

        // Reload
        await client.reloadConfig('automation');

        return {
          success: true,
          automation_id: automation.id,
          message: 'Automation created and loaded'
        };
      }
    },
    {
      name: 'ha_update_automation',
      description: 'Update an existing automation by ID',
      inputSchema: {
        type: 'object',
        properties: {
          automation_id: { type: 'string', description: 'ID of automation to update' },
          automation_yaml: { type: 'string', description: 'New YAML definition' }
        },
        required: ['automation_id', 'automation_yaml']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { automation_id, automation_yaml } = args;

        if (!automation_id || !automation_yaml) {
          throw new Error('automation_id and automation_yaml are required');
        }

        const updatedAutomation = yaml.parse(automation_yaml);
        updatedAutomation.id = automation_id;

        // Backup
        const backup = await backupFile(AUTOMATIONS_FILE);

        // Read, update, write
        const automations = await readAutomations();
        const index = automations.findIndex(a => a.id === automation_id);

        if (index === -1) {
          throw new Error(`Automation ${automation_id} not found`);
        }

        automations[index] = updatedAutomation;
        await writeAutomations(automations);

        // Validate (skip if CLI access not available)
        try {
          const validation = await client.validateConfig();
          if (!validation.valid) {
            // ROLLBACK: Restore from backup
            await fs.copyFile(backup.path, AUTOMATIONS_FILE);
            console.error(`Rolled back to backup due to validation failure`);
            throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
          }
        } catch (error: any) {
          if (error.message.includes('insufficient permissions') || error.message.includes('invalid token')) {
            console.error('WARNING: Validation skipped - CLI access not available');
            console.error('WARNING: Configuration may be invalid!');
          } else {
            throw error;
          }
        }

        await client.reloadConfig('automation');

        return {
          success: true,
          automation_id,
          message: 'Automation updated and reloaded'
        };
      }
    },
    {
      name: 'ha_delete_automation',
      description: 'Delete an automation by ID',
      inputSchema: {
        type: 'object',
        properties: {
          automation_id: { type: 'string', description: 'ID of automation to delete' }
        },
        required: ['automation_id']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { automation_id } = args;

        if (!automation_id) {
          throw new Error('automation_id is required');
        }

        // Backup
        await backupFile(AUTOMATIONS_FILE);

        // Read, filter, write
        const automations = await readAutomations();
        const filtered = automations.filter(a => a.id !== automation_id);

        if (filtered.length === automations.length) {
          throw new Error(`Automation ${automation_id} not found`);
        }

        await writeAutomations(filtered);
        await client.reloadConfig('automation');

        return {
          success: true,
          automation_id,
          message: 'Automation deleted and configuration reloaded'
        };
      }
    },
    {
      name: 'ha_list_automations',
      description: 'List all configured automations showing their IDs, names (aliases), descriptions, and modes. Use this to discover existing automations, find automation IDs for updates/deletes, or see what automation logic is already configured in the system.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const automations = await readAutomations();

        return {
          count: automations.length,
          automations: automations.map(a => ({
            id: a.id,
            alias: a.alias,
            description: a.description,
            mode: a.mode
          }))
        };
      }
    }
  ];
}
