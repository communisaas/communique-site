/**
 * Type guards for agent decision interfaces
 */

// Supply agent decision structure - matches RewardParameters exactly
export interface SupplyDecision {
	baseRewardUSD: number;
	multipliers: {
		activity: number;
		action: number;
		reputation: number;
		complexity: number;
		time: number;
		urgency: number;
	};
	totalMultiplier: number;
	ethPrice: number;
	finalRewardETH: number;
	finalRewardWei: string;
	// Compatibility properties for API backwards compatibility
	rewardAmount?: number; // Derived from finalRewardWei
	supplyImpact?: number; // Network effects multiplier
}

// Market agent decision structure  
export interface MarketDecision {
	rewardAmount: number; // Add missing property for compatibility
	decision: string;
	confidence: number;
	reasoning?: string[];
	rewardMultiplier: number;
	incentiveAdjustments: {
		urgencyBonus: number;
		qualityBonus: number;
		consistencyBonus: number;
	};
	marketSignal: 'bullish' | 'neutral' | 'bearish';
}

// Impact agent decision structure - matches ImpactAssessment exactly
export interface ImpactDecision {
	templateId: string;
	legislativeOutcomes: unknown[];
	impactScore: number;
	confidenceLevel: 'high' | 'medium' | 'low';
	causalChains: unknown[];
	correlationStrength: number;
	recommendedFunding?: number;
	// Compatibility properties for API backwards compatibility
	rewardAmount?: number; // Derived from recommendedFunding
	impactMultiplier?: number; // Calculated from impactScore
}

// Verification agent decision structure - matches VerificationAssessment
export interface VerificationDecision {
	userId: string;
	verificationLevel: 'unverified' | 'partial' | 'verified' | 'high_assurance';
	trustScore: number;
	verificationSources: VerificationSource[];
	riskFactors: string[];
	recommendedActions: string[];
	zkProofHash?: string;
	districtVerification?: {
		congressionalDistrict: string;
		confidence: number;
		source: string;
	};
	// Template verification properties
	approved?: boolean;
	corrections?: {
		subject?: string;
		body?: string;
		[key: string]: string | undefined;
	};
	severityLevel?: number;
	violations?: string[];
}

// Verification source structure
export interface VerificationSource {
	provider: 'didit' | 'manual_review' | 'blockchain_history';
	type: 'kyc' | 'zk_proof' | 'address_verification' | 'behavioral_analysis';
	score: number; // 0-100
	confidence: number; // 0-1
	timestamp: Date;
	metadata: unknown;
}

// Reputation agent decision structure - matches CredibilityAssessment exactly
export interface ReputationDecision {
	userId: string;
	walletAddress?: string;
	credibilityScore: number;
	credibilityComponents: {
		civic_engagement: number;
		information_quality: number;
		community_trust: number;
		verification_depth: number;
		behavioral_integrity: number;
	};
	tier: 'untrusted' | 'emerging' | 'established' | 'respected' | 'authoritative';
	badges: string[];
	attestations: unknown[];
	riskFactors: string[];
	portabilityHash: string;
	// Additional agent processing fields
	reputationChanges?: {
		challenge?: number;
		civic?: number;
		discourse?: number;
	};
	newTier?: string;
}

// Type guards
export function isSupplyDecision(obj: unknown): obj is SupplyDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'baseRewardUSD' in obj &&
		'finalRewardWei' in obj &&
		'multipliers' in obj &&
		typeof (obj as SupplyDecision).baseRewardUSD === 'number' &&
		typeof (obj as SupplyDecision).finalRewardWei === 'string'
	);
}

export function isMarketDecision(obj: unknown): obj is MarketDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'decision' in obj &&
		'rewardMultiplier' in obj &&
		'marketSignal' in obj &&
		'incentiveAdjustments' in obj &&
		typeof (obj as MarketDecision).rewardMultiplier === 'number' &&
		typeof (obj as MarketDecision).decision === 'string'
	);
}

