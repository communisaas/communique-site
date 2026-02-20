/**
 * LLM Cost Protection System
 *
 * Defense-in-depth rate limiting for expensive AI operations.
 * Implements trust tiers that scale with user accountability.
 *
 * Philosophy: A civic engagement app should welcome exploration
 * but require accountability for expensive operations. Users
 * earn capacity through trust signals (auth, verification).
 *
 * Trust Tiers:
 * - Guest: Can explore (subject lines) but not drain (decision-makers)
 * - Authenticated: Reasonable quotas for genuine use
 * - Verified: Higher limits for proven constituents
 *
 * Cost Profile (Gemini 3 Flash + Grounding):
 * - Subject generation: 1-2 calls (~$0.003)
 * - Decision-maker resolution: 4-6 calls (~$0.015)
 * - Message generation: 2+ calls (~$0.006)
 */

import { rateLimiter } from './rate-limiter';
import type { RequestEvent } from '@sveltejs/kit';

// ============================================
// Trust Tier Definitions
// ============================================

export type TrustTier = 'guest' | 'authenticated' | 'verified';

/**
 * Quota configuration per operation and trust tier
 *
 * Format: [requests, windowMs]
 * Window is in milliseconds (1 hour = 3600000)
 */
const QUOTAS: Record<string, Record<TrustTier, [number, number]>> = {
	// Subject line: exploration-friendly, but not infinite
	'subject-line': {
		guest: [5, 3600000], // 5 per hour (matches client expectation)
		authenticated: [15, 3600000], // 15 per hour
		verified: [30, 3600000] // 30 per hour
	},

	// Decision-makers: expensive, requires accountability
	'decision-makers': {
		guest: [0, 3600000], // BLOCKED for guests (require auth)
		authenticated: [3, 3600000], // 3 per hour
		verified: [10, 3600000] // 10 per hour
	},

	// Message generation: already requires auth, add quotas
	'message-generation': {
		guest: [0, 3600000], // BLOCKED (endpoint already requires auth)
		authenticated: [10, 3600000], // 10 per hour
		verified: [30, 3600000] // 30 per hour
	},

	// Global daily limit across all operations (circuit breaker)
	'daily-global': {
		guest: [10, 86400000], // 10 per day total
		authenticated: [50, 86400000], // 50 per day total
		verified: [150, 86400000] // 150 per day total
	}
};

// ============================================
// Trust Tier Resolution
// ============================================

interface UserContext {
	userId: string | null;
	isAuthenticated: boolean;
	isVerified: boolean;
	tier: TrustTier;
	identifier: string; // For rate limit key (userId or IP)
}

/**
 * Extract user context from request event
 *
 * Determines trust tier based on:
 * 1. Authentication status (session exists)
 * 2. Verification status (identity verified via SELF/government ID)
 *
 * SECURITY: Uses SvelteKit's getClientAddress() which respects adapter trust proxy
 * settings, NOT raw x-forwarded-for header (which is attacker-controlled).
 */
export function getUserContext(event: RequestEvent): UserContext {
	const session = event.locals.session;
	const userId = session?.userId || null;

	// SECURITY FIX: Use SvelteKit's trusted client address extraction
	// This respects adapter-node's trust proxy configuration and handles
	// proxy chains correctly (unlike raw x-forwarded-for parsing).
	// Falls back to 'unknown' only if truly unavailable.
	let ip: string;
	try {
		ip = event.getClientAddress();
	} catch {
		// getClientAddress() can throw if not available (e.g., in tests)
		// Fall back to platform-specific headers in priority order
		const headers = event.request.headers;
		ip =
			headers.get('fly-client-ip') || // Fly.io's trusted header
			headers.get('cf-connecting-ip') || // Cloudflare's trusted header
			headers.get('x-real-ip') || // Common reverse proxy header
			'unknown';
	}

	// Check verification status from graduated trust tier model
	// Tier 2+ (address-attested) qualifies for verified quotas
	const user = event.locals.user;
	const isVerified = (user?.trust_tier ?? 0) >= 2;

	const isAuthenticated = !!userId;

	let tier: TrustTier = 'guest';
	if (isVerified) {
		tier = 'verified';
	} else if (isAuthenticated) {
		tier = 'authenticated';
	}

	return {
		userId,
		isAuthenticated,
		isVerified,
		tier,
		identifier: userId || `ip:${ip}`
	};
}

