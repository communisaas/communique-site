/**
 * Moderation Consensus - Multi-Agent Template Moderation
 *
 * Coordinates 3-agent voting system following VOTER Protocol principles:
 * - No single AI model has dictatorial control
 * - Transparent dissent and consensus tracking
 * - Continuous learning from agent disagreements
 *
 * Future: Will hand off approved templates to VOTER Protocol agents for on-chain rewards
 */

import { db } from '$lib/core/db';
import { consensusCoordinator } from './content/consensus-coordinator';
import type { ConsensusResult } from './content/consensus-coordinator';

export class ModerationConsensus {
	/**
	 * Evaluate a template using multi-agent consensus
	 */
	async evaluateTemplate(
		templateId: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery' = 'direct-delivery'
	): Promise<ConsensusResult> {
		try {
			console.log(`🔄 Starting multi-agent consensus: ${templateId} (${submissionFlow})`);

			// Use consensus coordinator for multi-agent voting
			const result = await consensusCoordinator.processTemplate(templateId, submissionFlow);

			// Log result for monitoring
			console.log(
				`✅ Consensus complete: ${result.approved ? 'APPROVED' : 'REJECTED'} ` +
					`(${result.consensusType}) for template ${templateId}`
			);

			// The consensus coordinator already handles VOTER Protocol triggering
			// when submissionFlow === 'voter-protocol'

			return result;
		} catch (error) {
			console.error(`❌ Consensus evaluation failed for ${templateId}:`, error);
			throw error;
		}
	}

	/**
	 * Get cost prediction for a template
	 */
	async predictCost(
		content: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery' = 'direct-delivery',
		userReputation?: number
	): Promise<number> {
		// Multi-agent consensus costs
		const unanimousCost = 0.00105; // OpenAI (FREE + enhancement) + Gemini
		const splitDecisionCost = 0.00145; // Above + Claude tie-breaker

		// Estimate likelihood of split decision based on content quality
		const needsEnhancement = content.length < 100 || !userReputation || userReputation < 50;
		const splitLikelihood = needsEnhancement ? 0.2 : 0.1;

		// Congressional check for CWC templates
		const congressionalCost = 0.00035;

		// Calculate expected cost
		let expectedCost = unanimousCost * (1 - splitLikelihood) + splitDecisionCost * splitLikelihood;

		// Add congressional check cost if likely CWC
		if (
			content.toLowerCase().includes('congress') ||
			content.toLowerCase().includes('representative')
		) {
			expectedCost += congressionalCost;
		}

		// Future: Add VOTER Protocol gas costs for on-chain flow
		const voterProtocolCost = submissionFlow === 'voter-protocol' ? 0.1 : 0;

		return expectedCost + voterProtocolCost;
	}

	/**
	 * Get template by ID (helper method)
	 */
	async getTemplate(templateId: string) {
		return db.template.findUnique({
			where: { id: templateId }
		});
	}

	/**
	 * Get consensus summary for monitoring
	 */
	async getConsensusSummary() {
		const costSummary = await consensusCoordinator.getCostSummary();
		const agentPerformance = consensusCoordinator.getAgentPerformance();

		return {
			costs: costSummary,
			agentPerformance,
			timestamp: new Date()
		};
	}

	/**
	 * Process user feedback on moderation decision
	 */
	async processFeedback(templateId: string, feedback: 'correct' | 'incorrect') {
		return consensusCoordinator.processFeedback(templateId, feedback);
	}
}

// Export singleton
export const moderationConsensus = new ModerationConsensus();
