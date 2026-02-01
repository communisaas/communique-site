/**
 * Gemini Context Cache Manager
 *
 * Manages cached content for Gemini API to reduce token costs by caching:
 * - System prompts that repeat across requests
 * - Response schemas that stay constant
 * - Large document contexts
 *
 * Key Features:
 * - 90% token cost savings on cached content (Gemini 2.5+)
 * - Automatic TTL management with expiration tracking
 * - SHA-256 content hashing for cache key generation
 * - In-memory cache registry with automatic cleanup
 * - Support for both system instruction and schema caching
 *
 * Architecture:
 * 1. Hash the content to create a stable cache key
 * 2. Check local registry for existing cache
 * 3. If expired or missing, create new cached content via Gemini API
 * 4. Return cache name for use in generateContent calls
 *
 * Cache Lifecycle:
 * - Default TTL: 1 hour (3600s)
 * - Extended TTL: 24 hours (86400s) for stable prompts
 * - Auto-cleanup: Check expiration on each access
 *
 * Cost Savings Calculation:
 * - Initial cache creation: Standard input token cost
 * - Subsequent uses: 90% discount on cached tokens
 * - Break-even: 2 requests (10% + 10% = 20% cost vs 100% + 100%)
 * - ROI: 80% savings after 10 requests on same content
 *
 * References:
 * - Context Caching Overview: https://ai.google.dev/gemini-api/docs/caching
 * - Node.js SDK: https://googleapis.github.io/js-genai/release_docs/classes/caches.Caches.html
 */

import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import type { Content, CachedContent } from '@google/genai';

// ============================================================================
// Client Helper (avoids circular dependency with gemini-client.ts)
// ============================================================================

let cachedClient: GoogleGenAI | null = null;

/**
 * Create a GoogleGenAI client for cache operations.
 * Uses its own singleton to avoid circular dependency with gemini-client.ts.
 */
function createGeminiClient(): GoogleGenAI {
	if (!cachedClient) {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error(
				'GEMINI_API_KEY environment variable not set. Get key from: https://aistudio.google.com/apikey'
			);
		}
		cachedClient = new GoogleGenAI({ apiKey });
	}
	return cachedClient;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Content to be cached (system instruction + optional schema + contents)
 */
export interface CacheableContent {
	/** System instruction prompt */
	systemInstruction?: string;
	/** JSON response schema */
	responseSchema?: object;
	/** Additional content to cache (e.g., large documents) */
	contents?: Content[];
	/** Display name for debugging */
	displayName?: string;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry {
	/** Gemini cache name (format: cachedContents/{id}) */
	cacheName: string;
	/** Content hash used as key */
	contentHash: string;
	/** When cache was created */
	createdAt: Date;
	/** When cache expires */
	expiresAt: Date;
	/** Model this cache was created for */
	model: string;
	/** Display name for debugging */
	displayName?: string;
}

/**
 * Cache TTL configuration
 */
export type CacheTTL = 'short' | 'medium' | 'long';

// ============================================================================
// Constants
// ============================================================================

/**
 * TTL values in seconds
 */
export const CACHE_TTL_SECONDS: Record<CacheTTL, number> = {
	short: 3600, // 1 hour - for dynamic content
	medium: 21600, // 6 hours - for semi-stable content
	long: 86400 // 24 hours - for stable prompts/schemas
} as const;

/**
 * Default TTL for new caches
 */
const DEFAULT_TTL: CacheTTL = 'long';

/**
 * Models that support context caching
 */
const CACHE_SUPPORTED_MODELS = [
	'gemini-2.5-pro',
	'gemini-2.5-flash',
	'gemini-3-flash-preview',
	'gemini-1.5-flash',
	'gemini-1.5-pro'
] as const;

// ============================================================================
// Cache Registry
// ============================================================================

/**
 * In-memory cache registry
 * Maps content hash -> cache entry
 *
 * Note: This is ephemeral per process. In production, consider:
 * - Redis for distributed caching across instances
 * - Database for persistence across restarts
 * - Local file system for single-instance persistence
 */
const cacheRegistry = new Map<string, CacheEntry>();

/**
 * Cleanup interval for expired caches (every 5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start automatic cleanup of expired cache entries
 */
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = new Date();
		let expiredCount = 0;

