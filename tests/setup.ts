import { beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  console.log('Test environment initialized');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Test environment cleaned up');
});

afterEach(() => {
  // Reset any mocks or spies after each test
  // This ensures test isolation
});

// Custom matchers can be added here if needed
// expect.extend({...});
