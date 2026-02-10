/**
 * Poseidon2 Hash Utility (Barretenberg-Compatible)
 *
 * Uses @aztec/bb.js BarretenbergSync for Poseidon2 to match Noir circuit exactly.
 * This ensures nullifier and merkle root computations match the ZK circuit.
 *
 * NOTE: This module uses lazy loading to avoid SSR issues with @aztec/bb.js.
 * It should only be used in browser/worker contexts, not during SSR.
 *
 * IMPORTANT: We use BarretenbergSync.initSingleton() instead of Barretenberg.new() because:
 * 1. BarretenbergSync uses threads: 1 (single-threaded WASM without nested workers)
 * 2. Barretenberg.new() creates internal workers which causes deadlocks in nested worker contexts
 * 3. For lightweight operations like hashing, single-threaded is actually faster (no worker overhead)
 */

import type { Fr as FrType, BarretenbergSync as BarretenbergSyncType } from '@aztec/bb.js';

// Lazy-loaded module references
let BarretenbergSync: typeof import('@aztec/bb.js').BarretenbergSync | null = null;
let Fr: typeof import('@aztec/bb.js').Fr | null = null;

// Singleton BarretenbergSync instance (initialized lazily)
let bbSyncInstance: BarretenbergSyncType | null = null;

/**
 * Lazy-load @aztec/bb.js (avoids SSR issues)
 */
async function loadBbJs() {
	if (!BarretenbergSync || !Fr) {
		// Import buffer shim first to install Buffer globally
		await import('$lib/core/proof/buffer-shim');
		// Then import bb.js
		const bbjs = await import('@aztec/bb.js');
		BarretenbergSync = bbjs.BarretenbergSync;
		Fr = bbjs.Fr;
	}
	// After the if block, both are guaranteed to be assigned
	if (!BarretenbergSync || !Fr) {
		throw new Error('Failed to load @aztec/bb.js: BarretenbergSync or Fr is undefined');
	}
	return { BarretenbergSync, Fr };
}

/**
 * Get or initialize the BarretenbergSync instance
 *
 * Uses BarretenbergSync.initSingleton() which:
 * - Uses threads: 1 (single-threaded WASM)
 * - Does NOT create nested workers (safe in worker context)
 * - Is optimized for hash operations
 */
async function getBarretenbergSync(): Promise<BarretenbergSyncType> {
	if (!bbSyncInstance) {
		console.log('[Poseidon] Loading bb.js (BarretenbergSync)...');
		const { BarretenbergSync } = await loadBbJs();

		const sabSupport = typeof SharedArrayBuffer !== 'undefined';
		const threads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
		console.log(
			`[Poseidon] Environment check: SAB=${sabSupport}, Threads=${threads}, Context=${typeof self !== 'undefined' && 'WorkerGlobalScope' in self ? 'Worker' : 'Main'}`
		);

		console.log(
			'[Poseidon] Initializing BarretenbergSync singleton (threads: 1, no nested workers)...'
		);
		const startTime = performance.now();

		try {
			// BarretenbergSync.initSingleton() uses threads: 1 internally
			// This is the correct way to use Barretenberg for hashing in worker contexts
			bbSyncInstance = await BarretenbergSync.initSingleton();
			const duration = performance.now() - startTime;
			console.log(`[Poseidon] BarretenbergSync initialized in ${duration.toFixed(0)}ms`);
		} catch (e) {
			console.error('[Poseidon] Failed to initialize BarretenbergSync:', e);
			throw e;
		}
	}
	return bbSyncInstance;
}

/** BN254 field modulus (matches voter-protocol/packages/crypto/poseidon2.ts) */
const BN254_MODULUS = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001');

/**
 * Convert hex string to Fr (field element).
 * Validates hex format and BN254 field modulus bound.
 */
function hexToFr(hex: string): FrType {
	if (!Fr) {
		throw new Error('Fr not loaded - call loadBbJs() first');
	}
	// Remove 0x prefix if present
	const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
	// M-05: Reject empty hex strings (would silently become 0)
	if (cleanHex.length === 0) {
		throw new Error(`Empty hex string: "${hex}"`);
	}
	// Validate hex characters
	if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
		throw new Error(`Invalid hex string: "${hex}"`);
	}
	// Pad to 64 chars (32 bytes)
	const padded = cleanHex.padStart(64, '0');
	// Validate BN254 field modulus bound
	const value = BigInt('0x' + padded);
	if (value >= BN254_MODULUS) {
		throw new Error(`Value exceeds BN254 field modulus: 0x${padded}`);
	}
	// Convert to Uint8Array (big-endian)
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
	}
	return new Fr(bytes);
}

/**
 * Convert Fr to hex string
 */
function frToHex(fr: FrType): string {
	const bytes = fr.toBuffer();
	let hex = '';
	for (let i = 0; i < bytes.length; i++) {
		hex += bytes[i].toString(16).padStart(2, '0');
	}
	return '0x' + hex;
}

/**
 * Get Fr.ZERO
 */
function getFrZero(): FrType {
	if (!Fr) {
		throw new Error('Fr not loaded - call loadBbJs() first');
	}
	return Fr.ZERO;
}

/**
 * Domain separation tag for 2-input hash (BA-003).
 * DOMAIN_HASH2 = 0x48324d = "H2M" in ASCII.
 * Prevents collision between hash2(a, b) and hash4(a, b, 0, 0).
 *
 * Must match voter-protocol/packages/crypto/poseidon2.ts DOMAIN_HASH2
 * and Noir circuit global DOMAIN_HASH2: Field = 0x48324d.
 */
