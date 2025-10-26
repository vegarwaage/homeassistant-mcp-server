import { createHelperTools } from '../../src/domain/helpers';
import { MockHAClient } from '../setup';

describe('Helper Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_helper_list', () => {
    it('should list all input helpers', async () => {
      mockClient.get.mockResolvedValue([
        { entity_id: 'input_boolean.test_mode', attributes: { friendly_name: 'Test Mode' } },
        { entity_id: 'input_number.temperature', attributes: { friendly_name: 'Temperature', min: 0, max: 100 } },
        { entity_id: 'light.bedroom', attributes: {} },
      ]);

      const tools = createHelperTools(mockClient as any);
      const result = await tools.list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].entity_id).toBe('input_boolean.test_mode');
    });
  });

  describe('ha_helper_create_boolean', () => {
    it('should create input boolean', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createHelperTools(mockClient as any);
      const result = await tools.create_boolean.handler({
        name: 'Test Mode',
        initial: true,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/config/input_boolean/config/test_mode',
        expect.objectContaining({ name: 'Test Mode', initial: true })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('ha_helper_create_number', () => {
    it('should create input number', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createHelperTools(mockClient as any);
      const result = await tools.create_number.handler({
        name: 'Temperature',
        min: 0,
        max: 100,
        step: 0.5,
      });

      expect(mockClient.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('ha_helper_delete', () => {
    it('should delete input helper', async () => {
      mockClient.delete.mockResolvedValue({});

      const tools = createHelperTools(mockClient as any);
      const result = await tools.delete.handler({
        entity_id: 'input_boolean.test_mode',
      });

      expect(mockClient.delete).toHaveBeenCalledWith('/api/config/input_boolean/config/test_mode');
      expect(result.success).toBe(true);
    });
  });
});
