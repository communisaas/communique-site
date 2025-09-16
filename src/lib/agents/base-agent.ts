/**
 * Base Agent Architecture for VOTER Protocol
 *
 * Implements the foundational agent system that replaces hardcoded parameters
 * with intelligent, adaptive decision-making within auditable safety rails.
 *
 * "Death to hardcoded tyranny" - agents optimize for human flourishing
 */

export interface AgentDecision {
	agentId: string;
	agentType: AgentType;
	decision: any;
	confidence: number; // 0-1 scale
	reasoning: string;
	parameters: Record<string, any>;
	timestamp: Date;
	safetyBounds?: {
		min?: number;
		max?: number;
		validRange?: [number, number];
	};
}

export interface AgentConsensus {
	decisions: AgentDecision[];
	consensusReached: boolean;
	consensusConfidence: number;
	finalDecision: any;
	dissent?: string[];
	timestamp: Date;
}

export enum AgentType {
	SUPPLY = 'supply',
	VERIFICATION = 'verification',
	MARKET = 'market',
	IMPACT = 'impact',
	REPUTATION = 'reputation',
	COORDINATOR = 'coordinator'
}

export interface AgentContext {
	userId?: string;
	actionType?: string;
	templateId?: string;
	timestamp?: string;
	historicalData?: any;
	networkConditions?: {
		dailyActiveUsers: number;
		totalActions: number;
		recentActivity: any[];
	};
	safetyRails?: Record<string, [number, number]>; // [min, max] bounds
}

export abstract class BaseAgent {
	protected agentId: string;
	protected agentType: AgentType;
	protected safetyBounds: Record<string, [number, number]>;

	constructor(
		agentId: string,
		agentType: AgentType,
		safetyBounds: Record<string, [number, number]> = {}
	) {
		this.agentId = agentId;
		this.agentType = agentType;
		this.safetyBounds = safetyBounds;
	}

	abstract makeDecision(context: AgentContext): Promise<AgentDecision>;

	protected applySafetyBounds(value: number, parameterName: string): number {
		const bounds = this.safetyBounds[parameterName];
		if (!bounds) return value;

		const [min, max] = bounds;
		return Math.max(min, Math.min(max, value));
	}

	protected createDecision(
		decision: any,
		confidence: number,
		reasoning: string,
		parameters: Record<string, any> = {}
	): AgentDecision {
		return {
			agentId: this.agentId,
			agentType: this.agentType,
			decision,
			confidence,
			reasoning,
			parameters,
			timestamp: new Date(),
			safetyBounds: parameters.parameterName
				? {
						min: this.safetyBounds[parameters.parameterName]?.[0],
						max: this.safetyBounds[parameters.parameterName]?.[1]
					}
				: undefined
		};
	}
}

export class AgentCoordinator {
	private agents: Map<AgentType, BaseAgent> = new Map();
	private consensusThreshold: number = 0.7;

	registerAgent(agent: BaseAgent): void {
		this.agents.set(agent['agentType'], agent);
	}

	async coordinateDecision(
		context: AgentContext,
		requiredAgents: AgentType[]
	): Promise<AgentConsensus> {
		const decisions: AgentDecision[] = [];

		// Collect decisions from required agents
		for (const agentType of requiredAgents) {
			const agent = this.agents.get(agentType);
			if (!agent) {
				throw new Error(`Required agent ${agentType} not registered`);
			}

			const decision = await agent.makeDecision(context);
			decisions.push(decision);
		}

		// Calculate consensus
		const averageConfidence =
			decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
		const consensusReached = averageConfidence >= this.consensusThreshold;

		// Simple consensus - in production this would be more sophisticated
		const finalDecision = consensusReached ? this.calculateConsensusDecision(decisions) : null;

		return {
			decisions,
			consensusReached,
			consensusConfidence: averageConfidence,
			finalDecision,
			dissent: consensusReached
				? undefined
				: decisions
						.filter((d) => d.confidence < this.consensusThreshold)
						.map((d) => `${d.agentId}: ${d.reasoning}`),
			timestamp: new Date()
		};
	}

	private calculateConsensusDecision(decisions: AgentDecision[]): any {
		// This is a simplified consensus mechanism
		// In production, this would be much more sophisticated
		// and specific to the type of decision being made

		if (decisions.length === 0) return null;

		// For now, take the decision from the highest confidence agent
		return decisions.reduce((highest, current) =>
			current.confidence > highest.confidence ? current : highest
		).decision;
	}
}

/**
 * Memory interface for agent learning
 */
export interface AgentMemory {
	storeDecision(decision: AgentDecision, outcome?: any): Promise<void>;
	queryHistory(context: AgentContext, limit?: number): Promise<AgentDecision[]>;
	learnFromOutcome(decisionId: string, outcome: any, effectiveness: number): Promise<void>;
}

/**
 * Vector memory implementation for sophisticated pattern matching
 */
export class VectorAgentMemory implements AgentMemory {
	// This would integrate with ChromaDB in production
	// For now, simplified in-memory storage
	private decisions: Map<string, AgentDecision> = new Map();
	private outcomes: Map<string, any> = new Map();

	async storeDecision(decision: AgentDecision, outcome?: any): Promise<void> {
		const decisionId = `${decision.agentId}-${decision.timestamp.getTime()}`;
		this.decisions.set(decisionId, decision);
		if (outcome) {
			this.outcomes.set(decisionId, outcome);
		}
	}

	async queryHistory(context: AgentContext, limit: number = 10): Promise<AgentDecision[]> {
		// Simplified - in production would use vector similarity
		return Array.from(this.decisions.values())
			.filter((d) => this.isRelevantContext(d, context))
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
			.slice(0, limit);
	}

	async learnFromOutcome(decisionId: string, outcome: any, effectiveness: number): Promise<void> {
		this.outcomes.set(decisionId, { outcome, effectiveness });
	}

	private isRelevantContext(decision: AgentDecision, context: AgentContext): boolean {
		// Simplified context matching - would be vector similarity in production
		return (
			decision.parameters.actionType === context.actionType ||
			decision.parameters.userId === context.userId
		);
	}
}
