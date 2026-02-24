/**
 * Unit Tests: GET /api/submissions/[id]/status
 *
 * Tests the submission status polling endpoint which:
 * 1. Requires authentication (locals.user)
 * 2. Validates submission ID param
 * 3. Looks up submission by ID
 * 4. Verifies pseudonymous ownership (HMAC of user ID)
 * 5. Returns sanitized status (no internal error details)
 *
 * Security properties tested:
 * - Authentication enforcement
 * - Pseudonymous ownership verification (prevents cross-user status leaks)
 * - Error message sanitization (no stack traces or DB info leaked)
 * - Delivery count derivation from comma-separated CWC IDs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const { mockFindUnique, mockComputePseudonymousId } = vi.hoisted(() => ({
	mockFindUnique: vi.fn(),
	mockComputePseudonymousId: vi.fn()
}));

vi.mock('$lib/core/db', () => ({
	prisma: {
		submission: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args)
		}
	},
	db: {
		submission: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args)
		}
	}
}));

vi.mock('$lib/core/privacy/pseudonymous-id', () => ({
	computePseudonymousId: (...args: unknown[]) => mockComputePseudonymousId(...args)
}));

// Mock $types to prevent SvelteKit resolution issues
vi.mock('../../../src/routes/api/submissions/[id]/status/$types', () => ({}));

// Import handler AFTER mocks
const { GET } = await import('../../../src/routes/api/submissions/[id]/status/+server');

// =============================================================================
// HELPERS
// =============================================================================

function createEvent(overrides: {
	user?: { id: string } | null;
	params?: Record<string, string>;
} = {}): any {
	return {
		locals: {
			user: overrides.user !== undefined ? overrides.user : { id: 'user-123' }
		},
		params: overrides.params || { id: 'sub-001' }
	};
}

const DEFAULT_SUBMISSION = {
	id: 'sub-001',
	pseudonymous_id: 'pseudo-user-123',
	delivery_status: 'delivered',
	delivery_error: null,
	delivered_at: new Date('2026-01-15T12:00:00Z'),
	cwc_submission_id: 'msg-senate-1,msg-house-1'
};

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/submissions/[id]/status', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockComputePseudonymousId.mockReturnValue('pseudo-user-123');
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should return 401 when user is not authenticated', async () => {
			const event = createEvent({ user: null });

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should return 401 when locals.user is undefined', async () => {
			const event = { locals: {}, params: { id: 'sub-001' } };

			const response = await GET(event as any);
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

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should throw 400 when submission ID is empty string', async () => {
			const event = createEvent({ params: { id: '' } });

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});
	});

	// =========================================================================
	// Submission Lookup
	// =========================================================================

	describe('Submission Lookup', () => {
		it('should throw 404 when submission is not found', async () => {
			mockFindUnique.mockResolvedValue(null);
			const event = createEvent();

			await expect(GET(event)).rejects.toMatchObject({ status: 404 });
		});

		it('should query with correct select fields', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			const event = createEvent();

			await GET(event);

			expect(mockFindUnique).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				select: {
					id: true,
					pseudonymous_id: true,
					delivery_status: true,
					delivery_error: true,
					delivered_at: true,
					cwc_submission_id: true
				}
			});
		});
	});

	// =========================================================================
	// Pseudonymous Ownership Verification
	// =========================================================================

	describe('Pseudonymous Ownership Verification', () => {
		it('should return 403 when caller pseudonymous_id does not match submission', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			mockComputePseudonymousId.mockReturnValue('pseudo-different-user');

			const event = createEvent({ user: { id: 'different-user' } });

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Access denied');
		});

		it('should compute pseudonymous ID from current user ID', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			const event = createEvent({ user: { id: 'user-123' } });

			await GET(event);

			expect(mockComputePseudonymousId).toHaveBeenCalledWith('user-123');
		});

		it('should allow access when pseudonymous IDs match', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			const event = createEvent();

			const response = await GET(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Happy Path
	// =========================================================================

	describe('Happy Path', () => {
		it('should return delivery status and count for delivered submission', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe('delivered');
			expect(data.deliveryCount).toBe(2);
			expect(data.deliveredAt).toBe('2026-01-15T12:00:00.000Z');
			expect(data.error).toBeNull();
		});

		it('should return deliveryCount=0 when no CWC IDs exist', async () => {
			const submission = { ...DEFAULT_SUBMISSION, cwc_submission_id: null };
			mockFindUnique.mockResolvedValue(submission);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.deliveryCount).toBe(0);
		});

		it('should return deliveryCount=1 for single CWC ID', async () => {
			const submission = { ...DEFAULT_SUBMISSION, cwc_submission_id: 'msg-senate-1' };
			mockFindUnique.mockResolvedValue(submission);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.deliveryCount).toBe(1);
		});

		it('should return deliveryCount=3 for three comma-separated CWC IDs', async () => {
			const submission = { ...DEFAULT_SUBMISSION, cwc_submission_id: 'msg-1,msg-2,msg-3' };
			mockFindUnique.mockResolvedValue(submission);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.deliveryCount).toBe(3);
		});
	});

	// =========================================================================
	// Error Sanitization
	// =========================================================================

	describe('Error Sanitization', () => {
		it('should sanitize delivery_error into generic user-facing message', async () => {
			const submission = {
				...DEFAULT_SUBMISSION,
				delivery_status: 'failed',
				delivery_error: 'PrismaClientKnownRequestError: Connection to PostgreSQL lost at socket.on'
			};
			mockFindUnique.mockResolvedValue(submission);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.error).toBe(
				'Delivery encountered an issue. Please try again or contact support.'
			);
			// Must NOT leak internal error details
			expect(data.error).not.toContain('Prisma');
			expect(data.error).not.toContain('PostgreSQL');
			expect(data.error).not.toContain('socket');
		});

		it('should return null error when delivery_error is null', async () => {
			mockFindUnique.mockResolvedValue(DEFAULT_SUBMISSION);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.error).toBeNull();
		});

		it('should return null error when delivery_error is empty string', async () => {
			const submission = { ...DEFAULT_SUBMISSION, delivery_error: '' };
			mockFindUnique.mockResolvedValue(submission);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			// Empty string is falsy, so error should be null
			expect(data.error).toBeNull();
		});
	});

	// =========================================================================
	// Status Values
	// =========================================================================

	describe('Status Values', () => {
		const statuses = ['pending', 'processing', 'delivered', 'partial', 'failed'] as const;

		for (const status of statuses) {
			it(`should return status="${status}" correctly`, async () => {
				const submission = { ...DEFAULT_SUBMISSION, delivery_status: status };
				mockFindUnique.mockResolvedValue(submission);
				const event = createEvent();

				const response = await GET(event);
				const data = await response.json();

				expect(data.status).toBe(status);
			});
		}
	});
});
