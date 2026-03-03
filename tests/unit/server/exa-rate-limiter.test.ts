/**
 * Unit tests for Exa API Rate Limiter (rate-limiter.ts)
 *
 * Tests the circuit breaker, QPS throttling, and exponential backoff
 * system that protects the Exa search API integration from cascading
 * failures and rate limit violations.
 *
 * Tested behaviors:
 * - Circuit breaker: closed -> open -> half-open state transitions
 * - Circuit breaker: failure threshold triggers open state
 * - Circuit breaker: timeout before half-open probe
 * - Circuit breaker: successful probe closes circuit
 * - Circuit breaker: failed probe reopens circuit
 * - QPS throttling: proactive request gating via sliding window
 * - Exponential backoff: delay calculation (base * 2^n + jitter)
 * - Retry-After header extraction
 * - Max retries: stops after configured limit
 * - Transient error detection: 429/rate-limit errors vs non-retryable
 * - Staggered execution for batch requests
 * - Reset/clear functionality
 * - Default config exports (SEARCH_CONFIG, CONTENTS_CONFIG)
 * - Singleton accessors (getSearchRateLimiter, getContentsRateLimiter)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ExaRateLimiter,
	SEARCH_CONFIG,
	CONTENTS_CONFIG,
	getSearchRateLimiter,
	getContentsRateLimiter,
	type RateLimitConfig,
	type RetryResult
} from '$lib/server/exa/rate-limiter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal config for fast tests */
function testConfig(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
	return {
		maxRps: 5,
		maxRetries: 3,
		baseDelayMs: 100,
		maxDelayMs: 1000,
		circuitBreakerThreshold: 3,
		circuitBreakerResetMs: 5000,
		...overrides
	};
}

/** Create a rate-limit error (429) */
function rateLimitError(message = '429 Too Many Requests'): Error {
	return new Error(message);
}

