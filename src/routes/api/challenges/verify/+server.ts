/**
 * Challenge Verification Endpoint
 *
 * Verifies claims in Carroll Mechanism challenge markets
 * Different from template verification - focuses on factual accuracy
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VerificationAgent, MarketAgent, ReputationAgent } from '$lib/agents';
import { db } from '$lib/core/db';

const verificationAgent = new VerificationAgent();
const marketAgent = new MarketAgent();
const reputationAgent = new ReputationAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			challengeId,
			claimId,
			claimContent,
			challengerAddress,
			challengeReason,
			evidenceUrls = [],
			stakeAmount
		} = body;

		// Validate required fields
		if (!claimContent && !claimId) {
			return json(
				{
					error: 'Either claimContent or claimId required'
				},
				{ status: 400 }
			);
		}

		if (!challengerAddress) {
			return json(
				{
					error: 'challengerAddress required for challenge verification'
				},
				{ status: 400 }
			);
		}

		// Fetch claim from database if ID provided
		let claim = { content: claimContent };
		if (claimId) {
			const dbClaim = await db.claim?.findUnique({
				where: { id: claimId },
				include: {
					template: true,
					creator: true
				}
			});

			if (dbClaim) {
				claim = {
					...dbClaim,
					content: dbClaim.content || claimContent
				};
			}
		}

		// Verify the claim using specialized challenge verification
		const verificationResult = await verificationAgent.process({
			template: {
				message_body: claim.content,
				subject: `Challenge: ${challengeReason || 'Factual accuracy dispute'}`
			},
			checkGrammar: false, // Don't care about grammar in challenges
			checkPolicy: false, // Focus on factual accuracy
			checkFactuality: true, // This would be a new parameter
			evidenceUrls
		});

		// Get challenger reputation
		const challengerRep = await reputationAgent.process({
			userAddress: challengerAddress,
			actionType: 'challenge_market',
			qualityScore: 0 // Not scoring yet, just getting current rep
		});

		// Calculate required stake based on:
		// 1. Claim creator's reputation
		// 2. Challenger's reputation
		// 3. Claim impact/reach
		// 4. Network conditions
		const marketConditions = await marketAgent.process({
			baseReward: BigInt(stakeAmount || 1000),
			actionType: 'challenge_market',
			challengerReputation: challengerRep.currentScore,
			claimCreatorReputation: claim.creator?.reputation_score || 50,
			claimImpact: claim.template?.send_count || 1
		});

		// Determine verification outcome
		const factualityScore = verificationResult.confidence * 100;
		const challengeValid = factualityScore < 50; // Claim is false if low factuality

		// Calculate stake requirements
		const baseStake = BigInt(1000 * 10 ** 18); // 1000 VOTER base
		let requiredStake = baseStake;

		// Adjust stake based on reputation differential
		const repDiff = (claim.creator?.reputation_score || 50) - challengerRep.currentScore;
		if (repDiff > 20) {
			// Challenging high-rep creator requires more stake
			requiredStake = requiredStake * BigInt(2);
		} else if (repDiff < -20) {
			// High-rep challenger needs less stake
			requiredStake = requiredStake / BigInt(2);
		}

		// Adjust for claim impact
		if (claim.template?.send_count > 1000) {
			requiredStake = requiredStake * BigInt(Math.min(10, claim.template.send_count / 1000));
		}

		// Apply market multiplier
		requiredStake = BigInt(Math.floor(Number(requiredStake) * marketConditions.rewardMultiplier));

		// Store challenge verification if challengeId provided
		if (challengeId) {
			await db.challengeVerification?.upsert({
				where: { challenge_id: challengeId },
				update: {
					factuality_score: factualityScore,
					verification_result: verificationResult,
					challenge_valid: challengeValid,
					required_stake: requiredStake.toString(),
					verified_at: new Date()
				},
				create: {
					challenge_id: challengeId,
					claim_id: claimId,
					factuality_score: factualityScore,
					verification_result: verificationResult,
					challenge_valid: challengeValid,
					required_stake: requiredStake.toString()
				}
			});
		}

		return json({
			success: true,
			challengeId,
			verification: {
				factualityScore,
				challengeValid,
				confidence: verificationResult.confidence,
				reasoning: verificationResult.reasoning,
				evidenceAnalysis: verificationResult.corrections // Repurpose corrections for evidence
			},
			staking: {
				requiredStake: requiredStake.toString(),
				requiredStakeFormatted: `${Number(requiredStake) / 10 ** 18} VOTER`,
				providedStake: stakeAmount?.toString(),
				sufficient: stakeAmount ? BigInt(stakeAmount) >= requiredStake : false,
				factors: {
					reputationDifferential: repDiff,
					claimImpact: claim.template?.send_count || 0,
					marketMultiplier: marketConditions.rewardMultiplier
				}
			},
			reputation: {
				challenger: {
					current: challengerRep.currentScore,
					tier: challengerRep.currentTier,
					atRisk: Math.floor(challengerRep.currentScore * 0.1) // 10% of rep at risk
				},
				claimCreator: {
					current: claim.creator?.reputation_score || 50,
					tier: claim.creator?.reputation_tier || 'novice',
					atRisk: Math.floor((claim.creator?.reputation_score || 50) * 0.05) // 5% at risk
				}
			}
		});
	} catch (error) {
		console.error('Challenge verification error:', error);
		return json(
			{
				success: false,
				error: 'Challenge verification failed',
				details: error.message
			},
			{ status: 500 }
		);
	}
};

// GET endpoint for challenge market status
export const GET: RequestHandler = async ({ url }) => {
	const challengeId = url.searchParams.get('challengeId');

	if (challengeId) {
		const challenge = await db.challengeVerification?.findUnique({
			where: { challenge_id: challengeId },
			include: {
				challenge: true,
				claim: true
			}
		});

		if (!challenge) {
			return json({ error: 'Challenge not found' }, { status: 404 });
		}

		return json({
			challengeId,
			status: challenge.challenge?.status || 'pending',
			factualityScore: challenge.factuality_score,
			challengeValid: challenge.challenge_valid,
			requiredStake: challenge.required_stake,
			verifiedAt: challenge.verified_at
		});
	}

	// Return general market stats
	const activeCount = await db.challenge?.count({
		where: { status: 'active' }
	});

	const totalStaked = await db.challenge?.aggregate({
		where: { status: 'active' },
		_sum: { stake_amount: true }
	});

	return json({
		marketStatus: 'active',
		activeChallenges: activeCount || 0,
		totalStaked: totalStaked?._sum?.stake_amount?.toString() || '0',
		message: 'Carroll Mechanism challenge market operational'
	});
};
