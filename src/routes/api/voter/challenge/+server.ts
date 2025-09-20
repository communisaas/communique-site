/** VOTER Protocol Challenge Market API
 *
 * Handles challenge creation, voting, and resolution
 * Called by N8N challenge market workflow
 */

import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/core/db.js';
import type { RequestHandler } from './$types';
import type { Prisma } from '@prisma/client';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const requestData: unknown = await request.json();
		
		// Type guard for request data
		const isValidRequestData = (obj: unknown): obj is {
			action: string;
			[key: string]: unknown;
		} => {
			return (
				typeof obj === 'object' &&
				obj !== null &&
				'action' in obj &&
				typeof (obj as any).action === 'string'
			);
		};

		if (!isValidRequestData(requestData)) {
			throw error(400, 'Invalid request data format');
		}

		const { action, ...data } = requestData;

		switch (action) {
			case 'create':
				return await createChallenge(data);
			case 'vote':
				return await voteOnChallenge(data);
			case 'resolve':
				return await resolveChallenge(data);
			case 'claim':
				return await claimRewards(data);
			default:
				throw error(400, `Invalid challenge action: ${action}`);
		}
	} catch (_error) {
		console.error('Challenge API error:', _error);
		throw error(500, _error instanceof Error ? _error.message : 'Challenge operation failed');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const challengeId = url.searchParams.get('id');
		const status = url.searchParams.get('status');
		const userId = url.searchParams.get('userId');

		if (challengeId) {
			// Get specific challenge with vote tallies
			const challenge = await prisma.challenge.findUnique({
				where: { id: challengeId },
				include: {
					challenger: {
						select: { id: true, name: true, reputation_tier: true }
					},
					defender: {
						select: { id: true, name: true, reputation_tier: true }
					},
					winner: {
						select: { id: true, name: true }
					},
					stakes: {
						include: {
							user: {
								select: { id: true, name: true }
							}
						}
					}
				}
			});

			if (!challenge) {
				throw error(404, 'Challenge not found');
			}

			// Calculate vote tallies
			const supportPower = challenge.stakes
				.filter((s) => s.side === 'support')
				.reduce((sum, s) => sum + s.voting_power, 0);

			const opposePower = challenge.stakes
				.filter((s) => s.side === 'oppose')
				.reduce((sum, s) => sum + s.voting_power, 0);

			return json({
				success: true,
				challenge: {
					...challenge,
					vote_tally: {
						support_power: supportPower,
						oppose_power: opposePower,
						total_power: supportPower + opposePower,
						total_voters: challenge.stakes.length
					}
				}
			});
		}

		// List challenges with filters
		const where: Record<string, unknown> = {};
		if (status) {
			(where as any).status = status;
		}
		if (userId) {
			(where as any).OR = [
				{ challenger_id: userId },
				{ defender_id: userId },
				{ stakes: { some: { user_id: userId } } }
			];
		}

		const challenges = await prisma.challenge.findMany({
			where,
			include: {
				challenger: { select: { name: true } },
				defender: { select: { name: true } },
				_count: { select: { stakes: true } }
			},
			orderBy: { created_at: 'desc' },
			take: 50
		});

		return json({
			success: true,
			challenges: challenges.map((c) => ({
				id: c.id,
				title: c.title,
				status: c.status,
				challenger: c.challenger.name,
				defender: c.defender.name,
				stake_amount: c.stake_amount,
				voting_deadline: c.voting_deadline,
				votes_count: c._count.stakes,
				created_at: c.created_at
			}))
		});
	} catch (_error) {
		console.error('Get challenges error:', _error);
		throw error(500, _error instanceof Error ? _error.message : 'Failed to get challenges');
	}
};

/**
 * Create new challenge
 */
