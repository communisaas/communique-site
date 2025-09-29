/**
 * Universal Agent Interface - Provider-Agnostic Base Classes
 * 
 * Supports both VOTER Protocol and direct delivery flows through unified interfaces.
 * Enables seamless switching between OpenAI, Google, Anthropic, and future providers.
 */

import type { AgentCapability, AgentTask } from '../registry/agent-registry';

export interface AgentResponse {
	agentId: string;
	success: boolean;
	result: unknown;
	confidence: number; // 0-1 scale
	reasoning: string;
	cost: number; // Actual cost in USD
	tokensUsed: { 
		input: number; 
		output: number; 
		thinking?: number;
		cached?: number;
	};
	cacheHit: boolean;
	processingTime: number; // milliseconds
	metadata?: {
		modelVersion?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		stopSequences?: string[];
	};
	error?: string;
}

export interface ProviderCredentials {
	apiKey: string;
	baseUrl?: string;
	organization?: string;
	project?: string;
}

export interface ProcessingOptions {
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	stopSequences?: string[];
	enableThinking?: boolean;
	enableCaching?: boolean;
	timeoutMs?: number;
}

/**
 * Base abstract class for all AI agents
 */
export abstract class BaseAgent {
	protected capability: AgentCapability;
	protected credentials: ProviderCredentials;

	constructor(capability: AgentCapability, credentials: ProviderCredentials) {
		this.capability = capability;
		this.credentials = credentials;
	}

	/**
	 * Execute a task using this agent
	 */
	abstract execute(task: AgentTask, options?: ProcessingOptions): Promise<AgentResponse>;

	/**
	 * Health check to verify agent is operational
	 */
	abstract healthCheck(): Promise<boolean>;

	/**
	 * Get current pricing for this agent
	 */
	abstract getCurrentPricing(): Promise<AgentCapability['costPerMToken']>;

	/**
	 * Estimate cost for a given task
	 */
	estimateCost(task: AgentTask): number {
		// Rough estimation based on content length
		const estimatedInputTokens = Math.ceil(task.content.length / 4); // ~4 chars per token
		const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.3); // Assume 30% output ratio
		
		return (
			(estimatedInputTokens / 1000000) * this.capability.costPerMToken.input +
			(estimatedOutputTokens / 1000000) * this.capability.costPerMToken.output
		);
	}

	/**
	 * Check if agent can handle specific task type
	 */
	canHandle(taskType: AgentTask['type']): boolean {
		return this.capability.capabilities.includes(taskType);
	}

	/**
	 * Get agent metadata
	 */
	getCapability(): AgentCapability {
		return { ...this.capability };
	}

	/**
	 * Update agent reliability based on performance
	 */
	updateReliability(newReliability: number): void {
		this.capability.reliability = Math.max(0, Math.min(1, newReliability));
		this.capability.lastUpdated = new Date();
	}
}

/**
 * Screening-specific agent for toxicity and content classification
 */
export abstract class ScreeningAgent extends BaseAgent {
	/**
	 * Classify content toxicity level
	 */
	abstract classifyToxicity(content: string): Promise<{
		level: 0 | 1 | 2 | 3 | 4; // Clean, Rough, Aggressive, Hostile, Toxic
		confidence: number;
		flags: string[];
		reasoning: string;
	}>;

	/**
	 * Fast binary approval/rejection for simple cases
	 */
	abstract quickApproval(content: string): Promise<{
		approved: boolean;
		confidence: number;
		reasoning: string;
	}>;
}

/**
 * Enhancement-specific agent for content improvement
 */
export abstract class EnhancementAgent extends BaseAgent {
	/**
	 * Enhance content while preserving intent
	 */
	abstract enhanceContent(
		originalContent: string,
		targetAudience: 'legislative' | 'corporate' | 'advocacy',
		preserveIntent: boolean = true
	): Promise<{
		enhancedContent: string;
		changes: Array<{
			type: 'grammar' | 'tone' | 'structure' | 'professionalism';
			original: string;
			enhanced: string;
			reasoning: string;
		}>;
		qualityScore: number; // 0-1 scale
		intentPreserved: boolean;
	}>;

	/**
	 * Generate explanation of changes made
	 */
	abstract explainChanges(
		original: string,
		enhanced: string
	): Promise<{
		summary: string;
		improvements: string[];
		preservedElements: string[];
	}>;
}

/**
 * Reasoning-specific agent for complex analysis
 */
export abstract class ReasoningAgent extends BaseAgent {
	/**
	 * Perform complex reasoning about content appropriateness
	 */
	abstract analyzeContent(
		content: string,
		context: {
			submissionFlow: 'voter-protocol' | 'direct-delivery';
			targetAudience: string;
			politicalContext?: string;
			userReputation?: number;
		}
	): Promise<{
		appropriate: boolean;
		confidence: number;
		reasoning: string;
		risks: string[];
		recommendations: string[];
		constitutionalAnalysis?: string; // For VOTER Protocol flow
	}>;

	/**
	 * Resolve conflicts between other agents
	 */
	abstract resolveConflict(
		conflictingResponses: AgentResponse[],
		originalTask: AgentTask
	): Promise<{
		resolution: 'approve' | 'reject' | 'escalate';
		confidence: number;
		reasoning: string;
		finalRecommendation: string;
	}>;
}

/**
 * Consensus-specific agent for final decisions
 */
export abstract class ConsensusAgent extends BaseAgent {
	/**
	 * Make final consensus decision based on multiple inputs
	 */
	abstract makeConsensusDecision(
		agentResponses: AgentResponse[],
		originalContent: string,
		enhancedContent?: string
	): Promise<{
		decision: 'approve' | 'reject';
		confidence: number;
		reasoning: string;
		minorityOpinions: string[];
		qualityAssessment: number; // 0-1 scale
	}>;

