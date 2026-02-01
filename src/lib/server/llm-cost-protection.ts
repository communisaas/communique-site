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
import { error } from '@sveltejs/kit';
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

	// Firecrawl Map API: site mapping for leadership pages
	'firecrawl-map': {
		guest: [0, 3600000], // BLOCKED for guests
		authenticated: [5, 3600000], // 5 per hour
		verified: [15, 3600000] // 15 per hour
	},

	// Firecrawl Deep Research API: expensive autonomous research
	'firecrawl-research': {
		guest: [0, 3600000], // BLOCKED for guests
		authenticated: [0, 3600000], // BLOCKED - verified only
		verified: [3, 3600000] // 3 per hour (expensive operation)
	},

	// Firecrawl Observer API: page monitoring
	'firecrawl-observer': {
		guest: [0, 3600000], // BLOCKED for guests
		authenticated: [0, 3600000], // BLOCKED - verified only
		verified: [10, 3600000] // 10 per hour (creates observers)
	},

	// Firecrawl Enrich API: contact enrichment
	'firecrawl-enrich': {
		guest: [0, 3600000], // BLOCKED for guests
		authenticated: [0, 3600000], // BLOCKED - verified only
		verified: [20, 3600000] // 20 per hour (moderate cost operation)
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

	// Check verification status from user record in locals
	// SECURITY FIX: Use correct field name (is_verified: boolean, not verificationStatus)
	// User is set directly on event.locals.user by hooks.server.ts:28-55
	const user = event.locals.user;
	const isVerified = user?.is_verified === true;

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
			case 'firecrawl-map':
				return 'Site mapping requires an account. Sign in to continue.';
			case 'firecrawl-research':
				return 'Deep research requires a verified account. Sign in and verify your identity.';
			case 'firecrawl-observer':
				return 'Page observers require a verified account. Sign in and verify your identity.';
			case 'firecrawl-enrich':
				return 'Contact enrichment requires a verified account. Sign in and verify your identity.';
			default:
				return 'This action requires an account.';
		}
	}
	if (tier === 'authenticated') {
		switch (operation) {
			case 'firecrawl-research':
				return 'Deep research requires a verified account. Please verify your identity.';
			case 'firecrawl-observer':
				return 'Page observers require a verified account. Please verify your identity.';
			case 'firecrawl-enrich':
				return 'Contact enrichment requires a verified account. Please verify your identity.';
			default:
				return 'This action requires identity verification.';
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
		case 'firecrawl-map':
			return `Site mapping limit reached. Try again after ${resetTime}.`;
		case 'firecrawl-research':
			return `Deep research limit reached (expensive operation). Try again after ${resetTime}.`;
		case 'firecrawl-observer':
			return `Observer creation limit reached. Try again after ${resetTime}.`;
		case 'firecrawl-enrich':
			return `Contact enrichment limit reached. Try again after ${resetTime}.`;
		default:
			return `Rate limit exceeded. Try again after ${resetTime}.`;
	}
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Enforce rate limit or throw 429 error
 *
 * Use this at the start of expensive API routes:
 *
 * ```typescript
 * export const POST: RequestHandler = async (event) => {
 *   await enforceLLMRateLimit(event, 'decision-makers');
 *   // ... rest of handler
 * };
 * ```
 */
export async function enforceLLMRateLimit(
	event: RequestEvent,
	operation: string
): Promise<RateLimitCheck> {
	const context = getUserContext(event);
	const check = await checkRateLimit(operation, context);

	if (!check.allowed) {
		console.log(`[LLM-Protection] Rate limit blocked: ${operation} for ${context.identifier}`);

		// Return 429 with informative headers and body
		throw error(429, {
			message: check.reason || 'Rate limit exceeded',
			// @ts-expect-error - SvelteKit allows extra fields
			tier: check.tier,
			remaining: check.remaining,
			limit: check.limit,
			resetAt: check.resetAt.toISOString()
		});
	}

	// Log successful check for monitoring
	console.log(
		`[LLM-Protection] Allowed: ${operation} for ${context.identifier} (${check.remaining}/${check.limit} remaining)`
	);

	return check;
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
// Cost Tracking (Future Enhancement)
// ============================================

/**
 * Log LLM operation for cost tracking
 *
 * TODO: Store in database for analytics dashboard
 */
export function logLLMOperation(
	operation: string,
	context: UserContext,
	details: {
		callCount: number;
		inputTokens?: number;
		outputTokens?: number;
		durationMs: number;
		success: boolean;
	}
): void {
	console.log(`[LLM-Cost] ${operation}`, {
		user: context.identifier,
		tier: context.tier,
		...details,
		estimatedCost: estimateCost(details.callCount, details.inputTokens, details.outputTokens)
	});
}

/**
 * Estimate cost of LLM operation
 *
 * Gemini 3 Flash pricing:
 * - Input: $0.075 per 1M tokens
 * - Output: $0.30 per 1M tokens
 */
function estimateCost(calls: number, inputTokens = 2000, outputTokens = 1000): string {
	const inputCost = (inputTokens / 1_000_000) * 0.075 * calls;
	const outputCost = (outputTokens / 1_000_000) * 0.3 * calls;
	return `$${(inputCost + outputCost).toFixed(4)}`;
}
