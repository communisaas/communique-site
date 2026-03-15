/**
 * Local Constituent Resolver (MVP)
 *
 * Decrypts witness in-process using the server's X25519 private key.
 * PII exists only in function-scoped variables and is garbage-collected
 * after the delivery completes.
 *
 * Crypto: X25519 ECDH → BLAKE2b KDF → XChaCha20-Poly1305
 * (mirrors client-side encryption in witness-encryption.ts)
 *
 * Replace with NitroEnclaveResolver when TEE infrastructure is ready.
 * The swap is a single-line change in index.ts.
 */

import { decryptWitness } from '$lib/server/witness-decryption';
import type { ConstituentResolver, EncryptedWitnessRef, ResolverResult } from './constituent-resolver';

export class LocalConstituentResolver implements ConstituentResolver {
	async resolve(encrypted: EncryptedWitnessRef): Promise<ResolverResult> {
		try {
			const witness = await decryptWitness({
				ciphertext: encrypted.ciphertext,
				nonce: encrypted.nonce,
				ephemeralPublicKey: encrypted.ephemeralPublicKey
			});

			const addr = witness.deliveryAddress as
				| {
						name?: string;
						email: string;
						street: string;
						city: string;
						state: string;
						zip: string;
						phone?: string;
						congressional_district?: string;
				  }
				| undefined;

			if (!addr) {
				return { success: false, error: 'No delivery address in decrypted witness' };
			}

			if (!addr.street || !addr.city || !addr.state || !addr.zip) {
				return {
					success: false,
					error: 'Incomplete delivery address: missing street, city, state, or zip'
				};
			}

			return {
				success: true,
				constituent: {
					name: addr.name || 'Constituent',
					email: addr.email,
					phone: addr.phone,
					address: {
						street: addr.street,
						city: addr.city,
						state: addr.state,
						zip: addr.zip
					},
					congressionalDistrict: addr.congressional_district
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Witness decryption failed';
			return { success: false, error: message };
		}
	}
}
