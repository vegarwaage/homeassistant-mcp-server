import { createSceneTools } from '../../src/domain/scenes';
import { MockHAClient } from '../setup';

describe('Scene Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('ha_scene_list', () => {
    it('should list all scenes', async () => {
      mockClient.get.mockResolvedValue([
        { entity_id: 'scene.movie_time', attributes: { friendly_name: 'Movie Time' } },
        { entity_id: 'scene.bedtime', attributes: { friendly_name: 'Bedtime' } },
        { entity_id: 'light.living_room', attributes: { friendly_name: 'Living Room' } },
      ]);

      const tools = createSceneTools(mockClient as any);
      const result = await tools.list.handler({});

      expect(result).toHaveLength(2);
      expect(result[0].entity_id).toBe('scene.movie_time');
      expect(result[0].name).toBe('Movie Time');
    });
  });

  describe('ha_scene_activate', () => {
    it('should activate a scene', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createSceneTools(mockClient as any);
      const result = await tools.activate.handler({ entity_id: 'scene.movie_time' });

      expect(mockClient.post).toHaveBeenCalledWith('/api/services/scene/turn_on', {
        entity_id: 'scene.movie_time',
      });
      expect(result.success).toBe(true);
      expect(result.entity_id).toBe('scene.movie_time');
    });
  });

  describe('ha_scene_create', () => {
    it('should create a scene from current states', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createSceneTools(mockClient as any);
      const result = await tools.create.handler({
        name: 'My New Scene',
        entities: ['light.bedroom', 'light.kitchen'],
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/services/scene/create', {
        scene_id: 'my_new_scene',
        snapshot_entities: ['light.bedroom', 'light.kitchen'],
      });
      expect(result.success).toBe(true);
      expect(result.entity_id).toBe('scene.my_new_scene');
    });
  });

  describe('ha_scene_delete', () => {
    it('should delete a scene', async () => {
      mockClient.post.mockResolvedValue({});

      const tools = createSceneTools(mockClient as any);
      const result = await tools.delete.handler({ entity_id: 'scene.old_scene' });

      expect(mockClient.post).toHaveBeenCalledWith('/api/services/scene/delete', {
        entity_id: 'scene.old_scene',
      });
      expect(result.success).toBe(true);
      expect(result.entity_id).toBe('scene.old_scene');
    });
  });
});
