/**
 * IPFS Data Store for Shadow Atlas
 *
 * Fetches and caches content-addressed data from IPFS gateways.
 * District mapping, officials, and Merkle snapshots are pinned to IPFS
 * quarterly and cached locally with 7-day TTL.
 *
 * Dual-environment caching:
 * - Browser: IndexedDB (persistent, survives page reloads)
 * - CF Workers: In-memory Map (per-isolate, cleared on redeploy)
 *
 * This module has NO server-only imports ($env/dynamic/private).
 * It works in both browser and CF Workers environments.
 */

import { openDB, type IDBPDatabase } from 'idb';

// ============================================================================
// Configuration
// ============================================================================

/** Primary IPFS gateway (Cloudflare — no rate limits, global CDN) */
const IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs';

/** Fallback gateways (tried in order if primary fails) */
const FALLBACK_GATEWAYS = [
	'https://dweb.link/ipfs',
	'https://w3s.link/ipfs',
];

/** Cache TTL: 7 days (quarterly updates with comfortable margin) */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** IPFS fetch timeout (first fetch can be slow — gateway may need to find content) */
const IPFS_FETCH_TIMEOUT_MS = 30_000;

/**
 * Content identifiers for pinned IPFS data.
 * Updated quarterly by the shadow-atlas-quarterly.yml pipeline.
 *
 * TODO: Move to KV namespace or read from on-chain DistrictRegistry
 * so quarterly updates don't require a redeploy.
 */
export const IPFS_CIDS = {
	/** H3 resolution-7 → district mapping (~3-5 MB brotli) */
	districtMapping: '',
	/** Federal officials dataset (~504 KB) */
	officials: '',
	/** Quarterly Merkle tree snapshot (~15-25 MB compressed) */
	merkleSnapshot: '',
} as const;

/**
 * Override CIDs at runtime (e.g., from KV namespace or on-chain registry).
 * Call this before any data fetch if CIDs are dynamic.
 */
export function setCIDs(cids: Partial<typeof IPFS_CIDS>): void {
	if (cids.districtMapping) (IPFS_CIDS as Record<string, string>).districtMapping = cids.districtMapping;
	if (cids.officials) (IPFS_CIDS as Record<string, string>).officials = cids.officials;
	if (cids.merkleSnapshot) (IPFS_CIDS as Record<string, string>).merkleSnapshot = cids.merkleSnapshot;
}

// ============================================================================
// Data Types (shared with substrate's build pipeline)
// ============================================================================

/**
 * District codes for a single H3 cell.
 *
 * Format from substrate's build pipeline:
 * - cd: "cd-{stateFIPS}{districtNum}" e.g., "cd-0601" (California 1st)
 * - sldu: "sldu-{stateFIPS}{seatNum}" e.g., "sldu-06001" (state senate)
 * - sldl: "sldl-{stateFIPS}{seatNum}" e.g., "sldl-06001" (state house)
 * - county: "county-{countyFIPS}" e.g., "county-06001"
 *
 * All fields optional — a cell might only have county (e.g., at-large states).
 */
export interface CellDistricts {
	/** Congressional district: "cd-{stateFIPS}{districtNum}" */
	cd?: string;
	/** State senate (upper chamber): "sldu-{stateFIPS}{seatNum}" */
	sldu?: string;
	/** State house (lower chamber): "sldl-{stateFIPS}{seatNum}" */
	sldl?: string;
	/** County: "county-{countyFIPS}" */
	county?: string;
}

/**
 * H3→district mapping dataset (built quarterly by substrate).
 * Matches substrate's output schema exactly.
 */
export interface DistrictMappingData {
	version: number;
	/** H3 resolution (7 for production) */
	resolution: number;
	/** ISO-8601 generation timestamp */
	generated: string;
	cellCount: number;
	/** Map from H3 cell index string → district codes */
	mapping: Record<string, CellDistricts>;
}

/** Officials dataset keyed by congressional district code */
export interface OfficialsDataset {
	version: number;
	vintage: string;
	source: string;
	districts: Record<string, DistrictOfficialsEntry>;
}

