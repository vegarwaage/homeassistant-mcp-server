import { createAddonTools } from '../../src/system/addons';
import { MockHAClient } from '../setup';

describe('Add-on Management Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_addon_list', () => {
    it('should list all add-ons', async () => {
      mockClient.get.mockResolvedValue({
        addons: [
          {
            slug: 'core_mosquitto',
            name: 'Mosquitto broker',
            state: 'started',
            version: '6.4.0',
          },
          {
            slug: 'core_ssh',
            name: 'Terminal & SSH',
            state: 'stopped',
            version: '9.8.1',
          },
        ],
      });

      const tools = createAddonTools(mockClient as any);
      const result = await tools.list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('core_mosquitto');
      expect(result[0].state).toBe('started');
    });
  });

  describe('ha_addon_info', () => {
    it('should get add-on details', async () => {
      mockClient.get.mockResolvedValue({
        slug: 'core_mosquitto',
        name: 'Mosquitto broker',
        state: 'started',
        version: '6.4.0',
        description: 'MQTT broker',
      });

      const tools = createAddonTools(mockClient as any);
      const result = await tools.info.handler({ addon: 'core_mosquitto' });

      expect(mockClient.get).toHaveBeenCalledWith('/hassio/addons/core_mosquitto/info');
      expect(result.slug).toBe('core_mosquitto');
    });
  });

  describe('ha_addon_start', () => {
    it('should start add-on', async () => {
      mockClient.post.mockResolvedValue({ result: 'ok' });

      const tools = createAddonTools(mockClient as any);
      const result = await tools.start.handler({ addon: 'core_mosquitto' });

      expect(mockClient.post).toHaveBeenCalledWith('/hassio/addons/core_mosquitto/start');
      expect(result.success).toBe(true);
    });
  });

  describe('ha_addon_stop', () => {
    it('should stop add-on', async () => {
      mockClient.post.mockResolvedValue({ result: 'ok' });

      const tools = createAddonTools(mockClient as any);
      const result = await tools.stop.handler({ addon: 'core_mosquitto' });

      expect(mockClient.post).toHaveBeenCalledWith('/hassio/addons/core_mosquitto/stop');
      expect(result.success).toBe(true);
    });
  });

  describe('ha_addon_restart', () => {
    it('should restart add-on', async () => {
      mockClient.post.mockResolvedValue({ result: 'ok' });

      const tools = createAddonTools(mockClient as any);
      const result = await tools.restart.handler({ addon: 'core_mosquitto' });

      expect(mockClient.post).toHaveBeenCalledWith('/hassio/addons/core_mosquitto/restart');
      expect(result.success).toBe(true);
    });
  });
});
