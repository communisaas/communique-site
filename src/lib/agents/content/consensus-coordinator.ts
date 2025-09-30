/**
 * Consensus Coordinator - Multi-Agent Template Moderation
 *
 * Coordinates 3-agent voting system for template approval/rejection.
 * Uses different AI models to avoid single-point-of-failure in content moderation.
 */

import { db } from '$lib/core/db';
import type { Template } from '@prisma/client';

export interface ConsensusResult {
	readonly approved: boolean;
	readonly consensusType: 'unanimous' | 'majority' | 'split';
	readonly agentDecisions: AgentDecision[];
	readonly finalReasoning: string;
	readonly confidence: number;
	readonly cost: number;
	readonly templateId: string;
	readonly submissionFlow: 'voter-protocol' | 'direct-delivery';
}

export interface AgentDecision {
	readonly agentName: string;
	readonly decision: 'approve' | 'reject';
	readonly reasoning: string;
	readonly confidence: number;
	readonly cost: number;
	readonly timestamp: string;
}

export interface AgentPerformance {
	readonly totalDecisions: number;
	readonly correctDecisions: number;
	readonly accuracy: number;
	readonly averageConfidence: number;
	readonly totalCost: number;
}

export interface CostSummary {
	readonly totalCost: number;
	readonly averageCostPerTemplate: number;
	readonly costByAgent: Record<string, number>;
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
}

/**
 * Consensus Coordinator for multi-agent template moderation
 */
export class ConsensusCoordinator {
	private agentPerformance: Map<string, AgentPerformance> = new Map();

	/**
	 * Process template through multi-agent consensus
	 */
	async processTemplate(
		templateId: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery' = 'direct-delivery'
	): Promise<ConsensusResult> {
		console.log(`🔄 Processing template ${templateId} with ${submissionFlow} flow`);

		// Get template data
		const template = await this.getTemplate(templateId);
		if (!template) {
			throw new Error(`Template not found: ${templateId}`);
		}

		// Run agents in parallel for efficiency
		const agentDecisions = await Promise.all([
			this.runOpenAIAgent(template),
			this.runGeminiAgent(template)
			// Claude agent only called for tie-breaking if needed
		]);

		// Check if we need Claude for tie-breaking
		const openAIDecision = agentDecisions[0];
		const geminiDecision = agentDecisions[1];

		let claudeDecision: AgentDecision | null = null;
		if (openAIDecision.decision !== geminiDecision.decision) {
			console.log('🤔 Split decision detected, calling Claude for tie-breaking');
			claudeDecision = await this.runClaudeAgent(template);
			agentDecisions.push(claudeDecision);
		}

		// Determine consensus
		const consensus = this.determineConsensus(agentDecisions);
		const totalCost = agentDecisions.reduce((sum, decision) => sum + decision.cost, 0);

		const result: ConsensusResult = {
			approved: consensus.approved,
			consensusType: consensus.type,
			agentDecisions,
			finalReasoning: consensus.reasoning,
			confidence: consensus.confidence,
			cost: totalCost,
			templateId,
			submissionFlow
		};

		// Update agent performance tracking
		this.updateAgentPerformance(agentDecisions);

		// Trigger VOTER Protocol if applicable
		if (submissionFlow === 'voter-protocol' && result.approved) {
			await this.triggerVoterProtocol(templateId, result);
		}

		return result;
	}

	/**
	 * Get cost summary for monitoring
	 */
	async getCostSummary(): Promise<CostSummary> {
		// This would typically query a database of past decisions
		// For now, return mock data
		return {
			totalCost: 0.05,
			averageCostPerTemplate: 0.00125,
			costByAgent: {
				'openai-free': 0.02,
				'gemini-flash': 0.015,
				'claude-sonnet': 0.015
			},
			period: {
				start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
				end: new Date().toISOString()
			}
		};
	}

	/**
	 * Get agent performance metrics
	 */
	getAgentPerformance(): Record<string, AgentPerformance> {
		const performance: Record<string, AgentPerformance> = {};

		this.agentPerformance.forEach((perf, agentName) => {
			performance[agentName] = perf;
		});

		return performance;
	}

	/**
	 * Process user feedback on moderation decision
	 */
	async processFeedback(templateId: string, feedback: 'correct' | 'incorrect'): Promise<void> {
		console.log(`📝 Processing feedback for template ${templateId}: ${feedback}`);

		// This would update agent performance metrics
		// Implementation depends on feedback storage strategy
	}

	/**
	 * Run OpenAI moderation agent
	 */
	private async runOpenAIAgent(template: Template): Promise<AgentDecision> {
		// Mock implementation - would call actual OpenAI API
		const decision: AgentDecision = {
			agentName: 'openai-free',
			decision: template.message_body.length > 50 ? 'approve' : 'reject',
			reasoning:
				template.message_body.length > 50
					? 'Template has sufficient content and appears constructive'
					: 'Template content is too brief for effective civic engagement',
			confidence: 0.85,
			cost: 0.0001, // OpenAI free tier
			timestamp: new Date().toISOString()
		};

		console.log(`🤖 OpenAI decision: ${decision.decision} (${decision.confidence})`);
		return decision;
	}