		for (const [hash, entry] of cacheRegistry.entries()) {
			if (entry.expiresAt < now) {
				cacheRegistry.delete(hash);
				expiredCount++;
			}
		}

		if (expiredCount > 0) {
			console.log(`[cache-manager] Cleaned up ${expiredCount} expired cache entries`);
		}
	}, CLEANUP_INTERVAL_MS);

	// Don't block process exit
	cleanupInterval.unref();
}

/**
 * Stop automatic cleanup (useful for testing)
 */
export function stopCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
}

// ============================================================================
// Content Hashing
// ============================================================================

/**
 * Generate a stable SHA-256 hash of cacheable content
 *
 * Hash includes:
 * - System instruction text
 * - Response schema JSON (stringified and sorted)
 * - Additional content (if provided)
 *
 * This ensures identical content produces identical hashes,
 * enabling efficient cache hits.
 *
 * @param content - Content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function hashContent(content: CacheableContent): string {
	const hash = createHash('sha256');

	// Hash system instruction
	if (content.systemInstruction) {
		hash.update('system:');
		hash.update(content.systemInstruction);
	}

	// Hash response schema (canonical JSON string)
	if (content.responseSchema) {
		hash.update('schema:');
		// Sort keys for deterministic hashing
		const sortedSchema = JSON.stringify(content.responseSchema, Object.keys(content.responseSchema).sort());
		hash.update(sortedSchema);
	}

	// Hash additional contents
	if (content.contents && content.contents.length > 0) {
		hash.update('contents:');
		hash.update(JSON.stringify(content.contents));
	}

	return hash.digest('hex');
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get or create a cached content entry
 *
 * Flow:
 * 1. Hash the content to generate cache key
 * 2. Check local registry for existing non-expired cache
 * 3. If found and valid, return cache name
 * 4. If expired or missing, create new cache via Gemini API
 * 5. Store in registry and return cache name
 *
 * @param content - Content to cache
 * @param model - Gemini model to use
 * @param ttl - Time-to-live duration
 * @param client - Optional GoogleGenAI client (if not provided, one will be created)
 * @returns Cache name for use in generateContent
 * @throws Error if cache creation fails
 */
