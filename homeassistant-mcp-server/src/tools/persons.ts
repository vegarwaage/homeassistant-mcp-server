// ABOUTME: MCP tools for person entities and location tracking
// ABOUTME: Provides ha_get_person_location to track person entity locations

import { HomeAssistantClient } from '../core/index.js';
import { ToolDefinition } from '../types.js';

export function registerPersonTools(): ToolDefinition[] {
  return [
    {
      name: 'ha_get_person_location',
      description: 'Get location information for person entities including zone, GPS coordinates, and device trackers',
      inputSchema: {
        type: 'object',
        properties: {
          person_id: {
            type: 'string',
            description: 'Specific person entity ID to query (e.g., "person.john"). If not provided, returns all persons.'
          }
        }
      },
      handler: async (client: HomeAssistantClient, args: any) => {
        const { person_id } = args;

        const states = await client.getStates();
        let personEntities = states.filter(s => s.entity_id.startsWith('person.'));

        if (person_id) {
          personEntities = personEntities.filter(p => p.entity_id === person_id);
          if (personEntities.length === 0) {
            throw new Error(`Person entity "${person_id}" not found`);
          }
        }

        if (personEntities.length === 0) {
          return {
            persons: [],
            message: 'No person entities found. Make sure the person integration is configured.'
          };
        }

        const persons = personEntities.map(person => {
          const attributes = person.attributes;

          // Extract location information
          const location: any = {
            entity_id: person.entity_id,
            friendly_name: attributes.friendly_name || person.entity_id,
            state: person.state,
            last_updated: person.last_updated
          };

          // Current zone or state
          if (person.state === 'home') {
            location.zone = 'home';
            location.location_type = 'zone';
          } else if (person.state === 'not_home') {
            location.zone = 'not_home';
            location.location_type = 'away';
          } else {
            location.zone = person.state;
            location.location_type = 'zone';
          }

          // GPS coordinates
          if (attributes.latitude && attributes.longitude) {
            location.coordinates = {
              latitude: attributes.latitude,
              longitude: attributes.longitude,
              gps_accuracy: attributes.gps_accuracy
            };
          }

          // Associated device trackers
          if (attributes.source) {
            location.source_device = attributes.source;
          }

          // Additional attributes
          if (attributes.user_id) {
            location.user_id = attributes.user_id;
          }

          if (attributes.id) {
            location.person_id = attributes.id;
          }

          return location;
        });

        if (person_id) {
          return persons[0];
        }

        return {
          person_count: persons.length,
          persons
        };
      }
    }
  ];
}
