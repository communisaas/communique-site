/**
 * Impact Agent
 * 
 * Measures civic impact and effectiveness of democratic participation
 * Tracks outcomes and adjusts rewards based on real-world impact
 */

import { BaseAgent, type AgentConfig, type AgentDecision } from './base-agent';

export interface ImpactInput {
	actionType: string;
	recipients: string[];
	templateId: string;
	historicalData?: {
		previousActions: number;
		successfulOutcomes: number;
		averageResponseTime: number;
	};
	districtMetrics?: {
		population: number;
		voterTurnout: number;
		engagementRate: number;
	};
}

export interface ImpactDecision extends AgentDecision {
	impactScore: number; // 0-100
	impactMultiplier: number; // 0.5-2.0
	impactCategory: 'high' | 'medium' | 'low' | 'negligible';
	predictedOutcomes: {
		responseChance: number;
		policyInfluence: number;
		communityReach: number;
	};
}

export class ImpactAgent extends BaseAgent {
	constructor() {
		super({
			name: 'impact_agent',
			temperature: 0.4,
			maxTokens: 1200,
			capabilities: ['impact_measurement', 'outcome_tracking', 'effectiveness_analysis']
		});
	}
	
	async process(input: ImpactInput): Promise<ImpactDecision> {
		const {
			actionType,
			recipients,
			templateId,
			historicalData = {},
			districtMetrics = {}
		} = input;
		
		// Calculate base impact score
		const baseImpact = this.calculateBaseImpact(actionType, recipients);
		
		// Apply historical effectiveness
		const historicalMultiplier = this.calculateHistoricalMultiplier(historicalData);
		
		// Apply district-specific factors
		const districtMultiplier = this.calculateDistrictMultiplier(districtMetrics);
		
		// Calculate predicted outcomes
		const predictedOutcomes = this.predictOutcomes(
			actionType,
			historicalData,
			districtMetrics
		);
		
		// Final impact score
		const impactScore = Math.min(100, baseImpact * historicalMultiplier * districtMultiplier);
		
		// Determine impact category
		const impactCategory = this.categorizeImpact(impactScore);
		
		// Calculate reward multiplier based on impact
		const impactMultiplier = this.calculateImpactMultiplier(impactScore);
		
		return {
			decision: 'impact_assessed',
			confidence: 0.7,
			reasoning: [
				`Action type: ${actionType}`,
				`Recipients: ${recipients.length}`,
				`Base impact: ${baseImpact.toFixed(0)}`,
				`Historical effectiveness: ${historicalMultiplier.toFixed(2)}x`,
				`District factor: ${districtMultiplier.toFixed(2)}x`,
				`Final impact score: ${impactScore.toFixed(0)}/100`
			],
			impactScore,
			impactMultiplier,
			impactCategory,
			predictedOutcomes
		};
	}
	
	async validate(input: any): Promise<boolean> {
		return input?.actionType && Array.isArray(input?.recipients);
	}
	
	/**
	 * Calculate base impact score
	 */
	private calculateBaseImpact(actionType: string, recipients: string[]): number {
		let score = 50; // Base score
		
		// Action type impacts
		switch (actionType) {
			case 'cwc_message':
				score = 70; // Congressional messages have high base impact
				break;
			case 'direct_action':
				score = 60; // Direct action has moderate impact
				break;
			case 'challenge_market':
				score = 80; // Challenge markets have high impact on discourse
				break;
		}
		
		// Recipient count impacts (diminishing returns)
		if (recipients.length === 1) {
			score *= 1.0; // Single targeted message
		} else if (recipients.length <= 3) {
			score *= 1.1; // Small group
		} else if (recipients.length <= 10) {
			score *= 1.2; // Moderate group
		} else {
			score *= 1.15; // Large group (diminishing returns)
		}
		
		return score;
	}
	
	/**
	 * Calculate multiplier based on historical effectiveness
	 */
	private calculateHistoricalMultiplier(historicalData: any): number {
		const {
			previousActions = 0,
			successfulOutcomes = 0,
			averageResponseTime = 30
		} = historicalData;
		
		if (previousActions === 0) {
			return 1.0; // No history, neutral multiplier
		}
		
		// Success rate
		const successRate = successfulOutcomes / previousActions;
		
		// Response time factor (faster responses = higher impact)
		const responseFactor = averageResponseTime < 7 ? 1.2 : 
							   averageResponseTime < 14 ? 1.1 : 
							   averageResponseTime < 30 ? 1.0 : 0.9;
		
		// Combine factors
		return (0.5 + successRate) * responseFactor;
	}
	
	/**
	 * Calculate district-specific multiplier
	 */
	private calculateDistrictMultiplier(districtMetrics: any): number {
		const {
			population = 700000, // Average district size
			voterTurnout = 0.5,
			engagementRate = 0.1
		} = districtMetrics;
		
		// Smaller districts = higher individual impact
		const populationFactor = 700000 / population;
		
		// Lower engagement = higher marginal impact
		const engagementFactor = engagementRate < 0.05 ? 1.3 :
								 engagementRate < 0.1 ? 1.2 :
								 engagementRate < 0.2 ? 1.1 : 1.0;
		
		// Combine factors (capped at 1.5x)
		return Math.min(1.5, populationFactor * engagementFactor);
	}
	
	/**
	 * Predict likely outcomes
	 */
	private predictOutcomes(
		actionType: string,
		historicalData: any,
		districtMetrics: any
	): ImpactDecision['predictedOutcomes'] {
		// Simple prediction model (would use ML in production)
		const baseResponseChance = actionType === 'cwc_message' ? 0.3 : 0.2;
		const basePolicyInfluence = actionType === 'challenge_market' ? 0.4 : 0.2;
		const baseCommunityReach = districtMetrics.population ? 
			Math.min(1000 / districtMetrics.population, 0.01) : 0.001;
		
		return {
			responseChance: Math.min(1, baseResponseChance * (1 + (historicalData.successRate || 0))),
			policyInfluence: Math.min(1, basePolicyInfluence),
			communityReach: Math.min(1, baseCommunityReach * 100)
		};
	}
	
	/**
	 * Categorize impact level
	 */
	private categorizeImpact(score: number): ImpactDecision['impactCategory'] {
		if (score >= 80) return 'high';
		if (score >= 60) return 'medium';
		if (score >= 30) return 'low';
		return 'negligible';
	}
	
	/**
	 * Calculate reward multiplier based on impact
	 */
	private calculateImpactMultiplier(impactScore: number): number {
		// Linear scaling from 0.5x to 2.0x
		return 0.5 + (impactScore / 100) * 1.5;
	}
	
	/**
	 * Track outcome of an action for learning
	 */
	async trackOutcome(
		actionId: string,
		outcome: 'response_received' | 'policy_changed' | 'no_response'
	): Promise<void> {
		// In production, would store in database for learning
		console.log(`Tracking outcome for ${actionId}: ${outcome}`);
	}
}