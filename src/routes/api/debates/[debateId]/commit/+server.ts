import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

export const POST: RequestHandler = async ({ params, request }) => {
	const { debateId } = params;
	const body = await request.json();

	const { commitHash, proof, publicInputs, verifierDepth, deadline, signature } = body;

	if (!commitHash || !proof) {
		throw error(400, 'Missing required fields: commitHash, proof');
	}

	// Validate debate exists and is active
	const debate = await prisma.debate.findUnique({
		where: { id: debateId }
	});

	if (!debate) throw error(404, 'Debate not found');
	if (debate.status !== 'active') throw error(400, 'Debate is not active');

	// TODO: Forward to relayer for on-chain submission
	// For now, store the commitment intent off-chain
	// The relayer will pick this up and submit commitTrade() on-chain

	return json({
		success: true,
		message: 'Trade commitment accepted. Will be submitted on-chain by relayer.',
		debateId,
		commitHash,
		epoch: debate.current_epoch
	});
};
