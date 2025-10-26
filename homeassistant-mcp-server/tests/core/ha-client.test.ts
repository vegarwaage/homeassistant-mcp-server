import { HAClient } from '../../src/core/ha-client';

describe('HAClient', () => {
  it('should create client with valid config', () => {
    const client = new HAClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
    });
    expect(client).toBeInstanceOf(HAClient);
  });
});
