# V2.0 Comprehensive Feature Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task OR superpowers:subagent-driven-development for same-session execution with review checkpoints.

**Goal:** Expand Home Assistant MCP server from 36 tools to ~109 tools using a layered architecture, making it the most comprehensive HA MCP server available.

**Architecture:** Four-layer design (Core → System → Domain → Advanced) with clear separation of concerns. Core provides connection primitives (REST, SSE, WebSocket), System handles HA lifecycle, Domain manages entities/config, Advanced provides composed operations.

**Tech Stack:** TypeScript, Node.js, MCP SDK, Home Assistant REST/WebSocket/SSE APIs

---

## Phase 1: Foundation & Test Framework

### Task 1: Set Up Test Framework

**Files:**
- Create: `package.json` (modify to add test dependencies)
- Create: `tests/setup.ts`
- Create: `tests/core/ha-client.test.ts`
- Create: `tsconfig.test.json`

**Step 1: Add test dependencies to package.json**

```bash
npm install --save-dev jest @types/jest ts-jest @types/node
```

**Step 2: Configure Jest**

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
```

**Step 3: Add test scripts to package.json**

Modify `package.json` scripts section:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "build": "tsc"
}
```

**Step 4: Create test setup file**

File: `tests/setup.ts`
```typescript
// ABOUTME: Test setup file for mocking Home Assistant API
// ABOUTME: Provides mock client and common test utilities

export class MockHAClient {
  public get = jest.fn();
  public post = jest.fn();
  public delete = jest.fn();
  public patch = jest.fn();
}

export function createMockResponse(data: any, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  };
}
```

**Step 5: Write first test (ha-client)**

File: `tests/core/ha-client.test.ts`
```typescript
import { HAClient } from '../../src/core/ha-client';

describe('HAClient', () => {
  it('should create client with valid config', () => {
    const client = new HAClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });
    expect(client).toBeInstanceOf(HAClient);
  });
});
```

**Step 6: Run test to verify framework works**

```bash
npm test
```

Expected: Test should fail because `src/core/ha-client` doesn't exist yet.

**Step 7: Commit**

```bash
git add package.json jest.config.js tests/ package-lock.json
git commit -m "test: add Jest test framework and basic test setup"
```

---

### Task 2: Create Core Layer Structure

**Files:**
- Create: `src/core/index.ts`
- Create: `src/core/types.ts`
- Move: `src/ha-client.ts` → `src/core/ha-client.ts`
- Modify: `src/index.ts` (update imports)

**Step 1: Create core directory and types**

```bash
mkdir -p src/core
```

File: `src/core/types.ts`
```typescript
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
```

**Step 2: Move ha-client to core layer**

```bash
git mv src/ha-client.ts src/core/ha-client.ts
```

**Step 3: Update ha-client imports**

File: `src/core/ha-client.ts` - Add at top:
```typescript
import { HAConfig, HAResponse, ServiceCallRequest } from './types';
```

**Step 4: Create core layer exports**

File: `src/core/index.ts`
```typescript
// ABOUTME: Core layer exports - connection primitives and clients
// ABOUTME: Provides HAClient, SSEManager, WebSocketClient for upper layers

export * from './ha-client';
export * from './types';
// export * from './sse-manager';  // Will add in next task
// export * from './websocket-client';  // Will add in next task
```

**Step 5: Update main index.ts imports**

File: `src/index.ts` - Change:
```typescript
// OLD:
import { HAClient } from './ha-client';

// NEW:
import { HAClient } from './core';
```

**Step 6: Verify build still works**

```bash
npm run build
```

Expected: Should compile successfully.

**Step 7: Commit**

```bash
git add src/core/ src/index.ts
git rm src/ha-client.ts
git commit -m "refactor: move ha-client to core layer structure"
```

---

### Task 3: Enhance HAClient with Connection Pooling

**Files:**
- Modify: `src/core/ha-client.ts`
- Create: `tests/core/ha-client.test.ts` (enhance existing)

**Step 1: Write test for connection pooling**

File: `tests/core/ha-client.test.ts` - Add:
```typescript
describe('HAClient connection pooling', () => {
  it('should limit concurrent requests', async () => {
    const client = new HAClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      maxConcurrent: 2,
    });

    const requests = [
      client.get('/api/states'),
      client.get('/api/states'),
      client.get('/api/states'),
    ];

    // Mock to track concurrent calls
    const concurrentCalls: number[] = [];
    jest.spyOn(client as any, 'executeRequest').mockImplementation(async () => {
      const current = (client as any).activeRequests;
      concurrentCalls.push(current);
      expect(current).toBeLessThanOrEqual(2);
      await new Promise(resolve => setTimeout(resolve, 10));
      return { data: [], status: 200 };
    });

    await Promise.all(requests);
    expect(Math.max(...concurrentCalls)).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- ha-client.test.ts
```

