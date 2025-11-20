/**
 * API Test Setup Infrastructure
 * 
 * Provides real database testing with MSW for external services.
 * No more mocking internal business logic - test the real code paths.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { externalServiceHandlers } from '../mocks/external-services';
import { PrismaClient } from '@prisma/client';

// Test-specific database client that doesn't depend on SvelteKit env
const testDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
  log: ['error']
});

export const db = testDb;

// MSW server for external service mocking
export const server = setupServer(...externalServiceHandlers);

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset MSW handlers between tests
beforeEach(() => {
  server.resetHandlers();
});

// Clean up MSW server after all tests
afterAll(() => {
  server.close();
});

/**
 * Test Database Utilities
 * 
 * Uses real Prisma client with test database for integration testing.
 * Provides isolation and cleanup between tests.
 */

export async function clearTestDatabase() {
  // Clear in reverse dependency order to avoid foreign key constraints
  try {
    await db.template_campaign.deleteMany();
    await db.cWCJob.deleteMany();
    await db.analytics_event.deleteMany();
    await db.analytics_session.deleteMany();
    await db.user_representatives.deleteMany();
    await db.representative.deleteMany();
    await db.template.deleteMany();
    await db.session.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
  } catch (error) {
    // Ignore foreign key constraint errors during test cleanup
    console.warn('Database cleanup warning:', error instanceof Error ? error.message : error);
  }
}

export async function createTestUser(overrides?: Partial<any>) {
  return await db.user.create({
    data: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      trust_score: 100,
      // NO PII FIELDS - address data never stored in database per privacy architecture
      is_verified: true,
      ...overrides
    }
  });
}

export async function createTestTemplate(userId: string, overrides?: Partial<any>) {
  return await db.template.create({
    data: {
      id: 'test-template-123',
      slug: 'test-congressional-template',
      userId: userId, // Fix field name
      title: 'Test Congressional Template',
      description: 'A test template for congressional messaging',
      message_body: 'Dear [Representative Name], I am writing to express my views on [Issue]. [Personal Connection]. Thank you.',
      category: 'legislative',
      is_public: true,
      type: 'congressional',
      deliveryMethod: 'cwc',
      preview: 'Congressional template for expressing views',
      delivery_config: {},
      recipient_config: {},
      metrics: {},
      ...overrides
    }
  });
}

export async function createTestRepresentative(overrides?: Partial<any>) {
  return await db.representative.create({
    data: {
      id: 'test-rep-123',
      name: 'Test Representative',
      title: 'Representative',
      party: 'Democratic',
      state: 'CA',
      district: '12',
      email: 'test.rep@mail.house.gov',
      phone: '202-555-0123',
      office_address: '1234 Capitol Hill, Washington DC 20515',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides
    }
  });
}

export async function createTestSubmission(templateId: string, userId: string, overrides?: Partial<any>) {
  return await db.submission.create({
    data: {
      id: 'test-submission-123',
      template_id: templateId,
      user_id: userId,
      resolved_content: 'Dear Representative Smith, I am writing to express my views on climate change. As a parent, I am deeply concerned about the future. Thank you.',
      recipient_emails: ['test.rep@mail.house.gov'],
      delivery_status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides
    }
  });
}

/**
 * API Test Helpers
 * 
 * Utilities for testing SvelteKit API routes with real request/response handling.
 */

export function createMockRequest(options: {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}) {
  const url = new URL(options.url, 'http://localhost:5173');
  
  return new Request(url.toString(), {
    method: options.method,
    body: options.body,
    headers: {
      'content-type': 'application/json',
      ...options.headers
    }
  });
}

export function createMockRequestEvent(options: {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  locals?: Record<string, any>;
}) {
  const request = createMockRequest(options);
  
  return {
    request,
    params: options.params || {},
    url: new URL(options.url, 'http://localhost:5173'),
    locals: options.locals || {},
    getClientAddress: () => '127.0.0.1',
    platform: null,
    route: { id: options.url }
  };
}

/**
 * Test Session Helpers
 * 
 * For testing authenticated vs anonymous user flows.
 */

export async function createTestSession(userId: string) {
  const session = await db.session.create({
    data: {
      id: 'test-session-123',
      userId: userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: new Date()
    }
  });

  return {
    session,
    sessionCookie: `auth_session=${session.id}; Path=/; HttpOnly; SameSite=Lax`
  };
}

export function createGuestSession() {
  return {
    sessionToken: 'guest-token-123',
    sessionCookie: `guest_session=guest-token-123; Path=/; SameSite=Lax`
  };
}

/**
 * Test Data Cleanup
 * 
 * Ensures test isolation and prevents data pollution.
 */

beforeEach(async () => {
  await clearTestDatabase();
});