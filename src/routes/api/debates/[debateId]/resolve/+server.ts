import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * POST /api/debates/[debateId]/resolve
 *
 * Resolve a debate after its deadline has passed.
 * Determines the winning argument by highest weighted_score.
 *
 * NOTE: In production, calls DebateMarket.resolveDebate() on-chain.
 * Currently resolves off-chain only for frontend development.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { debateId } = params;

	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		include: {
			arguments: { orderBy: { weighted_score: 'desc' } }
		}
	});

	if (!debate) {
		throw error(404, 'Debate not found');
	}
	if (debate.status !== 'active') {
		throw error(400, 'Debate is already resolved');
	}
	if (new Date() <= debate.deadline) {
		throw error(400, 'Debate deadline has not passed yet');
	}
	if (debate.arguments.length === 0) {
		throw error(400, 'Cannot resolve a debate with no arguments');
	}

	// Winner is the argument with the highest weighted_score
	const winner = debate.arguments[0];

	const resolved = await prisma.debate.update({
		where: { id: debateId },
		data: {
			status: 'resolved',
			winning_argument_index: winner.argument_index,
			winning_stance: winner.stance,
			resolved_at: new Date()
		}
	});

	return json({
		debateId: resolved.id,
		status: 'resolved',
		winningArgumentIndex: resolved.winning_argument_index,
		winningStance: resolved.winning_stance,
		resolvedAt: resolved.resolved_at?.toISOString()
	});
};
