/**
 * Challenge Resolution Endpoint
 *
 * Resolves Carroll Mechanism challenges and distributes stakes/rewards
 * Implements quadratic reward scaling to prevent plutocracy
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReputationAgent, ImpactAgent } from '$lib/agents';
import { db } from '$lib/core/db';

const reputationAgent = new ReputationAgent();
const impactAgent = new ImpactAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			challengeId,
			resolution,
			evidenceUrls = [],
			resolverAddress, // Optional: multi-sig or DAO address that resolved
			consensusScore = 0 // 0-100 score from multiple agents
		} = body;

		if (!challengeId) {
			return json({ error: 'challengeId required' }, { status: 400 });
		}

		if (!resolution || !['upheld', 'rejected', 'partial'].includes(resolution)) {
			return json(
				{
					error: 'Invalid resolution',
					valid: ['upheld', 'rejected', 'partial']
				},
				{ status: 400 }
			);
		}

		// Fetch challenge data
		const challenge = await db.challenge.findUnique({
			where: { id: challengeId },
			include: {
				challenger: true,
				defender: true,
				stakes: {
					include: {
						user: true
					}
				}
			}
		});

		if (!challenge) {
			return json({ error: 'Challenge not found' }, { status: 404 });
		}

		if (challenge.status !== 'active') {
			return json(
				{
					error: 'Challenge already resolved',
					status: challenge.status
				},
				{ status: 400 }
			);
		}

		// Calculate payouts based on resolution
		const challengerStake = BigInt(challenge.stake_amount || 0);
		const claimCreatorStake = BigInt(challenge.claim?.creator_stake || challengerStake / BigInt(2));
		const totalPool = challengerStake + claimCreatorStake;

		let challengerPayout = BigInt(0);
		let creatorPayout = BigInt(0);
		const treasuryFee = totalPool / BigInt(20); // 5% to treasury

		// Apply quadratic scaling to prevent whale dominance
		const applyQuadraticScaling = (amount: bigint, reputation: number): bigint => {
			// Higher reputation = less scaling needed (more trusted)
			const scaleFactor = Math.sqrt(100 / Math.max(1, reputation));
			return BigInt(Math.floor(Number(amount) / scaleFactor));
		};

		const challengerRep = challenge.challenger?.reputation_score || 50;
		const creatorRep = challenge.claim?.creator?.reputation_score || 50;

		switch (resolution) {
			case 'upheld':
				// Challenge was correct, claim was false
				// Challenger gets their stake + creator's stake (minus fee)
				challengerPayout = totalPool - treasuryFee;
				// Apply quadratic bonus based on reputation
				challengerPayout = applyQuadraticScaling(challengerPayout, challengerRep);
				break;

			case 'rejected':
				// Challenge was wrong, claim was true
				// Creator gets challenger's stake (minus fee)
				creatorPayout = totalPool - treasuryFee;
				creatorPayout = applyQuadraticScaling(creatorPayout, creatorRep);
				break;

			case 'partial':
				// Both partially right
				// Return stakes minus fee
				challengerPayout = challengerStake - treasuryFee / BigInt(2);
				creatorPayout = claimCreatorStake - treasuryFee / BigInt(2);
				break;
		}

		// Update reputation scores
		const reputationChanges = {
			challenger: 0,
			creator: 0
		};

		if (resolution === 'upheld') {
			// Challenger was right
			reputationChanges.challenger = Math.min(10, Math.floor(10 * (consensusScore / 100)));
			reputationChanges.creator = -Math.min(5, Math.floor(5 * (consensusScore / 100)));

			// Update challenger reputation
			if (challenge.challenger_address) {
				await reputationAgent.makeDecision({
					userAddress: challenge.challenger_address,
					actionType: 'challenge_market',
					qualityScore: consensusScore,
					reputationChange: reputationChanges.challenger
				});
			}

			// Update creator reputation
			if (challenge.claim?.creator?.address) {
				await reputationAgent.makeDecision({
					userAddress: challenge.claim.creator.address,
					actionType: 'challenge_market',
					qualityScore: 100 - consensusScore,
					reputationChange: reputationChanges.creator
				});
			}
		} else if (resolution === 'rejected') {
			// Creator was right
			reputationChanges.challenger = -Math.min(10, Math.floor(10 * (consensusScore / 100)));
			reputationChanges.creator = Math.min(5, Math.floor(5 * (consensusScore / 100)));

			// Update reputations (opposite of above)
			if (challenge.challenger_address) {
				await reputationAgent.makeDecision({
					userAddress: challenge.challenger_address,
					actionType: 'challenge_market',
					qualityScore: 100 - consensusScore,
					reputationChange: reputationChanges.challenger
				});
			}

			if (challenge.claim?.creator?.address) {
				await reputationAgent.makeDecision({
					userAddress: challenge.claim.creator.address,
					actionType: 'challenge_market',
					qualityScore: consensusScore,
					reputationChange: reputationChanges.creator
				});
			}
		}

		// Measure impact of the resolution
		const impactResult = await impactAgent.makeDecision({
			actionType: 'challenge_market',
			recipients: [], // No direct recipients
			templateId: challenge.claim?.template_id,
			metadata: {
				challengeId,
				resolution,
				claimReach: challenge.claim?.template?.send_count || 0,
				truthValue: resolution === 'upheld' ? 'false_claim_stopped' : 'true_claim_defended'
			}
		});

		// Update challenge status in database
		await db.challenge.update({
			where: { id: challengeId },
			data: {
				status: 'resolved',
				resolution,
				resolution_consensus: consensusScore,
				challenger_payout: challengerPayout.toString(),
				creator_payout: creatorPayout.toString(),
				treasury_fee: treasuryFee.toString(),
				resolved_at: new Date(),
				resolver_address: resolverAddress
			}
		});

		// Update user balances
		if (challengerPayout > 0 && challenge.challenger_address) {
			const challenger = await db.user.findFirst({
				where: { wallet_address: challenge.challenger_id }
			});

			if (challenger) {
				await db.user.update({
					where: { id: challenger.id },
					data: {
						// Note: pending_rewards field doesn't exist in current schema
						trust_score: Math.max(
							0,
							Math.min(100, (challenger.trust_score || 50) + reputationChanges.challenger)
						)
					}
				});
			}
		}

		if (creatorPayout > 0 && challenge.defender_id) {
			const creator = await db.user.findFirst({
				where: { wallet_address: challenge.defender_id }
			});

			if (creator) {
				await db.user.update({
					where: { id: creator.id },
					data: {
						// Note: pending_rewards field doesn't exist in current schema  
						trust_score: Math.max(
							0,
							Math.min(100, (creator.trust_score || 50) + reputationChanges.creator)
						)
					}
				});
			}
		}

		// Prepare response
		return json({
			success: true,
			challengeId,
			resolution,
			consensusScore,
			payouts: {
				challenger: {
					amount: challengerPayout.toString(),
					formatted: `${Number(challengerPayout) / 10 ** 18} VOTER`,
					reputationChange: reputationChanges.challenger
				},
				creator: {
					amount: creatorPayout.toString(),
					formatted: `${Number(creatorPayout) / 10 ** 18} VOTER`,
					reputationChange: reputationChanges.creator
				},
				treasury: {
					amount: treasuryFee.toString(),
					formatted: `${Number(treasuryFee) / 10 ** 18} VOTER`
				}
			},
			impact: {
				score: impactResult.impactScore,
				multiplier: impactResult.impactMultiplier,
				description:
					resolution === 'upheld'
						? 'False claim prevented from spreading'
						: 'True claim defended against challenge'
			},
			quadraticFactors: {
				challengerReputation: challengerRep,
				creatorReputation: creatorRep,
				scalingApplied: true,
				note: 'Payouts scaled quadratically based on reputation to prevent plutocracy'
			},
			timestamp: new Date().toISOString()
		});
	} catch (_error) {
		console.error('Error:', _error);
		return json(
			{
				success: false,
				error: 'Challenge resolution failed',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// GET endpoint to check resolution status
export const GET: RequestHandler = async ({ url }) => {
	const challengeId = url.searchParams.get('challengeId');

	if (!challengeId) {
		return json({ error: 'challengeId required' }, { status: 400 });
	}

	const challenge = await db.challenge?.findUnique({
		where: { id: challengeId },
		include: {
			claim: true,
			challenger: true,
			verification: true
		}
	});

	if (!challenge) {
		return json({ error: 'Challenge not found' }, { status: 404 });
	}

	return json({
		challengeId,
		status: challenge.status,
		resolution: challenge.resolution,
		consensusScore: challenge.resolution_consensus,
		payouts:
			challenge.status === 'resolved'
				? {
						challenger: challenge.challenger_payout,
						creator: challenge.creator_payout,
						treasury: challenge.treasury_fee
					}
				: null,
		resolvedAt: challenge.resolved_at,
		claimId: challenge.claim_id,
		challengerAddress: challenge.challenger_address
	});
};
