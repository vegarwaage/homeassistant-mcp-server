import { createAreaZoneTools } from '../../src/domain/areas-zones';
import { MockHAClient } from '../setup';

describe('Area and Zone Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('Areas', () => {
    describe('ha_area_list', () => {
      it('should list all areas', async () => {
        mockClient.get.mockResolvedValue([
          { area_id: 'living_room', name: 'Living Room' },
          { area_id: 'bedroom', name: 'Bedroom' },
        ]);

        const tools = createAreaZoneTools(mockClient as any);
        const result = await tools.area_list.handler({});

        expect(result).toHaveLength(2);
        expect(result[0].area_id).toBe('living_room');
      });
    });

    describe('ha_area_create', () => {
      it('should create new area', async () => {
        mockClient.post.mockResolvedValue({ area_id: 'kitchen', name: 'Kitchen' });

        const tools = createAreaZoneTools(mockClient as any);
        const result = await tools.area_create.handler({ name: 'Kitchen' });

        expect(mockClient.post).toHaveBeenCalledWith('/api/config/area_registry/create', { name: 'Kitchen' });
        expect(result.success).toBe(true);
      });
    });

    describe('ha_area_delete', () => {
      it('should delete area', async () => {
        mockClient.post.mockResolvedValue({});

        const tools = createAreaZoneTools(mockClient as any);
        const result = await tools.area_delete.handler({ area_id: 'old_room' });

        expect(mockClient.post).toHaveBeenCalledWith('/api/config/area_registry/delete', { area_id: 'old_room' });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Zones', () => {
    describe('ha_zone_list', () => {
      it('should list all zones', async () => {
        mockClient.get.mockResolvedValue([
          { entity_id: 'zone.home', attributes: { friendly_name: 'Home', latitude: 0, longitude: 0, radius: 100 } },
        ]);

        const tools = createAreaZoneTools(mockClient as any);
        const result = await tools.zone_list.handler({});

        expect(result).toHaveLength(1);
        expect(result[0].entity_id).toBe('zone.home');
      });
    });

    describe('ha_zone_create', () => {
      it('should create new zone', async () => {
        mockClient.post.mockResolvedValue({});

        const tools = createAreaZoneTools(mockClient as any);
        const result = await tools.zone_create.handler({
          name: 'Work',
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 100,
        });

        expect(mockClient.post).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });
  });
});
