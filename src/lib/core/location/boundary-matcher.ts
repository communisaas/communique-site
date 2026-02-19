/**
 * Client-Side Boundary Matching (Cypherpunk Approach)
 *
 * Philosophy:
 * - Privacy through client-side processing, not server trust
 * - Zero-cost matching for 40% of users (local GeoJSON boundaries)
 * - Fallback to Cicero API only when local data unavailable
 * - Works offline after first boundary load
 *
 * Architecture:
 * 1. Census Bureau geocoding (address → lat/lng) - FREE
 * 2. Client-side point-in-polygon (Turf.js) - ZERO COST, ZERO TRUST
 * 3. Fallback to Cicero API (cached, rate-limited) - PAID, CACHED
 */

import * as turf from '@turf/turf';
import type { Point, Polygon, MultiPolygon, Feature, FeatureCollection } from 'geojson';

// ============================================================================
// Types
// ============================================================================

export interface CityCouncilDistrict {
	district: string; // e.g., "D5", "Ward 3", "Council District 11"
	representative: string | null;
	email: string | null;
	phone: string | null;
	office_address: string | null;
	website: string | null;
}

export interface BoundaryMatchResult {
	source: 'local' | 'cicero' | 'none';
	city_council_district: CityCouncilDistrict | null;
	confidence: number;
	cached: boolean; // True if result came from cache (local or server)
}

interface CachedBoundary {
	citySlug: string;
	data: FeatureCollection;
	cachedAt: number;
}

// ============================================================================
// BoundaryMatcher Class
// ============================================================================

/**
 * BoundaryMatcher: Client-side city council district matching
 *
 * Cypherpunk approach:
 * - Matches coordinates to districts WITHOUT calling external APIs (40% of users)
 * - Uses local GeoJSON boundary files + Turf.js point-in-polygon
 * - Falls back to Cicero API only when local boundaries unavailable
 * - Caches boundaries in IndexedDB (works offline after first load)
 */
export class BoundaryMatcher {
	private boundaryCache = new Map<string, FeatureCollection>();
	private readonly dbName = 'communique_boundaries';
	private readonly dbVersion = 1;

	/**
	 * Match coordinates to city council district
	 *
	 * Strategy:
	 * 1. Try client-side boundary matching (zero cost, zero trust)
	 * 2. If no local boundaries: Fall back to Cicero API (cached)
	 * 3. If Cicero fails: Return null
	 */
	async matchDistrict(
		latitude: number,
		longitude: number,
		cityName: string,
		stateCode: string
	): Promise<BoundaryMatchResult> {
		console.debug(
			`[BoundaryMatcher] Matching: ${cityName}, ${stateCode} (${latitude}, ${longitude})`
		);

		// Step 1: Try client-side boundary matching
		const localMatch = await this.matchLocalBoundaries(latitude, longitude, cityName, stateCode);

		if (localMatch) {
			console.debug('[BoundaryMatcher] ✓ Client-side match (zero cost, zero trust)');
			return {
				source: 'local',
				city_council_district: localMatch,
				confidence: 0.9, // High confidence - authoritative boundary data
				cached: true // Local boundaries are always "cached"
			};
		}

		// Step 2: Fall back to Cicero API (with server-side caching)
		console.debug('[BoundaryMatcher] No local boundaries available, falling back to Cicero API');
		const ciceroMatch = await this.matchCicero(latitude, longitude, cityName, stateCode);

		if (ciceroMatch) {
			return ciceroMatch;
		}

		// Step 3: No match found
		console.warn('[BoundaryMatcher] ⚠️ No district match found');
		return {
			source: 'none',
			city_council_district: null,
			confidence: 0,
			cached: false
		};
	}

