/**
 * Poseidon2 Hash Utility
 *
 * Provides a browser-compatible Poseidon2 hash function for ZK circuits.
 * Poseidon2 is 4-5x faster than Poseidon and optimized for SNARK circuits.
 *
 * Uses @zkpassport/poseidon2 for BN254 curve (pure TypeScript, works in browser).
 */

import { poseidon2HashAsync } from '@zkpassport/poseidon2';

/**
 * Hash a string to a field element using Poseidon2
 *
 * Poseidon2 is 4x faster than Poseidon and 30% more efficient in ZK circuits.
 *
 * @param input - String to hash (e.g., template ID)
 * @returns Field element as hex string (0x...)
 */
export async function poseidonHash(input: string): Promise<string> {
	// Convert string to bytes
	const encoder = new TextEncoder();
	const bytes = encoder.encode(input);

	// Poseidon2 works on field elements (BN254)
	// Each field element can hold ~31 bytes (248 bits)
	const chunks: bigint[] = [];

	for (let i = 0; i < bytes.length; i += 31) {
		const chunk = bytes.slice(i, i + 31);
		let value = 0n;
		for (let j = 0; j < chunk.length; j++) {
			value = (value << 8n) | BigInt(chunk[j]);
		}
		chunks.push(value);
	}

	// Hash with Poseidon2 (async version for browser compatibility)
	const hash = await poseidon2HashAsync(chunks);

	// Convert to hex string (ensure it's a valid field element)
	const hashHex = hash.toString(16);
	return '0x' + hashHex.padStart(64, '0');
}

/**
 * Compute nullifier using Poseidon2
 * nullifier = Poseidon2(identityCommitment, actionId)
 *
 * @param identityCommitment - Hex string
 * @param actionId - Hex string
 * @returns Nullifier as hex string
 */
export async function computePoseidonNullifier(
	identityCommitment: string,
	actionId: string
): Promise<string> {
	// Convert hex strings to BigInt
	const commitment = BigInt(identityCommitment);
	const action = BigInt(actionId);

	// Compute Poseidon2(commitment, action)
	const nullifier = await poseidon2HashAsync([commitment, action]);

	// Convert to hex
	const nullifierHex = nullifier.toString(16);
	return '0x' + nullifierHex.padStart(64, '0');
}
