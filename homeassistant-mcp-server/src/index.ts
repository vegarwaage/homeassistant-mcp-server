// ABOUTME: MCP server entry point that initializes the server and registers all tools
// ABOUTME: Handles stdio transport and tool execution routing

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from './ha-client.js';
import { ToolDefinition } from './types.js';
import { registerStateTools } from './tools/states.js';
import { registerConfigTools } from './tools/config.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerSystemTools } from './tools/system.js';

class HAMCPServer {
  private server: Server;
  private haClient: HomeAssistantClient;
  private tools: Map<string, ToolDefinition>;

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
      const toolList = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      return { tools: toolList };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.handler(this.haClient, args || {});
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
    // Register all tool categories
    const allTools = [
      ...registerStateTools(),
      ...registerConfigTools(),
      ...registerAutomationTools(),
      ...registerSystemTools()
    ];

    // Add to map for quick lookup
    for (const tool of allTools) {
      this.tools.set(tool.name, tool);
    }
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
