/**
 * Reputation Update API Endpoint
 *
 * Updates user reputation based on actions
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReputationAgent } from '$lib/agents';
import { db } from '$lib/core/db';

const reputationAgent = new ReputationAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userAddress, actionType, qualityScore, userId } = body;

		if (!userAddress || !actionType || qualityScore === undefined) {
			return json({ error: 'userAddress, actionType, and qualityScore required' }, { status: 400 });
		}

		// Fetch current reputation if userId provided
		let currentReputation = undefined;
		if (userId) {
			const user = await db.user.findUnique({
				where: { id: userId },
				select: {
					challenge_score: true,
					civic_score: true,
					discourse_score: true,
					total_reputation: true
				}
			});

			if (user) {
				currentReputation = {
					challenge: user.challenge_score || 50,
					civic: user.civic_score || 50,
					discourse: user.discourse_score || 50,
					total: user.total_reputation || 50
				};
			}
		}

		// Process reputation update
		const result = await reputationAgent.process({
			userAddress,
			actionType,
			qualityScore,
			currentReputation
		});

		// Update user record if userId provided
		if (userId) {
			const newScores = {
				challenge: (currentReputation?.challenge || 50) + result.reputationChanges.challenge,
				civic: (currentReputation?.civic || 50) + result.reputationChanges.civic,
				discourse: (currentReputation?.discourse || 50) + result.reputationChanges.discourse
			};

			await db.user.update({
				where: { id: userId },
				data: {
					challenge_score: Math.max(0, Math.min(100, newScores.challenge)),
					civic_score: Math.max(0, Math.min(100, newScores.civic)),
					discourse_score: Math.max(0, Math.min(100, newScores.discourse)),
					total_reputation: Math.max(
						0,
						Math.min(
							100,
							newScores.challenge * 0.4 + newScores.civic * 0.4 + newScores.discourse * 0.2
						)
					),
					reputation_tier: result.newTier
				}
			});
		}

		return json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Reputation update error:', error);
		return json({ error: 'Reputation update failed', details: error.message }, { status: 500 });
	}
};
