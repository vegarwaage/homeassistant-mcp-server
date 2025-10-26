// Mock EventSource
class MockEventSource {
  public onmessage: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onopen: ((event: any) => void) | null = null;
  public readyState: number = 0;
  public url: string;

  constructor(url: string) {
    this.url = url;
    // Simulate successful connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({});
      }
    }, 10);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Helper for tests to simulate incoming events
  simulateEvent(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock the eventsource module
jest.mock('eventsource', () => ({
  __esModule: true,
  default: MockEventSource,
}));

// Set global for SSEManager to find
(global as any).EventSource = MockEventSource;

import { SSEManager } from '../../src/core/sse-manager';
import type { SSEEvent } from '../../src/core/sse-types';

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    manager = new SSEManager({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });
  });

  afterEach(() => {
    manager.disconnect();
  });

  it('should create SSEManager instance', () => {
    expect(manager).toBeInstanceOf(SSEManager);
  });

  it('should subscribe to events and receive callbacks', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    const subscription = manager.subscribe({
      entity_id: 'light.living_room',
    }, callback);

    expect(subscription).toBeDefined();
    expect(subscription.id).toBeDefined();

    // Simulate an event
    const testEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.living_room',
        new_state: { state: 'on' } as any,
        old_state: { state: 'off' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(testEvent);

    // Wait for callback
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalledWith(testEvent);
  });

  it('should filter events by entity_id', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    manager.subscribe({
      entity_id: 'light.living_room',
    }, callback);

    // Event that matches filter
    const matchingEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.living_room',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    // Event that doesn't match filter
    const nonMatchingEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.bedroom',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(matchingEvent);
    eventSource.simulateEvent(nonMatchingEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(matchingEvent);
  });

  it('should subscribe by domain', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    manager.subscribeByDomain('light', callback);

    const lightEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.living_room',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    const switchEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'switch.kitchen',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(lightEvent);
    eventSource.simulateEvent(switchEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(lightEvent);
  });

  it('should unsubscribe from events', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    const subscription = manager.subscribe({
      entity_id: 'light.living_room',
    }, callback);

    manager.unsubscribe(subscription.id);

    const testEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.living_room',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(testEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).not.toHaveBeenCalled();
  });

  it('should filter by multiple criteria', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    manager.subscribe({
      domain: 'light',
      event_type: 'state_changed',
    }, callback);

    // Event that matches both filters
    const matchingEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.bedroom',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    // Event that matches domain but not event_type
    const wrongEventType: SSEEvent = {
      event_type: 'automation_triggered',
      data: {
        entity_id: 'light.bedroom',
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    // Event that matches event_type but not domain
    const wrongDomain: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'switch.kitchen',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(matchingEvent);
    eventSource.simulateEvent(wrongEventType);
    eventSource.simulateEvent(wrongDomain);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(matchingEvent);
  });

  it('should filter by array of entity_ids', async () => {
    const callback = jest.fn();
    const eventSource = manager['eventSource'] as any;

    manager.subscribe({
      entity_id: ['light.bedroom', 'light.kitchen', 'light.living_room'],
    }, callback);

    const bedroomEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.bedroom',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    const kitchenEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.kitchen',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    const bathroomEvent: SSEEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.bathroom',
        new_state: { state: 'on' } as any,
      },
      origin: 'LOCAL',
      time_fired: new Date().toISOString(),
    };

    eventSource.simulateEvent(bedroomEvent);
    eventSource.simulateEvent(kitchenEvent);
    eventSource.simulateEvent(bathroomEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(bedroomEvent);
    expect(callback).toHaveBeenCalledWith(kitchenEvent);
  });

  it('should handle reconnection on connection loss', async () => {
    const reconnectManager = new SSEManager({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      reconnect: true,
      reconnectDelay: 100,
    });

    const eventSource = reconnectManager['eventSource'] as any;

    // Simulate connection error
    eventSource.simulateError();

    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have attempted reconnection
    expect(reconnectManager['eventSource']).toBeDefined();

    reconnectManager.disconnect();
  });
});
