/**
 * N8N Workflow Integration Endpoint
 *
 * Single endpoint for N8N to process templates through agents
 * Combines verification, consensus (if needed), and reward calculation
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { agentCoordinator, moderationConsensus } from '$lib/agents';
import { db } from '$lib/core/db';
import type { Prisma as _Prisma } from '@prisma/client';
import {
	extractSupplyDecision,
	extractMarketDecision,
	extractImpactDecision,
	extractReputationDecision
} from '$lib/agents/type-guards';
import type { N8NProcessTemplateResponse } from '$lib/types/api';

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Check for N8N webhook secret if configured
		const webhookSecret = url.searchParams.get('secret');
		const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

		if (expectedSecret && webhookSecret !== expectedSecret) {
			return json({ error: 'Invalid webhook secret' }, { status: 401 });
		}

		const body = await request.json();
		const {
			templateId,
			userId,
			userAddress,
			actionType = 'cwc_message',
			recipients = [],
			stage = 'full' // 'verify', 'consensus', 'reward', 'submitted', or 'full'
		} = body;

		if (!templateId) {
			return json({ error: 'templateId required' }, { status: 400 });
		}

		// Fetch template with consolidated verification fields
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: {
				user: true
			}
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Generate submission ID for tracking
		const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2);

		const response: N8NProcessTemplateResponse = {
			success: true,
			templateId,
			submissionId,
			stages: {}
		};

		// Handle 'submitted' stage - just generate ID and return for tracking
		if (stage === 'submitted') {
			// In a real implementation, you would:
			// 1. Create a submission record in the database
			// 2. Queue the template for processing in N8N
			// 3. Set up tracking for the agent pipeline

			return json({
				success: true,
				data: {
					submissionId,
					status: 'queued',
					message: 'Template submitted for processing'
				}
			});
		}

		// Stage 1: Verification
		if (stage === 'verify' || stage === 'full') {
			const verification = await agentCoordinator.verification.makeDecision({
				template
			});

			const isApproved =
				verification.decision.verificationLevel === 'verified' ||
				verification.decision.verificationLevel === 'high_assurance';

			response.stages.verification = {
				approved: isApproved,
				severityLevel: verification.decision.severityLevel || 0,
				corrections: verification.decision.corrections,
				violations: verification.decision.riskFactors
			};

			// Store verification result in template
			await db.template.update({
				where: { id: templateId },
				data: {
					corrected_subject: verification.decision.corrections?.subject ?? undefined,
					corrected_body: verification.decision.corrections?.body ?? undefined,
					severity_level: verification.decision.severityLevel || 0,
					verification_status: isApproved ? 'approved' : 'pending',
					consensus_score: verification.confidence,
					reviewed_at: new Date()
				}
			});

			// Stop here if not approved and not forcing consensus
			if (!isApproved && stage === 'verify') {
				response.approved = false;
				response.reason = 'Failed verification';
				return json(response);
			}
		}

		// Stage 2: Consensus (for severity 7+)
		const severityLevel =
			response.stages.verification?.severityLevel || template.severity_level || 0;

		if ((stage === 'consensus' || stage === 'full') && severityLevel >= 7) {
			const consensus = await moderationConsensus.evaluateTemplate(templateId);

			response.stages.consensus = {
				approved: consensus.approved,
				score: consensus.score,
				agentCount: Object.keys(consensus.agentVotes).length,
				diversityScore: consensus.diversityScore
			};

			// Update template with consensus results
			await db.template.update({
				where: { id: templateId },
				data: {
					agent_votes: JSON.parse(JSON.stringify(consensus.agentVotes)),
					consensus_score: consensus.score,
					verification_status: consensus.approved ? 'approved' : 'rejected'
				}
			});

			// Stop here if consensus rejects
			if (!consensus.approved) {
				response.approved = false;
				response.reason = 'Failed consensus review';
				return json(response);
			}
		}

		// Stage 3: Reward Calculation
		if ((stage === 'reward' || stage === 'full') && userAddress) {
			// Calculate rewards using all agents
			const result = await agentCoordinator.processCivicAction({
				userAddress,
				actionType: actionType as
					| 'CWC_MESSAGE'
					| 'LOCAL_ACTION'
					| 'DIRECT_ACTION'
					| 'TOWN_HALL'
					| 'PUBLIC_COMMENT',
				template,
				recipients
			});

			if (result.approved) {
				// Extract typed decisions using type guards
				const supplyDecision = extractSupplyDecision(result.supply?.decision);
				const marketDecision = extractMarketDecision(result.market?.decision);
				const impactDecision = extractImpactDecision(result.impact?.decision);
				const reputationDecision = extractReputationDecision(result.reputation?.decision);

				response.stages.reward = {
					amount: (result.reward ?? 0n).toString(),
					formatted: `${Number(result.reward ?? 0n) / 10 ** 18} VOTER`,
					breakdown: {
						supply: supplyDecision.finalRewardWei || '0',
						marketMultiplier: marketDecision.rewardMultiplier || 1,
						impactMultiplier: impactDecision.impactMultiplier || 1
					}
				};

				response.stages.reputation = {
					changes: [
						{
							challenge: reputationDecision.credibilityComponents.behavioral_integrity,
							civic: reputationDecision.credibilityComponents.civic_engagement,
							discourse: reputationDecision.credibilityComponents.community_trust
						}
					],
					newTier: reputationDecision.tier,
					badges: reputationDecision.badges
				};

				// Update user if userId provided
				if (userId) {
					const user = await db.user.findUnique({
						where: { id: userId },
						select: {
							id: true,
							pending_rewards: true,
							total_earned: true,
							challenge_score: true,
							civic_score: true,
							discourse_score: true,
							reputation_tier: true
						}
					});

					if (user) {
						await db.user.update({
							where: { id: userId },
							data: {
								pending_rewards: (
									BigInt(user.pending_rewards || '0') + (result.reward ?? 0n)
								).toString(),
								total_earned: (BigInt(user.total_earned || '0') + (result.reward ?? 0n)).toString(),
								last_certification: new Date(),
								challenge_score: Math.max(
									0,
									Math.min(
										100,
										(user.challenge_score || 50) +
											(reputationDecision.credibilityComponents.behavioral_integrity || 0)
									)
								),
								civic_score: Math.max(
									0,
									Math.min(
										100,
										(user.civic_score || 50) +
											(reputationDecision.credibilityComponents.civic_engagement || 0)
									)
								),
								discourse_score: Math.max(
									0,
									Math.min(
										100,
										(user.discourse_score || 50) +
											(reputationDecision.credibilityComponents.community_trust || 0)
									)
								),
								reputation_tier: reputationDecision.tier
							}
						});
					}
				}
			}
		}

		// Final approval status
		response.approved =
			response.stages.verification?.approved !== false &&
			response.stages.consensus?.approved !== false;

		// Add CWC submission data if approved
		if (response.approved && actionType === 'cwc_message') {
			const correctedSubject =
				response.stages.verification?.corrections?.subject || template.title;
			const correctedBody =
				response.stages.verification?.corrections?.body || template.message_body;

			response.cwcReady = {
				subject: correctedSubject || 'No Subject',
				body: correctedBody,
				recipients,
				templateId
			};
		}

		return json(response);
	} catch (error) {
		console.error('Error occurred');
		return json(
			{
				success: false,
				error: 'Processing failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Health check endpoint for N8N
export const GET: RequestHandler = async () => {
	return json({
		status: 'healthy',
		service: 'communique-n8n-integration',
		timestamp: new Date().toISOString(),
		agents: ['verification', 'supply', 'market', 'impact', 'reputation', 'moderation_consensus']
	});
};
