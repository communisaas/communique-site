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
					voter_reputation: true,
					trust_score: true,
					reputation_tier: true
				}
			});

			if (user) {
				currentReputation = {
					challenge: 50, // Default values since individual scores aren't stored
					civic: 50,
					discourse: 50,
					total: user.voter_reputation || 50
				};
			}
		}

		// Process reputation update
		const result = await reputationAgent.makeDecision({
			userId,
			actionType,
			qualityScore,
			currentReputation,
			parameters: { userAddress }
		});

		// Update user record if userId provided
		if (userId && result.decision) {
			const decision = result.decision as any; // Type assertion for agent decision
			const changes = decision.reputationChanges || {};
			const newReputation = Math.max(
				0,
				Math.min(100, (currentReputation?.total || 50) + (changes.total || 0))
			);

			await db.user.update({
				where: { id: userId },
				data: {
					voter_reputation: newReputation,
					trust_score: Math.max(
						0,
						Math.min(100, (currentReputation?.total || 50) + (changes.trust || 0))
					),
					reputation_tier: decision.newTier || 'novice'
				}
			});
		}

		return json({
			success: true,
			...result
		});
	} catch (_error) {
		console.error('Reputation update error:', _error);
		return json(
			{
				error: 'Reputation update failed',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
