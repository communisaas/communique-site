import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Witness Encryption Public Key Endpoint
 *
 * Returns the server's X25519 public key for witness encryption.
 * Client uses this to encrypt witness data that only the server can decrypt.
 *
 * Key is configured via WITNESS_ENCRYPTION_PUBLIC_KEY env var.
 * Generate keypair with: npx tsx scripts/generate-witness-keypair.ts
 */

export const GET: RequestHandler = async () => {
	try {
		const publicKey = process.env.WITNESS_ENCRYPTION_PUBLIC_KEY;

		if (!publicKey) {
			console.error('[Witness Key] WITNESS_ENCRYPTION_PUBLIC_KEY not configured');
			return json(
				{ success: false, error: 'Witness encryption not configured' },
				{ status: 503 }
			);
		}

		// Stable key ID derived from public key (first 16 chars)
		// This lets the client cache keys and detect rotation
		const keyId = `wek-${publicKey.replace(/^0x/, '').slice(0, 16)}`;

		return json({
			success: true,
			keyId,
			publicKey,
			algorithm: 'X25519-XChaCha20-Poly1305'
		});
	} catch (error) {
		console.error('[Witness Key] Error:', error);
		return json(
			{ success: false, error: 'Failed to retrieve encryption key' },
			{ status: 500 }
		);
	}
};