export interface DistrictOfficialsEntry {
	officials: OfficialsEntryIPFS[];
	state: string;
	special_status: {
		type: 'dc' | 'territory';
		message: string;
		has_senators: boolean;
		has_voting_representative: boolean;
	} | null;
}

/** Official record in the IPFS dataset (matches client.ts Official interface) */
export interface OfficialsEntryIPFS {
	bioguide_id: string;
	name: string;
	party: string;
	chamber: 'house' | 'senate';
	state: string;
	district: string | null;
	office: string;
	phone: string | null;
	contact_form_url: string | null;
	website_url: string | null;
	cwc_code: string | null;
	is_voting: boolean;
	delegate_type: string | null;
}

/**
 * Merkle tree snapshot (structure TBD — cipher owns path computation).
 * The `snapshot` field is opaque to this module; cipher defines and consumes it.
 */
export interface MerkleSnapshotData {
	version: number;
	vintage: string;
	/** Tree root as hex string (BN254 field element) */
	root: string;
	/** Tree depth (20 for production) */
	depth: number;
	/** Number of non-empty leaves */
	treeSize: number;
	/** Raw snapshot data — cipher's merkle-builder.ts consumes this */
	snapshot: unknown;
}

// ============================================================================
// Cache Infrastructure
// ============================================================================

interface CacheEntry<T> {
	data: T;
	cid: string;
	fetchedAt: number;
}

interface CacheAdapter {
	get<T>(key: string): Promise<CacheEntry<T> | null>;
	set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
	delete(key: string): Promise<void>;
}

// -- IndexedDB Cache (Browser) -----------------------------------------------

const IDB_NAME = 'shadow-atlas-ipfs';
const IDB_VERSION = 1;
const IDB_STORE = 'cache';

let idbInstance: IDBPDatabase | null = null;

async function getIDB(): Promise<IDBPDatabase> {
	if (!idbInstance) {
		idbInstance = await openDB(IDB_NAME, IDB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(IDB_STORE)) {
					db.createObjectStore(IDB_STORE);
				}
			},
		});
	}
	return idbInstance;
}

const indexedDBCache: CacheAdapter = {
	async get<T>(key: string): Promise<CacheEntry<T> | null> {
		try {
			const db = await getIDB();
			const result = await db.get(IDB_STORE, key);
			return result ?? null;
		} catch {
			return null;
		}
	},
	async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
		try {
			const db = await getIDB();
			await db.put(IDB_STORE, entry, key);
		} catch (err) {
			// IndexedDB write failures are non-fatal — data will be re-fetched
			console.warn('[IPFS Store] IndexedDB write failed:', err);
		}
	},
	async delete(key: string): Promise<void> {
		try {
			const db = await getIDB();
			await db.delete(IDB_STORE, key);
		} catch {
			// Non-fatal
		}
	},
};

// -- In-Memory Cache (CF Workers / Server) ------------------------------------

const memoryStore = new Map<string, CacheEntry<unknown>>();

const memoryCache: CacheAdapter = {
	async get<T>(key: string): Promise<CacheEntry<T> | null> {
		return (memoryStore.get(key) as CacheEntry<T>) ?? null;
	},
	async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
		memoryStore.set(key, entry as CacheEntry<unknown>);
	},
	async delete(key: string): Promise<void> {
		memoryStore.delete(key);
	},
};

// -- Environment Detection ----------------------------------------------------

function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== 'undefined';
	} catch {
		return false;
	}
}

function getCache(): CacheAdapter {
	return isIndexedDBAvailable() ? indexedDBCache : memoryCache;
}

// ============================================================================
// IPFS Fetch
// ============================================================================

/**
 * Fetch data from IPFS by CID, trying multiple gateways.
 * Supports both JSON and binary (ArrayBuffer) responses.
 * Throws if all gateways fail.
 */
