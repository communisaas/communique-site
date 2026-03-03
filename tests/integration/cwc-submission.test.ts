/**
 * CWC Submission Flow Integration Tests
 *
 * Tests the core submission endpoint (POST /api/submissions/create) which:
 * 1. Validates authentication + credential TTL
 * 2. Validates required fields and template existence
 * 3. Checks nullifier uniqueness (double-action prevention)
 * 4. Creates a Submission record in the database
 * 5. Kicks off background delivery, blockchain verification, and engagement tracking
 *
 * Test Strategy:
 * - Real database operations via test Prisma client (requires running test DB)
 * - Real validation logic (credential-policy, field validation)
 * - Mocked external boundaries: delivery worker, blockchain, engagement tracking
 * - Mocked pseudonymous ID generation (requires env var)
 *
 * DB-dependent tests are skipped when no test database is reachable.
 * Auth/validation tests run unconditionally (they reject before any DB call).
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import {
	clearTestDatabase,
	createTestUser,
	createTestTemplate,
	createTestSubmission,
	createMockRequestEvent,
	db
} from '../setup/api-test-setup';

// ---------------------------------------------------------------------------
// Database connectivity check — skip DB-dependent tests when unreachable
// ---------------------------------------------------------------------------
let dbAvailable = false;
beforeAll(async () => {
	try {
		await db.$queryRaw`SELECT 1`;
		dbAvailable = true;
	} catch {
		console.warn(
			'[cwc-submission] Test database unreachable — DB-dependent tests will be skipped.\n' +
			'Start a local test DB or set DATABASE_URL to run the full suite.'
		);
	}
});

// ---------------------------------------------------------------------------
// Mocks for external boundaries (vi.hoisted for proper hoisting)
// ---------------------------------------------------------------------------

const { mockProcessDelivery } = vi.hoisted(() => ({
	mockProcessDelivery: vi.fn().mockResolvedValue({
		success: true,
		results: [{ office: 'Test Office', chamber: 'senate', status: 'submitted', messageId: 'test-msg-1' }]
	})
}));

// Mock the database module — vitest.config.ts already resolves $lib/core/db
// to tests/mocks/db-mock.ts via the dbMockPlugin, so the route handler
// will use the test Prisma client. No vi.mock needed for db.

// Mock SvelteKit $types to avoid resolution issues
vi.mock('../../src/routes/api/submissions/create/$types', () => ({}));

// Mock pseudonymous ID computation (requires SUBMISSION_ANONYMIZATION_SALT env var)
vi.mock('$lib/core/privacy/pseudonymous-id', () => ({
	computePseudonymousId: vi.fn((userId: string) => `pseudo-${userId}`)
}));

// Mock delivery worker -- the real implementation decrypts witness data,
// looks up representatives, and calls the CWC API. We test that separately.
vi.mock('$lib/server/delivery-worker', () => ({
	processSubmissionDelivery: (...args: unknown[]) => mockProcessDelivery(...args)
}));

// Mock Shadow Atlas engagement registration (fire-and-forget)
vi.mock('$lib/core/shadow-atlas/client', () => ({
	registerEngagement: vi.fn().mockResolvedValue({ alreadyRegistered: true })
}));

// Mock blockchain verification (fire-and-forget)
vi.mock('$lib/core/blockchain/district-gate-client', () => ({
	verifyOnChain: vi.fn().mockResolvedValue({ success: true, txHash: '0xmockhash' })
}));

// Mock blockchain retry queue
vi.mock('$lib/core/blockchain/submission-retry-queue', () => ({
	queueForRetry: vi.fn().mockResolvedValue(undefined)
}));

// Import the handler AFTER mocks are established
import { POST } from '../../src/routes/api/submissions/create/+server';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Build a valid submission request body with required fields. */
function validSubmissionBody(overrides: Record<string, unknown> = {}) {
	return {
		templateId: 'test-template-123',
		proof: '0xdeadbeef',
		publicInputs: { merkleRoot: '0x1', nullifier: '0x2', actionDomain: 'test-action' },
		nullifier: `nullifier-${Date.now()}-${Math.random()}`,
		encryptedWitness: 'base64encryptedwitness',
		witnessNonce: 'base64nonce',
		ephemeralPublicKey: 'base64pubkey',
		teeKeyId: 'tee-key-1',
		...overrides
	};
}

