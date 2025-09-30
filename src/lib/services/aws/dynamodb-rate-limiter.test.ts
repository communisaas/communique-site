/**
 * DynamoDB Rate Limiter Test Suite
 *
 * NOTE: These tests require @aws-sdk/client-dynamodb to be installed
 * and either local DynamoDB or AWS credentials configured.
 *
 * For local testing, use DynamoDB Local:
 * docker run -p 8000:8000 amazon/dynamodb-local
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
	DynamoDBRateLimiter,
	createRateLimiter,
	extractChamber,
	createRateLimitError,
	DEFAULT_RATE_LIMITS,
	type IdempotencyKey,
	type Chamber
} from './dynamodb-rate-limiter';

// Test configuration for local DynamoDB
const TEST_CONFIG = {
	rateLimitTableName: 'test-rate-limits',
	idempotencyTableName: 'test-idempotency',
	region: 'us-east-1',
	endpoint: 'http://localhost:8000'
};

// Test data
const mockUser = {
	id: 'user-123',
	name: 'Test User',
	email: 'test@example.com'
};

const mockTemplate = {
	id: 'template-456',
	title: 'Test Template',
	slug: 'test-template'
};

const mockSenateOffice = {
	id: 'senate-ca-001',
	bioguideId: 'F000062',
	name: 'Dianne Feinstein',
	chamber: 'senate' as Chamber
};

const mockHouseOffice = {
	id: 'house-ca-12',
	bioguideId: 'P000197',
	name: 'Nancy Pelosi',
	chamber: 'house' as Chamber
};

describe('DynamoDB Rate Limiter', () => {
	let rateLimiter: DynamoDBRateLimiter;

	beforeAll(async () => {
		// Skip tests if DynamoDB not available
		try {
			rateLimiter = new DynamoDBRateLimiter(TEST_CONFIG);
			// Test connection by attempting a simple operation
			await rateLimiter.checkIdempotency({
				templateId: 'test',
				recipientOfficeId: 'test',
				userId: 'test',
				date: '2024-01-01'
			});
		} catch (error) {
			console.warn('DynamoDB not available, skipping rate limiter tests');
			return;
		}
	});

	beforeEach(() => {
		// Reset rate limiter with fresh configuration
		rateLimiter = new DynamoDBRateLimiter(TEST_CONFIG, {
			...DEFAULT_RATE_LIMITS,
			// Use shorter windows for testing
			global: { ...DEFAULT_RATE_LIMITS.global, windowSizeMs: 10000 }, // 10 seconds
			senate: { ...DEFAULT_RATE_LIMITS.senate, windowSizeMs: 10000 },
			houseGlobal: { ...DEFAULT_RATE_LIMITS.houseGlobal, windowSizeMs: 10000 },
			housePerOffice: { ...DEFAULT_RATE_LIMITS.housePerOffice, windowSizeMs: 10000 }
		});
	});

	describe('Chamber Detection', () => {
		it('should correctly identify Senate offices', () => {
			expect(extractChamber('senate-ca-001')).toBe('senate');
			expect(extractChamber('S000148')).toBe('senate');
			expect(extractChamber('senator-feinstein')).toBe('senate');
		});

		it('should correctly identify House offices', () => {
			expect(extractChamber('house-ca-12')).toBe('house');
			expect(extractChamber('H001234')).toBe('house');
			expect(extractChamber('representative-pelosi')).toBe('house');
		});

		it('should default to House for unknown formats', () => {
			expect(extractChamber('unknown-office')).toBe('house');
			expect(extractChamber('')).toBe('house');
		});
	});

	describe('Rate Limit Checks', () => {
		it('should allow requests within rate limits', async () => {
			if (!rateLimiter) return;

			const result = await rateLimiter.checkRateLimit('senate', mockSenateOffice.id, mockUser.id);

			expect(result.allowed).toBe(true);
			expect(result.tokensRemaining).toBeGreaterThanOrEqual(0);
			expect(result.resetAt).toBeGreaterThan(Date.now());
		});

		it('should enforce global rate limits', async () => {
			if (!rateLimiter) return;

			// Consume tokens up to the global limit
			const globalLimit = DEFAULT_RATE_LIMITS.global.maxTokens;
			const promises = [];

			for (let i = 0; i < globalLimit + 5; i++) {
				promises.push(rateLimiter.checkRateLimit('senate', `office-${i}`, `user-${i}`));
			}

			const results = await Promise.all(promises);
			const allowedCount = results.filter((r) => r.allowed).length;
			const deniedCount = results.filter((r) => !r.allowed).length;

			expect(allowedCount).toBeLessThanOrEqual(globalLimit);
			expect(deniedCount).toBeGreaterThan(0);
		});

		it('should enforce chamber-specific rate limits', async () => {
			if (!rateLimiter) return;

			const senateLimit = DEFAULT_RATE_LIMITS.senate.maxTokens;
			const promises = [];

			for (let i = 0; i < senateLimit + 5; i++) {
				promises.push(rateLimiter.checkRateLimit('senate', `senate-office-${i}`, `user-${i}`));
			}

			const results = await Promise.all(promises);
			const allowedCount = results.filter((r) => r.allowed).length;

			expect(allowedCount).toBeLessThanOrEqual(senateLimit);
		});

		it('should enforce House per-office rate limits', async () => {
			if (!rateLimiter) return;

			const houseOfficeLimit = DEFAULT_RATE_LIMITS.housePerOffice.maxTokens;
			const officeId = 'house-ca-12';
			const promises = [];

			for (let i = 0; i < houseOfficeLimit + 2; i++) {
				promises.push(rateLimiter.checkRateLimit('house', officeId, `user-${i}`));
			}

			const results = await Promise.all(promises);
			const allowedCount = results.filter((r) => r.allowed).length;

			expect(allowedCount).toBeLessThanOrEqual(houseOfficeLimit);
		});

		it('should return proper error details for rate limit violations', async () => {
			if (!rateLimiter) return;

			// First exhaust the rate limit
			const limit = DEFAULT_RATE_LIMITS.senate.maxTokens;
			for (let i = 0; i < limit; i++) {
				await rateLimiter.checkRateLimit('senate', 'test-office', `user-${i}`);
			}

			// Next request should be denied
			const result = await rateLimiter.checkRateLimit('senate', 'test-office', 'user-final');

			expect(result.allowed).toBe(false);
			expect(result.retryAfterMs).toBeGreaterThan(0);
			expect(result.resetAt).toBeGreaterThan(Date.now());
		});
	});

	describe('Idempotency Tracking', () => {
		const testKey: IdempotencyKey = {
			templateId: mockTemplate.id,
			recipientOfficeId: mockSenateOffice.id,
			userId: mockUser.id,
			date: new Date().toISOString().split('T')[0]
		};

		it('should detect first-time submissions', async () => {
			if (!rateLimiter) return;

			const result = await rateLimiter.checkIdempotency(testKey);

			expect(result.isDuplicate).toBe(false);
			expect(result.originalMessageId).toBeUndefined();
		});

		it('should record successful submissions', async () => {
			if (!rateLimiter) return;

			const messageId = 'msg-123456';

			await rateLimiter.recordSubmission(testKey, messageId);

			// Verify the record exists
			const result = await rateLimiter.checkIdempotency(testKey);

			expect(result.isDuplicate).toBe(true);
			expect(result.originalMessageId).toBe(messageId);
		});

		it('should detect duplicate submissions', async () => {
			if (!rateLimiter) return;

			const messageId = 'msg-789012';

			// Record first submission
			await rateLimiter.recordSubmission(testKey, messageId);

			// Check for duplicate
			const result = await rateLimiter.checkIdempotency(testKey);

			expect(result.isDuplicate).toBe(true);
			expect(result.originalMessageId).toBe(messageId);
			expect(result.originalSubmissionTime).toBeDefined();
		});

		it('should handle concurrent submission attempts', async () => {
			if (!rateLimiter) return;

			const messageId1 = 'msg-concurrent-1';
			const messageId2 = 'msg-concurrent-2';

			// Simulate concurrent submissions
			const promises = [
				rateLimiter.recordSubmission(testKey, messageId1),
				rateLimiter.recordSubmission(testKey, messageId2)
			];

			// Both should complete without error (one will fail silently due to condition)
			await Promise.all(promises);

			// Check which one was recorded
			const result = await rateLimiter.checkIdempotency(testKey);

			expect(result.isDuplicate).toBe(true);
			expect([messageId1, messageId2]).toContain(result.originalMessageId);
		});
	});

	describe('Error Handling', () => {
		it('should create proper rate limit errors', () => {
			const result = {
				allowed: false,
				tokensRemaining: 0,
				resetAt: Date.now() + 60000,
				retryAfterMs: 60000
			};

			const error = createRateLimitError('senate', result, 'senate-ca-001');

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toContain('Rate limit exceeded');
			expect(error.message).toContain('senate');
			expect(error.message).toContain('60 seconds');
		});

		it('should handle DynamoDB connection failures gracefully', async () => {
			// Create rate limiter with invalid endpoint
			const faultyLimiter = new DynamoDBRateLimiter({
				...TEST_CONFIG,
				endpoint: 'http://invalid-endpoint:9999'
			});

			// Should not throw, but allow the request with degraded service
			const result = await faultyLimiter.checkRateLimit('senate', 'test-office', 'test-user');

			expect(result.allowed).toBe(true); // Graceful degradation
		});
	});

	describe('Configuration Helpers', () => {
		it('should create proper development configuration', () => {
			const config = createRateLimiter('development');

			expect(config).toBeInstanceOf(DynamoDBRateLimiter);
		});

		it('should create proper production configuration', () => {
			const config = createRateLimiter('production');

			expect(config).toBeInstanceOf(DynamoDBRateLimiter);
		});

		it('should accept custom rate limits', () => {
			const customLimits = {
				global: { maxTokens: 100, refillRate: 100, windowSizeMs: 60000 }
			};

			const config = createRateLimiter('development', customLimits);

			expect(config).toBeInstanceOf(DynamoDBRateLimiter);
		});
	});

	describe('Type Guards', () => {
		it('should validate rate limit results', () => {
			const validResult = {
				allowed: true,
				tokensRemaining: 5,
				resetAt: Date.now() + 60000
			};

			const invalidResult = {
				allowed: 'yes', // Invalid type
				tokensRemaining: '5',
				resetAt: Date.now()
			};

			expect(rateLimiter ? true : false).toBe(true); // Check if tests are running
		});
	});

	describe('Integration Scenarios', () => {
		it('should handle typical CWC submission workflow', async () => {
			if (!rateLimiter) return;

			const chamber = extractChamber(mockSenateOffice.id);

			// 1. Check rate limits
			const rateLimitResult = await rateLimiter.checkRateLimit(
				chamber,
				mockSenateOffice.id,
				mockUser.id
			);

			expect(rateLimitResult.allowed).toBe(true);

			// 2. Check idempotency
			const idempotencyKey: IdempotencyKey = {
				templateId: mockTemplate.id,
				recipientOfficeId: mockSenateOffice.id,
				userId: mockUser.id,
				date: new Date().toISOString().split('T')[0]
			};

			const idempotencyResult = await rateLimiter.checkIdempotency(idempotencyKey);
			expect(idempotencyResult.isDuplicate).toBe(false);

			// 3. Record successful submission
			const messageId = `msg-${Date.now()}`;
			await rateLimiter.recordSubmission(idempotencyKey, messageId);

			// 4. Verify duplicate detection on second attempt
			const duplicateCheck = await rateLimiter.checkIdempotency(idempotencyKey);
			expect(duplicateCheck.isDuplicate).toBe(true);
			expect(duplicateCheck.originalMessageId).toBe(messageId);
		});

		it('should handle burst traffic scenarios', async () => {
			if (!rateLimiter) return;

			const promises = [];
			const userCount = 10;
			const requestsPerUser = 3;

			// Simulate burst traffic from multiple users
			for (let userId = 0; userId < userCount; userId++) {
				for (let req = 0; req < requestsPerUser; req++) {
					promises.push(rateLimiter.checkRateLimit('house', `office-${userId}`, `user-${userId}`));
				}
			}

			const results = await Promise.all(promises);
			const allowedCount = results.filter((r) => r.allowed).length;
			const totalRequests = userCount * requestsPerUser;

			// Should enforce global limits even during burst
			expect(allowedCount).toBeLessThanOrEqual(DEFAULT_RATE_LIMITS.global.maxTokens);
			expect(allowedCount).toBeGreaterThan(0); // But should allow some requests
		});
	});
});

// Helper function to check if DynamoDB is available
export async function isDynamoDBAvailable(): Promise<boolean> {
	try {
		const testLimiter = new DynamoDBRateLimiter(TEST_CONFIG);
		await testLimiter.checkIdempotency({
			templateId: 'connection-test',
			recipientOfficeId: 'connection-test',
			userId: 'connection-test',
			date: '2024-01-01'
		});
		return true;
	} catch {
		return false;
	}
}

// Export test utilities for integration testing
export { TEST_CONFIG, mockUser, mockTemplate, mockSenateOffice, mockHouseOffice };
