/**
 * Multi-Agent Moderation Consensus
 *
 * Handles Stage 2 of template moderation:
 * - Evaluates templates with severity 7+ using multiple LLMs
 * - Implements weighted voting across different models
 * - Prevents groupthink through agent diversity
 */

import { db } from '$lib/core/db';
// import { N8NClient } from '$lib/services/delivery/integrations/n8n';
import type { Template, TemplateVerification } from '@prisma/client';

interface AgentVote {
	approved: boolean;
	confidence: number; // 0-1
	reasons?: string[];
	violations?: ViolationType[];
}

interface ConsensusResult {
	score: number; // 0-1 weighted average
	approved: boolean;
	agentVotes: Record<string, AgentVote>;
	diversityScore: number; // Bonus for diverse agreement
}

type ViolationType =
	| 'hate_speech'
	| 'threats'
	| 'malicious_links'
	| 'impersonation'
	| 'spam_patterns'
	| 'misinformation';

export class ModerationConsensus {
	// N8N client for workflow orchestration
	// private n8nClient: N8NClient;

	// Agent configuration with weights
	private agents = {
		openai: {
			weight: 0.5,
			enabled: true,
			model: 'gpt-4-turbo-preview' // Will use GPT-5 when available
		},
		gemini: {
			weight: 0.4,
			enabled: true,
			model: 'gemini-1.5-flash'
		},
		anthropic: {
			weight: 0.1,
			enabled: false, // Stubbed for future
			model: 'claude-3-opus'
		},
		local: {
			weight: 0.0,
			enabled: false, // Not used in demo
			model: 'llama-3'
		}
	};

	// Approval threshold (can be agent-optimized later)
	private readonly APPROVAL_THRESHOLD = 0.3; // Low threshold for demo (only blocking severe violations)

	constructor() {
		// this.n8nClient = new N8NClient();
	}

	/**
	 * Evaluate a template using multi-agent consensus
	 */
	async evaluateTemplate(verificationId: string): Promise<ConsensusResult> {
		const verification = await db.templateVerification.findUnique({
			where: { id: verificationId },
			include: { template: true }
		});

		if (!verification) {
			throw new Error(`Verification ${verificationId} not found`);
		}

		// Only check templates with severity 7+
		if (!verification.severity_level || verification.severity_level < 7) {
			// Auto-approve lower severity
			return {
				score: 1.0,
				approved: true,
				agentVotes: {},
				diversityScore: 0
			};
		}

		// Collect votes from enabled agents
		const votes: Record<string, AgentVote> = {};

		if (this.agents.openai.enabled) {
			votes.openai = await this.checkWithOpenAI(verification.template);
		}

		if (this.agents.gemini.enabled) {
			votes.gemini = await this.checkWithGemini(verification.template);
		}

		if (this.agents.anthropic.enabled) {
			// Stubbed for future
			votes.anthropic = this.getMockVote('anthropic');
		}

		// Calculate weighted consensus
		const consensus = this.calculateConsensus(votes);

		// Update verification with results
		await db.templateVerification.update({
			where: { id: verificationId },
			data: {
				agent_votes: votes as any,
				consensus_score: consensus.score,
				moderation_status: consensus.approved ? 'approved' : 'rejected',
				reviewed_at: new Date()
			}
		});

		return consensus;
	}

	/**
	 * Check template with OpenAI via N8N workflow
	 */
	private async checkWithOpenAI(template: Template): Promise<AgentVote> {
		try {
			// Temporary: N8N client is commented out, using mock response
			console.warn('OpenAI N8N workflow disabled, using mock response');
			return this.getMockVote('openai');
		} catch (_error) {
			console.error('OpenAI N8N workflow error:', _error);
			// Default to approval on error (fail open)
			return {
				approved: true,
				confidence: 0.5,
				reasons: ['N8N workflow error, defaulting to approval']
			};
		}
	}

	/**
	 * Check template with Google Gemini via N8N workflow
	 */
	private async checkWithGemini(template: Template): Promise<AgentVote> {
		try {
			// Temporary: N8N client is commented out, using mock response
			console.warn('Gemini N8N workflow disabled, using mock response');
			return this.getMockVote('gemini');
		} catch (_error) {
			console.error('Gemini N8N workflow error:', _error);
			// Default to approval on error (fail open)
			return {
				approved: true,
				confidence: 0.5,
				reasons: ['N8N workflow error, defaulting to approval']
			};
		}
	}

	/**
	 * Calculate weighted consensus from agent votes
	 */
	private calculateConsensus(votes: Record<string, AgentVote>): ConsensusResult {
		let weightedSum = 0;
		let totalWeight = 0;
		let approvalCount = 0;
		const agentCount = Object.keys(votes).length;

		// Calculate weighted average
		for (const [agent, vote] of Object.entries(votes)) {
			const agentConfig = this.agents[agent as keyof typeof this.agents];
			if (!agentConfig || !agentConfig.enabled) continue;

			const weight = agentConfig.weight;
			const score = vote.approved ? vote.confidence : 1 - vote.confidence;

			weightedSum += score * weight;
			totalWeight += weight;

			if (vote.approved) {
				approvalCount++;
			}
		}

		// Calculate consensus score
		const consensusScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

		// Calculate diversity bonus (reward when different models agree)
		const diversityScore =
			agentCount > 1
				? (approvalCount / agentCount) * (agentCount / Object.keys(this.agents).length)
				: 0;

		// Apply diversity bonus to consensus
		const finalScore = Math.min(1, consensusScore + diversityScore * 0.1);

		return {
			score: finalScore,
			approved: finalScore >= this.APPROVAL_THRESHOLD,
			agentVotes: votes,
			diversityScore
		};
	}

	/**
	 * Get mock vote for testing/stubbed agents
	 */
	private getMockVote(agent: string): AgentVote {
		// Mock responses for testing
		// In production, these would be actual API calls

		const mockVotes: Record<string, AgentVote> = {
			openai: {
				approved: true,
				confidence: 0.85,
				reasons: ['No severe violations detected'],
				violations: []
			},
			gemini: {
				approved: true,
				confidence: 0.75,
				reasons: ['Content appears to be legitimate political discourse'],
				violations: []
			},
			anthropic: {
				approved: true,
				confidence: 0.9,
				reasons: ['Constitutional analysis finds no harmful content'],
				violations: []
			},
			local: {
				approved: true,
				confidence: 0.7,
				reasons: ['Local model analysis complete'],
				violations: []
			}
		};

		return (
			mockVotes[agent] || {
				approved: true,
				confidence: 0.5,
				reasons: ['Default mock response']
			}
		);
	}

	/**
	 * Check if a specific violation type is present
	 */
	async checkForViolation(template: Template, violationType: ViolationType): Promise<boolean> {
		const verification = await db.templateVerification.findUnique({
			where: { template_id: template.id }
		});

		if (!verification || !verification.agent_votes) {
			return false;
		}

		// Type guard to ensure agent_votes is the expected format
		const isValidAgentVotes = (data: any): data is Record<string, AgentVote> => {
			return typeof data === 'object' && data !== null && !Array.isArray(data);
		};

		if (!isValidAgentVotes(verification.agent_votes)) {
			return false;
		}

		const votes = verification.agent_votes;

		// Check if any agent detected this specific violation
		for (const vote of Object.values(votes)) {
			if (vote && vote.violations?.includes(violationType)) {
				return true;
			}
		}

		return false;
	}
}

// Export singleton instance
export const moderationConsensus = new ModerationConsensus();
