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
	return { BarretenbergSync: BarretenbergSync!, Fr: Fr! };
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

		console.log('[Poseidon] Initializing BarretenbergSync singleton (threads: 1, no nested workers)...');
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

/**
 * Convert hex string to Fr (field element)
 */
function hexToFr(hex: string): FrType {
	if (!Fr) {
		throw new Error('Fr not loaded - call loadBbJs() first');
	}
	// Remove 0x prefix if present
	const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
	// Pad to 64 chars (32 bytes)
	const padded = cleanHex.padStart(64, '0');
	// Convert to Uint8Array
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
 * Poseidon2 hash of 2 field elements (matches Noir's poseidon2_hash2)
 * state = [left, right, 0, 0], output = permutation(state)[0]
 */
export async function poseidon2Hash2(left: string, right: string): Promise<string> {
	// Ensure bb.js is loaded first
	await loadBbJs();
	const bb = await getBarretenbergSync();
	const zero = getFrZero();
	const state = [hexToFr(left), hexToFr(right), zero, zero];
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
 * nullifier = poseidon2_hash4(userSecret, campaignId, authorityHash, epochId)
 *
 * @param userSecret - User's secret (hex string)
 * @param campaignId - Campaign/action ID (hex string)
 * @param authorityHash - Authority hash (hex string, default 0x0)
 * @param epochId - Epoch ID (hex string, default 0x0)
 * @returns Nullifier as hex string
 */
export async function computePoseidonNullifier(
	userSecret: string,
	campaignId: string,
	authorityHash: string = '0x0',
	epochId: string = '0x0'
): Promise<string> {
	return poseidon2Hash4(userSecret, campaignId, authorityHash, epochId);
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
