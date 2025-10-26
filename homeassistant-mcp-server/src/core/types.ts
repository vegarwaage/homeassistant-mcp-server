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
  significant_changes_only?: boolean;
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
 * Retry configuration for exponential backoff
 */
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}