async function fetchFromIPFS<T>(cid: string, mode: 'json' | 'binary' = 'json'): Promise<T> {
	if (!cid) {
		throw new Error(
			'IPFS CID not configured. District data not yet published — ' +
			'substrate must run the quarterly pipeline (Phase A1/A2) first.'
		);
	}

	const gateways = [IPFS_GATEWAY, ...FALLBACK_GATEWAYS];
	let lastError: Error | null = null;

	for (const gateway of gateways) {
		try {
			const url = `${gateway}/${cid}`;
			const accept = mode === 'binary' ? 'application/octet-stream' : 'application/json';
			const response = await fetch(url, {
				headers: { Accept: accept },
				signal: AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS),
			});

			if (!response.ok) {
				throw new Error(`${gateway} returned ${response.status}`);
			}

			if (mode === 'binary') {
				return (await response.arrayBuffer()) as T;
			}
			return (await response.json()) as T;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			console.warn(`[IPFS Store] Gateway ${gateway} failed for ${cid}: ${lastError.message}`);
		}
	}

	throw new Error(
		`All IPFS gateways failed for CID ${cid}: ${lastError?.message}`
	);
}

// ============================================================================
// Cache-Through Fetch
// ============================================================================

/**
 * Fetch data with cache-through semantics:
 * 1. Check cache (return if valid: same CID + within TTL)
 * 2. Fetch from IPFS gateways
 * 3. Store in cache
 */
async function getCached<T>(key: string, cid: string, mode: 'json' | 'binary' = 'json'): Promise<T> {
	const cache = getCache();
	const cached = await cache.get<T>(key);

	if (cached && cached.cid === cid && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
		return cached.data;
	}

	const data = await fetchFromIPFS<T>(cid, mode);
	await cache.set(key, { data, cid, fetchedAt: Date.now() });
	return data;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch H3→district mapping.
 * ~3-5 MB brotli compressed, ~1.9M cell entries.
 * Cached in IndexedDB (browser) or memory (server) for 7 days.
 */
export async function getDistrictMapping(): Promise<DistrictMappingData> {
	return getCached<DistrictMappingData>('district-mapping', IPFS_CIDS.districtMapping);
}

/**
 * Fetch officials dataset.
 * ~504 KB, keyed by congressional district code (e.g., "CA-12").
 * Cached for 7 days.
 */
export async function getOfficialsDataset(): Promise<OfficialsDataset> {
	return getCached<OfficialsDataset>('officials', IPFS_CIDS.officials);
}

/**
 * Fetch Merkle tree snapshot.
 * ~15-25 MB compressed (brotli). Stored as JSON in IndexedDB.
 * Cipher's cell-tree-snapshot.ts deserializes + computes paths from this.
 * Cached for 7 days.
 *
 * The returned MerkleSnapshotData.snapshot is the CellTreeSnapshotWire
 * JSON object — cipher's deserializeCellTreeSnapshot() consumes it.
 */
export async function getMerkleSnapshot(): Promise<MerkleSnapshotData> {
	return getCached<MerkleSnapshotData>('merkle-snapshot', IPFS_CIDS.merkleSnapshot);
}

/**
 * Check IPFS gateway reachability.
 * Uses a lightweight HEAD request to the primary gateway.
 */
export async function checkIPFSHealth(): Promise<boolean> {
	try {
		// Attempt to reach the gateway root — lightweight check
		const response = await fetch(IPFS_GATEWAY, {
			method: 'HEAD',
			signal: AbortSignal.timeout(5_000),
		});
		return response.ok || response.status === 400; // 400 = gateway up but no CID specified
	} catch {
		return false;
	}
}

/**
 * Clear all cached data. Forces re-fetch from IPFS on next access.
 */
export async function clearCache(): Promise<void> {
	const cache = getCache();
	await Promise.all([
		cache.delete('district-mapping'),
		cache.delete('officials'),
		cache.delete('merkle-snapshot'),
	]);
}

/**
 * Check if data is available (CIDs configured and cached or fetchable).
 * Use this before calling read functions to determine if IPFS mode is active.
 */
export function isIPFSConfigured(): boolean {
	return !!(IPFS_CIDS.districtMapping && IPFS_CIDS.officials);
}
