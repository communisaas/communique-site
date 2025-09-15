/**
 * Market Agent
 * 
 * Handles reward optimization and incentive design based on market conditions
 * Analyzes participation patterns and adjusts rewards dynamically
 */

import { BaseAgent, type AgentConfig, type AgentDecision } from './base-agent';

export interface MarketInput {
	baseReward: bigint;
	actionType: string;
	marketConditions?: {
		tokenPrice?: number;
		volume24h?: number;
		marketCap?: number;
		volatility?: number;
	};
	participationTrends?: {
		dailyActive: number;
		weeklyActive: number;
		growthRate: number;
	};
}

export interface MarketDecision extends AgentDecision {
	rewardMultiplier: number;
	incentiveAdjustments: {
		urgencyBonus: number;
		qualityBonus: number;
		consistencyBonus: number;
	};
	marketSignal: 'bullish' | 'neutral' | 'bearish';
}

export class MarketAgent extends BaseAgent {
	constructor() {
		super({
			name: 'market_agent',
			temperature: 0.5,
			maxTokens: 800,
			capabilities: ['reward_optimization', 'incentive_design', 'market_dynamics']
		});
	}
	
	async process(input: MarketInput): Promise<MarketDecision> {
		const { baseReward, actionType, marketConditions = {}, participationTrends = {} } = input;
		
		// Analyze market signal
		const marketSignal = this.analyzeMarketSignal(marketConditions);
		
		// Calculate reward multiplier based on market conditions
		const marketMultiplier = this.calculateMarketMultiplier(marketSignal, marketConditions);
		
		// Calculate participation multiplier
		const participationMultiplier = this.calculateParticipationMultiplier(participationTrends);
		
		// Calculate incentive adjustments
		const incentiveAdjustments = this.calculateIncentiveAdjustments(
			actionType,
			participationTrends,
			marketConditions
		);
		
		// Final multiplier combines all factors
		const rewardMultiplier = 
			marketMultiplier * 
			participationMultiplier * 
			(1 + incentiveAdjustments.urgencyBonus) *
			(1 + incentiveAdjustments.qualityBonus) *
			(1 + incentiveAdjustments.consistencyBonus);
		
		return {
			decision: 'optimize_rewards',
			confidence: 0.75,
			reasoning: [
				`Market signal: ${marketSignal}`,
				`Market multiplier: ${marketMultiplier.toFixed(2)}x`,
				`Participation multiplier: ${participationMultiplier.toFixed(2)}x`,
				`Total multiplier: ${rewardMultiplier.toFixed(2)}x`
			],
			rewardMultiplier,
			incentiveAdjustments,
			marketSignal
		};
	}
	
	async validate(input: any): Promise<boolean> {
		return input?.baseReward !== undefined && input?.actionType;
	}
	
	/**
	 * Analyze market conditions to determine signal
	 */
	private analyzeMarketSignal(conditions: any): 'bullish' | 'neutral' | 'bearish' {
		const { tokenPrice = 0, volume24h = 0, volatility = 0 } = conditions;
		
		// Simple heuristic for market signal
		if (volatility > 50) return 'bearish'; // High volatility = bearish
		if (volume24h > 1000000 && tokenPrice > 0.1) return 'bullish';
		if (volume24h < 10000 || tokenPrice < 0.01) return 'bearish';
		
		return 'neutral';
	}
	
	/**
	 * Calculate market-based reward multiplier
	 */
	private calculateMarketMultiplier(
		signal: 'bullish' | 'neutral' | 'bearish',
		conditions: any
	): number {
		switch (signal) {
			case 'bullish':
				// Reduce rewards in bull market (prevent inflation)
				return 0.8;
			case 'bearish':
				// Increase rewards in bear market (encourage participation)
				return 1.3;
			default:
				return 1.0;
		}
	}
	
	/**
	 * Calculate participation-based multiplier
	 */
	private calculateParticipationMultiplier(trends: any): number {
		const { dailyActive = 0, weeklyActive = 0, growthRate = 0 } = trends;
		
		// Growth phase: increase rewards
		if (growthRate > 20) return 1.2;
		
		// Decline phase: increase rewards to retain users
		if (growthRate < -10) return 1.3;
		
		// Stable phase: normal rewards
		return 1.0;
	}
	
	/**
	 * Calculate specific incentive adjustments
	 */
	private calculateIncentiveAdjustments(
		actionType: string,
		trends: any,
		conditions: any
	): MarketDecision['incentiveAdjustments'] {
		const adjustments = {
			urgencyBonus: 0,
			qualityBonus: 0,
			consistencyBonus: 0
		};
		
		// Urgency bonus for time-sensitive actions
		if (actionType === 'cwc_message') {
			// Congressional messages get urgency bonus during session
			const now = new Date();
			const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
			const isBusinessHours = now.getHours() >= 9 && now.getHours() <= 17;
			
			if (isWeekday && isBusinessHours) {
				adjustments.urgencyBonus = 0.1; // 10% bonus
			}
		}
		
		// Quality bonus (would be based on verification score in practice)
		adjustments.qualityBonus = 0.05; // 5% for quality content
		
		// Consistency bonus for regular participants
		// In practice, would check user history
		adjustments.consistencyBonus = 0.05; // 5% for consistent participation
		
		return adjustments;
	}
	
	/**
	 * Predict optimal reward level for target participation
	 */
	async predictOptimalReward(
		targetParticipation: number,
		currentParticipation: number
	): Promise<number> {
		const gap = targetParticipation - currentParticipation;
		const gapPercentage = gap / targetParticipation;
		
		// Simple linear model for reward adjustment
		if (gapPercentage > 0.5) {
			return 1.5; // 50% increase needed
		} else if (gapPercentage > 0.2) {
			return 1.2; // 20% increase needed
		} else if (gapPercentage < -0.2) {
			return 0.8; // Reduce by 20% (over target)
		}
		
		return 1.0; // On target
	}
}