// ABOUTME: WebSocket client for Home Assistant bulk operations
// ABOUTME: Efficient multi-command execution over single connection with coalesce_messages support

import WebSocket from 'ws';
import type { HAConfig } from './types.js';
import type { WSMessage, WSCommand, WSResult, BulkResult, WSTargetResolution, WSTargetResolutionResult, WSSupportedFeatures } from './websocket-types.js';

export interface WebSocketClientOptions {
  /** Enable message coalescing for batched responses (reduces overhead) */
  coalesceMessages?: boolean;
}

export class WebSocketClient {
  private baseUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private messageId: number = 1;
  private pendingRequests: Map<number, (result: any) => void> = new Map();
  private connected: boolean = false;
  private options: WebSocketClientOptions;
  private haVersion: string = '';

  constructor(config: HAConfig, options: WebSocketClientOptions = {}) {
    this.baseUrl = config.baseUrl.replace(/^http/, 'ws');
    this.token = config.token;
    this.options = options;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.baseUrl}/api/websocket`);

      this.ws.on('open', () => {
        // WebSocket protocol requires auth after connection
      });

      this.ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'auth_required') {
          this.haVersion = message.ha_version || '';
          this.ws!.send(JSON.stringify({
            type: 'auth',
            access_token: this.token,
          }));
        } else if (message.type === 'auth_ok') {
          this.connected = true;
          // Declare supported features after successful auth
          if (this.options.coalesceMessages) {
            this.declareSupportedFeatures({ coalesce_messages: 1 });
          }
          resolve();
        } else if (message.type === 'result') {
          const callback = this.pendingRequests.get(message.id);
          if (callback) {
            callback(message);
            this.pendingRequests.delete(message.id);
          }
        }
      });

      this.ws.on('error', reject);
    });
  }

  /**
   * Declare supported features to HA for connection optimization
   */
  private declareSupportedFeatures(features: WSSupportedFeatures): void {
    if (!this.ws || !this.connected) return;

    const id = this.messageId++;
    this.ws.send(JSON.stringify({
      id,
      type: 'supported_features',
      features
    }));
  }

  /**
   * Get the connected Home Assistant version
   */
  getHAVersion(): string {
    return this.haVersion;
  }

  async executeBulk(commands: WSCommand[]): Promise<BulkResult> {
    await this.connect();

    const promises = commands.map(cmd => this.executeCommand(cmd));
    const results = await Promise.allSettled(promises);

    const successful: WSResult[] = [];
    const failed: WSResult[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successful.push({ success: true, result: result.value });
      } else {
        failed.push({
          success: false,
          error: {
            code: 'execution_failed',
            message: result.reason.message,
          },
        });
      }
    });

    return {
      successful,
      failed,
      total: commands.length,
    };
  }

  private async executeCommand(command: WSCommand): Promise<any> {
    const id = this.messageId++;
    const message: WSMessage = {
      id,
      type: 'call_service',
      domain: command.domain,
      service: command.service,
      target: command.target,
      service_data: command.service_data,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (result) => {
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error?.message || 'Command failed'));
        }
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Resolve targets (areas, floors, labels, devices) to specific entities
   * Uses the extract_from_target WebSocket command (HA 2025+)
   *
   * @param target - Target specification with area_id, floor_id, label_id, device_id, or entity_id
   * @param expandGroup - If true, expands group entities to their members
   * @returns Resolved entities, devices, and areas
   */
  async resolveTarget(target: WSTargetResolution, expandGroup: boolean = false): Promise<WSTargetResolutionResult> {
    await this.connect();

    const id = this.messageId++;
    const message: WSMessage = {
      id,
      type: 'extract_from_target',
      target,
      expand_group: expandGroup
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (result) => {
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error?.message || 'Target resolution failed'));
        }
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Validate automation triggers, conditions, or actions via WebSocket
   * More efficient than REST API for syntax validation
   */
  async validateConfig(params: {
    trigger?: any;
    condition?: any;
    action?: any;
  }): Promise<{ valid: boolean; error?: string }> {
    await this.connect();

    const id = this.messageId++;
    const message: WSMessage = {
      id,
      type: 'validate_config',
      ...params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (result) => {
        if (result.success) {
          resolve({ valid: true });
        } else {
          resolve({ valid: false, error: result.error?.message });
        }
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Get all entity states via WebSocket (single request)
   */
  async getStates(): Promise<any[]> {
    await this.connect();

    const id = this.messageId++;
    const message: WSMessage = {
      id,
      type: 'get_states'
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (result) => {
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error?.message || 'Failed to get states'));
        }
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
  }
}
