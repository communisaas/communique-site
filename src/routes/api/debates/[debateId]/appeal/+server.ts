import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appealResolution } from '$lib/core/blockchain/debate-market-client';

export const POST: RequestHandler = async ({ params }) => {
	const { debateId } = params;
	if (!debateId) throw error(400, 'Missing debateId');

	const result = await appealResolution(debateId);

	if (!result.success) {
		throw error(502, result.error ?? 'Appeal transaction failed');
	}

	return json({ success: true, txHash: result.txHash });
};
