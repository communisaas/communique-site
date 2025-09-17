/**
 * SupplyAgent - Dynamic Reward Calculation
 *
 * Replaces hardcoded reward amounts with intelligent supply optimization.
 * Monitors network participation, adapts to political calendar, prevents inflation.
 *
 * Vision: "Resilient abundance through intelligence within auditable bounds"
 */

import { BaseAgent, AgentType } from './base-agent';
import type { AgentContext, AgentDecision } from './base-agent';
import { prisma } from '$lib/core/db';

export interface RewardParameters {
	baseRewardUSD: number;
	multipliers: {
		activity: number; // Network effect multiplier
		action: number; // Action type multiplier
		reputation: number; // User reputation multiplier
		complexity: number; // Template complexity multiplier
		time: number; // Time decay multiplier
		urgency: number; // Political calendar urgency
	};
	totalMultiplier: number;
	ethPrice: number;
	finalRewardETH: number;
	finalRewardWei: string;
}

export class SupplyAgent extends BaseAgent {
	constructor() {
		super('supply-agent-v1', AgentType.SUPPLY, {
			baseRewardUSD: [0.01, 1.0], // $0.01 - $1.00 base reward range
			maxDailyInflation: [1, 10], // 1% - 10% max daily inflation
			participationThreshold: [10, 1000], // 10-1000 daily active users trigger
			urgencyMultiplier: [1, 5] // 1x - 5x urgency multiplier
		});
	}
	async makeDecision(context: AgentContext): Promise<AgentDecision> {
		try {
			// Get network activity data
			const networkData = await this.getNetworkActivity();

			// Get user reputation data
			const userReputation = await this.getUserReputation(context.userId);

			// Get template complexity if provided
			const templateComplexity = await this.getTemplateComplexity(context.templateId);

			// Calculate political calendar urgency
			const urgencyMultiplier = this.calculateUrgencyMultiplier(context.timestamp);

			// Calculate base reward with safety bounds
			const baseRewardUSD = this.applySafetyBounds(
				this.calculateBaseReward(networkData),
				'baseRewardUSD'
			);

			// Calculate all multipliers
			const multipliers = {
				activity: this.calculateActivityMultiplier(networkData),
				action: this.getActionTypeMultiplier(context.actionType || 'unknown'),
				reputation: this.calculateReputationMultiplier(userReputation),
				complexity: templateComplexity,
				time: this.calculateTimeDecay(context.timestamp),
				urgency: this.applySafetyBounds(urgencyMultiplier, 'urgencyMultiplier')
			};

			// Apply total multiplier
			const totalMultiplier = Object.values(multipliers).reduce((a, b) => a * b, 1);

			// Get ETH price (mock for now - would use oracle in production)
			const ethPrice = await this.getETHPrice();

			// Calculate final reward
			const finalRewardUSD = baseRewardUSD * totalMultiplier;
			const finalRewardETH = finalRewardUSD / ethPrice;
			const finalRewardWei = Math.floor(finalRewardETH * 1e18);

			const rewardParams: RewardParameters = {
				baseRewardUSD,
				multipliers,
				totalMultiplier: parseFloat(totalMultiplier.toFixed(3)),
				ethPrice,
				finalRewardETH: parseFloat(finalRewardETH.toFixed(8)),
				finalRewardWei: finalRewardWei.toString()
			};

			const confidence = this.calculateConfidence(networkData, userReputation, context);

			return this.createDecision(
				rewardParams,
				confidence,
				this.generateReasoning(rewardParams, networkData, context),
				{ actionType: context.actionType, networkActivity: networkData.dailyActiveUsers }
			);
		} catch (_error) {
			console.error('SupplyAgent decision error:', _error);
			// Fallback to conservative values
			return this.createDecision(
				{ baseRewardUSD: 0.1, finalRewardWei: '100000000000000000' }, // 0.1 ETH as fallback
				0.3,
				`Error in supply calculation, using conservative fallback: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
				{ error: true }
			);
		}
	}

	private async getNetworkActivity(): Promise<{
		dailyActiveUsers: number;
		totalActions: number;
		cwcActions: number;
		avgActionsPerUser: number;
	}> {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

		// Get activity from last 24 hours using proper Prisma aggregate for PostgreSQL
		const [totalActions, cwcActions, uniqueUsers] = await Promise.all([
			// Total actions count
			prisma.civicAction.count({
				where: {
					created_at: {
						gte: oneDayAgo
					}
				}
			}),
			// CWC actions count
			prisma.civicAction.count({
				where: {
					created_at: {
						gte: oneDayAgo
					},
					action_type: 'cwc_message'
				}
			}),
			// Count unique users
			prisma.civicAction.findMany({
				where: {
					created_at: {
						gte: oneDayAgo
					}
				},
				select: {
					user_id: true
				},
				distinct: ['user_id']
			})
		]);

		const dailyActiveUsers = uniqueUsers.length;

		return {
			dailyActiveUsers,
			totalActions,
			cwcActions,
			avgActionsPerUser: dailyActiveUsers > 0 ? totalActions / dailyActiveUsers : 0
		};
	}

	private async getUserReputation(
		userId?: string
	): Promise<{ trust_score: number; reputation_tier: string } | null> {
		if (!userId) return null;

		return await prisma.user.findUnique({
			where: { id: userId },
			select: { trust_score: true, reputation_tier: true }
		});
	}

	private async getTemplateComplexity(templateId?: string): Promise<number> {
		if (!templateId) return 1.0;

		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { message_body: true }
		});

		// Simple complexity metric based on message length
		return template?.message_body?.length
			? Math.min(2.0, 1.0 + template.message_body.length / 1000)
			: 1.0;
	}

	private calculateBaseReward(networkData: {
		dailyActiveUsers: number;
		totalActions: number;
	}): number {
		// Dynamic base reward based on network activity
		const { dailyActiveUsers, totalActions } = networkData;

		// More users = lower per-action reward to prevent inflation
		// Fewer users = higher reward to incentivize participation
		const activityFactor = Math.max(0.1, 1 - dailyActiveUsers / 10000);

		// Base of $0.10, adjusted by activity
		return 0.1 * (0.5 + 1.5 * activityFactor);
	}

	private calculateActivityMultiplier(networkData: { dailyActiveUsers: number }): number {
		// Network effect multiplier - more engagement creates more value
		const { dailyActiveUsers } = networkData;
		return Math.min(2.0, 1.0 + dailyActiveUsers / 10000);
	}

	private getActionTypeMultiplier(actionType: string): number {
		const multipliers: Record<string, number> = {
			cwc_message: 1.5, // CWC messages are high-value
			direct_action: 1.2, // Direct actions are valuable
			template_creation: 2.0, // Template creation is highly valuable
			challenge_participation: 1.3, // Challenge market participation
			unknown: 1.0
		};

		return multipliers[actionType] || 1.0;
	}

	private calculateReputationMultiplier(userRep: { trust_score: number } | null): number {
		if (!userRep) return 1.0;

		// Higher trust score users get bonus rewards (max 3x)
		return Math.min(3.0, 1.0 + userRep.trust_score / 1000);
	}

	private calculateTimeDecay(timestamp?: string): number {
		if (!timestamp) return 1.0;

		const actionTime = new Date(timestamp).getTime();
		const now = Date.now();
		const daysSince = (now - actionTime) / (24 * 60 * 60 * 1000);

		// Actions lose value over time (7 day half-life)
		return Math.max(0.1, Math.pow(0.5, daysSince / 7));
	}

	private calculateUrgencyMultiplier(timestamp?: string): number {
		// This would integrate with political calendar APIs in production
		// For now, simulate urgency based on day of week and time patterns

		const now = new Date(timestamp || Date.now());
		const dayOfWeek = now.getDay();
		const hour = now.getHours();

		// Higher multiplier during typical legislative activity
		// Monday-Thursday, business hours
		if (dayOfWeek >= 1 && dayOfWeek <= 4 && hour >= 9 && hour <= 17) {
			return 1.2;
		}

		// Lower multiplier during weekends and off-hours
		return 0.9;
	}

	private async getETHPrice(): Promise<number> {
		// Mock price - in production would use Chainlink or other oracles
		// With circuit breakers to prevent manipulation
		return 2000; // $2000 USD per ETH
	}

	private calculateConfidence(
		networkData: { dailyActiveUsers: number },
		userRep: { trust_score: number; reputation_tier: string } | null,
		context: AgentContext
	): number {
		let confidence = 0.8; // Base confidence

		// Higher confidence with more network data
		if (networkData.dailyActiveUsers > 100) confidence += 0.1;
		if (networkData.dailyActiveUsers > 1000) confidence += 0.1;

		// Higher confidence with user reputation data
		if (userRep && userRep.trust_score > 50) confidence += 0.05;

		// Lower confidence for edge cases
		if (!context.userId) confidence -= 0.2;
		if (!context.actionType) confidence -= 0.1;

		return Math.min(1.0, Math.max(0.1, confidence));
	}

	private generateReasoning(
		params: RewardParameters,
		networkData: { dailyActiveUsers: number; totalActions: number },
		context: AgentContext
	): string {
		const { baseRewardUSD, multipliers, totalMultiplier } = params;

		return (
			`Dynamic reward calculation: Base $${baseRewardUSD.toFixed(4)} × ${totalMultiplier.toFixed(2)} = $${(baseRewardUSD * totalMultiplier).toFixed(4)}. ` +
			`Network: ${networkData.dailyActiveUsers} active users, ${networkData.totalActions} daily actions. ` +
			`Multipliers: activity ${multipliers.activity.toFixed(2)}, action ${multipliers.action.toFixed(2)}, ` +
			`reputation ${multipliers.reputation.toFixed(2)}, urgency ${multipliers.urgency.toFixed(2)}. ` +
			`Action type: ${context.actionType}`
		);
	}
}
