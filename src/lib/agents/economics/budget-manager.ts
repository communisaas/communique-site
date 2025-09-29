/**
 * Budget Manager - Economic Optimization for Agent Consensus
 * 
 * Manages costs, optimizes agent selection for budget constraints,
 * prevents budget drain attacks, and provides cost prediction.
 * Supports both VOTER Protocol and direct delivery economic models.
 */

import { agentRegistry, type AgentTask, type CostConstraints, type AgentCapability } from '../registry/agent-registry';
import { db } from '$lib/core/db';

export interface BudgetConstraints {
	userBudget: number; // Total budget in USD
	maxCostPerTemplate: number; // Max cost for single template
	qualityThreshold: number; // Minimum quality requirement (0-1)
	maxLatencyMs: number; // Maximum acceptable latency
	allowPremiumModels: boolean; // Can use expensive models
	submissionFlow: 'voter-protocol' | 'direct-delivery';
}

export interface CostOptimizationResult {
	selectedAgents: AgentSelectionPlan[];
	estimatedCost: number;
	estimatedQuality: number;
	estimatedLatency: number;
	costEfficiency: number; // Quality per dollar
	riskAssessment: {
		budgetRisk: 'low' | 'medium' | 'high';
		qualityRisk: 'low' | 'medium' | 'high';
		reliabilityRisk: 'low' | 'medium' | 'high';
	};
	alternatives: {
		cheaper: AgentSelectionPlan[] | null;
		faster: AgentSelectionPlan[] | null;
		higherQuality: AgentSelectionPlan[] | null;
	};
}

export interface AgentSelectionPlan {
	agentId: string;
	stage: string;
	estimatedCost: number;
	estimatedLatency: number;
	expectedQuality: number;
	cachingBenefit: number; // Expected cost reduction from caching
	reasoning: string;
}

export interface UserSpendingPattern {
	userId: string;
	dailySpent: number;
	monthlySpent: number;
	averageCostPerTemplate: number;
	successRate: number;
	preferredQualityLevel: number;
	suspiciousActivity: boolean;
	lastUpdate: Date;
}

export interface BudgetAlert {
	level: 'info' | 'warning' | 'critical';
	message: string;
	currentSpend: number;
	budgetLimit: number;
	recommendations: string[];
	timestamp: Date;
}

export class BudgetManager {
	private userSpendingCache: Map<string, UserSpendingPattern> = new Map();
	private dailySystemSpend: number = 0;
	private systemBudgetLimit: number = 1000; // $1000 daily system limit
	private lastResetDate: Date = new Date();

	/**
	 * Optimize agent selection for budget constraints
	 */
	async optimizeForBudget(
		task: AgentTask,
		constraints: BudgetConstraints
	): Promise<CostOptimizationResult> {
		
		// Get all capable agents for this task
		const capableAgents = agentRegistry.getCapableAgents(task.type);
		
		if (capableAgents.length === 0) {
			throw new Error(`No agents available for task type: ${task.type}`);
		}

		// Generate multiple selection strategies
		const strategies = await this.generateSelectionStrategies(capableAgents, task, constraints);
		
		// Evaluate each strategy
		const evaluatedStrategies = strategies.map(strategy => 
			this.evaluateStrategy(strategy, constraints)
		);
		
		// Select optimal strategy
		const optimal = this.selectOptimalStrategy(evaluatedStrategies, constraints);
		
		return optimal;
	}

	/**
	 * Generate different agent selection strategies
	 */
	private async generateSelectionStrategies(
		agents: AgentCapability[],
		task: AgentTask,
		constraints: BudgetConstraints
	): Promise<AgentSelectionPlan[][]> {
		
		const strategies: AgentSelectionPlan[][] = [];
		
		// Strategy 1: Cheapest viable
		const cheapestStrategy = this.createCheapestStrategy(agents, task, constraints);
		if (cheapestStrategy.length > 0) {
			strategies.push(cheapestStrategy);
		}
		
		// Strategy 2: Best quality within budget
		const qualityStrategy = this.createQualityStrategy(agents, task, constraints);
		if (qualityStrategy.length > 0) {
			strategies.push(qualityStrategy);
		}
		
		// Strategy 3: Fastest processing
		const speedStrategy = this.createSpeedStrategy(agents, task, constraints);
		if (speedStrategy.length > 0) {
			strategies.push(speedStrategy);
		}
		
		// Strategy 4: Balanced approach
		const balancedStrategy = this.createBalancedStrategy(agents, task, constraints);
		if (balancedStrategy.length > 0) {
			strategies.push(balancedStrategy);
		}
		
		return strategies;
	}

