/**
 * FIPS Code → Population Data Lookup
 *
 * Integrates with Census Bureau API to fetch population data for FIPS codes.
 * Uses IndexedDB for caching to support offline access.
 *
 * Census Bureau API: https://api.census.gov/data/2020/dec/pl
 */

import type { CensusPopulationResponse, CensusApiResponse, FipsLookupOptions } from './types';

const CENSUS_API_BASE = 'https://api.census.gov/data';
const DEFAULT_YEAR = 2020; // Most recent decennial census
const CACHE_KEY_PREFIX = 'census_fips_';
const CACHE_EXPIRY_DAYS = 365; // Census data changes yearly at most

/**
 * IndexedDB cache for census data (browser-side only)
 */
class CensusCache {
	private dbName = 'communique_census_cache';
	private storeName = 'fips_population';
	private db: IDBDatabase | null = null;

	async init(): Promise<void> {
		if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			return; // Server-side or no IndexedDB support
		}

		return new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onerror = () => {
				console.warn('Census cache IndexedDB failed to open:', request.error);
				resolve(); // Continue without cache
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: 'fipsCode' });
					store.createIndex('timestamp', 'timestamp', { unique: false });
				}
			};
		});
	}

	async get(fipsCode: string): Promise<CensusPopulationResponse | null> {
		if (!this.db) return null;

		return new Promise<CensusPopulationResponse | null>((resolve) => {
			const transaction = this.db!.transaction([this.storeName], 'readonly');
			const store = transaction.objectStore(this.storeName);
			const request = store.get(fipsCode);

			request.onsuccess = () => {
				const cached = request.result as
					| (CensusPopulationResponse & { timestamp: number })
					| undefined;
				if (!cached) {
					resolve(null);
					return;
				}

				// Check if cache is expired
				const ageMs = Date.now() - cached.timestamp;
				const ageDays = ageMs / (1000 * 60 * 60 * 24);
				if (ageDays > CACHE_EXPIRY_DAYS) {
					resolve(null);
					return;
				}

				const { timestamp: _, ...data } = cached;
				resolve(data);
			};

			request.onerror = () => {
				console.warn('Census cache read error:', request.error);
				resolve(null);
			};
		});
	}

	async set(data: CensusPopulationResponse): Promise<void> {
		if (!this.db) return;

		return new Promise<void>((resolve) => {
			const transaction = this.db!.transaction([this.storeName], 'readwrite');
			const store = transaction.objectStore(this.storeName);
			const cacheEntry = {
				...data,
				timestamp: Date.now()
			};
			const request = store.put(cacheEntry);

			request.onsuccess = () => resolve();
			request.onerror = () => {
				console.warn('Census cache write error:', request.error);
				resolve(); // Continue without caching
			};
		});
	}
}

const censusCache = new CensusCache();
let cacheInitialized = false;

/**
 * Lookup population data for a FIPS code
 *
 * @param fipsCode - 5-digit county FIPS code (e.g., "48201" for Harris County, TX)
 * @param options - Lookup options
 * @returns Population data or null if not found
 */
