/**
 * Delete Encrypted Identity Blob
 *
 * Removes encrypted blob from storage (user requested deletion).
 *
 * Phase 1: Delete from Postgres
 * Phase 2: Unpin from IPFS (garbage collection)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

interface DeleteRequest {
	userId: string;
}

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as DeleteRequest;
		const { userId } = body;

		if (!userId) {
			return json({ error: 'Missing userId' }, { status: 400 });
		}

		// Delete encrypted blob
		await prisma.encryptedDeliveryData.delete({
			where: { user_id: userId }
		});

		return json({
			success: true,
			message: 'Encrypted blob deleted successfully'
		});
	} catch (error) {
		// Handle case where blob doesn't exist
		if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
			return json({ error: 'No encrypted blob found for user' }, { status: 404 });
		}

		console.error('Error deleting encrypted blob:', error);
		return json(
			{
				error: 'Failed to delete encrypted blob',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