	/**
	 * Create cheapest viable strategy
	 */
	private createCheapestStrategy(
		agents: AgentCapability[],
		task: AgentTask,
		constraints: BudgetConstraints
	): AgentSelectionPlan[] {
		
		// Sort by cost efficiency (reliability / cost)
		const sortedAgents = agents
			.filter(agent => this.estimateAgentCost(agent, task) <= constraints.maxCostPerTemplate)
			.sort((a, b) => {
				const efficiencyA = a.reliability / this.estimateAgentCost(a, task);
				const efficiencyB = b.reliability / this.estimateAgentCost(b, task);
				return efficiencyB - efficiencyA;
			});

		if (sortedAgents.length === 0) return [];

		// Select single cheapest reliable agent
		const selected = sortedAgents[0];
		const estimatedCost = this.estimateAgentCost(selected, task);
		const cachingBenefit = selected.cachingSupport ? estimatedCost * 0.7 : 0; // 70% cache savings
		
		return [{
			agentId: selected.id,
			stage: task.type,
			estimatedCost,
			estimatedLatency: 1000 / selected.speed * 1000, // Convert to ms
			expectedQuality: selected.reliability * 0.8, // Conservative estimate
			cachingBenefit,
			reasoning: `Cheapest reliable option for ${task.type} within budget`
		}];
	}

	/**
	 * Create quality-focused strategy
	 */
	private createQualityStrategy(
		agents: AgentCapability[],
		task: AgentTask,
		constraints: BudgetConstraints
	): AgentSelectionPlan[] {
		
		// Use consensus approach with multiple high-quality agents
		const premiumAgents = agents
			.filter(agent => 
				agent.reliability >= 0.9 &&
				this.estimateAgentCost(agent, task) <= constraints.maxCostPerTemplate * 0.8 // Leave room for multiple agents
			)
			.sort((a, b) => b.reliability - a.reliability)
			.slice(0, 2); // Top 2 agents for consensus

		if (premiumAgents.length === 0) {
			// Fallback to single best agent
			const bestAgent = agents
				.filter(agent => this.estimateAgentCost(agent, task) <= constraints.maxCostPerTemplate)
				.sort((a, b) => b.reliability - a.reliability)[0];
			
			if (!bestAgent) return [];

			return [{
				agentId: bestAgent.id,
				stage: task.type,
				estimatedCost: this.estimateAgentCost(bestAgent, task),
				estimatedLatency: 1000 / bestAgent.speed * 1000,
				expectedQuality: bestAgent.reliability,
				cachingBenefit: bestAgent.cachingSupport ? this.estimateAgentCost(bestAgent, task) * 0.7 : 0,
				reasoning: 'Best single agent within budget'
			}];
		}

		return premiumAgents.map(agent => ({
			agentId: agent.id,
			stage: task.type + '_consensus',
			estimatedCost: this.estimateAgentCost(agent, task),
			estimatedLatency: 1000 / agent.speed * 1000,
			expectedQuality: agent.reliability,
			cachingBenefit: agent.cachingSupport ? this.estimateAgentCost(agent, task) * 0.7 : 0,
			reasoning: `High-quality consensus agent for ${task.type}`
		}));
	}

	/**
	 * Create speed-focused strategy
	 */
	private createSpeedStrategy(
		agents: AgentCapability[],
		task: AgentTask,
		constraints: BudgetConstraints
	): AgentSelectionPlan[] {
		
		const fastAgents = agents
			.filter(agent => this.estimateAgentCost(agent, task) <= constraints.maxCostPerTemplate)
			.sort((a, b) => b.speed - a.speed);

		if (fastAgents.length === 0) return [];

		const fastest = fastAgents[0];
		return [{
			agentId: fastest.id,
			stage: task.type,
			estimatedCost: this.estimateAgentCost(fastest, task),
			estimatedLatency: 1000 / fastest.speed * 1000,
			expectedQuality: fastest.reliability * 0.9, // Slight quality penalty for speed focus
			cachingBenefit: fastest.cachingSupport ? this.estimateAgentCost(fastest, task) * 0.7 : 0,
			reasoning: 'Fastest processing within budget'
		}];
	}

