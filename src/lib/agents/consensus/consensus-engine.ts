/**
 * Consensus Engine - Multi-Agent Decision Aggregation
 * 
 * Implements sophisticated consensus mechanisms for agent decisions across both
 * VOTER Protocol and direct delivery flows. Handles weighted voting, diversity bonuses,
 * conflict resolution, and quality assurance.
 */

import type { AgentResponse } from '../base/universal-agent';
import type { AgentCapability } from '../registry/agent-registry';
import { agentRegistry } from '../registry/agent-registry';

export interface ConsensusInput {
	agentResponses: AgentResponse[];
	originalContent: string;
	enhancedContent?: string;
	submissionFlow: 'voter-protocol' | 'direct-delivery';
	userReputation?: number;
	taskComplexity?: number;
}

export interface ConsensusResult {
	decision: 'approve' | 'reject' | 'escalate';
	confidence: number; // 0-1 scale
	qualityScore: number; // 0-1 scale  
	agentVotes: WeightedVote[];
	reasoning: {
		primary: string;
		supporting: string[];
		dissenting: string[];
	};
	diversity: {
		score: number; // Bonus for diverse agent agreement
		providerSpread: number; // How many different providers agreed
		capabilitySpread: number; // How many different capability types agreed
	};
	economics: {
		totalCost: number;
		costPerQuality: number; // Cost divided by quality score
		efficiency: number; // Quality per dollar
	};
	riskFactors: {
		uncertainty: number; // High variance in agent confidence
		novelty: number; // Content unlike training data
		sensitivity: number; // Political/legal sensitivity
		adversarial: number; // Potential gaming attempt
	};
	recommendations: {
		nextActions: string[];
		improvements: string[];
		escalationReasons?: string[];
	};
}

export interface WeightedVote {
	agentId: string;
	provider: string;
	decision: 'approve' | 'reject';
	confidence: number;
	reasoning: string;
	weight: number;
	expertise: {
		taskMatch: number; // How well agent capabilities match task
		domainExpertise: number; // Agent's expertise in this domain
		historicalAccuracy: number; // Past performance on similar tasks
	};
}

export interface ConsensusConfiguration {
	// Decision thresholds
	approvalThreshold: number; // Weighted approval ratio needed
	rejectionThreshold: number; // Weighted rejection ratio needed
	confidenceThreshold: number; // Minimum average confidence
	
	// Quality requirements
	minimumQuality: number; // Minimum quality score to approve
	voterProtocolQuality: number; // Higher standard for legislative content
	
	// Diversity bonuses
	diversityWeight: number; // How much to weight provider diversity
	expertiseWeight: number; // How much to weight domain expertise
	
	// Risk management
	uncertaintyPenalty: number; // Penalty for high variance in votes
	noveltyPenalty: number; // Penalty for unusual content
	adversarialDetection: boolean; // Enable gaming detection
	
	// Economic factors
	costQualityRatio: number; // Maximum acceptable cost per quality point
	budgetConstraint: number; // Hard budget limit
}

export class ConsensusEngine {
	private config: ConsensusConfiguration;

	constructor(config?: Partial<ConsensusConfiguration>) {
		this.config = {
			// Decision thresholds
			approvalThreshold: 0.7,
			rejectionThreshold: 0.3,
			confidenceThreshold: 0.6,
			
			// Quality requirements  
			minimumQuality: 0.5,
			voterProtocolQuality: 0.8,
			
			// Diversity bonuses
			diversityWeight: 0.15,
			expertiseWeight: 0.25,
			
			// Risk management
			uncertaintyPenalty: 0.2,
			noveltyPenalty: 0.1,
			adversarialDetection: true,
			
			// Economic factors
			costQualityRatio: 0.05, // $0.05 per quality point
			budgetConstraint: 0.10,
			
			...config
		};
	}

