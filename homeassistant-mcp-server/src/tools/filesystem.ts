// ABOUTME: Filesystem access tools with safety constraints
// ABOUTME: Allows read/write to HA directories, blocks system paths

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { hasPermission, getPermissionRequest, PermissionCategory } from '../permissions.js';
import { validatePositiveNumber } from '../validation.js';

const BLOCKED_PATHS = ['/etc', '/usr', '/bin', '/sbin', '/sys', '/proc'];
const ALLOWED_PATHS = ['/config', '/ssl', '/backup', '/share', '/media', '/addons'];

function isPathSafe(filePath: string): { safe: boolean; reason?: string } {
  const normalized = path.normalize(filePath);

  // Check blocked paths
  for (const blocked of BLOCKED_PATHS) {
    if (normalized.startsWith(blocked)) {
      return { safe: false, reason: `Access to ${blocked}/* is blocked for safety. Allowed paths: ${ALLOWED_PATHS.join(', ')}` };
    }
  }

  return { safe: true };
}

async function checkPermission(sessionId: string): Promise<string | null> {
  if (!hasPermission(sessionId, 'filesystem')) {
    return getPermissionRequest('filesystem');
  }
  return null;
}

export const filesystemTools: Tool[] = [
  {
    name: 'ha_read_file',
    description: 'Read file contents (text or binary as base64). Supports max_size limit to prevent token overload.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        max_size: { type: 'number', description: 'Maximum file size in bytes (default: 1MB)', default: 1048576 },
        encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'Read as text (utf8) or binary (base64)', default: 'utf8' }
      },
      required: ['path']
    }
  },
  {
    name: 'ha_write_file',
    description: 'Write or create file with safety checks. Blocked paths: /etc, /usr, /bin, /sbin, /sys, /proc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        content: { type: 'string', description: 'File content to write' },
        encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'Write as text (utf8) or binary (base64)', default: 'utf8' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'ha_list_directory',
    description: 'List files and directories with metadata (size, modified, permissions). Supports limit and excludes hidden files by default.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute directory path' },
        limit: { type: 'number', description: 'Maximum entries to return (default: 100)', default: 100 },
        include_hidden: { type: 'boolean', description: 'Include hidden files (default: false)', default: false }
      },
      required: ['path']
    }
  },
  {
    name: 'ha_delete_file',
    description: 'Delete file or directory. Blocked paths: /etc, /usr, /bin, /sbin, /sys, /proc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file or directory path' },
        recursive: { type: 'boolean', description: 'Recursively delete directory contents', default: false }
      },
      required: ['path']
    }
  },
  {
    name: 'ha_move_file',
    description: 'Move or rename file/directory. Blocked paths: /etc, /usr, /bin, /sbin, /sys, /proc.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'ha_file_info',
    description: 'Get detailed file metadata (permissions, owner, size, timestamps).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' }
      },
      required: ['path']
    }
  }
];

export async function handleFilesystemTool(
  name: string,
  args: any,
  sessionId: string
): Promise<any> {
  // Check permission
  const permRequest = await checkPermission(sessionId);
  if (permRequest) {
    return { error: 'permission_required', message: permRequest, category: 'filesystem' };
  }

  switch (name) {
    case 'ha_read_file': {
      const { path: filePath, encoding = 'utf8' } = args;

      // Validate max_size parameter
      const max_size = validatePositiveNumber(args.max_size, 'max_size', 1048576);

      const safety = isPathSafe(filePath);
      if (!safety.safe) {
        return { error: 'path_blocked', message: safety.reason };
      }

      const stats = await fs.stat(filePath);
      if (stats.size > max_size) {
        return {
          error: 'file_too_large',
          message: `File size ${stats.size} bytes exceeds max_size ${max_size} bytes. Increase max_size parameter or use ha_read_logs with lines limit.`,
          size: stats.size,
          max_size
        };
      }

      const content = await fs.readFile(filePath, encoding as any);
      return { path: filePath, content, size: stats.size, encoding };
    }

    case 'ha_write_file': {
      const { path: filePath, content, encoding = 'utf8' } = args;
      const safety = isPathSafe(filePath);
      if (!safety.safe) {
        return { error: 'path_blocked', message: safety.reason };
      }

      await fs.writeFile(filePath, content, encoding as any);
      const stats = await fs.stat(filePath);
      return { path: filePath, size: stats.size, encoding };
    }

    case 'ha_list_directory': {
      const { path: dirPath, limit = 100, include_hidden = false } = args;
      const safety = isPathSafe(dirPath);
      if (!safety.safe) {
        return { error: 'path_blocked', message: safety.reason };
      }

      const entries = await fs.readdir(dirPath);
      const filtered = include_hidden ? entries : entries.filter(e => !e.startsWith('.'));
      const limited = filtered.slice(0, limit);

      const results = await Promise.all(
        limited.map(async (entry) => {
          const fullPath = path.join(dirPath, entry);
          const stats = await fs.stat(fullPath);
          return {
            name: entry,
            path: fullPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
            permissions: stats.mode.toString(8).slice(-3)
          };
        })
      );

      return {
        path: dirPath,
        entries: results,
        total: filtered.length,
        returned: results.length,
        truncated: filtered.length > limit
      };
    }

    case 'ha_delete_file': {
      const { path: filePath, recursive = false } = args;
      const safety = isPathSafe(filePath);
      if (!safety.safe) {
        return { error: 'path_blocked', message: safety.reason };
      }

      await fs.rm(filePath, { recursive });
      return { path: filePath, deleted: true };
    }

    case 'ha_move_file': {
      const { source, destination } = args;
      const sourceSafety = isPathSafe(source);
      const destSafety = isPathSafe(destination);

      if (!sourceSafety.safe) {
        return { error: 'path_blocked', message: `Source: ${sourceSafety.reason}` };
      }
      if (!destSafety.safe) {
        return { error: 'path_blocked', message: `Destination: ${destSafety.reason}` };
      }

      await fs.rename(source, destination);
      return { source, destination, moved: true };
    }

    case 'ha_file_info': {
      const { path: filePath } = args;
      const safety = isPathSafe(filePath);
      if (!safety.safe) {
        return { error: 'path_blocked', message: safety.reason };
      }

      const stats = await fs.stat(filePath);
      return {
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        permissions: stats.mode.toString(8).slice(-3),
        owner: stats.uid,
        group: stats.gid,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString()
      };
    }

    default:
      return { error: 'unknown_tool', tool: name };
  }
}
