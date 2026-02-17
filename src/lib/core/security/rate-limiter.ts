/**
 * Sliding Window Rate Limiter
 *
 * BA-014: Redis-backed sliding window rate limiting for critical API endpoints.
 *
 * ALGORITHM: Sliding Window Log
 * -----------------------------
 * Maintains a list of request timestamps within the current window.
 * More accurate than fixed windows (no burst at window boundaries).
 *
 * Time complexity: O(n) where n is requests in window (bounded by max limit)
 * Space complexity: O(n) per key
 *
 * STORAGE BACKENDS:
 * - Development: In-memory Map (zero config)
 * - Production: Redis (REDIS_URL environment variable)
 *
 * USAGE:
 * ```typescript
 * const limiter = new SlidingWindowRateLimiter();
 * const result = await limiter.check('user:123', { maxRequests: 10, windowMs: 60000 });
 * if (!result.allowed) {
 *   // Return 429 with result.retryAfter
 * }
 * ```
 */

import { env } from '$env/dynamic/private';

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Number of requests remaining in current window */
	remaining: number;
	/** Maximum requests allowed per window */
	limit: number;
	/** Unix timestamp (seconds) when the window resets */
	reset: number;
	/** Seconds until the client can retry (only set when allowed=false) */
	retryAfter?: number;
}

/**
 * Configuration for a rate limit rule
 */
export interface RateLimitConfig {
	/** Maximum requests allowed in the window */
	maxRequests: number;
	/** Window duration in milliseconds */
	windowMs: number;
}

/**
 * Route-specific rate limit configuration
 */
export interface RouteRateLimitConfig extends RateLimitConfig {
	/** Route pattern to match (prefix match) */
	pattern: string;
	/** Key strategy: 'ip' for per-IP, 'user' for per-user (requires authentication) */
	keyStrategy: 'ip' | 'user';
	/** If true, also rate-limit GET requests (default: false, only mutating methods) */
	includeGet?: boolean;
}

/**
 * Storage backend interface for rate limit data
 */
interface RateLimitStore {
	/**
	 * Get timestamps for a key, filtered to only those within windowMs of now
	 */
	getTimestamps(key: string, windowMs: number): Promise<number[]>;

	/**
	 * Add a timestamp and clean up old entries
	 */
	addTimestamp(key: string, timestamp: number, windowMs: number): Promise<void>;

	/**
	 * Get statistics about the store
	 */
	getStats(): { implementation: string; totalKeys?: number };

	/**
	 * Cleanup resources
	 */
	destroy(): Promise<void>;
}

/**
 * In-memory storage backend for development
 */
class InMemoryStore implements RateLimitStore {
	private store = new Map<string, number[]>();
	private cleanupInterval: ReturnType<typeof setInterval>;

	constructor() {
		// Cleanup expired entries every 5 minutes
		this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
	}

	async getTimestamps(key: string, windowMs: number): Promise<number[]> {
		const now = Date.now();
		const cutoff = now - windowMs;
		const timestamps = this.store.get(key) || [];
		return timestamps.filter((ts) => ts > cutoff);
	}

	async addTimestamp(key: string, timestamp: number, windowMs: number): Promise<void> {
		const now = Date.now();
		const cutoff = now - windowMs;
		const existing = this.store.get(key) || [];
		// Filter old timestamps and add new one
		const filtered = existing.filter((ts) => ts > cutoff);
		filtered.push(timestamp);
		this.store.set(key, filtered);
	}

	private cleanup(): void {
		const now = Date.now();
		// Use a conservative 1 hour window for cleanup
		// Actual filtering happens in getTimestamps
		const maxAge = 60 * 60 * 1000;
		let removedKeys = 0;

		for (const [key, timestamps] of this.store.entries()) {
			// Remove keys where all timestamps are older than maxAge
			const hasRecentTimestamp = timestamps.some((ts) => now - ts < maxAge);
			if (!hasRecentTimestamp) {
				this.store.delete(key);
				removedKeys++;
			}
		}

		if (removedKeys > 0) {
			console.log(`[RateLimiter] Cleanup: removed ${removedKeys} expired keys`);
		}
	}

	getStats(): { implementation: string; totalKeys: number } {
		return {
			implementation: 'in-memory',
			totalKeys: this.store.size
		};
	}

