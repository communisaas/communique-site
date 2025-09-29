/**
 * Multi-Agent Moderation Consensus - Agent-Agnostic Architecture
 *
 * Modern agent-agnostic system for template moderation.
 * Supports both VOTER Protocol and direct delivery flows.
 * Dynamic agent selection based on latest models (GPT-5, Gemini 2.5).
 * Economic optimization and sophisticated consensus with risk assessment.
 */

import { db } from '$lib/core/db';
import { taskOrchestrator } from './orchestrator/task-orchestrator';
import { budgetManager } from './economics/budget-manager';

export class ModerationConsensus {
	/**
	 * Evaluate a template using the agent-agnostic system
	 */
	async evaluateTemplate(
		templateId: string, 
		submissionFlow: 'voter-protocol' | 'direct-delivery' = 'direct-delivery',
		userBudget: number = 0.10
	) {
		try {
			console.log(`🔄 Starting template evaluation: ${templateId} (${submissionFlow})`);
			
			const result = await taskOrchestrator.processTemplate(templateId, submissionFlow, userBudget);
			
			// Update template with processing results
			await this.updateTemplate(templateId, result);
			
			console.log(`✅ Template evaluation completed: ${result.finalDecision} (confidence: ${result.confidence})`);
			
			return result;
			
		} catch (error) {
			console.error(`❌ Template evaluation failed for ${templateId}:`, error);
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
	) {
		return budgetManager.predictTemplateCost(content, submissionFlow, userReputation);
	}

	/**
	 * Check if user can afford template processing
	 */
	async checkUserBudget(userId: string, estimatedCost: number) {
		const spendingPattern = await budgetManager.getUserSpendingSummary(userId);
		
		if (!spendingPattern) {
			return {
				canAfford: true,
				currentSpending: 0,
				recommendations: ['First-time user - standard processing available']
			};
		}
		
		const canAfford = spendingPattern.dailySpent + estimatedCost <= 10; // $10 daily limit
		
		return {
			canAfford,
			currentSpending: spendingPattern.dailySpent,
			recommendations: canAfford 
				? ['Processing within budget limits']
				: ['Daily budget exceeded - consider premium plan or wait until tomorrow']
		};
	}

	/**
	 * Update template with processing results
	 */
	private async updateTemplate(templateId: string, result: any) {
		await db.template.update({
			where: { id: templateId },
			data: {
				// Agent-agnostic fields
				processing_pipeline: result.metadata || {},
				agent_assignments: result.consensus.agentVotes || [],
				consensus_weights: result.consensus.agentVotes.map((v: any) => ({ 
					agentId: v.agentId, 
					weight: v.weight 
				})),
				budget_allocated: result.processing?.totalCost || 0,
				cost_breakdown: result.processing?.stages || [],
				enhanced_content: result.content?.enhanced,
				change_log: result.content?.changeLog || [],
				submission_flow: result.metadata?.submissionFlow,
				processing_stages: result.processing?.stages || [],
				total_processing_time: result.processing?.totalTime,
				cache_efficiency: result.processing?.cacheEfficiency,
				consensus_quality: result.metadata?.qualityScore,
				toxicity_classification: result.metadata?.riskAssessment?.toxicityLevel,
				political_sensitivity: result.metadata?.riskAssessment?.politicalSensitivity,
				adversarial_score: result.metadata?.riskAssessment?.adversarial,
				verification_status: result.finalDecision === 'approved' ? 'approved' : 'rejected',
				reviewed_at: new Date()
			}
		});
	}
}

// Export singleton instance
export const moderationConsensus = new ModerationConsensus();