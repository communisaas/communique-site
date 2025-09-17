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
		const { userAddress, actionType, templateId, recipients = [], verificationScore = 1.0 } = body;

		if (!userAddress || !actionType) {
			return json({ error: 'userAddress and actionType required' }, { status: 400 });
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
				baseReward: supplyDecision.decision?.rewardAmount || 0
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

		// Calculate final reward
		const baseReward = supplyDecision.decision?.rewardAmount || 0;
		const marketMultiplier = marketDecision.decision?.rewardMultiplier || 1;
		const impactMultiplier = impactDecision.decision?.impactMultiplier || 1;
		
		const finalReward = BigInt(
			Math.floor(
				Number(baseReward) *
					marketMultiplier *
					impactMultiplier
			)
		);

		return json({
			success: true,
			reward: {
				amount: finalReward.toString(),
				formatted: `${Number(finalReward) / 10 ** 18} VOTER`
			},
			breakdown: {
				base: baseReward.toString(),
				marketMultiplier,
				impactMultiplier,
				supplyImpact: supplyDecision.decision?.supplyImpact || 0,
				impactScore: impactDecision.decision?.impactScore || 0,
				marketSignal: marketDecision.decision?.marketSignal || 'neutral'
			},
			agents: {
				supply: supplyDecision,
				market: marketDecision,
				impact: impactDecision
			}
		});
	} catch (_error) {
		console.error('Reward calculation error:', _error);
		return json({ error: 'Reward calculation failed', details: _error instanceof Error ? _error.message : 'Unknown error' }, { status: 500 });
	}
};