	/**
	 * Create balanced strategy
	 */
	private createBalancedStrategy(
		agents: AgentCapability[],
		task: AgentTask,
		constraints: BudgetConstraints
	): AgentSelectionPlan[] {
		
		// Score agents on balanced criteria
		const scoredAgents = agents
			.filter(agent => this.estimateAgentCost(agent, task) <= constraints.maxCostPerTemplate)
			.map(agent => {
				const cost = this.estimateAgentCost(agent, task);
				const costScore = 1 - (cost / constraints.maxCostPerTemplate); // Lower cost = higher score
				const qualityScore = agent.reliability;
				const speedScore = Math.min(1, agent.speed / 1000); // Normalize speed
				
				const balancedScore = (costScore * 0.4) + (qualityScore * 0.4) + (speedScore * 0.2);
				
				return { agent, score: balancedScore, cost };
			})
			.sort((a, b) => b.score - a.score);

		if (scoredAgents.length === 0) return [];

		const selected = scoredAgents[0];
		return [{
			agentId: selected.agent.id,
			stage: task.type,
			estimatedCost: selected.cost,
			estimatedLatency: 1000 / selected.agent.speed * 1000,
			expectedQuality: selected.agent.reliability,
			cachingBenefit: selected.agent.cachingSupport ? selected.cost * 0.7 : 0,
			reasoning: 'Balanced cost, quality, and speed optimization'
		}];
	}

	/**
	 * Evaluate a selection strategy
	 */
	private evaluateStrategy(
		strategy: AgentSelectionPlan[],
		constraints: BudgetConstraints
	): CostOptimizationResult {
		
		const totalCost = strategy.reduce((sum, plan) => sum + plan.estimatedCost - plan.cachingBenefit, 0);
		const averageQuality = strategy.reduce((sum, plan) => sum + plan.expectedQuality, 0) / strategy.length;
		const maxLatency = Math.max(...strategy.map(plan => plan.estimatedLatency));
		const costEfficiency = averageQuality / Math.max(0.001, totalCost);

		// Risk assessment
		const budgetRisk = totalCost > constraints.userBudget * 0.8 ? 'high' : 
			totalCost > constraints.userBudget * 0.5 ? 'medium' : 'low';
		
		const qualityRisk = averageQuality < constraints.qualityThreshold ? 'high' :
			averageQuality < constraints.qualityThreshold * 1.2 ? 'medium' : 'low';
		
		const reliabilityRisk = strategy.some(plan => {
			const agent = agentRegistry.getActiveAgents().find(a => a.id === plan.agentId);
			return agent && agent.reliability < 0.8;
		}) ? 'high' : 'low';

		return {
			selectedAgents: strategy,
			estimatedCost: totalCost,
			estimatedQuality: averageQuality,
			estimatedLatency: maxLatency,
			costEfficiency,
			riskAssessment: {
				budgetRisk,
				qualityRisk,
				reliabilityRisk
			},
			alternatives: {
				cheaper: null, // Will be populated by selectOptimalStrategy
				faster: null,
				higherQuality: null
			}
		};
	}

	/**
	 * Select optimal strategy from evaluated options
	 */
	private selectOptimalStrategy(
		strategies: CostOptimizationResult[],
		constraints: BudgetConstraints
	): CostOptimizationResult {
		
		// Filter strategies that meet constraints
		const viableStrategies = strategies.filter(strategy => 
			strategy.estimatedCost <= constraints.userBudget &&
			strategy.estimatedQuality >= constraints.qualityThreshold &&
			strategy.estimatedLatency <= constraints.maxLatencyMs
		);

		if (viableStrategies.length === 0) {
			// No viable strategies - return cheapest as fallback
			const cheapest = strategies.sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
			cheapest.riskAssessment.budgetRisk = 'high';
			return cheapest;
		}

		// Select strategy based on submission flow priorities
		let optimal: CostOptimizationResult;
		
		if (constraints.submissionFlow === 'voter-protocol') {
			// VOTER Protocol prioritizes quality over cost
			optimal = viableStrategies.sort((a, b) => b.estimatedQuality - a.estimatedQuality)[0];
		} else {
			// Direct delivery prioritizes cost efficiency
			optimal = viableStrategies.sort((a, b) => b.costEfficiency - a.costEfficiency)[0];
		}

		// Populate alternatives
		optimal.alternatives = {
			cheaper: viableStrategies.sort((a, b) => a.estimatedCost - b.estimatedCost)[0]?.selectedAgents || null,
			faster: viableStrategies.sort((a, b) => a.estimatedLatency - b.estimatedLatency)[0]?.selectedAgents || null,
			higherQuality: viableStrategies.sort((a, b) => b.estimatedQuality - a.estimatedQuality)[0]?.selectedAgents || null
		};

		return optimal;
	}