	async destroy(): Promise<void> {
		clearInterval(this.cleanupInterval);
		this.store.clear();
	}
}

/**
 * Redis storage backend for production
 *
 * Uses sorted sets for efficient sliding window implementation.
 * Each key is a sorted set where:
 * - Score = timestamp
 * - Member = unique request ID (timestamp + random suffix)
 *
 * Commands used:
 * - ZREMRANGEBYSCORE: Remove old entries
 * - ZCARD: Count entries in window
 * - ZADD: Add new timestamp
 * - EXPIRE: Auto-cleanup
 */
class RedisStore implements RateLimitStore {
	private client: RedisClient | null = null;
	private connectionPromise: Promise<RedisClient> | null = null;
	private isDestroyed = false;

	constructor(private redisUrl: string) {}

	private async getClient(): Promise<RedisClient> {
		if (this.isDestroyed) {
			throw new Error('Redis store has been destroyed');
		}

		if (this.client) {
			return this.client;
		}

		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		this.connectionPromise = this.connect();
		return this.connectionPromise;
	}

	private async connect(): Promise<RedisClient> {
		try {
			// Dynamic import to avoid bundling redis in non-Redis deployments
			// The 'redis' package is an optional peer dependency - only required when REDIS_URL is set
			// @ts-expect-error - Dynamic import of optional dependency
			const redis = await import('redis');
			const client = redis.createClient({ url: this.redisUrl });

			client.on('error', (err: Error) => {
				console.error('[RateLimiter] Redis error:', err);
			});

			await client.connect();
			console.log('[RateLimiter] Redis connected for rate limiting');

			this.client = client as RedisClient;
			return this.client;
		} catch (error) {
			console.error('[RateLimiter] Failed to connect to Redis:', error);
			throw error;
		}
	}

	async getTimestamps(key: string, windowMs: number): Promise<number[]> {
		const client = await this.getClient();
		const now = Date.now();
		const cutoff = now - windowMs;

		// Remove old entries first
		await client.zRemRangeByScore(key, '-inf', cutoff.toString());

		// Get all remaining entries (they're all within window)
		const members = await client.zRange(key, 0, -1);

		// Extract timestamps from members (format: "timestamp:random")
		return members.map((m) => parseInt(m.split(':')[0], 10));
	}

	async addTimestamp(key: string, timestamp: number, windowMs: number): Promise<void> {
		const client = await this.getClient();

		// Add new timestamp with unique member
		const member = `${timestamp}:${Math.random().toString(36).slice(2, 10)}`;
		await client.zAdd(key, { score: timestamp, value: member });

		// Set expiry to clean up abandoned keys (2x window to be safe)
		await client.expire(key, Math.ceil((windowMs * 2) / 1000));
	}

	getStats(): { implementation: string } {
		return {
			implementation: 'redis'
		};
	}

	async destroy(): Promise<void> {
		this.isDestroyed = true;
		if (this.client) {
			await this.client.quit();
			this.client = null;
		}
	}
}

// Minimal Redis client interface (avoids full type import)
interface RedisClient {
	zRemRangeByScore(key: string, min: string, max: string): Promise<number>;
	zRange(key: string, start: number, stop: number): Promise<string[]>;
	zAdd(key: string, member: { score: number; value: string }): Promise<number>;
	expire(key: string, seconds: number): Promise<boolean>;
	quit(): Promise<string>;
}

/**
 * Sliding Window Rate Limiter
 *
 * Main class for rate limiting with configurable storage backend.
 */
export class SlidingWindowRateLimiter {
	private store: RateLimitStore;

	constructor(redisUrl?: string) {
		const url = redisUrl || env.REDIS_URL;

		if (url) {
			console.log('[RateLimiter] Using Redis backend');
			this.store = new RedisStore(url);
		} else {
			console.log('[RateLimiter] Using in-memory backend (set REDIS_URL for production)');
			this.store = new InMemoryStore();
		}
	}

	/**
	 * Check rate limit for a given key
	 *
	 * @param key - Unique identifier (e.g., "ip:127.0.0.1", "user:abc123")
	 * @param config - Rate limit configuration
	 * @returns Rate limit result with allowed/remaining/reset info
	 */
	async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
		const { maxRequests, windowMs } = config;
		const now = Date.now();

