// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: any) => void) | null = null;
  public onmessage: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onclose: ((event: any) => void) | null = null;
  public readyState: number = 0;
  public url: string;
  private listeners: Map<string, Function[]> = new Map();

  constructor(url: string) {
    this.url = url;
    // Simulate successful connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.trigger('open', {});
      // Send auth_required message
      this.simulateMessage({ type: 'auth_required' });
    }, 10);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  send(data: string) {
    const message = JSON.parse(data);

    // Handle auth
    if (message.type === 'auth') {
      setTimeout(() => {
        this.simulateMessage({ type: 'auth_ok' });
      }, 10);
    }

    // Handle service calls
    if (message.type === 'call_service') {
      setTimeout(() => {
        this.simulateMessage({
          id: message.id,
          type: 'result',
          success: true,
          result: {},
        });
      }, 10);
    }
  }

  close() {
    this.readyState = 3; // CLOSED
    this.trigger('close', {});
  }

  // Helper for tests
  simulateMessage(data: any) {
    this.trigger('message', JSON.stringify(data));
  }

  simulateError(error: any) {
    this.trigger('error', error);
  }

  private trigger(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

// Mock the ws module
jest.mock('ws', () => MockWebSocket);

import { WebSocketClient } from '../../src/core/websocket-client';
import type { WSCommand } from '../../src/core/websocket-types';

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    client = new WebSocketClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should create WebSocketClient instance', () => {
    expect(client).toBeInstanceOf(WebSocketClient);
  });

  it('should connect and authenticate', async () => {
    await client.connect();
    expect(client['connected']).toBe(true);
  });

  it('should execute single command', async () => {
    const command: WSCommand = {
      domain: 'light',
      service: 'turn_on',
      target: {
        entity_id: 'light.living_room',
      },
    };

    await client.connect();
    const result = await client['executeCommand'](command);

    expect(result).toBeDefined();
  });

  it('should execute bulk commands', async () => {
    const commands: WSCommand[] = [
      {
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: 'light.bedroom' },
      },
      {
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: 'light.kitchen' },
      },
      {
        domain: 'switch',
        service: 'turn_off',
        target: { entity_id: 'switch.fan' },
      },
    ];

    const result = await client.executeBulk(commands);

    expect(result.total).toBe(3);
    expect(result.successful.length).toBe(3);
    expect(result.failed.length).toBe(0);
  });

  it('should handle failed commands in bulk operation', async () => {
    await client.connect();

    // Override the executeCommand method to simulate one failure
    const originalExecute = client['executeCommand'].bind(client);
    let callCount = 0;
    client['executeCommand'] = async function(command: WSCommand) {
      callCount++;
      if (callCount === 2) {
        throw new Error('Command failed');
      }
      return originalExecute(command);
    };

    const commands: WSCommand[] = [
      {
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: 'light.bedroom' },
      },
      {
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: 'light.kitchen' },
      },
    ];

    const result = await client.executeBulk(commands);

    expect(result.total).toBe(2);
    expect(result.successful.length).toBe(1);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0].error?.code).toBe('execution_failed');
  });

  it('should disconnect and clean up', async () => {
    await client.connect();
    expect(client['connected']).toBe(true);

    client.disconnect();

    expect(client['ws']).toBeNull();
    expect(client['connected']).toBe(false);
    expect(client['pendingRequests'].size).toBe(0);
  });

  it('should not connect if already connected', async () => {
    await client.connect();
    const firstWs = client['ws'];

    await client.connect();
    const secondWs = client['ws'];

    expect(firstWs).toBe(secondWs);
  });
});
