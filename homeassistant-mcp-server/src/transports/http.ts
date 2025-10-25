// ABOUTME: HTTP transport implementation for MCP server (disabled by default)
// ABOUTME: OAuth-based HTTP transport for Claude.ai web/mobile clients

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export async function createHttpTransport(server: Server): Promise<void> {
  throw new Error('HTTP transport not yet implemented. Use TRANSPORT=stdio (default)');
}
