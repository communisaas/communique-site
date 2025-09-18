/**
 * VOTER Protocol API Endpoints
 *
 * Unified API for N8N workflow integration with Communiqué
 * Handles civic actions, identity verification, and blockchain operations
 */

import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/core/db.js';
import { cwcClient } from '$lib/core/congress/cwc-client.js';
import { SupplyAgent } from '$lib/agents/supply-agent.js';
import { ImpactAgent } from '$lib/agents/impact-agent.js';
import { VerificationAgent } from '$lib/agents/verification-agent.js';
import { ReputationAgent } from '$lib/agents/reputation-agent.js';
import { AgentCoordinator, AgentType, type AgentContext } from '$lib/agents/base-agent.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	return json({ message: 'VOTER Protocol API - Use POST for actions' });
};

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { action, ...data } = await request.json();

		switch (action) {
			case 'submit_cwc_message':
				return await handleCWCSubmission(data);
			case 'record_civic_action':
				return await recordCivicAction(data);
			case 'update_reputation':
				return await updateReputation(data);
			case 'verify_identity':
				return await verifyIdentity(data);
			case 'get_user_profile':
				return await getUserProfile(data);
			case 'create_challenge':
				return await createChallenge(data);
			case 'process_challenge_vote':
				return await processChallengeVote(data);
			case 'calculate_reward':
				return await calculateReward(data);
			default:
				throw error(400, `Invalid action: ${action}`);
		}
	} catch (_error) {
		console.error('VOTER API error:', _error);
		throw error(500, _error instanceof Error ? _error.message : 'Internal server error');
	}
};

/**
 * Handle CWC message submission using existing mature CWC client
 */
async function handleCWCSubmission({
	userId,
	templateId,
	message,
	representatives,
	metadata = {}
}: {
	userId: string;
	templateId: string;
	message: string;
	representatives: any[];
	metadata?: Record<string, any>;
}) {
	if (!userId || !templateId || !message) {
		throw error(400, 'Missing required fields: userId, templateId, message');
	}

	// Get user and template from database
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			phone: true,
			street: true,
			city: true,
			state: true,
			zip: true,
			congressional_district: true
		}
	});

	if (!user) {
		throw error(404, 'User not found');
	}

	const template = await prisma.template.findUnique({
		where: { id: templateId },
		select: {
			id: true,
			title: true,
			subject: true,
			message_body: true,
			delivery_config: true,
			cwc_config: true
		}
	});

	if (!template) {
		throw error(404, 'Template not found');
	}

	// Submit via existing mature CWC infrastructure
	const results = await cwcClient.submitToAllRepresentatives(
		template as any,
		user as any,
		representatives,
		message
	);

	// Initialize impact tracking with agent orchestration
	const coordinator = new AgentCoordinator();
	const impactAgent = new ImpactAgent();
	coordinator.registerAgent(impactAgent);

	// Prepare context for impact assessment
	const impactContext: AgentContext = {
		userId,
		actionType: 'cwc_message',
		templateId,
		timestamp: new Date().toISOString()
	};

	// Get impact agent decision for this CWC submission
	let impactDecision = null;
	try {
		impactDecision = await impactAgent.makeDecision(impactContext);
	} catch (impactError) {
		console.warn('Impact agent decision failed:', impactError);
	}

	// Record civic action with agent decisions
	const civicAction = await prisma.civicAction.create({
		data: {
			user_id: userId,
			template_id: templateId,
			action_type: 'cwc_message',
			status: results.every((r) => r.success) ? 'completed' : 'failed',
			agent_decisions: {
				cwc_results: results,
				submitted_at: new Date().toISOString(),
				message_preview: message.substring(0, 100) + '...',
				impact_assessment: impactDecision
					? {
							agentId: impactDecision.agentId,
							confidence: impactDecision.confidence,
							reasoning: impactDecision.reasoning,
							impactScore: (impactDecision.decision as any)?.impactScore || 0,
							legislativeOutcomes: (impactDecision.decision as any)?.legislativeOutcomes || []
						}
					: { error: 'Impact assessment failed' }
			} as any,
			metadata: {
				...metadata,
				representatives_count: representatives.length,
				delivery_method: 'cwc',
				impact_tracking_enabled: true
			},
			completed_at: new Date()
		}
	});

	return json({
		success: true,
		actionId: civicAction.id,
		results,
		impact_assessment: impactDecision
			? {
					impactScore: (impactDecision.decision as any)?.impactScore || 0,
					confidence: impactDecision.confidence,
					reasoning: impactDecision.reasoning
				}
			: null,
		message: `Successfully submitted to ${results.filter((r) => r.success).length}/${results.length} representatives`
	});
}

