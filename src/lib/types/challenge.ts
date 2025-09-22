/**
 * Challenge Types - VOTER Protocol Challenge System
 *
 * Types for the challenge and dispute resolution system
 */

// Challenge types matching Prisma schema
export interface Challenge {
	id: string;
	challenger_id: string;
	defender_id: string;
	claim_hash: string;
	evidence_ipfs: string;
	stake_amount: string;
	status: string;
	resolution?: string;
	winner_id?: string;
	voting_deadline: Date;
	created_at: Date;
	resolved_at?: Date;
	creation_tx?: string;
	resolution_tx?: string;
	title: string;
	description: string;
	category?: string;
	// Relations - populated by Prisma includes
	challenger?: {
		id: string;
		email?: string;
		name?: string;
	};
	defender?: {
		id: string;
		email?: string;
		name?: string;
	};
	winner?: {
		id: string;
		email?: string;
		name?: string;
	};
	// Additional properties for compatibility with existing code
	verification?: unknown;
	claim?: unknown;
	challenger_address?: string; // Virtual property mapped from challenger relation
}

export interface ChallengeInclude {
	verification?: boolean;
	challenger?: boolean;
	defender?: boolean;
	winner?: boolean;
}

export interface ChallengeStake {
	id: string;
	challenge_id: string;
	user_id: string;
	side: string; // 'support' | 'oppose' - matches Prisma schema
	amount: string; // BigInt as string
	tx_hash?: string;
	created_at: Date;
	// Relations
	challenge?: Challenge;
	user?: {
		id: string;
		email?: string;
		name?: string;
	};
}

// Extended types for API responses
export interface ChallengeWithRelations extends Challenge {
	stakes?: ChallengeStake[];
}

// Type guards
export function isValidChallenge(obj: unknown): obj is Challenge {
	if (!obj || typeof obj !== 'object') return false;

	const record = obj as Record<string, unknown>;
	return (
		typeof record.id === 'string' &&
		typeof record.challenger_id === 'string' &&
		typeof record.defender_id === 'string' &&
		typeof record.claim_hash === 'string' &&
		typeof record.status === 'string'
	);
}

export function isValidChallengeStake(obj: unknown): obj is ChallengeStake {
	if (!obj || typeof obj !== 'object') return false;

	const record = obj as Record<string, unknown>;
	return (
		typeof record.id === 'string' &&
		typeof record.challenge_id === 'string' &&
		typeof record.user_id === 'string' &&
		typeof record.side === 'string' &&
		typeof record.amount === 'string'
	);
}
