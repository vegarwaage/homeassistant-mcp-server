// ABOUTME: Advanced layer type definitions for power user features
// ABOUTME: Types for bulk operations, search, debugging, and automation helpers

export interface BulkOperationRequest {
  entity_ids: string[];
  operation: 'turn_on' | 'turn_off' | 'toggle';
  service_data?: Record<string, any>;
}

export interface BulkOperationResult {
  successful: string[];
  failed: Array<{
    entity_id: string;
    error: string;
  }>;
  total: number;
}

export interface SearchQuery {
  query?: string;
  entity_id?: string;
  domain?: string;
  area?: string;
  device_class?: string;
  state?: string;
  attribute_filters?: Record<string, any>;
}

export interface SearchResult {
  entity_id: string;
  name: string;
  state: string;
  attributes: Record<string, any>;
  area?: string;
  device_class?: string;
  relevance_score?: number;
}

export interface AutomationTrace {
  automation_id: string;
  run_id: string;
  timestamp: string;
  state: 'running' | 'stopped' | 'debugged';
  trigger?: any;
  condition_results?: any[];
  action_results?: any[];
  error?: string;
}

export interface AutomationDebugInfo {
  automation_id: string;
  enabled: boolean;
  last_triggered?: string;
  traces: AutomationTrace[];
  config: any;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}
