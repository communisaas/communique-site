/**
 * Quadratic Reputation Calculator
 *
 * Implements quadratic scaling for reputation rewards and penalties
 * Based on template moderation outcomes and consensus strength
 * Aligns with VOTER Protocol's "quality discourse pays, bad faith costs" principle
 */

import { db } from '$lib/core/db';
import type { Template, User } from '@prisma/client';

// Type for user actions used in gaming detection
interface UserAction {
	created_at: Date;
	quality_score?: number;
	message_body?: string;
}

// Type guard for user actions
function _isValidUserAction(action: unknown): action is UserAction {
	return (
		typeof action === 'object' &&
		action !== null &&
		(action as UserAction).created_at instanceof Date
	);
}

interface ReputationUpdate {
	delta: number;
	reason: string;
	tier: ReputationTier;
	breakdown: {
		base: number;
		multiplier: number;
		final: number;
	};
}

type ReputationTier =
	| 'untrusted' // 0-30
	| 'novice' // 31-50
	| 'emerging' // 51-70
	| 'established' // 71-90
	| 'trusted'; // 91-100

export class ReputationCalculator {
	// Reputation bounds
	private readonly MIN_REPUTATION = 0;
	private readonly MAX_REPUTATION = 100;

	// Tier thresholds (using quadratic scaling)
	private readonly TIER_THRESHOLDS = {
		untrusted: 0,
		novice: 31,
		emerging: 51,
		established: 71,
		trusted: 91
	};