export async function getOrCreateCache(
	content: CacheableContent,
	model: string,
	ttl: CacheTTL = DEFAULT_TTL,
	client?: GoogleGenAI
): Promise<string> {
	// Start cleanup on first use
	if (!cleanupInterval) {
		startCleanup();
	}

	// Validate model supports caching
	if (!CACHE_SUPPORTED_MODELS.some((m) => model.includes(m))) {
		console.warn(`[cache-manager] Model ${model} may not support context caching`);
	}

	// Generate content hash
	const contentHash = hashContent(content);

	// Check registry for existing cache
	const existingEntry = cacheRegistry.get(contentHash);
	if (existingEntry) {
		const now = new Date();

		// Check if cache is still valid
		if (existingEntry.expiresAt > now) {
			console.log(`[cache-manager] Cache hit: ${existingEntry.displayName || contentHash.slice(0, 8)}`, {
				cacheName: existingEntry.cacheName,
				expiresIn: Math.round((existingEntry.expiresAt.getTime() - now.getTime()) / 1000) + 's'
			});
			return existingEntry.cacheName;
		}

		// Cache expired, remove from registry
		console.log(`[cache-manager] Cache expired: ${existingEntry.displayName || contentHash.slice(0, 8)}`);
		cacheRegistry.delete(contentHash);
	}

	// Create new cache
	console.log(`[cache-manager] Creating new cache: ${content.displayName || contentHash.slice(0, 8)}`, {
		model,
		ttl: `${CACHE_TTL_SECONDS[ttl]}s`
	});

	// Use provided client or create one
	const ai = client ?? createGeminiClient();
	const ttlSeconds = CACHE_TTL_SECONDS[ttl];

	try {
		// Build cache config
		const config: {
			systemInstruction?: string;
			responseMimeType?: string;
			responseSchema?: object;
			contents?: Content[];
			ttl: string;
			displayName?: string;
		} = {
			ttl: `${ttlSeconds}s`
		};

		if (content.systemInstruction) {
			config.systemInstruction = content.systemInstruction;
		}

		if (content.responseSchema) {
			config.responseMimeType = 'application/json';
			config.responseSchema = content.responseSchema;
		}

		if (content.contents && content.contents.length > 0) {
			config.contents = content.contents;
		}

		if (content.displayName) {
			config.displayName = content.displayName;
		}

		// Create cached content
		const cachedContent: CachedContent = await ai.caches.create({
			model,
			config
		});

		// Calculate expiration (use TTL from config, with safety margin)
		const createdAt = new Date();
		const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);

		// Store in registry
		const entry: CacheEntry = {
			cacheName: cachedContent.name!,
			contentHash,
			createdAt,
			expiresAt,
			model,
			displayName: content.displayName
		};

		cacheRegistry.set(contentHash, entry);

		console.log(`[cache-manager] Cache created successfully: ${cachedContent.name}`, {
			displayName: content.displayName,
			expiresAt: expiresAt.toISOString()
		});

		return cachedContent.name!;
	} catch (error) {
		console.error(`[cache-manager] Failed to create cache:`, error);
		throw new Error(
			`Failed to create cached content: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Invalidate a cache entry by content hash
 *
 * Note: This only removes from local registry.
 * The Gemini API cache will still exist until its TTL expires.
 *
 * @param content - Content to invalidate
 */
export function invalidateCache(content: CacheableContent): void {
	const contentHash = hashContent(content);
	const deleted = cacheRegistry.delete(contentHash);

	if (deleted) {
		console.log(`[cache-manager] Cache invalidated: ${content.displayName || contentHash.slice(0, 8)}`);
	}
}

/**
 * Clear all cache entries from registry
 *
 * Note: This only clears local registry.
 * Gemini API caches will persist until their TTL expires.
 */
export function clearAllCaches(): void {
	const count = cacheRegistry.size;
	cacheRegistry.clear();
	console.log(`[cache-manager] Cleared ${count} cache entries from registry`);
}

/**
 * Get cache statistics
 *
 * Useful for monitoring cache hit rates and storage usage.
 */
export function getCacheStats(): {
	totalCaches: number;
	validCaches: number;
	expiredCaches: number;
	cacheDetails: Array<{
		displayName?: string;
		model: string;
		createdAt: Date;
		expiresAt: Date;
		isExpired: boolean;
	}>;
} {
	const now = new Date();
	const details = Array.from(cacheRegistry.values()).map((entry) => ({
		displayName: entry.displayName,
		model: entry.model,
		createdAt: entry.createdAt,
		expiresAt: entry.expiresAt,
		isExpired: entry.expiresAt < now
	}));

	return {
		totalCaches: cacheRegistry.size,
		validCaches: details.filter((d) => !d.isExpired).length,
		expiredCaches: details.filter((d) => d.isExpired).length,
		cacheDetails: details
	};
}

// ============================================================================
// Token Savings Estimation
// ============================================================================

/**
 * Estimate token cost savings from using cached content
 *
 * Assumptions:
 * - Initial cache creation: 100% input token cost
 * - Each cache hit: 10% input token cost (90% discount)
 * - Cache storage cost: Negligible for short TTLs
 *
 * Formula:
 * - Without caching: N requests × 100% = N × token_count
 * - With caching: 100% + (N-1) × 10% = 1 + 0.1(N-1) token_counts
 * - Savings: [N - (1 + 0.1(N-1))] / N = (0.9N - 0.9) / N
 *
 * @param tokenCount - Number of tokens in cached content
 * @param requestCount - Number of requests using this cache
 * @returns Estimated savings object
 */
export function estimateTokenSavings(
	tokenCount: number,
	requestCount: number
): {
	withoutCaching: number;
	withCaching: number;
	tokensSaved: number;
	percentSaved: number;
	costEffectiveAfter: number;
} {
	if (requestCount < 1) {
		return {
			withoutCaching: 0,
			withCaching: 0,
			tokensSaved: 0,
			percentSaved: 0,
			costEffectiveAfter: 2
		};
	}

	const withoutCaching = tokenCount * requestCount;
	const withCaching = tokenCount * (1 + 0.1 * (requestCount - 1));
	const tokensSaved = withoutCaching - withCaching;
	const percentSaved = requestCount > 1 ? (tokensSaved / withoutCaching) * 100 : 0;

	return {
		withoutCaching,
		withCaching,
		tokensSaved,
		percentSaved,
		costEffectiveAfter: 2 // Break-even at 2 requests
	};
}
