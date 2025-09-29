/**
 * Agent Registry - Dynamic Model Discovery & Management
 * 
 * Supports both VOTER Protocol (on-chain legislative) and direct delivery flows
 * using the same unified agent consensus system.
 */

export interface AgentCapability {
	id: string;
	provider: 'openai' | 'google' | 'anthropic' | 'local' | 'custom';
	model: string;
	costPerMToken: { 
		input: number; 
		output: number; 
		thinking?: number;
		cached?: number;
	};
	capabilities: ('screening' | 'enhancement' | 'reasoning' | 'consensus' | 'legislative' | 'direct')[];
	reliability: number; // 0-1 track record
	speed: number; // tokens/second average
	contextWindow: number;
	cachingSupport: boolean;
	expertiseDomains: string[];
	lastUpdated: Date;
	isActive: boolean;
}

export interface CostConstraints {
	maxCostPerTemplate: number;
	maxLatencyMs: number;
	qualityThreshold: number;
	allowPremiumModels: boolean;
}

export interface AgentTask {
	type: 'screening' | 'enhancement' | 'consensus' | 'reasoning';
	submissionFlow: 'voter-protocol' | 'direct-delivery'; // Both flows use same agents
	priority: 'low' | 'normal' | 'high';
	maxCost: number;
	maxLatency: number;
	content: string;
	context?: {
		templateType?: string;
		targetAudience?: 'legislative' | 'corporate' | 'advocacy';
		complexity?: number;
		userReputation?: number;
	};
}

export class AgentRegistry {
	private agents: Map<string, AgentCapability> = new Map();
	private performanceHistory: Map<string, PerformanceMetrics> = new Map();
	private lastDiscovery: Date | null = null;
	private discoveryInterval = 30 * 60 * 1000; // 30 minutes

	constructor() {
		this.initializeDefaultAgents();
	}

	/**
	 * Initialize with known September 2025 models
	 * These will be dynamically updated via API discovery
	 */
	private initializeDefaultAgents(): void {
		// OpenAI GPT-5 series
		this.registerAgent({
			id: 'gpt-5-nano',
			provider: 'openai',
			model: 'gpt-5-nano',
			costPerMToken: { input: 0.05, output: 0.40, cached: 0.005 },
			capabilities: ['screening'],
			reliability: 0.95,
			speed: 1000,
			contextWindow: 272000,
			cachingSupport: true,
			expertiseDomains: ['toxicity-detection', 'fast-classification'],
			lastUpdated: new Date(),
			isActive: true
		});

		this.registerAgent({
			id: 'gpt-5-mini',
			provider: 'openai',
			model: 'gpt-5-mini',
			costPerMToken: { input: 0.25, output: 2.0, cached: 0.025 },
			capabilities: ['enhancement', 'reasoning'],
			reliability: 0.92,
			speed: 800,
			contextWindow: 272000,
			cachingSupport: true,
			expertiseDomains: ['content-enhancement', 'political-communication'],
			lastUpdated: new Date(),
			isActive: true
		});

		this.registerAgent({
			id: 'gpt-5',
			provider: 'openai',
			model: 'gpt-5',
			costPerMToken: { input: 1.25, output: 10.0, cached: 0.125 },
			capabilities: ['reasoning', 'consensus'],
			reliability: 0.98,
			speed: 600,
			contextWindow: 272000,
			cachingSupport: true,
			expertiseDomains: ['complex-reasoning', 'legislative-analysis', 'consensus-building'],
			lastUpdated: new Date(),
			isActive: true
		});

		// Google Gemini 2.5 series
		this.registerAgent({
			id: 'gemini-2.5-flash-lite',
			provider: 'google',
			model: 'gemini-2.5-flash-lite-preview-09-2025',
			costPerMToken: { input: 0.10, output: 0.40 },
			capabilities: ['screening', 'consensus'],
			reliability: 0.90,
			speed: 1200,
			contextWindow: 1000000,
			cachingSupport: false,
			expertiseDomains: ['multimodal-analysis', 'fast-consensus'],
			lastUpdated: new Date(),
			isActive: true
		});

		this.registerAgent({
			id: 'gemini-2.5-flash',
			provider: 'google',
			model: 'gemini-2.5-flash-preview-09-2025',
			costPerMToken: { input: 0.30, output: 2.50 },
			capabilities: ['enhancement', 'reasoning', 'consensus'],
			reliability: 0.93,
			speed: 900,
			contextWindow: 1000000,
			cachingSupport: false,
			expertiseDomains: ['agentic-tasks', 'legislative-formatting', 'political-reasoning'],
			lastUpdated: new Date(),
			isActive: true
		});
	}

