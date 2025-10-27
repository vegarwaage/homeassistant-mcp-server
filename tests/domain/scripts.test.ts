import { createScriptTools } from '../../src/domain/scripts';
import { MockHAClient } from '../setup';

describe('Script Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_script_list', () => {
    it('should list all scripts', async () => {
      mockClient.get.mockResolvedValue([
        {
          entity_id: 'script.morning_routine',
          attributes: {
            friendly_name: 'Morning Routine',
            mode: 'single',
          },
        },
        {
          entity_id: 'script.bedtime',
          attributes: { friendly_name: 'Bedtime' },
        },
      ]);

      const tools = createScriptTools(mockClient as any);
      const result = await tools.list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].entity_id).toBe('script.morning_routine');
      expect(result[0].mode).toBe('single');
    });
  });

  describe('ha_script_execute', () => {
    it('should execute a script', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createScriptTools(mockClient as any);
      const result = await tools.execute.handler({ entity_id: 'script.morning_routine' });

      expect(mockClient.post).toHaveBeenCalledWith('/services/script/turn_on', {
        entity_id: 'script.morning_routine',
      });
      expect(result.success).toBe(true);
    });

    it('should execute script with variables', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createScriptTools(mockClient as any);
      await tools.execute.handler({
        entity_id: 'script.notify',
        variables: { message: 'Hello' },
      });

      expect(mockClient.post).toHaveBeenCalledWith('/services/script/turn_on', {
        entity_id: 'script.notify',
        variables: { message: 'Hello' },
      });
    });
  });

  describe('ha_script_reload', () => {
    it('should reload all scripts', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createScriptTools(mockClient as any);
      const result = await tools.reload.handler({});

      expect(mockClient.post).toHaveBeenCalledWith('/services/script/reload');
      expect(result.success).toBe(true);
    });
  });
});
