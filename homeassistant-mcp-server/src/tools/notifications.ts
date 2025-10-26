// ABOUTME: MCP tools for sending notifications through Home Assistant
// ABOUTME: Provides ha_send_notification for mobile app and service notifications

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerNotificationsTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_send_notification',
      description: 'Send notification to mobile app or service',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Notification service name (e.g., "mobile_app_iphone", "persistent_notification")'
          },
          message: {
            type: 'string',
            description: 'Notification message content'
          },
          title: {
            type: 'string',
            description: 'Notification title (optional)'
          },
          data: {
            type: 'object',
            description: 'Additional notification data (optional, e.g., actions, image, etc.)'
          }
        },
        required: ['service', 'message']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { service, message, title, data } = args;

        if (!service || typeof service !== 'string') {
          throw new Error('service must be a non-empty string');
        }

        if (!message || typeof message !== 'string') {
          throw new Error('message must be a non-empty string');
        }

        await client.sendNotification({
          service,
          message,
          title,
          data
        });

        return {
          success: true,
          service,
          message,
          title,
          data,
          sent_at: new Date().toISOString()
        };
      }
    }
  ];
}
