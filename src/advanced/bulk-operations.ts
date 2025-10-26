// ABOUTME: Bulk operation tools for efficient multi-entity operations
// ABOUTME: Turn on/off/toggle multiple entities, bulk state updates

import type { HomeAssistantClient } from '../core/ha-client.js';
import { WebSocketClient } from '../core/websocket-client.js';
import type { WSCommand } from '../core/websocket-types.js';

export function createBulkOperationTools(client: HomeAssistantClient) {
  return {
    bulk_service_call: {
      name: 'ha_bulk_service_call',
      description: 'Call service on multiple entities efficiently via WebSocket',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: { type: 'string', description: 'Service domain (e.g., "light")' },
          service: { type: 'string', description: 'Service name (e.g., "turn_on")' },
          entity_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to target',
          },
          service_data: {
            type: 'object',
            description: 'Service data (optional)',
            additionalProperties: true,
          },
        },
        required: ['domain', 'service', 'entity_ids'],
      },
      handler: async ({
        domain,
        service,
        entity_ids,
        service_data,
      }: {
        domain: string;
        service: string;
        entity_ids: string[];
        service_data?: Record<string, any>;
      }) => {
        const wsClient = new WebSocketClient({
          baseUrl: client['baseUrl'],
          token: client['token'],
        });

        try {
          const commands: WSCommand[] = entity_ids.map(entity_id => ({
            domain,
            service,
            target: { entity_id },
            service_data,
          }));

          const result = await wsClient.executeBulk(commands);
          return {
            success: true,
            total: result.total,
            successful: result.successful.length,
            failed: result.failed.length,
            details: result,
          };
        } finally {
          wsClient.disconnect();
        }
      },
    },

    bulk_turn_on: {
      name: 'ha_bulk_turn_on',
      description: 'Turn on multiple entities',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to turn on',
          },
        },
        required: ['entity_ids'],
      },
      handler: async ({ entity_ids }: { entity_ids: string[] }) => {
        const wsClient = new WebSocketClient({
          baseUrl: client['baseUrl'],
          token: client['token'],
        });

        try {
          const commands: WSCommand[] = entity_ids.map(entity_id => {
            const domain = entity_id.split('.')[0];
            return {
              domain,
              service: 'turn_on',
              target: { entity_id },
            };
          });

          const result = await wsClient.executeBulk(commands);
          return {
            success: true,
            total: result.total,
            successful: result.successful.length,
            failed: result.failed.length,
          };
        } finally {
          wsClient.disconnect();
        }
      },
    },

    bulk_turn_off: {
      name: 'ha_bulk_turn_off',
      description: 'Turn off multiple entities',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to turn off',
          },
        },
        required: ['entity_ids'],
      },
      handler: async ({ entity_ids }: { entity_ids: string[] }) => {
        const wsClient = new WebSocketClient({
          baseUrl: client['baseUrl'],
          token: client['token'],
        });

        try {
          const commands: WSCommand[] = entity_ids.map(entity_id => {
            const domain = entity_id.split('.')[0];
            return {
              domain,
              service: 'turn_off',
              target: { entity_id },
            };
          });

          const result = await wsClient.executeBulk(commands);
          return {
            success: true,
            total: result.total,
            successful: result.successful.length,
            failed: result.failed.length,
          };
        } finally {
          wsClient.disconnect();
        }
      },
    },
  };
}
