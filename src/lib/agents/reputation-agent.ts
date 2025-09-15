/**
 * Reputation Agent
 * 
 * Manages user reputation scores across different dimensions
 * Implements portable ERC-8004 reputation mechanics
 */

import { BaseAgent, type AgentConfig, type AgentDecision } from './base-agent';

export interface ReputationInput {
	userAddress: string;
	actionType: string;
	qualityScore: number; // 0-100
	currentReputation?: {
		challenge: number;
		civic: number;
		discourse: number;
		total: number;
	};
	actionHistory?: {
		totalActions: number;
		successfulChallenges: number;
		failedChallenges: number;
		civicActions: number;
	};
}

export interface ReputationDecision extends AgentDecision {
	reputationChanges: {
		challenge: number;
		civic: number;
		discourse: number;
		total: number;
	};
	newTier: 'untrusted' | 'novice' | 'emerging' | 'established' | 'trusted';
	badges?: string[];
}

export class ReputationAgent extends BaseAgent {
	// Reputation tier thresholds
	private readonly TIER_THRESHOLDS = {
		untrusted: 0,
		novice: 20,
		emerging: 40,
		established: 60,
		trusted: 80
	};
	
	constructor() {
		super({
			name: 'reputation_agent',
			temperature: 0.2,
			maxTokens: 600,
			capabilities: ['credibility_scoring', 'discourse_evaluation', 'reputation_tracking']
		});
	}
	
	async process(input: ReputationInput): Promise<ReputationDecision> {
		const {
			userAddress,
			actionType,
			qualityScore,
			currentReputation = { challenge: 50, civic: 50, discourse: 50, total: 50 },
			actionHistory = {}
		} = input;
		
		// Calculate reputation changes based on action
		const changes = this.calculateReputationChanges(
			actionType,
			qualityScore,
			currentReputation,
			actionHistory
		);
		
		// Apply changes (with bounds)
		const newReputation = {
			challenge: Math.max(0, Math.min(100, currentReputation.challenge + changes.challenge)),
			civic: Math.max(0, Math.min(100, currentReputation.civic + changes.civic)),
			discourse: Math.max(0, Math.min(100, currentReputation.discourse + changes.discourse)),
			total: 0
		};
		
		// Calculate weighted total
		newReputation.total = this.calculateTotalReputation(newReputation);
		
		// Determine tier
		const newTier = this.determineTier(newReputation.total);
		
		// Check for badges
		const badges = this.checkBadges(newReputation, actionHistory);
		
		return {
			decision: 'reputation_updated',
			confidence: 0.85,
			reasoning: [
				`Action type: ${actionType}`,
				`Quality score: ${qualityScore}/100`,
				`Challenge reputation: ${currentReputation.challenge} → ${newReputation.challenge}`,
				`Civic reputation: ${currentReputation.civic} → ${newReputation.civic}`,
				`Discourse reputation: ${currentReputation.discourse} → ${newReputation.discourse}`,
				`New tier: ${newTier}`
			],
			reputationChanges: {
				challenge: changes.challenge,
				civic: changes.civic,
				discourse: changes.discourse,
				total: newReputation.total - currentReputation.total
			},
			newTier,
			badges: badges.length > 0 ? badges : undefined
		};
	}
	
	async validate(input: any): Promise<boolean> {
		return input?.userAddress && input?.actionType && 
			   typeof input?.qualityScore === 'number';
	}
	
	/**
	 * Calculate reputation changes based on action
	 */
	private calculateReputationChanges(
		actionType: string,
		qualityScore: number,
		currentReputation: any,
		actionHistory: any
	): ReputationDecision['reputationChanges'] {
		const changes = {
			challenge: 0,
			civic: 0,
			discourse: 0,
			total: 0
		};
		
		// Base change scaled by quality
		const baseChange = (qualityScore - 50) / 10; // -5 to +5
		
		switch (actionType) {
			case 'cwc_message':
				// Congressional messages primarily affect civic reputation
				changes.civic = baseChange * 1.5;
				changes.discourse = baseChange * 0.5;
				break;
				
			case 'challenge_market':
				// Challenges affect all dimensions
				changes.challenge = baseChange * 2;
				changes.discourse = baseChange * 1;
				changes.civic = baseChange * 0.5;
				break;
				
			case 'direct_action':
				// Direct actions affect civic and discourse
				changes.civic = baseChange * 1;
				changes.discourse = baseChange * 1;
				break;
		}
		
		// Apply diminishing returns for high reputation
		if (currentReputation.total > 80) {
			changes.challenge *= 0.5;
			changes.civic *= 0.5;
			changes.discourse *= 0.5;
		}
		
		// Apply bonus for consistency
		if (actionHistory.totalActions > 10) {
			const consistencyBonus = Math.min(0.5, actionHistory.totalActions / 100);
			changes.civic += consistencyBonus;
		}
		
		return changes;
	}
	
	/**
	 * Calculate weighted total reputation
	 */
	private calculateTotalReputation(reputation: any): number {
		// Weighted average: 40% challenge, 40% civic, 20% discourse
		return reputation.challenge * 0.4 + 
			   reputation.civic * 0.4 + 
			   reputation.discourse * 0.2;
	}
	
	/**
	 * Determine reputation tier
	 */
	private determineTier(totalReputation: number): ReputationDecision['newTier'] {
		if (totalReputation >= this.TIER_THRESHOLDS.trusted) return 'trusted';
		if (totalReputation >= this.TIER_THRESHOLDS.established) return 'established';
		if (totalReputation >= this.TIER_THRESHOLDS.emerging) return 'emerging';
		if (totalReputation >= this.TIER_THRESHOLDS.novice) return 'novice';
		return 'untrusted';
	}
	
	/**
	 * Check for earned badges
	 */
	private checkBadges(reputation: any, actionHistory: any): string[] {
		const badges: string[] = [];
		
		// Civic Leader badge
		if (reputation.civic >= 90) {
			badges.push('civic_leader');
		}
		
		// Truth Seeker badge
		if (reputation.challenge >= 90) {
			badges.push('truth_seeker');
		}
		
		// Thoughtful Discourse badge
		if (reputation.discourse >= 90) {
			badges.push('thoughtful_discourse');
		}
		
		// Consistent Contributor badge
		if (actionHistory.totalActions >= 50) {
			badges.push('consistent_contributor');
		}
		
		// Perfect Record badge
		if (actionHistory.successfulChallenges > 10 && actionHistory.failedChallenges === 0) {
			badges.push('perfect_record');
		}
		
		return badges;
	}
	
	/**
	 * Calculate reputation decay over time
	 */
	async calculateDecay(
		lastActionDate: Date,
		currentReputation: any
	): Promise<number> {
		const daysSinceAction = Math.floor(
			(Date.now() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24)
		);
		
		// No decay for 30 days
		if (daysSinceAction < 30) return 0;
		
		// Linear decay after 30 days, max 10% per year
		const decayRate = Math.min(0.1, (daysSinceAction - 30) / 365 * 0.1);
		return currentReputation.total * decayRate;
	}
	
	/**
	 * Generate portable reputation attestation (for ERC-8004)
	 */
	async generateAttestation(
		userAddress: string,
		reputation: any
	): Promise<object> {
		return {
			version: '1.0.0',
			protocol: 'VOTER',
			subject: userAddress,
			timestamp: new Date().toISOString(),
			scores: {
				challenge: reputation.challenge,
				civic: reputation.civic,
				discourse: reputation.discourse,
				total: reputation.total
			},
			tier: this.determineTier(reputation.total),
			signature: 'mock_signature' // Would be cryptographically signed in production
		};
	}
}