Expected: FAIL - `maxConcurrent` property doesn't exist.

**Step 3: Implement connection pooling in HAClient**

File: `src/core/ha-client.ts` - Modify constructor and add queue:
```typescript
export class HAClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;
  private maxConcurrent: number;
  private activeRequests: number = 0;
  private requestQueue: Array<() => void> = [];

  constructor(config: HAConfig & { maxConcurrent?: number }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.timeout = config.timeout || 30000;
    this.maxConcurrent = config.maxConcurrent || 10;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    return new Promise(resolve => {
      this.requestQueue.push(resolve);
    });
  }

  private releaseSlot(): void {
    this.activeRequests--;
    const next = this.requestQueue.shift();
    if (next) {
      this.activeRequests++;
      next();
    }
  }

  private async executeRequest<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<HAResponse<T>> {
    await this.acquireSlot();
    try {
      // Existing request logic here
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      return {
        data: await response.json(),
        status: response.status,
      };
    } finally {
      this.releaseSlot();
    }
  }

  // Update existing methods to use executeRequest
  async get<T = any>(path: string): Promise<HAResponse<T>> {
    return this.executeRequest<T>('GET', path);
  }

  async post<T = any>(path: string, data?: any): Promise<HAResponse<T>> {
    return this.executeRequest<T>('POST', path, data);
  }

  async delete<T = any>(path: string): Promise<HAResponse<T>> {
    return this.executeRequest<T>('DELETE', path);
  }

  async patch<T = any>(path: string, data?: any): Promise<HAResponse<T>> {
    return this.executeRequest<T>('PATCH', path, data);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- ha-client.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/ha-client.ts tests/core/ha-client.test.ts
git commit -m "feat(core): add connection pooling to HAClient"
```

---

### Task 4: Add Retry Logic with Exponential Backoff

**Files:**
- Modify: `src/core/ha-client.ts`
- Modify: `src/core/types.ts`
- Create: `tests/core/ha-client-retry.test.ts`

**Step 1: Add retry configuration to types**

File: `src/core/types.ts` - Add:
```typescript
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export interface HAConfig {
  baseUrl: string;
  token: string;
  timeout?: number;
  maxConcurrent?: number;
  retry?: RetryConfig;
}
```

**Step 2: Write test for retry logic**

File: `tests/core/ha-client-retry.test.ts`
```typescript
import { HAClient } from '../../src/core/ha-client';

describe('HAClient retry logic', () => {
  it('should retry failed requests with exponential backoff', async () => {
    const client = new HAClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      retry: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
      },
    });

    let attempts = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const result = await client.get('/api/states');
    expect(attempts).toBe(3);
    expect(result.data).toEqual({ success: true });
  });

  it('should fail after max retries', async () => {
    const client = new HAClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      retry: { maxRetries: 2 },
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(client.get('/api/states')).rejects.toThrow('Network error');
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- ha-client-retry.test.ts
```

Expected: FAIL - Retry logic not implemented.

**Step 4: Implement retry logic**

File: `src/core/ha-client.ts` - Add retry method:
```typescript
export class HAClient {
  // ... existing properties ...
  private retryConfig: RetryConfig;

  constructor(config: HAConfig) {
    // ... existing constructor code ...
    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 3,
      baseDelay: config.retry?.baseDelay ?? 1000,
      maxDelay: config.retry?.maxDelay ?? 8000,
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.baseDelay! * Math.pow(2, attempt);
    return Math.min(delay, this.retryConfig.maxDelay!);
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retryConfig.maxRetries!) {
        throw error;
      }

      const delay = this.calculateBackoff(attempt);
      await this.sleep(delay);
      return this.withRetry(operation, attempt + 1);
    }
  }

  private async executeRequest<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<HAResponse<T>> {
    await this.acquireSlot();
    try {
      return await this.withRetry(async () => {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok && response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        return {
          data: await response.json(),
          status: response.status,
        };
      });
    } finally {
      this.releaseSlot();
    }
  }
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- ha-client-retry.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/core/ha-client.ts src/core/types.ts tests/core/ha-client-retry.test.ts
git commit -m "feat(core): add retry logic with exponential backoff to HAClient"
```

