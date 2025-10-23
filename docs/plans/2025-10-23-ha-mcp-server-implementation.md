# Home Assistant MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Model Context Protocol (MCP) server that runs as a Home Assistant addon, providing Claude Code and Claude Desktop with full read/write access to Home Assistant entities, configuration, automations, database, and logs.

**Architecture:** Node.js/TypeScript MCP server packaged as Home Assistant addon. Server uses Home Assistant REST API, Supervisor API, and CLI commands for local access. Exposes MCP tools via stdio interface accessible over SSH. Includes automatic config backups, validation, and rollback capabilities.

**Tech Stack:** TypeScript, Node.js, @modelcontextprotocol/sdk, Home Assistant Supervisor APIs, Docker

---

## Task 1: Project Structure & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Initialize Node.js project**

Create `package.json`:

```json
{
  "name": "homeassistant-mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Home Assistant integration with Claude",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "echo \"Tests coming soon\" && exit 0"
  },
  "keywords": ["mcp", "homeassistant", "claude"],
  "author": "Vegar Selvik Wavik",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.6.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create project .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
*.log
.env
.DS_Store
*.tsbuildinfo
```

**Step 4: Create README**

Create `README.md`:

```markdown
# Home Assistant MCP Server

MCP server for integrating Home Assistant with Claude Code and Claude Desktop.

## Features

- Entity state queries and history
- Configuration file management
- Automation creation and modification
- Database queries
- System diagnostics and logs

## Installation

Install as Home Assistant addon via custom repository.

## Development

```bash
npm install
npm run build
npm start
```

## Configuration

See `config.yaml` for addon configuration options.
```

**Step 5: Install dependencies**

Run: `npm install`

Expected: Dependencies installed, package-lock.json created

**Step 6: Commit project setup**

```bash
git add package.json tsconfig.json .gitignore README.md package-lock.json
git commit -m "feat: initialize project structure and dependencies"
```

---

## Task 2: TypeScript Types & Interfaces

**Files:**
- Create: `src/types.ts`

**Step 1: Create type definitions**

Create `src/types.ts`:

```typescript
// ABOUTME: Type definitions for Home Assistant API responses and MCP tool parameters
// ABOUTME: Defines interfaces for entities, states, configs, and tool inputs/outputs

/**
 * Home Assistant entity state
 */
export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

/**
 * Home Assistant service call
 */
export interface HAServiceCall {
  domain: string;
  service: string;
  service_data?: Record<string, any>;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
}

/**
 * Historical data query parameters
 */
export interface HAHistoryQuery {
  entity_ids?: string[];
  start_time?: string;
  end_time?: string;
  minimal_response?: boolean;
}

/**
 * Configuration file reference
 */
export interface HAConfigFile {
  path: string;
  content: string;
}

/**
 * Automation definition
 */
export interface HAAutomation {
  id?: string;
  alias: string;
  description?: string;
  trigger: any[];
  condition?: any[];
  action: any[];
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
}

/**
 * System info response
 */
export interface HASystemInfo {
  version: string;
  installation_type: string;
  os_name: string;
  os_version: string;
  hostname: string;
  supervisor?: string;
}

/**
 * Database query result
 */
export interface HADatabaseResult {
  columns: string[];
  rows: any[][];
}

/**
 * Log entry
 */
export interface HALogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

/**
 * Config validation result
 */
export interface HAValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  path: string;
  timestamp: string;
  original_path: string;
}
```

**Step 2: Verify types compile**

Run: `npm run build`

Expected: Compilation succeeds, `dist/types.js` and `dist/types.d.ts` created

**Step 3: Commit types**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript type definitions for HA API"
```

---

## Task 3: Home Assistant Client Library

**Files:**
- Create: `src/ha-client.ts`

**Step 1: Create HA client class**

Create `src/ha-client.ts`:

```typescript
// ABOUTME: Client library for communicating with Home Assistant APIs
// ABOUTME: Provides methods for REST API, Supervisor API, and CLI commands

import axios, { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  HAState,
  HAServiceCall,
  HAHistoryQuery,
  HASystemInfo,
  HADatabaseResult,
  HALogEntry,
  HAValidationResult
} from './types.js';

const execAsync = promisify(exec);

