import { AI_SUGGESTION_TIMING } from '$lib/constants/ai-timing';

/**
 * Rate limiter for AI suggestion API calls
 */
export class SuggestionRateLimiter {
	private callTimestamps: number[] = [];
	private readonly maxCalls: number;
	private readonly windowMs: number;

	constructor(
		maxCalls = AI_SUGGESTION_TIMING.MAX_CALLS_PER_SESSION,
		windowMs = AI_SUGGESTION_TIMING.RATE_LIMIT_WINDOW
	) {
		this.maxCalls = maxCalls;
		this.windowMs = windowMs;
	}

	canMakeCall(): boolean {
		const now = Date.now();

		// Remove expired timestamps
		this.callTimestamps = this.callTimestamps.filter((ts) => now - ts < this.windowMs);

		return this.callTimestamps.length < this.maxCalls;
	}

	recordCall(): void {
		this.callTimestamps.push(Date.now());
	}

	getRemainingCalls(): number {
		const now = Date.now();
		this.callTimestamps = this.callTimestamps.filter((ts) => now - ts < this.windowMs);
		return this.maxCalls - this.callTimestamps.length;
	}

	getTimeUntilReset(): number {
		if (this.callTimestamps.length === 0) return 0;
		const oldestCall = Math.min(...this.callTimestamps);
		const resetTime = oldestCall + this.windowMs;
		return Math.max(0, resetTime - Date.now());
	}
}
