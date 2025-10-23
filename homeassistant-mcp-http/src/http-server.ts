// ABOUTME: HTTP MCP server entry point with Express and OAuth
// ABOUTME: Serves SSE transport, OAuth endpoints, and MCP tools

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from './ha-client.js';
import { registerStateTools } from './tools/states.js';
import { registerConfigTools } from './tools/config.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerSystemTools } from './tools/system.js';
import {
  generateState,
  getAuthorizeUrl,
  exchangeCodeForToken,
  createSession,
  getValidAccessToken
} from './oauth.js';
import { cleanupExpiredSessions } from './session.js';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Store OAuth states temporarily (in-memory is fine for this)
const oauthStates = new Map<string, { created: number }>();

// Cleanup expired OAuth states every hour
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.created > 3600000) { // 1 hour
      oauthStates.delete(state);
    }
  }
}, 3600000);

// Cleanup expired sessions daily
setInterval(() => {
  cleanupExpiredSessions().catch(console.error);
}, 86400000);

// OAuth: Start authorization flow
app.get('/oauth/authorize', (req: Request, res: Response) => {
  const state = generateState();
  oauthStates.set(state, { created: Date.now() });

  const authorizeUrl = getAuthorizeUrl(state);
  res.redirect(authorizeUrl);
});

// OAuth: Handle callback
app.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).send('Invalid OAuth callback');
  }

  // Verify state
  if (!oauthStates.has(state)) {
    return res.status(400).send('Invalid or expired state');
  }
  oauthStates.delete(state);

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code);

    // Create session
    const sessionId = await createSession(tokens);

    // Set session cookie
    res.cookie('mcp_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.send(`
      <html>
        <body>
          <h1>Authorization Successful!</h1>
          <p>You can close this window and return to Claude.</p>
          <script>
            // Try to close window if opened via popup
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('OAuth token exchange failed:', error);

    if (error.response?.data?.error === 'invalid_grant') {
      return res.redirect('/oauth/authorize');
    }

    res.status(500).send('Authentication failed. Please try again.');
  }
});

// OAuth: Logout
app.post('/oauth/logout', (req: Request, res: Response) => {
  res.clearCookie('mcp_session');
  res.json({ success: true });
});

// Middleware: Verify session
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies.mcp_session;

  if (!sessionId) {
    return res.status(401).json({
      error: 'unauthorized',
      auth_url: '/oauth/authorize'
    });
  }

  const accessToken = await getValidAccessToken(sessionId);

  if (!accessToken) {
    res.clearCookie('mcp_session');
    return res.status(401).json({
      error: 'unauthorized',
      auth_url: '/oauth/authorize'
    });
  }

  // Attach access token to request
  (req as any).accessToken = accessToken;
  next();
}

// Initialize MCP server
class HAMCPServer {
  private server: Server;
  private tools: Map<string, Function>;

  constructor() {
    this.server = new Server(
      {
        name: 'homeassistant-mcp-http',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

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

      // Get access token from request context
      const accessToken = (request as any).accessToken;
      if (!accessToken) {
        throw new Error('Unauthorized - no access token');
      }

      // Create HA client with user's token
      const haClient = new HomeAssistantClient('http://homeassistant:8123', accessToken);

      try {
        const result = await toolFn(haClient, args || {});
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
    registerStateTools(this.tools);
    registerConfigTools(this.tools);
    registerAutomationTools(this.tools);
    registerSystemTools(this.tools);
  }

  private getToolDefinition(name: string) {
    // Same tool definitions as stdio version
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

  async handleSSE(req: Request, res: Response) {
    const transport = new SSEServerTransport('/messages', res);

    // Attach access token to MCP request context
    (transport as any).accessToken = (req as any).accessToken;

    await this.server.connect(transport);
  }

  async handleMessage(req: Request, res: Response) {
    // Attach access token to request
    (req.body as any).accessToken = (req as any).accessToken;

    // MCP SDK handles the message
    res.json({ received: true });
  }
}

const mcpServer = new HAMCPServer();

// MCP endpoints (require auth)
app.get('/sse', requireAuth, (req, res) => mcpServer.handleSSE(req, res));
app.post('/messages', requireAuth, (req, res) => mcpServer.handleMessage(req, res));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on port ${PORT}`);
  console.log(`OAuth Client URL: ${process.env.OAUTH_CLIENT_URL}`);
});