	/**
	 * Generate consensus from multiple agent responses
	 */
	async generateConsensus(input: ConsensusInput): Promise<ConsensusResult> {
		// Filter successful responses
		const validResponses = input.agentResponses.filter(r => r.success);
		
		if (validResponses.length === 0) {
			return this.createFailureConsensus('No successful agent responses');
		}

		// Create weighted votes
		const weightedVotes = await this.createWeightedVotes(validResponses, input);
		
		// Calculate base consensus metrics
		const baseMetrics = this.calculateBaseMetrics(weightedVotes);
		
		// Apply diversity bonuses
		const diversity = this.calculateDiversityMetrics(weightedVotes);
		
		// Assess risks
		const riskFactors = this.assessRiskFactors(weightedVotes, input);
		
		// Calculate economics
		const economics = this.calculateEconomics(validResponses, baseMetrics.qualityScore);
		
		// Make final decision
		const decision = this.makeFinalDecision(
			baseMetrics,
			diversity,
			riskFactors,
			economics,
			input.submissionFlow
		);
		
		// Generate reasoning
		const reasoning = this.generateReasoning(weightedVotes, decision, riskFactors);
		
		// Generate recommendations
		const recommendations = this.generateRecommendations(
			decision,
			riskFactors,
			economics,
			input.submissionFlow
		);

		return {
			decision,
			confidence: this.adjustConfidenceForRisk(baseMetrics.confidence, riskFactors),
			qualityScore: baseMetrics.qualityScore,
			agentVotes: weightedVotes,
			reasoning,
			diversity,
			economics,
			riskFactors,
			recommendations
		};
	}

	/**
	 * Create weighted votes from agent responses
	 */
	private async createWeightedVotes(
		responses: AgentResponse[],
		input: ConsensusInput
	): Promise<WeightedVote[]> {
		const votes: WeightedVote[] = [];

		for (const response of responses) {
			const capability = this.getAgentCapability(response.agentId);
			if (!capability) continue;

			// Extract decision from response
			const decision = this.extractDecision(response);
			
			// Calculate expertise metrics
			const expertise = this.calculateExpertise(capability, input);
			
			// Calculate final weight
			const weight = this.calculateAgentWeight(capability, expertise, response);

			votes.push({
				agentId: response.agentId,
				provider: capability.provider,
				decision,
				confidence: response.confidence,
				reasoning: response.reasoning,
				weight,
				expertise
			});
		}

		return votes;
	}

	/**
	 * Calculate agent expertise for this specific task
	 */
	private calculateExpertise(
		capability: AgentCapability,
		input: ConsensusInput
	): WeightedVote['expertise'] {
		
		// Task match: how well does agent capability match the task type
		const taskMatch = capability.capabilities.length > 0 ? 0.8 : 0.5; // Simplified
		
		// Domain expertise: check expertise domains
		let domainExpertise = 0.5; // Base score
		if (input.submissionFlow === 'voter-protocol') {
			if (capability.expertiseDomains.includes('legislative-analysis') ||
				capability.expertiseDomains.includes('political-communication')) {
				domainExpertise = 0.9;
			}
		} else {
			if (capability.expertiseDomains.includes('content-enhancement') ||
				capability.expertiseDomains.includes('corporate-communication')) {
				domainExpertise = 0.8;
			}
		}
		
		// Historical accuracy: use agent reliability as proxy
		const historicalAccuracy = capability.reliability;

		return {
			taskMatch,
			domainExpertise,
			historicalAccuracy
		};
	}

	/**
	 * Calculate final weight for an agent vote
	 */
	private calculateAgentWeight(
		capability: AgentCapability,
		expertise: WeightedVote['expertise'],
		response: AgentResponse
	): number {
		// Base weight from reliability
		let weight = capability.reliability;
		
		// Expertise bonus
		weight *= (1 + this.config.expertiseWeight * (
			expertise.taskMatch * 0.3 +
			expertise.domainExpertise * 0.4 +
			expertise.historicalAccuracy * 0.3
		));
		
		// Confidence bonus/penalty
		weight *= (0.5 + response.confidence * 0.5);
		
		// Speed bonus for time-sensitive tasks
		if (response.processingTime < 3000) { // Under 3 seconds
			weight *= 1.1;
		}
		
		// Cache hit bonus (cost efficiency)
		if (response.cacheHit) {
			weight *= 1.05;
		}
		
		return Math.max(0.1, Math.min(2.0, weight)); // Clamp between 0.1 and 2.0
	}