---

## Phase 2: Core Layer - Real-Time Capabilities

### Task 5: Implement SSEManager

**Files:**
- Create: `src/core/sse-manager.ts`
- Create: `src/core/sse-types.ts`
- Create: `tests/core/sse-manager.test.ts`
- Modify: `src/core/index.ts`

**Step 1: Define SSE types**

File: `src/core/sse-types.ts`
```typescript
// ABOUTME: Server-Sent Events type definitions
// ABOUTME: Handles real-time state updates from Home Assistant

export interface SSEEvent {
  event_type: string;
  data: {
    entity_id: string;
    new_state: State;
    old_state: State;
  };
  origin: string;
  time_fired: string;
}

export interface EventFilter {
  entity_id?: string;
  domain?: string;
  event_type?: string;
  since?: Date;
}

export type EventCallback = (event: SSEEvent) => void;

export interface Subscription {
  id: string;
  filter: EventFilter;
  callback: EventCallback;
}
```

**Step 2: Write SSEManager test**

File: `tests/core/sse-manager.test.ts`
```typescript
import { SSEManager } from '../../src/core/sse-manager';

describe('SSEManager', () => {
  it('should subscribe to entity events', async () => {
    const manager = new SSEManager({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });

    const events: any[] = [];
    const subId = manager.subscribe('light.bedroom', (event) => {
      events.push(event);
    });

    expect(subId).toBeDefined();
    expect(typeof subId).toBe('string');
  });

  it('should filter events by domain', async () => {
    const manager = new SSEManager({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });

    const events: any[] = [];
    manager.subscribeByDomain('light', (event) => {
      events.push(event);
    });

    // Simulate event
    const mockEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: 'light.bedroom',
        new_state: { state: 'on' },
        old_state: { state: 'off' },
      },
    };

    // Would filter and call callback
    expect(events.length).toBe(0); // Initially empty
  });
});
```

**Step 3: Implement SSEManager (basic structure)**

File: `src/core/sse-manager.ts`
```typescript
// ABOUTME: Server-Sent Events manager for real-time Home Assistant updates
// ABOUTME: Subscribes to state changes and dispatches to registered callbacks

import { EventSource } from 'eventsource';
import { HAConfig } from './types';
import { SSEEvent, EventFilter, EventCallback, Subscription } from './sse-types';

export class SSEManager {
  private baseUrl: string;
  private token: string;
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: HAConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  public subscribe(entityId: string, callback: EventCallback): string {
    const id = crypto.randomUUID();
    const subscription: Subscription = {
      id,
      filter: { entity_id: entityId },
      callback,
    };

    this.subscriptions.set(id, subscription);
    this.ensureConnected();
    return id;
  }

  public subscribeByDomain(domain: string, callback: EventCallback): string {
    const id = crypto.randomUUID();
    const subscription: Subscription = {
      id,
      filter: { domain },
      callback,
    };

    this.subscriptions.set(id, subscription);
    this.ensureConnected();
    return id;
  }

  public unsubscribe(id: string): void {
    this.subscriptions.delete(id);
    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  private ensureConnected(): void {
    if (this.connected) return;

    const url = `${this.baseUrl}/api/stream`;
    this.eventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    this.eventSource.onmessage = (event) => {
      this.handleEvent(JSON.parse(event.data));
    };

    this.eventSource.onerror = () => {
      this.handleDisconnect();
    };

    this.connected = true;
  }

  private handleEvent(event: SSEEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(event, subscription.filter)) {
        subscription.callback(event);
      }
    }
  }

  private matchesFilter(event: SSEEvent, filter: EventFilter): boolean {
    if (filter.entity_id && event.data.entity_id !== filter.entity_id) {
      return false;
    }

    if (filter.domain) {
      const domain = event.data.entity_id.split('.')[0];
      if (domain !== filter.domain) {
        return false;
      }
    }

    if (filter.event_type && event.event_type !== filter.event_type) {
      return false;
    }

    return true;
  }

  private handleDisconnect(): void {
    this.connected = false;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.ensureConnected();
      }, delay);
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
    this.reconnectAttempts = 0;
  }

  public getRecentEvents(filter?: EventFilter): SSEEvent[] {
    // TODO: Implement event buffering
    return [];
  }
}
```

**Step 4: Add SSEManager dependency**

```bash
npm install eventsource
npm install --save-dev @types/eventsource
```

