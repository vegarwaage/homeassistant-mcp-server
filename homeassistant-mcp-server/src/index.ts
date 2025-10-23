// ABOUTME: MCP server entry point that initializes the server and registers all tools
// ABOUTME: Handles stdio transport and tool execution routing

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from './ha-client.js';
import { registerStateTools } from './tools/states.js';
import { registerConfigTools } from './tools/config.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerSystemTools } from './tools/system.js';

class HAMCPServer {
  private server: Server;
  private haClient: HomeAssistantClient;
  private tools: Map<string, Function>;

  constructor() {
    this.server = new Server(
      {
        name: 'homeassistant-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.haClient = new HomeAssistantClient();
    this.tools = new Map();

    this.setupHandlers();
    this.registerTools();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = Array.from(this.tools.keys()).map(name => {
        const tool = this.getToolDefinition(name);
        return tool;
      });

      return { tools: toolList };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const toolFn = this.tools.get(name);
      if (!toolFn) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await toolFn(this.haClient, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerTools() {
    // Register tool categories
    registerStateTools(this.tools);
    registerConfigTools(this.tools);
    registerAutomationTools(this.tools);
    registerSystemTools(this.tools);
  }

  private getToolDefinition(name: string) {
    const definitions: Record<string, any> = {
      'ha_get_states': {
        name: 'ha_get_states',
        description: 'Get current state of Home Assistant entities, optionally filtered by entity_id or domain',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'Specific entity ID (e.g., "light.living_room")' },
            domain: { type: 'string', description: 'Domain filter (e.g., "light", "sensor", "switch")' }
          }
        }
      },
      'ha_get_history': {
        name: 'ha_get_history',
        description: 'Query historical data for entities with optional time range',
        inputSchema: {
          type: 'object',
          properties: {
            entity_ids: { type: 'string', description: 'Comma-separated entity IDs' },
            start_time: { type: 'string', description: 'ISO 8601 start time' },
            end_time: { type: 'string', description: 'ISO 8601 end time' },
            minimal_response: { type: 'boolean', description: 'Return minimal data' }
          }
        }
      },
      'ha_call_service': {
        name: 'ha_call_service',
        description: 'Call any Home Assistant service to control devices',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Service domain (e.g., "light", "switch")', },
            service: { type: 'string', description: 'Service name (e.g., "turn_on", "turn_off")' },
            entity_id: { type: 'string', description: 'Target entity ID' },
            service_data: { type: 'string', description: 'JSON string of additional service data' }
          },
          required: ['domain', 'service']
        }
      },
      'ha_get_entity_details': {
        name: 'ha_get_entity_details',
        description: 'Get full details and attributes for a specific entity',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'Entity ID to query' }
          },
          required: ['entity_id']
        }
      },
      'ha_read_config': {
        name: 'ha_read_config',
        description: 'Read any configuration file from /config directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from /config (e.g., "automations.yaml")' }
          },
          required: ['path']
        }
      },
      'ha_write_config': {
        name: 'ha_write_config',
        description: 'Write or update configuration file (automatically backs up)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from /config' },
            content: { type: 'string', description: 'File content to write' },
            validate: { type: 'boolean', description: 'Validate config after write (default: true)' }
          },
          required: ['path', 'content']
        }
      },
      'ha_list_files': {
        name: 'ha_list_files',
        description: 'List files and directories in config directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Subdirectory to list (default: root)' },
            pattern: { type: 'string', description: 'Regex pattern to filter files' }
          }
        }
      },
      'ha_validate_config': {
        name: 'ha_validate_config',
        description: 'Validate Home Assistant configuration without applying changes',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_reload_config': {
        name: 'ha_reload_config',
        description: 'Reload configuration for automations, scripts, or core',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['automation', 'script', 'core'], description: 'Config type to reload' }
          }
        }
      },
      'ha_list_backups': {
        name: 'ha_list_backups',
        description: 'List available backups for a configuration file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Filename to list backups for' }
          },
          required: ['filename']
        }
      },
      'ha_create_automation': {
        name: 'ha_create_automation',
        description: 'Create a new automation in automations.yaml',
        inputSchema: {
          type: 'object',
          properties: {
            automation_yaml: { type: 'string', description: 'YAML definition of the automation' }
          },
          required: ['automation_yaml']
        }
      },
      'ha_update_automation': {
        name: 'ha_update_automation',
        description: 'Update an existing automation by ID',
        inputSchema: {
          type: 'object',
          properties: {
            automation_id: { type: 'string', description: 'ID of automation to update' },
            automation_yaml: { type: 'string', description: 'New YAML definition' }
          },
          required: ['automation_id', 'automation_yaml']
        }
      },
      'ha_delete_automation': {
        name: 'ha_delete_automation',
        description: 'Delete an automation by ID',
        inputSchema: {
          type: 'object',
          properties: {
            automation_id: { type: 'string', description: 'ID of automation to delete' }
          },
          required: ['automation_id']
        }
      },
      'ha_list_automations': {
        name: 'ha_list_automations',
        description: 'List all automations with their IDs and aliases',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_system_info': {
        name: 'ha_system_info',
        description: 'Get Home Assistant system information and health status',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_get_logs': {
        name: 'ha_get_logs',
        description: 'Fetch Home Assistant logs with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            lines: { type: 'number', description: 'Number of log lines (default: 100)' },
            filter: { type: 'string', description: 'Regex pattern to filter logs' }
          }
        }
      },
      'ha_restart': {
        name: 'ha_restart',
        description: 'Restart Home Assistant (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: { type: 'string', enum: ['yes'], description: 'Must be "yes" to confirm' }
          },
          required: ['confirm']
        }
      }
    };

    return definitions[name] || { name, description: 'No description', inputSchema: { type: 'object' } };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Home Assistant MCP Server running on stdio');

    // Keep the process alive
    process.stdin.resume();
  }
}

// Start server
const server = new HAMCPServer();
server.run().catch(console.error);