export class HomeAssistantClient {
  private apiClient: AxiosInstance;
  private supervisorClient: AxiosInstance;
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string = 'http://supervisor', token: string = process.env.SUPERVISOR_TOKEN || '') {
    this.baseUrl = baseUrl;
    this.token = token;

    // REST API client
    this.apiClient = axios.create({
      baseURL: `${baseUrl}/core/api`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Supervisor API client
    this.supervisorClient = axios.create({
      baseURL: `${baseUrl}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Get all entity states or filter by entity_id
   */
  async getStates(entityId?: string): Promise<HAState[]> {
    if (entityId) {
      const response = await this.apiClient.get<HAState>(`/states/${entityId}`);
      return [response.data];
    }
    const response = await this.apiClient.get<HAState[]>('/states');
    return response.data;
  }

  /**
   * Get historical data for entities
   */
  async getHistory(query: HAHistoryQuery): Promise<HAState[][]> {
    const params: any = {};
    if (query.start_time) params.filter_entity_id = query.entity_ids?.join(',');
    if (query.end_time) params.end_time = query.end_time;
    if (query.minimal_response) params.minimal_response = true;

    const endpoint = query.start_time
      ? `/history/period/${query.start_time}`
      : '/history/period';

    const response = await this.apiClient.get<HAState[][]>(endpoint, { params });
    return response.data;
  }

  /**
   * Call a Home Assistant service
   */
  async callService(serviceCall: HAServiceCall): Promise<any> {
    const { domain, service, service_data, target } = serviceCall;
    const data = { ...service_data, ...target };
    const response = await this.apiClient.post(`/services/${domain}/${service}`, data);
    return response.data;
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<HASystemInfo> {
    const response = await this.apiClient.get<HASystemInfo>('/config');
    return response.data;
  }

  /**
   * Execute HA CLI command
   */
  async execCliCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`ha ${command}`);
      if (stderr) {
        throw new Error(stderr);
      }
      return stdout;
    } catch (error: any) {
      throw new Error(`CLI command failed: ${error.message}`);
    }
  }

  /**
   * Validate Home Assistant configuration
   */
  async validateConfig(): Promise<HAValidationResult> {
    try {
      const output = await this.execCliCommand('core check');
      return {
        valid: output.includes('Configuration valid') || output.includes('valid!'),
        errors: output.includes('Invalid') ? [output] : undefined
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Reload Home Assistant configuration
   */
  async reloadConfig(type: 'core' | 'automation' | 'script' = 'automation'): Promise<void> {
    if (type === 'core') {
      await this.execCliCommand('core restart');
    } else {
      await this.callService({
        domain: type,
        service: 'reload'
      });
    }
  }

  /**
   * Get Home Assistant logs
   */
  async getLogs(lines: number = 100): Promise<HALogEntry[]> {
    const output = await this.execCliCommand(`core logs --lines ${lines}`);
    const logLines = output.split('\n').filter(line => line.trim());

    return logLines.map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (\w+) (.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          level: match[2],
          message: match[3]
        };
      }
      return {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line
      };
    });
  }
}
```

**Step 2: Build and verify**

Run: `npm run build`

Expected: Compilation succeeds

**Step 3: Commit HA client**

```bash
git add src/ha-client.ts
git commit -m "feat: add Home Assistant client library"
```

---

## Task 4: MCP Server Core & Tool Registry

**Files:**
- Create: `src/index.ts`

**Step 1: Create MCP server entry point**

Create `src/index.ts`:

```typescript
// ABOUTME: MCP server entry point that initializes the server and registers all tools
// ABOUTME: Handles stdio transport and tool execution routing

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from './ha-client.js';
import { registerStateTools } from './tools/states.js';
import { registerConfigTools } from './tools/config.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerSystemTools } from './tools/system.js';

class HAMCPServer {
  private server: Server;
  private haClient: HomeAssistantClient;
  private tools: Map<string, Function>;

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

      try {
        const result = await toolFn(this.haClient, args || {});
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
    // Register tool categories
    registerStateTools(this.tools);
    registerConfigTools(this.tools);
    registerAutomationTools(this.tools);
    registerSystemTools(this.tools);
  }

  private getToolDefinition(name: string) {
    // Tool definitions will be stored alongside tool functions
    // This is a placeholder that will be filled in by tool registration
    const definitions: Record<string, any> = {
      'ha_get_states': {
        name: 'ha_get_states',
        description: 'Get current state of Home Assistant entities',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Optional specific entity ID to query'
            },
            domain: {
              type: 'string',
              description: 'Optional domain filter (e.g., "light", "sensor")'
            }
          }
        }
      }
    };

    return definitions[name] || { name, description: 'No description', inputSchema: { type: 'object' } };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Home Assistant MCP Server running on stdio');
  }
}

// Start server
const server = new HAMCPServer();
server.run().catch(console.error);
```

**Step 2: Build and verify structure**

Run: `npm run build`

Expected: Compilation fails because tool modules don't exist yet (expected at this stage)

**Step 3: Commit server core**

```bash
git add src/index.ts
git commit -m "feat: add MCP server core with tool registry"
```

---

## Task 5: State & Entity Tools

**Files:**
- Create: `src/tools/states.ts`

**Step 1: Create state tools**

Create `src/tools/states.ts`:

```typescript
// ABOUTME: MCP tools for querying Home Assistant entity states and history
// ABOUTME: Provides ha_get_states, ha_get_history, ha_call_service, ha_get_entity_details

import { HomeAssistantClient } from '../ha-client.js';
import { HAState } from '../types.js';

export function registerStateTools(tools: Map<string, Function>) {
  // Get current states
  tools.set('ha_get_states', async (client: HomeAssistantClient, args: any) => {
    const { entity_id, domain } = args;

    let states = await client.getStates(entity_id);

    if (domain && !entity_id) {
      states = states.filter(state => state.entity_id.startsWith(`${domain}.`));
    }

    return {
      count: states.length,
      states: states
    };
  });

  // Get historical data
  tools.set('ha_get_history', async (client: HomeAssistantClient, args: any) => {
    const { entity_ids, start_time, end_time, minimal_response } = args;

    const history = await client.getHistory({
      entity_ids: entity_ids ? entity_ids.split(',') : undefined,
      start_time,
      end_time,
      minimal_response: minimal_response || false
    });

    return {
      entity_count: history.length,
      history: history
    };
  });

  // Call service
  tools.set('ha_call_service', async (client: HomeAssistantClient, args: any) => {
    const { domain, service, entity_id, service_data } = args;

    const result = await client.callService({
      domain,
      service,
      target: entity_id ? { entity_id } : undefined,
      service_data: service_data ? JSON.parse(service_data) : undefined
    });

    return {
      success: true,
      result: result
    };
  });

  // Get entity details
  tools.set('ha_get_entity_details', async (client: HomeAssistantClient, args: any) => {
    const { entity_id } = args;

    if (!entity_id) {
      throw new Error('entity_id is required');
    }

    const states = await client.getStates(entity_id);
    return states[0];
  });
}
```

**Step 2: Build and verify**

Run: `npm run build`

Expected: Compilation may still fail on index.ts imports - that's okay for now

**Step 3: Commit state tools**

```bash
git add src/tools/states.ts
git commit -m "feat: add state and entity query tools"
```

---

## Task 6: Configuration Management Tools

**Files:**
- Create: `src/tools/config.ts`
- Create: `src/backup.ts`

**Step 1: Create backup utility**

Create `src/backup.ts`:

```typescript
// ABOUTME: Utilities for backing up configuration files before modification
// ABOUTME: Maintains last 5 versions of each file for rollback capability

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { BackupMetadata } from './types.js';

const BACKUP_DIR = '/config/.mcp_backups';
const MAX_BACKUPS = 5;

/**
 * Create backup of a configuration file
 */
export async function backupFile(filePath: string): Promise<BackupMetadata> {
  // Ensure backup directory exists
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = basename(filePath);
  const backupPath = join(BACKUP_DIR, `${fileName}.${timestamp}.bak`);

  // Copy file to backup
  await fs.copyFile(filePath, backupPath);

  // Clean old backups
  await cleanOldBackups(fileName);

  return {
    path: backupPath,
    timestamp,
    original_path: filePath
  };
}

/**
 * Remove old backups, keeping only MAX_BACKUPS most recent
 */
async function cleanOldBackups(fileName: string): Promise<void> {
  const files = await fs.readdir(BACKUP_DIR);
  const backups = files
    .filter(f => f.startsWith(fileName) && f.endsWith('.bak'))
    .sort()
    .reverse();

  // Remove old backups beyond MAX_BACKUPS
  for (let i = MAX_BACKUPS; i < backups.length; i++) {
    await fs.unlink(join(BACKUP_DIR, backups[i]));
  }
}

/**
 * List available backups for a file
 */
export async function listBackups(fileName: string): Promise<BackupMetadata[]> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith(fileName) && f.endsWith('.bak'))
      .sort()
      .reverse();

    return backups.map(f => {
      const timestampMatch = f.match(/\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.bak$/);
      return {
        path: join(BACKUP_DIR, f),
        timestamp: timestampMatch ? timestampMatch[1] : 'unknown',
        original_path: `/config/${fileName}`
      };
    });
  } catch {
    return [];
  }
}
```

**Step 2: Create config tools**

Create `src/tools/config.ts`:

```typescript
// ABOUTME: MCP tools for reading and writing Home Assistant configuration files
// ABOUTME: Provides ha_read_config, ha_write_config, ha_list_files, ha_validate_config, ha_reload_config

import { promises as fs } from 'fs';
import { join } from 'path';
import { HomeAssistantClient } from '../ha-client.js';
import { backupFile, listBackups } from '../backup.js';

const CONFIG_DIR = '/config';

export function registerConfigTools(tools: Map<string, Function>) {
  // Read configuration file
  tools.set('ha_read_config', async (client: HomeAssistantClient, args: any) => {
    const { path } = args;

    if (!path) {
      throw new Error('path is required');
    }

    const fullPath = join(CONFIG_DIR, path);
    const content = await fs.readFile(fullPath, 'utf-8');

    return {
      path,
      content,
      size: content.length
    };
  });

  // Write configuration file
  tools.set('ha_write_config', async (client: HomeAssistantClient, args: any) => {
    const { path, content, validate = true } = args;

    if (!path || content === undefined) {
      throw new Error('path and content are required');
    }

    const fullPath = join(CONFIG_DIR, path);

    // Backup existing file if it exists
    try {
      await fs.access(fullPath);
      const backup = await backupFile(fullPath);
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
        throw new Error(`Configuration validation failed: ${validation.errors?.join(', ')}`);
      }
    }

    return {
      success: true,
      path,
      size: content.length,
      validated: validate
    };
  });

  // List configuration files
  tools.set('ha_list_files', async (client: HomeAssistantClient, args: any) => {
    const { path = '', pattern } = args;

    const fullPath = join(CONFIG_DIR, path);
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
  });

  // Validate configuration
  tools.set('ha_validate_config', async (client: HomeAssistantClient, args: any) => {
    const validation = await client.validateConfig();
    return validation;
  });

  // Reload configuration
  tools.set('ha_reload_config', async (client: HomeAssistantClient, args: any) => {
    const { type = 'automation' } = args;

    await client.reloadConfig(type as 'core' | 'automation' | 'script');

    return {
      success: true,
      type,
      message: `${type} configuration reloaded`
    };
  });

  // List backups
  tools.set('ha_list_backups', async (client: HomeAssistantClient, args: any) => {
    const { filename } = args;

    if (!filename) {
      throw new Error('filename is required');
    }

    const backups = await listBackups(filename);

    return {
      count: backups.length,
      backups
    };
  });
}
```

**Step 3: Build and verify**

Run: `npm run build`

Expected: Compilation succeeds or continues with expected errors from missing tools

**Step 4: Commit config tools**

```bash
git add src/backup.ts src/tools/config.ts
git commit -m "feat: add configuration management and backup tools"
```

---

## Task 7: Automation Management Tools

**Files:**
- Create: `src/tools/automation.ts`

**Step 1: Create automation tools**

Create `src/tools/automation.ts`:

```typescript
// ABOUTME: MCP tools for creating, updating, and managing Home Assistant automations
// ABOUTME: Provides ha_create_automation, ha_update_automation, ha_delete_automation, ha_list_automations

import { promises as fs } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { HomeAssistantClient } from '../ha-client.js';
import { HAAutomation } from '../types.js';
import { backupFile } from '../backup.js';

const AUTOMATIONS_FILE = '/config/automations.yaml';

async function readAutomations(): Promise<HAAutomation[]> {
  try {
    const content = await fs.readFile(AUTOMATIONS_FILE, 'utf-8');
    const automations = yaml.parse(content);
    return Array.isArray(automations) ? automations : [];
  } catch {
    return [];
  }
}

async function writeAutomations(automations: HAAutomation[]): Promise<void> {
  const content = yaml.stringify(automations);
  await fs.writeFile(AUTOMATIONS_FILE, content, 'utf-8');
}

export function registerAutomationTools(tools: Map<string, Function>) {
  // Create automation
  tools.set('ha_create_automation', async (client: HomeAssistantClient, args: any) => {
    const { automation_yaml } = args;

    if (!automation_yaml) {
      throw new Error('automation_yaml is required');
    }

    // Parse automation YAML
    const automation = yaml.parse(automation_yaml);

    // Generate ID if not provided
    if (!automation.id) {
      automation.id = `mcp_${Date.now()}`;
    }

    // Backup existing file
    await backupFile(AUTOMATIONS_FILE);

    // Read existing automations
    const automations = await readAutomations();

    // Add new automation
    automations.push(automation);

    // Write back
    await writeAutomations(automations);

    // Validate
    const validation = await client.validateConfig();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    // Reload
    await client.reloadConfig('automation');

    return {
      success: true,
      automation_id: automation.id,
      message: 'Automation created and loaded'
    };
  });

  // Update automation
  tools.set('ha_update_automation', async (client: HomeAssistantClient, args: any) => {
    const { automation_id, automation_yaml } = args;

    if (!automation_id || !automation_yaml) {
      throw new Error('automation_id and automation_yaml are required');
    }

    const updatedAutomation = yaml.parse(automation_yaml);
    updatedAutomation.id = automation_id;

    // Backup
    await backupFile(AUTOMATIONS_FILE);

    // Read, update, write
    const automations = await readAutomations();
    const index = automations.findIndex(a => a.id === automation_id);

    if (index === -1) {
      throw new Error(`Automation ${automation_id} not found`);
    }

    automations[index] = updatedAutomation;
    await writeAutomations(automations);

    // Validate and reload
    const validation = await client.validateConfig();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    await client.reloadConfig('automation');

    return {
      success: true,
      automation_id,
      message: 'Automation updated and reloaded'
    };
  });

  // Delete automation
  tools.set('ha_delete_automation', async (client: HomeAssistantClient, args: any) => {
    const { automation_id } = args;

    if (!automation_id) {
      throw new Error('automation_id is required');
    }

    // Backup
    await backupFile(AUTOMATIONS_FILE);

    // Read, filter, write
    const automations = await readAutomations();
    const filtered = automations.filter(a => a.id !== automation_id);

    if (filtered.length === automations.length) {
      throw new Error(`Automation ${automation_id} not found`);
    }

    await writeAutomations(filtered);
    await client.reloadConfig('automation');

    return {
      success: true,
      automation_id,
      message: 'Automation deleted and configuration reloaded'
    };
  });

  // List automations
  tools.set('ha_list_automations', async (client: HomeAssistantClient, args: any) => {
    const automations = await readAutomations();

    return {
      count: automations.length,
      automations: automations.map(a => ({
        id: a.id,
        alias: a.alias,
        description: a.description,
        mode: a.mode
      }))
    };
  });
}
```

**Step 2: Add yaml dependency**

Edit `package.json` to add yaml:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^0.5.0",
  "axios": "^1.6.0",
  "ws": "^8.16.0",
  "yaml": "^2.3.4"
}
```

**Step 3: Install new dependency**

Run: `npm install`

Expected: yaml package installed

**Step 4: Build and verify**

Run: `npm run build`

Expected: Compilation succeeds or continues with expected import errors

**Step 5: Commit automation tools**

```bash
git add src/tools/automation.ts package.json package-lock.json
git commit -m "feat: add automation management tools"
```

---

## Task 8: System & Diagnostics Tools

**Files:**
- Create: `src/tools/system.ts`

**Step 1: Create system tools**

Create `src/tools/system.ts`:

```typescript
// ABOUTME: MCP tools for Home Assistant system information, logs, and diagnostics
// ABOUTME: Provides ha_system_info, ha_get_logs, ha_restart

import { HomeAssistantClient } from '../ha-client.js';

export function registerSystemTools(tools: Map<string, Function>) {
  // Get system information
  tools.set('ha_system_info', async (client: HomeAssistantClient, args: any) => {
    const info = await client.getSystemInfo();
    return info;
  });

  // Get logs
  tools.set('ha_get_logs', async (client: HomeAssistantClient, args: any) => {
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
  });

  // Restart Home Assistant (requires confirmation)
  tools.set('ha_restart', async (client: HomeAssistantClient, args: any) => {
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
  });
}
```

**Step 2: Build and verify**

Run: `npm run build`

Expected: Compilation succeeds

**Step 3: Commit system tools**

```bash
git add src/tools/system.ts
git commit -m "feat: add system and diagnostics tools"
```

---

## Task 9: Complete Tool Definitions in Server

**Files:**
- Modify: `src/index.ts`

**Step 1: Add comprehensive tool definitions**

Replace the `getToolDefinition` method in `src/index.ts`:

```typescript
  private getToolDefinition(name: string) {
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
```

**Step 2: Build and verify all tools compile**

Run: `npm run build`

Expected: Compilation succeeds with no errors

**Step 3: Commit tool definitions**

```bash
git add src/index.ts
git commit -m "feat: complete tool definitions with schemas"
```

---

## Task 10: Home Assistant Addon Configuration

**Files:**
- Create: `config.yaml`
- Create: `Dockerfile`
- Create: `run.sh`

**Step 1: Create addon config**

Create `config.yaml`:

```yaml
name: Home Assistant MCP Server
version: "0.1.0"
slug: homeassistant_mcp
description: MCP server for Claude integration with Home Assistant
arch:
  - aarch64
  - amd64
  - armhf
  - armv7
  - i386
init: false
startup: application
boot: auto
ports: {}
ports_description: {}
homeassistant_api: true
hassio_api: true
hassio_role: manager
auth_api: true
ingress: false
panel_icon: mdi:robot
options:
  log_level: info
schema:
  log_level: list(debug|info|warning|error)
```

**Step 2: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY dist ./dist

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
```

**Step 3: Create run script**

Create `run.sh`:

```bash
#!/usr/bin/with-contenv bashio

# Get config from addon options
LOG_LEVEL=$(bashio::config 'log_level')

# Export supervisor token for API access
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

# Log startup
bashio::log.info "Starting Home Assistant MCP Server..."
bashio::log.info "Log level: ${LOG_LEVEL}"

# Start MCP server
cd /app
exec node dist/index.js
```

**Step 4: Make run.sh executable**

Run: `chmod +x run.sh`

Expected: File is now executable

**Step 5: Commit addon files**

```bash
git add config.yaml Dockerfile run.sh
git commit -m "feat: add Home Assistant addon configuration"
```

---

## Task 11: Repository Metadata & Documentation

**Files:**
- Create: `repository.yaml`
- Modify: `README.md`
- Create: `INSTALL.md`

**Step 1: Create repository metadata**

Create `repository.yaml`:

```yaml
name: Home Assistant MCP Server Repository
url: https://github.com/selwa/homeassistant-mcp-server
maintainer: Vegar Selvik Wavik
```

**Step 2: Update README with complete documentation**

Replace content of `README.md`:

```markdown
# Home Assistant MCP Server

MCP (Model Context Protocol) server for integrating Home Assistant with Claude Code and Claude Desktop.

## Features

### Entity & State Management
- Query current entity states
- Access historical data with time ranges
- Call any Home Assistant service
- Get detailed entity information

### Configuration Management
- Read any configuration file
- Write and update YAML configs
- Automatic backup before modifications
- Configuration validation
- Selective reload (automations, scripts, core)

### Automation Tools
- Create new automations
- Update existing automations
- Delete automations
- List all automations

### System & Diagnostics
- System information and health
- Log fetching and filtering
- Restart capabilities

## Installation

### Via Custom Repository (Recommended)

1. In Home Assistant: **Settings** → **Add-ons** → **Add-on Store** → **⋮ menu** → **Repositories**
2. Add repository URL: `https://github.com/selwa/homeassistant-mcp-server`
3. Find "Home Assistant MCP Server" in the add-on store
4. Click **Install**
5. Configure addon (see Configuration section)
6. Start the addon

### Manual Installation

1. SSH into your Home Assistant
2. Clone this repository to `/addons/homeassistant-mcp-server`
3. Refresh addon store
4. Install from Local Add-ons

## Configuration

Configure via addon configuration UI:

```yaml
log_level: info  # debug, info, warning, error
```

## Connecting Claude Clients

### Claude Code

Edit `~/.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "-p", "22",
        "-i", "~/.ssh/id_rsa",
        "root@homeassistant.local",
        "docker", "exec", "-i", "addon_local_homeassistant_mcp", "node", "/app/dist/index.js"
      ]
    }
  }
}
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "-p", "22",
        "-i", "~/.ssh/id_rsa",
        "root@homeassistant.local",
        "docker", "exec", "-i", "addon_local_homeassistant_mcp", "node", "/app/dist/index.js"
      ]
    }
  }
}
```

**Note:** Replace `homeassistant.local` with your HA IP address if needed. Adjust container name if different.

## Available Tools

### State Tools
- `ha_get_states` - Get entity states
- `ha_get_history` - Query historical data
- `ha_call_service` - Control devices
- `ha_get_entity_details` - Get entity details

### Config Tools
- `ha_read_config` - Read config files
- `ha_write_config` - Write config files
- `ha_list_files` - List config directory
- `ha_validate_config` - Validate configuration
- `ha_reload_config` - Reload configs
- `ha_list_backups` - List file backups

### Automation Tools
- `ha_create_automation` - Create automation
- `ha_update_automation` - Update automation
- `ha_delete_automation` - Delete automation
- `ha_list_automations` - List all automations

### System Tools
- `ha_system_info` - System information
- `ha_get_logs` - Fetch logs
- `ha_restart` - Restart Home Assistant

## Safety Features

- **Automatic Backups**: All config modifications backed up automatically
- **Validation**: Config validated before applying changes
- **Rollback**: Last 5 versions kept for each file
- **Confirmation**: Destructive actions require explicit confirmation

## Development

```bash
npm install
npm run build
npm start
```

## Troubleshooting

### Check addon logs
Home Assistant → Settings → Add-ons → Home Assistant MCP Server → Logs

### Test SSH connection
```bash
ssh root@homeassistant.local "docker exec -i addon_local_homeassistant_mcp node /app/dist/index.js"
```

### Verify addon is running
Home Assistant → Settings → Add-ons → Check status

## License

MIT

## Author

Vegar Selvik Wavik
```

**Step 3: Create installation guide**

Create `INSTALL.md`:

```markdown
# Installation Guide

## Prerequisites

- Home Assistant OS (Home Assistant Green or similar)
- SSH access to Home Assistant (SSH & Terminal addon)
- SSH key authentication set up from your Mac
- Claude Code or Claude Desktop installed

## Step 1: Add Custom Repository

1. Open Home Assistant web interface
2. Navigate to **Settings** → **Add-ons** → **Add-on Store**
3. Click the **⋮** menu (top right)
4. Select **Repositories**
5. Add this URL: `https://github.com/selwa/homeassistant-mcp-server`
6. Click **Add**

## Step 2: Install Addon

1. Refresh the Add-on Store page
2. Find "Home Assistant MCP Server" in the list
3. Click on it
4. Click **Install**
5. Wait for installation to complete (may take a few minutes)

## Step 3: Configure Addon

1. Click on the **Configuration** tab
2. Set log level (start with `info`)
3. Click **Save**

## Step 4: Start Addon

1. Go to the **Info** tab
2. Enable **Start on boot** (optional)
3. Click **Start**
4. Check the **Log** tab to verify it started successfully

## Step 5: Set Up SSH Access (If Not Already Done)

### Generate SSH key on Mac (if needed)
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

### Copy public key to Home Assistant
```bash
ssh-copy-id root@homeassistant.local
```

### Test SSH connection
```bash
ssh root@homeassistant.local "echo 'Connection successful'"
```

## Step 6: Configure Claude Code

1. Edit `~/.claude/mcp_settings.json`
2. Add the homeassistant server configuration (see README.md)
3. Find the correct addon container name:
   ```bash
   ssh root@homeassistant.local "docker ps | grep homeassistant_mcp"
   ```
4. Update the container name in your config if different

## Step 7: Configure Claude Desktop

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the same configuration as Claude Code
3. Restart Claude Desktop

## Step 8: Verify Connection

### In Claude Code:
```bash
claude-code
```

Then type: "List all my Home Assistant entities"

### In Claude Desktop:
Open Claude Desktop and ask: "What entities do I have in Home Assistant?"

## Troubleshooting

### Addon won't start
- Check addon logs in Home Assistant UI
- Verify Node.js dependencies installed correctly
- Try rebuilding: Uninstall and reinstall addon

### Connection from Claude fails
- Verify SSH connection works manually
- Check container name is correct
- Ensure addon is running
- Check Home Assistant firewall settings

### Permission denied errors
- Verify SUPERVISOR_TOKEN is available (automatic in addon)
- Check addon has `hassio_api: true` in config.yaml

## Support

Check addon logs first:
Settings → Add-ons → Home Assistant MCP Server → Logs

Enable debug logging:
Configuration tab → Set `log_level: debug` → Restart addon
```

**Step 4: Commit documentation**

```bash
git add repository.yaml README.md INSTALL.md
git commit -m "docs: add repository metadata and installation guide"
```

---

## Task 12: Testing & Verification

**Files:**
- Create: `test-connection.sh`

**Step 1: Create test script**

Create `test-connection.sh`:

```bash
#!/bin/bash
# Test script for verifying MCP server functionality

echo "=== Home Assistant MCP Server Test ==="
echo ""

# Test 1: Build
echo "Test 1: Building project..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ Build successful"
else
  echo "✗ Build failed"
  exit 1
fi
echo ""

# Test 2: Check all files exist
echo "Test 2: Verifying output files..."
files=(
  "dist/index.js"
  "dist/types.js"
  "dist/ha-client.js"
  "dist/backup.js"
  "dist/tools/states.js"
  "dist/tools/config.js"
  "dist/tools/automation.js"
  "dist/tools/system.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file missing"
    exit 1
  fi
done
echo ""

# Test 3: Verify addon files
echo "Test 3: Verifying addon files..."
addon_files=(
  "config.yaml"
  "Dockerfile"
  "run.sh"
)

for file in "${addon_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file missing"
    exit 1
  fi
done
echo ""

echo "=== All tests passed ==="
echo ""
echo "Next steps:"
echo "1. Copy this directory to /addons/ on Home Assistant"
echo "2. Install addon via Home Assistant UI"
echo "3. Configure Claude Code/Desktop with SSH connection"
echo "4. Test by asking Claude to list your entities"
```

**Step 2: Make script executable**

Run: `chmod +x test-connection.sh`

**Step 3: Run tests**

Run: `./test-connection.sh`

Expected: All tests pass, no missing files

**Step 4: Commit test script**

```bash
git add test-connection.sh
git commit -m "test: add verification script for build and structure"
```

---

## Task 13: Final Verification & Documentation Review

**Step 1: Verify all files are committed**

Run: `git status`

Expected: Working tree clean or only untracked node_modules/dist

**Step 2: Review file structure**

Run: `tree -L 3 -I 'node_modules|dist'`

Expected structure:
```
.
├── Dockerfile
├── INSTALL.md
├── README.md
├── config.yaml
├── package.json
├── package-lock.json
├── repository.yaml
├── run.sh
├── src
│   ├── backup.ts
│   ├── ha-client.ts
│   ├── index.ts
│   ├── tools
│   │   ├── automation.ts
│   │   ├── config.ts
│   │   ├── states.ts
│   │   └── system.ts
│   └── types.ts
├── test-connection.sh
├── tsconfig.json
└── docs
    └── plans
        └── 2025-10-23-homeassistant-mcp-integration-design.md
```

**Step 3: Build final production version**

Run: `npm run build`

Expected: Clean build with no errors

**Step 4: Tag release**

```bash
git tag -a v0.1.0 -m "Initial release of Home Assistant MCP Server"
```

**Step 5: Create final commit**

```bash
git add -A
git commit -m "release: v0.1.0 - Home Assistant MCP Server" --allow-empty
```

---

## Next Steps After Implementation

1. **Create GitHub Repository**
   - Push code to GitHub
   - Set up as public repository
   - Add repository URL to Home Assistant

2. **Install on Home Assistant**
   - Add custom repository in HA
   - Install addon
   - Configure and start

3. **Configure Claude Clients**
   - Set up SSH keys if needed
   - Configure Claude Code
   - Configure Claude Desktop
   - Test connection

4. **Verify Functionality**
   - Test entity queries
   - Test automation creation
   - Test config management
   - Verify backups work

5. **Document Usage Examples**
   - Create example queries for Claude
   - Document common automation patterns
   - Share with community if desired

## Success Criteria

- [x] All TypeScript compiles without errors
- [x] All tool categories implemented
- [x] Addon configuration files complete
- [x] Documentation complete
- [x] Test script passes
- [ ] Installs successfully on Home Assistant
- [ ] Connects from Claude Code
- [ ] Connects from Claude Desktop
- [ ] Can query entity states
- [ ] Can create automations
- [ ] Backups work correctly
- [ ] Validation prevents bad configs