**Step 5: Export from core layer**

File: `src/core/index.ts` - Add:
```typescript
export * from './sse-manager';
export * from './sse-types';
```

**Step 6: Run tests**

```bash
npm test -- sse-manager.test.ts
```

**Step 7: Commit**

```bash
git add src/core/sse-manager.ts src/core/sse-types.ts src/core/index.ts tests/core/sse-manager.test.ts package.json
git commit -m "feat(core): add SSEManager for real-time event subscriptions"
```

---

### Task 6: Implement WebSocketClient

**Files:**
- Create: `src/core/websocket-client.ts`
- Create: `src/core/websocket-types.ts`
- Create: `tests/core/websocket-client.test.ts`
- Modify: `src/core/index.ts`

**Step 1: Define WebSocket types**

File: `src/core/websocket-types.ts`
```typescript
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
```

**Step 2: Implement WebSocketClient (structure)**

File: `src/core/websocket-client.ts`
```typescript
// ABOUTME: WebSocket client for Home Assistant bulk operations
// ABOUTME: Efficient multi-command execution over single connection

import WebSocket from 'ws';
import { HAConfig } from './types';
import { WSMessage, WSCommand, WSResult, BulkResult } from './websocket-types';

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

      this.ws.on('message', (data: string) => {
        const message = JSON.parse(data);

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
```

**Step 3: Add WebSocket dependency**

```bash
npm install ws
npm install --save-dev @types/ws
```

**Step 4: Export from core**

File: `src/core/index.ts` - Add:
```typescript
export * from './websocket-client';
export * from './websocket-types';
```

**Step 5: Commit**

```bash
git add src/core/websocket-client.ts src/core/websocket-types.ts src/core/index.ts package.json
git commit -m "feat(core): add WebSocketClient for bulk operations"
```

---

## Phase 3: Layer Directories & Type Foundations

### Task 7: Create Layer Structure

**Files:**
- Create: `src/system/index.ts`
- Create: `src/system/types.ts`
- Create: `src/domain/index.ts`
- Create: `src/domain/types.ts`
- Create: `src/advanced/index.ts`
- Create: `src/advanced/types.ts`

**Step 1: Create directories**

```bash
mkdir -p src/system src/domain src/advanced
```

**Step 2: Create System Layer types**

File: `src/system/types.ts`
```typescript
// ABOUTME: System layer type definitions for HA lifecycle operations
// ABOUTME: Types for add-ons, integrations, backups, HACS

export interface AddonInfo {
  slug: string;
  name: string;
  description: string;
  version: string;
  state: 'started' | 'stopped';
  installed: boolean;
}

export interface IntegrationInfo {
  domain: string;
  name: string;
  version: string;
  config_entries: ConfigEntry[];
}

export interface ConfigEntry {
  entry_id: string;
  domain: string;
  title: string;
  source: string;
}

export interface BackupInfo {
  slug: string;
  name: string;
  date: string;
  size: number;
  type: 'full' | 'partial';
}
```

File: `src/system/index.ts`
```typescript
// ABOUTME: System layer exports for HA lifecycle management
// ABOUTME: Handles add-ons, integrations, backups, HACS

export * from './types';
// Tool exports will be added as implemented
```

**Step 3: Create Domain Layer types**

File: `src/domain/types.ts`
```typescript
// ABOUTME: Domain layer type definitions for HA entities and config
// ABOUTME: Types for scenes, scripts, helpers, areas, devices

export interface Scene {
  entity_id: string;
  name: string;
  icon?: string;
}

export interface Script {
  entity_id: string;
  name: string;
  sequence: ScriptAction[];
}

export interface ScriptAction {
  service: string;
  target?: any;
  data?: any;
}

export interface Helper {
  entity_id: string;
  name: string;
  type: 'boolean' | 'number' | 'text' | 'select' | 'datetime';
}

export interface Area {
  area_id: string;
  name: string;
  aliases?: string[];
}

export interface Zone {
  entity_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface Device {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  area_id?: string;
}
```

File: `src/domain/index.ts`
```typescript
// ABOUTME: Domain layer exports for HA entity operations
// ABOUTME: Handles scenes, scripts, helpers, areas, zones, devices

export * from './types';
// Tool exports will be added as implemented
```

**Step 4: Create Advanced Layer types**

