/**
 * Reward Calculation API Endpoint
 * 
 * Calculates rewards using Supply, Market, and Impact agents
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SupplyAgent, MarketAgent, ImpactAgent } from '$lib/agents';

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
		} = body;
		
		if (!userAddress || !actionType) {
			return json(
				{ error: 'userAddress and actionType required' },
				{ status: 400 }
			);
		}
		
		// Calculate base reward with supply agent
		const supplyDecision = await supplyAgent.process({
			actionType,
			userAddress,
			verificationScore
		});
		
		// Apply market conditions
		const marketDecision = await marketAgent.process({
			baseReward: supplyDecision.rewardAmount,
			actionType
		});
		
		// Calculate impact multiplier
		const impactDecision = await impactAgent.process({
			actionType,
			recipients,
			templateId: templateId || 'unknown'
		});
		
		// Calculate final reward
		const finalReward = BigInt(
			Math.floor(
				Number(supplyDecision.rewardAmount) * 
				marketDecision.rewardMultiplier * 
				impactDecision.impactMultiplier
			)
		);
		
		return json({
			success: true,
			reward: {
				amount: finalReward.toString(),
				formatted: `${Number(finalReward) / 10**18} VOTER`
			},
			breakdown: {
				base: supplyDecision.rewardAmount.toString(),
				marketMultiplier: marketDecision.rewardMultiplier,
				impactMultiplier: impactDecision.impactMultiplier,
				supplyImpact: supplyDecision.supplyImpact,
				impactScore: impactDecision.impactScore,
				marketSignal: marketDecision.marketSignal
			},
			agents: {
				supply: supplyDecision,
				market: marketDecision,
				impact: impactDecision
			}
		});
		
	} catch (error) {
		console.error('Reward calculation error:', error);
		return json(
			{ error: 'Reward calculation failed', details: error.message },
			{ status: 500 }
		);
	}
};