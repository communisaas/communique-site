import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

export const POST: RequestHandler = async ({ params, request }) => {
	const { debateId } = params;
	const body = await request.json();

	const { epoch, commitIndex, argumentIndex, direction, stakeAmount, engagementTier, nonce } =
		body;

	if (
		epoch === undefined ||
		commitIndex === undefined ||
		argumentIndex === undefined ||
		!direction ||
		!stakeAmount ||
		!nonce
	) {
		throw error(400, 'Missing required fields');
	}

	// Validate debate exists
	const debate = await prisma.debate.findUnique({
		where: { id: debateId }
	});

	if (!debate) throw error(404, 'Debate not found');
	if (debate.status !== 'active') throw error(400, 'Debate is not active');

	// TODO: Forward to relayer for on-chain submission
	// The relayer will submit revealTrade() on-chain

	return json({
		success: true,
		message: 'Trade reveal accepted. Will be submitted on-chain by relayer.',
		debateId,
		epoch,
		argumentIndex,
		direction
	});
};
