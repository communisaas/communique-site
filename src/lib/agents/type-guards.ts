/**
 * Type guards for agent decision interfaces
 */

// Supply agent decision structure - should match RewardParameters
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
	// Compatibility properties
	rewardAmount?: number;
	supplyImpact?: number;
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

// Impact agent decision structure
export interface ImpactDecision {
	rewardAmount: number; // Add missing property for compatibility
	templateId: string;
	legislativeOutcomes: unknown[];
	impactScore: number;
	confidenceLevel: 'high' | 'medium' | 'low';
	causalChains: unknown[];
	correlationStrength: number;
	recommendedFunding?: number;
	// Additional properties
	impactMultiplier?: number;
}

// Verification agent decision structure
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
	corrections?: Record<string, string>;
	severityLevel?: number;
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

// Reputation agent decision structure
export interface ReputationDecision {
	userId: string;
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
		return decision;
	}
	return { 
		baseRewardUSD: 0, 
		multipliers: { activity: 1, action: 1, reputation: 1, complexity: 1, time: 1, urgency: 1 },
		totalMultiplier: 1,
		ethPrice: 2000,
		finalRewardETH: 0,
		finalRewardWei: '0',
		rewardAmount: 0
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
		return decision;
	}
	return { 
		rewardAmount: 0,
		templateId: '',
		legislativeOutcomes: [],
		impactScore: 0,
		confidenceLevel: 'low',
		causalChains: [],
		correlationStrength: 0
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