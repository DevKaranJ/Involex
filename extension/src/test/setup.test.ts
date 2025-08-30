// Simple test to validate Jest setup
describe('Jest Setup Validation', () => {
  test('should be able to run basic tests', () => {
    expect(true).toBe(true);
  });

  test('should have Chrome mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.storage).toBeDefined();
  });

  test('should be able to use async/await', async () => {
    const promise = Promise.resolve('test');
    const result = await promise;
    expect(result).toBe('test');
  });
});