async function createChallenge(data: Record<string, unknown>) {
	const {
		challengerId,
		defenderId,
		title,
		description,
		evidence,
		stakeAmount,
		category
	} = data;
	if (!challengerId || !defenderId || !title || !evidence || !stakeAmount) {
		throw error(400, 'Missing required fields for challenge creation');
	}

	// Type assertions after validation
	const challengerIdStr = challengerId as string;
	const defenderIdStr = defenderId as string;
	const titleStr = title as string;
	const evidenceStr = evidence as string;
	const stakeAmountStr = stakeAmount as string;

	// Validate stake amount (10-10,000 VOTER tokens)
	const stake = parseFloat(stakeAmountStr);
	if (stake < 10 || stake > 10000) {
		throw error(400, 'Stake amount must be between 10 and 10,000 VOTER tokens');
	}

	// Verify users exist
	const [challenger, defender] = await Promise.all([
		prisma.user.findUnique({ where: { id: challengerIdStr } }),
		prisma.user.findUnique({ where: { id: defenderIdStr } })
	]);

	if (!challenger || !defender) {
		throw error(404, 'Challenger or defender not found');
	}

	// Check challenger has sufficient trust score to create challenges
	if (challenger.trust_score < 60) {
		throw error(403, 'Insufficient trust score to create challenges (minimum 60 required)');
	}

	// Generate challenge ID and claim hash
	const challengeId = `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const claimHash = `0x${Buffer.from(challengeId).toString('hex')}`;

	// Set voting deadline (72 hours from now)
	const votingDeadline = new Date();
	votingDeadline.setHours(votingDeadline.getHours() + 72);

	// Create challenge in database via main API
	const response = await fetch(`${process.env.ORIGIN}/api/voter`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'create_challenge',
			challengerId: challengerIdStr,
			defenderId: defenderIdStr,
			title: titleStr,
			description,
			evidenceIPFS: evidenceStr,
			stakeAmount: stakeAmountStr,
			category
		})
	});

	if (!response.ok) {
		throw error(500, 'Failed to create challenge');
	}

	const result = await response.json();

	// Log challenge creation in audit system
	await prisma.auditLog.create({
		data: {
			user_id: challengerIdStr,
			action_type: 'civic_action',
			action_subtype: 'challenge_create',
			audit_data: {
				challenge_id: result.challengeId,
				defender_id: defenderIdStr,
				title: titleStr,
				description: description as any,
				evidence_ipfs: evidenceStr,
				stake_amount: stakeAmountStr,
				category: category as any,
				voting_deadline: result.votingDeadline
			},
			status: 'completed'
		}
	});

	return json({
		success: true,
		challengeId: result.challengeId,
		claimHash: result.claimHash,
		stake: stake,
		influence: Math.sqrt(stake), // Quadratic scaling
		status: 'active',
		votingDeadline: result.votingDeadline,
		message: 'Challenge created successfully'
	});
}

/**
 * Vote on challenge with quadratic voting
 */
async function voteOnChallenge(data: Record<string, unknown>) {
	const { challengeId, userId, vote, stakeAmount } = data;
	if (!challengeId || !userId || !vote || !stakeAmount) {
		throw error(400, 'Missing required fields for challenge vote');
	}

	// Type assertions after validation
	const challengeIdStr = challengeId as string;
	const userIdStr = userId as string;
	const voteStr = vote as string;
	const stakeAmountStr = stakeAmount as string;

	// Validate vote
	if (!['support', 'oppose'].includes(voteStr)) {
		throw error(400, 'Vote must be either "support" or "oppose"');
	}

	// Validate stake amount
	const stake = parseFloat(stakeAmountStr);
	if (stake < 1) {
		throw error(400, 'Minimum stake is 1 VOTER token');
	}

	// Check challenge exists and is still active
	const challenge = await prisma.challenge.findUnique({
		where: { id: challengeIdStr },
		select: {
			status: true,
			voting_deadline: true,
			challenger_id: true,
			defender_id: true
		}
	});

	if (!challenge) {
		throw error(404, 'Challenge not found');
	}

	if (challenge.status !== 'active') {
		throw error(400, 'Challenge is no longer active');
	}

	if (new Date() > challenge.voting_deadline) {
		throw error(400, 'Voting deadline has passed');
	}

	// Prevent self-voting
	if (userIdStr === challenge.challenger_id || userIdStr === challenge.defender_id) {
		throw error(403, 'Challenge participants cannot vote on their own challenge');
	}

	// Record vote via main API
	const response = await fetch(`${process.env.ORIGIN}/api/voter`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'process_challenge_vote',
			challengeId: challengeIdStr,
			userId: userIdStr,
			side: voteStr,
			stakeAmount: stakeAmountStr
		})
	});

	if (!response.ok) {
		throw error(500, 'Failed to record vote');
	}

	const result = await response.json();

	// Log challenge vote in audit system
	await prisma.auditLog.create({
		data: {
			user_id: userIdStr,
			action_type: 'civic_action',
			action_subtype: 'challenge_vote',
			audit_data: {
				challenge_id: challengeIdStr,
				vote: voteStr,
				stake_amount: stakeAmountStr,
				voting_power: result.votingPower
			},
			status: 'completed'
		}
	});

	return json({
		success: true,
		challengeId: challengeIdStr,
		voter: userIdStr,
		vote: voteStr,
		stake: stake,
		votingPower: result.votingPower,
		timestamp: new Date().toISOString(),
		message: `Vote recorded: ${voteStr} with ${result.votingPower.toFixed(2)} voting power`
	});
}

/**
 * Resolve challenge based on votes
 */
async function resolveChallenge(data: Record<string, unknown>) {
	const { challengeId } = data;
	if (!challengeId) {
		throw error(400, 'Missing challengeId');
	}

	// Type assertion after validation
	const challengeIdStr = challengeId as string;

	const challenge = await prisma.challenge.findUnique({
		where: { id: challengeIdStr },
		include: {
			stakes: true,
			challenger: { select: { name: true } },
			defender: { select: { name: true } }
		}
	});

	if (!challenge) {
		throw error(404, 'Challenge not found');
	}

	// Check if voting period has ended
	const votingEnded = new Date() > challenge.voting_deadline;
	if (!votingEnded) {
		throw error(400, 'Voting period has not ended');
	}

	if (challenge.status !== 'active') {
		throw error(400, 'Challenge is not in active status');
	}

	// Calculate vote tallies
	const supportPower = challenge.stakes
		.filter((s) => s.side === 'support')
		.reduce((sum, s) => sum + s.voting_power, 0);

	const opposePower = challenge.stakes
		.filter((s) => s.side === 'oppose')
		.reduce((sum, s) => sum + s.voting_power, 0);

	const totalVoters = challenge.stakes.length;
	const totalPower = supportPower + opposePower;

	// Require minimum participation (5 voters)
	if (totalVoters < 5) {
		await prisma.challenge.update({
			where: { id: challengeIdStr },
			data: {
				status: 'cancelled',
				resolved_at: new Date(),
				resolution: 'insufficient_participation'
			}
		});

		return json({
			success: true,
			status: 'cancelled',
			reason: 'insufficient_participation',
			supportPower,
			opposePower,
			totalVoters,
			message: 'Challenge cancelled due to insufficient participation'
		});
	}

	// Determine outcome (60% threshold for challenge to succeed)
	const challengeSucceeds = supportPower > opposePower * 1.5;
	const resolution = challengeSucceeds ? 'challenger_wins' : 'defender_wins';
	const winnerId = challengeSucceeds ? challenge.challenger_id : challenge.defender_id;

	// Update challenge status
	await prisma.challenge.update({
		where: { id: challengeIdStr },
		data: {
			status: 'resolved',
			resolution,
			winner_id: winnerId,
			resolved_at: new Date()
		}
	});

	// Calculate reward distribution
	const challengerStake = parseFloat(challenge.stake_amount);
	let rewards: Record<string, number> = {};

	if (challengeSucceeds) {
		// Challenge succeeded - distribute stakes to supporters
		rewards = {
			challenger_reward: challengerStake * 0.3,
			supporter_pool: challengerStake * 0.6,
			treasury: challengerStake * 0.1
		};
	} else {
		// Challenge failed - distribute challenger stake to opposers
		rewards = {
			defender_reward: challengerStake * 0.3,
			opposer_pool: challengerStake * 0.6,
			treasury: challengerStake * 0.1
		};
	}

	// Log challenge resolution in audit system
	await prisma.auditLog.create({
		data: {
			user_id: winnerId,
			action_type: 'civic_action',
			action_subtype: 'challenge_resolve',
			audit_data: {
				challenge_id: challengeIdStr,
				resolution,
				support_power: supportPower,
				oppose_power: opposePower,
				total_voters: totalVoters,
				total_power: totalPower,
				rewards
			},
			status: 'completed'
		}
	});

	return json({
		success: true,
		challengeId,
		status: 'resolved',
		resolution,
		winner: challengeSucceeds ? challenge.challenger.name : challenge.defender.name,
		supportPower,
		opposePower,
		totalPower,
		totalVoters,
		unanimous: supportPower === 0 || opposePower === 0,
		rewards,
		resolved_at: new Date().toISOString(),
		message: `Challenge resolved: ${resolution}`
	});
}

/**
 * Claim rewards for challenge participants
 */
async function claimRewards(data: Record<string, unknown>) {
	const { challengeId, userId } = data;
	if (!challengeId || !userId) {
		throw error(400, 'Missing challengeId or userId');
	}

	// Type assertions after validation
	const challengeIdStr = challengeId as string;
	const userIdStr = userId as string;

	const challenge = await prisma.challenge.findUnique({
		where: { id: challengeIdStr },
		include: {
			stakes: {
				where: { user_id: userIdStr },
				include: { user: { select: { name: true } } }
			}
		}
	});

	if (!challenge) {
		throw error(404, 'Challenge not found');
	}

	if (challenge.status !== 'resolved') {
		throw error(400, 'Challenge is not resolved yet');
	}

	const userStake = challenge.stakes[0];
	if (!userStake) {
		throw error(404, 'User did not participate in this challenge');
	}

	if (userStake.claimed) {
		throw error(400, 'Rewards already claimed');
	}

	// Check if user was on winning side
	const wasWinner =
		(challenge.resolution === 'challenger_wins' && userStake.side === 'support') ||
		(challenge.resolution === 'defender_wins' && userStake.side === 'oppose');

	if (!wasWinner) {
		throw error(400, 'User was not on winning side');
	}

	// Calculate individual reward (proportional to voting power)
	// This is a simplified calculation - in production would need more complex logic
	const totalWinningPower = challenge.stakes
		.filter(
			(s) =>
				(challenge.resolution === 'challenger_wins' && s.side === 'support') ||
				(challenge.resolution === 'defender_wins' && s.side === 'oppose')
		)
		.reduce((sum, s) => sum + s.voting_power, 0);

	const challengerStake = parseFloat(challenge.stake_amount);
	const rewardPool = challengerStake * 0.6; // 60% goes to winning voters
	const individualReward = (userStake.voting_power / totalWinningPower) * rewardPool;

	// Mark stake as claimed
	await prisma.challengeStake.update({
		where: { id: userStake.id },
		data: {
			claimed: true,
			claimed_at: new Date()
		}
	});

	return json({
		success: true,
		challengeId,
		userId,
		reward: individualReward,
		reward_wei: Math.floor(individualReward * 1e18).toString(),
		claimed_at: new Date().toISOString(),
		message: `Reward claimed: ${individualReward.toFixed(4)} VOTER tokens`
	});
}
