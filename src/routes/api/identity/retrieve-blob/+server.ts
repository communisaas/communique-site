/**
 * Retrieve Encrypted Identity Blob
 *
 * Fetches encrypted blob from Postgres.
 * Returns encrypted data only (platform cannot decrypt).
 *
 * Phase 1: Postgres lookup
 * Phase 2: IPFS CID retrieval + on-chain pointer
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import type { EncryptedBlob } from '$lib/core/identity/blob-encryption';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');

		if (!userId) {
			return json({ error: 'Missing userId parameter' }, { status: 400 });
		}

		// Fetch encrypted blob
		const encryptedData = await prisma.encryptedDeliveryData.findUnique({
			where: { user_id: userId }
		});

		if (!encryptedData) {
			return json({ error: 'No encrypted blob found for user' }, { status: 404 });
		}

		// Convert to EncryptedBlob format
		const blob: EncryptedBlob = {
			ciphertext: encryptedData.ciphertext,
			nonce: encryptedData.nonce,
			publicKey: encryptedData.ephemeral_public_key,
			version: encryptedData.encryption_version,
			timestamp: encryptedData.created_at.getTime()
		};

		return json({
			success: true,
			blob,
			metadata: {
				created_at: encryptedData.created_at,
				updated_at: encryptedData.updated_at,
				last_used_at: encryptedData.last_used_at,
				tee_key_id: encryptedData.tee_key_id
			}
		});
	} catch (error) {
		console.error('Error retrieving encrypted blob:', error);
		return json(
			{
				error: 'Failed to retrieve encrypted blob',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
