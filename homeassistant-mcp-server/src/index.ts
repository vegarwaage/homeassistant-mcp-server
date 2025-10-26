// ABOUTME: Main entry point for Home Assistant MCP server
// ABOUTME: Detects transport (stdio/HTTP) and initializes appropriate adapter

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
import { registerSearchTools } from './tools/search.js';
import { registerActivityTools } from './tools/activity.js';
import { registerOrganizationTools } from './tools/organization.js';
import { registerConversationTools } from './tools/conversation.js';
import { registerMonitoringTools } from './tools/monitoring.js';
import { registerHelpersTools } from './tools/helpers.js';
import { registerMediaTools } from './tools/media.js';
import { registerEnergyTools } from './tools/energy.js';
import { registerPersonTools } from './tools/persons.js';
import { registerEventsTools } from './tools/events.js';
import { registerCalendarsTools } from './tools/calendars.js';
import { registerLogbookTools } from './tools/logbook.js';
import { registerBlueprintsTools } from './tools/blueprints.js';
import { registerNotificationsTools } from './tools/notifications.js';
import { createStdioTransport, createHttpTransport } from './transports/index.js';
import { initSession, grantPermission } from './permissions.js';
import { filesystemTools, handleFilesystemTool } from './tools/filesystem.js';
import { databaseTools, handleDatabaseTool } from './tools/database.js';
import { systemTools as rootSystemTools, handleSystemTool } from './tools/system.js';

// Extract and validate environment variables
const HA_BASE_URL = process.env.HA_BASE_URL || 'http://homeassistant:8123';
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;

if (!SUPERVISOR_TOKEN) {
  console.error('ERROR: SUPERVISOR_TOKEN environment variable is required');
  console.error('Please set SUPERVISOR_TOKEN before starting the server');
  process.exit(1);
}

// Detect transport from environment variable or default to stdio
const TRANSPORT = process.env.TRANSPORT?.toLowerCase() || 'stdio';

// Validate transport
if (TRANSPORT !== 'stdio' && TRANSPORT !== 'http') {
  console.error(`Invalid TRANSPORT value: ${TRANSPORT}. Must be 'stdio' or 'http'`);
  process.exit(1);
}

// HTTP transport now available with OAuth 2.1 support
if (TRANSPORT === 'http') {
  console.log('HTTP transport enabled with OAuth 2.1');
  console.log('Requires: OAUTH_CLIENT_URL, PORT (optional)');
}

class HAMCPServer {
  private server: Server;
  private haClient: HomeAssistantClient;
  private tools: Map<string, ToolDefinition>;
  private rootTools: Map<string, any>;
  private sessionId: string;

  constructor() {
    this.server = new Server(
      {
        name: 'homeassistant-mcp-server',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.haClient = new HomeAssistantClient(HA_BASE_URL, SUPERVISOR_TOKEN);
    this.tools = new Map();
    this.rootTools = new Map();
    this.sessionId = 'default';

    // Initialize session for permission tracking
    initSession(this.sessionId);

    this.setupHandlers();
    this.registerTools();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const apiTools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      const rootTools = Array.from(this.rootTools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      return { tools: [...apiTools, ...rootTools] };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Check if this is a root-level tool
      const rootTool = this.rootTools.get(name);
      if (rootTool) {
        try {
          let result;

          // Route to appropriate handler based on tool name prefix
          if (name.startsWith('ha_read_file') || name.startsWith('ha_write_file') ||
              name.startsWith('ha_list_directory') || name.startsWith('ha_delete_file') ||
              name.startsWith('ha_move_file') || name.startsWith('ha_file_info')) {
            result = await handleFilesystemTool(name, args || {}, this.sessionId);
          } else if (name.startsWith('ha_execute_sql') || name.startsWith('ha_get_state_history') ||
                     name.startsWith('ha_get_statistics') || name.startsWith('ha_purge_database') ||
                     name.startsWith('ha_database_info')) {
            result = await handleDatabaseTool(name, args || {}, this.sessionId);
          } else if (name === 'ha_execute_command' || name === 'ha_read_logs' ||
                     name === 'ha_get_disk_usage' || name === 'ha_restart_homeassistant') {
            result = await handleSystemTool(name, args || {}, this.sessionId);
          } else {
            throw new Error(`Unknown root tool handler for: ${name}`);
          }

          // Handle permission requests
          if (result.error === 'permission_required') {
            return {
              content: [
                {
                  type: 'text',
                  text: result.message,
                },
              ],
              isError: false,
            };
          }

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
      }

      // Handle API-level tools
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
    // Register all API-level tool categories
    const allTools = [
      ...registerStateTools(),
      ...registerConfigTools(),
      ...registerAutomationTools(),
      ...registerSystemTools(),
      ...registerSearchTools(),
      ...registerActivityTools(),
      ...registerOrganizationTools(),
      ...registerConversationTools(),
      ...registerMonitoringTools(),
      ...registerHelpersTools(),
      ...registerMediaTools(),
      ...registerEnergyTools(),
      ...registerPersonTools(),
      ...registerEventsTools(),
      ...registerCalendarsTools(),
      ...registerLogbookTools(),
      ...registerBlueprintsTools(),
      ...registerNotificationsTools()
    ];

    // Add API tools to map for quick lookup
    for (const tool of allTools) {
      this.tools.set(tool.name, tool);
    }

    // Register root-level tools (filesystem, database, commands)
    const rootLevelTools = [
      ...filesystemTools,
      ...databaseTools,
      ...rootSystemTools
    ];

    // Add root tools to their own map
    for (const tool of rootLevelTools) {
      this.rootTools.set(tool.name, tool);
    }
  }

  async run() {
    try {
      if (TRANSPORT === 'http') {
        await createHttpTransport(this.server);
      } else {
        await createStdioTransport(this.server);
      }

      // Keep the process alive
      process.stdin.resume();
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new HAMCPServer();
server.run().catch(console.error);