		// Get current timestamps in window
		const timestamps = await this.store.getTimestamps(key, windowMs);
		const count = timestamps.length;

		// Calculate reset time (oldest timestamp + window, or now + window if empty)
		const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : now;
		const resetMs = oldestTimestamp + windowMs;
		const resetSeconds = Math.ceil(resetMs / 1000);

		if (count >= maxRequests) {
			// Rate limit exceeded
			const retryAfter = Math.ceil((resetMs - now) / 1000);
			return {
				allowed: false,
				remaining: 0,
				limit: maxRequests,
				reset: resetSeconds,
				retryAfter: Math.max(1, retryAfter)
			};
		}

		// Add this request
		await this.store.addTimestamp(key, now, windowMs);

		return {
			allowed: true,
			remaining: maxRequests - count - 1,
			limit: maxRequests,
			reset: resetSeconds
		};
	}

	/**
	 * Generate a rate limit key based on route config and request context
	 *
	 * @param config - Route rate limit configuration
	 * @param ip - Client IP address
	 * @param userId - User ID (optional, for user-based limits)
	 * @returns Rate limit key
	 */
	static generateKey(config: RouteRateLimitConfig, ip: string, userId?: string): string {
		const identifier = config.keyStrategy === 'user' && userId ? `user:${userId}` : `ip:${ip}`;
		return `ratelimit:${config.pattern}:${identifier}`;
	}

	/**
	 * Get storage statistics
	 */
	getStats(): { implementation: string; totalKeys?: number } {
		return this.store.getStats();
	}

	/**
	 * Cleanup resources
	 */
	async destroy(): Promise<void> {
		await this.store.destroy();
		console.log('[RateLimiter] Destroyed');
	}
}

/**
 * Pre-configured rate limit rules for the application
 *
 * BA-014 Requirements:
 * 1. /api/identity/* - 10 requests/minute per IP
 * 2. /api/shadow-atlas/register - 5 requests/minute per user
 * 3. /api/congressional/submit - 3 requests/hour per user
 * 4. /api/address/* - 5 requests/minute per IP
 * 5. /api/submissions/* - 5 requests/minute per IP
 *
 * Anti-Astroturf (Cycle 3, G-02/G-10):
 * 6. /api/templates - 10 requests/day per user (template farming prevention)
 * 7. /api/moderation/* - 30 requests/minute per IP (moderation abuse prevention)
 * 8. /api/email/* - 10 requests/minute per user (email send throttle)
 */
export const ROUTE_RATE_LIMITS: RouteRateLimitConfig[] = [
	{
		pattern: '/api/identity/',
		maxRequests: 10,
		windowMs: 60 * 1000, // 1 minute
		keyStrategy: 'ip'
	},
	{
		pattern: '/api/shadow-atlas/register',
		maxRequests: 5,
		windowMs: 60 * 1000, // 1 minute
		keyStrategy: 'user'
	},
	// BR5-016: Rate limit cell-proof endpoint to prevent cell ID enumeration
	// and Shadow Atlas DoS. Uses user-based limiting since the endpoint
	// requires authentication (29M-003: changed from ip to user per review).
	{
		pattern: '/api/shadow-atlas/cell-proof',
		maxRequests: 10,
		windowMs: 60 * 1000, // 10 req/min per user — enough for normal flow, blocks enumeration
		keyStrategy: 'user',
		includeGet: true
	},
	{
		pattern: '/api/congressional/submit',
		maxRequests: 3,
		windowMs: 60 * 60 * 1000, // 1 hour
		keyStrategy: 'user'
	},
	// Passkey registration + authentication (Wave 2A: Graduated Trust)
	{
		pattern: '/api/auth/passkey/register',
		maxRequests: 5,
		windowMs: 60 * 1000, // 5 req/min — passkey registration attempts
		keyStrategy: 'user'
	},
	{
		pattern: '/api/auth/passkey/authenticate',
		maxRequests: 10,
		windowMs: 60 * 1000, // 10 req/min — passkey auth attempts
		keyStrategy: 'ip'
	},
	// Legacy rules from existing implementation
	{
		pattern: '/api/address/',
		maxRequests: 5,
		windowMs: 60 * 1000, // 1 minute
		keyStrategy: 'ip'
	},
	{
		pattern: '/api/submissions/',
		maxRequests: 5,
		windowMs: 60 * 1000, // 1 minute
		keyStrategy: 'ip'
	},
	// Anti-astroturf rate limits (Cycle 3, Wave 13)
	{
		pattern: '/api/templates',
		maxRequests: 10,
		windowMs: 24 * 60 * 60 * 1000, // 24 hours — template farming prevention
		keyStrategy: 'user'
	},
	{
		pattern: '/api/moderation/',
		maxRequests: 30,
		windowMs: 60 * 1000, // 1 minute — prevents moderation endpoint abuse
		keyStrategy: 'ip'
	},
	{
		pattern: '/api/email/',
		maxRequests: 10,
		windowMs: 60 * 1000, // 1 minute — email send throttle
		keyStrategy: 'user'
	},
	// Wave 15R: Rate limit public metrics and confirmation endpoints (GET-based)
	{
		pattern: '/api/metrics/',
		maxRequests: 30,
		windowMs: 60 * 1000, // 30 req/min — prevents scraping/DoS on subgraph queries
		keyStrategy: 'ip',
		includeGet: true
	},
	{
		pattern: '/api/email/confirm/',
		maxRequests: 10,
		windowMs: 60 * 1000, // 10 req/min — prevents confirmation token brute-force
		keyStrategy: 'ip',
		includeGet: true
	}
];

