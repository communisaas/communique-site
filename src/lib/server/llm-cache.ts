/**
 * LLM Extraction Caching Layer (Epic 3)
 *
 * Cache LLM extractions by content hash to save 95%+ of API costs
 * 90-day TTL (semi-permanent for template reuse)
 *
 * Uses Redis (same infrastructure as geocoding-cache)
 * Expected cache hit rate: > 80% after first month
 */

import crypto from 'crypto';
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

// TODO: Implement Redis client when geocoding-cache is added
// For now, use in-memory cache (will be replaced with Redis)
const memoryCache = new Map<string, { result: ScopeMapping; expires: number }>();

/**
 * Generate content hash for caching
 *
 * Hash combines subject + message for deterministic key
 * Collisions are acceptable (same content = same extraction)
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @returns 16-character hex hash
 */
function getContentHash(message: string, subject: string): string {
	return crypto
		.createHash('sha256')
		.update(`${subject}::${message}`)
		.digest('hex')
		.substring(0, 16);
}

/**
 * Get cached LLM extraction if available
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @returns Cached ScopeMapping or null if not found/expired
 */
export async function getCachedLLMExtraction(
	message: string,
	subject: string
): Promise<ScopeMapping | null> {
	const hash = getContentHash(message, subject);
	const key = `llm_scope:${hash}`;

	// TODO: Replace with Redis GET when available
	const cached = memoryCache.get(key);
	if (!cached) return null;

	// Check expiration
	if (Date.now() > cached.expires) {
		memoryCache.delete(key);
		return null;
	}

	console.log(
		'[llm-cache]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			hash,
			cache_hit: true,
			extraction_method: 'llm',
			display_text: cached.result.display_text
		})
	);

	return cached.result;
}

/**
 * Cache LLM extraction result
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @param result - Extracted ScopeMapping
 */
export async function setCachedLLMExtraction(
	message: string,
	subject: string,
	result: ScopeMapping
): Promise<void> {
	const hash = getContentHash(message, subject);
	const key = `llm_scope:${hash}`;
	const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

	// TODO: Replace with Redis SET when available
	memoryCache.set(key, {
		result,
		expires: Date.now() + TTL_SECONDS * 1000
	});

	console.log(
		'[llm-cache]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			hash,
			cache_set: true,
			extraction_method: 'llm',
			display_text: result.display_text,
			ttl_days: 90
		})
	);
}

/**
 * Extract with LLM + caching
 *
 * Check cache first, call LLM only if not cached
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @param context - Optional extraction context
 * @returns ScopeMapping from cache or LLM, or null if extraction fails
 */
export async function extractWithLLMCached(
	message: string,
	subject: string,
	context?: {
		decision_makers?: string[];
		domain?: string;
		user_location?: { country?: string; region?: string };
	}
): Promise<ScopeMapping | null> {
	// Check cache first
	const cached = await getCachedLLMExtraction(message, subject);
	if (cached) return cached;

	// Cache miss - call LLM
	const { extractScopeWithLLM } = await import('./llm-scope-extraction');
	const result = await extractScopeWithLLM(message, subject, context);

	// Cache result if extraction succeeded
	if (result) {
		await setCachedLLMExtraction(message, subject, result);
	}

	return result;
}
