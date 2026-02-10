/**
 * Shadow Atlas HTTP Client
 *
 * Connects to voter-protocol's production Shadow Atlas API for:
 * - Point-in-polygon district lookups (lat/lng → district)
 * - Merkle proofs for ZK district membership verification
 * - Production depth-20 trees (1M capacity, circuit-compatible)
 *
 * This replaces the local mock Merkle tree implementation which used:
 * - Depth-12 trees (4K capacity) - INCOMPATIBLE with circuits
 * - Local Postgres storage - STALE data
 * - Client-side proof generation - SLOWER and less secure
 */

import { env } from '$env/dynamic/private';

const SHADOW_ATLAS_URL = env.SHADOW_ATLAS_API_URL || 'http://localhost:3000';
const SHADOW_ATLAS_REGISTRATION_TOKEN = env.SHADOW_ATLAS_REGISTRATION_TOKEN || '';

/**
 * District information returned from Shadow Atlas
 */
export interface District {
	id: string; // e.g., "usa-ca-san-francisco-d5"
	name: string; // e.g., "San Francisco District 5"
	jurisdiction: string; // e.g., "city-council"
	districtType: string; // e.g., "council"
}

/**
 * Merkle proof for ZK district membership verification
 * Depth-20 trees supporting up to 2^20 = 1,048,576 leaves
 */
export interface MerkleProof {
	root: string; // bigint as hex (e.g., "0x1234...")
	leaf: string; // bigint as hex (e.g., "0x5678...")
	siblings: string[]; // Array of 20 hex strings for depth-20
	pathIndices: number[]; // Array of 20 binary indices (0 or 1)
	depth: number; // Always 20 for production trees
}

/**
 * Combined district lookup and Merkle proof response
 */
export interface DistrictLookupResult {
	district: District;
	merkleProof: MerkleProof;
}

/**
 * Shadow Atlas API error response
 */
export interface ShadowAtlasError {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
}

/**
 * Shadow Atlas API success response
 */
export interface ShadowAtlasResponse {
	success: true;
	data: DistrictLookupResult;
}

/**
 * Lookup district and Merkle proof for a given latitude/longitude
 *
 * @param lat - Latitude (-90 to 90)
 * @param lng - Longitude (-180 to 180)
 * @returns District information and Merkle proof
 * @throws Error if lookup fails or coordinates are invalid
 */
