/**
 * Firecrawl Rate Limiter
 *
 * NOTE: On CF Workers, rate limiting state resets per-isolate. Proactive
 * throttling within a single request still works. Circuit breaker across
 * requests does not.
 *
 * Reuses the generic ExaRateLimiter with Firecrawl-appropriate config.
 * Conservative 10 RPS — Firecrawl has no documented QPS limit,
 * but headless browser renders are inherently slower.
 */

import { ExaRateLimiter, type RateLimitConfig } from '$lib/server/exa';

export const FIRECRAWL_CONFIG: RateLimitConfig = {
	maxRps: 10,
	maxRetries: 2,
	baseDelayMs: 1000,
	maxDelayMs: 8000,
	circuitBreakerThreshold: 5,
	circuitBreakerResetMs: 30000
};

declare global {
	// eslint-disable-next-line no-var
	var __firecrawlRateLimiter: ExaRateLimiter | undefined;
}

const firecrawlRateLimiter = new ExaRateLimiter(FIRECRAWL_CONFIG);

export function getFirecrawlRateLimiter(): ExaRateLimiter {
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment) {
		if (!global.__firecrawlRateLimiter) {
			global.__firecrawlRateLimiter = new ExaRateLimiter(FIRECRAWL_CONFIG);
		}
		return global.__firecrawlRateLimiter;
	}

	return firecrawlRateLimiter;
}
