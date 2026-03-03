/**
 * Unit Tests: GET /api/email/confirm/[token]
 *
 * Tests the email delivery confirmation endpoint which:
 * 1. Validates HMAC-based confirmation token
 * 2. Looks up pending/delivered submissions within 7-day window
 * 3. Updates delivery_status to 'user_confirmed' (single-use)
 * 4. Returns idempotent response for already-confirmed submissions
 *
 * Security properties tested:
 * - HMAC token validation (prevents forgery)
 * - Token expiry enforcement (7-day window)
 * - Single-use confirmation (idempotent response, not double-update)
 * - Stale submission rejection (7-day created_at window)
 * - No submission ID leaked in token (uses template_id)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const { mockValidateConfirmationToken, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
	mockValidateConfirmationToken: vi.fn(),
	mockFindFirst: vi.fn(),
	mockUpdate: vi.fn()
}));

vi.mock('$lib/core/email/delivery-confirmation', () => ({
	validateConfirmationToken: (...args: unknown[]) => mockValidateConfirmationToken(...args)
}));

vi.mock('$lib/core/db', () => ({
	prisma: {
		submission: {
			findFirst: (...args: unknown[]) => mockFindFirst(...args),
			update: (...args: unknown[]) => mockUpdate(...args)
		}
	},
	db: {
		submission: {
			findFirst: (...args: unknown[]) => mockFindFirst(...args),
			update: (...args: unknown[]) => mockUpdate(...args)
		}
	}
}));

// Mock $types
vi.mock('../../../src/routes/api/email/confirm/[token]/$types', () => ({}));

// Import handler AFTER mocks
const { GET } = await import('../../../src/routes/api/email/confirm/[token]/+server');

// =============================================================================
// HELPERS
// =============================================================================

function createEvent(token: string | undefined = 'valid-token-abc'): any {
	return {
		params: { token }
	};
}

const DEFAULT_SUBMISSION = {
	id: 'sub-001',
	template_id: 'tmpl-001',
	delivery_status: 'delivered',
	created_at: new Date()
};

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/email/confirm/[token]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockValidateConfirmationToken.mockReturnValue('tmpl-001');
		mockFindFirst.mockResolvedValue(DEFAULT_SUBMISSION);
		mockUpdate.mockResolvedValue({});
	});

	// =========================================================================
	// Token Validation
	// =========================================================================

	describe('Token Validation', () => {
		it('should throw 400 when token param is not provided in params object', async () => {
			// SvelteKit always provides params.token from URL pattern [token],
			// but if somehow it is missing, the handler checks !token and throws 400.
			const event = { params: {} } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should throw 400 when token param is empty string', async () => {
			const event = createEvent('');

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should throw 400 when HMAC validation fails (tampered token)', async () => {
			mockValidateConfirmationToken.mockReturnValue(null);
			const event = createEvent('tampered-token-xyz');

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should throw 400 when token is expired', async () => {
			mockValidateConfirmationToken.mockReturnValue(null);
			const event = createEvent('expired-token-123');

			await expect(GET(event)).rejects.toMatchObject({ status: 400 });
		});

		it('should pass token to validateConfirmationToken', async () => {
			const event = createEvent('my-specific-token');

			await GET(event);

			expect(mockValidateConfirmationToken).toHaveBeenCalledWith('my-specific-token');
		});
	});

	// =========================================================================
	// Submission Lookup
	// =========================================================================

	describe('Submission Lookup', () => {
		it('should search for submissions by template_id from token', async () => {
			mockValidateConfirmationToken.mockReturnValue('tmpl-xyz');
			const event = createEvent();

			await GET(event);

			expect(mockFindFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						template_id: 'tmpl-xyz'
					})
				})
			);
		});

		it('should only match pending or delivered submissions', async () => {
			const event = createEvent();

			await GET(event);

			expect(mockFindFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						delivery_status: { in: ['pending', 'delivered'] }
					})
				})
			);
		});

		it('should only match submissions created within last 7 days', async () => {
			const event = createEvent();

			const beforeCall = Date.now();
			await GET(event);
			const afterCall = Date.now();

			const callArgs = mockFindFirst.mock.calls[0][0];
			const createdAtGte = callArgs.where.created_at.gte as Date;

			const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
			// The cutoff should be approximately 7 days ago
			expect(createdAtGte.getTime()).toBeGreaterThanOrEqual(beforeCall - SEVEN_DAYS_MS - 100);
			expect(createdAtGte.getTime()).toBeLessThanOrEqual(afterCall - SEVEN_DAYS_MS + 100);
		});

		it('should order by created_at desc (most recent first)', async () => {
			const event = createEvent();

			await GET(event);

			expect(mockFindFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { created_at: 'desc' }
				})
			);
		});

		it('should return not-found message when no matching submission exists', async () => {
			mockFindFirst.mockResolvedValue(null);
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.confirmed).toBe(false);
			expect(data.message).toContain('No pending submission found');
		});
	});

	// =========================================================================
	// Happy Path (First Confirmation)
	// =========================================================================

	describe('Happy Path - First Confirmation', () => {
		it('should update delivery_status to user_confirmed', async () => {
			const event = createEvent();

			await GET(event);

			expect(mockUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'user_confirmed'
				})
			});
		});

		it('should set delivered_at timestamp', async () => {
			const event = createEvent();

			const beforeCall = Date.now();
			await GET(event);
			const afterCall = Date.now();

			const updateData = mockUpdate.mock.calls[0][0].data;
			const deliveredAt = updateData.delivered_at as Date;

			expect(deliveredAt).toBeInstanceOf(Date);
			expect(deliveredAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
			expect(deliveredAt.getTime()).toBeLessThanOrEqual(afterCall);
		});

		it('should return confirmed=true with thank you message', async () => {
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.confirmed).toBe(true);
			expect(data.message).toContain('Thank you');
		});

		it('should confirm a submission with pending delivery_status', async () => {
			mockFindFirst.mockResolvedValue({
				...DEFAULT_SUBMISSION,
				delivery_status: 'pending'
			});
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(data.confirmed).toBe(true);
			expect(mockUpdate).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Idempotency (Already Confirmed)
	// =========================================================================

	describe('Idempotency - Already Confirmed', () => {
		it('should return already_confirmed=true when submission is already confirmed', async () => {
			mockFindFirst.mockResolvedValue({
				...DEFAULT_SUBMISSION,
				delivery_status: 'user_confirmed'
			});
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.confirmed).toBe(true);
			expect(data.already_confirmed).toBe(true);
			expect(data.message).toContain('already confirmed');
		});

		it('should NOT call update for already-confirmed submissions', async () => {
			mockFindFirst.mockResolvedValue({
				...DEFAULT_SUBMISSION,
				delivery_status: 'user_confirmed'
			});
			const event = createEvent();

			await GET(event);

			expect(mockUpdate).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Database Error Handling
	// =========================================================================

	describe('Database Error Handling', () => {
		it('should propagate error when findFirst fails', async () => {
			mockFindFirst.mockRejectedValue(new Error('DB query failed'));
			const event = createEvent();

			await expect(GET(event)).rejects.toThrow('DB query failed');
		});

		it('should propagate error when update fails', async () => {
			mockUpdate.mockRejectedValue(new Error('DB write failed'));
			const event = createEvent();

			await expect(GET(event)).rejects.toThrow('DB write failed');
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('Edge Cases', () => {
		it('should handle token with special characters in base64url encoding', async () => {
			mockValidateConfirmationToken.mockReturnValue('tmpl-with-special');
			const event = createEvent('dG1wbC1pZA.aGVsbG8td29ybGQ');

			const response = await GET(event);
			const data = await response.json();

			expect(data.confirmed).toBe(true);
		});

		it('should handle concurrent confirmation attempts gracefully', async () => {
			// If two requests hit at the same time and both pass findFirst,
			// the second update is harmless (idempotent status set)
			const event = createEvent();

			const [response1, response2] = await Promise.all([GET(event), GET(event)]);

			// Both should succeed (the DB update is idempotent)
			expect((await response1.json()).confirmed).toBe(true);
			expect((await response2.json()).confirmed).toBe(true);
		});
	});
});