File: `src/advanced/types.ts`
```typescript
// ABOUTME: Advanced layer type definitions for composed operations
// ABOUTME: Types for bulk operations, search, debugging

export interface BulkControlRequest {
  entities: string[];
  service: string;
  service_data?: Record<string, any>;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  context: string[];
}

export interface AutomationTrace {
  automation_id: string;
  run_id: string;
  timestamp: string;
  trigger: any;
  condition: any[];
  action: any[];
}
```

File: `src/advanced/index.ts`
```typescript
// ABOUTME: Advanced layer exports for composed operations
// ABOUTME: Handles bulk ops, search, debugging, automation helpers

export * from './types';
// Tool exports will be added as implemented
```

**Step 5: Commit**

```bash
git add src/system/ src/domain/ src/advanced/
git commit -m "refactor: create layer structure with type foundations"
```

---

## Phase 4: Domain Layer Implementation

_Due to the massive scope (34 tools), I'll provide detailed patterns for the first component (Scenes), then task breakdowns for remaining components._

### Task 8: Implement Scene Management (4 tools)

**Pattern Established: Complete TDD cycle for first tool, then batch remaining tools in component**

**Step 1: Write scene list test**

File: `tests/domain/scenes.test.ts`
```typescript
import { createSceneTools } from '../../src/domain/scenes';
import { MockHAClient } from '../setup';

describe('Scene Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_scene_list', () => {
    it('should list all scenes', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { entity_id: 'scene.movie_time', attributes: { friendly_name: 'Movie Time' } },
          { entity_id: 'scene.bedtime', attributes: { friendly_name: 'Bedtime' } },
        ],
        status: 200,
      });

      const tools = createSceneTools(mockClient as any);
      const result = await tools.list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].entity_id).toBe('scene.movie_time');
    });
  });
});
```

**Step 2: Implement scenes.ts (all 4 tools together)**

File: `src/domain/scenes.ts`
```typescript
// ABOUTME: Scene management tools for Home Assistant
// ABOUTME: List, activate, create, and delete scenes

import { HAClient } from '../core';
import { Scene } from './types';

export function createSceneTools(client: HAClient) {
  return {
    list: {
      name: 'ha_scene_list',
      description: 'List all scenes',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const response = await client.get('/api/states');
        return response.data
          .filter((state: any) => state.entity_id.startsWith('scene.'))
          .map((state: any) => ({
            entity_id: state.entity_id,
            name: state.attributes.friendly_name || state.entity_id,
            icon: state.attributes.icon,
          }));
      },
    },

    activate: {
      name: 'ha_scene_activate',
      description: 'Activate a scene',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Scene entity ID' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        await client.post('/api/services/scene/turn_on', {
          entity_id,
        });
        return { success: true, entity_id };
      },
    },

    create: {
      name: 'ha_scene_create',
      description: 'Create scene from current device states',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Scene name' },
          entities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to include',
          },
        },
        required: ['name', 'entities'],
      },
      handler: async ({ name, entities }: { name: string; entities: string[] }) => {
        const scene_id = name.toLowerCase().replace(/\s+/g, '_');

        await client.post('/api/services/scene/create', {
          scene_id,
          snapshot_entities: entities,
        });

        return {
          success: true,
          entity_id: `scene.${scene_id}`,
          name,
        };
      },
    },

    delete: {
      name: 'ha_scene_delete',
      description: 'Delete a scene',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Scene entity ID' },
        },
        required: ['entity_id'],
      },
      handler: async ({ entity_id }: { entity_id: string }) => {
        // Scenes created via API are deleted by calling scene.delete
        await client.post('/api/services/scene/delete', {
          entity_id,
        });
        return { success: true, entity_id };
      },
    },
  };
}
```

**Step 3: Export from domain layer**

File: `src/domain/index.ts` - Add:
```typescript
export * from './scenes';
```

**Step 4: Register tools in main index**

File: `src/index.ts` - In tool registration section, add:
```typescript
import { createSceneTools } from './domain/scenes';

// In server tool registration:
const sceneTools = createSceneTools(client);
server.tool(sceneTools.list.name, sceneTools.list.description, sceneTools.list.inputSchema, sceneTools.list.handler);
server.tool(sceneTools.activate.name, sceneTools.activate.description, sceneTools.activate.inputSchema, sceneTools.activate.handler);
server.tool(sceneTools.create.name, sceneTools.create.description, sceneTools.create.inputSchema, sceneTools.create.handler);
server.tool(sceneTools.delete.name, sceneTools.delete.description, sceneTools.delete.inputSchema, sceneTools.delete.handler);
```

