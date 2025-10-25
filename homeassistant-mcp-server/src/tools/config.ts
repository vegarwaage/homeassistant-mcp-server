// ABOUTME: MCP tools for reading and writing Home Assistant configuration files
// ABOUTME: Provides ha_read_config, ha_write_config, ha_list_files, ha_validate_config, ha_reload_config

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';
import { backupFile, listBackups } from '../backup.js';

const CONFIG_DIR = '/config';

/**
 * Validate that a user-provided path is within the config directory
 * Prevents path traversal attacks
 */
function validatePath(userPath: string): string {
  const fullPath = join(CONFIG_DIR, userPath);
  const normalized = resolve(fullPath);

  // Ensure the resolved path is within CONFIG_DIR
  if (!normalized.startsWith(resolve(CONFIG_DIR))) {
    throw new Error('Invalid path: access outside config directory not allowed');
  }

  return normalized;
}

export function registerConfigTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_read_config',
      description: 'Read any configuration file from /config directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from /config (e.g., "automations.yaml")' }
        },
        required: ['path']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { path } = args;

        if (!path) {
          throw new Error('path is required');
        }

        const fullPath = validatePath(path);
        const content = await fs.readFile(fullPath, 'utf-8');

        return {
          path,
          content,
          size: content.length
        };
      }
    },
    {
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
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { path, content, validate = true } = args;

        if (!path || content === undefined) {
          throw new Error('path and content are required');
        }

        const fullPath = validatePath(path);

        // Backup existing file if it exists
        let backupPath: string | undefined;
        try {
          await fs.access(fullPath);
          const backup = await backupFile(fullPath);
          backupPath = backup.path;
          console.error(`Backed up to: ${backup.path}`);
        } catch {
          // File doesn't exist, no backup needed
        }

        // Write new content
        await fs.writeFile(fullPath, content, 'utf-8');

        // Validate if requested
        if (validate) {
          const validation = await client.validateConfig();
          if (!validation.valid) {
            // ROLLBACK: Restore from backup if it exists
            if (backupPath) {
              await fs.copyFile(backupPath, fullPath);
              console.error(`Rolled back to backup due to validation failure`);
            }
            throw new Error(`Configuration validation failed: ${validation.errors?.join(', ')}`);
          }
        }

        return {
          success: true,
          path,
          size: content.length,
          validated: validate
        };
      }
    },
    {
      name: 'ha_list_files',
      description: 'List files and directories in config directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Subdirectory to list (default: root)' },
          pattern: { type: 'string', description: 'Regex pattern to filter files' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { path = '', pattern } = args;

        const fullPath = validatePath(path);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        let files = entries.map(entry => ({
          name: entry.name,
          path: join(path, entry.name),
          type: entry.isDirectory() ? 'directory' : 'file'
        }));

        if (pattern) {
          const regex = new RegExp(pattern);
          files = files.filter(f => regex.test(f.name));
        }

        return {
          count: files.length,
          files
        };
      }
    },
    {
      name: 'ha_validate_config',
      description: 'Validate Home Assistant configuration without applying changes',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const validation = await client.validateConfig();
        return validation;
      }
    },
    {
      name: 'ha_reload_config',
      description: 'Reload configuration for automations, scripts, or core',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['automation', 'script', 'core'], description: 'Config type to reload' }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { type = 'automation' } = args;

        await client.reloadConfig(type as 'core' | 'automation' | 'script');

        return {
          success: true,
          type,
          message: `${type} configuration reloaded`
        };
      }
    },
    {
      name: 'ha_list_backups',
      description: 'List available backups for a configuration file',
      inputSchema: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename to list backups for' }
        },
        required: ['filename']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { filename } = args;

        if (!filename) {
          throw new Error('filename is required');
        }

        const backups = await listBackups(filename);

        return {
          count: backups.length,
          backups
        };
      }
    }
  ];
}