// ============================================
// Rate Limit Check
// ============================================

export interface RateLimitCheck {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: Date;
	tier: TrustTier;
	reason?: string;
}

/**
 * Check if user is allowed to perform an operation
 *
 * @param operation - Operation type (subject-line, decision-makers, etc.)
 * @param context - User context from getUserContext()
 * @returns Rate limit check result
 */
export async function checkRateLimit(
	operation: string,
	context: UserContext
): Promise<RateLimitCheck> {
	const quota = QUOTAS[operation]?.[context.tier];

	if (!quota) {
		// SECURITY FIX: Fail CLOSED for unknown operations
		// This prevents typos or new endpoints from bypassing rate limiting
		console.error(`[LLM-Protection] BLOCKED: Unknown operation "${operation}" - failing closed`);
		return {
			allowed: false,
			remaining: 0,
			limit: 0,
			resetAt: new Date(Date.now() + 3600000),
			tier: context.tier,
			reason: `Operation "${operation}" is not configured for rate limiting. Contact support.`
		};
	}

	const [max, windowMs] = quota;

	// Zero quota = blocked for this tier
	if (max === 0) {
		return {
			allowed: false,
			remaining: 0,
			limit: 0,
			resetAt: new Date(Date.now()),
			tier: context.tier,
			reason: getBlockedReason(operation, context.tier)
		};
	}

	// Check operation-specific limit
	const key = `llm:${operation}:${context.identifier}`;
	const result = await rateLimiter.limit(key, max, windowMs);

	// Also check daily global limit (circuit breaker)
	const dailyQuota = QUOTAS['daily-global'][context.tier];
	const dailyKey = `llm:daily:${context.identifier}`;
	const dailyResult = await rateLimiter.limit(dailyKey, dailyQuota[0], dailyQuota[1]);

	// Use the more restrictive of the two
	const allowed = result.success && dailyResult.success;
	const remaining = Math.min(result.remaining, dailyResult.remaining);

	return {
		allowed,
		remaining,
		limit: max,
		resetAt: new Date(result.reset),
		tier: context.tier,
		reason: allowed ? undefined : getRateLimitReason(operation, context.tier, result, dailyResult)
	};
}

/**
 * Get human-readable reason for blocked operation
 */
function getBlockedReason(operation: string, tier: TrustTier): string {
	if (tier === 'guest') {
		switch (operation) {
			case 'decision-makers':
				return 'Finding decision-makers requires an account. Sign in to continue.';
			case 'message-generation':
				return 'Generating messages requires an account. Sign in to continue.';
			default:
				return 'This action requires an account.';
		}
	}
	return 'This action is not available for your account type.';
}

/**
 * Get human-readable reason for rate limit exceeded
 */
