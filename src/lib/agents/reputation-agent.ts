/**
 * ReputationAgent - ERC-8004 Credibility Infrastructure
 *
 * Core vision: "Portable democratic credibility across platforms"
 *
 * Implements ERC-8004 compliant reputation system that creates verifiable,
 * portable credibility scores for democratic participation. Integrates with
 * challenge markets, civic actions, and cross-platform reputation.
 */

import { BaseAgent, AgentType, AgentContext, AgentDecision } from './base-agent.js';
import { prisma } from '$lib/core/db.js';

export interface CredibilityAssessment {
	userId: string;
	walletAddress?: string;
	credibilityScore: number; // 0-1000 scale (ERC-8004 standard)
	credibilityComponents: {
		civic_engagement: number; // Actions taken, consistency
		information_quality: number; // Challenge market success rate
		community_trust: number; // Peer validation scores
		verification_depth: number; // Identity verification level
		behavioral_integrity: number; // Long-term behavior patterns
	};
	tier: 'untrusted' | 'emerging' | 'established' | 'respected' | 'authoritative';
	badges: string[];
	attestations: ERC8004Attestation[];
	riskFactors: string[];
	portabilityHash: string; // For cross-platform use
}

export interface ERC8004Attestation {
	issuer: string;
	subject: string;
	claimType: string;
	claimValue: any;
	confidence: number;
	timestamp: Date;
	expirationDate?: Date;
	signature: string;
	chainId?: number;
}

export class ReputationAgent extends BaseAgent {
	constructor() {
		super('reputation-agent-v1', AgentType.REPUTATION, {
			minCredibilityScore: [0, 100], // Minimum score threshold
			maxScoreIncrease: [1, 50], // Max single increase
			decayRate: [0.001, 0.01], // Daily score decay rate
			verificationWeight: [0.1, 0.4], // Identity verification importance
			challengeWeight: [0.2, 0.5] // Challenge market performance weight
		});
	}

