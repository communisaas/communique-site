import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { solidityPackedKeccak256 } from 'ethers';

/**
 * GET /api/debates/[debateId]/arguments
 *
 * List arguments for a debate, sorted by weighted score.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { debateId } = params;

	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		select: { id: true }
	});

	if (!debate) {
		throw error(404, 'Debate not found');
	}

	const stance = url.searchParams.get('stance');
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
	const offset = parseInt(url.searchParams.get('offset') ?? '0');

	const where: Record<string, unknown> = { debate_id: debateId };
	if (stance && ['SUPPORT', 'OPPOSE', 'AMEND'].includes(stance)) {
		where.stance = stance;
	}

	const arguments_ = await prisma.debateArgument.findMany({
		where,
		orderBy: { weighted_score: 'desc' },
		take: limit,
		skip: offset
	});

	return json({
		arguments: arguments_.map((arg) => ({
			id: arg.id,
			argumentIndex: arg.argument_index,
			stance: arg.stance,
			body: arg.body,
			amendmentText: arg.amendment_text,
			stakeAmount: arg.stake_amount.toString(),
			engagementTier: arg.engagement_tier,
			weightedScore: arg.weighted_score.toString(),
			totalStake: arg.total_stake.toString(),
			coSignCount: arg.co_sign_count,
			createdAt: arg.created_at.toISOString()
		}))
	});
};

/**
 * POST /api/debates/[debateId]/arguments
 *
 * Submit a new argument to a debate. Requires Tier 3+ and ZK proof.
 *
 * Body: { stance, body, amendmentText?, stakeAmount, proofHex, publicInputs, nullifierHex }
 *
 * NOTE: In production, calls DebateMarket.submitArgument() on-chain.
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
		throw error(403, 'Tier 3+ verification required to submit arguments');
	}

	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		select: { id: true, status: true, argument_count: true, deadline: true }
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
	const { stance, body: argumentBody, amendmentText, stakeAmount, proofHex, publicInputs, nullifierHex } = body;

	// Validate stance
	if (!['SUPPORT', 'OPPOSE', 'AMEND'].includes(stance)) {
		throw error(400, 'stance must be SUPPORT, OPPOSE, or AMEND');
	}
	if (!argumentBody || typeof argumentBody !== 'string' || argumentBody.length < 20) {
		throw error(400, 'Argument body must be at least 20 characters');
	}
	if (stance === 'AMEND' && (!amendmentText || amendmentText.length < 5)) {
		throw error(400, 'Amendment text is required for AMEND stance');
	}
	if (!proofHex || !publicInputs || !nullifierHex) {
		throw error(400, 'ZK proof data is required');
	}

	// Compute content hashes
	const bodyHash = solidityPackedKeccak256(['string'], [argumentBody]);
	const amendmentHash = amendmentText
		? solidityPackedKeccak256(['string'], [amendmentText])
		: null;

	// Compute weighted score: sqrt(stake) * 2^tier
	const stakeInDollars = Number(stakeAmount) / 1e6;
	const tier = user.trust_tier ?? 0;
	const weightedScore = Math.floor(Math.sqrt(stakeInDollars) * Math.pow(2, tier) * 1e6);

	const argumentIndex = debate.argument_count;

	// Create argument and update debate counts atomically
	const [argument] = await prisma.$transaction([
		prisma.debateArgument.create({
			data: {
				debate_id: debateId,
				argument_index: argumentIndex,
				stance,
				body: argumentBody,
				body_hash: bodyHash,
				amendment_text: amendmentText || null,
				amendment_hash: amendmentHash,
				stake_amount: BigInt(stakeAmount),
				engagement_tier: tier,
				weighted_score: BigInt(weightedScore),
				total_stake: BigInt(stakeAmount)
			}
		}),
		prisma.debate.update({
			where: { id: debateId },
			data: {
				argument_count: { increment: 1 },
				unique_participants: { increment: 1 },
				total_stake: { increment: BigInt(stakeAmount) }
			}
		})
	]);

	return json({
		argumentId: argument.id,
		argumentIndex: argument.argument_index,
		weightedScore: argument.weighted_score.toString()
	});
};
