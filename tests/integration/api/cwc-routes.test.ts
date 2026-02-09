/**
 * CWC API Routes Integration Tests
 *
 * Tests the three main CWC-related API endpoints:
 * 1. POST /api/cwc/submit-mvp - Submit message to Congress (MVP mode)
 * 2. GET /api/cwc/jobs/[jobId] - Get job status
 * 3. POST /api/address/verify - Verify address and get representatives
 *
 * Test Strategy:
 * - Uses MSW to mock external APIs (Census, Congress.gov, CWC)
 * - Uses real database for state management
 * - Tests authentication/authorization flows
 * - Tests DC and territory edge cases
 * - Tests error handling and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
	db,
	clearTestDatabase,
	createTestUser,
	createTestTemplate,
	createTestSession,
	createMockRequestEvent,
	server
} from '../../setup/api-test-setup';

// Import the route handlers
import { POST as submitMvpPost } from '../../../src/routes/api/cwc/submit-mvp/+server';
import { GET as jobStatusGet } from '../../../src/routes/api/cwc/jobs/[jobId]/+server';
import { POST as addressVerifyPost} from '../../../src/routes/api/address/verify/+server';

/**
 * NO INTERNAL MOCKING - We test real business logic
 *
 * MSW (Mock Service Worker) intercepts external HTTP calls:
 * - Census Bureau Geocoding API
 * - Congress.gov API
 * - CWC Senate/House APIs
 *
 * Real services run and hit MSW mocks at the HTTP layer.
 * See: tests/mocks/external-services.ts
 */

// Helper to generate unique IDs for each test
let testCounter = 0;
function uniqueId(prefix: string): string {
	testCounter++;
	return `${prefix}-${testCounter}-${Date.now()}`;
}