const DOMAIN_HASH2 = '0x' + (0x48324d).toString(16).padStart(64, '0');

/**
 * Poseidon2 hash of 2 field elements (matches Noir's poseidon2_hash2)
 * state = [left, right, DOMAIN_HASH2, 0], output = permutation(state)[0]
 *
 * BA-003: Domain separation tag in slot 2 prevents collision with hash4(a, b, 0, 0).
 */
export async function poseidon2Hash2(left: string, right: string): Promise<string> {
	// Ensure bb.js is loaded first
	await loadBbJs();
	const bb = await getBarretenbergSync();
	const zero = getFrZero();
	const state = [hexToFr(left), hexToFr(right), hexToFr(DOMAIN_HASH2), zero];
	// poseidon2Permutation is synchronous on BarretenbergSync
	const result = bb.poseidon2Permutation(state);
	return frToHex(result[0]);
}

/**
 * Domain separation tag for 3-input hash (two-tree architecture).
 * DOMAIN_HASH3 = 0x48334d = "H3M" in ASCII.
 * Prevents collision between hash3(a, b, c) and hash4(a, b, c, 0).
 *
 * Must match voter-protocol/packages/crypto/poseidon2.ts DOMAIN_HASH3.
 */
const DOMAIN_HASH3 = '0x' + (0x48334d).toString(16).padStart(64, '0');

/**
 * Poseidon2 hash of 3 field elements (matches voter-protocol hash3)
 * state = [a, b, c, DOMAIN_HASH3], output = permutation(state)[0]
 *
 * Used for user leaf computation in two-tree architecture:
 *   user_leaf = poseidon2Hash3(user_secret, cell_id, registration_salt)
 *
 * @param a - First input (hex string, 0x-prefixed)
 * @param b - Second input (hex string, 0x-prefixed)
 * @param c - Third input (hex string, 0x-prefixed)
 * @returns Hash as hex string (0x-prefixed)
 */
export async function poseidon2Hash3(a: string, b: string, c: string): Promise<string> {
	// Ensure bb.js is loaded first
	await loadBbJs();
	const bb = await getBarretenbergSync();
	const state = [hexToFr(a), hexToFr(b), hexToFr(c), hexToFr(DOMAIN_HASH3)];
	// poseidon2Permutation is synchronous on BarretenbergSync
	const result = bb.poseidon2Permutation(state);
	return frToHex(result[0]);
}

/**
 * Poseidon2 hash of 4 field elements (matches Noir's poseidon2_hash4)
 * state = [a, b, c, d], output = permutation(state)[0]
 */
export async function poseidon2Hash4(a: string, b: string, c: string, d: string): Promise<string> {
	// Ensure bb.js is loaded first
	await loadBbJs();
	const bb = await getBarretenbergSync();
	const state = [hexToFr(a), hexToFr(b), hexToFr(c), hexToFr(d)];
	// poseidon2Permutation is synchronous on BarretenbergSync
	const result = bb.poseidon2Permutation(state);
	return frToHex(result[0]);
}

/**
 * Hash a string to a field element using Poseidon2
 *
 * @param input - String to hash (e.g., template ID)
 * @returns Field element as hex string (0x...)
 */
export async function poseidonHash(input: string): Promise<string> {
	// Ensure bb.js is loaded first
	await loadBbJs();
	const bb = await getBarretenbergSync();
	const zero = getFrZero();

	// Convert string to bytes
	const encoder = new TextEncoder();
	const bytes = encoder.encode(input);

	// Poseidon2 works on field elements (BN254)
	// Each field element can hold ~31 bytes (248 bits)
	const chunks: FrType[] = [];

	for (let i = 0; i < bytes.length; i += 31) {
		const chunk = bytes.slice(i, i + 31);
		let value = 0n;
		for (let j = 0; j < chunk.length; j++) {
			value = (value << 8n) | BigInt(chunk[j]);
		}
		// Convert bigint to Fr
		const hexValue = '0x' + value.toString(16).padStart(64, '0');
		chunks.push(hexToFr(hexValue));
	}

	// Pad to 4 elements for permutation
	while (chunks.length < 4) {
		chunks.push(zero);
	}

	// Hash with Poseidon2 permutation (synchronous on BarretenbergSync)
	const result = bb.poseidon2Permutation(chunks.slice(0, 4));
	return frToHex(result[0]);
}

/**
 * Compute nullifier using Poseidon2 (matches Noir circuit exactly)
 * nullifier = poseidon2_hash2(userSecret, actionDomain)
 *
 * CVE-002 fix: action_domain is a PUBLIC contract-controlled field that
 * encodes epoch, campaign, and authority context. Users cannot manipulate
 * it to generate multiple valid nullifiers.
 *
 * @param userSecret - User's secret (hex string)
 * @param actionDomain - Action domain (hex string, from buildActionDomain)
 * @returns Nullifier as hex string
 */
export async function computeNullifier(
	userSecret: string,
	actionDomain: string
): Promise<string> {
	return poseidon2Hash2(userSecret, actionDomain);
}

/**
 * Compute merkle root using Poseidon2 (matches Noir circuit exactly)
 * Uses the same algorithm as compute_merkle_root in main.nr
 */
export async function computeMerkleRoot(
	leaf: string,
	merklePath: string[],
	leafIndex: number
): Promise<string> {
	let node = leaf;

	for (let i = 0; i < merklePath.length; i++) {
		const bit = ((leafIndex >> i) & 1) === 1;
		const sibling = merklePath[i];

		if (bit) {
			node = await poseidon2Hash2(sibling, node);
		} else {
			node = await poseidon2Hash2(node, sibling);
		}
	}

	return node;
}
