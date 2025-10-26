import { createDeviceTools } from '../../src/domain/devices';
import { MockHAClient } from '../setup';

describe('Device Registry Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_device_list', () => {
    it('should list all devices', async () => {
      mockClient.get.mockResolvedValue([
        {
          id: 'device1',
          name: 'Living Room Light',
          manufacturer: 'Philips',
          model: 'Hue',
          area_id: 'living_room',
        },
        {
          id: 'device2',
          name: 'Bedroom Sensor',
          manufacturer: 'Aqara',
          model: 'Temperature Sensor',
        },
      ]);

      const tools = createDeviceTools(mockClient as any);
      const result = await tools.device_list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('device1');
      expect(result[0].manufacturer).toBe('Philips');
    });
  });

  describe('ha_device_get', () => {
    it('should get device by ID', async () => {
      mockClient.get.mockResolvedValue({
        id: 'device1',
        name: 'Living Room Light',
        manufacturer: 'Philips',
      });

      const tools = createDeviceTools(mockClient as any);
      const result = await tools.device_get.handler({ device_id: 'device1' });

      expect(mockClient.get).toHaveBeenCalledWith('/api/config/device_registry/device/device1');
      expect(result.id).toBe('device1');
    });
  });

  describe('ha_device_update', () => {
    it('should update device configuration', async () => {
      mockClient.post.mockResolvedValue({ id: 'device1', name_by_user: 'Main Light' });

      const tools = createDeviceTools(mockClient as any);
      const result = await tools.device_update.handler({
        device_id: 'device1',
        name_by_user: 'Main Light',
        area_id: 'living_room',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/config/device_registry/update', {
        device_id: 'device1',
        name_by_user: 'Main Light',
        area_id: 'living_room',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ha_entity_registry_list', () => {
    it('should list all entity registry entries', async () => {
      mockClient.get.mockResolvedValue([
        {
          entity_id: 'light.living_room',
          name: 'Living Room Light',
          platform: 'hue',
          device_id: 'device1',
        },
      ]);

      const tools = createDeviceTools(mockClient as any);
      const result = await tools.entity_registry_list.handler({});

      expect(result).toHaveLength(1);
      expect(result[0].entity_id).toBe('light.living_room');
    });
  });

  describe('ha_entity_registry_update', () => {
    it('should update entity registry entry', async () => {
      mockClient.post.mockResolvedValue({ entity_id: 'light.living_room' });

      const tools = createDeviceTools(mockClient as any);
      const result = await tools.entity_registry_update.handler({
        entity_id: 'light.living_room',
        name: 'Main Light',
        area_id: 'living_room',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/config/entity_registry/update', {
        entity_id: 'light.living_room',
        name: 'Main Light',
        area_id: 'living_room',
      });
      expect(result.success).toBe(true);
    });
  });
});
