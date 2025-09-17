// @ts-nocheck
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

		// Fetch template
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: {
				verification: true,
				user: true
			}
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Generate submission ID for tracking
		const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2);

		const response: unknown = {
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
			const verification = await agentCoordinator.verification.process({
				template
			});

			response.stages.verification = {
				approved: verification.approved,
				severityLevel: verification.severityLevel,
				corrections: verification.corrections,
				violations: verification.violations
			};

			// Store verification result
			await db.templateVerification.upsert({
				where: { template_id: templateId },
				update: {
					corrected_subject: verification.corrections?.subject,
					corrected_body: verification.corrections?.body,
					severity_level: verification.severityLevel,
					moderation_status: verification.approved ? 'approved' : 'pending',
					consensus_score: verification.confidence,
					reviewed_at: new Date()
				},
				create: {
					template_id: templateId,
					corrected_subject: verification.corrections?.subject,
					corrected_body: verification.corrections?.body,
					severity_level: verification.severityLevel,
					moderation_status: verification.approved ? 'approved' : 'pending',
					consensus_score: verification.confidence
				}
			});

			// Stop here if not approved and not forcing consensus
			if (!verification.approved && stage === 'verify') {
				response.approved = false;
				response.reason = 'Failed verification';
				return json(response);
			}
		}

		// Stage 2: Consensus (for severity 7+)
		const severityLevel =
			response.stages.verification?.severityLevel || template.verification?.severity_level || 0;

		if ((stage === 'consensus' || stage === 'full') && severityLevel >= 7) {
			const verificationId = template.verification?.id;
			if (verificationId) {
				const consensus = await moderationConsensus.evaluateTemplate(verificationId);

				response.stages.consensus = {
					approved: consensus.approved,
					score: consensus.score,
					agentCount: Object.keys(consensus.agentVotes).length,
					diversityScore: consensus.diversityScore
				};

				// Stop here if consensus rejects
				if (!consensus.approved) {
					response.approved = false;
					response.reason = 'Failed consensus review';
					return json(response);
				}
			}
		}

		// Stage 3: Reward Calculation
		if ((stage === 'reward' || stage === 'full') && userAddress) {
			// Calculate rewards using all agents
			const result = await agentCoordinator.processCivicAction({
				userAddress,
				actionType: actionType as any,
				template,
				recipients
			});

			if (result.approved) {
				response.stages.reward = {
					amount: result.reward.toString(),
					formatted: `${Number(result.reward) / 10 ** 18} VOTER`,
					breakdown: {
						supply: result.supply.rewardAmount.toString(),
						marketMultiplier: result.market.rewardMultiplier,
						impactMultiplier: result.impact.impactMultiplier
					}
				};

				response.stages.reputation = {
					changes: result.reputation.reputationChanges,
					newTier: result.reputation.newTier,
					badges: result.reputation.badges
				};

				// Update user if userId provided
				if (userId) {
					const user = await db.user.findUnique({
						where: { id: userId }
					});

					if (user) {
						await db.user.update({
							where: { id: userId },
							data: {
								pending_rewards: (user.pending_rewards || 0) + Number(result.reward),
								total_earned: (user.total_earned || 0) + Number(result.reward),
								last_certification: new Date(),
								challenge_score: Math.max(
									0,
									Math.min(
										100,
										(user.challenge_score || 50) + result.reputation.reputationChanges.challenge
									)
								),
								civic_score: Math.max(
									0,
									Math.min(
										100,
										(user.civic_score || 50) + result.reputation.reputationChanges.civic
									)
								),
								discourse_score: Math.max(
									0,
									Math.min(
										100,
										(user.discourse_score || 50) + result.reputation.reputationChanges.discourse
									)
								),
								reputation_tier: result.reputation.newTier
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
				response.stages.verification?.corrections?.subject || template.subject;
			const correctedBody =
				response.stages.verification?.corrections?.body || template.message_body;

			response.cwcReady = {
				subject: correctedSubject,
				body: correctedBody,
				recipients,
				templateId
			};
		}

		return json(response);
	} catch (_error) {
		console.error('N8N processing error:', error);
		return json(
			{
				success: false,
				error: 'Processing failed',
				details: _error.message
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
