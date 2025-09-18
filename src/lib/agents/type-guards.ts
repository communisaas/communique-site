/**
 * Type guards for agent decision interfaces
 */

// Supply agent decision structure
export interface SupplyDecision {
	rewardAmount: number;
	supplyImpact: number;
	finalRewardWei?: string;
}

// Market agent decision structure  
export interface MarketDecision {
	rewardMultiplier: number;
	marketSignal: 'bull' | 'bear' | 'neutral';
}

// Impact agent decision structure
export interface ImpactDecision {
	impactMultiplier: number;
	impactScore: number;
	legislativeOutcomes?: unknown[];
}

// Verification agent decision structure
export interface VerificationDecision {
	corrections: Record<string, unknown>;
	severityLevel: number;
}

// Type guards
export function isSupplyDecision(obj: unknown): obj is SupplyDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'rewardAmount' in obj &&
		typeof (obj as SupplyDecision).rewardAmount === 'number'
	);
}

export function isMarketDecision(obj: unknown): obj is MarketDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'rewardMultiplier' in obj &&
		typeof (obj as MarketDecision).rewardMultiplier === 'number'
	);
}

export function isImpactDecision(obj: unknown): obj is ImpactDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'impactMultiplier' in obj &&
		typeof (obj as ImpactDecision).impactMultiplier === 'number'
	);
}

export function isVerificationDecision(obj: unknown): obj is VerificationDecision {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'corrections' in obj &&
		'severityLevel' in obj &&
		typeof (obj as VerificationDecision).severityLevel === 'number'
	);
}

// Helper function to safely extract decision data
export function extractSupplyDecision(decision: unknown): SupplyDecision {
	if (isSupplyDecision(decision)) {
		return decision;
	}
	return { rewardAmount: 0, supplyImpact: 0 };
}

export function extractMarketDecision(decision: unknown): MarketDecision {
	if (isMarketDecision(decision)) {
		return decision;
	}
	return { rewardMultiplier: 1, marketSignal: 'neutral' };
}

export function extractImpactDecision(decision: unknown): ImpactDecision {
	if (isImpactDecision(decision)) {
		return decision;
	}
	return { impactMultiplier: 1, impactScore: 0 };
}

export function extractVerificationDecision(decision: unknown): VerificationDecision {
	if (isVerificationDecision(decision)) {
		return decision;
	}
	return { corrections: {}, severityLevel: 1 };
}