// ABOUTME: WebSocket type definitions for Home Assistant
// ABOUTME: Supports bulk operations, state subscriptions, and target resolution

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
  return_response?: boolean;
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

/**
 * Target resolution request for extract_from_target command (HA 2025+)
 */
export interface WSTargetResolution {
  entity_id?: string | string[];
  device_id?: string | string[];
  area_id?: string | string[];
  floor_id?: string | string[];
  label_id?: string | string[];
}

/**
 * Result of target resolution
 */
export interface WSTargetResolutionResult {
  entities: Array<{ entity_id: string; device_id?: string; area_id?: string }>;
  devices: Array<{ device_id: string; area_id?: string }>;
  areas: Array<{ area_id: string; floor_id?: string }>;
}

/**
 * Supported features declaration for connection optimization
 */
export interface WSSupportedFeatures {
  /** Batch multiple messages into single response (reduces network overhead) */
  coalesce_messages?: number;
}
