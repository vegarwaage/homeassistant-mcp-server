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
  HAValidationResult,
  RetryConfig
} from './types.js';

const execAsync = promisify(exec);

export interface HomeAssistantClientConfig {
  baseUrl?: string;
  token?: string;
  maxConcurrent?: number;
  retry?: RetryConfig;
}

export class HomeAssistantClient {
  private apiClient: AxiosInstance;
  private supervisorClient: AxiosInstance;
  private baseUrl: string;
  private token: string;
  private maxConcurrent: number;
  private activeRequests: number;
  private requestQueue: Array<() => void>;
  private retryConfig: RetryConfig;

  constructor(baseUrlOrConfig: string | HomeAssistantClientConfig = 'http://homeassistant:8123', token?: string) {
    // Handle both old and new constructor signatures
    if (typeof baseUrlOrConfig === 'string') {
      this.baseUrl = baseUrlOrConfig;
      this.token = token || process.env.SUPERVISOR_TOKEN || '';
      this.maxConcurrent = Infinity;
      this.retryConfig = {};
    } else {
      this.baseUrl = baseUrlOrConfig.baseUrl || 'http://homeassistant:8123';
      this.token = baseUrlOrConfig.token || process.env.SUPERVISOR_TOKEN || '';
      this.maxConcurrent = baseUrlOrConfig.maxConcurrent || Infinity;
      this.retryConfig = baseUrlOrConfig.retry || {};
    }

    this.activeRequests = 0;
    this.requestQueue = [];

    // REST API client
    this.apiClient = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Supervisor API client
    this.supervisorClient = axios.create({
      baseURL: `${this.baseUrl}`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Acquire a slot for making a request
   */
  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    // Wait in queue
    return new Promise<void>((resolve) => {
      this.requestQueue.push(resolve);
    });
  }

  /**
   * Release a slot after completing a request
   */
  private releaseSlot(): void {
    this.activeRequests--;

    // Process next queued request
    const next = this.requestQueue.shift();
    if (next) {
      this.activeRequests++;
      next();
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate backoff delay with exponential increase
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.retryConfig.baseDelay || 1000;
    const maxDelay = this.retryConfig.maxDelay || 30000;
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Wrap a function with retry logic
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = this.retryConfig.maxRetries || 0;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Only retry on network errors or 5xx server errors
        const shouldRetry =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          (error.response && error.response.status >= 500);

        if (!shouldRetry) {
          throw error;
        }

        // Wait before retrying
        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute an HTTP request with connection pooling
   */
  private async executeRequest<T>(
    method: 'get' | 'post' | 'delete' | 'patch',
    url: string,
    data?: any,
    useSupervisor = false
  ): Promise<T> {
    await this.acquireSlot();

    try {
      return await this.withRetry(async () => {
        // Auto-detect Supervisor endpoints
        const isSupervisorEndpoint = url.startsWith('/hassio/') || url.startsWith('/supervisor/');
        const client = (useSupervisor || isSupervisorEndpoint) ? this.supervisorClient : this.apiClient;
        let response;
        switch (method) {
          case 'get':
            response = await client.get<T>(url);
            break;
          case 'post':
            response = await client.post<T>(url, data);
            break;
          case 'delete':
            response = await client.delete<T>(url);
            break;
          case 'patch':
            response = await client.patch<T>(url, data);
            break;
        }
        return response.data;
      });
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Generic GET request
   */
  async get<T = any>(url: string): Promise<T> {
    return this.executeRequest<T>('get', url);
  }

  /**
   * Generic POST request
   */
  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.executeRequest<T>('post', url, data);
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(url: string): Promise<T> {
    return this.executeRequest<T>('delete', url);
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(url: string, data?: any): Promise<T> {
    return this.executeRequest<T>('patch', url, data);
  }

  /**
   * Supervisor GET request
   */
  private async supervisorGet<T = any>(url: string): Promise<T> {
    return this.executeRequest<T>('get', url, undefined, true);
  }

  /**
   * Supervisor POST request
   */
  private async supervisorPost<T = any>(url: string, data?: any): Promise<T> {
    return this.executeRequest<T>('post', url, data, true);
  }

  /**
   * GET request that returns binary data (ArrayBuffer)
   */
  private async getBinary(url: string): Promise<ArrayBuffer> {
    await this.acquireSlot();

    try {
      const response = await this.apiClient.get(url, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Get all entity states or filter by entity_id
   */
  async getStates(entityId?: string): Promise<HAState[]> {
    if (entityId) {
      const state = await this.get<HAState>(`/states/${entityId}`);
      return [state];
    }
    return this.get<HAState[]>('/states');
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
    if (query.no_attributes) {
      params.append('no_attributes', 'true');
    }

    const endpoint = query.start_time
      ? `/history/period/${query.start_time}`
      : '/history/period';

    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    return this.get<HAState[][]>(url);
  }

  /**
   * Call a Home Assistant service
   * @param serviceCall - Service call parameters
   * @returns Service result, or response data if return_response is true (HA 2024.8+)
   */
  async callService(serviceCall: HAServiceCall): Promise<any> {
    const { domain, service, service_data, target, return_response } = serviceCall;
    const data = { ...service_data, ...target };
    const url = return_response
      ? `/services/${domain}/${service}?return_response`
      : `/services/${domain}/${service}`;
    return this.post(url, data);
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<HASystemInfo> {
    return this.get<HASystemInfo>('/config');
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
    return this.post('/template', { template });
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
    return this.post('/conversation/process', params);
  }

  /**
   * Get supervisor information (supervisor, core, os, or host)
   */
  async getSupervisorInfo(component?: 'supervisor' | 'core' | 'os' | 'host'): Promise<any> {
    if (component) {
      try {
        return await this.supervisorGet(`/supervisor/${component}/info`);
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
        results[comp] = await this.supervisorGet(`/supervisor/${comp}/info`);
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
    const config = await this.get<HASystemInfo>('/config');
    return config.components || [];
  }

  /**
   * Get system diagnostics and health information
   */
  async getDiagnostics(): Promise<any> {
    try {
      // Try supervisor resolution info first
      return await this.supervisorGet('/supervisor/resolution/info');
    } catch (error: any) {
      // Fallback to core info if supervisor not available
      try {
        const coreInfo = await this.get('/config/core');
        return {
          fallback: true,
          core_info: coreInfo,
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
      const arrayBuffer = await this.getBinary(`/camera_proxy/${entityId}`);
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
    return this.get('/energy/info');
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

    return this.post('/history/statistics', data);
  }

  /**
   * Fire a custom event with optional data payload
   */
  async fireEvent(eventType: string, eventData?: Record<string, any>): Promise<void> {
    await this.post(`/events/${eventType}`, eventData || {});
  }

  /**
   * Get all active event listeners and their counts
   */
  async getEventListeners(): Promise<any[]> {
    return this.get('/events');
  }

  /**
   * Get all calendar entities
   */
  async listCalendars(): Promise<HAState[]> {
    const allStates = await this.getStates();
    return allStates.filter(state => state.entity_id.startsWith('calendar.'));
  }

  /**
   * Get calendar events for a specific calendar entity within a date range
   */
  async getCalendarEvents(params: {
    entityId: string;
    start: string;
    end: string;
  }): Promise<any[]> {
    const { entityId, start, end } = params;

    return this.get(`/calendars/${entityId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  }

  /**
   * Get logbook entries with optional filters
   */
  async getLogbook(params: {
    start_time?: string;
    end_time?: string;
    entity_id?: string;
    limit?: number;
  }): Promise<any[]> {
    const { start_time, end_time, entity_id, limit } = params;

    const endpoint = start_time
      ? `/logbook/${start_time}`
      : '/logbook';

    const queryParts: string[] = [];
    if (end_time) queryParts.push(`end_time=${encodeURIComponent(end_time)}`);
    if (entity_id) queryParts.push(`entity=${encodeURIComponent(entity_id)}`);

    const url = queryParts.length > 0 ? `${endpoint}?${queryParts.join('&')}` : endpoint;
    const entries = await this.get(url);
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * List available blueprints by domain
   */
  async listBlueprints(domain: 'automation' | 'script'): Promise<any> {
    return this.get(`/blueprint/${domain}`);
  }

  /**
   * Import blueprint from URL
   */
  async importBlueprint(url: string): Promise<any> {
    return this.post('/blueprint/import', { url });
  }

  /**
   * Send notification to mobile app or service
   */
  async sendNotification(params: {
    service: string;
    title?: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const { service, title, message, data } = params;

    const serviceData: any = {
      message
    };

    if (title) {
      serviceData.title = title;
    }

    if (data) {
      serviceData.data = data;
    }

    await this.callService({
      domain: 'notify',
      service,
      service_data: serviceData
    });
  }

  /**
   * Get list of loaded components (simpler than getSystemInfo)
   */
  async getComponents(): Promise<string[]> {
    return this.get<string[]>('/components');
  }

  /**
   * Get current session error log
   */
  async getErrorLog(): Promise<string> {
    return this.get<string>('/error_log');
  }

  /**
   * Check configuration via REST API (doesn't require CLI)
   */
  async checkConfigRest(): Promise<HAValidationResult> {
    try {
      const result = await this.post<{ result: string; errors: string | null }>('/config/core/check_config');
      return {
        valid: result.result === 'valid',
        errors: result.errors ? [result.errors] : undefined
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message || 'Configuration check failed']
      };
    }
  }
}