/**
 * Paths exempt from rate limiting (webhooks, health checks)
 */
export const RATE_LIMIT_EXEMPT_PATHS = [
	'/api/identity/didit/webhook', // HMAC-authenticated webhook
	'/api/health', // Health checks
	'/api/cron/' // Cron jobs (authenticated separately)
];

/**
 * Check if a pathname matches a rate limit pattern.
 * Uses segment-boundary matching to prevent prefix confusion:
 * - "/api/templates" matches "/api/templates" and "/api/templates/check-slug"
 * - "/api/templates" does NOT match "/api/templateservice" or "/api/templates-bulk"
 */
function matchesPattern(pathname: string, pattern: string): boolean {
	if (pathname === pattern) return true;
	// Ensure match is at a path segment boundary (pattern followed by / or end)
	if (pattern.endsWith('/')) return pathname.startsWith(pattern);
	return pathname.startsWith(pattern + '/');
}

/**
 * Find matching rate limit config for a path
 *
 * @param pathname - Request path
 * @returns Matching config or undefined
 */
export function findRateLimitConfig(pathname: string): RouteRateLimitConfig | undefined {
	// Check exempt paths first
	if (RATE_LIMIT_EXEMPT_PATHS.some((p) => matchesPattern(pathname, p))) {
		return undefined;
	}

	// Find first matching config (order matters for specificity)
	return ROUTE_RATE_LIMITS.find((config) => matchesPattern(pathname, config.pattern));
}

/**
 * Create rate limit response headers
 *
 * @param result - Rate limit check result
 * @returns Headers to add to the response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
	const headers: Record<string, string> = {
		'X-RateLimit-Limit': result.limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': result.reset.toString()
	};

	if (result.retryAfter !== undefined) {
		headers['Retry-After'] = result.retryAfter.toString();
	}

	return headers;
}

// Singleton instance
let rateLimiterInstance: SlidingWindowRateLimiter | null = null;

/**
 * Get the singleton rate limiter instance
 */
export function getRateLimiter(): SlidingWindowRateLimiter {
	if (!rateLimiterInstance) {
		rateLimiterInstance = new SlidingWindowRateLimiter();
	}
	return rateLimiterInstance;
}

/**
 * Destroy the singleton rate limiter (for testing)
 */
export async function destroyRateLimiter(): Promise<void> {
	if (rateLimiterInstance) {
		await rateLimiterInstance.destroy();
		rateLimiterInstance = null;
	}
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
	const cleanup = () => {
		if (rateLimiterInstance) {
			rateLimiterInstance.destroy().catch(console.error);
		}
	};
	process.on('SIGTERM', cleanup);
	process.on('SIGINT', cleanup);
}