	/**
	 * Run Gemini moderation agent
	 */
	private async runGeminiAgent(template: Template): Promise<AgentDecision> {
		// Mock implementation - would call actual Gemini API
		const decision: AgentDecision = {
			agentName: 'gemini-flash',
			decision: !template.message_body.toLowerCase().includes('hate') ? 'approve' : 'reject',
			reasoning: !template.message_body.toLowerCase().includes('hate')
				? 'Content appears constructive and policy-focused'
				: 'Content may contain inappropriate language',
			confidence: 0.82,
			cost: 0.00005, // Gemini Flash pricing
			timestamp: new Date().toISOString()
		};

		console.log(`🤖 Gemini decision: ${decision.decision} (${decision.confidence})`);
		return decision;
	}

	/**
	 * Run Claude moderation agent (tie-breaker only)
	 */
	private async runClaudeAgent(template: Template): Promise<AgentDecision> {
		// Mock implementation - would call actual Claude API
		const decision: AgentDecision = {
			agentName: 'claude-sonnet',
			decision: template.message_body.split(' ').length > 10 ? 'approve' : 'reject',
			reasoning:
				template.message_body.split(' ').length > 10
					? 'Template demonstrates thoughtful civic engagement with sufficient detail'
					: 'Template lacks detail necessary for meaningful legislative communication',
			confidence: 0.88,
			cost: 0.0015, // Claude Sonnet pricing
			timestamp: new Date().toISOString()
		};

		console.log(`🤖 Claude tie-breaker decision: ${decision.decision} (${decision.confidence})`);
		return decision;
	}

	/**
	 * Determine final consensus from agent decisions
	 */
	private determineConsensus(decisions: AgentDecision[]): {
		approved: boolean;
		type: 'unanimous' | 'majority' | 'split';
		reasoning: string;
		confidence: number;
	} {
		const approvals = decisions.filter((d) => d.decision === 'approve').length;
		const rejections = decisions.filter((d) => d.decision === 'reject').length;

		if (approvals === decisions.length) {
			return {
				approved: true,
				type: 'unanimous',
				reasoning: 'All agents unanimously approved this template for civic engagement',
				confidence: Math.min(...decisions.map((d) => d.confidence))
			};
		}

		if (rejections === decisions.length) {
			return {
				approved: false,
				type: 'unanimous',
				reasoning: 'All agents unanimously rejected this template due to quality concerns',
				confidence: Math.min(...decisions.map((d) => d.confidence))
			};
		}

		if (approvals > rejections) {
			return {
				approved: true,
				type: 'majority',
				reasoning: `Majority consensus (${approvals}/${decisions.length}) approved this template`,
				confidence:
					decisions
						.filter((d) => d.decision === 'approve')
						.reduce((sum, d) => sum + d.confidence, 0) / approvals
			};
		}

		return {
			approved: false,
			type: 'majority',
			reasoning: `Majority consensus (${rejections}/${decisions.length}) rejected this template`,
			confidence:
				decisions.filter((d) => d.decision === 'reject').reduce((sum, d) => sum + d.confidence, 0) /
				rejections
		};
	}

	/**
	 * Update agent performance tracking
	 */
	private updateAgentPerformance(decisions: AgentDecision[]): void {
		decisions.forEach((decision) => {
			const current = this.agentPerformance.get(decision.agentName) || {
				totalDecisions: 0,
				correctDecisions: 0,
				accuracy: 0,
				averageConfidence: 0,
				totalCost: 0
			};

			const updated: AgentPerformance = {
				totalDecisions: current.totalDecisions + 1,
				correctDecisions: current.correctDecisions, // Would be updated with feedback
				accuracy: current.correctDecisions / (current.totalDecisions + 1),
				averageConfidence:
					(current.averageConfidence * current.totalDecisions + decision.confidence) /
					(current.totalDecisions + 1),
				totalCost: current.totalCost + decision.cost
			};

			this.agentPerformance.set(decision.agentName, updated);
		});
	}

	/**
	 * Trigger VOTER Protocol for on-chain rewards
	 */
	private async triggerVoterProtocol(templateId: string, result: ConsensusResult): Promise<void> {
		console.log(`🔗 Triggering VOTER Protocol for approved template ${templateId}`);

		// This would integrate with the VOTER Protocol coordinator
		// For now, just log the intent
		console.log(
			`📊 VOTER Protocol integration: ${JSON.stringify({
				templateId,
				approved: result.approved,
				confidence: result.confidence,
				consensusType: result.consensusType
			})}`
		);
	}

	/**
	 * Get template by ID
	 */
	private async getTemplate(templateId: string): Promise<Template | null> {
		return db.template.findUnique({
			where: { id: templateId }
		});
	}
}

// Export singleton
export const consensusCoordinator = new ConsensusCoordinator();
