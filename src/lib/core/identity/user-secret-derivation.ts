/**
 * User Secret Derivation
 *
 * Derives user_secret from identity_commitment + user_entropy using Poseidon2.
 * This ensures all OAuth accounts for the same verified person produce
 * identical nullifiers, closing the cross-provider Sybil gap (G-02).
 *
 * user_secret = Poseidon2(identity_commitment, user_entropy)
 *
 * - identity_commitment: Deterministic from identity document (same person → same value)
 * - user_entropy: Random 32-byte value generated once at verification time
 * - user_secret: Used as private input to ZK circuit for nullifier derivation
 *
 * Storage:
 * - user_entropy is stored encrypted server-side (User.encrypted_entropy)
 * - user_entropy is stored client-side in IndexedDB via credential-encryption
 * - user_secret is NEVER stored — derived on-demand for proof generation
 */

import { poseidon2Hash2 } from '$lib/core/crypto/poseidon';

/**
 * Derive user_secret from identity_commitment and user_entropy.
 *
 * @param identityCommitment - Hex string from identity verification (deterministic per person)
 * @param userEntropy - Hex string (random, generated once, stored encrypted)
 * @returns user_secret as hex string (field element)
 */
export async function deriveUserSecret(
	identityCommitment: string,
	userEntropy: string
): Promise<string> {
	if (!identityCommitment || !userEntropy) {
		throw new Error('Both identityCommitment and userEntropy are required for user_secret derivation');
	}

	// Ensure both are hex-prefixed for Poseidon2
	const commitment = identityCommitment.startsWith('0x')
		? identityCommitment
		: '0x' + identityCommitment;
	const entropy = userEntropy.startsWith('0x') ? userEntropy : '0x' + userEntropy;

	return poseidon2Hash2(commitment, entropy);
}

/**
 * Generate random user_entropy (32 bytes, hex-encoded).
 * Called once during identity verification, stored encrypted.
 */
export function generateUserEntropy(): string {
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		return '0x' + Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}
	// Node.js fallback
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const nodeCrypto = require('crypto');
	return '0x' + nodeCrypto.randomBytes(32).toString('hex');
}
