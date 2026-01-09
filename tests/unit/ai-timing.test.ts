import { describe, it, expect } from 'vitest';
import { AI_SUGGESTION_TIMING } from '$lib/constants/ai-timing';

describe('AI Timing Constants', () => {
	it('should have correct debounce delay', () => {
		expect(AI_SUGGESTION_TIMING.DEBOUNCE_DELAY).toBe(1200);
	});

	it('should have minimum input length', () => {
		expect(AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH).toBe(15);
	});

	it('should have suggestion timeout', () => {
		expect(AI_SUGGESTION_TIMING.SUGGESTION_TIMEOUT).toBe(30000); // 30s for AI generation
	});

	it('should have rate limit configuration', () => {
		expect(AI_SUGGESTION_TIMING.MAX_CALLS_PER_SESSION).toBe(10);
		expect(AI_SUGGESTION_TIMING.RATE_LIMIT_WINDOW).toBe(300000);
	});

	it('should have cache configuration', () => {
		expect(AI_SUGGESTION_TIMING.CACHE_DURATION).toBe(300000);
		expect(AI_SUGGESTION_TIMING.MAX_CACHE_SIZE).toBe(20);
	});
});
