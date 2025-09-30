/**
 * Reward Calculation API Endpoint
 *
 * Calculates rewards using Supply, Market, and Impact agents
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SupplyAgent, MarketAgent, ImpactAgent } from '$lib/agents';
import {
	extractSupplyDecision,
	extractMarketDecision,
	extractImpactDecision
} from '$lib/agents/shared/type-guards';

const supplyAgent = new SupplyAgent();
const marketAgent = new MarketAgent();
const impactAgent = new ImpactAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			userAddress,
			actionType,
			templateId,
			recipients = [],
			verificationScore = 1.0
		}: {
			userAddress: string;
			actionType: string;
			templateId?: string;
			recipients?: string[];
			verificationScore?: number;
		} = body;

		if (!userAddress || !actionType) {
			return json({ error: 'userAddress  and actionType required' }, { status: 400 });
		}

		// Calculate base reward with supply agent
		const supplyDecision = await supplyAgent.makeDecision({
			actionType,
			parameters: {
				userAddress,
				verificationScore
			}
		});

		// Apply market conditions
		const marketDecision = await marketAgent.makeDecision({
			actionType,
			parameters: {
				baseReward: extractSupplyDecision(supplyDecision.decision).rewardAmount
			}
		});

		// Calculate impact multiplier
		const impactDecision = await impactAgent.makeDecision({
			actionType,
			templateId: templateId || 'unknown',
			parameters: {
				recipients
			}
		});

		// Calculate final reward with improved type safety
		const supplyData = extractSupplyDecision(supplyDecision.decision);
		const marketData = extractMarketDecision(marketDecision.decision);
		const impactData = extractImpactDecision(impactDecision.decision);

		// Use finalRewardWei as the primary reward source, with rewardAmount as compatibility fallback
		const baseRewardWei = supplyData.finalRewardWei || '100000000000000000'; // 0.1 ETH default
		const marketMultiplier = marketData.rewardMultiplier;
		const impactMultiplier = impactData.impactMultiplier || 1.0;

		const finalReward = BigInt(
			Math.floor(Number(baseRewardWei) * marketMultiplier * impactMultiplier)
		);

		return json({
			success: true,
			reward: {
				amount: finalReward.toString(),
				formatted: `${Number(finalReward) / 10 ** 18} VOTER`
			},
			breakdown: {
				base: baseRewardWei,
				baseRewardUSD: supplyData.baseRewardUSD || 0.1,
				marketMultiplier,
				impactMultiplier,
				supplyImpact: supplyData.supplyImpact,
				impactScore: impactData.impactScore,
				marketSignal: marketData.marketSignal,
				finalRewardETH: supplyData.finalRewardETH || 0.05
			},
			agents: {
				supply: supplyDecision,
				market: marketDecision,
				impact: impactDecision
			}
		});
	} catch (error) {
		console.error('Error occurred');
		return json(
			{
				error: 'Reward calculation failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
