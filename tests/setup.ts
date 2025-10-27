// ABOUTME: Test setup file for mocking Home Assistant API
// ABOUTME: Provides mock client and common test utilities

export class MockHAClient {
  public get = jest.fn();
  public post = jest.fn();
  public delete = jest.fn();
  public patch = jest.fn();
  public renderTemplate = jest.fn();
}

export function createMockResponse(data: any, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  };
}
