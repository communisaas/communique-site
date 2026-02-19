/**
 * Autocomplete cache for Nominatim results
 *
 * Caches location search results in IndexedDB for 24 hours
 * Reduces API calls and improves performance for repeated searches
 */

import type { LocationHierarchy } from './geocoding-api';
import { searchLocations, searchCities, searchStates, searchCountries } from './geocoding-api';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DB_NAME = 'location_autocomplete_cache';
const STORE_NAME = 'searches';
const DB_VERSION = 1;

interface CachedResult {
	query: string;
	scope: 'country' | 'state' | 'city';
	countryCode?: string;
	stateCode?: string;
	results: LocationHierarchy[];
	timestamp: number;
}

/**
 * Open IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create object store with composite key (query + scope + filters)
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('timestamp', 'timestamp', { unique: false });
			}
		};
	});
}

/**
 * Generate cache key from search parameters
 */
function getCacheKey(
	query: string,
	scope: 'country' | 'state' | 'city',
	countryCode?: string,
	stateCode?: string
): string {
	const key = [query.toLowerCase().trim(), scope, countryCode || '', stateCode || ''].join(':');
	return key;
}

/**
 * Get cached results if available and not expired
 */
async function getCached(
	query: string,
	scope: 'country' | 'state' | 'city',
	countryCode?: string,
	stateCode?: string
): Promise<LocationHierarchy[] | null> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const cacheKey = getCacheKey(query, scope, countryCode, stateCode);

		return new Promise((resolve) => {
			const request = store.get(cacheKey);

			request.onsuccess = () => {
				const cached: CachedResult | undefined = request.result;

				if (!cached) {
					resolve(null);
					return;
				}

				// Check if expired
				const age = Date.now() - cached.timestamp;
				if (age > CACHE_TTL) {
					resolve(null);
					return;
				}

				resolve(cached.results);
			};

			request.onerror = () => {
				resolve(null);
			};
		});
	} catch (error) {
		return null;
	}
}

/**
 * Store results in cache
 */
async function setCached(
	query: string,
	scope: 'country' | 'state' | 'city',
	results: LocationHierarchy[],
	countryCode?: string,
	stateCode?: string
): Promise<void> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const cacheKey = getCacheKey(query, scope, countryCode, stateCode);

		const cached: CachedResult = {
			id: cacheKey,
			query,
			scope,
			countryCode,
			stateCode,
			results,
			timestamp: Date.now()
		} as CachedResult & { id: string };

		store.put(cached);

		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	} catch (e) {
		console.warn('[AutocompleteCache] IndexedDB error:', e);
	}
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const index = store.index('timestamp');

		const cutoff = Date.now() - CACHE_TTL;
		const range = IDBKeyRange.upperBound(cutoff);

		return new Promise((resolve, reject) => {
			const request = index.openCursor(range);
			let deleteCount = 0;

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					cursor.delete();
					deleteCount++;
					cursor.continue();
				} else {
					resolve();
				}
			};

			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('[AutocompleteCache] IndexedDB error:', e);
	}
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('[AutocompleteCache] IndexedDB error:', e);
	}
}

/**
 * Cached wrapper for searchLocations
 */
export async function searchLocationsCached(
	query: string,
	scope: 'country' | 'state' | 'city' = 'city',
	countryCode?: string,
	stateCode?: string
): Promise<LocationHierarchy[]> {
	// Check cache first
	const cached = await getCached(query, scope, countryCode, stateCode);
	if (cached) {
		return cached;
	}

	// Cache miss - fetch from API
	const results = await searchLocations(query, scope, countryCode, stateCode);

	// Store in cache (async, don't wait)
	setCached(query, scope, results, countryCode, stateCode);

	return results;
}

/**
 * Cached wrapper for searchCities
 */
export async function searchCitiesCached(
	query: string,
	stateCode: string,
	countryCode: string = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocationsCached(query, 'city', countryCode, stateCode);
}

/**
 * Cached wrapper for searchStates
 */
export async function searchStatesCached(
	query: string,
	countryCode: string = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocationsCached(query, 'state', countryCode);
}

/**
 * Cached wrapper for searchCountries
 */
export async function searchCountriesCached(query: string): Promise<LocationHierarchy[]> {
	return searchLocationsCached(query, 'country');
}

// Periodic cache cleanup (run on module load)
if (typeof window !== 'undefined') {
	// Clear expired cache on load
	clearExpiredCache();

	// Set up periodic cleanup (every hour)
	setInterval(clearExpiredCache, 60 * 60 * 1000);
}