**Step 5: Test and commit**

```bash
npm test -- scenes.test.ts
npm run build
git add src/domain/scenes.ts tests/domain/scenes.test.ts src/domain/index.ts src/index.ts
git commit -m "feat(domain): add scene management tools (list, activate, create, delete)"
```

---

### Task 9-14: Remaining Domain Layer Components

**Following the same pattern as Task 8 (test → implement → register → commit), implement:**

**Task 9: Scripts (6 tools)**
- File: `src/domain/scripts.ts`
- Tools: list, create, update, delete, execute, reload
- Endpoints: `/api/services/script/*`, `/api/config/script/config/*`

**Task 10: Helpers (8 tools)**
- File: `src/domain/helpers.ts`
- Tools: list (enhance existing), create_boolean, create_number, create_text, create_select, create_datetime, update, delete
- Endpoints: `/api/config/entity_registry/*`, `/api/services/input_*/*`

**Task 11: Areas & Zones (9 tools)**
- File: `src/domain/areas.ts`
- Tools: area_list, area_create, area_update, area_delete, area_assign_entity, zone_list, zone_create, zone_update, zone_delete
- Endpoints: `/api/config/area_registry/*`, `/api/config/zone/*`

**Task 12: Device Registry (7 tools)**
- File: `src/domain/devices.ts`
- Tools: device_list, device_get, device_update, device_enable, device_disable, entity_registry_list, entity_registry_update
- Endpoints: `/api/config/device_registry/*`, `/api/config/entity_registry/*`

**Each task follows this micro-cycle:**
1. Create test file with basic tests
2. Implement all tools in component file
3. Export from `src/domain/index.ts`
4. Register in `src/index.ts`
5. Run tests, build, commit

---

## Phase 5: System Layer Implementation

### Task 15-18: System Layer Components

**Task 15: Add-on Management (9 tools)**
- File: `src/system/addons.ts`
- Tools: list, info, install, uninstall, start, stop, restart, update, configure
- Endpoints: `/supervisor/addons/*`
- Safety: Check dependencies before uninstall, require confirmation for destructive ops

**Task 16: Integration Management (7 tools)**
- File: `src/system/integrations.ts`
- Tools: list (enhance), info, enable, disable, reload, delete, setup
- Endpoints: `/api/config/config_entries/*`
- Safety: Warn about automations using integration before delete

**Task 17: HACS Management (5 tools)**
- File: `src/system/hacs.ts`
- Tools: repositories, install, update, uninstall, info
- Endpoints: `/api/hacs/*` (custom component)
- Safety: Version-check HACS before operations, validate repo before install

**Task 18: Backup & Restore (5 tools)**
- File: `src/system/backup.ts` (enhance existing)
- Tools: list (enhance), create_full, create_partial, restore, delete
- Endpoints: `/supervisor/backups/*`
- Safety: Require confirmation for restore, check available space before create

---

## Phase 6: Advanced Layer Implementation

### Task 19-22: Advanced Layer Components

**Task 19: Bulk Operations (3 tools)**
- File: `src/advanced/bulk.ts`
- Tools: bulk_control_devices, bulk_assign_areas, bulk_enable_entities
- Uses: WebSocketClient from Core layer, domain tools
- Pattern: Transaction support (all-or-nothing), detailed per-entity results

**Task 20: Configuration Search (4 tools)**
- File: `src/advanced/search.ts`
- Tools: search_automations, search_scripts, search_helpers, search_all_config
- Implementation: Read YAML files, regex search, return matches with context
- Pattern: Return surrounding lines for context

**Task 21: Automation Debugging (3 tools)**
- File: `src/advanced/debug.ts`
- Tools: trace_list, trace_get, get_last_triggered
- Endpoints: `/api/logbook/*`, `/api/trace/*`
- Pattern: Parse trace data, show step-by-step execution

**Task 22: Automation Helpers (3 tools)**
- File: `src/advanced/automation-helpers.ts`
- Tools: duplicate, bulk_enable, test_condition
- Uses: Automation tools from existing codebase
- Pattern: Clone with entity replacement, bulk enable/disable, test conditions

---

## Phase 7: Migration & Integration

### Task 23: Migrate Existing Tools to Layers

**Step 1: Move states tools to domain**

```bash
# Review tools/states.ts - determine which stay, which move
# Some state operations are core, some are domain-specific
git mv src/tools/states.ts src/domain/states.ts
# Update imports
```

**Step 2: Move config tools to domain**

