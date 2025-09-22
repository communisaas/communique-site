/**
 * Reputation Update API Endpoint
 *
 * Updates user reputation based on actions
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReputationAgent } from '$lib/agents';
import { db } from '$lib/core/db';
import type { ReputationDecision } from '$lib/types/any-replacements';

const reputationAgent = new ReputationAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			userAddress,
			actionType,
			qualityScore,
			userId
		}: {
			userAddress: string;
			actionType: string;
			qualityScore: number;
			userId?: string;
		} = body;

		if (!userAddress || !actionType || qualityScore === undefined) {
			return json(
				{ error: 'userAddress , actionType, and qualityScore required' },
				{ status: 400 }
			);
		}

		// Fetch current reputation if userId provided
		let currentReputation = undefined;
		if (userId) {
			const user = await db.user.findUnique({
				where: { id: userId },
				select: {
					trust_score: true,
					reputation_tier: true
				}
			});

			if (user) {
				currentReputation = {
					challenge: 50, // Default values since individual scores aren't stored
					civic: 50,
					discourse: 50,
					total: user.trust_score || 50
				};
			}
		}

		// Process reputation update
		const result = await reputationAgent.makeDecision({
			userId,
			actionType,
			parameters: {
				userAddress,
				qualityScore,
				currentReputation
			}
		});

		// Update user record if userId provided
		if (userId && result.decision) {
			const decision = result.decision as ReputationDecision; // Type assertion for agent decision
			const changes = (decision.reputationChange as { total?: number }) || {};
			const newReputation = Math.max(
				0,
				Math.min(100, (currentReputation?.total || 50) + (changes.total || 0))
			);

			await db.user.update({
				where: { id: userId },
				data: {
					trust_score: newReputation,
					reputation_tier: decision.newTier || 'novice'
				}
			});

			// Create unified audit log entry for reputation update
			await db.auditLog.create({
				data: {
					user_id: userId,
					action_type: 'reputation_change',
					action_subtype: 'agent_update',
					audit_data: JSON.parse(
						JSON.stringify({
							action_type: actionType,
							quality_score: qualityScore,
							user_address: userAddress,
							reputation_changes: changes,
							agent_decision: decision
						})
					),
					score_before: currentReputation?.total || 50,
					score_after: newReputation,
					change_amount: changes.total || 0,
					change_reason: 'agent_reputation_update',
					agent_source: result.agentId,
					confidence: result.confidence,
					status: 'completed'
				}
			});
		}

		return json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Error occurred');
		return json(
			{
				error: 'Reputation update failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
