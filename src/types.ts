// ABOUTME: Type definitions for Home Assistant API responses and MCP tool parameters
// ABOUTME: Defines interfaces for entities, states, configs, and tool inputs/outputs

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
 * Backup metadata
 */
export interface BackupMetadata {
  path: string;
  timestamp: string;
  original_path: string;
}

/**
 * MCP tool definition with schema and handler
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  handler: (client: any, args: any) => Promise<any>;
}
