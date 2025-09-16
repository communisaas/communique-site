/**
 * Base Agent Class
 * 
 * Abstract base for all VOTER Protocol agents implemented in TypeScript
 * Provides common functionality for N8N-orchestrated LLM agents
 */

import { N8NClient } from '$lib/services/delivery/integrations/n8n';

export interface AgentConfig {
	name: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	capabilities?: string[];
	workflowPrefix?: string; // e.g., 'llm-verification', 'llm-supply'
}

export interface AgentDecision {
	decision: string;
	confidence: number; // 0-1
	reasoning?: string[];
	metadata?: Record<string, any>;
}

export abstract class BaseAgent {
	protected config: AgentConfig;
	protected n8nClient: N8NClient;
	
	constructor(config: AgentConfig) {
		this.config = config;
		this.n8nClient = new N8NClient();
	}
	
	/**
	 * Main processing method to be implemented by each agent
	 */
	abstract process(input: any): Promise<AgentDecision>;
	
	/**
	 * Validation method to be implemented by each agent
	 */
	abstract validate(input: any): Promise<boolean>;
	
	/**
	 * Calculate effectiveness score for an outcome
	 */
	protected calculateEffectiveness(expected: any, actual: any): number {
		if (typeof expected === 'number' && typeof actual === 'number') {
			if (expected === 0) {
				return actual === 0 ? 1.0 : 0.0;
			}
			return Math.min(1.0, 1.0 - Math.abs(expected - actual) / expected);
		}
		return expected === actual ? 1.0 : 0.0;
	}
	
	/**
	 * Get agent name
	 */
	getName(): string {
		return this.config.name;
	}
	
	/**
	 * Get agent capabilities
	 */
	getCapabilities(): string[] {
		return this.config.capabilities || [];
	}
	
	/**
	 * Call LLM workflow via N8N
	 */
	protected async callLLMWorkflow(
		workflowType: string,
		input: any,
		model?: string
	): Promise<any> {
		const workflowName = `${this.config.workflowPrefix || 'llm'}-${workflowType}`;
		
		try {
			const result = await this.n8nClient.triggerWorkflow(workflowName, {
				agent_name: this.config.name,
				model: model || this.config.model,
				temperature: this.config.temperature || 0.7,
				max_tokens: this.config.maxTokens || 1000,
				input,
				timestamp: new Date().toISOString()
			});
			
			if (!result.success) {
				throw new Error(`N8N workflow ${workflowName} failed: ${result.error}`);
			}
			
			return result.data;
		} catch (error) {
			console.error(`LLM workflow ${workflowName} error:`, error);
			throw error;
		}
	}
	
	/**
	 * Wait for long-running LLM workflow completion
	 */
	protected async waitForLLMWorkflow(
		workflowType: string,
		input: any,
		maxWaitMs: number = 30000
	): Promise<any> {
		const workflowName = `${this.config.workflowPrefix || 'llm'}-${workflowType}`;
		
		try {
			const result = await this.n8nClient.triggerWorkflow(workflowName, {
				agent_name: this.config.name,
				model: this.config.model,
				temperature: this.config.temperature || 0.7,
				max_tokens: this.config.maxTokens || 1000,
				input,
				timestamp: new Date().toISOString()
			});
			
			if (!result.success) {
				throw new Error(`N8N workflow ${workflowName} failed: ${result.error}`);
			}
			
			// Wait for completion
			const completion = await this.n8nClient.waitForCompletion(
				result.executionId!,
				maxWaitMs
			);
			
			if (!completion.success) {
				throw new Error(`N8N workflow ${workflowName} timeout or error: ${completion.error}`);
			}
			
			return completion.data;
		} catch (error) {
			console.error(`Long-running LLM workflow ${workflowName} error:`, error);
			throw error;
		}
	}
}