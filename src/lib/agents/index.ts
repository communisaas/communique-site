/**
 * Agent System Exports
 *
 * Two clear systems:
 * 1. Content moderation (off-chain) - Template processing
 * 2. VOTER Protocol (future on-chain) - Rewards and reputation
 */

// Shared base classes
export { BaseAgent } from './shared/base-agent';
export type { AgentDecision } from './shared/base-agent';

// Content moderation (off-chain MVP) - Multi-agent consensus system
export { aiModeration } from './content/ai-moderation';
export { consensusCoordinator } from './content/consensus-coordinator';
export { moderationConsensus, ModerationConsensus } from './moderation-consensus';

// Export types from new moderation system
export type { ModerationResult, AgentVote } from './content/ai-moderation';
export type {
	ConsensusResult,
	CostTracking,
	AgentPerformance
} from './content/consensus-coordinator';
export { ModerationSeverity } from './content/ai-moderation';

// VOTER Protocol agents (future on-chain)
export { VerificationAgent } from './voter-protocol/verification-agent';
export type { VerificationAssessment } from './voter-protocol/verification-agent';

export { SupplyAgent } from './voter-protocol/supply-agent';
export type { RewardParameters } from './voter-protocol/supply-agent';

export { MarketAgent } from './voter-protocol/market-agent';
export type { MarketInput, MarketDecision } from './voter-protocol/market-agent';

export { ImpactAgent } from './voter-protocol/impact-agent';
export type {
	ImpactAssessment,
	LegislativeOutcome,
	CausalChain
} from './voter-protocol/impact-agent';

export { ReputationAgent } from './voter-protocol/reputation-agent';
export type { CredibilityAssessment, ERC8004Attestation } from './voter-protocol/reputation-agent';

// Type guards
export type { VerificationSource } from './shared/type-guards';
export {
	extractSupplyDecision,
	extractMarketDecision,
	extractImpactDecision
} from './shared/type-guards';

// Import agents for coordinator
import { VerificationAgent } from './voter-protocol/verification-agent';
import { SupplyAgent } from './voter-protocol/supply-agent';
import { MarketAgent } from './voter-protocol/market-agent';
import { ImpactAgent } from './voter-protocol/impact-agent';
import { ReputationAgent } from './voter-protocol/reputation-agent';
import {
	extractSupplyDecision,
	extractMarketDecision,
	extractImpactDecision
} from './shared/type-guards';

/**
 * VOTER Protocol Agent Coordinator
 *
 * Future on-chain coordination for rewards and reputation.
 * Keep this for future integration but not used in off-chain MVP.
 */
export class VOTERProtocolCoordinator {
	readonly verification = new VerificationAgent();
	readonly supply = new SupplyAgent();
	readonly market = new MarketAgent();
	readonly impact = new ImpactAgent();
	readonly reputation = new ReputationAgent();

	/**
	 * Process civic action through all VOTER Protocol agents
	 * (Not used in off-chain MVP, kept for future on-chain integration)
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
			templateId: (params.template as { id?: string })?.id,
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
				baseReward: extractSupplyDecision(supply.decision).finalRewardWei || '1000000000000000000',
				marketConditions: {},
				participationTrends: {}
			}
		});

		// Measure impact
		const impact = await this.impact.makeDecision({
			userId: params.userAddress,
			actionType: params.actionType,
			templateId: (params.template as { id?: string })?.id,
			parameters: {
				recipients: params.recipients,
				templateId: (params.template as { id?: string })?.id
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

		// Calculate final reward with type safety
		const supplyDecision = extractSupplyDecision(supply.decision);
		const marketDecision = extractMarketDecision(market.decision);
		const impactDecision = extractImpactDecision(impact.decision);

		const baseReward = supplyDecision.finalRewardWei || '1000000000000000000';
		const marketMultiplier = marketDecision.rewardMultiplier || 1.0;
		const impactMultiplier = impactDecision.impactScore > 0 ? 1.1 : 1.0; // Simple impact bonus

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

// Export singleton coordinator (for future use)
export const voterProtocolCoordinator = new VOTERProtocolCoordinator();
