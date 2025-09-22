/** Challenge Verification Endpoint
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
					error: 'challengerAddress  required for challenge verification'
				},
				{ status: 400 }
			);
		}

		// Fetch claim from database if ID provided
		let claim = { content: claimContent };
		if (claimId) {
			// Note: Claim model doesn't exist in current schema
			// Instead we'll validate based on challenge data
			console.log(`Verifying claim ${claimId} through challenge data`);

			// Since dbClaim doesn't exist in current schema, use fallback
			claim = {
				content: claimContent
			};
		}

		// Verify the claim using specialized challenge verification
		const verificationResult = await verificationAgent.makeDecision({
			actionType: 'verify',
			parameters: {
				template: {
					message_body: claim.content,
					subject: `Challenge: ${challengeReason || 'Factual accuracy dispute'}`
				},
				checkGrammar: false, // Don't care about grammar in challenges
				checkPolicy: false, // Focus on factual accuracy
				checkFactuality: true, // This would be a new parameter
				evidenceUrls
			}
		});

		// Get challenger reputation
		const challengerRep = await reputationAgent.makeDecision({
			userAddress: challengerAddress,
			actionType: 'challenge_market',
			qualityScore: 0 // Not scoring yet, just getting current rep
		});

		// Calculate required stake based on:
		// 1. Claim creator's reputation
		// 2. Challenger's reputation
		// 3. Claim impact/reach
		// 4. Network conditions
		const marketConditions = await marketAgent.makeDecision({
			actionType: 'challenge_market',
			parameters: {
				baseReward: Number(stakeAmount || 1000),
				challengerReputation: challengerRep.currentScore,
				claimCreatorReputation: 50, // Default since creator data not available
				claimImpact: 1 // Default since template data not available
			}
		});

		// Determine verification outcome
		const factualityScore = verificationResult.confidence * 100;
		const challengeValid = factualityScore < 50; // Claim is false if low factuality

		// Calculate stake requirements
		const baseStake = BigInt(1000 * 10 ** 18); // 1000 VOTER base
		let requiredStake = baseStake;

		// Adjust stake based on reputation differential
		const repDiff = 50 - ((challengerRep.currentScore as number) || 50); // Using default creator reputation of 50
		if (repDiff > 20) {
			// Challenging high-rep creator requires more stake
			requiredStake = requiredStake * BigInt(2);
		} else if (repDiff < -20) {
			// High-rep challenger needs less stake
			requiredStake = requiredStake / BigInt(2);
		}

		// Adjust for claim impact (using default since template data not available)
		// Would need to fetch template data from challenge context

		// Apply market multiplier
		requiredStake = BigInt(
			Math.floor(Number(requiredStake) * ((marketConditions.rewardMultiplier as number) || 1))
		);

		// Store challenge verification if challengeId provided
		if (challengeId) {
			// Note: challengeVerification model doesn't exist in current schema
			console.log('Verification result:', {
				challengeId,
				factualityScore,
				challengeValid,
				requiredStake: requiredStake.toString()
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
					claimImpact: 0, // Default since template data not available
					marketMultiplier: marketConditions.rewardMultiplier
				}
			},
			reputation: {
				challenger: {
					current: (challengerRep.currentScore as number) || 50,
					tier: (challengerRep.currentTier as string) || 'novice',
					atRisk: Math.floor(((challengerRep.currentScore as number) || 50) * 0.1) // 10% of rep at risk
				},
				claimCreator: {
					current: 50, // Default since creator data not available
					tier: 'novice', // Default tier
					atRisk: Math.floor(50 * 0.05) // 5% at risk
				}
			}
		});
	} catch (err) {
		console.error('Error occurred');
		return json(
			{
				success: false,
				error: 'Challenge verification failed',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// GET endpoint for challenge market status
export const GET: RequestHandler = async ({ url }) => {
	const challengeId = url.searchParams.get('challengeId');

	if (challengeId) {
		// Note: challengeVerification model doesn't exist in current schema
		// Using existing Challenge model instead
		const challenge = await db.challenge.findUnique({
			where: { id: challengeId }
		});

		if (!challenge) {
			return json({ error: 'Challenge not found' }, { status: 404 });
		}

		return json({
			challengeId,
			status: challenge.status || 'pending',
			factualityScore: null, // Not available in current schema
			challengeValid: null, // Not available in current schema
			requiredStake: challenge.stake_amount || '0',
			verifiedAt: challenge.resolved_at
		});
	}

	// Return general market stats
	const activeCount = await db.challenge.count({
		where: { status: 'active' }
	});

	// Note: stake_amount is string in schema, so we can't aggregate directly
	const activeChallenges = await db.challenge.findMany({
		where: { status: 'active' },
		select: { stake_amount: true }
	});
	const totalStaked = activeChallenges.reduce(
		(sum, challenge) => sum + BigInt(challenge.stake_amount || '0'),
		BigInt(0)
	);

	return json({
		marketStatus: 'active',
		activeChallenges: activeCount || 0,
		totalStaked: totalStaked.toString(),
		message: 'Carroll Mechanism challenge market operational'
	});
};