/**
 * Record civic action with blockchain integration
 */
async function recordCivicAction({
	userId,
	actionType,
	templateId,
	txHash,
	rewardWei,
	agentDecisions = {},
	metadata = {},
	status = 'completed'
}: {
	userId: string;
	actionType: string;
	templateId?: string;
	txHash?: string;
	rewardWei?: string;
	agentDecisions?: Record<string, any>;
	metadata?: Record<string, any>;
	status?: string;
}) {
	if (!userId || !actionType) {
		throw error(400, 'Missing required fields: userId, actionType');
	}

	const action = await prisma.civicAction.create({
		data: {
			user_id: userId,
			template_id: templateId,
			action_type: actionType,
			tx_hash: txHash,
			reward_wei: rewardWei,
			status,
			agent_decisions: agentDecisions,
			metadata,
			completed_at: status === 'completed' ? new Date() : null
		}
	});

	return json({
		success: true,
		actionId: action.id,
		message: `Civic action ${actionType} recorded`
	});
}

/**
 * Agent-orchestrated reputation assessment with ERC-8004 compliance
 * Replaces static reputation updates with comprehensive credibility analysis
 */
async function updateReputation({
	userId,
	scoreChange,
	reason,
	txHash,
	agentSource,
	evidence,
	confidence
}: {
	userId: string;
	scoreChange?: number;
	reason?: string;
	txHash?: string;
	agentSource?: string;
	evidence?: any;
	confidence?: number;
}) {
	if (!userId) {
		throw error(400, 'Missing required field: userId');
	}

	// Initialize ReputationAgent for comprehensive assessment
	const reputationAgent = new ReputationAgent();

	const reputationContext: AgentContext = {
		userId,
		actionType: 'reputation_update',
		timestamp: new Date().toISOString()
	};

	// Get agent-based credibility assessment
	let reputationDecision = null;
	try {
		reputationDecision = await reputationAgent.makeDecision(reputationContext);
	} catch (reputationError) {
		console.error('Reputation agent failed:', reputationError);

		// Fallback to legacy reputation update
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { trust_score: true, reputation_tier: true }
		});

		if (!user) {
			throw error(404, 'User not found');
		}

		const oldScore = user.trust_score;
		const newScore = Math.max(0, oldScore + (scoreChange || 0));

		return json({
			success: true,
			oldScore,
			newScore,
			newTier: user.reputation_tier,
			warning: 'Used fallback reputation calculation',
			message: `Reputation updated: ${oldScore} → ${newScore} (${reason || 'fallback'})`
		});
	}

	const credibilityAssessment = reputationDecision.decision as {
		credibilityScore: number;
		tier: string;
		category: string;
		confidence: number;
		reasonCode: string;
		verification: string;
	};

	// Get current user state for comparison
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { trust_score: true, reputation_tier: true }
	});

	if (!user) {
		throw error(404, 'User not found');
	}

	const oldScore = user.trust_score;
	const newScore = credibilityAssessment.credibilityScore;

	// Update user with agent-determined credibility score and tier
	await prisma.user.update({
		where: { id: userId },
		data: {
			trust_score: newScore,
			reputation_tier: credibilityAssessment.tier
		}
	});

	// Log comprehensive reputation assessment
	await prisma.reputationLog.create({
		data: {
			user_id: userId,
			score_before: oldScore,
			score_after: newScore,
			change_amount: newScore - oldScore,
			change_reason: reason || 'agent_credibility_assessment',
			tx_hash: txHash,
			agent_source: reputationDecision.agentId,
			evidence_hash: JSON.stringify({
				components: credibilityAssessment.credibilityComponents,
				badges: credibilityAssessment.badges,
				riskFactors: credibilityAssessment.riskFactors,
				attestations: credibilityAssessment.attestations.length
			}),
			confidence: reputationDecision.confidence
		}
	});

	return json({
		success: true,
		oldScore,
		newScore,
		newTier: credibilityAssessment.tier,
		credibility_assessment: {
			components: credibilityAssessment.credibilityComponents,
			badges: credibilityAssessment.badges,
			riskFactors: credibilityAssessment.riskFactors,
			attestations: credibilityAssessment.attestations.length,
			portabilityHash: credibilityAssessment.portabilityHash
		},
		agent_reasoning: {
			confidence: reputationDecision.confidence,
			reasoning: reputationDecision.reasoning
		},
		message: `ERC-8004 credibility assessment: ${oldScore} → ${newScore} (${credibilityAssessment.tier} tier)`
	});
}