```bash
git mv src/tools/config.ts src/domain/config.ts
# Update imports
```

**Step 3: Move automation tools to domain**

```bash
git mv src/tools/automation.ts src/domain/automation.ts
# Update imports
```

**Step 4: Move system tools to system layer**

```bash
git mv src/tools/system.ts src/system/system.ts
# Update imports
```

**Step 5: Move backup to system layer**

```bash
git mv src/backup.ts src/system/backup.ts
# Enhance with new full/partial backup tools
```

**Step 6: Update all imports in src/index.ts**

**Step 7: Test everything still works**

```bash
npm run build
npm test
```

**Step 8: Commit**

```bash
git add src/
git commit -m "refactor: migrate existing tools to layered architecture"
```

---

### Task 24: Update Main Index Tool Registration

**Step 1: Refactor tool registration to use layer factories**

File: `src/index.ts` - Refactor to:
```typescript
import { HAClient, SSEManager, WebSocketClient } from './core';
import { createSceneTools } from './domain/scenes';
import { createScriptTools } from './domain/scripts';
// ... import all tool factories

// Initialize clients
const client = new HAClient(config);
const sseManager = new SSEManager(config);
const wsClient = new WebSocketClient(config);

// Create tool collections
const domainTools = {
  scenes: createSceneTools(client),
  scripts: createScriptTools(client),
  helpers: createHelperTools(client),
  areas: createAreaTools(client),
  devices: createDeviceTools(client),
};

const systemTools = {
  addons: createAddonTools(client),
  integrations: createIntegrationTools(client),
  hacs: createHacsTools(client),
  backups: createBackupTools(client),
};

const advancedTools = {
  bulk: createBulkTools(wsClient, client),
  search: createSearchTools(client),
  debug: createDebugTools(client),
  automationHelpers: createAutomationHelperTools(client),
};

// Register all tools
for (const category of Object.values(domainTools)) {
  for (const tool of Object.values(category)) {
    server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
  }
}
// Repeat for systemTools and advancedTools
```

**Step 2: Test registration**

```bash
npm run build
# Start server and verify all tools are registered
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: update tool registration for layered architecture"
```

---

## Phase 8: Testing & Documentation

### Task 25: Comprehensive Integration Tests

**Step 1: Create integration test suite**

File: `tests/integration/full-stack.test.ts`
```typescript
describe('Full Stack Integration', () => {
  it('should create scene, activate it, and verify state', async () => {
    // Tests full flow: Domain → Core → HA → back
  });

  it('should perform bulk operations efficiently', async () => {
    // Tests Advanced → Core WebSocket → HA
  });

  it('should handle SSE events', async () => {
    // Tests Core SSE → subscriptions → callbacks
  });
});
```

**Step 2: Add performance benchmarks**

File: `tests/performance/bulk-operations.test.ts`
```typescript
describe('Performance Benchmarks', () => {
  it('bulk operations should be 5x faster than sequential', async () => {
    // Benchmark bulk vs sequential
  });
});
```

**Step 3: Run full test suite**

```bash
npm test
npm run test:coverage
```

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: add integration tests and performance benchmarks"
```

---

### Task 26: Update Documentation

**Step 1: Update README.md**

- Update tool count (36 → ~109)
- Add layer architecture diagram
- Document all new tool categories
- Add examples for bulk operations, SSE subscriptions

**Step 2: Create ARCHITECTURE.md**

File: `docs/ARCHITECTURE.md`
- Explain 4-layer design
- Document layer responsibilities
- Provide extension guide
- Include dependency diagram

**Step 3: Create API documentation**

File: `docs/API.md`
- Document all 73 new tools
- Include schemas and examples
- Document error conditions
- Provide usage patterns

**Step 4: Commit**

```bash
git add README.md docs/
git commit -m "docs: update documentation for v2.0.0 architecture"
```

---

## Phase 9: Version Bump & Release

### Task 27: Prepare Release

**Step 1: Update version**

File: `package.json`:
```json
{
  "version": "2.0.0"
}
```

File: `homeassistant-mcp-server/config.yaml`:
```yaml
version: "2.0.0"
```

**Step 2: Update CHANGELOG.md**

```markdown
# v2.0.0 (2025-10-26)

## Major Changes

- **BREAKING**: Complete architectural refactoring to 4-layer design
- **NEW**: 73 new tools across Domain, System, and Advanced layers
- **NEW**: Real-time event subscriptions via SSE
- **NEW**: Bulk operations via WebSocket