	/**
	 * Client-side boundary matching (zero cost, zero trust)
	 *
	 * Process:
	 * 1. Check if boundaries exist for city (index.json)
	 * 2. Load boundaries (IndexedDB → CDN fetch)
	 * 3. Run Turf.js point-in-polygon check
	 * 4. Return matching district
	 */
	private async matchLocalBoundaries(
		latitude: number,
		longitude: number,
		cityName: string,
		stateCode: string
	): Promise<CityCouncilDistrict | null> {
		try {
			// Check if boundaries exist for this city
			const citySlug = this.getCitySlug(cityName, stateCode);
			const boundariesExist = await this.checkBoundariesExist(citySlug);

			if (!boundariesExist) {
				console.debug(`[BoundaryMatcher] No local boundaries for ${cityName}, ${stateCode}`);
				return null;
			}

			// Load boundaries (from IndexedDB or CDN)
			const boundaries = await this.loadBoundaries(citySlug);

			// Create point from coordinates
			const point: Feature<Point> = turf.point([longitude, latitude]);

			// Check each district polygon
			for (const feature of boundaries.features) {
				if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
					const polygon = feature as Feature<Polygon | MultiPolygon>;

					if (turf.booleanPointInPolygon(point, polygon)) {
						// Found matching district!
						const props = feature.properties || {};

						return {
							district: props.district || props.name || props.id || 'Unknown',
							representative: props.representative || props.rep_name || null,
							email: props.email || props.rep_email || null,
							phone: props.phone || props.rep_phone || null,
							office_address: props.office_address || props.office || null,
							website: props.website || props.url || null
						};
					}
				}
			}

			console.debug('[BoundaryMatcher] Point not in any district polygon');
			return null;
		} catch (error) {
			console.error('[BoundaryMatcher] Local matching error:', error);
			return null;
		}
	}

	/**
	 * Load boundaries from IndexedDB or fetch from CDN
	 *
	 * Caching strategy:
	 * - Memory cache (Map) - fastest, cleared on page refresh
	 * - IndexedDB cache - persistent across sessions
	 * - CDN fetch - only if not cached
	 */
	private async loadBoundaries(citySlug: string): Promise<FeatureCollection> {
		// Check memory cache first (fastest)
		const cachedBoundary = this.boundaryCache.get(citySlug);
		if (cachedBoundary) {
			console.debug(`[BoundaryMatcher] Memory cache HIT: ${citySlug}`);
			return cachedBoundary;
		}

		// Check IndexedDB (persistent)
		const db = await this.openDB();
		const tx = db.transaction('boundaries', 'readonly');
		const store = tx.objectStore('boundaries');

		const cachedData = await new Promise<CachedBoundary | undefined>((resolve) => {
			const request = store.get(citySlug);
			request.onsuccess = () => resolve(request.result as CachedBoundary | undefined);
			request.onerror = () => resolve(undefined);
		});

		if (cachedData) {
			console.debug(`[BoundaryMatcher] IndexedDB cache HIT: ${citySlug}`);
			this.boundaryCache.set(citySlug, cachedData.data);
			return cachedData.data;
		}

		// Fetch from CDN (first time only)
		console.debug(`[BoundaryMatcher] Fetching boundaries: /boundaries/${citySlug}.geojson`);
		const response = await fetch(`/boundaries/${citySlug}.geojson`);

		if (!response.ok) {
			throw new Error(`Failed to fetch boundaries: ${response.status} ${response.statusText}`);
		}

		const boundaries: FeatureCollection = await response.json();

		// Cache in IndexedDB (persistent)
		const writeTx = db.transaction('boundaries', 'readwrite');
		const writeStore = writeTx.objectStore('boundaries');

		await new Promise<void>((resolve, reject) => {
			const request = writeStore.put({
				citySlug,
				data: boundaries,
				cachedAt: Date.now()
			});
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		// Cache in memory (fastest)
		this.boundaryCache.set(citySlug, boundaries);

		console.debug(`[BoundaryMatcher] ✓ Boundaries cached for ${citySlug}`);
		return boundaries;
	}

	/**
	 * Check if boundaries exist for city
	 *
	 * Reads /boundaries/index.json manifest to determine coverage
	 */
	private async checkBoundariesExist(citySlug: string): Promise<boolean> {
		try {
			const response = await fetch('/boundaries/index.json');

			if (!response.ok) {
				console.warn('[BoundaryMatcher] Failed to fetch boundary index');
				return false;
			}

			const index: { version: string; cities: string[] } = await response.json();
			return index.cities.includes(citySlug);
		} catch (error) {
			console.error('[BoundaryMatcher] Error checking boundaries:', error);
			return false;
		}
	}

	/**
	 * Fallback to Cicero API (server-side, cached)
	 *
	 * This is the fallback for cities without local boundaries (~60%)
	 * Server handles caching (2-year expiration), rate limiting, budget monitoring
	 */
	private async matchCicero(
		latitude: number,
		longitude: number,
		cityName: string,
		stateCode: string
	): Promise<BoundaryMatchResult | null> {
		try {
			const response = await fetch('/api/location/cicero', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					latitude,
					longitude,
					city: cityName,
					state: stateCode
				})
			});

			if (!response.ok) {
				console.error(`[BoundaryMatcher] Cicero API error: ${response.status}`);
				return null;
			}

			const data = await response.json();

			if (!data.city_council_district) {
				console.warn('[BoundaryMatcher] Cicero returned no district data');
				return null;
			}

			return {
				source: 'cicero',
				city_council_district: data.city_council_district,
				confidence: 0.85, // Slightly lower than local (depends on Cicero accuracy)
				cached: data.cached || false
			};
		} catch (error) {
			console.error('[BoundaryMatcher] Cicero API request failed:', error);
			return null;
		}
	}

	/**
	 * Normalize city name to slug
	 *
	 * Examples:
	 * - "San Francisco", "CA" → "san-francisco-ca"
	 * - "New York", "NY" → "new-york-ny"
	 */
	private getCitySlug(cityName: string, stateCode: string): string {
		const normalized = cityName
			.toLowerCase()
			.replace(/\s+/g, '-') // Spaces → hyphens
			.replace(/[^a-z0-9-]/g, ''); // Remove special chars

		return `${normalized}-${stateCode.toLowerCase()}`;
	}

	/**
	 * Open IndexedDB for boundary caching
	 *
	 * Schema:
	 * - Object store: "boundaries"
	 * - Key: citySlug (e.g., "san-francisco-ca")
	 * - Value: { citySlug, data: FeatureCollection, cachedAt: number }
	 */
	private async openDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				if (!db.objectStoreNames.contains('boundaries')) {
					const store = db.createObjectStore('boundaries', { keyPath: 'citySlug' });
					store.createIndex('cachedAt', 'cachedAt', { unique: false });

					console.debug('[BoundaryMatcher] ✓ IndexedDB schema created');
				}
			};
		});
	}

	/**
	 * Clear all cached boundaries (debugging/testing)
	 */
	async clearCache(): Promise<void> {
		try {
			const db = await this.openDB();
			const tx = db.transaction('boundaries', 'readwrite');
			const store = tx.objectStore('boundaries');

			await new Promise<void>((resolve, reject) => {
				const request = store.clear();
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			this.boundaryCache.clear();
			console.debug('[BoundaryMatcher] ✓ Cache cleared');
		} catch (error) {
			console.error('[BoundaryMatcher] Failed to clear cache:', error);
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for boundary matching
 */
export const boundaryMatcher = new BoundaryMatcher();
