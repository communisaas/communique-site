/**
 * Unit Tests: POST /api/submissions/[id]/retry
 *
 * Tests the submission retry endpoint which:
 * 1. Requires authentication (locals.user)
 * 2. Validates submission ID param
 * 3. Verifies pseudonymous ownership
 * 4. Atomically resets delivery_status from 'failed' to 'pending' (TOCTOU-safe)
 * 5. Re-triggers background delivery worker
 *
 * Security properties tested:
 * - Authentication enforcement
 * - Pseudonymous ownership verification
 * - TOCTOU race prevention (atomic conditional update)
 * - State guard (only 'failed' submissions can be retried)
 * - Fire-and-forget delivery (response not blocked by worker)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockFindUnique,
	mockUpdateMany,
	mockComputePseudonymousId,
	mockProcessSubmissionDelivery,
	mockGetRequestClient
} = vi.hoisted(() => ({
	mockFindUnique: vi.fn(),
	mockUpdateMany: vi.fn(),
	mockComputePseudonymousId: vi.fn(),
	mockProcessSubmissionDelivery: vi.fn(),
	mockGetRequestClient: vi.fn()
}));

vi.mock('$lib/core/db', () => {
	const mockDb = {
		submission: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
			updateMany: (...args: unknown[]) => mockUpdateMany(...args)
		}
	};
	return {
		prisma: mockDb,
		db: mockDb,
		getRequestClient: (...args: unknown[]) => mockGetRequestClient(...args)
	};
});

vi.mock('$lib/core/privacy/pseudonymous-id', () => ({
	computePseudonymousId: (...args: unknown[]) => mockComputePseudonymousId(...args)
}));

vi.mock('$lib/server/delivery-worker', () => ({
	processSubmissionDelivery: (...args: unknown[]) => mockProcessSubmissionDelivery(...args)
}));

// Mock $types
vi.mock('../../../src/routes/api/submissions/[id]/retry/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/submissions/[id]/retry/+server');

// =============================================================================
// HELPERS
// =============================================================================

function createEvent(overrides: {
	user?: { id: string } | null;
	params?: Record<string, string>;
	platform?: any;
} = {}): any {
	return {
		locals: {
			user: overrides.user !== undefined ? overrides.user : { id: 'user-123' }
		},
		params: overrides.params || { id: 'sub-001' },
		platform: overrides.platform || null
	};
}

const DEFAULT_SUBMISSION = {
	id: 'sub-001',
	pseudonymous_id: 'pseudo-user-123'
};

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/submissions/[id]/retry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockComputePseudonymousId.mockReturnValue('pseudo-user-123');
		mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
		mockUpdateMany.mockResolvedValue({ count: 1 });
		mockProcessSubmissionDelivery.mockResolvedValue({ success: true });
		mockGetRequestClient.mockReturnValue({});
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should return 401 when user is not authenticated', async () => {
			const event = createEvent({ user: null });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should return 401 when locals.user is undefined', async () => {
			const event = { locals: {}, params: { id: 'sub-001' }, platform: null };

			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});
	});

	// =========================================================================
	// Input Validation
	// =========================================================================

	describe('Input Validation', () => {
		it('should throw 400 when submission ID is missing', async () => {
			const event = createEvent({ params: {} });

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should throw 400 when submission ID is empty string', async () => {
			const event = createEvent({ params: { id: '' } });

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});
	});

	// =========================================================================
	// Submission Lookup
	// =========================================================================

	describe('Submission Lookup', () => {
		it('should throw 404 when submission is not found', async () => {
			mockFindUnique.mockResolvedValue(null);
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 404 });
		});

		it('should query with correct select fields for minimal lookup', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockFindUnique).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				select: {
					id: true,
					pseudonymous_id: true
				}
			});
		});
	});

	// =========================================================================
	// Pseudonymous Ownership Verification
	// =========================================================================

	describe('Pseudonymous Ownership Verification', () => {
		it('should return 403 when caller does not own the submission', async () => {
			mockComputePseudonymousId.mockReturnValue('pseudo-different-user');
			const event = createEvent({ user: { id: 'different-user' } });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Access denied');
		});

		it('should compute pseudonymous ID from current user ID', async () => {
			const event = createEvent({ user: { id: 'user-456' } });

			await POST(event);

			expect(mockComputePseudonymousId).toHaveBeenCalledWith('user-456');
		});
	});

	// =========================================================================
	// Atomic State Transition (TOCTOU-Safe)
	// =========================================================================

	describe('Atomic State Transition', () => {
		it('should atomically update only submissions with delivery_status=failed', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockUpdateMany).toHaveBeenCalledWith({
				where: { id: 'sub-001', delivery_status: 'failed' },
				data: {
					delivery_status: 'pending',
					delivery_error: null
				}
			});
		});

		it('should return 409 when submission is not in a retryable state', async () => {
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(409);
			expect(data.error).toBe('Submission is not in a retryable state');
		});

		it('should return 409 when submission is already delivered (not failed)', async () => {
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(409);
		});

		it('should return 409 when submission is currently processing', async () => {
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(409);
		});

		it('should return 409 when submission is pending (already queued)', async () => {
			mockUpdateMany.mockResolvedValue({ count: 0 });
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(409);
		});
	});

	// =========================================================================
	// Happy Path
	// =========================================================================

	describe('Happy Path', () => {
		it('should return { status: "retrying" } on success', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe('retrying');
		});

		it('should trigger background delivery worker', async () => {
			const event = createEvent();

			await POST(event);

			// Allow microtasks to flush
			await new Promise((r) => setTimeout(r, 10));

			expect(mockProcessSubmissionDelivery).toHaveBeenCalledWith(
				'sub-001',
				expect.anything()
			);
		});

		it('should capture request client before responding', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockGetRequestClient).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Fire-and-Forget Delivery
	// =========================================================================

	describe('Fire-and-Forget Delivery', () => {
		it('should not block response if delivery worker throws', async () => {
			mockProcessSubmissionDelivery.mockRejectedValue(
				new Error('Delivery worker crashed')
			);
			const event = createEvent();

			// Should still return success
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe('retrying');
		});

		it('should use platform.context.waitUntil when available', async () => {
			const mockWaitUntil = vi.fn();
			const event = createEvent({
				platform: { context: { waitUntil: mockWaitUntil } }
			});

			await POST(event);

			expect(mockWaitUntil).toHaveBeenCalledTimes(1);
			expect(mockWaitUntil).toHaveBeenCalledWith(expect.any(Promise));
		});

		it('should not call waitUntil when platform is null', async () => {
			const event = createEvent({ platform: null });

			// Should not throw
			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should not call waitUntil when platform.context is undefined', async () => {
			const event = createEvent({ platform: {} });

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Database Error Handling
	// =========================================================================

	describe('Database Error Handling', () => {
		it('should propagate error when findUnique fails', async () => {
			mockFindUnique.mockRejectedValue(new Error('DB connection lost'));
			const event = createEvent();

			await expect(POST(event)).rejects.toThrow('DB connection lost');
		});

		it('should propagate error when updateMany fails', async () => {
			mockUpdateMany.mockRejectedValue(new Error('DB write timeout'));
			const event = createEvent();

			await expect(POST(event)).rejects.toThrow('DB write timeout');
		});
	});
});