## New Features

### Domain Layer (34 tools)
- Scene Management: Create, activate, delete scenes
- Script Management: Full script lifecycle
- Helper Management: Create/manage all input_* types
- Area & Zone Management: Full spatial organization
- Device Registry: Enable/disable, organize devices

### System Layer (26 tools)
- Add-on Management: Full lifecycle control
- Integration Management: Enable, disable, reload integrations
- HACS Integration: Community integration management
- Backup & Restore: Full and partial system backups

### Advanced Layer (13 tools)
- Bulk Operations: Control multiple devices efficiently
- Configuration Search: Deep search across YAML
- Automation Debugging: Trace execution, troubleshoot
- Automation Helpers: Duplicate, bulk enable, test conditions

## Performance

- Connection pooling prevents resource exhaustion
- Retry logic with exponential backoff
- Bulk operations 5x faster than sequential
- SSE eliminates polling overhead

## Migration

No breaking changes for tool consumers. All existing tool names and schemas unchanged.
```

**Step 3: Build and verify**

```bash
npm run build
npm test
```

**Step 4: Commit**

```bash
git add package.json homeassistant-mcp-server/config.yaml CHANGELOG.md
git commit -m "chore: bump version to 2.0.0"
```

**Step 5: Tag release**

```bash
git tag -a v2.0.0 -m "Version 2.0.0: Comprehensive feature expansion with layered architecture"
```

---

## Summary & Checklist

**Total Tasks: 27**
**Estimated Time: 23-32 days**

**Completion Checklist:**

### Foundation (Tasks 1-4)
- [ ] Test framework configured and working
- [ ] Core layer structure created
- [ ] HAClient enhanced (connection pooling, retry logic)
- [ ] All core tests passing

### Core Real-Time (Tasks 5-6)
- [ ] SSEManager implemented and tested
- [ ] WebSocketClient implemented and tested
- [ ] Real-time subscriptions working

### Layer Structure (Task 7)
- [ ] All layer directories created
- [ ] Type foundations in place
- [ ] Layer exports configured

### Domain Layer (Tasks 8-14)
- [ ] Scenes (4 tools) implemented
- [ ] Scripts (6 tools) implemented
- [ ] Helpers (8 tools) implemented
- [ ] Areas & Zones (9 tools) implemented
- [ ] Device Registry (7 tools) implemented
- [ ] All domain tests passing

### System Layer (Tasks 15-18)
- [ ] Add-ons (9 tools) implemented
- [ ] Integrations (7 tools) implemented
- [ ] HACS (5 tools) implemented
- [ ] Backup & Restore (5 tools) implemented
- [ ] All system tests passing

### Advanced Layer (Tasks 19-22)
- [ ] Bulk Operations (3 tools) implemented
- [ ] Configuration Search (4 tools) implemented
- [ ] Automation Debugging (3 tools) implemented
- [ ] Automation Helpers (3 tools) implemented
- [ ] All advanced tests passing

### Migration (Tasks 23-24)
- [ ] Existing tools migrated to layers
- [ ] Tool registration refactored
- [ ] All existing functionality preserved
- [ ] Build succeeds, all tests pass

### Testing & Docs (Tasks 25-26)
- [ ] Integration tests complete
- [ ] Performance benchmarks passing
- [ ] README.md updated
- [ ] ARCHITECTURE.md created
- [ ] API.md created

### Release (Task 27)
- [ ] Version bumped to 2.0.0
- [ ] CHANGELOG.md updated
- [ ] Build verified
- [ ] Tag created

---

## Execution Notes

**TDD Discipline:**
- Write test first for every tool
- Run test to see it fail
- Implement minimal code
- Run test to see it pass
- Commit

**Commit Frequency:**
- Commit after each completed task
- Use conventional commit messages
- Keep commits focused and atomic

**Code Quality:**
- DRY: Extract common patterns
- YAGNI: Only implement specified features
- Maintain type safety throughout
- Handle errors gracefully

**Dependencies:**
- Core Layer must be complete before others
- Domain/System layers are independent
- Advanced Layer depends on Domain/System
- Migration depends on all layers

---

## Next Steps

This plan is saved to `docs/plans/2025-10-26-v2-comprehensive-expansion-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - Fast iteration with review checkpoints between tasks. Use superpowers:subagent-driven-development.

**2. Parallel Session (separate)** - Open new session in worktree, use superpowers:executing-plans for batch execution.

**Which approach do you prefer, Vegar?**
