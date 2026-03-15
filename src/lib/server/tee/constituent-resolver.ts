/**
 * Constituent Resolver — TEE Abstraction
 *
 * Resolves encrypted witness data into constituent PII for CWC delivery.
 * PII exists only in memory during the delivery request and is never
 * written to disk or database in plaintext.
 *
 * Implementations:
 * - LocalConstituentResolver (MVP): In-process decryption via X25519 + XChaCha20
 * - NitroEnclaveResolver (future): AWS Nitro Enclave with attestation —
 *   PII never leaves the enclave boundary; decryption key is enclave-only
 */

import type { ConstituentData } from '$lib/core/legislative/types';

export interface EncryptedWitnessRef {
	ciphertext: string;
	nonce: string;
	ephemeralPublicKey: string;
}

export interface ResolverResult {
	success: boolean;
	constituent?: ConstituentData;
	/** Nitro Enclave attestation document (future — proves decryption happened inside TEE) */
	attestation?: string;
	error?: string;
}

/**
 * Interface for resolving encrypted witness data into constituent PII.
 *
 * All implementations MUST:
 * 1. Never persist plaintext PII to disk or database
 * 2. Scope PII to the lifetime of the resolve() call
 * 3. Return ConstituentData that satisfies CWC <ConstituentData> requirements
 *
 * The LocalConstituentResolver satisfies (1-2) via function-scoped variables.
 * A NitroEnclaveResolver would additionally guarantee PII never leaves
 * the enclave's attested memory boundary.
 */
export interface ConstituentResolver {
	resolve(encrypted: EncryptedWitnessRef): Promise<ResolverResult>;
}
