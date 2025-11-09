/**
 * In-Memory Rate Limiter
 *
 * PHILOSOPHY (Lean Startup Approach):
 * - Start simple: in-memory Map (zero cost, zero config)
 * - Graduate later: Redis when scaling requires it (10+ instances)
 * - Following unicorn patterns: Stripe, Airbnb, Figma all started this way
 *
 * WHY IN-MEMORY:
 * - Zero operational complexity (no Redis to configure, monitor, debug)
 * - Zero cost (no Upstash account needed)
 * - Faster deployment (fewer environment variables)
 * - Easier debugging (add console.log, see it instantly)
 * - Circuit breaker ($5/day) is ultimate protection
 * - 5 other security layers (CAPTCHA blocks 90%+ bots)
 *
 * TRADEOFFS:
 * - State resets on deploy (acceptable: deploy <5/day, circuit breaker protects)
 * - Single-instance only (OK: Fly.io starter, not scaling yet)
 * - Memory growth with unique IPs (acceptable: cleanup every 5 minutes)
 *
 * MIGRATION PATH (when you have 10+ instances, 50K+ MAU):
 * - Implement RedisRateLimiter with same interface
 * - Change one import, deploy
 * - 1 day of work when you have money and team to do it properly
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

interface RateLimitResult {
	success: boolean;
	remaining: number;
	limit: number;
	reset: number; // Timestamp when window resets
}

export class InMemoryRateLimiter {
	private store = new Map<string, RateLimitEntry>();
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Cleanup expired entries every 5 minutes
		// Prevents memory growth from abandoned rate limit entries
		this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

		console.log('[RateLimiter] ✓ In-memory rate limiter initialized');
	}

	/**
	 * Check rate limit for a given key
	 *
	 * @param key - Unique identifier (e.g., "ip:127.0.0.1", "device:abc123")
	 * @param max - Maximum requests allowed in window
	 * @param windowMs - Time window in milliseconds (e.g., 60 * 60 * 1000 for 1 hour)
	 * @returns Rate limit result with success/remaining/reset info
	 */
	async limit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
		const now = Date.now();
		const item = this.store.get(key);

		// New window or expired window
		if (!item || now > item.resetAt) {
			const resetAt = now + windowMs;
			this.store.set(key, { count: 1, resetAt });

			return {
				success: true,
				remaining: max - 1,
				limit: max,
				reset: resetAt
			};
		}

		// Within existing window
		if (item.count >= max) {
			// Rate limit exceeded
			return {
				success: false,
				remaining: 0,
				limit: max,
				reset: item.resetAt
			};
		}

		// Increment count
		item.count++;

		return {
			success: true,
			remaining: max - item.count,
			limit: max,
			reset: item.resetAt
		};
	}

	/**
	 * Cleanup expired entries to prevent memory growth
	 *
	 * Runs every 5 minutes via setInterval
	 * Removes entries where resetAt < now
	 */
	private cleanup() {
		const now = Date.now();
		let removedCount = 0;

		for (const [key, item] of this.store.entries()) {
			if (now > item.resetAt) {
				this.store.delete(key);
				removedCount++;
			}
		}

		if (removedCount > 0) {
			console.log(`[RateLimiter] Cleanup: removed ${removedCount} expired entries`);
		}
	}

	/**
	 * Get current stats (for debugging/monitoring)
	 */
	getStats() {
		return {
			totalEntries: this.store.size,
			implementation: 'in-memory'
		};
	}

	/**
	 * Cleanup on server shutdown
	 */
	destroy() {
		clearInterval(this.cleanupInterval);
		this.store.clear();
		console.log('[RateLimiter] Destroyed');
	}
}

// Singleton instance
export const rateLimiter = new InMemoryRateLimiter();

// Cleanup on process exit
if (typeof process !== 'undefined') {
	process.on('SIGTERM', () => rateLimiter.destroy());
	process.on('SIGINT', () => rateLimiter.destroy());
}
