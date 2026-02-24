/**
 * Unit Tests: GET /api/cron/analytics-snapshot
 *
 * Tests the daily analytics materialization cron endpoint which:
 * 1. Authenticates via CRON_SECRET bearer token
 * 2. Materializes noisy snapshots from raw aggregates for yesterday
 * 3. Reports remaining privacy budget
 * 4. Cleans up old rate limit entries (when DB rate limiting is enabled)
 * 5. Handles PrivacyBudgetExhaustedError with 429 status
 *
 * Security properties tested:
 * - Bearer token authentication (CRON_SECRET)
 * - Privacy budget enforcement (429 when exhausted)
 * - Idempotent snapshots (immutable once created)
 * - Graceful error reporting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockMaterializeNoisySnapshot,
	mockGetRemainingBudget,
	mockGetDaysAgoUTC,
	mockCleanupOldRateLimits,
	mockIsDBRateLimitEnabled
} = vi.hoisted(() => ({
	mockMaterializeNoisySnapshot: vi.fn(),
	mockGetRemainingBudget: vi.fn(),
	mockGetDaysAgoUTC: vi.fn(),
	mockCleanupOldRateLimits: vi.fn(),
	mockIsDBRateLimitEnabled: vi.fn()
}));

vi.mock('$lib/core/analytics/snapshot', () => ({
	materializeNoisySnapshot: (...args: unknown[]) => mockMaterializeNoisySnapshot(...args),
	getRemainingBudget: (...args: unknown[]) => mockGetRemainingBudget(...args)
}));

// We need to use the real PrivacyBudgetExhaustedError class for instanceof checks.
// Create a mock class that the route handler can check with instanceof.
class MockPrivacyBudgetExhaustedError extends Error {
	readonly requested: number;
	readonly remaining: number;
	readonly limit: number;

	constructor(requested: number) {
		super(`Privacy budget exhausted. Requested epsilon=${requested}`);
		this.name = 'PrivacyBudgetExhaustedError';
		this.requested = requested;
		this.remaining = 0.5;
		this.limit = 10;
	}
}

vi.mock('$lib/core/analytics/budget', () => ({
	PrivacyBudgetExhaustedError: MockPrivacyBudgetExhaustedError
}));

vi.mock('$lib/core/analytics/aggregate', () => ({
	getDaysAgoUTC: (...args: unknown[]) => mockGetDaysAgoUTC(...args)
}));

vi.mock('$lib/core/analytics/rate-limit-db', () => ({
	cleanupOldRateLimits: (...args: unknown[]) => mockCleanupOldRateLimits(...args),
	isDBRateLimitEnabled: (...args: unknown[]) => mockIsDBRateLimitEnabled(...args)
}));

// Mock $types
vi.mock('../../../src/routes/api/cron/analytics-snapshot/$types', () => ({}));

// Import handler AFTER mocks
const { GET } = await import('../../../src/routes/api/cron/analytics-snapshot/+server');

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

const YESTERDAY = new Date('2026-02-22T00:00:00.000Z');

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/cron/analytics-snapshot', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-cron-secret';

		mockGetDaysAgoUTC.mockReturnValue(YESTERDAY);
		mockMaterializeNoisySnapshot.mockResolvedValue({
			created: 8,
			epsilonSpent: 2.5
		});
		mockGetRemainingBudget.mockResolvedValue(7.5);
		mockIsDBRateLimitEnabled.mockReturnValue(true);
		mockCleanupOldRateLimits.mockResolvedValue(15);
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should return 401 when CRON_SECRET is set and bearer token does not match', async () => {
			const event = createEvent('Bearer wrong-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Unauthorized');
		});

		it('should return 401 when CRON_SECRET is set and authorization header is missing', async () => {
			const event = createEvent();

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Unauthorized');
		});

		it('should succeed with correct bearer token', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);

			expect(response.status).toBe(200);
		});

		it('should skip auth when CRON_SECRET is not configured', async () => {
			delete process.env.CRON_SECRET;
			const event = createEvent();

			const response = await GET(event);

			// Should succeed without auth when CRON_SECRET is not set
			expect(response.status).toBe(200);
		});

		it('should skip auth when CRON_SECRET is empty string', async () => {
			process.env.CRON_SECRET = '';
			const event = createEvent();

			const response = await GET(event);

			// Empty string is falsy, so auth is skipped
			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Happy Path
	// =========================================================================

	describe('Happy Path', () => {
		it('should materialize snapshot for yesterday', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			expect(mockGetDaysAgoUTC).toHaveBeenCalledWith(1);
			expect(mockMaterializeNoisySnapshot).toHaveBeenCalledWith(YESTERDAY);
		});

		it('should return full success response with all fields', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({
				success: true,
				date: '2026-02-22',
				snapshots_created: 8,
				epsilon_spent: 2.5,
				budget_remaining: 7.5,
				rate_limits_deleted: 15,
				rate_limit_db_enabled: true
			});
		});

		it('should query remaining budget for yesterday', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			expect(mockGetRemainingBudget).toHaveBeenCalledWith(YESTERDAY);
		});

		it('should clean up rate limits older than 2 days', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			expect(mockCleanupOldRateLimits).toHaveBeenCalledWith(2);
		});
	});

	// =========================================================================
	// Rate Limit Cleanup
	// =========================================================================

	describe('Rate Limit Cleanup', () => {
		it('should skip rate limit cleanup when DB rate limiting is disabled', async () => {
			mockIsDBRateLimitEnabled.mockReturnValue(false);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(mockCleanupOldRateLimits).not.toHaveBeenCalled();
			expect(data.rate_limits_deleted).toBe(0);
			expect(data.rate_limit_db_enabled).toBe(false);
		});

		it('should report rate_limits_deleted when cleanup runs', async () => {
			mockCleanupOldRateLimits.mockResolvedValue(42);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.rate_limits_deleted).toBe(42);
		});

		it('should report rate_limits_deleted=0 when nothing to clean', async () => {
			mockCleanupOldRateLimits.mockResolvedValue(0);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.rate_limits_deleted).toBe(0);
		});
	});

	// =========================================================================
	// Privacy Budget Exhaustion
	// =========================================================================

	describe('Privacy Budget Exhaustion', () => {
		it('should return 429 when privacy budget is exhausted', async () => {
			mockMaterializeNoisySnapshot.mockRejectedValue(
				new MockPrivacyBudgetExhaustedError(3.0)
			);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.success).toBe(false);
			expect(data.budget_exhausted).toBe(true);
			expect(data.requested).toBe(3.0);
			expect(data.remaining).toBe(0.5);
			expect(data.limit).toBe(10);
		});

		it('should include descriptive error message for budget exhaustion', async () => {
			mockMaterializeNoisySnapshot.mockRejectedValue(
				new MockPrivacyBudgetExhaustedError(5.0)
			);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.error).toContain('Privacy budget exhausted');
		});
	});

	// =========================================================================
	// General Error Handling
	// =========================================================================

	describe('Error Handling', () => {
		it('should return 500 for unexpected errors during snapshot materialization', async () => {
			mockMaterializeNoisySnapshot.mockRejectedValue(new Error('DB connection lost'));
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.success).toBe(false);
			expect(data.error).toBe('DB connection lost');
		});

		it('should return 500 for errors during budget check', async () => {
			mockGetRemainingBudget.mockRejectedValue(new Error('Budget query failed'));
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.success).toBe(false);
		});

		it('should return 500 for rate limit cleanup errors', async () => {
			mockCleanupOldRateLimits.mockRejectedValue(
				new Error('Rate limit table does not exist')
			);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.success).toBe(false);
		});

		it('should return generic message for non-Error exceptions', async () => {
			mockMaterializeNoisySnapshot.mockRejectedValue('string error');
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Daily maintenance failed');
		});

		it('should return Error.message for Error instances', async () => {
			mockMaterializeNoisySnapshot.mockRejectedValue(
				new Error('Specific failure reason')
			);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.error).toBe('Specific failure reason');
		});
	});

	// =========================================================================
	// Idempotency
	// =========================================================================

	describe('Idempotency', () => {
		it('should pass yesterday date to materializeNoisySnapshot for consistent results', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);
			await GET(event);

			// Both calls should use the same date
			expect(mockMaterializeNoisySnapshot).toHaveBeenCalledTimes(2);
			expect(mockMaterializeNoisySnapshot.mock.calls[0][0]).toBe(YESTERDAY);
			expect(mockMaterializeNoisySnapshot.mock.calls[1][0]).toBe(YESTERDAY);
		});

		it('should report 0 snapshots_created on idempotent re-run', async () => {
			// Second run after snapshots already exist
			mockMaterializeNoisySnapshot.mockResolvedValue({
				created: 0,
				epsilonSpent: 0
			});
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.snapshots_created).toBe(0);
			expect(data.epsilon_spent).toBe(0);
		});
	});

	// =========================================================================
	// Date Handling
	// =========================================================================

	describe('Date Handling', () => {
		it('should format date as YYYY-MM-DD in response', async () => {
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it('should use getDaysAgoUTC(1) for yesterday calculation', async () => {
			const event = createEvent('Bearer test-cron-secret');

			await GET(event);

			expect(mockGetDaysAgoUTC).toHaveBeenCalledWith(1);
		});

		it('should handle different date values from getDaysAgoUTC', async () => {
			const customDate = new Date('2025-12-31T00:00:00.000Z');
			mockGetDaysAgoUTC.mockReturnValue(customDate);
			const event = createEvent('Bearer test-cron-secret');

			const response = await GET(event);
			const data = await response.json();

			expect(data.date).toBe('2025-12-31');
		});
	});
});