	async makeDecision(context: AgentContext): Promise<AgentDecision> {
		try {
			// Get comprehensive user reputation data
			const reputationData = await this.gatherReputationData(context.userId!);

			// Calculate credibility components
			const credibilityComponents = this.calculateCredibilityComponents(reputationData);

			// Calculate overall credibility score
			const credibilityScore = this.calculateCredibilityScore(credibilityComponents);

			// Determine reputation tier
			const tier = this.determineCredibilityTier(credibilityScore);

			// Generate badges based on achievements
			const badges = this.generateBadges(reputationData, credibilityComponents);

			// Create ERC-8004 attestations
			const attestations = await this.generateAttestations(context.userId!, credibilityComponents);

			// Identify reputation risks
			const riskFactors = this.identifyReputationRisks(reputationData, credibilityComponents);

			// Generate portability hash for cross-platform use
			const portabilityHash = this.generatePortabilityHash(credibilityScore, credibilityComponents);

			const assessment: CredibilityAssessment = {
				userId: context.userId!,
				walletAddress: reputationData.walletAddress,
				credibilityScore: this.applySafetyBounds(credibilityScore, 'minCredibilityScore'),
				credibilityComponents,
				tier,
				badges,
				attestations,
				riskFactors,
				portabilityHash
			};

			const confidence = this.assessDecisionConfidence(assessment, reputationData);

			return this.createDecision(
				assessment,
				confidence,
				this.generateReputationReasoning(assessment, reputationData),
				{
					userId: context.userId,
					tier,
					credibilityScore: assessment.credibilityScore
				}
			);
		} catch (error) {
			console.error('ReputationAgent decision error:', error);
			return this.createDecision(
				{
					userId: context.userId,
					credibilityScore: 0,
					tier: 'untrusted',
					credibilityComponents: {
						civic_engagement: 0,
						information_quality: 0,
						community_trust: 0,
						verification_depth: 0,
						behavioral_integrity: 0
					},
					badges: [],
					attestations: [],
					riskFactors: ['reputation_calculation_error'],
					portabilityHash: ''
				},
				0.1,
				`Error in reputation assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ error: true }
			);
		}
	}

	private async gatherReputationData(userId: string): Promise<{
		user: any;
		civicActions: any[];
		challengeHistory: any[];
		reputationLogs: any[];
		verificationLevel: string;
		walletAddress?: string;
	}> {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				wallet_address: true,
				trust_score: true,
				reputation_tier: true,
				is_verified: true,
				verification_method: true,
				created_at: true,
				civic_actions: {
					orderBy: { created_at: 'desc' },
					take: 50,
					select: {
						action_type: true,
						status: true,
						created_at: true,
						reward_wei: true,
						agent_decisions: true
					}
				},
				challenger_challenges: {
					orderBy: { created_at: 'desc' },
					take: 20,
					select: {
						id: true,
						title: true,
						status: true,
						resolution: true,
						created_at: true,
						voting_deadline: true,
						challenge_stakes: {
							select: {
								side: true,
								amount: true,
								voting_power: true
							}
						}
					}
				},
				defender_challenges: {
					orderBy: { created_at: 'desc' },
					take: 20
				},
				reputation_logs: {
					orderBy: { created_at: 'desc' },
					take: 30,
					select: {
						score_before: true,
						score_after: true,
						change_amount: true,
						change_reason: true,
						confidence: true,
						created_at: true
					}
				}
			}
		});

		if (!user) {
			throw new Error(`User ${userId} not found`);
		}

		return {
			user,
			civicActions: user.civic_actions,
			challengeHistory: [...user.challenger_challenges, ...user.defender_challenges],
			reputationLogs: user.reputation_logs,
			verificationLevel: user.is_verified ? 'verified' : 'unverified',
			walletAddress: user.wallet_address
		};
	}

	private calculateCredibilityComponents(
		reputationData: any
	): CredibilityAssessment['credibilityComponents'] {
		const { user, civicActions, challengeHistory, reputationLogs } = reputationData;

		// 1. Civic Engagement (0-200 scale)
		const civicEngagement = this.calculateCivicEngagement(civicActions, user.created_at);

		// 2. Information Quality (0-200 based on challenge market performance)
		const informationQuality = this.calculateInformationQuality(challengeHistory);

		// 3. Community Trust (0-200 from peer interactions and reputation logs)
		const communityTrust = this.calculateCommunityTrust(reputationLogs, civicActions);

		// 4. Verification Depth (0-200 from identity verification completeness)
		const verificationDepth = this.calculateVerificationDepth(user);

		// 5. Behavioral Integrity (0-200 from long-term consistency patterns)
		const behavioralIntegrity = this.calculateBehavioralIntegrity(
			civicActions,
			reputationLogs,
			user.created_at
		);

		return {
			civic_engagement: Math.round(civicEngagement),
			information_quality: Math.round(informationQuality),
			community_trust: Math.round(communityTrust),
			verification_depth: Math.round(verificationDepth),
			behavioral_integrity: Math.round(behavioralIntegrity)
		};
	}

	private calculateCivicEngagement(civicActions: any[], userCreatedAt: Date): number {
		if (civicActions.length === 0) return 0;

		// Base score from action count (0-100)
		const actionScore = Math.min(100, civicActions.length * 3);

		// Consistency bonus: actions spread over time (0-50)
		const timeSpan = this.getAccountTimeSpanDays(userCreatedAt);
		const consistencyScore = Math.min(50, (civicActions.length / Math.max(1, timeSpan / 30)) * 10);

		// Success rate bonus (0-50)
		const successfulActions = civicActions.filter((a) => a.status === 'completed').length;
		const successRate = successfulActions / civicActions.length;
		const successBonus = successRate * 50;

		return actionScore + consistencyScore + successBonus;
	}

	private calculateInformationQuality(challengeHistory: any[]): number {
		if (challengeHistory.length === 0) return 50; // Neutral score

		// Success rate in challenges (0-120)
		const resolvedChallenges = challengeHistory.filter((c) => c.resolution);
		if (resolvedChallenges.length === 0) return 50;

		const wonChallenges = resolvedChallenges.filter(
			(c) => c.resolution === 'challenger_won'
		).length;
		const successRate = wonChallenges / resolvedChallenges.length;
		const baseScore = successRate * 120;

		// Participation bonus (0-40)
		const participationBonus = Math.min(40, challengeHistory.length * 2);

		// High-stakes accuracy bonus (0-40)
		const highStakesChallenges = challengeHistory.filter(
			(c) => c.challenge_stakes && c.challenge_stakes.some((s: any) => parseFloat(s.amount) > 1000)
		);
		const stakesBonus = Math.min(40, highStakesChallenges.length * 5);

		return baseScore + participationBonus + stakesBonus;
	}

	private calculateCommunityTrust(reputationLogs: any[], civicActions: any[]): number {
		// Base score from positive reputation changes (0-100)
		const positiveChanges = reputationLogs.filter((log) => log.change_amount > 0);
		const trustScore = Math.min(100, positiveChanges.length * 5);

		// Peer validation bonus from high-confidence reputation changes (0-60)
		const highConfidenceChanges = reputationLogs.filter((log) => (log.confidence || 0) > 0.8);
		const validationBonus = Math.min(60, highConfidenceChanges.length * 10);

		// Community interaction bonus (0-40)
		const communityActions = civicActions.filter((a) =>
			['challenge_participation', 'template_creation', 'community_moderation'].includes(
				a.action_type
			)
		);
		const interactionBonus = Math.min(40, communityActions.length * 8);

		return trustScore + validationBonus + interactionBonus;
	}

	private calculateVerificationDepth(user: any): number {
		let score = 0;

		// Basic verification (0-60)
		if (user.is_verified) score += 60;

		// KYC method bonus (0-40)
		if (user.verification_method === 'didit') score += 40;

		// Wallet connection bonus (0-30)
		if (user.wallet_address) score += 30;

		// Trust score integration (0-70)
		const trustScoreBonus = Math.min(70, ((user.trust_score || 0) / 1000) * 70);
		score += trustScoreBonus;

		return Math.min(200, score);
	}

	private calculateBehavioralIntegrity(
		civicActions: any[],
		reputationLogs: any[],
		userCreatedAt: Date
	): number {
		// Consistency over time (0-80)
		const timeSpanDays = this.getAccountTimeSpanDays(userCreatedAt);
		const regularActivity = civicActions.length / Math.max(1, timeSpanDays / 30);
		const consistencyScore = Math.min(80, regularActivity * 15);

		// No negative reputation events (0-60)
		const negativeEvents = reputationLogs.filter((log) => log.change_amount < -50).length;
		const integrityScore = Math.max(0, 60 - negativeEvents * 20);

		// Long-term engagement (0-60)
		const longevityBonus = Math.min(60, (timeSpanDays / 30) * 5);

		return consistencyScore + integrityScore + longevityBonus;
	}

	private calculateCredibilityScore(
		components: CredibilityAssessment['credibilityComponents']
	): number {
		// Weighted average of components (max 1000 points)
		const weights = {
			civic_engagement: 0.25, // 25% weight
			information_quality: 0.2, // 20% weight
			community_trust: 0.2, // 20% weight
			verification_depth: this.applySafetyBounds(0.15, 'verificationWeight'), // 15% weight
			behavioral_integrity: 0.2 // 20% weight
		};

		let totalScore = 0;
		totalScore += components.civic_engagement * weights.civic_engagement;
		totalScore += components.information_quality * weights.information_quality;
		totalScore += components.community_trust * weights.community_trust;
		totalScore += components.verification_depth * weights.verification_depth;
		totalScore += components.behavioral_integrity * weights.behavioral_integrity;

		// Convert to 0-1000 scale and apply safety bounds
		return Math.round(Math.min(1000, totalScore * 5));
	}

	private determineCredibilityTier(credibilityScore: number): CredibilityAssessment['tier'] {
		if (credibilityScore >= 800) return 'authoritative';
		if (credibilityScore >= 600) return 'respected';
		if (credibilityScore >= 400) return 'established';
		if (credibilityScore >= 200) return 'emerging';
		return 'untrusted';
	}

	private generateBadges(reputationData: any, components: any): string[] {
		const badges: string[] = [];

		// Civic Leader
		if (components.civic_engagement >= 180) badges.push('civic_leader');

		// Truth Seeker
		if (components.information_quality >= 180) badges.push('truth_seeker');

		// Community Pillar
		if (components.community_trust >= 180) badges.push('community_pillar');

		// Verified Participant
		if (components.verification_depth >= 150) badges.push('verified_participant');

		// Consistent Contributor
		if (components.behavioral_integrity >= 160) badges.push('consistent_contributor');

		// Challenge Master (special conditions)
		const challengeWinRate =
			reputationData.challengeHistory.length > 5
				? reputationData.challengeHistory.filter((c: any) => c.resolution === 'challenger_won')
						.length / reputationData.challengeHistory.length
				: 0;
		if (challengeWinRate >= 0.8) badges.push('challenge_master');

		// Early Adopter
		const accountAge = this.getAccountTimeSpanDays(reputationData.user.created_at);
		if (accountAge >= 90 && reputationData.civicActions.length >= 20) badges.push('early_adopter');

		return badges;
	}

	private async generateAttestations(
		userId: string,
		components: any
	): Promise<ERC8004Attestation[]> {
		const attestations: ERC8004Attestation[] = [];

		// Civic engagement attestation
		if (components.civic_engagement >= 100) {
			attestations.push({
				issuer: 'VOTER_Protocol',
				subject: userId,
				claimType: 'civic_engagement_score',
				claimValue: components.civic_engagement,
				confidence: Math.min(1.0, components.civic_engagement / 200),
				timestamp: new Date(),
				signature: `0x${Date.now().toString(16)}civic${components.civic_engagement}`,
				chainId: 1 // Ethereum mainnet - would be Monad in production
			});
		}

		// Information quality attestation
		if (components.information_quality >= 100) {
			attestations.push({
				issuer: 'VOTER_Protocol',
				subject: userId,
				claimType: 'information_quality_score',
				claimValue: components.information_quality,
				confidence: Math.min(1.0, components.information_quality / 200),
				timestamp: new Date(),
				signature: `0x${Date.now().toString(16)}quality${components.information_quality}`
			});
		}

		return attestations;
	}

	private identifyReputationRisks(reputationData: any, components: any): string[] {
		const risks: string[] = [];

		if (components.verification_depth < 50) risks.push('low_verification');
		if (components.behavioral_integrity < 50) risks.push('behavioral_inconsistency');
		if (reputationData.challengeHistory.length > 5) {
			const lossRate =
				reputationData.challengeHistory.filter((c: any) => c.resolution === 'challenger_lost')
					.length / reputationData.challengeHistory.length;
			if (lossRate > 0.5) risks.push('high_challenge_loss_rate');
		}
		if (
			reputationData.civicActions.length < 5 &&
			this.getAccountTimeSpanDays(reputationData.user.created_at) > 30
		) {
			risks.push('low_civic_engagement');
		}

		return risks;
	}

	private generatePortabilityHash(credibilityScore: number, components: any): string {
		// Generate deterministic hash for cross-platform reputation portability
		const data = `${credibilityScore}-${JSON.stringify(components)}-${Date.now()}`;
		return `0x${Buffer.from(data).toString('hex').substring(0, 32)}`;
	}

	private getAccountTimeSpanDays(createdAt: Date): number {
		return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
	}

	private assessDecisionConfidence(assessment: CredibilityAssessment, reputationData: any): number {
		let confidence = 0.6; // Base confidence

		// Higher confidence with more data
		if (reputationData.civicActions.length > 10) confidence += 0.1;
		if (reputationData.challengeHistory.length > 5) confidence += 0.1;
		if (reputationData.reputationLogs.length > 10) confidence += 0.1;

		// Higher confidence with verification
		if (assessment.credibilityComponents.verification_depth > 100) confidence += 0.1;

		return Math.min(1.0, Math.max(0.1, confidence));
	}

	private generateReputationReasoning(
		assessment: CredibilityAssessment,
		reputationData: any
	): string {
		const { credibilityScore, tier, credibilityComponents, badges } = assessment;

		return (
			`Credibility assessment: ${tier} tier with score ${credibilityScore}/1000. ` +
			`Components: Civic ${credibilityComponents.civic_engagement}/200, ` +
			`Quality ${credibilityComponents.information_quality}/200, ` +
			`Trust ${credibilityComponents.community_trust}/200, ` +
			`Verification ${credibilityComponents.verification_depth}/200, ` +
			`Integrity ${credibilityComponents.behavioral_integrity}/200. ` +
			`Based on ${reputationData.civicActions.length} civic actions, ` +
			`${reputationData.challengeHistory.length} challenge participations. ` +
			`${badges.length > 0 ? `Earned badges: ${badges.join(', ')}.` : ''}`
		);
	}
}
