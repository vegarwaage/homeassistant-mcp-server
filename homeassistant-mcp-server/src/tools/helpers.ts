// ABOUTME: MCP tools for managing shopping lists, todo lists, and input helpers
// ABOUTME: Provides ha_manage_shopping_list, ha_manage_todo, ha_list_input_helpers

import { HomeAssistantClient } from '../ha-client.js';
import { ToolDefinition } from '../types.js';

export function registerHelpersTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_manage_shopping_list',
      description: 'Manage shopping list items (list, add, remove, complete)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'add', 'remove', 'complete'],
            description: 'Action to perform on shopping list'
          },
          item: {
            type: 'string',
            description: 'Item name (required for add action)'
          },
          item_id: {
            type: 'string',
            description: 'Item ID (required for remove/complete actions)'
          }
        },
        required: ['action']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { action, item, item_id } = args;

        switch (action) {
          case 'list':
            // Get shopping list items by querying the shopping_list entity
            const states = await client.getStates();
            const shoppingListEntity = states.find(s => s.entity_id === 'todo.shopping_list');

            if (!shoppingListEntity) {
              return {
                action: 'list',
                items: [],
                message: 'Shopping list not found. Make sure shopping_list integration is enabled.'
              };
            }

            return {
              action: 'list',
              state: shoppingListEntity.state,
              items: shoppingListEntity.attributes.items || []
            };

          case 'add':
            if (!item) {
              throw new Error('item parameter is required for add action');
            }

            await client.callService({
              domain: 'shopping_list',
              service: 'add_item',
              service_data: { name: item }
            });

            return {
              action: 'add',
              success: true,
              message: `Added "${item}" to shopping list`
            };

          case 'complete':
            if (!item_id) {
              throw new Error('item_id parameter is required for complete action');
            }

            await client.callService({
              domain: 'shopping_list',
              service: 'complete_item',
              service_data: { item: item_id }
            });

            return {
              action: 'complete',
              success: true,
              message: `Marked item ${item_id} as complete`
            };

          case 'remove':
            if (!item_id) {
              throw new Error('item_id parameter is required for remove action');
            }

            await client.callService({
              domain: 'shopping_list',
              service: 'remove_item',
              service_data: { item: item_id }
            });

            return {
              action: 'remove',
              success: true,
              message: `Removed item ${item_id} from shopping list`
            };

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }
    },
    {
      name: 'ha_manage_todo',
      description: 'Manage todo list items (list, add, remove, complete)',
      inputSchema: {
        type: 'object',
        properties: {
          list: {
            type: 'string',
            description: 'Entity ID of the todo list (e.g., "todo.my_tasks")'
          },
          action: {
            type: 'string',
            enum: ['list', 'add', 'remove', 'complete'],
            description: 'Action to perform on todo list'
          },
          item: {
            type: 'string',
            description: 'Item summary/name (required for add action)'
          },
          item_id: {
            type: 'string',
            description: 'Item ID (required for remove/complete actions)'
          },
          due_date: {
            type: 'string',
            description: 'Due date in ISO format (optional for add action)'
          }
        },
        required: ['action']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { list, action, item, item_id, due_date } = args;

        switch (action) {
          case 'list':
            // Get all todo list entities or a specific one
            const states = await client.getStates();
            const todoLists = states.filter(s => s.entity_id.startsWith('todo.'));

            if (list) {
              const specificList = todoLists.find(s => s.entity_id === list);
              if (!specificList) {
                throw new Error(`Todo list "${list}" not found`);
              }

              return {
                action: 'list',
                entity_id: specificList.entity_id,
                state: specificList.state,
                items: specificList.attributes.items || [],
                attributes: specificList.attributes
              };
            }

            return {
              action: 'list',
              todo_lists: todoLists.map(t => ({
                entity_id: t.entity_id,
                state: t.state,
                friendly_name: t.attributes.friendly_name,
                item_count: t.attributes.items?.length || 0
              }))
            };

          case 'add':
            if (!list) {
              throw new Error('list parameter is required for add action');
            }
            if (!item) {
              throw new Error('item parameter is required for add action');
            }

            const addData: any = { item };
            if (due_date) {
              addData.due_date = due_date;
            }

            await client.callService({
              domain: 'todo',
              service: 'add_item',
              target: { entity_id: list },
              service_data: addData
            });

            return {
              action: 'add',
              success: true,
              list,
              message: `Added "${item}" to ${list}`
            };

          case 'complete':
            if (!list) {
              throw new Error('list parameter is required for complete action');
            }
            if (!item_id) {
              throw new Error('item_id parameter is required for complete action');
            }

            await client.callService({
              domain: 'todo',
              service: 'update_item',
              target: { entity_id: list },
              service_data: { item: item_id, status: 'completed' }
            });

            return {
              action: 'complete',
              success: true,
              list,
              message: `Marked item ${item_id} as complete in ${list}`
            };

          case 'remove':
            if (!list) {
              throw new Error('list parameter is required for remove action');
            }
            if (!item_id) {
              throw new Error('item_id parameter is required for remove action');
            }

            await client.callService({
              domain: 'todo',
              service: 'remove_item',
              target: { entity_id: list },
              service_data: { item: item_id }
            });

            return {
              action: 'remove',
              success: true,
              list,
              message: `Removed item ${item_id} from ${list}`
            };

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }
    },
    {
      name: 'ha_list_input_helpers',
      description: 'List all input helper entities (input_boolean, input_number, input_text, input_select, input_datetime)',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const states = await client.getStates();

        // Filter entities that start with "input_"
        const inputHelpers = states.filter(s => s.entity_id.startsWith('input_'));

        // Group by type
        const grouped: Record<string, any[]> = {};

        for (const helper of inputHelpers) {
          const domain = helper.entity_id.split('.')[0];

          if (!grouped[domain]) {
            grouped[domain] = [];
          }

          grouped[domain].push({
            entity_id: helper.entity_id,
            state: helper.state,
            friendly_name: helper.attributes.friendly_name,
            attributes: helper.attributes
          });
        }

        return {
          total_count: inputHelpers.length,
          grouped_by_type: grouped,
          available_types: Object.keys(grouped).sort()
        };
      }
    }
  ];
}
