/**
 * VOTER Protocol Agents
 *
 * Export all agent implementations for use in Communiqué
 */

export { BaseAgent } from './base-agent';
export type { AgentDecision } from './base-agent';

export { VerificationAgent } from './verification-agent';
export type { VerificationAssessment, VerificationSource } from './verification-agent';

export { SupplyAgent } from './supply-agent';
export type { RewardParameters } from './supply-agent';

export { MarketAgent } from './market-agent';
export type { MarketInput, MarketDecision } from './market-agent';

export { ImpactAgent } from './impact-agent';
export type { ImpactAssessment, LegislativeOutcome, CausalChain } from './impact-agent';

export { ReputationAgent } from './reputation-agent';
export type { CredibilityAssessment, ERC8004Attestation } from './reputation-agent';

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
		const verification = await this.verification.makeDecision({
			userId: params.userAddress,
			templateId: params.template?.id,
			actionType: params.actionType,
			parameters: { template: params.template }
		});

		if (verification.confidence < 0.5) {
			return {
				approved: false,
				reason: verification.reasoning
			};
		}

		// Calculate supply impact
		const supply = await this.supply.makeDecision({
			userId: params.userAddress,
			actionType: params.actionType,
			parameters: { 
				verificationScore: verification.confidence,
				baseReward: '1000000000000000000' // 1 token default
			}
		});

		// Analyze market conditions
		const market = await this.market.makeDecision({
			userId: params.userAddress,
			actionType: params.actionType,
			parameters: {
				baseReward: (supply.decision as any)?.finalRewardWei || '1000000000000000000',
				marketConditions: {},
				participationTrends: {}
			}
		});

		// Measure impact
		const impact = await this.impact.makeDecision({
			userId: params.userAddress,
			actionType: params.actionType,
			templateId: (params.template as any)?.id,
			parameters: {
				recipients: params.recipients,
				templateId: (params.template as any)?.id
			}
		});

		// Update reputation
		const reputation = await this.reputation.makeDecision({
			userId: params.userAddress,
			actionType: params.actionType,
			parameters: {
				qualityScore: verification.confidence * 100
			}
		});

		// Calculate final reward
		const baseReward = (supply.decision as any)?.finalRewardWei || '1000000000000000000';
		const marketMultiplier = (market.decision as any)?.rewardMultiplier || 1.0;
		const impactMultiplier = (impact.decision as any)?.impactMultiplier || 1.0;
		
		const finalReward = BigInt(
			Math.floor(Number(baseReward) * marketMultiplier * impactMultiplier)
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
