/**
 * Store Encrypted Identity Blob
 *
 * Stores XChaCha20-Poly1305 encrypted identity data in Postgres.
 * Platform CANNOT decrypt (only AWS Nitro Enclave has private key).
 *
 * Phase 1: Postgres storage
 * Phase 2: IPFS + on-chain pointer
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import type { EncryptedBlob } from '$lib/core/identity/blob-encryption';

interface StoreRequest {
	userId: string;
	blob: EncryptedBlob;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as StoreRequest;
		const { userId, blob } = body;

		if (!userId || !blob) {
			return json({ error: 'Missing userId or blob' }, { status: 400 });
		}

		// Validate blob structure
		if (!blob.ciphertext || !blob.nonce || !blob.publicKey) {
			return json({ error: 'Invalid encrypted blob format' }, { status: 400 });
		}

		// Store or update encrypted blob
		const encryptedData = await prisma.encryptedDeliveryData.upsert({
			where: { user_id: userId },
			create: {
				user_id: userId,
				ciphertext: blob.ciphertext,
				nonce: blob.nonce,
				ephemeral_public_key: blob.publicKey,
				tee_key_id: 'phase1-v1', // Phase 1: Static key ID
				encryption_version: blob.version
			},
			update: {
				ciphertext: blob.ciphertext,
				nonce: blob.nonce,
				ephemeral_public_key: blob.publicKey,
				tee_key_id: 'phase1-v1',
				encryption_version: blob.version,
				updated_at: new Date()
			}
		});

		return json({
			success: true,
			blobId: encryptedData.id,
			message: 'Encrypted blob stored successfully'
		});
	} catch (error) {
		console.error('Error storing encrypted blob:', error);
		return json(
			{
				error: 'Failed to store encrypted blob',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