/**
 * Agent-orchestrated identity verification
 * Replaces static verification with intelligent multi-source analysis
 */
async function verifyIdentity({ userId, walletAddress, kycResult, trustScore, districtHash }) {
	if (!userId) {
		throw error(400, 'Missing required field: userId');
	}

	// First update user data from external verification
	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			wallet_address: walletAddress,
			verification_method: 'didit',
			verification_data: kycResult,
			verified_at: new Date(),
			district_hash: districtHash,
			congressional_district: kycResult?.addressData?.congressionalDistrict
		}
	});

	// Initialize verification agent for comprehensive assessment
	const verificationAgent = new VerificationAgent();

	const verificationContext: AgentContext = {
		userId,
		actionType: 'identity_verification'
	};

	// Get agent-based verification assessment
	let verificationDecision = null;
	try {
		verificationDecision = await verificationAgent.makeDecision(verificationContext);
	} catch (verificationError) {
		console.error('Verification agent failed:', verificationError);
		// Fallback to basic trust score logic
		verificationDecision = {
			decision: {
				verificationLevel: trustScore >= 60 ? 'verified' : 'unverified',
				trustScore: trustScore || 0,
				riskFactors: [],
				recommendedActions: []
			},
			confidence: 0.5,
			reasoning: 'Fallback verification due to agent error'
		};
	}

	const assessment = verificationDecision.decision;

	// Update user with agent-determined trust score and verification status
	await prisma.user.update({
		where: { id: userId },
		data: {
			trust_score: assessment.trustScore,
			is_verified: ['verified', 'high_assurance'].includes(assessment.verificationLevel),
			reputation_tier:
				assessment.trustScore >= 500
					? 'expert'
					: assessment.trustScore >= 100
						? 'verified'
						: 'novice'
		}
	});

	// Log verification change with agent reasoning
	await prisma.reputationLog.create({
		data: {
			user_id: userId,
			score_before: 0,
			score_after: assessment.trustScore,
			change_amount: assessment.trustScore,
			change_reason: 'agent_identity_verification',
			agent_source: verificationDecision.agentId,
			confidence: verificationDecision.confidence,
			evidence_hash: JSON.stringify({
				verificationSources: assessment.verificationSources?.length || 0,
				riskFactors: assessment.riskFactors,
				recommendations: assessment.recommendedActions
			})
		}
	});

	return json({
		success: true,
		userId,
		trustScore: assessment.trustScore,
		verificationLevel: assessment.verificationLevel,
		congressionalDistrict: kycResult?.addressData?.congressionalDistrict,
		agent_assessment: {
			confidence: verificationDecision.confidence,
			reasoning: verificationDecision.reasoning,
			riskFactors: assessment.riskFactors,
			recommendations: assessment.recommendedActions,
			sourcesAnalyzed: assessment.verificationSources?.length || 0
		},
		message: `Identity verification completed: ${assessment.verificationLevel} level`
	});
}