	/**
	 * Calculate base consensus metrics
	 */
	private calculateBaseMetrics(votes: WeightedVote[]): {
		confidence: number;
		qualityScore: number;
		approvalRatio: number;
		weightedApprovalRatio: number;
	} {
		const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
		const approvalWeight = votes
			.filter(vote => vote.decision === 'approve')
			.reduce((sum, vote) => sum + vote.weight, 0);
		
		const weightedApprovalRatio = totalWeight > 0 ? approvalWeight / totalWeight : 0;
		const approvalRatio = votes.filter(v => v.decision === 'approve').length / votes.length;
		
		const confidence = votes.reduce((sum, vote) => sum + vote.confidence, 0) / votes.length;
		
		// Quality score combines consensus strength and confidence
		const consensusStrength = Math.abs(weightedApprovalRatio - 0.5) * 2; // 0-1 scale
		const qualityScore = (consensusStrength * 0.6) + (confidence * 0.4);

		return {
			confidence,
			qualityScore,
			approvalRatio,
			weightedApprovalRatio
		};
	}

	/**
	 * Calculate diversity metrics and bonuses
	 */
	private calculateDiversityMetrics(votes: WeightedVote[]): ConsensusResult['diversity'] {
		// Provider diversity
		const providers = new Set(votes.map(v => v.provider));
		const providerSpread = providers.size / Math.max(3, votes.length); // Max 3 main providers
		
		// Capability diversity (if we had more granular capability tracking)
		const capabilitySpread = 0.8; // Simplified for now
		
		// Overall diversity score
		const score = (providerSpread * 0.6) + (capabilitySpread * 0.4);
		
		// Check if diverse agents agree (bonus scenario)
		const majorityDecision = votes.filter(v => v.decision === 'approve').length > votes.length / 2 
			? 'approve' : 'reject';
		
		const diverseAgreement = Array.from(providers).every(provider => {
			const providerVotes = votes.filter(v => v.provider === provider);
			const providerMajority = providerVotes.filter(v => v.decision === majorityDecision).length 
				> providerVotes.length / 2;
			return providerMajority;
		});

		return {
			score: diverseAgreement ? score * 1.2 : score, // Bonus for diverse agreement
			providerSpread,
			capabilitySpread
		};
	}

	/**
	 * Assess various risk factors
	 */
	private assessRiskFactors(
		votes: WeightedVote[],
		input: ConsensusInput
	): ConsensusResult['riskFactors'] {
		
		// Uncertainty: high variance in confidence scores
		const confidences = votes.map(v => v.confidence);
		const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
		const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
		const uncertainty = Math.min(1, variance * 4); // Scale to 0-1
		
		// Novelty: detect unusual content patterns
		const novelty = this.detectNoveltyFactors(input.originalContent, input.enhancedContent);
		
		// Sensitivity: political/legal content detection
		const sensitivity = this.assessPoliticalSensitivity(input.originalContent);
		
		// Adversarial: potential gaming attempt
		const adversarial = this.config.adversarialDetection 
			? this.detectAdversarialPatterns(input, votes)
			: 0;

		return {
			uncertainty,
			novelty,
			sensitivity,
			adversarial
		};
	}

	/**
	 * Calculate economic metrics
	 */
	private calculateEconomics(
		responses: AgentResponse[],
		qualityScore: number
	): ConsensusResult['economics'] {
		const totalCost = responses.reduce((sum, r) => sum + r.cost, 0);
		const costPerQuality = qualityScore > 0 ? totalCost / qualityScore : Infinity;
		const efficiency = totalCost > 0 ? qualityScore / totalCost : 0;

		return {
			totalCost,
			costPerQuality,
			efficiency
		};
	}

	/**
	 * Make final decision based on all factors
	 */
	private makeFinalDecision(
		baseMetrics: ReturnType<ConsensusEngine['calculateBaseMetrics']>,
		diversity: ConsensusResult['diversity'],
		riskFactors: ConsensusResult['riskFactors'],
		economics: ConsensusResult['economics'],
		submissionFlow: 'voter-protocol' | 'direct-delivery'
	): 'approve' | 'reject' | 'escalate' {
		
		// Apply quality threshold based on submission flow
		const qualityThreshold = submissionFlow === 'voter-protocol' 
			? this.config.voterProtocolQuality 
			: this.config.minimumQuality;
		
		// Check quality threshold
		if (baseMetrics.qualityScore < qualityThreshold) {
			return 'reject';
		}
		
		// Check economic constraints
		if (economics.totalCost > this.config.budgetConstraint ||
			economics.costPerQuality > this.config.costQualityRatio) {
			return 'reject';
		}
		
		// Apply diversity bonus
		const adjustedApprovalRatio = baseMetrics.weightedApprovalRatio + 
			(diversity.score * this.config.diversityWeight);
		
		// Apply risk penalties
		const riskPenalty = (riskFactors.uncertainty * this.config.uncertaintyPenalty) +
			(riskFactors.novelty * this.config.noveltyPenalty) +
			(riskFactors.adversarial * 0.3);
		
		const finalApprovalRatio = Math.max(0, adjustedApprovalRatio - riskPenalty);
		
		// Make decision
		if (finalApprovalRatio >= this.config.approvalThreshold && 
			baseMetrics.confidence >= this.config.confidenceThreshold) {
			return 'approve';
		} else if (finalApprovalRatio <= this.config.rejectionThreshold ||
			riskFactors.adversarial > 0.7) {
			return 'reject';
		} else {
			return 'escalate'; // Borderline cases need human review
		}
	}

