/**
 * Base Agent Class
 * 
 * Abstract base for all VOTER Protocol agents implemented in TypeScript
 * Provides common functionality for LLM-based agents
 */

export interface AgentConfig {
	name: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	capabilities?: string[];
}

export interface AgentDecision {
	decision: string;
	confidence: number; // 0-1
	reasoning?: string[];
	metadata?: Record<string, any>;
}

export abstract class BaseAgent {
	protected config: AgentConfig;
	
	constructor(config: AgentConfig) {
		this.config = config;
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
}