/** Create a mock request event for an authenticated, verified user. */
function authenticatedEvent(body: Record<string, unknown>, userOverrides: Record<string, unknown> = {}) {
	return createMockRequestEvent({
		url: '/api/submissions/create',
		method: 'POST',
		body: JSON.stringify(body),
		locals: {
			session: { userId: 'test-user-123' },
			user: {
				id: 'test-user-123',
				verified_at: new Date(), // Fresh verification
				district_hash: 'hash-ca-12',
				wallet_address: null,
				identity_commitment: null,
				trust_tier: 1,
				...userOverrides
			}
		}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/submissions/create', () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		// Re-apply default mock implementations (vi.clearAllMocks strips them)
		mockProcessDelivery.mockResolvedValue({
			success: true,
			results: [{ office: 'Test Office', chamber: 'senate', status: 'submitted', messageId: 'test-msg-1' }]
		});

		// Seed prerequisite data only when DB is available
		if (dbAvailable) {
			await clearTestDatabase();
			await createTestUser({ id: 'test-user-123' });
			await createTestTemplate('test-user-123');
		}
	});

	// =========================================================================
	// Authentication & Authorization (no DB needed — rejects before DB call)
	// =========================================================================

	describe('Authentication & Authorization', () => {
		it('should reject unauthenticated requests (no session)', async () => {
			const body = validSubmissionBody();
			const event = createMockRequestEvent({
				url: '/api/submissions/create',
				method: 'POST',
				body: JSON.stringify(body),
				locals: { session: null, user: null }
			}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

			await expect(POST(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should reject requests with session but no userId', async () => {
			const body = validSubmissionBody();
			const event = createMockRequestEvent({
				url: '/api/submissions/create',
				method: 'POST',
				body: JSON.stringify(body),
				locals: { session: {}, user: null }
			}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

			await expect(POST(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should return 403 when user has not verified their address', async () => {
			const body = validSubmissionBody();
			const event = createMockRequestEvent({
				url: '/api/submissions/create',
				method: 'POST',
				body: JSON.stringify(body),
				locals: {
					session: { userId: 'test-user-123' },
					user: {
						id: 'test-user-123',
						verified_at: null // Not verified
					}
				}
			}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.code).toBe('NOT_VERIFIED');
			expect(data.requiresReverification).toBe(true);
		});

		it('should return 403 when credential TTL has expired (verified_at too old)', async () => {
			// Credential older than 90 days (constituent_message TTL)
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 100);

			const body = validSubmissionBody();
			const event = authenticatedEvent(body, { verified_at: oldDate });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.code).toBe('CREDENTIAL_TTL_EXCEEDED');
			expect(data.requiresReverification).toBe(true);
			expect(data.action).toBe('constituent_message');
		});
	});

	// =========================================================================
	// Field Validation (no DB needed — rejects at field check before DB)
	// =========================================================================

	describe('Field Validation', () => {
		it('should reject request missing templateId', async () => {
			const body = validSubmissionBody({ templateId: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing proof', async () => {
			const body = validSubmissionBody({ proof: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing publicInputs', async () => {
			const body = validSubmissionBody({ publicInputs: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing nullifier', async () => {
			const body = validSubmissionBody({ nullifier: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing encryptedWitness', async () => {
			const body = validSubmissionBody({ encryptedWitness: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing witnessNonce', async () => {
			const body = validSubmissionBody({ witnessNonce: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing ephemeralPublicKey', async () => {
			const body = validSubmissionBody({ ephemeralPublicKey: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request missing teeKeyId', async () => {
			const body = validSubmissionBody({ teeKeyId: undefined });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should reject request with all required fields missing', async () => {
			const event = authenticatedEvent({});

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});
	});

	// =========================================================================
	// DB-Dependent Tests (require running test database)
	// =========================================================================

	describe.runIf(dbAvailable)('Template Validation (DB)', () => {
		it('should accept credential verified within 90-day TTL window', async () => {
			// Credential 80 days old -- within 90-day window
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 80);

			const body = validSubmissionBody();
			const event = authenticatedEvent(body, { verified_at: recentDate });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		it('should return 404 for non-existent template', async () => {
			const body = validSubmissionBody({ templateId: 'non-existent-template-id' });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 404 });
		});
	});

	// =========================================================================
	// Successful Submission (DB required)
	// =========================================================================

	describe.runIf(dbAvailable)('Successful Submission', () => {
		it('should create a submission and return success', async () => {
			const body = validSubmissionBody();
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.submissionId).toBeDefined();
			expect(data.status).toBe('pending');
			expect(data.message).toContain('Submission created');
		});

		it('should persist submission in the database with correct fields', async () => {
			const nullifier = `nullifier-persist-test-${Date.now()}`;
			const body = validSubmissionBody({ nullifier });
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			// Verify the record was persisted
			const submission = await db.submission.findUnique({
				where: { id: data.submissionId }
			});

			expect(submission).not.toBeNull();
			expect(submission!.pseudonymous_id).toBe('pseudo-test-user-123');
			expect(submission!.template_id).toBe('test-template-123');
			expect(submission!.proof_hex).toBe('0xdeadbeef');
			expect(submission!.nullifier).toBe(nullifier);
			expect(submission!.encrypted_witness).toBe('base64encryptedwitness');
			expect(submission!.witness_nonce).toBe('base64nonce');
			expect(submission!.ephemeral_public_key).toBe('base64pubkey');
			expect(submission!.tee_key_id).toBe('tee-key-1');
			expect(submission!.delivery_status).toBe('pending');
			expect(submission!.verification_status).toBe('pending');
			expect(submission!.witness_expires_at).toBeInstanceOf(Date);
		});

		it('should set witness_expires_at to 30 days from now', async () => {
			const body = validSubmissionBody();
			const event = authenticatedEvent(body);

			const beforeTime = Date.now();
			const response = await POST(event);
			const data = await response.json();
			const afterTime = Date.now();

			const submission = await db.submission.findUnique({
				where: { id: data.submissionId }
			});

			const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
			const expiryTime = submission!.witness_expires_at!.getTime();

			// Expiry should be within the test execution window + 30 days
			expect(expiryTime).toBeGreaterThanOrEqual(beforeTime + THIRTY_DAYS_MS);
			expect(expiryTime).toBeLessThanOrEqual(afterTime + THIRTY_DAYS_MS);
		});

		it('should extract action_id from publicInputs.actionDomain', async () => {
			const body = validSubmissionBody({
				publicInputs: { actionDomain: 'custom-action-domain', merkleRoot: '0x1' }
			});
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			const submission = await db.submission.findUnique({
				where: { id: data.submissionId }
			});

			expect(submission!.action_id).toBe('custom-action-domain');
		});

		it('should fall back to templateId for action_id when actionDomain is absent', async () => {
			const body = validSubmissionBody({
				publicInputs: { merkleRoot: '0x1' } // No actionDomain
			});
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			const submission = await db.submission.findUnique({
				where: { id: data.submissionId }
			});

			expect(submission!.action_id).toBe('test-template-123');
		});

		it('should trigger background delivery processing', async () => {
			const body = validSubmissionBody();
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			// Allow microtasks to flush (fire-and-forget promises)
			await new Promise((r) => setTimeout(r, 50));

			expect(mockProcessDelivery).toHaveBeenCalledWith(
				data.submissionId,
				expect.anything() // db client
			);
		});
	});

	// =========================================================================
	// Nullifier Uniqueness (Double-Action Prevention)
	// =========================================================================

	describe.runIf(dbAvailable)('Nullifier Uniqueness', () => {
		it('should reject duplicate nullifier from a different user', async () => {
			const sharedNullifier = `shared-nullifier-${Date.now()}`;

			// Create a submission with this nullifier for a different pseudonymous ID
			await createTestSubmission('test-template-123', 'test-user-123', {
				id: 'existing-submission',
				nullifier: sharedNullifier,
				pseudonymous_id: 'pseudo-different-user' // Different user
			});

			const body = validSubmissionBody({ nullifier: sharedNullifier });
			const event = authenticatedEvent(body);

			await expect(POST(event)).rejects.toMatchObject({ status: 409 });
		});

		it('should return existing submission for same user retrying with same nullifier', async () => {
			const sharedNullifier = `retry-nullifier-${Date.now()}`;

			// Create existing submission with matching pseudonymous_id
			await createTestSubmission('test-template-123', 'test-user-123', {
				id: 'existing-retry-submission',
				nullifier: sharedNullifier,
				pseudonymous_id: 'pseudo-test-user-123' // Same user (matches mock)
			});

			const body = validSubmissionBody({ nullifier: sharedNullifier });
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			// Should return the existing submission ID
			expect(data.submissionId).toBe('existing-retry-submission');
		});
	});

	// =========================================================================
	// Idempotency Key
	// =========================================================================

	describe.runIf(dbAvailable)('Idempotency', () => {
		it('should return existing submission when retried with same idempotency key', async () => {
			const idempotencyKey = `idempotent-${Date.now()}`;

			// First submission
			const body1 = validSubmissionBody({ idempotencyKey });
			const event1 = authenticatedEvent(body1);
			const response1 = await POST(event1);
			const data1 = await response1.json();

			expect(response1.status).toBe(200);
			expect(data1.success).toBe(true);
			const firstSubmissionId = data1.submissionId;

			// Retry with same idempotency key (different nullifier should be ignored)
			const body2 = validSubmissionBody({
				idempotencyKey,
				nullifier: `different-nullifier-${Date.now()}`
			});
			const event2 = authenticatedEvent(body2);
			const response2 = await POST(event2);
			const data2 = await response2.json();

			expect(response2.status).toBe(200);
			expect(data2.submissionId).toBe(firstSubmissionId);
		});

		it('should create separate submissions for different idempotency keys', async () => {
			const body1 = validSubmissionBody({ idempotencyKey: 'key-a' });
			const event1 = authenticatedEvent(body1);
			const response1 = await POST(event1);
			const data1 = await response1.json();

			const body2 = validSubmissionBody({
				idempotencyKey: 'key-b',
				nullifier: `nullifier-b-${Date.now()}`
			});
			const event2 = authenticatedEvent(body2);
			const response2 = await POST(event2);
			const data2 = await response2.json();

			expect(data1.submissionId).not.toBe(data2.submissionId);
		});

		it('should work without an idempotency key', async () => {
			const body = validSubmissionBody({ idempotencyKey: undefined });
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});
	});

	// =========================================================================
	// Delivery Worker Integration
	// =========================================================================

	describe.runIf(dbAvailable)('Delivery Worker Integration', () => {
		it('should call delivery worker with submission ID and database client', async () => {
			const body = validSubmissionBody();
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			// Allow fire-and-forget promises to resolve
			await new Promise((r) => setTimeout(r, 50));

			expect(mockProcessDelivery).toHaveBeenCalledTimes(1);
			const [submissionId, dbClient] = mockProcessDelivery.mock.calls[0];
			expect(submissionId).toBe(data.submissionId);
			expect(dbClient).toBeDefined();
		});

		it('should not block response if delivery worker throws', async () => {
			mockProcessDelivery.mockRejectedValueOnce(new Error('Delivery failed'));

			const body = validSubmissionBody();
			const event = authenticatedEvent(body);

			// Should still return success -- delivery is fire-and-forget
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});
	});

	// =========================================================================
	// Trust Tier Promotion
	// =========================================================================

	describe.runIf(dbAvailable)('Trust Tier Promotion', () => {
		it('should promote user from tier 1 to tier 2 on successful submission', async () => {
			// User starts at tier 1 (default from createTestUser is trust_score=100, but trust_tier defaults to 1)
			const user = await db.user.findUnique({ where: { id: 'test-user-123' } });
			expect(user!.trust_tier).toBe(1);

			const body = validSubmissionBody();
			const event = authenticatedEvent(body, { trust_tier: 1 });

			await POST(event);

			// Allow fire-and-forget to complete
			await new Promise((r) => setTimeout(r, 100));

			const updatedUser = await db.user.findUnique({ where: { id: 'test-user-123' } });
			expect(updatedUser!.trust_tier).toBe(2);
		});

		it('should not demote user already at tier 2 or higher', async () => {
			// Set user to tier 3
			await db.user.update({
				where: { id: 'test-user-123' },
				data: { trust_tier: 3 }
			});

			const body = validSubmissionBody();
			const event = authenticatedEvent(body, { trust_tier: 3 });

			await POST(event);

			await new Promise((r) => setTimeout(r, 100));

			const updatedUser = await db.user.findUnique({ where: { id: 'test-user-123' } });
			// Should remain at tier 3, not be set to 2
			expect(updatedUser!.trust_tier).toBe(3);
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe.runIf(dbAvailable)('Edge Cases', () => {
		it('should handle empty string values for optional fields gracefully', async () => {
			// proof, publicInputs etc. are required and non-empty, but idempotencyKey is optional
			const body = validSubmissionBody({ idempotencyKey: null });
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		it('should store publicInputs as JSON in the database', async () => {
			const complexInputs = {
				merkleRoot: '0xabcdef1234567890',
				nullifier: '0x9876543210fedcba',
				actionDomain: 'climate-petition-2026',
				publicInputsArray: Array(31).fill('0x00')
			};

			const body = validSubmissionBody({ publicInputs: complexInputs });
			const event = authenticatedEvent(body);

			const response = await POST(event);
			const data = await response.json();

			const submission = await db.submission.findUnique({
				where: { id: data.submissionId }
			});

			expect(submission!.public_inputs).toEqual(complexInputs);
		});

		it('should handle concurrent submissions with different nullifiers', async () => {
			const body1 = validSubmissionBody({
				nullifier: `concurrent-1-${Date.now()}`
			});
			const body2 = validSubmissionBody({
				nullifier: `concurrent-2-${Date.now()}`
			});

			const event1 = authenticatedEvent(body1);
			const event2 = authenticatedEvent(body2);

			const [response1, response2] = await Promise.all([
				POST(event1),
				POST(event2)
			]);

			const [data1, data2] = await Promise.all([
				response1.json(),
				response2.json()
			]);

			expect(data1.success).toBe(true);
			expect(data2.success).toBe(true);
			expect(data1.submissionId).not.toBe(data2.submissionId);
		});
	});
});