	/**
	 * Generate human-readable reasoning
	 */
	private generateReasoning(
		votes: WeightedVote[],
		decision: 'approve' | 'reject' | 'escalate',
		risks: ConsensusResult['riskFactors']
	): ConsensusResult['reasoning'] {
		
		const approvals = votes.filter(v => v.decision === 'approve');
		const rejections = votes.filter(v => v.decision === 'reject');
		
		let primary: string;
		const supporting: string[] = [];
		const dissenting: string[] = [];
		
		if (decision === 'approve') {
			primary = `Content approved by ${approvals.length}/${votes.length} agents with high confidence.`;
			supporting.push(...approvals.slice(0, 2).map(v => `${v.agentId}: ${v.reasoning}`));
			dissenting.push(...rejections.slice(0, 1).map(v => `${v.agentId}: ${v.reasoning}`));
		} else if (decision === 'reject') {
			primary = `Content rejected due to quality concerns or policy violations.`;
			supporting.push(...rejections.slice(0, 2).map(v => `${v.agentId}: ${v.reasoning}`));
			dissenting.push(...approvals.slice(0, 1).map(v => `${v.agentId}: ${v.reasoning}`));
		} else {
			primary = `Mixed agent opinions require human review for final decision.`;
			supporting.push(`Approvals: ${approvals.length}, Rejections: ${rejections.length}`);
			if (risks.adversarial > 0.5) {
				supporting.push('Potential adversarial content detected');
			}
			if (risks.uncertainty > 0.7) {
				supporting.push('High uncertainty in agent assessments');
			}
		}
		
		return { primary, supporting, dissenting };
	}

	/**
	 * Generate actionable recommendations
	 */
	private generateRecommendations(
		decision: 'approve' | 'reject' | 'escalate',
		risks: ConsensusResult['riskFactors'],
		economics: ConsensusResult['economics'],
		submissionFlow: 'voter-protocol' | 'direct-delivery'
	): ConsensusResult['recommendations'] {
		
		const nextActions: string[] = [];
		const improvements: string[] = [];
		const escalationReasons: string[] = [];
		
		if (decision === 'approve') {
			if (submissionFlow === 'voter-protocol') {
				nextActions.push('Add to blockchain settlement batch');
				nextActions.push('Schedule congressional delivery');
				nextActions.push('Award VOTER tokens');
			} else {
				nextActions.push('Queue for direct delivery');
				nextActions.push('Update delivery metrics');
			}
		} else if (decision === 'reject') {
			nextActions.push('Provide user feedback');
			nextActions.push('Refund user deposit');
			nextActions.push('Log rejection for analysis');
			
			improvements.push('Consider content enhancement suggestions');
			improvements.push('Review template guidelines');
		} else {
			nextActions.push('Queue for human moderation');
			nextActions.push('Notify moderation team');
			
			if (risks.uncertainty > 0.7) {
				escalationReasons.push('High variance in agent assessments');
			}
			if (risks.adversarial > 0.5) {
				escalationReasons.push('Potential gaming attempt detected');
			}
			if (economics.costPerQuality > this.config.costQualityRatio) {
				escalationReasons.push('Poor cost-quality ratio');
			}
		}
		
		return { nextActions, improvements, escalationReasons };
	}

