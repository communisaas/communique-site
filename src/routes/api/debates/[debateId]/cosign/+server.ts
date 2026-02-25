import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * POST /api/debates/[debateId]/cosign
 *
 * Co-sign an existing argument. Requires Tier 3+ and ZK proof.
 *
 * Body: { argumentIndex, stakeAmount, proofHex, publicInputs, nullifierHex }
 *
 * NOTE: In production, calls DebateMarket.coSignArgument() on-chain.
 * Currently stores off-chain only for frontend development.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { debateId } = params;

	// Check authentication
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const user = locals.user;
	if (!user || (user.trust_tier ?? 0) < 3) {
		throw error(403, 'Tier 3+ verification required to co-sign arguments');
	}

	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		select: { id: true, status: true, deadline: true }
	});

	if (!debate) {
		throw error(404, 'Debate not found');
	}
	if (debate.status !== 'active') {
		throw error(400, 'Debate is not active');
	}
	if (new Date() > debate.deadline) {
		throw error(400, 'Debate deadline has passed');
	}

	const body = await request.json();
	const { argumentIndex, stakeAmount, proofHex, publicInputs, nullifierHex } = body;

	if (argumentIndex === undefined || typeof argumentIndex !== 'number') {
		throw error(400, 'argumentIndex is required');
	}
	if (!stakeAmount || !proofHex || !publicInputs || !nullifierHex) {
		throw error(400, 'stakeAmount, proof data are required');
	}

	// Find the argument
	const argument = await prisma.debateArgument.findUnique({
		where: {
			debate_id_argument_index: {
				debate_id: debateId,
				argument_index: argumentIndex
			}
		}
	});

	if (!argument) {
		throw error(404, 'Argument not found');
	}

	// Update argument with co-sign data and debate totals atomically
	await prisma.$transaction([
		prisma.debateArgument.update({
			where: { id: argument.id },
			data: {
				co_sign_count: { increment: 1 },
				total_stake: { increment: BigInt(stakeAmount) },
				// Recompute weighted score with cumulative stake
				weighted_score: BigInt(
					Math.floor(
						Math.sqrt(Number(argument.total_stake + BigInt(stakeAmount)) / 1e6) *
							Math.pow(2, argument.engagement_tier) *
							1e6
					)
				)
			}
		}),
		prisma.debate.update({
			where: { id: debateId },
			data: {
				unique_participants: { increment: 1 },
				total_stake: { increment: BigInt(stakeAmount) }
			}
		})
	]);

	return json({ success: true });
};
