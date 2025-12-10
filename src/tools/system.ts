// ABOUTME: System-level tools for commands, logs, and diagnostics
// ABOUTME: Provides shell command execution and system monitoring

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

const execAsync = promisify(exec);

export const systemTools: Tool[] = [
  {
    name: 'ha_execute_command',
    description: 'Execute shell command with timeout. Full root access after permission granted.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30)', default: 30 }
      },
      required: ['command']
    }
  },
  {
    name: 'ha_read_logs',
    description: 'Read Home Assistant logs with optional filtering. Supports line limits to prevent token overload.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: { type: 'number', description: 'Number of lines to return (default: 100)', default: 100 },
        filter: { type: 'string', description: 'Grep pattern to filter logs (optional)' }
      },
      required: []
    }
  },
  {
    name: 'ha_get_disk_usage',
    description: 'Show disk space usage for key directories.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'ha_restart_homeassistant',
    description: 'Restart Home Assistant. Requires confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to execute', default: false }
      },
      required: ['confirm']
    }
  }
];

export async function handleSystemTool(
  name: string,
  args: any,
  sessionId: string
): Promise<any> {
  // Permission checks removed - handle on client side (Claude Code settings)

  switch (name) {
    case 'ha_execute_command': {
      const { command, timeout = 30 } = args;

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: timeout * 1000,
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        return {
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: true
        };
      } catch (error: any) {
        return {
          command,
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || '',
          error: error.message,
          success: false
        };
      }
    }

    case 'ha_read_logs': {
      const { lines = 100, filter } = args;

      try {
        // Read file directly to avoid command injection
        const fileContent = await fs.readFile('/config/home-assistant.log', 'utf-8');
        let logLines = fileContent.split('\n').filter(line => line.trim() !== '');

        // Get last N lines
        logLines = logLines.slice(-lines);

        // Apply filter if provided (using regex instead of grep)
        if (filter) {
          try {
            const regex = new RegExp(filter, 'i');
            logLines = logLines.filter(line => regex.test(line));
          } catch (regexError: any) {
            return {
              error: `Invalid filter regex: ${regexError.message}`,
              lines: []
            };
          }
        }

        return {
          lines: logLines,
          count: logLines.length,
          filtered: !!filter,
          filter
        };
      } catch (error: any) {
        return {
          error: error.message,
          lines: []
        };
      }
    }

    case 'ha_get_disk_usage': {
      const paths = ['/config', '/ssl', '/backup', '/share', '/media', '/addons'];

      const usage = await Promise.all(
        paths.map(async (path) => {
          try {
            const { stdout } = await execAsync(`du -sh ${path}`);
            const size = stdout.split('\t')[0];
            return { path, size };
          } catch {
            return { path, size: 'N/A', error: 'Not accessible' };
          }
        })
      );

      const { stdout: totalDf } = await execAsync('df -h /');
      const dfLines = totalDf.trim().split('\n');
      const rootDisk = dfLines[1].split(/\s+/);

      return {
        directories: usage,
        root_filesystem: {
          size: rootDisk[1],
          used: rootDisk[2],
          available: rootDisk[3],
          use_percent: rootDisk[4]
        }
      };
    }

    case 'ha_restart_homeassistant': {
      const { confirm } = args;

      if (!confirm) {
        return {
          error: 'confirmation_required',
          message: 'Set confirm: true to restart Home Assistant. This will disconnect all clients.'
        };
      }

      try {
        // Use ha-cli to restart
        await execAsync('ha core restart');
        return {
          restarting: true,
          message: 'Home Assistant is restarting. Connection will be lost temporarily.'
        };
      } catch (error: any) {
        return {
          error: error.message,
          restarting: false
        };
      }
    }

    default:
      return { error: 'unknown_tool', tool: name };
  }
}

export function registerSystemTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_system_info',
      description: 'Get Home Assistant system information and health status',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const info = await client.getSystemInfo();
        return info;
      }
    },
    {
      name: 'ha_get_logs',
      description: 'Fetch Home Assistant logs with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          lines: { type: 'number', description: 'Number of log lines (default: 100)' },
          filter: { type: 'string', description: 'Regex pattern to filter logs' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { lines = 100, filter } = args;

        let logs = await client.getLogs(lines);

        if (filter) {
          const regex = new RegExp(filter, 'i');
          logs = logs.filter(log => regex.test(log.message) || regex.test(log.source || ''));
        }

        return {
          count: logs.length,
          logs
        };
      }
    },
    {
      name: 'ha_restart',
      description: 'Restart Home Assistant (requires confirmation)',
      inputSchema: {
        type: 'object',
        properties: {
          confirm: { type: 'string', enum: ['yes'], description: 'Must be "yes" to confirm' }
        },
        required: ['confirm']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { confirm } = args;

        if (!confirm || confirm !== 'yes') {
          return {
            success: false,
            message: 'Restart requires confirmation. Set confirm="yes" to proceed.'
          };
        }

        await client.reloadConfig('core');

        return {
          success: true,
          message: 'Home Assistant restart initiated'
        };
      }
    },
    {
      name: 'ha_get_components',
      description: 'Get list of loaded Home Assistant components/integrations. Simpler and faster than ha_system_info for just getting component list.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const components = await client.getComponents();
        return {
          count: components.length,
          components: components.sort()
        };
      }
    },
    {
      name: 'ha_get_error_log',
      description: 'Get current session error log from Home Assistant. Returns raw error log text with recent errors and warnings.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const errorLog = await client.getErrorLog();
        const lines = errorLog.split('\n').filter(line => line.trim());
        return {
          line_count: lines.length,
          error_log: errorLog
        };
      }
    },
    {
      name: 'ha_check_config_rest',
      description: 'Validate Home Assistant configuration using REST API (does not require CLI access). Returns validation result with any errors found.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const result = await client.checkConfigRest();
        return {
          valid: result.valid,
          errors: result.errors || [],
          message: result.valid ? 'Configuration is valid' : 'Configuration has errors'
        };
      }
    }
  ];
}
