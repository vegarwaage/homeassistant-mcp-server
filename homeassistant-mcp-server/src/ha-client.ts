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

  constructor(baseUrl: string = 'http://homeassistant:8123', token: string = process.env.SUPERVISOR_TOKEN || '') {
    this.baseUrl = baseUrl;
    this.token = token;

    // REST API client
    this.apiClient = axios.create({
      baseURL: `${baseUrl}/api`,
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
    const params = new URLSearchParams();

    if (query.entity_ids?.length) {
      params.append('filter_entity_id', query.entity_ids.join(','));
    }
    if (query.end_time) {
      params.append('end_time', query.end_time);
    }
    if (query.minimal_response) {
      params.append('minimal_response', 'true');
    }
    if (query.significant_changes_only) {
      params.append('significant_changes_only', 'true');
    }

    const endpoint = query.start_time
      ? `/api/history/period/${query.start_time}`
      : '/api/history/period';

    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    const response = await fetch(`${this.baseUrl}${url}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`History request failed: ${response.statusText}`);
    }

    return response.json() as Promise<HAState[][]>;
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
      // Log stderr as warning but don't treat it as an error
      // Many CLI tools write informational messages to stderr
      if (stderr) {
        console.error(`CLI warning: ${stderr}`);
      }
      return stdout;
    } catch (error: any) {
      const errorMsg = error.stderr ? `${error.message}\nDetails: ${error.stderr}` : error.message;
      throw new Error(`CLI command failed: ${errorMsg}`);
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

  /**
   * Render a Jinja2 template using Home Assistant's template API
   */
  async renderTemplate(template: string): Promise<any> {
    const response = await this.apiClient.post('/template', { template });
    return response.data;
  }

  /**
   * Process natural language with Home Assistant's conversation/intent API
   */
  async processConversation(params: {
    text: string;
    conversation_id?: string;
    agent_id?: string;
    language?: string;
  }): Promise<any> {
    const response = await this.apiClient.post('/conversation/process', params);
    return response.data;
  }

  /**
   * Get supervisor information (supervisor, core, os, or host)
   */
  async getSupervisorInfo(component?: 'supervisor' | 'core' | 'os' | 'host'): Promise<any> {
    if (component) {
      try {
        const response = await this.supervisorClient.get(`/supervisor/${component}/info`);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404 || error.code === 'ECONNREFUSED') {
          throw new Error(`Supervisor ${component} API not available. This may not be a Supervisor installation.`);
        }
        throw error;
      }
    }

    // Get all components
    const results: any = {};
    const components = ['supervisor', 'core', 'os', 'host'];

    for (const comp of components) {
      try {
        const response = await this.supervisorClient.get(`/supervisor/${comp}/info`);
        results[comp] = response.data;
      } catch (error: any) {
        results[comp] = { error: `Not available: ${error.message}` };
      }
    }

    return results;
  }

  /**
   * Get list of loaded integrations/components
   */
  async getIntegrations(): Promise<string[]> {
    const response = await this.apiClient.get<string[]>('/config/components');
    return response.data;
  }

  /**
   * Get system diagnostics and health information
   */
  async getDiagnostics(): Promise<any> {
    try {
      // Try supervisor resolution info first
      const response = await this.supervisorClient.get('/supervisor/resolution/info');
      return response.data;
    } catch (error: any) {
      // Fallback to core info if supervisor not available
      try {
        const response = await this.apiClient.get('/config/core');
        return {
          fallback: true,
          core_info: response.data,
          message: 'Supervisor diagnostics not available, showing core info'
        };
      } catch (fallbackError: any) {
        throw new Error(`Diagnostics not available: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Get camera snapshot URL or base64 data
   */
  async getCameraSnapshot(entityId: string, format: 'url' | 'base64' = 'url'): Promise<string> {
    if (format === 'url') {
      // Return the camera proxy URL
      return `${this.baseUrl}/api/camera_proxy/${entityId}`;
    } else {
      // Fetch the image and return as base64
      const response = await fetch(`${this.baseUrl}/api/camera_proxy/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch camera snapshot: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    }
  }

  /**
   * Get energy dashboard data
   */
  async getEnergyData(params: {
    period?: 'hour' | 'day' | 'week' | 'month';
    start_time?: string;
    end_time?: string;
  }): Promise<any> {
    // Home Assistant energy endpoint
    const response = await this.apiClient.get('/energy/info');
    return response.data;
  }

  /**
   * Get long-term statistics for entities
   */
  async getStatistics(params: {
    entity_ids: string[];
    start_time?: string;
    end_time?: string;
    period?: 'hour' | 'day' | 'month';
  }): Promise<any> {
    const { entity_ids, start_time, end_time, period = 'hour' } = params;

    const data: any = {
      statistic_ids: entity_ids,
      period
    };

    if (start_time) {
      data.start_time = start_time;
    }
    if (end_time) {
      data.end_time = end_time;
    }

    const response = await this.apiClient.post('/history/statistics', data);
    return response.data;
  }
}
