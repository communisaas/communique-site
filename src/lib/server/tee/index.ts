/**
 * TEE (Trusted Execution Environment) Module
 *
 * Provides constituent data resolution through an abstraction that
 * can be swapped between local decryption (MVP) and AWS Nitro Enclaves.
 *
 * MVP: LocalConstituentResolver — decrypts in-process, PII function-scoped only
 * Future: NitroEnclaveResolver — decrypts inside attested enclave, PII never exits
 *
 * To switch implementations, change the resolver instantiation below.
 */

import type { ConstituentResolver } from './constituent-resolver';
import { LocalConstituentResolver } from './local-resolver';

let resolver: ConstituentResolver | null = null;

/**
 * Get the active constituent resolver.
 *
 * Returns the singleton resolver instance. Currently LocalConstituentResolver;
 * swap to NitroEnclaveResolver when enclave infrastructure is provisioned.
 */
export function getConstituentResolver(): ConstituentResolver {
	if (!resolver) {
		// MVP: in-process decryption
		// Future: resolver = new NitroEnclaveResolver(process.env.NITRO_ENCLAVE_ENDPOINT);
		resolver = new LocalConstituentResolver();
	}
	return resolver;
}

export type { ConstituentResolver, EncryptedWitnessRef, ResolverResult } from './constituent-resolver';
export type { ConstituentData } from '$lib/core/legislative/types';