export async function lookupFipsPopulation(
	fipsCode: string,
	options: FipsLookupOptions = {}
): Promise<CensusPopulationResponse | null> {
	const { useCache = true, year = DEFAULT_YEAR } = options;

	// Validate FIPS code format
	if (!/^\d{5}$/.test(fipsCode)) {
		console.warn('Invalid FIPS code format:', fipsCode);
		return null;
	}

	// Initialize cache on first use
	if (useCache && !cacheInitialized && typeof window !== 'undefined') {
		await censusCache.init();
		cacheInitialized = true;
	}

	// Check cache first
	if (useCache) {
		const cached = await censusCache.get(fipsCode);
		if (cached) {
			return cached;
		}
	}

	// Fetch from Census API
	try {
		const stateFips = fipsCode.substring(0, 2);
		const countyFips = fipsCode.substring(2, 5);

		// Census API query for county population
		// P1_001N = Total population (2020 Decennial Census)
		const url = `${CENSUS_API_BASE}/${year}/dec/pl?get=NAME,P1_001N&for=county:${countyFips}&in=state:${stateFips}`;

		const response = await fetch(url);
		if (!response.ok) {
			console.warn('Census API request failed:', response.status, response.statusText);
			return null;
		}

		const data: CensusApiResponse = await response.json();

		if (!data || !Array.isArray(data) || data.length < 2) {
			console.warn('Unexpected Census API response format:', data);
			return null;
		}

		// Parse response: [[header row], [data row]]
		const headers = data[0] as string[];
		const values = data[1] as (string | number)[];

		const nameIndex = headers.indexOf('NAME');
		const populationIndex = headers.indexOf('P1_001N');

		if (nameIndex === -1 || populationIndex === -1) {
			console.warn('Missing expected Census API fields:', headers);
			return null;
		}

		const name = String(values[nameIndex]);
		const population = Number(values[populationIndex]);

		const result: CensusPopulationResponse = {
			fipsCode,
			name,
			population,
			year,
			state: stateFips,
			county: countyFips
		};

		// Cache the result
		if (useCache) {
			await censusCache.set(result);
		}

		return result;
	} catch (error) {
		console.error('Census API lookup error:', error);
		return null;
	}
}

/**
 * Lookup population data for multiple FIPS codes (batch operation)
 *
 * @param fipsCodes - Array of 5-digit FIPS codes
 * @param options - Lookup options
 * @returns Map of FIPS code → population data
 */
export async function batchLookupFipsPopulation(
	fipsCodes: string[],
	options: FipsLookupOptions = {}
): Promise<Map<string, CensusPopulationResponse>> {
	const results = new Map<string, CensusPopulationResponse>();

	// Process in parallel with rate limiting (Census API has rate limits)
	const BATCH_SIZE = 5;
	const BATCH_DELAY_MS = 1000; // 1 second between batches

	for (let i = 0; i < fipsCodes.length; i += BATCH_SIZE) {
		const batch = fipsCodes.slice(i, i + BATCH_SIZE);
		const promises = batch.map(async (fipsCode) => {
			const data = await lookupFipsPopulation(fipsCode, options);
			if (data) {
				results.set(fipsCode, data);
			}
		});

		await Promise.all(promises);

		// Add delay between batches
		if (i + BATCH_SIZE < fipsCodes.length) {
			await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
		}
	}

	return results;
}

/**
 * Estimate population for a city using Census Place FIPS code
 *
 * City FIPS codes are 7 digits: 2-digit state + 5-digit place code
 *
 * @param cityFips - 7-digit city FIPS code (e.g., "4805000" for Austin, TX)
 * @param options - Lookup options
 * @returns Population data or null if not found
 */
export async function lookupCityPopulation(
	cityFips: string,
	options: FipsLookupOptions = {}
): Promise<CensusPopulationResponse | null> {
	const { year = DEFAULT_YEAR } = options;

	// Validate city FIPS code format
	if (!/^\d{7}$/.test(cityFips)) {
		console.warn('Invalid city FIPS code format:', cityFips);
		return null;
	}

	try {
		const stateFips = cityFips.substring(0, 2);
		const placeFips = cityFips.substring(2, 7);

		// Census API query for place population
		const url = `${CENSUS_API_BASE}/${year}/dec/pl?get=NAME,P1_001N&for=place:${placeFips}&in=state:${stateFips}`;

		const response = await fetch(url);
		if (!response.ok) {
			console.warn('Census API request failed for city:', response.status);
			return null;
		}

		const data: CensusApiResponse = await response.json();

		if (!data || !Array.isArray(data) || data.length < 2) {
			return null;
		}

		const headers = data[0] as string[];
		const values = data[1] as (string | number)[];

		const nameIndex = headers.indexOf('NAME');
		const populationIndex = headers.indexOf('P1_001N');

		if (nameIndex === -1 || populationIndex === -1) {
			return null;
		}

		const name = String(values[nameIndex]);
		const population = Number(values[populationIndex]);

		return {
			fipsCode: cityFips,
			name,
			population,
			year,
			state: stateFips
		};
	} catch (error) {
		console.error('Census city lookup error:', error);
		return null;
	}
}