function getRateLimitReason(
	operation: string,
	tier: TrustTier,
	opResult: { success: boolean; reset: number },
	dailyResult: { success: boolean; reset: number }
): string {
	if (!dailyResult.success) {
		const resetTime = new Date(dailyResult.reset).toLocaleTimeString();
		return `Daily limit reached. Resets at ${resetTime}. Verify your identity for higher limits.`;
	}

	const resetTime = new Date(opResult.reset).toLocaleTimeString();

	switch (operation) {
		case 'subject-line':
			return `Subject line limit reached (${tier} tier). Try again after ${resetTime}.`;
		case 'decision-makers':
			return `Decision-maker lookup limit reached. Try again after ${resetTime}.`;
		case 'message-generation':
			return `Message generation limit reached. Try again after ${resetTime}.`;
		default:
			return `Rate limit exceeded. Try again after ${resetTime}.`;
	}
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Check rate limit for an operation.
 *
 * ```typescript
 * const check = await enforceLLMRateLimit(event, 'decision-makers');
 * if (!check.allowed) return rateLimitResponse(check);
 * ```
 */
/**
 * Check rate limit and return the result.
 *
 * Does NOT throw — returns the check so the caller can build a proper
 * Response with the full JSON body (tier, resetAt, etc.) instead of
 * relying on SvelteKit's error() which strips extra fields.
 */
export async function enforceLLMRateLimit(
	event: RequestEvent,
	operation: string
): Promise<RateLimitCheck> {
	const context = getUserContext(event);
	const check = await checkRateLimit(operation, context);

	if (!check.allowed) {
		console.debug(`[LLM-Protection] Rate limit blocked: ${operation} for ${context.identifier}`);
	} else {
		console.debug(
			`[LLM-Protection] Allowed: ${operation} for ${context.identifier} (${check.remaining}/${check.limit} remaining)`
		);
	}

	return check;
}

/**
 * Build a 429 JSON response from a failed rate-limit check.
 * Includes tier, resetAt, and remaining so the frontend can
 * distinguish guest-blocked from authenticated-rate-limited.
 */
export function rateLimitResponse(check: RateLimitCheck): Response {
	return new Response(
		JSON.stringify({
			error: check.reason || 'Rate limit exceeded',
			tier: check.tier,
			remaining: check.remaining,
			limit: check.limit,
			resetAt: check.resetAt.toISOString()
		}),
		{
			status: 429,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

/**
 * Add rate limit headers to response
 *
 * Call after successful operation to inform client of remaining quota
 */
export function addRateLimitHeaders(headers: Headers, check: RateLimitCheck): void {
	headers.set('X-RateLimit-Limit', String(check.limit));
	headers.set('X-RateLimit-Remaining', String(check.remaining));
	headers.set('X-RateLimit-Reset', check.resetAt.toISOString());
	headers.set('X-RateLimit-Tier', check.tier);
}

// ============================================
// Cost Tracking
// ============================================

import type { TokenUsage } from '$lib/core/agents/types';

/**
 * Compute cost from actual token counts.
 *
 * Gemini 3 Flash pricing:
 * - Input: $0.075 per 1M tokens
 * - Output: $0.30 per 1M tokens
 *
 * Returns undefined if token counts are not available.
 */
export function computeCostUsd(
	tokenUsage?: { promptTokens: number; candidatesTokens: number }
): number | undefined {
	if (!tokenUsage) return undefined;
	const inputCost = (tokenUsage.promptTokens / 1_000_000) * 0.075;
	const outputCost = (tokenUsage.candidatesTokens / 1_000_000) * 0.3;
	return inputCost + outputCost;
}

/**
 * Log LLM operation with real token usage and persist via trace system.
 */
export function logLLMOperation(
	operation: string,
	context: UserContext,
	details: {
		durationMs: number;
		success: boolean;
		tokenUsage?: TokenUsage;
	},
	traceId?: string
): void {
	const costUsd = computeCostUsd(details.tokenUsage);

	console.log(`[LLM-Cost] ${operation}`, {
		user: context.identifier,
		tier: context.tier,
		durationMs: details.durationMs,
		success: details.success,
		...(details.tokenUsage && {
			inputTokens: details.tokenUsage.promptTokens,
			outputTokens: details.tokenUsage.candidatesTokens,
			totalTokens: details.tokenUsage.totalTokens
		}),
		costUsd: costUsd !== undefined ? `$${costUsd.toFixed(6)}` : 'no token data'
	});

	if (traceId) {
		import('$lib/server/agent-trace').then(({ traceCompletion }) => {
			traceCompletion(
				traceId,
				operation,
				{ tier: context.tier },
				{
					userId: context.userId,
					durationMs: details.durationMs,
					success: details.success,
					costUsd,
					inputTokens: details.tokenUsage?.promptTokens,
					outputTokens: details.tokenUsage?.candidatesTokens,
					thoughtsTokens: details.tokenUsage?.thoughtsTokens,
					totalTokens: details.tokenUsage?.totalTokens
				}
			);
		}).catch(() => {});
	}
}