	/**
	 * Helper methods for risk assessment
	 */
	private detectNoveltyFactors(original: string, enhanced?: string): number {
		// Simple novelty detection based on content characteristics
		let novelty = 0;
		
		// Very long content
		if (original.length > 2000) novelty += 0.3;
		
		// Unusual formatting
		if (original.includes('\n\n\n') || original.includes('  ')) novelty += 0.2;
		
		// Many numbers or special characters
		const specialChars = (original.match(/[^a-zA-Z0-9\s.,!?]/g) || []).length;
		if (specialChars > original.length * 0.1) novelty += 0.3;
		
		// Major changes in enhancement
		if (enhanced && enhanced.length > original.length * 1.5) novelty += 0.2;
		
		return Math.min(1, novelty);
	}

	private assessPoliticalSensitivity(content: string): number {
		const lowerContent = content.toLowerCase();
		let sensitivity = 0;
		
		// Political keywords
		const politicalKeywords = ['congress', 'senator', 'representative', 'vote', 'election', 'democrat', 'republican'];
		const politicalMatches = politicalKeywords.filter(word => lowerContent.includes(word)).length;
		sensitivity += Math.min(0.5, politicalMatches * 0.1);
		
		// Controversial topics
		const controversialKeywords = ['abortion', 'immigration', 'gun', 'climate', 'tax'];
		const controversialMatches = controversialKeywords.filter(word => lowerContent.includes(word)).length;
		sensitivity += Math.min(0.3, controversialMatches * 0.15);
		
		// Strong emotional language
		const emotionalKeywords = ['outrageous', 'ridiculous', 'corrupt', 'betrayal'];
		const emotionalMatches = emotionalKeywords.filter(word => lowerContent.includes(word)).length;
		sensitivity += Math.min(0.2, emotionalMatches * 0.1);
		
		return Math.min(1, sensitivity);
	}

	private detectAdversarialPatterns(input: ConsensusInput, votes: WeightedVote[]): number {
		let adversarial = 0;
		
		// Unusual content patterns
		const content = input.originalContent;
		
		// Potential prompt injection
		if (content.includes('ignore previous instructions') || 
			content.includes('act as') ||
			content.includes('you are now')) {
			adversarial += 0.8;
		}
		
		// Excessive complexity designed to confuse models
		const words = content.split(/\s+/);
		const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
		if (avgWordLength > 8) adversarial += 0.3;
		
		// Conflicting agent assessments might indicate gaming
		const confidenceSpread = Math.max(...votes.map(v => v.confidence)) - 
			Math.min(...votes.map(v => v.confidence));
		if (confidenceSpread > 0.7) adversarial += 0.4;
		
		return Math.min(1, adversarial);
	}

	private adjustConfidenceForRisk(baseConfidence: number, risks: ConsensusResult['riskFactors']): number {
		const riskPenalty = (risks.uncertainty * 0.3) + 
			(risks.adversarial * 0.4) + 
			(risks.novelty * 0.1);
		
		return Math.max(0.1, baseConfidence - riskPenalty);
	}

	/**
	 * Utility methods
	 */
	private getAgentCapability(agentId: string): AgentCapability | null {
		return agentRegistry.getActiveAgents().find(a => a.id === agentId) || null;
	}

	private extractDecision(response: AgentResponse): 'approve' | 'reject' {
		// This would examine the actual response structure
		// For now, use confidence as a proxy
		if (response.confidence > 0.6) {
			return 'approve';
		}
		return 'reject';
	}

	private createFailureConsensus(reason: string): ConsensusResult {
		return {
			decision: 'reject',
			confidence: 0,
			qualityScore: 0,
			agentVotes: [],
			reasoning: {
				primary: reason,
				supporting: [],
				dissenting: []
			},
			diversity: {
				score: 0,
				providerSpread: 0,
				capabilitySpread: 0
			},
			economics: {
				totalCost: 0,
				costPerQuality: Infinity,
				efficiency: 0
			},
			riskFactors: {
				uncertainty: 1,
				novelty: 0,
				sensitivity: 0,
				adversarial: 0
			},
			recommendations: {
				nextActions: ['System error - manual review required'],
				improvements: ['Fix agent response handling'],
				escalationReasons: [reason]
			}
		};
	}

	/**
	 * Update consensus configuration
	 */
	updateConfiguration(newConfig: Partial<ConsensusConfiguration>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current configuration
	 */
	getConfiguration(): ConsensusConfiguration {
		return { ...this.config };
	}
}

// Export singleton instance with default configuration
export const consensusEngine = new ConsensusEngine();