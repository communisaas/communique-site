/**
 * Public API v1 — plan-tiered rate limiting.
 *
 * Each billing plan gets a different requests-per-minute ceiling.
 * Uses the same sliding-window rate limiter singleton as the rest of the app.
 */

import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { apiError } from './response';
import type { ApiKeyContext } from './auth';

/** Per-plan API rate limits (requests per minute). */
const API_PLAN_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
	free: { maxRequests: 100, windowMs: 60_000 },
	starter: { maxRequests: 300, windowMs: 60_000 },
	organization: { maxRequests: 1000, windowMs: 60_000 },
	coalition: { maxRequests: 3000, windowMs: 60_000 }
};

/**
 * Check plan-tiered rate limit for an API v1 request.
 * Returns null if allowed, or a 429 Response if rate-limited.
 */
export async function checkApiPlanRateLimit(ctx: ApiKeyContext): Promise<Response | null> {
	const limits = API_PLAN_LIMITS[ctx.planSlug] ?? API_PLAN_LIMITS.free;
	const limiter = getRateLimiter();
	const result = await limiter.check(`ratelimit:api-v1:plan:${ctx.keyId}`, limits);

	if (!result.allowed) {
		return apiError(
			'RATE_LIMITED',
			`API rate limit exceeded. Your ${ctx.planSlug} plan allows ${limits.maxRequests} requests per minute. Retry after ${result.retryAfter} seconds.`,
			429
		);
	}
	return null;
}
