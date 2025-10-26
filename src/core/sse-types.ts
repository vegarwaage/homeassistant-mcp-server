// ABOUTME: Type definitions for Server-Sent Events (SSE) real-time subscriptions
// ABOUTME: Defines event structures, filters, callbacks, and subscription management

import type { State } from './types.js';

export interface SSEEvent {
  event_type: string;
  data: {
    entity_id?: string;
    new_state?: State;
    old_state?: State;
    [key: string]: any;
  };
  origin: string;
  time_fired: string;
}

export interface EventFilter {
  entity_id?: string | string[];
  domain?: string;
  event_type?: string | string[];
}

export type EventCallback = (event: SSEEvent) => void | Promise<void>;

export interface Subscription {
  id: string;
  filter: EventFilter;
  callback: EventCallback;
}

export interface SSEManagerConfig {
  baseUrl: string;
  token: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}