/**
 * Get user profile with civic action history
 */
async function getUserProfile({ userId, walletAddress }) {
	if (!userId && !walletAddress) {
		throw error(400, 'Must provide either userId or walletAddress');
	}

	const user = await prisma.user.findFirst({
		where: userId ? { id: userId } : { wallet_address: walletAddress },
		include: {
			civic_actions: {
				orderBy: { created_at: 'desc' },
				take: 10,
				include: {
					template: {
						select: { title: true, category: true }
					}
				}
			},
			reputation_logs: {
				orderBy: { created_at: 'desc' },
				take: 5
			},
			_count: {
				select: {
					civic_actions: true,
					challenger_challenges: true,
					defender_challenges: true,
					won_challenges: true
				}
			}
		}
	});

	if (!user) {
		throw error(404, 'User not found');
	}

	return json({
		success: true,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			wallet_address: user.wallet_address,
			trust_score: user.trust_score,
			reputation_tier: user.reputation_tier,
			is_verified: user.is_verified,
			verification_method: user.verification_method,
			congressional_district: user.congressional_district,
			created_at: user.createdAt
		},
		stats: {
			civic_actions_count: user._count.civic_actions,
			challenges_created: user._count.challenger_challenges,
			challenges_defended: user._count.defender_challenges,
			challenges_won: user._count.won_challenges
		},
		recent_actions: user.civic_actions.map((action) => ({
			id: action.id,
			type: action.action_type,
			template_title: action.template?.title,
			status: action.status,
			reward_wei: action.reward_wei,
			created_at: action.created_at
		})),
		reputation_history: user.reputation_logs.map((log) => ({
			score_change: log.change_amount,
			reason: log.change_reason,
			created_at: log.created_at
		}))
	});
}

/**
 * Create challenge in challenge market
 */