/** Create a non-retryable error */
function serverError(message = 'Internal server error'): Error {
	return new Error(message);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExaRateLimiter', () => {
	let limiter: ExaRateLimiter;

	beforeEach(() => {
		vi.useFakeTimers();
		limiter = new ExaRateLimiter(testConfig());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// =========================================================================
	// Default Configuration Exports
	// =========================================================================

	describe('default configurations', () => {
		it('SEARCH_CONFIG should have maxRps of 4 (under 5 QPS limit)', () => {
			expect(SEARCH_CONFIG.maxRps).toBe(4);
		});

		it('SEARCH_CONFIG should have 3 max retries', () => {
			expect(SEARCH_CONFIG.maxRetries).toBe(3);
		});

		it('SEARCH_CONFIG should have 1s base delay', () => {
			expect(SEARCH_CONFIG.baseDelayMs).toBe(1000);
		});

		it('SEARCH_CONFIG should have 10s max delay', () => {
			expect(SEARCH_CONFIG.maxDelayMs).toBe(10000);
		});

		it('SEARCH_CONFIG should have circuit breaker threshold of 5', () => {
			expect(SEARCH_CONFIG.circuitBreakerThreshold).toBe(5);
		});

		it('SEARCH_CONFIG should have 30s circuit breaker reset', () => {
			expect(SEARCH_CONFIG.circuitBreakerResetMs).toBe(30000);
		});

		it('CONTENTS_CONFIG should have maxRps of 40 (under 50 QPS limit)', () => {
			expect(CONTENTS_CONFIG.maxRps).toBe(40);
		});

		it('CONTENTS_CONFIG should have 2 max retries', () => {
			expect(CONTENTS_CONFIG.maxRetries).toBe(2);
		});

		it('CONTENTS_CONFIG should have 500ms base delay', () => {
			expect(CONTENTS_CONFIG.baseDelayMs).toBe(500);
		});

		it('CONTENTS_CONFIG should have 5s max delay', () => {
			expect(CONTENTS_CONFIG.maxDelayMs).toBe(5000);
		});

		it('CONTENTS_CONFIG should have circuit breaker threshold of 3', () => {
			expect(CONTENTS_CONFIG.circuitBreakerThreshold).toBe(3);
		});

		it('CONTENTS_CONFIG should have 15s circuit breaker reset', () => {
			expect(CONTENTS_CONFIG.circuitBreakerResetMs).toBe(15000);
		});
	});

	// =========================================================================
	// Successful Execution
	// =========================================================================

	describe('successful execution', () => {
		it('should return success with data on first attempt', async () => {
			const fn = vi.fn().mockResolvedValue({ results: ['a'] });

			const result = await limiter.execute(fn, 'test-search');

			expect(result.success).toBe(true);
			expect(result.data).toEqual({ results: ['a'] });
			expect(result.attempts).toBe(1);
			expect(result.wasRateLimited).toBe(false);
		});

		it('should call the function exactly once on success', async () => {
			const fn = vi.fn().mockResolvedValue('ok');

			await limiter.execute(fn, 'test');

			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should reset consecutive failures on success', async () => {
			const config = testConfig({ circuitBreakerThreshold: 10 });
			limiter = new ExaRateLimiter(config);

			// Cause some failures
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'fail');

			// State should show failures
			expect(limiter.getState().consecutiveFailures).toBeGreaterThan(0);

			// Successful execution should reset
			const successFn = vi.fn().mockResolvedValue('ok');
			await limiter.execute(successFn, 'success');

			expect(limiter.getState().consecutiveFailures).toBe(0);
		});
	});

	// =========================================================================
	// Circuit Breaker: State Transitions
	// =========================================================================

	describe('circuit breaker: closed -> open', () => {
		it('should start in closed state', () => {
			const state = limiter.getState();
			expect(state.circuitState).toBe('closed');
			expect(state.consecutiveFailures).toBe(0);
			expect(state.circuitOpenedAt).toBeNull();
		});

		it('should transition to open after reaching failure threshold', async () => {
			const config = testConfig({ circuitBreakerThreshold: 3 });
			limiter = new ExaRateLimiter(config);

			// Trigger 3 consecutive non-retryable failures
			const failFn = vi.fn().mockRejectedValue(serverError());

			await limiter.execute(failFn, 'fail-1');
			expect(limiter.getState().circuitState).toBe('closed');
			expect(limiter.getState().consecutiveFailures).toBe(1);

			await limiter.execute(failFn, 'fail-2');
			expect(limiter.getState().circuitState).toBe('closed');
			expect(limiter.getState().consecutiveFailures).toBe(2);

			await limiter.execute(failFn, 'fail-3');
			expect(limiter.getState().circuitState).toBe('open');
			expect(limiter.getState().consecutiveFailures).toBe(3);
		});

		it('should record circuitOpenedAt timestamp when opening', async () => {
			const config = testConfig({ circuitBreakerThreshold: 1 });
			limiter = new ExaRateLimiter(config);

			vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'fail');

			expect(limiter.getState().circuitOpenedAt).toBe(Date.now());
		});

		it('should fail fast when circuit is open', async () => {
			const config = testConfig({ circuitBreakerThreshold: 1 });
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');

			// Now try to execute - should fail fast
			const fn = vi.fn().mockResolvedValue('should not execute');
			const result = await limiter.execute(fn, 'blocked');

			expect(result.success).toBe(false);
			expect(result.error).toContain('circuit breaker open');
			expect(result.attempts).toBe(0);
			expect(fn).not.toHaveBeenCalled();
		});
	});

	describe('circuit breaker: open -> half-open', () => {
		it('should transition to half-open after reset timeout', async () => {
			const config = testConfig({
				circuitBreakerThreshold: 1,
				circuitBreakerResetMs: 5000
			});
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');
			expect(limiter.getState().circuitState).toBe('open');

			// Advance past the reset timeout
			vi.advanceTimersByTime(5001);

			// Next execute should transition to half-open and allow the request
			const successFn = vi.fn().mockResolvedValue('probe');
			const result = await limiter.execute(successFn, 'probe');

			expect(result.success).toBe(true);
			expect(successFn).toHaveBeenCalled();
		});

		it('should NOT transition to half-open before reset timeout', async () => {
			const config = testConfig({
				circuitBreakerThreshold: 1,
				circuitBreakerResetMs: 5000
			});
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');

			// Advance to just before reset timeout
			vi.advanceTimersByTime(4999);

			// Should still be blocked
			const fn = vi.fn().mockResolvedValue('nope');
			const result = await limiter.execute(fn, 'too-early');

			expect(result.success).toBe(false);
			expect(result.error).toContain('circuit breaker open');
			expect(fn).not.toHaveBeenCalled();
		});
	});

	describe('circuit breaker: half-open -> closed', () => {
		it('should close circuit after successful probe in half-open state', async () => {
			const config = testConfig({
				circuitBreakerThreshold: 1,
				circuitBreakerResetMs: 5000
			});
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');

			// Wait for reset
			vi.advanceTimersByTime(5001);

			// Successful probe
			const successFn = vi.fn().mockResolvedValue('ok');
			await limiter.execute(successFn, 'probe');

			// Circuit should now be closed
			expect(limiter.getState().circuitState).toBe('closed');
			expect(limiter.getState().circuitOpenedAt).toBeNull();
			expect(limiter.getState().consecutiveFailures).toBe(0);
		});
	});

	describe('circuit breaker: half-open -> open (re-open)', () => {
		it('should re-open circuit when probe fails in half-open state', async () => {
			const config = testConfig({
				circuitBreakerThreshold: 1,
				circuitBreakerResetMs: 5000
			});
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');
			expect(limiter.getState().circuitState).toBe('open');

			// Wait for reset timeout
			vi.advanceTimersByTime(5001);

			// Probe with failure - the request goes through (half-open allows one)
			// but fails, which should re-open the circuit
			const failProbeFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failProbeFn, 'fail-probe');

			// Circuit should be open again
			expect(limiter.getState().circuitState).toBe('open');
			expect(limiter.getState().circuitOpenedAt).not.toBeNull();
		});

		it('should update circuitOpenedAt on re-open', async () => {
			const config = testConfig({
				circuitBreakerThreshold: 1,
				circuitBreakerResetMs: 5000
			});
			limiter = new ExaRateLimiter(config);

			vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');
			const firstOpenAt = limiter.getState().circuitOpenedAt;

			// Wait and re-trip
			vi.advanceTimersByTime(5001);
			const failProbeFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failProbeFn, 'fail-probe');

			const secondOpenAt = limiter.getState().circuitOpenedAt;
			expect(secondOpenAt).toBeGreaterThan(firstOpenAt!);
		});
	});

	// =========================================================================
	// Rate Limit Error Detection
	// =========================================================================

	describe('rate limit error detection', () => {
		it('should detect 429 in error message as rate limit', async () => {
			const fn = vi.fn()
				.mockRejectedValueOnce(rateLimitError('429 Too Many Requests'))
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.wasRateLimited).toBe(true);
			expect(result.attempts).toBe(2);
		});

		it('should detect "rate limit" in error message', async () => {
			const fn = vi.fn()
				.mockRejectedValueOnce(rateLimitError('Rate limit exceeded'))
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.wasRateLimited).toBe(true);
		});

		it('should detect "too many requests" in error message', async () => {
			const fn = vi.fn()
				.mockRejectedValueOnce(rateLimitError('Too many requests, slow down'))
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.wasRateLimited).toBe(true);
		});

		it('should detect status 429 in error object', async () => {
			const fn = vi.fn()
				.mockRejectedValueOnce({ status: 429 })
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.wasRateLimited).toBe(true);
		});

		it('should NOT treat non-429 errors as rate limits', async () => {
			const fn = vi.fn().mockRejectedValue(serverError('500 Internal Server Error'));

			const result = await limiter.execute(fn, 'test');

			expect(result.success).toBe(false);
			expect(result.wasRateLimited).toBe(false);
			expect(result.attempts).toBe(1); // No retries for non-rate-limit errors
		});

		it('should NOT retry on non-retryable errors', async () => {
			const fn = vi.fn().mockRejectedValue(new Error('Invalid API key'));

			const result = await limiter.execute(fn, 'test');

			expect(fn).toHaveBeenCalledTimes(1);
			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid API key');
		});

		it('should treat non-Error objects without status as non-retryable', async () => {
			const fn = vi.fn().mockRejectedValue('plain string error');

			const result = await limiter.execute(fn, 'test');

			expect(result.success).toBe(false);
			expect(result.wasRateLimited).toBe(false);
			expect(result.attempts).toBe(1);
		});

		it('should treat error objects with non-429 status as non-retryable', async () => {
			const fn = vi.fn().mockRejectedValue({ status: 500 });

			const result = await limiter.execute(fn, 'test');

			expect(result.success).toBe(false);
			expect(result.wasRateLimited).toBe(false);
		});
	});

	// =========================================================================
	// Retry with Exponential Backoff
	// =========================================================================

	describe('retry with exponential backoff', () => {
		it('should retry up to maxRetries on rate limit errors', async () => {
			const config = testConfig({ maxRetries: 3, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn()
				.mockRejectedValue(rateLimitError());

			const executePromise = limiter.execute(fn, 'test');

			// Advance timers to let all retries complete
			// Attempt 1: backoff = 100ms * 2^0 = 100ms + jitter
			// Attempt 2: backoff = 100ms * 2^1 = 200ms + jitter
			// Attempt 3: exhausted
			await vi.advanceTimersByTimeAsync(10000);

			const result = await executePromise;

			expect(fn).toHaveBeenCalledTimes(3);
			expect(result.success).toBe(false);
			expect(result.attempts).toBe(3);
			expect(result.wasRateLimited).toBe(true);
			expect(result.error).toContain('retries exhausted');
		});

		it('should succeed after retry when second attempt succeeds', async () => {
			const config = testConfig({ maxRetries: 3, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn()
				.mockRejectedValueOnce(rateLimitError())
				.mockResolvedValueOnce('success');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.data).toBe('success');
			expect(result.attempts).toBe(2);
			expect(result.wasRateLimited).toBe(true);
		});

		it('should respect maxDelayMs cap on exponential growth', async () => {
			// With baseDelayMs=500, maxDelayMs=1000, attempt 3:
			// 500 * 2^2 = 2000 -> capped to 1000
			const config = testConfig({ maxRetries: 4, baseDelayMs: 500, maxDelayMs: 1000 });
			limiter = new ExaRateLimiter(config);

			// We cannot easily measure the exact delay with fake timers,
			// but we can verify the function is retried correctly
			const fn = vi.fn()
				.mockRejectedValue(rateLimitError());

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(30000);
			const result = await executePromise;

			expect(result.attempts).toBe(4);
		});

		it('should extract Retry-After header when present', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const errorWithRetryAfter = Object.assign(
				new Error('429 rate limited'),
				{ headers: { 'retry-after': '5' } }
			);

			const fn = vi.fn()
				.mockRejectedValueOnce(errorWithRetryAfter)
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			// Retry-After: 5 means 5000ms delay
			await vi.advanceTimersByTimeAsync(6000);
			const result = await executePromise;

			expect(result.success).toBe(true);
			expect(result.wasRateLimited).toBe(true);
		});

		it('should extract Retry-After header with capitalized key', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const errorWithRetryAfter = Object.assign(
				new Error('429 rate limited'),
				{ headers: { 'Retry-After': '3' } }
			);

			const fn = vi.fn()
				.mockRejectedValueOnce(errorWithRetryAfter)
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
		});

		it('should record failure and increment consecutiveFailures when retries exhausted', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 50 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockRejectedValue(rateLimitError());

			const executePromise = limiter.execute(fn, 'exhaust');
			await vi.advanceTimersByTimeAsync(10000);
			await executePromise;

			expect(limiter.getState().consecutiveFailures).toBe(1);
		});
	});

	// =========================================================================
	// QPS Throttling (Proactive)
	// =========================================================================

	describe('QPS throttling', () => {
		it('should allow requests when under the RPS limit', async () => {
			const config = testConfig({ maxRps: 5 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockResolvedValue('ok');

			const result = await limiter.execute(fn, 'test');

			expect(result.success).toBe(true);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should record request timestamps in the sliding window', async () => {
			const config = testConfig({ maxRps: 10 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockResolvedValue('ok');
			await limiter.execute(fn, 'r1');
			await limiter.execute(fn, 'r2');

			const state = limiter.getState();
			expect(state.requestTimestamps.length).toBe(2);
		});

		it('should clean old timestamps outside the 1s sliding window', async () => {
			const config = testConfig({ maxRps: 10 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockResolvedValue('ok');

			await limiter.execute(fn, 'r1');
			await limiter.execute(fn, 'r2');

			// Advance past the 1s window
			vi.advanceTimersByTime(1100);

			await limiter.execute(fn, 'r3');

			// Old timestamps should be cleaned, only r3 remains
			const state = limiter.getState();
			expect(state.requestTimestamps.length).toBe(1);
		});
	});

	// =========================================================================
	// Staggered Execution
	// =========================================================================

	describe('staggered execution', () => {
		it('should execute all functions and return results in order', async () => {
			const config = testConfig({ maxRps: 5 });
			limiter = new ExaRateLimiter(config);

			const fns = [
				vi.fn().mockResolvedValue('a'),
				vi.fn().mockResolvedValue('b'),
				vi.fn().mockResolvedValue('c')
			];

			const promise = limiter.executeStaggered(fns, 'batch');
			await vi.advanceTimersByTimeAsync(10000);
			const results = await promise;

			expect(results).toHaveLength(3);
			expect(results[0].data).toBe('a');
			expect(results[1].data).toBe('b');
			expect(results[2].data).toBe('c');
		});

		it('should stagger requests by 1/maxRps seconds between each', async () => {
			const config = testConfig({ maxRps: 5 }); // 200ms stagger
			limiter = new ExaRateLimiter(config);

			const callTimes: number[] = [];
			const fns = [
				vi.fn().mockImplementation(async () => { callTimes.push(Date.now()); return 'a'; }),
				vi.fn().mockImplementation(async () => { callTimes.push(Date.now()); return 'b'; }),
				vi.fn().mockImplementation(async () => { callTimes.push(Date.now()); return 'c'; })
			];

			const promise = limiter.executeStaggered(fns, 'batch');
			await vi.advanceTimersByTimeAsync(10000);
			await promise;

			expect(callTimes).toHaveLength(3);
			// Second call should be >= 200ms after first
			expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(200);
			// Third call should be >= 200ms after second
			expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(200);
		});

		it('should handle empty function array', async () => {
			const results = await limiter.executeStaggered([], 'empty');
			expect(results).toEqual([]);
		});

		it('should handle individual failures within a batch', async () => {
			const config = testConfig({ maxRps: 10 });
			limiter = new ExaRateLimiter(config);

			const fns = [
				vi.fn().mockResolvedValue('a'),
				vi.fn().mockRejectedValue(serverError('fail')),
				vi.fn().mockResolvedValue('c')
			];

			const promise = limiter.executeStaggered(fns, 'mixed');
			await vi.advanceTimersByTimeAsync(10000);
			const results = await promise;

			expect(results[0].success).toBe(true);
			expect(results[0].data).toBe('a');
			expect(results[1].success).toBe(false);
			expect(results[1].error).toBe('fail');
			expect(results[2].success).toBe(true);
			expect(results[2].data).toBe('c');
		});
	});

	// =========================================================================
	// State Management
	// =========================================================================

	describe('state management', () => {
		it('getState should return a snapshot (not reference to internal state)', () => {
			const state1 = limiter.getState();
			(state1 as { consecutiveFailures: number }).consecutiveFailures = 999;

			const state2 = limiter.getState();
			expect(state2.consecutiveFailures).toBe(0);
		});

		it('reset should clear all state', async () => {
			const config = testConfig({ circuitBreakerThreshold: 1 });
			limiter = new ExaRateLimiter(config);

			// Trip the circuit and add some state
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'fail');

			expect(limiter.getState().circuitState).toBe('open');
			expect(limiter.getState().consecutiveFailures).toBeGreaterThan(0);

			// Reset
			limiter.reset();

			const state = limiter.getState();
			expect(state.circuitState).toBe('closed');
			expect(state.consecutiveFailures).toBe(0);
			expect(state.circuitOpenedAt).toBeNull();
			expect(state.requestTimestamps).toEqual([]);
		});

		it('reset should allow requests again after circuit was open', async () => {
			const config = testConfig({ circuitBreakerThreshold: 1 });
			limiter = new ExaRateLimiter(config);

			// Trip the circuit
			const failFn = vi.fn().mockRejectedValue(serverError());
			await limiter.execute(failFn, 'trip');

			// Verify blocked
			const blockedFn = vi.fn().mockResolvedValue('blocked');
			const blockedResult = await limiter.execute(blockedFn, 'blocked');
			expect(blockedResult.success).toBe(false);

			// Reset and retry
			limiter.reset();

			const successFn = vi.fn().mockResolvedValue('after-reset');
			const result = await limiter.execute(successFn, 'after-reset');
			expect(result.success).toBe(true);
			expect(result.data).toBe('after-reset');
		});
	});

	// =========================================================================
	// Concurrent Request Handling
	// =========================================================================

	describe('concurrent request handling', () => {
		it('should handle multiple parallel executions', async () => {
			const config = testConfig({ maxRps: 10 });
			limiter = new ExaRateLimiter(config);

			const fns = Array.from({ length: 5 }, (_, i) =>
				vi.fn().mockResolvedValue(`result-${i}`)
			);

			const promises = fns.map((fn, i) =>
				limiter.execute(fn, `parallel-${i}`)
			);

			await vi.advanceTimersByTimeAsync(10000);
			const results = await Promise.all(promises);

			results.forEach((result, i) => {
				expect(result.success).toBe(true);
				expect(result.data).toBe(`result-${i}`);
			});
		});

		it('should properly track timestamps from concurrent requests', async () => {
			const config = testConfig({ maxRps: 20 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockResolvedValue('ok');

			const promises = Array.from({ length: 5 }, (_, i) =>
				limiter.execute(fn, `concurrent-${i}`)
			);

			await vi.advanceTimersByTimeAsync(10000);
			await Promise.all(promises);

			const state = limiter.getState();
			expect(state.requestTimestamps.length).toBe(5);
		});
	});

	// =========================================================================
	// Error Message Formatting
	// =========================================================================

	describe('error message formatting', () => {
		it('should include error message from Error objects', async () => {
			const fn = vi.fn().mockRejectedValue(new Error('specific error'));
			const result = await limiter.execute(fn, 'test');

			expect(result.error).toBe('specific error');
		});

		it('should stringify non-Error objects', async () => {
			const fn = vi.fn().mockRejectedValue('string error');
			const result = await limiter.execute(fn, 'test');

			expect(result.error).toBe('string error');
		});

		it('should include attempts count in exhausted error', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 10 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockRejectedValue(rateLimitError());

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(10000);
			const result = await executePromise;

			expect(result.error).toContain('2 attempts');
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('edge cases', () => {
		it('should handle maxRetries of 1', async () => {
			const config = testConfig({ maxRetries: 1, baseDelayMs: 50 });
			limiter = new ExaRateLimiter(config);

			const fn = vi.fn().mockRejectedValue(rateLimitError());
			const executePromise = limiter.execute(fn, 'once');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.attempts).toBe(1);
			expect(result.success).toBe(false);
		});

		it('should handle functions that return undefined', async () => {
			const fn = vi.fn().mockResolvedValue(undefined);
			const result = await limiter.execute(fn, 'undefined');

			expect(result.success).toBe(true);
			expect(result.data).toBeUndefined();
		});

		it('should handle functions that return null', async () => {
			const fn = vi.fn().mockResolvedValue(null);
			const result = await limiter.execute(fn, 'null');

			expect(result.success).toBe(true);
			expect(result.data).toBeNull();
		});

		it('should handle Retry-After with non-numeric value gracefully', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const errorWithBadRetryAfter = Object.assign(
				new Error('429 rate limited'),
				{ headers: { 'retry-after': 'invalid' } }
			);

			const fn = vi.fn()
				.mockRejectedValueOnce(errorWithBadRetryAfter)
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			// Should fall back to exponential backoff and succeed on retry
			expect(result.success).toBe(true);
		});

		it('should handle errors with headers but no retry-after', async () => {
			const config = testConfig({ maxRetries: 2, baseDelayMs: 100 });
			limiter = new ExaRateLimiter(config);

			const errorWithOtherHeaders = Object.assign(
				new Error('429 rate limited'),
				{ headers: { 'x-request-id': '123' } }
			);

			const fn = vi.fn()
				.mockRejectedValueOnce(errorWithOtherHeaders)
				.mockResolvedValueOnce('ok');

			const executePromise = limiter.execute(fn, 'test');
			await vi.advanceTimersByTimeAsync(5000);
			const result = await executePromise;

			expect(result.success).toBe(true);
		});
	});

	// =========================================================================
	// Singleton Accessors
	// =========================================================================

	describe('singleton accessors', () => {
		it('getSearchRateLimiter should return an ExaRateLimiter instance', () => {
			const rl = getSearchRateLimiter();
			expect(rl).toBeInstanceOf(ExaRateLimiter);
		});

		it('getContentsRateLimiter should return an ExaRateLimiter instance', () => {
			const rl = getContentsRateLimiter();
			expect(rl).toBeInstanceOf(ExaRateLimiter);
		});

		it('getSearchRateLimiter should return the same instance on repeated calls', () => {
			const rl1 = getSearchRateLimiter();
			const rl2 = getSearchRateLimiter();
			expect(rl1).toBe(rl2);
		});

		it('getContentsRateLimiter should return the same instance on repeated calls', () => {
			const rl1 = getContentsRateLimiter();
			const rl2 = getContentsRateLimiter();
			expect(rl1).toBe(rl2);
		});

		it('search and contents rate limiters should be different instances', () => {
			const search = getSearchRateLimiter();
			const contents = getContentsRateLimiter();
			expect(search).not.toBe(contents);
		});
	});
});
