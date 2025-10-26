// ABOUTME: WebSocket client for Home Assistant bulk operations
// ABOUTME: Efficient multi-command execution over single connection

import WebSocket from 'ws';
import type { HAConfig } from './types.js';
import type { WSMessage, WSCommand, WSResult, BulkResult } from './websocket-types.js';

export class WebSocketClient {
  private baseUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private messageId: number = 1;
  private pendingRequests: Map<number, (result: any) => void> = new Map();
  private connected: boolean = false;

  constructor(config: HAConfig) {
    this.baseUrl = config.baseUrl.replace(/^http/, 'ws');
    this.token = config.token;
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
          this.ws!.send(JSON.stringify({
            type: 'auth',
            access_token: this.token,
          }));
        } else if (message.type === 'auth_ok') {
          this.connected = true;
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

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
  }
}