export function isImpactDecision(obj: unknown): obj is ImpactDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'templateId' in obj &&
		'impactScore' in obj &&
		'legislativeOutcomes' in obj &&
		'confidenceLevel' in obj &&
		typeof (obj as ImpactDecision).templateId === 'string' &&
		typeof (obj as ImpactDecision).impactScore === 'number'
	);
}

export function isVerificationDecision(obj: unknown): obj is VerificationDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'userId' in obj &&
		'verificationLevel' in obj &&
		'trustScore' in obj &&
		'verificationSources' in obj &&
		typeof (obj as VerificationDecision).userId === 'string' &&
		typeof (obj as VerificationDecision).trustScore === 'number'
	);
}

export function isReputationDecision(obj: unknown): obj is ReputationDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'userId' in obj &&
		'credibilityScore' in obj &&
		'credibilityComponents' in obj &&
		'tier' in obj &&
		typeof (obj as ReputationDecision).userId === 'string' &&
		typeof (obj as ReputationDecision).credibilityScore === 'number'
	);
}

// Helper function to safely extract decision data
export function extractSupplyDecision(decision: unknown): SupplyDecision {
	if (isSupplyDecision(decision)) {
		// Add compatibility properties if missing
		const result = { ...decision };
		if (!result.rewardAmount) {
			// Convert finalRewardWei to number for compatibility
			result.rewardAmount = Number(result.finalRewardWei) || 0;
		}
		if (!result.supplyImpact) {
			// Calculate supply impact from multipliers
			result.supplyImpact = result.totalMultiplier || 1.0;
		}
		return result;
	}
	return { 
		baseRewardUSD: 0, 
		multipliers: { activity: 1, action: 1, reputation: 1, complexity: 1, time: 1, urgency: 1 },
		totalMultiplier: 1,
		ethPrice: 2000,
		finalRewardETH: 0,
		finalRewardWei: '0',
		rewardAmount: 0,
		supplyImpact: 1.0
	};
}

export function extractMarketDecision(decision: unknown): MarketDecision {
	if (isMarketDecision(decision)) {
		return decision;
	}
	return { 
		rewardAmount: 0,
		decision: 'neutral',
		confidence: 0.5,
		rewardMultiplier: 1, 
		marketSignal: 'neutral',
		incentiveAdjustments: { urgencyBonus: 0, qualityBonus: 0, consistencyBonus: 0 }
	};
}

export function extractImpactDecision(decision: unknown): ImpactDecision {
	if (isImpactDecision(decision)) {
		// Add compatibility properties if missing
		const result = { ...decision };
		if (!result.rewardAmount) {
			// Use recommendedFunding as rewardAmount for compatibility
			result.rewardAmount = result.recommendedFunding || 0;
		}
		if (!result.impactMultiplier) {
			// Calculate impact multiplier from score (0-100 scale to 1.0-2.0 multiplier)
			result.impactMultiplier = result.impactScore > 0 ? 1.0 + (result.impactScore / 100) : 1.0;
		}
		return result;
	}
	return { 
		templateId: '',
		legislativeOutcomes: [],
		impactScore: 0,
		confidenceLevel: 'low',
		causalChains: [],
		correlationStrength: 0,
		rewardAmount: 0,
		impactMultiplier: 1.0
	};
}

export function extractVerificationDecision(decision: unknown): VerificationDecision {
	if (isVerificationDecision(decision)) {
		return decision;
	}
	return { 
		userId: '',
		verificationLevel: 'unverified',
		trustScore: 0,
		verificationSources: [],
		riskFactors: [],
		recommendedActions: []
	};
}

export function extractReputationDecision(decision: unknown): ReputationDecision {
	if (isReputationDecision(decision)) {
		return decision;
	}
	return {
		userId: '',
		walletAddress: undefined,
		credibilityScore: 0,
		credibilityComponents: {
			civic_engagement: 0,
			information_quality: 0,
			community_trust: 0,
			verification_depth: 0,
			behavioral_integrity: 0
		},
		tier: 'untrusted',
		badges: [],
		attestations: [],
		riskFactors: [],
		portabilityHash: ''
	};
}