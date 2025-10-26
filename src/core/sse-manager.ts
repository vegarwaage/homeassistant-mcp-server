// ABOUTME: Server-Sent Events (SSE) manager for real-time Home Assistant updates
// ABOUTME: Handles event subscriptions, filtering, and automatic reconnection

import * as EventSourceModule from 'eventsource';
import type {
  SSEEvent,
  EventFilter,
  EventCallback,
  Subscription,
  SSEManagerConfig,
} from './sse-types';

// Use global EventSource if available (for tests), otherwise use the imported module
const EventSource = (typeof (global as any).EventSource !== 'undefined'
  ? (global as any).EventSource
  : (EventSourceModule as any).default || EventSourceModule) as any;

export class SSEManager {
  private baseUrl: string;
  private token: string;
  private reconnect: boolean;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: SSEManagerConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.reconnect = config.reconnect ?? true;
    this.reconnectDelay = config.reconnectDelay ?? 1000;
    this.maxReconnectDelay = config.maxReconnectDelay ?? 30000;

    this.connect();
  }

  private connect(): void {
    const url = `${this.baseUrl}/api/stream`;

    const es = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    es.onmessage = (event: any) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        this.handleEvent(sseEvent);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    es.onerror = () => {
      if (this.reconnect && es.readyState === 2) {
        // Connection closed, attempt reconnection
        this.scheduleReconnect();
      }
    };

    es.onopen = () => {
      // Reset reconnection counter on successful connection
      this.reconnectAttempt = 0;
    };

    this.eventSource = es;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;

      if (this.eventSource) {
        this.eventSource.close();
      }

      this.connect();
    }, delay);
  }

  private handleEvent(event: SSEEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(event, subscription.filter)) {
        try {
          subscription.callback(event);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      }
    }
  }

  private matchesFilter(event: SSEEvent, filter: EventFilter): boolean {
    // Filter by event_type
    if (filter.event_type) {
      const eventTypes = Array.isArray(filter.event_type)
        ? filter.event_type
        : [filter.event_type];

      if (!eventTypes.includes(event.event_type)) {
        return false;
      }
    }

    // Filter by entity_id
    if (filter.entity_id) {
      if (!event.data.entity_id) {
        return false; // Filter requires entity_id but event doesn't have one
      }

      const entityIds = Array.isArray(filter.entity_id)
        ? filter.entity_id
        : [filter.entity_id];

      if (!entityIds.includes(event.data.entity_id)) {
        return false;
      }
    }

    // Filter by domain
    if (filter.domain && event.data.entity_id) {
      const entityDomain = event.data.entity_id.split('.')[0];
      if (entityDomain !== filter.domain) {
        return false;
      }
    }

    return true;
  }

  public subscribe(filter: EventFilter, callback: EventCallback): Subscription {
    const id = this.generateSubscriptionId();
    const subscription: Subscription = {
      id,
      filter,
      callback,
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  public subscribeByDomain(domain: string, callback: EventCallback): Subscription {
    return this.subscribe({ domain }, callback);
  }

  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.subscriptions.clear();
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public getActiveSubscriptions(): number {
    return this.subscriptions.size;
  }

  public isConnected(): boolean {
    return this.eventSource?.readyState === 1; // OPEN
  }
}
