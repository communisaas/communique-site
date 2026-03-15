import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/core/db';

/**
 * POST /api/debates/[debateId]/subnet-evaluate
 *
 * Accepts pre-computed evaluation results from the Bittensor subnet bridge.
 * This is the decentralized alternative to the centralized 5-model AI panel
 * at /evaluate — scores are computed by subnet miners and aggregated by
 * the bridge before being posted here.
 *
 * Auth: CRON_SECRET or SUBNET_API_KEY via Bearer token.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const { debateId } = params;

	// Auth: CRON_SECRET or SUBNET_API_KEY
	const authHeader = request.headers.get('Authorization');
	const cronSecret = env.CRON_SECRET;
	const subnetKey = env.SUBNET_API_KEY;

	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token || (token !== cronSecret && token !== subnetKey)) {
		throw error(403, 'Unauthorized: valid CRON_SECRET or SUBNET_API_KEY required');
	}

	// Parse and validate request body
	let body: {
		argumentScores: Array<{
			argumentIndex: number;
			medianScores: {
				reasoning: number;
				accuracy: number;
				evidence: number;
				constructiveness: number;
				feasibility: number;
			};
			weightedScore: number;
			modelAgreement: number;
		}>;
		minerCount: number;
		consensusAchieved: boolean;
	};

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!Array.isArray(body.argumentScores) || body.argumentScores.length === 0) {
		throw error(400, 'argumentScores must be a non-empty array');
	}
	if (typeof body.minerCount !== 'number' || body.minerCount < 1) {
		throw error(400, 'minerCount must be a positive number');
	}
	if (typeof body.consensusAchieved !== 'boolean') {
		throw error(400, 'consensusAchieved must be a boolean');
	}

	// Validate each argument score entry
	for (const as of body.argumentScores) {
		if (typeof as.argumentIndex !== 'number') {
			throw error(400, 'Each argumentScore must have a numeric argumentIndex');
		}
		if (typeof as.weightedScore !== 'number') {
			throw error(400, 'Each argumentScore must have a numeric weightedScore');
		}
		if (typeof as.modelAgreement !== 'number') {
			throw error(400, 'Each argumentScore must have a numeric modelAgreement');
		}
		const scores = as.medianScores;
		if (
			!scores ||
			typeof scores.reasoning !== 'number' ||
			typeof scores.accuracy !== 'number' ||
			typeof scores.evidence !== 'number' ||
			typeof scores.constructiveness !== 'number' ||
			typeof scores.feasibility !== 'number'
		) {
			throw error(400, 'Each argumentScore must have medianScores with reasoning, accuracy, evidence, constructiveness, feasibility');
		}
	}

	// Look up debate
	const debate = await prisma.debate.findUnique({
		where: { id: debateId },
		select: {
			id: true,
			status: true,
			arguments: {
				where: { verification_status: 'verified' },
				orderBy: { argument_index: 'asc' },
				select: {
					argument_index: true
				}
			}
		}
	});

	if (!debate) {
		throw error(404, 'Debate not found');
	}
	if (debate.status !== 'active' && debate.status !== 'resolving') {
		throw error(400, `Debate is not active (status: ${debate.status})`);
	}

	// Update each argument with subnet scores
	// NOTE: final_score uses AI weighted score directly (0-10000 bp), matching
	// the existing /evaluate endpoint. Community weighted_score is on a different
	// scale (sqrt(stake) * 2^tier) and cannot be alpha-blended without normalization.
	// On-chain resolution in DebateMarket.resolveDebateWithAI() handles the actual
	// blending using normalized LMSR position weights.
	const updated: Array<{ argumentIndex: number; finalScore: number }> = [];

	for (const as of body.argumentScores) {
		const finalScore = as.weightedScore;

		await prisma.debateArgument.updateMany({
			where: {
				debate_id: debateId,
				argument_index: as.argumentIndex
			},
			data: {
				ai_scores: as.medianScores as object,
				ai_weighted: as.weightedScore,
				model_agreement: as.modelAgreement,
				final_score: finalScore
			}
		});

		updated.push({ argumentIndex: as.argumentIndex, finalScore });
	}

	// Determine winner (highest final score)
	let winnerIndex = 0;
	let bestScore = 0;
	for (const u of updated) {
		if (u.finalScore > bestScore) {
			bestScore = u.finalScore;
			winnerIndex = u.argumentIndex;
		}
	}

	// Overall consensus from subnet
	const overallAgreement =
		body.argumentScores.reduce((sum, a) => sum + a.modelAgreement, 0) /
		body.argumentScores.length;

	// Update debate with subnet resolution data
	const newStatus = body.consensusAchieved ? 'resolved' : 'awaiting_governance';

	await prisma.debate.update({
		where: { id: debateId },
		data: {
			status: newStatus,
			ai_resolution: {
				source: 'bittensor_subnet',
				scores: body.argumentScores,
				minerCount: body.minerCount,
				consensusAchieved: body.consensusAchieved,
				evaluatedAt: new Date().toISOString()
			} as object,
			ai_panel_consensus: overallAgreement,
			resolution_method: 'ai_community',
			...(body.consensusAchieved
				? {
						winning_argument_index: winnerIndex,
						resolved_at: new Date()
					}
				: {})
		}
	});

	return json({
		debateId,
		status: newStatus,
		resolutionMethod: 'ai_community',
		source: 'bittensor_subnet',
		minerCount: body.minerCount,
		consensusAchieved: body.consensusAchieved,
		panelConsensus: overallAgreement,
		winningArgumentIndex: body.consensusAchieved ? winnerIndex : undefined,
		argumentsUpdated: updated.length
	});
};
