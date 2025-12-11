import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SuggestionRateLimiter } from '$lib/services/ai/rate-limiter';

describe('SuggestionRateLimiter', () => {
	let limiter: SuggestionRateLimiter;

	beforeEach(() => {
		limiter = new SuggestionRateLimiter(3, 1000); // 3 calls per 1 second for testing
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should allow calls within limit', () => {
		expect(limiter.canMakeCall()).toBe(true);
		limiter.recordCall();

		expect(limiter.canMakeCall()).toBe(true);
		limiter.recordCall();

		expect(limiter.canMakeCall()).toBe(true);
		limiter.recordCall();
	});

	it('should block calls when limit reached', () => {
		limiter.recordCall();
		limiter.recordCall();
		limiter.recordCall();

		expect(limiter.canMakeCall()).toBe(false);
	});

	it('should reset after time window expires', () => {
		limiter.recordCall();
		limiter.recordCall();
		limiter.recordCall();

		expect(limiter.canMakeCall()).toBe(false);

		// Fast-forward past time window
		vi.advanceTimersByTime(1100);

		expect(limiter.canMakeCall()).toBe(true);
	});

	it('should track remaining calls correctly', () => {
		expect(limiter.getRemainingCalls()).toBe(3);

		limiter.recordCall();
		expect(limiter.getRemainingCalls()).toBe(2);

		limiter.recordCall();
		expect(limiter.getRemainingCalls()).toBe(1);

		limiter.recordCall();
		expect(limiter.getRemainingCalls()).toBe(0);
	});

	it('should calculate time until reset correctly', () => {
		const startTime = Date.now();
		vi.setSystemTime(startTime);

		limiter.recordCall();

		// Advance 500ms
		vi.advanceTimersByTime(500);

		const timeUntilReset = limiter.getTimeUntilReset();
		expect(timeUntilReset).toBe(500);
	});

	it('should handle sliding window correctly', () => {
		const startTime = Date.now();
		vi.setSystemTime(startTime);

		// Make 3 calls spaced out by 100ms each
		limiter.recordCall(); // at time 0
		vi.advanceTimersByTime(100);
		limiter.recordCall(); // at time 100
		vi.advanceTimersByTime(100);
		limiter.recordCall(); // at time 200

		expect(limiter.canMakeCall()).toBe(false);

		// Advance 600ms (now at 900ms total, all calls still within window)
		vi.advanceTimersByTime(600);

		// Still can't make call (all calls still within window)
		expect(limiter.canMakeCall()).toBe(false);

		// Advance another 200ms (now at 1100ms - first call at time 0 should be expired)
		vi.advanceTimersByTime(200);

		// Should be able to make call now (first call expired, 2 calls remain in window)
		expect(limiter.canMakeCall()).toBe(true);
		expect(limiter.getRemainingCalls()).toBe(1); // Had 3 calls, 1 expired, so 2 in window, 1 remaining slot
	});
});
