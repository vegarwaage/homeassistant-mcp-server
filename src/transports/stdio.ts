// ABOUTME: stdio transport implementation for MCP server
// ABOUTME: Handles stdin/stdout communication for Claude Desktop/Code

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export async function createStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Home Assistant MCP Server running on stdio');
}
