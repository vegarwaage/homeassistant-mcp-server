import { HomeAssistantClient } from '../../src/core/ha-client';

describe('HomeAssistantClient', () => {
  it('should create client with valid config', () => {
    const client = new HomeAssistantClient(
      'http://localhost:8123',
      'test-token'
    );
    expect(client).toBeInstanceOf(HomeAssistantClient);
  });
});

describe('HomeAssistantClient connection pooling', () => {
  it('should limit concurrent requests', async () => {
    const client = new HomeAssistantClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      maxConcurrent: 2,
    });

    // Mock to track concurrent calls
    const concurrentCalls: number[] = [];
    const mockApiClient = {
      get: jest.fn().mockImplementation(async () => {
        const current = (client as any).activeRequests;
        concurrentCalls.push(current);
        expect(current).toBeLessThanOrEqual(2);
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: [] };
      })
    };

    // Replace the apiClient with our mock
    (client as any).apiClient = mockApiClient;

    const requests = [
      client.get('/api/states'),
      client.get('/api/states'),
      client.get('/api/states'),
    ];

    await Promise.all(requests);
    expect(Math.max(...concurrentCalls)).toBe(2);
    expect(mockApiClient.get).toHaveBeenCalledTimes(3);
  });
});