async function createChallenge({
	challengerId,
	defenderId,
	title,
	description,
	evidenceIPFS,
	stakeAmount,
	category
}) {
	if (!challengerId || !defenderId || !title || !evidenceIPFS || !stakeAmount) {
		throw error(400, 'Missing required fields for challenge creation');
	}

	// Calculate voting deadline (72 hours from now)
	const votingDeadline = new Date();
	votingDeadline.setHours(votingDeadline.getHours() + 72);

	// Generate unique claim hash
	const claimHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substring(2)}`;

	const challenge = await prisma.challenge.create({
		data: {
			challenger_id: challengerId,
			defender_id: defenderId,
			title,
			description,
			evidence_ipfs: evidenceIPFS,
			stake_amount: stakeAmount,
			voting_deadline: votingDeadline,
			claim_hash: claimHash,
			category,
			status: 'active'
		}
	});

	return json({
		success: true,
		challengeId: challenge.id,
		claimHash,
		votingDeadline,
		message: 'Challenge created successfully'
	});
}

/**
 * Process challenge vote with quadratic voting
 */
async function processChallengeVote({ challengeId, userId, side, stakeAmount }) {
	if (!challengeId || !userId || !side || !stakeAmount) {
		throw error(400, 'Missing required fields for challenge vote');
	}

	// Calculate quadratic voting power
	const votingPower = Math.sqrt(parseFloat(stakeAmount));

	const stake = await prisma.challengeStake.upsert({
		where: {
			challenge_id_user_id: {
				challenge_id: challengeId,
				user_id: userId
			}
		},
		create: {
			challenge_id: challengeId,
			user_id: userId,
			amount: stakeAmount,
			side,
			voting_power: votingPower
		},
		update: {
			amount: stakeAmount,
			side,
			voting_power: votingPower
		}
	});

	return json({
		success: true,
		stakeId: stake.id,
		votingPower,
		message: `Vote recorded: ${side} with ${votingPower.toFixed(2)} voting power`
	});
}

/**
 * Agent-orchestrated reward calculation
 * Replaces static logic with intelligent agents
 */
async function calculateReward({ userAddress, actionType, templateId, timestamp }) {
	if (!userAddress || !actionType) {
		throw error(400, 'Missing required fields: userAddress, actionType');
	}

	// Get user for context
	const user = await prisma.user.findUnique({
		where: { wallet_address: userAddress },
		select: { id: true, trust_score: true, reputation_tier: true }
	});

	// Initialize agent coordinator
	const coordinator = new AgentCoordinator();
	const supplyAgent = new SupplyAgent();
	const impactAgent = new ImpactAgent();

	coordinator.registerAgent(supplyAgent);
	coordinator.registerAgent(impactAgent);

	// Build agent context
	const context: AgentContext = {
		userId: user?.id,
		actionType,
		templateId,
		timestamp
	};

	// Get agent decisions for reward calculation
	const consensus = await coordinator.coordinateDecision(context, [
		AgentType.SUPPLY,
		AgentType.IMPACT
	]);

	if (!consensus.consensusReached) {
		console.warn('Agent consensus failed, using fallback calculation');

		// Fallback to simple calculation
		const fallbackRewardWei = '100000000000000000'; // 0.1 ETH

		return json({
			success: true,
			action: actionType,
			user: userAddress,
			reward_wei: fallbackRewardWei,
			warning: 'Used fallback calculation due to agent consensus failure',
			agent_decisions: consensus.decisions,
			calculation_timestamp: new Date().toISOString()
		});
	}

	// Extract supply agent decision (contains reward parameters)
	const supplyDecision = consensus.decisions.find((d) => d.agentType === AgentType.SUPPLY);
	const impactDecision = consensus.decisions.find((d) => d.agentType === AgentType.IMPACT);

	if (!supplyDecision) {
		throw error(500, 'Supply agent decision missing from consensus');
	}

	const rewardParams = supplyDecision.decision;

	// Save agent decisions for audit trail
	await prisma.rewardCalculation.create({
		data: {
			user_address: userAddress,
			action_type: actionType,
			base_reward_usd: rewardParams.baseRewardUSD?.toString() || '0.10',
			total_multiplier: rewardParams.totalMultiplier?.toString() || '1.0',
			reward_usd: (
				(rewardParams.baseRewardUSD || 0.1) * (rewardParams.totalMultiplier || 1.0)
			).toString(),
			reward_wei: rewardParams.finalRewardWei || '100000000000000000',
			eth_price: rewardParams.ethPrice?.toString() || '2000',
			multipliers: rewardParams.multipliers || {},
			network_activity: {
				daily_active_users: supplyDecision.parameters?.networkActivity || 0
			},
			agent_decisions: {
				supply: {
					agentId: supplyDecision.agentId,
					confidence: supplyDecision.confidence,
					reasoning: supplyDecision.reasoning
				},
				impact: impactDecision
					? {
							agentId: impactDecision.agentId,
							confidence: impactDecision.confidence,
							reasoning: impactDecision.reasoning,
							impactScore: impactDecision.decision?.impactScore || 0
						}
					: null
			}
		}
	});

	return json({
		success: true,
		action: actionType,
		user: userAddress,
		base_reward_usd: rewardParams.baseRewardUSD || 0.1,
		multipliers: rewardParams.multipliers || {},
		total_multiplier: rewardParams.totalMultiplier || 1.0,
		reward_usd: (rewardParams.baseRewardUSD || 0.1) * (rewardParams.totalMultiplier || 1.0),
		reward_eth: rewardParams.finalRewardETH || 0.05,
		reward_wei: rewardParams.finalRewardWei || '100000000000000000',
		eth_price: rewardParams.ethPrice || 2000,
		network_activity: supplyDecision.parameters?.networkActivity || 0,
		user_reputation: user?.trust_score || 0,
		confidence: consensus.consensusConfidence,
		agent_reasoning: {
			supply: supplyDecision.reasoning,
			impact: impactDecision?.reasoning
		},
		impact_score: impactDecision?.decision?.impactScore || 0,
		calculation_timestamp: new Date().toISOString()
	});
}