	/**
	 * Track user spending patterns
	 */
	async trackUserSpending(userId: string, cost: number, success: boolean): Promise<void> {
		const now = new Date();
		const today = now.toDateString();
		
		let pattern = this.userSpendingCache.get(userId);
		
		if (!pattern || pattern.lastUpdate.toDateString() !== today) {
			// Load from database or create new pattern
			pattern = await this.loadUserSpendingPattern(userId);
			
			if (pattern.lastUpdate.toDateString() !== today) {
				// Reset daily spending
				pattern.dailySpent = 0;
			}
		}

		// Update spending
		pattern.dailySpent += cost;
		pattern.monthlySpent += cost;
		pattern.averageCostPerTemplate = (pattern.averageCostPerTemplate * 0.9) + (cost * 0.1); // Moving average
		pattern.successRate = (pattern.successRate * 0.95) + (success ? 0.05 : 0); // Moving average
		pattern.lastUpdate = now;

		// Detect suspicious activity
		pattern.suspiciousActivity = this.detectSuspiciousActivity(pattern);

		// Cache and persist
		this.userSpendingCache.set(userId, pattern);
		await this.saveUserSpendingPattern(pattern);
		
		// Check for budget alerts
		await this.checkBudgetAlerts(userId, pattern);
	}

	/**
	 * Predict cost for a template
	 */
	async predictTemplateCost(
		content: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery',
		userReputation?: number
	): Promise<{
		estimatedCost: number;
		costRange: { min: number; max: number };
		factorsConsidered: string[];
		recommendations: string[];
	}> {
		
		const complexity = this.analyzeContentComplexity(content);
		const factorsConsidered: string[] = [];
		let estimatedCost = 0.005; // Base cost
		
		// Content length factor
		if (content.length > 1000) {
			estimatedCost *= 1.5;
			factorsConsidered.push('Long content (+50%)');
		}
		
		// Complexity factors
		if (complexity.requiresEnhancement) {
			estimatedCost += 0.008; // Enhancement cost
			factorsConsidered.push('Content enhancement needed (+$0.008)');
		}
		
		if (complexity.toxicityRisk > 0.5) {
			estimatedCost += 0.003; // Additional screening
			factorsConsidered.push('Higher toxicity risk (+$0.003)');
		}
		
		// Submission flow factor
		if (submissionFlow === 'voter-protocol') {
			estimatedCost *= 1.3; // Higher quality requirements
			factorsConsidered.push('VOTER Protocol quality standards (+30%)');
		}
		
		// User reputation discount
		if (userReputation && userReputation > 0.8) {
			estimatedCost *= 0.9;
			factorsConsidered.push('High user reputation (-10%)');
		}
		
		// Caching benefits
		const cachingSavings = estimatedCost * 0.4; // Potential 40% savings
		const costRange = {
			min: Math.max(0.001, estimatedCost - cachingSavings),
			max: estimatedCost * 1.2 // Account for potential retries
		};
		
		const recommendations: string[] = [];
		if (complexity.requiresEnhancement) {
			recommendations.push('Consider reviewing content for grammar and tone to reduce processing costs');
		}
		if (content.length > 2000) {
			recommendations.push('Shorter content will process faster and cost less');
		}
		if (complexity.toxicityRisk > 0.3) {
			recommendations.push('Professional language will reduce screening costs');
		}

		return {
			estimatedCost,
			costRange,
			factorsConsidered,
			recommendations
		};
	}

	/**
	 * Check system budget limits
	 */
	async checkSystemBudgetLimits(): Promise<BudgetAlert[]> {
		const now = new Date();
		const alerts: BudgetAlert[] = [];
		
		// Reset daily spending if new day
		if (this.lastResetDate.toDateString() !== now.toDateString()) {
			this.dailySystemSpend = 0;
			this.lastResetDate = now;
		}
		
		// Check daily system spending
		const spendRatio = this.dailySystemSpend / this.systemBudgetLimit;
		
		if (spendRatio >= 0.9) {
			alerts.push({
				level: 'critical',
				message: 'Daily system budget nearly exhausted',
				currentSpend: this.dailySystemSpend,
				budgetLimit: this.systemBudgetLimit,
				recommendations: [
					'Implement emergency cost controls',
					'Switch to cheapest agents only',
					'Consider pausing non-essential processing'
				],
				timestamp: now
			});
		} else if (spendRatio >= 0.7) {
			alerts.push({
				level: 'warning',
				message: 'High system spending detected',
				currentSpend: this.dailySystemSpend,
				budgetLimit: this.systemBudgetLimit,
				recommendations: [
					'Monitor agent selection strategies',
					'Optimize for cost efficiency',
					'Review high-cost user patterns'
				],
				timestamp: now
			});
		}
		
		return alerts;
	}

