import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Global test setup that runs before each test
 */
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Setup environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
});

/**
 * Global test teardown that runs after each test
 */
afterEach(() => {
  // Clean up any test state
  vi.clearAllMocks();
  
  // Reset environment variables
  delete process.env.ENABLE_BETA;
  delete process.env.ENABLE_RESEARCH;
});