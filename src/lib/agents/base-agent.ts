/**
 * Base Agent Architecture for VOTER Protocol
 *
 * Implements the foundational agent system that replaces hardcoded parameters
 * with intelligent, adaptive decision-making within auditable safety rails.
 *
 * "Death to hardcoded tyranny" - agents optimize for human flourishing
 */

export interface AgentDecision<T = unknown> {
	agentId: string;
	agentType: AgentType;
	decision: T;
	confidence: number; // 0-1 scale
	reasoning: string;
	parameters: Record<string, unknown>;
	timestamp: Date;
	safetyBounds?: {
		min?: number;
		max?: number;
		validRange?: [number, number];
	};
	// Index signature for JSON compatibility with Prisma InputJsonValue
	[key: string]: unknown;
}

export interface AgentConsensus<T = unknown> {
	decisions: AgentDecision<T>[];
	consensusReached: boolean;
	consensusConfidence: number;
	finalDecision: T | null;
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

export interface AgentCapability {
	type: AgentType;
	description: string;
	capabilities: AgentCapabilityType[];
	decisionTypes: AgentDecisionType[];
	requiredContext: (keyof AgentContext)[];
}

export type AgentCapabilityType = 
	| 'identity_verification'
	| 'trust_score_calculation'
	| 'risk_assessment'
	| 'zk_proof_validation'
	| 'dynamic_reward_calculation'
	| 'network_activity_monitoring'
	| 'inflation_prevention'
	| 'reputation_multipliers'
	| 'reward_optimization'
	| 'market_analysis'
	| 'incentive_adjustment'
	| 'participation_prediction'
	| 'legislative_outcome_tracking'
	| 'causal_chain_analysis'
	| 'impact_score_calculation'
	| 'funding_recommendations'
	| 'credibility_assessment'
	| 'erc8004_attestations'
	| 'reputation_risk_analysis';

export type AgentDecisionType = 
	| 'verification_assessment'
	| 'trust_scoring'
	| 'reward_calculation'
	| 'supply_optimization'
	| 'reward_optimization'
	| 'incentive_design'
	| 'impact_assessment'
	| 'funding_calculation'
	| 'credibility_assessment'
	| 'reputation_scoring';

export interface AgentContext {
	userId?: string;
	userAddress?: string; // Blockchain address for VOTER Protocol integration
	actionType?: 'cwc_message' | 'direct_action' | 'challenge_market' | 'template_creation' | 'verify' | string;
	templateId?: string;
	timestamp?: string;
	historicalData?: unknown;
	parameters?: Record<string, unknown>; // Additional parameters for agent processing
	networkConditions?: {
		dailyActiveUsers: number;
		totalActions: number;
		recentActivity: unknown[];
	};
	safetyRails?: Record<string, [number, number]>; // [min, max] bounds
	// Challenge-specific properties
	qualityScore?: number;
	recipients?: string[];
	// Reputation-specific properties
	reputationChange?: number;
	// Additional properties for API calls
	metadata?: Record<string, unknown>;
	template?: unknown; // Template object for verification
	baseReward?: number;
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

	getAgentType(): AgentType {
		return this.agentType;
	}

	abstract getCapabilities(): AgentCapability;

	protected applySafetyBounds(value: number, parameterName: string): number {
		const bounds = this.safetyBounds[parameterName];
		if (!bounds) return value;

		const [min, max] = bounds;
		return Math.max(min, Math.min(max, value));
	}

	protected createDecision<T>(
		decision: T,
		confidence: number,
		reasoning: string,
		parameters: Record<string, unknown> = {}
	): AgentDecision<T> {
		return {
			agentId: this.agentId,
			agentType: this.agentType,
			decision,
			confidence,
			reasoning,
			parameters,
			timestamp: new Date(),
			safetyBounds:
				parameters?.parameterName && typeof parameters.parameterName === 'string'
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
		this.agents.set(agent.getAgentType(), agent);
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

	private calculateConsensusDecision(decisions: AgentDecision[]): unknown | null {
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
	storeDecision(decision: AgentDecision, outcome?: unknown): Promise<void>;
	queryHistory(context: AgentContext, limit?: number): Promise<AgentDecision[]>;
	learnFromOutcome(decisionId: string, outcome: unknown, effectiveness: number): Promise<void>;
}

/**
 * Vector memory implementation for sophisticated pattern matching
 */
export class VectorAgentMemory implements AgentMemory {
	// This would integrate with ChromaDB in production
	// For now, simplified in-memory storage
	private decisions: Map<string, AgentDecision> = new Map();
	private outcomes: Map<string, any> = new Map();

	async storeDecision(decision: AgentDecision, outcome?: unknown): Promise<void> {
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

	async learnFromOutcome(
		decisionId: string,
		outcome: unknown,
		effectiveness: number
	): Promise<void> {
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