	/**
	 * Validate that enhanced content maintains original intent
	 */
	abstract validateIntentPreservation(
		originalContent: string,
		enhancedContent: string
	): Promise<{
		intentPreserved: boolean;
		confidence: number;
		deviations: string[];
		recommendations: string[];
	}>;
}

/**
 * Factory for creating provider-specific agents
 */
export abstract class AgentFactory {
	abstract createScreeningAgent(capability: AgentCapability, credentials: ProviderCredentials): ScreeningAgent;
	abstract createEnhancementAgent(capability: AgentCapability, credentials: ProviderCredentials): EnhancementAgent;
	abstract createReasoningAgent(capability: AgentCapability, credentials: ProviderCredentials): ReasoningAgent;
	abstract createConsensusAgent(capability: AgentCapability, credentials: ProviderCredentials): ConsensusAgent;
}

/**
 * Provider-specific error types
 */
export class AgentError extends Error {
	constructor(
		public agentId: string,
		public errorType: 'rate_limit' | 'invalid_request' | 'auth_failed' | 'service_unavailable' | 'timeout' | 'unknown',
		message: string,
		public retryable: boolean = false,
		public retryAfterMs?: number
	) {
		super(message);
		this.name = 'AgentError';
	}
}

/**
 * Agent response validation utilities
 */
export class ResponseValidator {
	static validateScreeningResponse(response: unknown): response is AgentResponse {
		return (
			typeof response === 'object' &&
			response !== null &&
			'agentId' in response &&
			'success' in response &&
			'result' in response &&
			'confidence' in response &&
			'reasoning' in response
		);
	}

	static validateEnhancementResponse(response: unknown): response is AgentResponse {
		return this.validateScreeningResponse(response) && 
			typeof (response as AgentResponse).result === 'object';
	}

	static validateConsensusResponse(response: unknown): response is AgentResponse {
		return this.validateScreeningResponse(response) &&
			typeof (response as AgentResponse).result === 'object' &&
			'decision' in ((response as AgentResponse).result as object);
	}
}

/**
 * Performance tracking utilities
 */
export interface PerformanceTracker {
	trackExecution(agentId: string, task: AgentTask, response: AgentResponse): void;
	getAgentPerformance(agentId: string): Promise<{
		totalTasks: number;
		successRate: number;
		averageLatency: number;
		averageCost: number;
		reliabilityTrend: number;
	}>;
	getOptimalAgentForTask(taskType: AgentTask['type'], constraints: any): Promise<string>;
}

/**
 * Agent capability assessment
 */
export class CapabilityAssessor {
	/**
	 * Test agent capability with known examples
	 */
	static async assessAgent(agent: BaseAgent): Promise<{
		overallScore: number;
		capabilities: Record<string, number>;
		reliability: number;
		recommendations: string[];
	}> {
		const testTasks = this.generateTestTasks();
		const results: AgentResponse[] = [];

		for (const task of testTasks) {
			try {
				const response = await agent.execute(task);
				results.push(response);
			} catch (error) {
				results.push({
					agentId: agent.getCapability().id,
					success: false,
					result: null,
					confidence: 0,
					reasoning: `Assessment failed: ${error}`,
					cost: 0,
					tokensUsed: { input: 0, output: 0 },
					cacheHit: false,
					processingTime: 0,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return this.calculateAssessmentScore(results);
	}

	private static generateTestTasks(): AgentTask[] {
		return [
			{
				type: 'screening',
				submissionFlow: 'voter-protocol',
				priority: 'normal',
				maxCost: 0.01,
				maxLatency: 5000,
				content: 'This is a test message for Congressional representatives about healthcare policy.',
				context: { targetAudience: 'legislative' }
			},
			{
				type: 'enhancement',
				submissionFlow: 'direct-delivery',
				priority: 'normal',
				maxCost: 0.05,
				maxLatency: 10000,
				content: 'ur healthcare sucks fix it now!!!!',
				context: { targetAudience: 'corporate' }
			}
		];
	}

	private static calculateAssessmentScore(results: AgentResponse[]): {
		overallScore: number;
		capabilities: Record<string, number>;
		reliability: number;
		recommendations: string[];
	} {
		const successfulResults = results.filter(r => r.success);
		const successRate = successfulResults.length / results.length;
		
		const averageConfidence = successfulResults.length > 0 
			? successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
			: 0;

		const averageLatency = results.length > 0
			? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
			: 0;

		const overallScore = (successRate * 0.5) + (averageConfidence * 0.3) + 
			(Math.max(0, 1 - averageLatency / 10000) * 0.2);

		return {
			overallScore,
			capabilities: {
				reliability: successRate,
				confidence: averageConfidence,
				speed: Math.max(0, 1 - averageLatency / 10000)
			},
			reliability: successRate,
			recommendations: this.generateRecommendations(results)
		};
	}

	private static generateRecommendations(results: AgentResponse[]): string[] {
		const recommendations: string[] = [];
		
		const averageLatency = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
		if (averageLatency > 5000) {
			recommendations.push('Consider using for non-time-critical tasks only');
		}

		const errorRate = results.filter(r => !r.success).length / results.length;
		if (errorRate > 0.1) {
			recommendations.push('Implement robust error handling and retries');
		}

		const averageCost = results.reduce((sum, r) => sum + r.cost, 0) / results.length;
		if (averageCost > 0.05) {
			recommendations.push('Monitor costs closely, consider for high-value tasks only');
		}

		return recommendations;
	}
}