	/**
	 * Apply template verification result to user reputation (Phase 4: verification fields in Template)
	 */
	async applyTemplateResult(templateId: string): Promise<ReputationUpdate> {
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: {
				user: true // Assuming template has user relation
			}
		});

		if (!template) {
			throw new Error(`Template ${templateId} not found`);
		}

		// Check if already applied
		if (template.reputation_applied) {
			return {
				delta: template.reputation_delta || 0,
				reason: 'Already applied',
				tier: this.getTier(template.user?.trust_score || 50),
				breakdown: { base: 0, multiplier: 1, final: 0 }
			};
		}

		// Calculate reputation change
		const update = this.calculateReputationDelta(template as Template & { user: User });

		// Apply bounds checking
		const currentRep = template.user?.trust_score || 50;
		const newRep = Math.max(
			this.MIN_REPUTATION,
			Math.min(this.MAX_REPUTATION, currentRep + update.delta)
		);

		// Update user reputation
		if (template.user) {
			await db.user.update({
				where: { id: template.user.id },
				data: {
					trust_score: Math.round(newRep)
				}
			});
		}

		// Mark as applied
		await db.template.update({
			where: { id: templateId },
			data: {
				reputation_delta: update.delta,
				reputation_applied: true
			}
		});

		// Log significant changes
		if (Math.abs(update.delta) > 10) {
			console.log(`Significant reputation change for user ${template.user?.id}:`, {
				previous: currentRep,
				new: newRep,
				delta: update.delta,
				reason: update.reason
			});
		}

		return update;
	}

	/**
	 * Calculate reputation delta using quadratic scaling (Phase 4: using Template model)
	 */
	private calculateReputationDelta(template: Template & { user: User }): ReputationUpdate {
		const consensusScore = template.consensus_score || 0;
		const severity = template.severity_level || 1;
		const currentRep = template.user?.trust_score || 50;

		let baseDelta = 0;
		let multiplier = 1;
		let reason = '';

		// Strong approval (consensus >= 90%): Quadratic reward
		if (consensusScore >= 0.9) {
			baseDelta = Math.pow(consensusScore * 10, 2) / 10; // Max +10 points
			reason = 'Strong consensus approval - quadratic reward';

			// Bonus for high-quality corrections
			if (template.correction_log && template.quality_score && template.quality_score > 80) {
				baseDelta *= 1.2;
				reason += ' with quality bonus';
			}
		}
		// Medium approval (70-89%): Linear reward
		else if (consensusScore >= 0.7) {
			baseDelta = (consensusScore * 10) / 1.5; // Max +6 points
			reason = 'Medium consensus approval - linear reward';
		}
		// Weak approval (30-69%): Small reward
		else if (consensusScore >= 0.3) {
			baseDelta = consensusScore * 3; // Max +2 points
			reason = 'Weak approval - minimal reward';
		}
		// Rejection with high severity: Quadratic penalty
		else if (consensusScore < 0.3 && severity >= 7) {
			// Quadratic penalty based on severity
			baseDelta = -Math.pow(severity, 2);

			// Scale by current reputation (more to lose)
			multiplier = 1 + currentRep / 100;
			reason = `Rejection at severity ${severity} - quadratic penalty`;

			// Extra penalty for severe violations
			if (severity >= 9) {
				baseDelta *= 1.5;
				reason += ' with severe violation multiplier';
			}
		}
		// Soft rejection (low severity): Small penalty
		else {
			baseDelta = -severity;
			reason = 'Soft rejection - linear penalty';
		}

		// Apply exponential decay at extremes to prevent gaming
		if (currentRep > 90) {
			// Harder to gain at high reputation
			if (baseDelta > 0) {
				baseDelta *= 0.5;
				reason += ' (high reputation decay)';
			}
		} else if (currentRep < 10) {
			// Harder to lose at low reputation (pr_event going negative)
			if (baseDelta < 0) {
				baseDelta *= 0.5;
				reason += ' (low reputation floor)';
			}
		}

		const finalDelta = baseDelta * multiplier;

		return {
			delta: finalDelta,
			reason,
			tier: this.getTier(currentRep + finalDelta),
			breakdown: {
				base: baseDelta,
				multiplier,
				final: finalDelta
			}
		};
	}

	/**
	 * Get reputation tier using quadratic calculation
	 */
	getTier(reputation: number): ReputationTier {
		// Quadratic tier calculation for more meaningful progression
		const scaledRep = Math.floor(Math.sqrt(Math.max(0, reputation) / 10) * 31.6);

		if (scaledRep >= this.TIER_THRESHOLDS.trusted) return 'trusted';
		if (scaledRep >= this.TIER_THRESHOLDS.established) return 'established';
		if (scaledRep >= this.TIER_THRESHOLDS.emerging) return 'emerging';
		if (scaledRep >= this.TIER_THRESHOLDS.novice) return 'novice';
		return 'untrusted';
	}

	/**
	 * Get tier display information
	 */
	getTierInfo(tier: ReputationTier): {
		name: string;
		color: string;
		description: string;
		privileges: string[];
	} {
		const tiers = {
			untrusted: {
				name: 'Untrusted',
				color: '#dc2626', // red
				description: 'Building initial credibility',
				privileges: ['Basic template creation', 'Limited daily submissions']
			},
			novice: {
				name: 'Novice',
				color: '#f97316', // orange
				description: 'Learning the ropes',
				privileges: ['Standard template creation', 'Basic challenge participation']
			},
			emerging: {
				name: 'Emerging',
				color: '#eab308', // yellow
				description: 'Gaining recognition',
				privileges: ['Priority moderation queue', 'Reduced challenge stakes']
			},
			established: {
				name: 'Established',
				color: '#22c55e', // green
				description: 'Proven track record',
				privileges: ['Fast-track approval', 'Challenge market creation', 'Reward multipliers']
			},
			trusted: {
				name: 'Trusted',
				color: '#3b82f6', // blue
				description: 'Elite civic participant',
				privileges: [
					'Auto-approval for low severity',
					'Maximum reward rates',
					'Treasury voting rights',
					'Congressional priority routing'
				]
			}
		};

		return tiers[tier];
	}

	/**
	 * Calculate reputation-based reward multiplier
	 */
	getRewardMultiplier(reputation: number): number {
		const tier = this.getTier(reputation);

		switch (tier) {
			case 'trusted':
				return 2.0; // 100% bonus
			case 'established':
				return 1.5; // 50% bonus
			case 'emerging':
				return 1.2; // 20% bonus
			case 'novice':
				return 1.0; // No bonus
			case 'untrusted':
				return 0.8; // 20% penalty
			default:
				return 1.0;
		}
	}

	/**
	 * Calculate challenge stake requirements based on reputation
	 */
	getChallengeStakeRequirement(
		challengerRep: number,
		_targetRep: number,
		baseStake: number
	): number {
		const challengerTier = this.getTier(challengerRep);
		const targetTier = this.getTier(_targetRep);

		// Lower stakes for higher reputation challengers
		let stakeMultiplier = 1.0;

		if (challengerTier === 'trusted') {
			stakeMultiplier *= 0.5; // 50% discount
		} else if (challengerTier === 'established') {
			stakeMultiplier *= 0.75; // 25% discount
		}

		// Higher stakes when challenging higher reputation users
		if (targetTier === 'trusted') {
			stakeMultiplier *= 2.0; // Double stake required
		} else if (targetTier === 'established') {
			stakeMultiplier *= 1.5; // 50% more stake required
		}

		return Math.round(baseStake * stakeMultiplier);
	}

	/**
	 * Detect reputation gaming attempts
	 */
	async detectGaming(
		userId: string,
		recentActions: UserAction[]
	): Promise<{
		suspicious: boolean;
		penalty?: number;
		reasons: string[];
	}> {
		const reasons: string[] = [];
		let penalty = 0;

		// Check for rapid template farming
		const actionsPerHour = recentActions.filter((a) => {
			const hourAgo = new Date(Date.now() - 3600000);
			return a.created_at > hourAgo;
		}).length;

		if (actionsPerHour > 10) {
			reasons.push('Excessive activity detected');
			penalty += Math.pow(actionsPerHour - 10, 2); // Quadratic penalty for spam
		}

		// Check for low quality pattern
		const avgQuality =
			recentActions.reduce((sum, a) => sum + (a.quality_score || 50), 0) / recentActions.length;
		if (avgQuality < 30 && recentActions.length > 5) {
			reasons.push('Pattern of low-quality submissions');
			penalty += Math.pow((50 - avgQuality) / 10, 2) * 5;
		}

		// Check for coordinated activity (similar templates in short time)
		const templates = recentActions.map((a) => a.message_body).filter(Boolean) as string[];
		const similarity = this.checkTemplateSimilarity(templates);
		if (similarity > 0.9 && templates.length > 3) {
			reasons.push('Potential template farming detected');
			penalty += 25; // Flat penalty for obvious gaming
		}

		return {
			suspicious: reasons.length > 0,
			penalty: penalty > 0 ? Math.round(penalty) : undefined,
			reasons
		};
	}

	/**
	 * Check similarity between templates (simple implementation)
	 */
	private checkTemplateSimilarity(templates: string[]): number {
		if (templates.length < 2) return 0;

		let totalSimilarity = 0;
		let comparisons = 0;

		for (let i = 0; i < templates.length - 1; i++) {
			for (let j = i + 1; j < templates.length; j++) {
				const similarity = this.calculateStringSimilarity(templates[i], templates[j]);
				totalSimilarity += similarity;
				comparisons++;
			}
		}

		return comparisons > 0 ? totalSimilarity / comparisons : 0;
	}

	/**
	 * Simple string similarity calculation
	 */
	private calculateStringSimilarity(str1: string, str2: string): number {
		const longer = str1.length > str2.length ? str1 : str2;
		const shorter = str1.length > str2.length ? str2 : str1;

		if (longer.length === 0) return 1.0;

		const distance = this.levenshteinDistance(longer, shorter);
		return (longer.length - distance) / longer.length;
	}

	/**
	 * Levenshtein distance for string comparison
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}
}

// Export singleton instance
export const reputationCalculator = new ReputationCalculator();
