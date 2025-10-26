// ABOUTME: WebSocket type definitions for Home Assistant
// ABOUTME: Supports bulk operations and state subscriptions

export interface WSMessage {
  id: number;
  type: string;
  [key: string]: any;
}

export interface WSCommand {
  domain: string;
  service: string;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
  service_data?: Record<string, any>;
}

export interface WSResult {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

export interface BulkResult {
  successful: WSResult[];
  failed: WSResult[];
  total: number;
}