	/**
	 * Dynamic agent discovery - check for new models and updated pricing
	 */
	async discoverAvailableAgents(): Promise<void> {
		const now = new Date();
		if (this.lastDiscovery && (now.getTime() - this.lastDiscovery.getTime()) < this.discoveryInterval) {
			return; // Skip if discovered recently
		}

		try {
			// TODO: Implement actual API discovery
			// For now, we'll just update the known models
			console.log('🔍 Discovering available AI models...');
			
			await this.checkOpenAIModels();
			await this.checkGoogleModels();
			await this.checkAnthropicModels();
			
			this.lastDiscovery = now;
			console.log(`✅ Agent discovery completed. ${this.agents.size} agents available.`);
		} catch (error) {
			console.error('❌ Agent discovery failed:', error);
		}
	}

	private async checkOpenAIModels(): Promise<void> {
		// In a real implementation, this would call OpenAI's models API
		// For now, we'll update pricing and availability of known models
		const gpt5nano = this.agents.get('gpt-5-nano');
		if (gpt5nano) {
			gpt5nano.lastUpdated = new Date();
			gpt5nano.isActive = true; // Assume available
		}
	}

	private async checkGoogleModels(): Promise<void> {
		// In a real implementation, this would call Google's API
		const geminiFlashLite = this.agents.get('gemini-2.5-flash-lite');
		if (geminiFlashLite) {
			geminiFlashLite.lastUpdated = new Date();
			geminiFlashLite.isActive = true;
		}
	}

	private async checkAnthropicModels(): Promise<void> {
		// Placeholder for Anthropic model discovery
		// Would add Claude 4.1 models when integrated
	}

	/**
	 * Register a new agent capability
	 */
	registerAgent(capability: AgentCapability): void {
		this.agents.set(capability.id, capability);
	}

	/**
	 * Select optimal agent for a specific task
	 */
	selectOptimalAgent(task: AgentTask, constraints: CostConstraints): AgentCapability | null {
		const candidates = Array.from(this.agents.values())
			.filter(agent => 
				agent.isActive &&
				agent.capabilities.includes(task.type) &&
				agent.costPerMToken.input <= constraints.maxCostPerTemplate
			);

		if (candidates.length === 0) {
			return null;
		}

		// Score agents based on task requirements
		const scored = candidates.map(agent => ({
			agent,
			score: this.scoreAgent(agent, task, constraints)
		}));

		// Sort by score (higher is better)
		scored.sort((a, b) => b.score - a.score);

		return scored[0].agent;
	}

	/**
	 * Select multiple agents for consensus-based tasks
	 */
	selectConsensusAgents(task: AgentTask, constraints: CostConstraints, count: number = 2): AgentCapability[] {
		const candidates = Array.from(this.agents.values())
			.filter(agent => 
				agent.isActive &&
				agent.capabilities.includes(task.type)
			);

		if (candidates.length < count) {
			return candidates;
		}

		// Ensure diversity in agent selection for better consensus
		const selected: AgentCapability[] = [];
		const usedProviders = new Set<string>();

		// First, select best agent from each provider
		for (const provider of ['openai', 'google', 'anthropic']) {
			const providerAgents = candidates
				.filter(agent => agent.provider === provider && !usedProviders.has(provider))
				.sort((a, b) => this.scoreAgent(b, task, constraints) - this.scoreAgent(a, task, constraints));

			if (providerAgents.length > 0) {
				selected.push(providerAgents[0]);
				usedProviders.add(provider);
			}

			if (selected.length >= count) break;
		}

		// Fill remaining slots with best overall agents
		if (selected.length < count) {
			const remaining = candidates
				.filter(agent => !selected.includes(agent))
				.sort((a, b) => this.scoreAgent(b, task, constraints) - this.scoreAgent(a, task, constraints))
				.slice(0, count - selected.length);

			selected.push(...remaining);
		}

		return selected.slice(0, count);
	}

