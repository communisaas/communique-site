/**
 * VOTER Protocol Agents
 *
 * Export all agent implementations for use in Communiqué
 */

export { BaseAgent } from './base-agent';
export type { AgentConfig, AgentDecision } from './base-agent';

export { VerificationAgent } from './verification-agent';
export type { VerificationInput, VerificationResult } from './verification-agent';

export { SupplyAgent } from './supply-agent';
export type { SupplyInput, SupplyDecision } from './supply-agent';

export { MarketAgent } from './market-agent';
export type { MarketInput, MarketDecision } from './market-agent';

export { ImpactAgent } from './impact-agent';
export type { ImpactInput, ImpactDecision } from './impact-agent';

export { ReputationAgent } from './reputation-agent';
export type { ReputationInput, ReputationDecision } from './reputation-agent';

// Re-export existing moderation consensus
export { moderationConsensus, ModerationConsensus } from './moderation-consensus';

// Import agents for coordinator
import { VerificationAgent } from './verification-agent';
import { SupplyAgent } from './supply-agent';
import { MarketAgent } from './market-agent';
import { ImpactAgent } from './impact-agent';
import { ReputationAgent } from './reputation-agent';

/**
 * Agent Coordinator
 * Simple coordinator that provides access to all agents
 */
export class AgentCoordinator {
	readonly verification = new VerificationAgent();
	readonly supply = new SupplyAgent();
	readonly market = new MarketAgent();
	readonly impact = new ImpactAgent();
	readonly reputation = new ReputationAgent();

	/**
	 * Process civic action through all agents
	 */
	async processCivicAction(params: {
		userAddress: string;
		actionType: 'cwc_message' | 'direct_action' | 'challenge_market';
		template: unknown;
		recipients: string[];
	}) {
		// Run verification
		const verification = await this.verification.process({
			template: params.template
		});

		if (!verification.approved) {
			return {
				approved: false,
				reason: verification.reasoning?.join(', ')
			};
		}

		// Calculate supply impact
		const supply = await this.supply.process({
			actionType: params.actionType,
			userAddress: params.userAddress,
			verificationScore: verification.confidence
		});

		// Analyze market conditions
		const market = await this.market.process({
			baseReward: supply.rewardAmount,
			actionType: params.actionType
		});

		// Measure impact
		const impact = await this.impact.process({
			actionType: params.actionType,
			recipients: params.recipients,
			templateId: params.template.id
		});

		// Update reputation
		const reputation = await this.reputation.process({
			userAddress: params.userAddress,
			actionType: params.actionType,
			qualityScore: verification.confidence * 100
		});

		// Calculate final reward
		const finalReward = BigInt(
			Math.floor(Number(supply.rewardAmount) * market.rewardMultiplier * impact.impactMultiplier)
		);

		return {
			approved: true,
			reward: finalReward,
			verification,
			supply,
			market,
			impact,
			reputation
		};
	}
}

// Export singleton coordinator
export const agentCoordinator = new AgentCoordinator();
