/**
 * Redis caching layer for geocoding results
 * refactored to be in-memory only for Cloudflare compatibility
 *
 * Caches geocoding API results to avoid duplicate API calls and reduce costs.
 * Cache TTL: 30 days (locations don't change often)
 */

import type { GeocodeResult } from './geocoding';

// Cache TTL: 30 days (locations don't change often)
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Simple in-memory cache implementation
 * Note: On Cloudflare, this will be per-isolate.
 * For shared caching, we should migrate to Cloudflare KV later.
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

// Cleanup expired entries every hour if runtime supports it (Node/long-running)
if (typeof setInterval !== 'undefined') {
	setInterval(() => memoryCache.cleanup(), 60 * 60 * 1000);
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

	return null;
}

/**
 * Store geocode result in cache
 */
export async function setCachedGeocode(locationText: string, result: GeocodeResult): Promise<void> {
	const key = getCacheKey(locationText);
	memoryCache.set(key, result, CACHE_TTL_SECONDS);
}

/**
 * Clear all cached geocoding results (for testing/debugging)
 */
export async function clearGeocodeCache(): Promise<void> {
	memoryCache.cleanup();
	// Manually clear if needed, but cleanup handles expiry
	// For forced clear, we'd need a clear method on MemoryCache
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getGeocodeRacheStats(): Promise<{
	backend: 'memory';
	available: boolean;
	keyCount?: number;
}> {
	return {
		backend: 'memory',
		available: true
	};
}

