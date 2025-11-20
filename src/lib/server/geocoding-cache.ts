/**
 * Redis caching layer for geocoding results
 *
 * Caches geocoding API results to avoid duplicate API calls and reduce costs.
 * Cache TTL: 30 days (locations don't change often)
 */

import type { GeocodeResult } from './geocoding';

// Cache TTL: 30 days (locations don't change often)
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Simple in-memory cache implementation (fallback when Redis unavailable)
 */
class MemoryCache {
	private cache: Map<string, { value: GeocodeResult; expiresAt: number }> = new Map();

	get(key: string): GeocodeResult | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.value;
	}

	set(key: string, value: GeocodeResult, ttlSeconds: number): void {
		const expiresAt = Date.now() + ttlSeconds * 1000;
		this.cache.set(key, { value, expiresAt });
	}

	// Periodic cleanup of expired entries
	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}
}

// In-memory fallback cache
const memoryCache = new MemoryCache();

// Cleanup expired entries every hour
setInterval(() => memoryCache.cleanup(), 60 * 60 * 1000);

/**
 * Redis client (lazy initialization)
 * Using dynamic import to avoid Redis dependency when not configured
 */
type RedisClientType = {
	connect: () => Promise<void>;
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string, options?: { EX: number }) => Promise<void>;
	del: (keys: string[]) => Promise<number>;
	keys: (pattern: string) => Promise<string[]>;
	on: (event: string, handler: (error: Error) => void) => void;
};

let redisClient: RedisClientType | null = null;
let redisAvailable = false;

async function getRedisClient() {
	if (redisClient) return redisClient;

	const redisUrl = process.env.REDIS_URL;

	// If no Redis URL, use in-memory cache
	if (!redisUrl) {
		console.log('[geocoding-cache] Redis not configured, using in-memory cache');
		redisAvailable = false;
		return null;
	}

	try {
		// Dynamic import to avoid requiring Redis when not configured
		const { createClient } = await import('redis');

		redisClient = createClient({ url: redisUrl });
		await redisClient.connect();

		redisAvailable = true;
		console.log('[geocoding-cache] Redis client connected');

		// Handle connection errors
		redisClient.on('error', (err: Error) => {
			console.error('[geocoding-cache] Redis error:', err);
			redisAvailable = false;
		});

		return redisClient;
	} catch (error) {
		console.error('[geocoding-cache] Failed to initialize Redis:', error);
		redisAvailable = false;
		return null;
	}
}

/**
 * Cache key format: geocode:{normalized_text}
 * Example: geocode:1600_pennsylvania_ave
 */
function getCacheKey(locationText: string): string {
	const normalized = locationText.toLowerCase().replace(/[^a-z0-9]/g, '_');
	return `geocode:${normalized}`;
}

/**
 * Get cached geocode result
 */
export async function getCachedGeocode(locationText: string): Promise<GeocodeResult | null> {
	const key = getCacheKey(locationText);

	try {
		const client = await getRedisClient();

		if (client && redisAvailable) {
			const cached = await client.get(key);

			if (cached) {
				console.log(
					'[geocoding-cache]',
					JSON.stringify({
						timestamp: new Date().toISOString(),
						input: locationText,
						cache_hit: true,
						backend: 'redis'
					})
				);
				return JSON.parse(cached);
			}
		} else {
			// Fallback to in-memory cache
			const cached = memoryCache.get(key);
			if (cached) {
				console.log(
					'[geocoding-cache]',
					JSON.stringify({
						timestamp: new Date().toISOString(),
						input: locationText,
						cache_hit: true,
						backend: 'memory'
					})
				);
				return cached;
			}
		}

		return null;
	} catch (error) {
		console.error('[geocoding-cache] Read error:', error);
		// Fail gracefully - try in-memory cache as fallback
		const cached = memoryCache.get(key);
		if (cached) {
			return cached;
		}
		return null;
	}
}

/**
 * Store geocode result in cache
 */
export async function setCachedGeocode(locationText: string, result: GeocodeResult): Promise<void> {
	const key = getCacheKey(locationText);

	try {
		const client = await getRedisClient();

		if (client && redisAvailable) {
			await client.set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
		} else {
			// Fallback to in-memory cache
			memoryCache.set(key, result, CACHE_TTL_SECONDS);
		}
	} catch (error) {
		console.error('[geocoding-cache] Write error:', error);
		// Fail gracefully - try in-memory cache as fallback
		try {
			memoryCache.set(key, result, CACHE_TTL_SECONDS);
		} catch (memError) {
			console.error('[geocoding-cache] Memory cache write error:', memError);
		}
	}
}

/**
 * Clear all cached geocoding results (for testing/debugging)
 */
export async function clearGeocodeCache(): Promise<void> {
	try {
		const client = await getRedisClient();

		if (client && redisAvailable) {
			// Delete all keys matching geocode:* pattern
			const keys = await client.keys('geocode:*');
			if (keys.length > 0) {
				await client.del(keys);
			}
		}

		// Also clear in-memory cache
		memoryCache.cleanup();
	} catch (error) {
		console.error('[geocoding-cache] Clear cache error:', error);
	}
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getGeocodeRacheStats(): Promise<{
	backend: 'redis' | 'memory';
	available: boolean;
	keyCount?: number;
}> {
	try {
		const client = await getRedisClient();

		if (client && redisAvailable) {
			const keys = await client.keys('geocode:*');
			return {
				backend: 'redis',
				available: true,
				keyCount: keys.length
			};
		}

		return {
			backend: 'memory',
			available: true
		};
	} catch (error) {
		console.error('[geocoding-cache] Stats error:', error);
		return {
			backend: 'memory',
			available: false
		};
	}
}
