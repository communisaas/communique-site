import { beforeEach, afterEach, vi } from 'vitest';
import mockRegistry from '../mocks/registry';

/**
 * Global test setup that runs before each test
 */
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  mockRegistry.reset();
  
  // Setup environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  
  // Configure mock registry
  const mocks = mockRegistry.setupMocks();
  
  // Apply mocks using vitest's mock system
  Object.entries(mocks).forEach(([modulePath, mockImplementation]) => {
    vi.doMock(modulePath, () => mockImplementation);
  });
});

/**
 * Global test teardown that runs after each test
 */
afterEach(() => {
  // Clean up any test state
  vi.clearAllMocks();
  mockRegistry.reset();
  
  // Reset environment variables
  delete process.env.ENABLE_BETA;
  delete process.env.ENABLE_RESEARCH;
});

/**
 * Helper to enable beta features in tests
 */
export function enableBetaFeatures() {
  process.env.ENABLE_BETA = 'true';
  mockRegistry.reset();
  return mockRegistry.setupMocks();
}

/**
 * Helper to enable research features in tests
 */
export function enableResearchFeatures() {
  process.env.ENABLE_RESEARCH = 'true';
  mockRegistry.reset();
  return mockRegistry.setupMocks();
}

/**
 * Helper to create test context with common utilities
 */
export function createTestContext() {
  return {
    mockRegistry,
    enableBetaFeatures,
    enableResearchFeatures,
    // Add more test utilities as needed
  };
}