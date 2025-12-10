// ABOUTME: Help tool to explain MCP server capabilities to Claude Code
// ABOUTME: Provides ha_mcp_capabilities tool for understanding available features

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerHelpTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_mcp_capabilities',
      description: 'Get a comprehensive overview of this MCP server\'s capabilities, available tools, and usage guidance. Call this first in a new session to understand what you can do with Home Assistant via MCP. Returns categorized tool list with examples.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional: filter by category (entity_control, automation, configuration, monitoring, search, system)',
            enum: ['entity_control', 'automation', 'configuration', 'monitoring', 'search', 'system', 'all']
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { category = 'all' } = args;

        const capabilities = {
          server_info: {
            name: 'Home Assistant MCP Server',
            version: '2.4.0',
            total_tools: 136,
            transport: process.env.TRANSPORT || 'stdio',
            description: 'Full-featured MCP server for Home Assistant with 136 tools across entity management, automation, configuration, and system control. Supports HA 2024.8+ service responses and HA 2025+ target resolution.'
          },

          quick_start: {
            discover_entities: 'Use ha_get_states with domain filter (e.g., domain="light") to see all lights, sensors, switches, etc.',
            control_devices: 'Use ha_call_service to turn lights on/off, control switches, set thermostats, etc.',
            read_config: 'Use ha_read_config to view automations.yaml and understand existing automations',
            create_automation: 'Use ha_create_automation with YAML definition to create persistent automations',
            search: 'Use ha_search_entities with query string (case-insensitive) to find specific entities'
          },

          categories: {
            entity_control: {
              description: 'Read and control Home Assistant devices',
              key_tools: [
                'ha_get_states - List all entities or filter by domain',
                'ha_get_entity_details - Get complete info for specific entity',
                'ha_call_service - Control devices (turn on/off, set values, etc.)',
                'ha_get_history - Query historical state changes'
              ],
              examples: [
                'Turn on bedroom light: ha_call_service(domain="light", service="turn_on", entity_id="light.bedroom")',
                'Check all sensors: ha_get_states(domain="sensor")',
                'Get light details: ha_get_entity_details(entity_id="light.living_room")'
              ]
            },

            automation: {
              description: 'Create, manage, and debug Home Assistant automations',
              key_tools: [
                'ha_create_automation - Create persistent automation in automations.yaml',
                'ha_list_automations - View all configured automations',
                'ha_update_automation - Modify existing automation',
                'ha_delete_automation - Remove automation'
              ],
              important_notes: [
                'Automations created with ha_create_automation ARE persistent and saved to automations.yaml',
                'Always read existing automations first to understand YAML format',
                'Use device actions (not service calls) for mobile notifications'
              ]
            },

            configuration: {
              description: 'Read and modify Home Assistant configuration files',
              key_tools: [
                'ha_read_config - Read any file from /config directory',
                'ha_write_config - Write/update config files (auto-backs up)',
                'ha_reload_config - Reload automations, scripts, or core',
                'ha_list_files - List files in /config directory'
              ],
              important_notes: [
                'ALWAYS use validate=false with ha_write_config (MCP doesn\'t have Supervisor API access)',
                'Config is validated when you reload it',
                'Automatic backup created before every write'
              ]
            },

            search: {
              description: 'Find entities, services, and configuration',
              key_tools: [
                'ha_search_entities - Fuzzy search with filters (domain, state, area, device_class)',
                'ha_get_stats - Entity counts grouped by domain/device_class/area',
                'ha_list_areas - List all rooms/areas',
                'ha_list_devices - List all devices'
              ],
              best_practices: [
                'Search is case-insensitive and fuzzy',
                'Start with domain filter to narrow results',
                'Use ha_get_stats to get system overview'
              ]
            },

            monitoring: {
              description: 'Monitor system health, logs, and activity',
              key_tools: [
                'ha_system_info - System health and version info',
                'ha_get_logs - Fetch HA logs with filtering',
                'ha_get_recent_activity - See recent entity state changes',
                'ha_get_logbook - Human-readable event history'
              ]
            },

            system: {
              description: 'System-level operations (requires root access)',
              key_tools: [
                'ha_execute_command - Run shell commands (requires permission)',
                'ha_read_file - Read any file (requires permission)',
                'ha_write_file - Write any file (requires permission)',
                'ha_execute_sql - Query HA database (requires permission)'
              ],
              permission_info: 'Root-level tools auto-grant permissions for single-user deployments'
            }
          },

          common_patterns: {
            find_and_control_light: [
              '1. ha_search_entities(domain="light", query="bedroom")',
              '2. ha_call_service(domain="light", service="turn_on", entity_id="light.bedroom")'
            ],
            create_automation: [
              '1. ha_read_config(path="automations.yaml") - See existing format',
              '2. ha_create_automation(automation_yaml="...") - Create new automation',
              '3. ha_list_automations() - Verify it was created'
            ],
            monitor_sensor: [
              '1. ha_get_entity_details(entity_id="sensor.temperature")',
              '2. ha_get_history(entity_ids="sensor.temperature", start_time="...")',
              '3. ha_get_recent_activity(domain="sensor")'
            ]
          },

          important_limitations: {
            oauth_web_mobile: 'OAuth for web/mobile is complete but blocked by Anthropic\'s OAuth proxy (external issue)',
            validation: 'Config validation via REST (validate=true) available, or use ha_check_config_rest for direct REST validation',
            mobile_notifications: 'Use device actions in automations, not ha_send_notification service',
            service_responses: 'Use return_response=true with ha_call_service to get response data from services (HA 2024.8+)'
          },

          connection_info: {
            transport: process.env.TRANSPORT || 'stdio',
            ha_url: process.env.HA_BASE_URL || 'http://homeassistant:8123',
            auth_method: 'Long-lived access token (SUPERVISOR_TOKEN)'
          }
        };

        // Filter by category if requested
        if (category !== 'all') {
          return {
            server_info: capabilities.server_info,
            category: capabilities.categories[category as keyof typeof capabilities.categories],
            quick_start: capabilities.quick_start,
            connection_info: capabilities.connection_info
          };
        }

        return capabilities;
      }
    }
  ];
}
