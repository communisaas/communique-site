import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * POST /api/debates/[debateId]/claim
 *
 * Claim settlement from a resolved debate.
 * In production, calls DebateMarket.claimSettlement() on-chain
 * which requires a ZK proof of participation.
 *
 * Body: { nullifierHex, proofHex, publicInputs }
 *
 * Currently a stub for frontend development — records the claim
 * attempt but does not execute on-chain settlement.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const { debateId } = params;

	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		select: {
			id: true,
			status: true,
			winning_argument_index: true,
			winning_stance: true,
			total_stake: true
		}
	});

	if (!debate) {
		throw error(404, 'Debate not found');
	}
	if (debate.status !== 'resolved') {
		throw error(400, 'Debate has not been resolved yet');
	}

	const body = await request.json();
	const { nullifierHex, proofHex, publicInputs } = body;

	if (!nullifierHex || !proofHex || !publicInputs) {
		throw error(400, 'ZK proof data is required for settlement claims');
	}

	// NOTE: In production, this would:
	// 1. Verify the ZK proof on-chain via DebateMarket.claimSettlement()
	// 2. Transfer proportional stake to the winning side participants
	// 3. Return the proposer bond (if the debate met minimum participation)
	//
	// For now, return a stub acknowledgment.

	return json({
		debateId: debate.id,
		status: 'claim_recorded',
		winningStance: debate.winning_stance,
		message: 'Settlement claim recorded. On-chain execution pending contract integration.'
	});
};
