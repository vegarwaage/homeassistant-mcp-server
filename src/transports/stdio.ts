// ABOUTME: stdio transport implementation for MCP server
// ABOUTME: Handles stdin/stdout communication for Claude Desktop/Code

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export async function createStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup information to stderr (visible in MCP server logs)
  console.error('');
  console.error('='.repeat(70));
  console.error('  Home Assistant MCP Server v2.1.0');
  console.error('='.repeat(70));
  console.error('  Transport: stdio (SSH)');
  console.error('  Total Tools: 133 (including ha_mcp_capabilities help tool)');
  console.error('  Home Assistant: ' + (process.env.HA_BASE_URL || 'http://homeassistant:8123'));
  console.error('');
  console.error('Quick Start for Claude Code:');
  console.error('  • Call ha_mcp_capabilities() to see all available tools and usage guide');
  console.error('  • Use ha_get_states(domain="light") to discover lights, sensors, etc.');
  console.error('  • Use ha_call_service() to control devices');
  console.error('  • Use ha_read_config(path="automations.yaml") to view automations');
  console.error('  • Use ha_create_automation() to create persistent automations');
  console.error('');
  console.error('Key Features:');
  console.error('  ✓ Full entity control (lights, switches, sensors, climate, media)');
  console.error('  ✓ Automation creation and management (persistent to automations.yaml)');
  console.error('  ✓ Configuration file read/write with auto-backup');
  console.error('  ✓ Advanced search and filtering (case-insensitive, fuzzy matching)');
  console.error('  ✓ System monitoring and diagnostics');
  console.error('  ✓ Root access (filesystem, database, shell commands)');
  console.error('');
  console.error('Important Notes:');
  console.error('  • Search is case-insensitive - use ha_search_entities with query param');
  console.error('  • Always use validate=false with ha_write_config (MCP limitation)');
  console.error('  • Automations created via ha_create_automation ARE persistent');
  console.error('  • Use device actions (not service) for mobile notifications');
  console.error('='.repeat(70));
  console.error('');
}
