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
    // Tool definitions will be stored alongside tool functions
    // This is a placeholder that will be filled in by tool registration
    const definitions: Record<string, any> = {
      'ha_get_states': {
        name: 'ha_get_states',
        description: 'Get current state of Home Assistant entities',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Optional specific entity ID to query'
            },
            domain: {
              type: 'string',
              description: 'Optional domain filter (e.g., "light", "sensor")'
            }
          }
        }
      }
    };

    return definitions[name] || { name, description: 'No description', inputSchema: { type: 'object' } };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Home Assistant MCP Server running on stdio');
  }
}

// Start server
const server = new HAMCPServer();
server.run().catch(console.error);
