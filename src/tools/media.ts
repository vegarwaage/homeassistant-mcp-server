// ABOUTME: MCP tools for camera snapshots and media player control
// ABOUTME: Provides ha_get_camera_snapshot and ha_control_media_player

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerMediaTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_camera_snapshot',
      description: 'Get camera snapshot URL or base64-encoded image data from a camera entity',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'Camera entity ID (e.g., "camera.front_door")'
          },
          format: {
            type: 'string',
            enum: ['url', 'base64'],
            description: 'Return format: "url" for proxy URL or "base64" for image data (default: url)'
          }
        },
        required: ['entity_id']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_id, format = 'url' } = args;

        if (!entity_id.startsWith('camera.')) {
          throw new Error('entity_id must be a camera entity (e.g., camera.front_door)');
        }

        // Verify the camera entity exists
        const states = await client.getStates(entity_id);
        if (!states || states.length === 0) {
          throw new Error(`Camera entity "${entity_id}" not found`);
        }

        const camera = states[0];

        if (format === 'url') {
          // Return the camera proxy URL
          const proxyUrl = await client.getCameraSnapshot(entity_id, 'url');
          return {
            entity_id,
            format: 'url',
            url: proxyUrl,
            friendly_name: camera.attributes.friendly_name,
            state: camera.state
          };
        } else {
          // Return base64-encoded image data
          const imageData = await client.getCameraSnapshot(entity_id, 'base64');
          return {
            entity_id,
            format: 'base64',
            data: imageData,
            friendly_name: camera.attributes.friendly_name,
            state: camera.state
          };
        }
      }
    },
    {
      name: 'ha_control_media_player',
      description: 'Control media player entities (play, pause, stop, volume, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'Media player entity ID (e.g., "media_player.living_room")'
          },
          action: {
            type: 'string',
            enum: ['play', 'pause', 'stop', 'next', 'previous', 'volume_set', 'volume_up', 'volume_down'],
            description: 'Action to perform on the media player'
          },
          volume: {
            type: 'number',
            description: 'Volume level for volume_set action (0.0 to 1.0)',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['entity_id', 'action']
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { entity_id, action, volume } = args;

        if (!entity_id.startsWith('media_player.')) {
          throw new Error('entity_id must be a media_player entity (e.g., media_player.living_room)');
        }

        // Verify the media player entity exists
        const states = await client.getStates(entity_id);
        if (!states || states.length === 0) {
          throw new Error(`Media player entity "${entity_id}" not found`);
        }

        const mediaPlayer = states[0];

        // Validate volume parameter for volume_set action
        if (action === 'volume_set') {
          if (volume === undefined || volume === null) {
            throw new Error('volume parameter is required for volume_set action');
          }
          if (volume < 0 || volume > 1) {
            throw new Error('volume must be between 0.0 and 1.0');
          }
        }

        // Call the appropriate media player service
        let service: string;
        let serviceData: any = {};

        switch (action) {
          case 'play':
            service = 'media_play';
            break;
          case 'pause':
            service = 'media_pause';
            break;
          case 'stop':
            service = 'media_stop';
            break;
          case 'next':
            service = 'media_next_track';
            break;
          case 'previous':
            service = 'media_previous_track';
            break;
          case 'volume_set':
            service = 'volume_set';
            serviceData = { volume_level: volume };
            break;
          case 'volume_up':
            service = 'volume_up';
            break;
          case 'volume_down':
            service = 'volume_down';
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        await client.callService({
          domain: 'media_player',
          service,
          target: { entity_id },
          service_data: serviceData
        });

        // Get updated state
        const updatedStates = await client.getStates(entity_id);
        const updatedState = updatedStates[0];

        return {
          success: true,
          action,
          entity_id,
          friendly_name: mediaPlayer.attributes.friendly_name,
          previous_state: mediaPlayer.state,
          current_state: updatedState.state,
          volume_level: updatedState.attributes.volume_level,
          media_title: updatedState.attributes.media_title,
          media_artist: updatedState.attributes.media_artist
        };
      }
    }
  ];
}