	/**
	 * Score an agent for a specific task
	 */
	private scoreAgent(agent: AgentCapability, task: AgentTask, constraints: CostConstraints): number {
		const performance = this.performanceHistory.get(agent.id);
		
		// Base score from reliability
		let score = agent.reliability * 100;

		// Cost efficiency (lower cost = higher score)
		const costScore = Math.max(0, 50 - (agent.costPerMToken.input * 10));
		score += costScore * 0.3;

		// Speed bonus for high-priority tasks
		if (task.priority === 'high') {
			score += (agent.speed / 1000) * 10;
		}

		// Context window bonus for complex tasks
		if (task.context?.complexity && task.context.complexity > 0.7) {
			score += Math.min(20, agent.contextWindow / 100000);
		}

		// Expertise domain matching
		if (task.context?.targetAudience) {
			const audienceMatch = agent.expertiseDomains.some(domain => 
				domain.includes(task.context!.targetAudience!) ||
				(task.context!.targetAudience === 'legislative' && domain.includes('political'))
			);
			if (audienceMatch) {
				score += 15;
			}
		}

		// Historical performance bonus
		if (performance) {
			score += performance.successRate * 20;
			score += Math.max(0, 10 - performance.averageLatencyMs / 1000); // Latency penalty
		}

		// Caching bonus for repetitive tasks
		if (agent.cachingSupport && task.type === 'screening') {
			score += 10;
		}

		return score;
	}

	/**
	 * Get all active agents
	 */
	getActiveAgents(): AgentCapability[] {
		return Array.from(this.agents.values()).filter(agent => agent.isActive);
	}

	/**
	 * Get agents capable of specific task type
	 */
	getCapableAgents(taskType: AgentTask['type']): AgentCapability[] {
		return Array.from(this.agents.values())
			.filter(agent => agent.isActive && agent.capabilities.includes(taskType));
	}

	/**
	 * Update agent performance metrics
	 */
	updatePerformance(agentId: string, metrics: PerformanceUpdate): void {
		const current = this.performanceHistory.get(agentId) || {
			totalTasks: 0,
			successfulTasks: 0,
			totalLatencyMs: 0,
			totalCost: 0,
			successRate: 0,
			averageLatencyMs: 0,
			averageCost: 0
		};

		current.totalTasks++;
		if (metrics.success) {
			current.successfulTasks++;
		}
		current.totalLatencyMs += metrics.latencyMs;
		current.totalCost += metrics.cost;

		// Recalculate averages
		current.successRate = current.successfulTasks / current.totalTasks;
		current.averageLatencyMs = current.totalLatencyMs / current.totalTasks;
		current.averageCost = current.totalCost / current.totalTasks;

		this.performanceHistory.set(agentId, current);

		// Update agent reliability based on recent performance
		const agent = this.agents.get(agentId);
		if (agent) {
			// Weighted average of base reliability and recent performance
			agent.reliability = (agent.reliability * 0.8) + (current.successRate * 0.2);
		}
	}

	/**
	 * Get performance statistics for an agent
	 */
	getPerformanceMetrics(agentId: string): PerformanceMetrics | null {
		return this.performanceHistory.get(agentId) || null;
	}
}

interface PerformanceMetrics {
	totalTasks: number;
	successfulTasks: number;
	totalLatencyMs: number;
	totalCost: number;
	successRate: number;
	averageLatencyMs: number;
	averageCost: number;
}

interface PerformanceUpdate {
	success: boolean;
	latencyMs: number;
	cost: number;
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();