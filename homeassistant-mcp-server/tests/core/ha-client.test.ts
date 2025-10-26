import { HomeAssistantClient } from '../../src/ha-client';

describe('HomeAssistantClient', () => {
  it('should create client with valid config', () => {
    const client = new HomeAssistantClient(
      'http://localhost:8123',
      'test-token'
    );
    expect(client).toBeInstanceOf(HomeAssistantClient);
  });
});
