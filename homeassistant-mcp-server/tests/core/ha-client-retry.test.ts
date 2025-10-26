import { HomeAssistantClient } from '../../src/core/ha-client';
import { AxiosError } from 'axios';

describe('HomeAssistantClient retry logic', () => {
  it('should retry failed requests with exponential backoff', async () => {
    const client = new HomeAssistantClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      retry: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
      },
    });

    let attemptCount = 0;
    const mockError = new Error('Network error') as AxiosError;
    mockError.code = 'ECONNREFUSED';

    const mockApiClient = {
      get: jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw mockError;
        }
        return { data: { success: true } };
      })
    };

    (client as any).apiClient = mockApiClient;

    const result = await client.get('/api/states');

    expect(result).toEqual({ success: true });
    expect(mockApiClient.get).toHaveBeenCalledTimes(3);
    expect(attemptCount).toBe(3);
  });

  it('should fail after max retries exceeded', async () => {
    const client = new HomeAssistantClient({
      baseUrl: 'http://localhost:8123',
      token: 'test-token',
      retry: {
        maxRetries: 2,
        baseDelay: 50,
        maxDelay: 500,
      },
    });

    const mockError = new Error('Server error') as AxiosError;
    mockError.response = {
      status: 503,
      data: {},
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as any,
    };

    const mockApiClient = {
      get: jest.fn().mockRejectedValue(mockError)
    };

    (client as any).apiClient = mockApiClient;

    await expect(client.get('/api/states')).rejects.toThrow('Server error');
    expect(mockApiClient.get).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