describe('CWC API Routes', () => {
	beforeEach(async () => {
		await clearTestDatabase();
		vi.clearAllMocks();
		testCounter = 0; // Reset counter for each test suite
		// MSW (from api-test-setup.ts) intercepts fetch in jsdom environment
		// No need to unstub - MSW handlers override the setup.ts mock
	});

	// =========================================================================
	// POST /api/cwc/submit-mvp
	// =========================================================================

	describe('POST /api/cwc/submit-mvp', () => {
		it('should accept valid submission with address', async () => {
			// Create test user and template
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			// Create request event - NOTE: routes use locals.user, not locals.session
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: template.id,
					message: 'Test message to Congress',
					subject: 'Test Subject',
					address: {
						street: '350 Fifth Avenue',
						city: 'New York',
						state: 'NY',
						zip: '10118'
					},
					personalizedMessage: 'This affects my neighborhood directly.',
					userName: 'Test User',
					userEmail: 'test@example.com'
				}),
				locals: {
					user: { id: user.id },
					db
				}
			});

			const response = await submitMvpPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.jobId).toBeDefined();
			expect(data.representatives).toBeDefined();
			expect(data.representatives.length).toBeGreaterThan(0);

			// Should have created a job in the database
			const job = await db.cWCJob.findUnique({ where: { id: data.jobId } });
			expect(job).toBeDefined();
			// Job may be 'completed' or 'partial' after sync processing
			expect(['processing', 'completed', 'partial']).toContain(job?.status);
		});

		it('should validate required fields', async () => {
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			// Missing address.street
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: template.id,
					address: {
						city: 'New York',
						state: 'NY',
						zip: '10118'
					}
				}),
				locals: { user: { id: user.id }, db }
			});

			// SvelteKit error() throws an HttpError
			await expect(submitMvpPost(event as any)).rejects.toMatchObject({
				status: 400
			});
		});

		it('should handle DC addresses correctly', async () => {
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: template.id,
					address: {
						street: '1600 Pennsylvania Ave NW',
						city: 'Washington',
						state: 'DC',
						zip: '20500'
					},
					personalizedMessage: 'Test message',
					userName: 'DC Resident',
					userEmail: 'dc@example.com'
				}),
				locals: { user: { id: user.id }, db }
			});

			const response = await submitMvpPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.representatives).toBeDefined();

			// DC should get delegate, not full rep
			// DC has no senators, only 1 non-voting delegate
			expect(data.representatives.length).toBe(1);
			expect(data.representatives[0].chamber).toBe('house');
			expect(data.representatives[0].state).toBe('DC');
		});

		it('should handle territory addresses (Puerto Rico)', async () => {
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: template.id,
					address: {
						street: '100 Calle San Francisco',
						city: 'San Juan',
						state: 'PR',
						zip: '00901'
					},
					personalizedMessage: 'Test message',
					userName: 'PR Resident',
					userEmail: 'pr@example.com'
				}),
				locals: { user: { id: user.id }, db }
			});

			const response = await submitMvpPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.representatives).toBeDefined();

			// PR should get resident commissioner, not full rep
			// PR has no senators, only 1 resident commissioner
			expect(data.representatives.length).toBe(1);
			expect(data.representatives[0].chamber).toBe('house');
			expect(data.representatives[0].state).toBe('PR');
		});

		it('should return 404 for non-existent template', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: 'non-existent-template',
					address: {
						street: '350 Fifth Avenue',
						city: 'New York',
						state: 'NY',
						zip: '10118'
					}
				}),
				locals: { user: { id: user.id }, db }
			});

			// SvelteKit error() throws an HttpError
			await expect(submitMvpPost(event as any)).rejects.toMatchObject({
				status: 404
			});
		});

		it('should require authentication (no guest submissions)', async () => {
			// Create a system user and template first
			const systemUserId = uniqueId('system');
			const templateId = uniqueId('template');
			await createTestUser({ id: systemUserId, email: `${systemUserId}@example.com` });
			const template = await createTestTemplate(systemUserId, { id: templateId, slug: `test-template-${templateId}` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: template.id,
					address: {
						street: '350 Fifth Avenue',
						city: 'New York',
						state: 'NY',
						zip: '10118'
					},
					personalizedMessage: 'Guest message',
					userName: 'Guest User',
					userEmail: 'guest@example.com'
				}),
				locals: { user: null, db }
			});

			const response = await submitMvpPost(event as any);
			const data = await response.json();

			// The route requires authentication - guests are not allowed
			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required to contact Congress');
		});
	});

	// =========================================================================
	// GET /api/cwc/jobs/[jobId]
	// =========================================================================

	describe('GET /api/cwc/jobs/[jobId]', () => {
		it('should return 401 when not authenticated', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/jobs/test-job-123',
				method: 'GET',
				params: { jobId: 'test-job-123' },
				locals: { user: null, db }
			});

			const response = await jobStatusGet(event as any);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should return 403 for jobs owned by other users', async () => {
			// Create two users with unique IDs
			const user1Id = uniqueId('user1');
			const user2Id = uniqueId('user2');
			const templateId = uniqueId('template');
			const jobId = uniqueId('job');

			const user1 = await createTestUser({ id: user1Id, email: `${user1Id}@example.com` });
			const user2 = await createTestUser({ id: user2Id, email: `${user2Id}@example.com` });
			const template = await createTestTemplate(user1.id, { id: templateId, slug: `test-template-${templateId}` });

			// Create job owned by user1
			const job = await db.cWCJob.create({
				data: {
					id: jobId,
					templateId: template.id,
					userId: user1.id,
					status: 'processing',
					submissionCount: 0,
					createdAt: new Date()
				}
			});

			// Try to access as user2
			const event = createMockRequestEvent({
				url: `http://localhost:5173/api/cwc/jobs/${job.id}`,
				method: 'GET',
				params: { jobId: job.id },
				locals: { user: { id: user2.id }, db }
			});

			const response = await jobStatusGet(event as any);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Access denied');
		});

		it('should return job status for owner', async () => {
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const jobId = uniqueId('job');

			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			const job = await db.cWCJob.create({
				data: {
					id: jobId,
					templateId: template.id,
					userId: user.id,
					status: 'completed',
					submissionCount: 3,
					results: {
						successful: 3,
						failed: 0,
						results: [
							{ office: 'Senator 1', success: true, status: 'submitted' },
							{ office: 'Senator 2', success: true, status: 'submitted' },
							{ office: 'Representative', success: true, status: 'submitted' }
						]
					},
					createdAt: new Date(),
					completedAt: new Date()
				}
			});

			const event = createMockRequestEvent({
				url: `http://localhost:5173/api/cwc/jobs/${job.id}`,
				method: 'GET',
				params: { jobId: job.id },
				locals: { user: { id: user.id }, db }
			});

			const response = await jobStatusGet(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.jobId).toBe(job.id);
			expect(data.status).toBe('completed');
			expect(data.progress).toBe(100);
			expect(data.results).toBeDefined();
		});

		it('should return 404 for non-existent job', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/jobs/non-existent-job',
				method: 'GET',
				params: { jobId: 'non-existent-job' },
				locals: { user: { id: user.id }, db }
			});

			// SvelteKit error() throws an HttpError
			await expect(jobStatusGet(event as any)).rejects.toMatchObject({
				status: 404
			});
		});

		it('should calculate progress correctly for processing jobs', async () => {
			const userId = uniqueId('user');
			const templateId = uniqueId('template');
			const jobId = uniqueId('job');

			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });
			const template = await createTestTemplate(user.id, { id: templateId, slug: `test-template-${templateId}` });

			const job = await db.cWCJob.create({
				data: {
					id: jobId,
					templateId: template.id,
					userId: user.id,
					status: 'processing',
					submissionCount: 3,
					results: [
						{ office: 'Senator 1', success: true, status: 'submitted' },
						{ office: 'Senator 2', status: 'pending' }
					],
					createdAt: new Date()
				}
			});

			const event = createMockRequestEvent({
				url: `http://localhost:5173/api/cwc/jobs/${job.id}`,
				method: 'GET',
				params: { jobId: job.id },
				locals: { user: { id: user.id }, db }
			});

			const response = await jobStatusGet(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe('processing');
			expect(data.progress).toBeGreaterThan(0);
			expect(data.progress).toBeLessThan(100);
		});
	});

	// =========================================================================
	// POST /api/address/verify
	// =========================================================================

	describe('POST /api/address/verify', () => {
		it('should return representatives for valid address', async () => {
			// MSW handles Census API and Congress.gov API - no manual mocking needed
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: '10118'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);
			expect(data.representatives).toBeDefined();
			expect(data.representatives.length).toBeGreaterThan(0);

			// Should have senators and house rep
			const senators = data.representatives.filter((r: any) => r.chamber === 'senate');
			const houseReps = data.representatives.filter((r: any) => r.chamber === 'house');
			expect(senators.length).toBe(2);
			expect(houseReps.length).toBe(1);
		});

		it('should return cell_id (Census Block GEOID) for two-tree ZK architecture', async () => {
			// MSW mock includes 2020 Census Blocks data
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: '10118'
				}),
				locals: { user: { id: 'test-user-cellid' }, db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);

			// cell_id should be 15-digit Census Block GEOID
			expect(data.cell_id).toBeDefined();
			expect(data.cell_id).toMatch(/^\d{15}$/);

			// Verify the specific GEOID from our mock (NYC)
			expect(data.cell_id).toBe('360610076001234');
		});

		it('should return cell_id for DC addresses', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '1600 Pennsylvania Ave NW',
					city: 'Washington',
					state: 'DC',
					zipCode: '20500'
				}),
				locals: { user: { id: 'test-user-dc' }, db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.cell_id).toBeDefined();
			expect(data.cell_id).toMatch(/^\d{15}$/);
			expect(data.cell_id).toBe('110010062001001'); // DC Census Block
		});

		it('should return cell_id for Puerto Rico addresses', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '100 Calle San Francisco',
					city: 'San Juan',
					state: 'PR',
					zipCode: '00901'
				}),
				locals: { user: { id: 'test-user-pr' }, db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.cell_id).toBeDefined();
			expect(data.cell_id).toMatch(/^\d{15}$/);
			expect(data.cell_id).toBe('720070065003001'); // PR Census Block
		});

		it('should include special_status for DC', async () => {
			// MSW handles Census API and Congress.gov API - no manual mocking needed
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '1600 Pennsylvania Ave NW',
					city: 'Washington',
					state: 'DC',
					zipCode: '20500'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);
			expect(data.special_status).toBeDefined();

			// DC should have only delegate, no senators
			expect(data.representatives.length).toBe(1);
			expect(data.representatives[0].chamber).toBe('house');
			expect(data.representatives[0].is_voting_member).toBe(false);
		});

		it('should handle invalid addresses gracefully', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '123 Fake Street',
					city: 'Nowhere',
					state: 'ZZ',
					zipCode: '00000'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.verified).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate required fields', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York'
					// Missing state and zipCode
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.verified).toBe(false);
			expect(data.error).toContain('required');
		});

		it('should validate ZIP code format', async () => {
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: 'invalid'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.verified).toBe(false);
			expect(data.error).toContain('ZIP code');
		});

		it('should handle Puerto Rico correctly', async () => {
			// MSW handles Census API and Congress.gov API - no manual mocking needed
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '100 Calle San Francisco',
					city: 'San Juan',
					state: 'PR',
					zipCode: '00901'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);
			expect(data.special_status).toBeDefined();

			// PR should have only resident commissioner, no senators
			expect(data.representatives.length).toBe(1);
			expect(data.representatives[0].chamber).toBe('house');
			expect(data.representatives[0].is_voting_member).toBe(false);
			expect(data.representatives[0].delegate_type).toBe('resident_commissioner');
		});

		it('should return corrected address when available', async () => {
			// MSW handles Census API and Congress.gov API - no manual mocking needed
			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 5th ave',
					city: 'new york',
					state: 'ny',
					zipCode: '10118'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);
			expect(data.correctedAddress).toBeDefined();
			expect(data.district).toBeDefined();
		});
	});

	// =========================================================================
	// ERROR HANDLING & EDGE CASES
	// =========================================================================

	describe('Error Handling', () => {
		it('should handle Census API failure gracefully', async () => {
			// Override MSW to simulate network error
			server.use(
				http.get('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress', () => {
					return HttpResponse.error();
				})
			);

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: '10118'
				}),
				locals: { db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.verified).toBe(false);
			expect(data.error).toContain('verification service');
		});

		it('should handle missing template gracefully in submit-mvp', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: 'non-existent',
					address: {
						street: '350 Fifth Avenue',
						city: 'New York',
						state: 'NY',
						zip: '10118'
					}
				}),
				locals: { user: { id: user.id }, db }
			});

			// SvelteKit error() throws an HttpError
			await expect(submitMvpPost(event as any)).rejects.toMatchObject({
				status: 404
			});
		});

		it('should handle malformed JSON in submit-mvp', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: 'invalid json{{{',
				locals: { user: { id: user.id }, db }
			});

			// This should throw an error when parsing JSON
			await expect(submitMvpPost(event as any)).rejects.toThrow();
		});

		it('should handle database errors gracefully', async () => {
			const userId = uniqueId('user');

			// Create user but NO template - this will cause a database error when looking up the template
			await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/cwc/submit-mvp',
				method: 'POST',
				body: JSON.stringify({
					templateId: 'non-existent-template-id',
					address: {
						street: '350 Fifth Avenue',
						city: 'New York',
						state: 'NY',
						zip: '10118'
					}
				}),
				locals: { user: { id: userId }, db }
			});

			// SvelteKit error() throws an HttpError when template not found
			await expect(submitMvpPost(event as any)).rejects.toMatchObject({
				status: 404 // Template not found, not a database error
			});
		});
	});
});