export async function lookupDistrict(lat: number, lng: number): Promise<DistrictLookupResult> {
	// Validate coordinates
	if (lat < -90 || lat > 90) {
		throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
	}
	if (lng < -180 || lng > 180) {
		throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`);
	}

	const url = `${SHADOW_ATLAS_URL}/v1/lookup?lat=${lat}&lng=${lng}`;

	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'X-Client-Version': 'communique-v1'
			}
		});

		if (!response.ok) {
			// Try to parse error response
			const errorData = await response.json().catch(() => ({
				error: {
					code: 'NETWORK_ERROR',
					message: response.statusText
				}
			})) as ShadowAtlasError;

			throw new Error(
				`Shadow Atlas lookup failed: ${errorData.error.message || response.statusText}`
			);
		}

		const result = (await response.json()) as ShadowAtlasResponse;

		if (!result.success || !result.data) {
			throw new Error('Shadow Atlas returned invalid response format');
		}

		// Validate response structure
		const { district, merkleProof } = result.data;

		if (!district?.id || !district?.name) {
			throw new Error('Shadow Atlas returned invalid district data');
		}

		if (!merkleProof?.root || !merkleProof?.siblings || !merkleProof?.pathIndices) {
			throw new Error('Shadow Atlas returned invalid Merkle proof');
		}

		if (merkleProof.depth !== 20) {
			throw new Error(
				`Shadow Atlas returned invalid tree depth: ${merkleProof.depth}. Expected 20.`
			);
		}

		if (merkleProof.siblings.length !== 20 || merkleProof.pathIndices.length !== 20) {
			throw new Error(
				`Shadow Atlas returned invalid proof length: siblings=${merkleProof.siblings.length}, indices=${merkleProof.pathIndices.length}. Expected 20.`
			);
		}

		return result.data;
	} catch (error) {
		// Re-throw with context
		if (error instanceof Error) {
			throw new Error(`Shadow Atlas lookup failed: ${error.message}`);
		}
		throw new Error('Shadow Atlas lookup failed with unknown error');
	}
}

// ============================================================================
// Registration (Tree 1)
// ============================================================================

/**
 * Registration response from Shadow Atlas POST /v1/register
 */
export interface RegistrationResult {
	leafIndex: number;
	userRoot: string;
	userPath: string[];
	pathIndices: number[];
}

/**
 * Register a precomputed leaf hash in Tree 1.
 *
 * The leaf is Poseidon2_H3(user_secret, cell_id, registration_salt),
 * computed client-side. The operator sees ONLY the leaf hash.
 *
 * @param leaf - Hex-encoded leaf hash (with 0x prefix)
 * @returns Registration result with Merkle proof
 * @throws Error if registration fails
 */
export async function registerLeaf(leaf: string): Promise<RegistrationResult> {
	const url = `${SHADOW_ATLAS_URL}/v1/register`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Client-Version': 'communique-v1',
	};
	if (SHADOW_ATLAS_REGISTRATION_TOKEN) {
		headers['Authorization'] = `Bearer ${SHADOW_ATLAS_REGISTRATION_TOKEN}`;
	}

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ leaf }),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({
			error: { code: 'NETWORK_ERROR', message: response.statusText },
		}));

		const code = errorData.error?.code || 'UNKNOWN';
		const msg = errorData.error?.message || response.statusText;
		throw new Error(`Shadow Atlas registration failed [${code}]: ${msg}`);
	}

	const result = await response.json();

	if (!result.success || !result.data) {
		throw new Error('Shadow Atlas returned invalid registration response');
	}

	const { leafIndex, userRoot, userPath, pathIndices } = result.data;

	if (leafIndex === undefined || !userRoot || !userPath || !pathIndices) {
		throw new Error('Shadow Atlas registration response missing required fields');
	}

	if (userPath.length !== 20 || pathIndices.length !== 20) {
		throw new Error(
			`Invalid proof length: userPath=${userPath.length}, pathIndices=${pathIndices.length}. Expected 20.`
		);
	}

	return { leafIndex, userRoot, userPath, pathIndices };
}

// ============================================================================
// Cell Proof (Tree 2)
// ============================================================================

/**
 * Cell proof response from Shadow Atlas GET /v1/cell-proof
 */
export interface CellProofResult {
	cellMapRoot: string;
	cellMapPath: string[];
	cellMapPathBits: number[];
	districts: string[];
}

/**
 * Get the Tree 2 SMT proof for a cell_id.
 *
 * Returns the Merkle path and all 24 district IDs for the cell.
 * cell_id is neighborhood-level (~600-3000 people) — accepted
 * privacy tradeoff for Phase 1.
 *
 * @param cellId - Census tract FIPS code (numeric string or hex)
 * @returns Cell proof with districts
 * @throws Error if cell not found or request fails
 */
export async function getCellProof(cellId: string): Promise<CellProofResult> {
	const url = `${SHADOW_ATLAS_URL}/v1/cell-proof?cell_id=${encodeURIComponent(cellId)}`;

	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'X-Client-Version': 'communique-v1',
		},
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({
			error: { code: 'NETWORK_ERROR', message: response.statusText },
		}));

		const code = errorData.error?.code || 'UNKNOWN';
		const msg = errorData.error?.message || response.statusText;
		throw new Error(`Shadow Atlas cell proof failed [${code}]: ${msg}`);
	}

	const result = await response.json();

	if (!result.success || !result.data) {
		throw new Error('Shadow Atlas returned invalid cell proof response');
	}

	const { cellMapRoot, cellMapPath, cellMapPathBits, districts } = result.data;

	if (!cellMapRoot || !cellMapPath || !cellMapPathBits || !districts) {
		throw new Error('Shadow Atlas cell proof response missing required fields');
	}

	if (districts.length !== 24) {
		throw new Error(`Invalid district count: ${districts.length}. Expected 24.`);
	}

	return { cellMapRoot, cellMapPath, cellMapPathBits, districts };
}

// ============================================================================
// Health
// ============================================================================

/**
 * Health check for Shadow Atlas API
 *
 * @returns true if API is reachable and healthy
 */
export async function healthCheck(): Promise<boolean> {
	try {
		const response = await fetch(`${SHADOW_ATLAS_URL}/health`, {
			headers: {
				Accept: 'application/json'
			}
		});
		return response.ok;
	} catch {
		return false;
	}
}
