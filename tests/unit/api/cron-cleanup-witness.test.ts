/**
 * Unit Tests: GET /api/cron/cleanup-witness
 *
 * Tests the daily PII destruction cron job which:
 * 1. Authenticates via CRON_SECRET bearer token in production
 * 2. Skips auth in dev mode
 * 3. NULLs encrypted_witness, witness_nonce, ephemeral_public_key for expired submissions
 * 4. Only processes non-empty witnesses (idempotent)
 *
 * Security properties tested:
 * - Bearer token authentication (CRON_SECRET)
 * - PII destruction (data minimization compliance)
 * - Idempotency (re-running doesn't affect already-cleaned records)
 * - Missing CRON_SECRET detection (500 in production)
 * - Error handling and logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const { mockUpdateMany, mockDev } = vi.hoisted(() => ({
	mockUpdateMany: vi.fn(),
	mockDev: { value: false }
}));

vi.mock('$lib/core/db', () => ({
	prisma: {
		submission: {
			updateMany: (...args: unknown[]) => mockUpdateMany(...args)
		}
	},
	db: {
		submission: {
			updateMany: (...args: unknown[]) => mockUpdateMany(...args)
		}
	}
}));

vi.mock('$app/environment', () => ({
	get dev() {
		return mockDev.value;
	},
	building: false,
	browser: false
}));

// Mock $types
vi.mock('../../../src/routes/api/cron/cleanup-witness/$types', () => ({}));

// Import handler AFTER mocks
const { GET } = await import('../../../src/routes/api/cron/cleanup-witness/+server');

// =============================================================================
// HELPERS
// =============================================================================

function createEvent(authHeader?: string): any {
	const headers = new Headers();
	if (authHeader) {
		headers.set('authorization', authHeader);
	}
	return {
		request: {
			headers
		}
	};
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/cron/cleanup-witness', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		mockDev.value = false;
		mockUpdateMany.mockResolvedValue({ count: 5 });
		// Reset env
		process.env.CRON_SECRET = 'test-cron-secret';
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	// =========================================================================
	// Authentication (Production Mode)
	// =========================================================================

	describe('Authentication (Production)', () => {
		it('should throw 500 when CRON_SECRET is not configured', async () => {
			delete process.env.CRON_SECRET;
			const event = createEvent('Bearer some-token');

			await expect(GET(event)).rejects.toMatchObject({ status: 500 });
		});

		it('should throw 401 when authorization header is missing', async () => {
			const event = createEvent();

			await expect(GET(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should throw 401 when bearer token does not match CRON_SECRET', async () => {
			const event = createEvent('Bearer wrong-secret');

			await expect(GET(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should throw 401 when authorization header uses wrong scheme', async () => {
			// Token value matches but "Bearer " prefix is stripped, so comparison fails
			const event = createEvent('Basic test-cron-secret');

			await expect(GET(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should succeed with correct bearer token', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);

			expect(response.status).toBe(200);
		});

		it('should extract token by stripping "Bearer " prefix', async () => {
			// Verify it handles the exact "Bearer " prefix
			process.env.CRON_SECRET = 'my-secret-123';
			const event = createEvent('Bearer my-secret-123');

			const response = await GET(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Authentication (Dev Mode)
	// =========================================================================

	describe('Authentication (Dev Mode)', () => {
		beforeEach(() => {
			mockDev.value = true;
		});

		it('should skip auth in dev mode (no authorization header needed)', async () => {
			delete process.env.CRON_SECRET;
			const event = createEvent();

			const response = await GET(event);

			expect(response.status).toBe(200);
		});

		it('should skip auth in dev mode even with wrong token', async () => {
			const event = createEvent('Bearer wrong-secret');

			const response = await GET(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Happy Path (Witness Cleanup)
	// =========================================================================

	describe('Witness Cleanup', () => {
		it('should update expired witnesses with empty/null PII fields', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const beforeCall = Date.now();
			await GET(event);
			const afterCall = Date.now();

			expect(mockUpdateMany).toHaveBeenCalledTimes(1);
			const callArgs = mockUpdateMany.mock.calls[0][0];

			// Should filter by witness_expires_at < now
			const ltDate = callArgs.where.witness_expires_at.lt as Date;
			expect(ltDate.getTime()).toBeGreaterThanOrEqual(beforeCall);
			expect(ltDate.getTime()).toBeLessThanOrEqual(afterCall);

			// Should only process non-empty witnesses
			expect(callArgs.where.encrypted_witness).toEqual({ not: '' });

			// Should null out PII fields
			expect(callArgs.data).toEqual({
				encrypted_witness: '',
				witness_nonce: null,
				ephemeral_public_key: null
			});
		});

		it('should return success with cleaned count', async () => {
			mockUpdateMany.mockResolvedValue({ count: 12 });
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.cleaned).toBe(12);
			expect(data.timestamp).toBeDefined();
		});

		it('should return cleaned=0 when no expired witnesses exist', async () => {
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.cleaned).toBe(0);
		});

		it('should return valid ISO timestamp', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			const parsed = new Date(data.timestamp);
			expect(parsed.getTime()).not.toBeNaN();
		});
	});

	// =========================================================================
	// Idempotency
	// =========================================================================

	describe('Idempotency', () => {
		it('should not affect already-cleaned records (empty witness filter)', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			// The where clause includes encrypted_witness: { not: '' }
			// which means already-cleaned records (with empty string) are skipped
			const callArgs = mockUpdateMany.mock.calls[0][0];
			expect(callArgs.where.encrypted_witness).toEqual({ not: '' });
		});

		it('should be safe to run multiple times', async () => {
			const event = createEvent('Bearer test-cron-secret');

			// First run
			mockUpdateMany.mockResolvedValue({ count: 5 });
			const response1 = await GET(event);
			const data1 = await response1.json();

			// Second run (nothing to clean)
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const response2 = await GET(event);
			const data2 = await response2.json();

			expect(data1.success).toBe(true);
			expect(data1.cleaned).toBe(5);
			expect(data2.success).toBe(true);
			expect(data2.cleaned).toBe(0);
		});
	});

	// =========================================================================
	// Error Handling
	// =========================================================================

	describe('Error Handling', () => {
		it('should throw 500 when database operation fails', async () => {
			mockUpdateMany.mockRejectedValue(new Error('DB connection refused'));
			const event = createEvent('Bearer test-cron-secret');

			await expect(GET(event)).rejects.toMatchObject({ status: 500 });
		});

		it('should log error when database operation fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockUpdateMany.mockRejectedValue(new Error('DB timeout'));
			const event = createEvent('Bearer test-cron-secret');

			try {
				await GET(event);
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				'[Cron:cleanup-witness] Failed:',
				expect.any(Error)
			);
			consoleSpy.mockRestore();
		});

		it('should log success count on successful cleanup', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			mockUpdateMany.mockResolvedValue({ count: 7 });
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			expect(consoleSpy).toHaveBeenCalledWith(
				'[Cron:cleanup-witness] Cleaned',
				7,
				'expired witness records'
			);
			consoleSpy.mockRestore();
		});
	});

	// =========================================================================
	// Data Preservation
	// =========================================================================

	describe('Data Preservation', () => {
		it('should NOT null delivery_status (non-PII field)', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			const updateData = mockUpdateMany.mock.calls[0][0].data;
			expect(updateData).not.toHaveProperty('delivery_status');
		});

		it('should NOT null proof_hex (non-PII field)', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			const updateData = mockUpdateMany.mock.calls[0][0].data;
			expect(updateData).not.toHaveProperty('proof_hex');
		});

		it('should NOT null nullifier (non-PII field)', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			const updateData = mockUpdateMany.mock.calls[0][0].data;
			expect(updateData).not.toHaveProperty('nullifier');
		});

		it('should NOT null public_inputs (non-PII field)', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			const updateData = mockUpdateMany.mock.calls[0][0].data;
			expect(updateData).not.toHaveProperty('public_inputs');
		});

		it('should only clear the three PII-containing witness fields', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			const updateData = mockUpdateMany.mock.calls[0][0].data;
			const keys = Object.keys(updateData).sort();
			expect(keys).toEqual(['encrypted_witness', 'ephemeral_public_key', 'witness_nonce']);
		});
	});
});
