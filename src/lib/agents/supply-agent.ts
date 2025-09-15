/**
 * Supply Agent
 * 
 * Handles dynamic token supply calculations and reward optimization
 * Balances economic incentives with sustainable tokenomics
 */

import { BaseAgent, type AgentConfig, type AgentDecision } from './base-agent';

export interface SupplyInput {
	actionType: 'cwc_message' | 'direct_action' | 'challenge_market';
	userAddress: string;
	verificationScore?: number;
	currentSupply?: bigint;
	currentParticipation?: number;
}

export interface SupplyDecision extends AgentDecision {
	rewardAmount: bigint;
	supplyImpact: number; // Percentage impact on total supply
	economicRationale: string;
}

export class SupplyAgent extends BaseAgent {
	// Base rewards by action type (in wei)
	private readonly BASE_REWARDS = {
		cwc_message: 10n * 10n ** 18n, // 10 VOTER
		direct_action: 5n * 10n ** 18n, // 5 VOTER
		challenge_market: 15n * 10n ** 18n // 15 VOTER
	};
	
	// Supply constraints
	private readonly MAX_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1B tokens
	private readonly DAILY_MINT_CAP = 1_000_000n * 10n ** 18n; // 1M tokens/day
	
	constructor() {
		super({
			name: 'supply_agent',
			temperature: 0.3,
			maxTokens: 1000,
			capabilities: ['supply_calculation', 'mint_optimization', 'economic_modeling']
		});
	}
	
	async process(input: SupplyInput): Promise<SupplyDecision> {
		const { actionType, verificationScore = 1.0, currentSupply = 0n, currentParticipation = 0 } = input;
		
		// Calculate base reward
		const baseReward = this.BASE_REWARDS[actionType] || 5n * 10n ** 18n;
		
		// Apply verification score multiplier
		const verificationMultiplier = Math.max(0.5, Math.min(1.5, verificationScore));
		
		// Calculate participation multiplier (higher participation = lower rewards)
		const participationMultiplier = this.calculateParticipationMultiplier(currentParticipation);
		
		// Calculate supply multiplier (more supply = lower rewards)
		const supplyMultiplier = this.calculateSupplyMultiplier(currentSupply);
		
		// Calculate final reward
		const finalMultiplier = verificationMultiplier * participationMultiplier * supplyMultiplier;
		const rewardAmount = BigInt(Math.floor(Number(baseReward) * finalMultiplier));
		
		// Calculate supply impact
		const supplyImpact = currentSupply > 0n 
			? Number(rewardAmount * 100n / currentSupply) / 100
			: 0;
		
		return {
			decision: 'mint_tokens',
			confidence: 0.9,
			reasoning: [
				`Base reward for ${actionType}: ${Number(baseReward) / 10**18} VOTER`,
				`Verification score multiplier: ${verificationMultiplier.toFixed(2)}`,
				`Participation multiplier: ${participationMultiplier.toFixed(2)}`,
				`Supply multiplier: ${supplyMultiplier.toFixed(2)}`,
				`Final reward: ${Number(rewardAmount) / 10**18} VOTER`
			],
			rewardAmount,
			supplyImpact,
			economicRationale: this.generateEconomicRationale(actionType, finalMultiplier)
		};
	}
	
	async validate(input: any): Promise<boolean> {
		return input?.actionType && input?.userAddress;
	}
	
	/**
	 * Calculate participation multiplier
	 * Higher participation = lower individual rewards
	 */
	private calculateParticipationMultiplier(participation: number): number {
		if (participation < 100) return 1.5; // Early adopter bonus
		if (participation < 1000) return 1.2;
		if (participation < 10000) return 1.0;
		if (participation < 100000) return 0.8;
		return 0.6; // Mature network
	}
	
	/**
	 * Calculate supply multiplier
	 * More tokens in circulation = lower rewards
	 */
	private calculateSupplyMultiplier(currentSupply: bigint): number {
		const supplyPercentage = Number(currentSupply * 100n / this.MAX_SUPPLY);
		
		if (supplyPercentage < 1) return 2.0; // Very early stage
		if (supplyPercentage < 5) return 1.5;
		if (supplyPercentage < 10) return 1.2;
		if (supplyPercentage < 25) return 1.0;
		if (supplyPercentage < 50) return 0.8;
		if (supplyPercentage < 75) return 0.6;
		return 0.4; // Near max supply
	}
	
	/**
	 * Generate economic rationale for the decision
	 */
	private generateEconomicRationale(actionType: string, multiplier: number): string {
		if (multiplier > 1.2) {
			return `High reward multiplier (${multiplier.toFixed(2)}x) due to early participation and low supply. Encouraging growth phase.`;
		} else if (multiplier > 0.8) {
			return `Standard reward multiplier (${multiplier.toFixed(2)}x) reflecting balanced network growth and sustainable tokenomics.`;
		} else {
			return `Conservative reward multiplier (${multiplier.toFixed(2)}x) to maintain supply stability as network matures.`;
		}
	}
	
	/**
	 * Check if minting is within daily limits
	 */
	async checkDailyLimits(todaysMinted: bigint, requestedAmount: bigint): Promise<boolean> {
		return todaysMinted + requestedAmount <= this.DAILY_MINT_CAP;
	}
	
	/**
	 * Calculate optimal staking APR based on current conditions
	 */
	async calculateStakingAPR(stakedPercentage: number): Promise<number> {
		// Target 30-50% staked
		if (stakedPercentage < 30) {
			return 15; // 15% APR to encourage staking
		} else if (stakedPercentage < 50) {
			return 10; // 10% APR at optimal range
		} else {
			return 7; // 7% APR when over-staked
		}
	}
}