	/**
	 * Emergency cost controls
	 */
	async activateEmergencyMode(): Promise<void> {
		console.warn('🚨 Activating emergency cost controls');
		
		// Switch all agents to cheapest available models
		const agents = agentRegistry.getActiveAgents();
		for (const agent of agents) {
			if (agent.costPerMToken.input > 0.5) { // Expensive models
				agent.isActive = false; // Temporarily disable
			}
		}
		
		// Implement strict rate limiting
		// This would integrate with rate limiting system
		
		// Alert administrators
		console.error('Emergency mode activated: System budget exceeded');
	}

	/**
	 * Helper methods
	 */
	private estimateAgentCost(agent: AgentCapability, task: AgentTask): number {
		const contentLength = task.content.length;
		const estimatedInputTokens = Math.ceil(contentLength / 4); // ~4 chars per token
		const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.3); // 30% output ratio
		
		return (
			(estimatedInputTokens / 1000000) * agent.costPerMToken.input +
			(estimatedOutputTokens / 1000000) * agent.costPerMToken.output
		);
	}

	private analyzeContentComplexity(content: string): {
		requiresEnhancement: boolean;
		toxicityRisk: number;
		complexity: number;
	} {
		const profanityCount = (content.match(/\b(damn|hell|crap|shit)\b/gi) || []).length;
		const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
		const grammarIssues = this.countGrammarIssues(content);
		
		return {
			requiresEnhancement: profanityCount > 0 || capsRatio > 0.1 || grammarIssues > 2,
			toxicityRisk: Math.min(1, profanityCount * 0.3 + capsRatio * 2),
			complexity: content.length / 1000 + profanityCount * 0.1 + grammarIssues * 0.05
		};
	}

	private countGrammarIssues(content: string): number {
		let issues = 0;
		if (!/^[A-Z]/.test(content.trim())) issues++; // No capital start
		if (!/[.!?]$/.test(content.trim())) issues++; // No punctuation end  
		if (content.includes('  ')) issues++; // Double spaces
		return issues;
	}

	private detectSuspiciousActivity(pattern: UserSpendingPattern): boolean {
		// High daily spending
		if (pattern.dailySpent > 50) return true;
		
		// Many failed attempts
		if (pattern.successRate < 0.3 && pattern.dailySpent > 5) return true;
		
		// Unusual cost patterns
		if (pattern.averageCostPerTemplate > 0.50) return true;
		
		return false;
	}

	private async loadUserSpendingPattern(userId: string): Promise<UserSpendingPattern> {
		// This would load from database
		// For now, return default pattern
		return {
			userId,
			dailySpent: 0,
			monthlySpent: 0,
			averageCostPerTemplate: 0.01,
			successRate: 0.8,
			preferredQualityLevel: 0.7,
			suspiciousActivity: false,
			lastUpdate: new Date()
		};
	}

	private async saveUserSpendingPattern(pattern: UserSpendingPattern): Promise<void> {
		// This would save to database
		console.log(`Saving spending pattern for user ${pattern.userId}`);
	}

	private async checkBudgetAlerts(userId: string, pattern: UserSpendingPattern): Promise<void> {
		const alerts: BudgetAlert[] = [];
		
		if (pattern.suspiciousActivity) {
			alerts.push({
				level: 'warning',
				message: 'Suspicious spending pattern detected',
				currentSpend: pattern.dailySpent,
				budgetLimit: 10, // Default daily limit
				recommendations: [
					'Review recent template submissions',
					'Consider account verification',
					'Monitor for gaming attempts'
				],
				timestamp: new Date()
			});
		}
		
		// Process alerts (send notifications, log, etc.)
		for (const alert of alerts) {
			console.warn(`Budget alert for user ${userId}:`, alert);
		}
	}

	/**
	 * Get user spending summary
	 */
	async getUserSpendingSummary(userId: string): Promise<UserSpendingPattern | null> {
		return this.userSpendingCache.get(userId) || await this.loadUserSpendingPattern(userId);
	}

	/**
	 * Get system spending statistics
	 */
	getSystemSpendingStats(): {
		dailySpent: number;
		dailyLimit: number;
		utilizationRatio: number;
		isEmergencyMode: boolean;
	} {
		return {
			dailySpent: this.dailySystemSpend,
			dailyLimit: this.systemBudgetLimit,
			utilizationRatio: this.dailySystemSpend / this.systemBudgetLimit,
			isEmergencyMode: this.dailySystemSpend > this.systemBudgetLimit * 0.9
		};
	}
}

// Export singleton instance
export const budgetManager = new BudgetManager();