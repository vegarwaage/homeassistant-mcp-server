// ABOUTME: Core layer type definitions for HA API and connections
// ABOUTME: Shared interfaces for REST, WebSocket, and SSE communications

export interface HAConfig {
  baseUrl: string;
  token: string;
  timeout?: number;
}

export interface HAResponse<T = any> {
  data: T;
  status: number;
}

export interface State {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface ServiceCallRequest {
  domain: string;
  service: string;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
  service_data?: Record<string, any>;
}
