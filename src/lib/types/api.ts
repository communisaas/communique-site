/**
 * API TYPES - Eliminate 'any' pollution in API handlers
 */

// Analytics Event Types
export interface AnalyticsEvent {
	event:
		| 'template_viewed'
		| 'onboarding_started'
		| 'auth_completed'
		| 'template_used'
		| 'template_shared';
	template_id: string;
	user_id?: string;
	session_id?: string;
	source?: string;
	properties?: Record<string, string | number | boolean>;
	timestamp: string;
	ip_address?: string;
	user_agent?: string;
}

export interface EnrichedAnalyticsEvent extends AnalyticsEvent {
	server_timestamp: string;
}

// Template Update Data
export interface TemplateUpdateData {
	title?: string;
	description?: string;
	message_body?: string;
	category?: string;
	recipient_config?: unknown;
	delivery_config?: unknown;
}

// Address Update Request
export interface AddressUpdateRequest {
	address: string;
}

export interface AddressUpdateResponse {
	success: boolean;
	user: {
		street: string;
		city: string;
		state: string;
		zip: string;
	};
}

// Profile Update Request
export interface ProfileUpdateRequest {
	role: string;
	connection: string;
}

// API Response Base
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}

// VOTER Protocol API Types
export interface VOTERApiRequest {
	action: string;
	[key: string]: unknown;
}

export interface IdentityVerificationRequest {
	userId: string;
	walletAddress?: string;
	zkProof?: string;
	publicInputs?: string;
}

export interface IdentityVerificationResponse {
	success: boolean;
	userId: string;
	walletAddress?: string;
	verification: {
		status: string;
		trust_score: number;
		congressional_district?: string;
		district_hash?: string;
		verified_at: string;
	};
	permissions: {
		can_submit_templates: boolean;
		can_create_challenges: boolean;
		can_vote_challenges: boolean;
		daily_action_limit: number;
		max_stake: number;
	};
	message: string;
}

export interface ChallengeRequest {
	challengerId: string;
	defenderId: string;
	title: string;
	description: string;
	evidence: string;
	stakeAmount: string;
	category: string;
}

export interface ChallengeVoteRequest {
	challengeId: string;
	userId: string;
	vote: 'support' | 'oppose';
	stakeAmount: string;
}

export interface RewardCalculationRequest {
	userAddress: string;
	actionType: string;
	templateId?: string;
	timestamp?: string;
}

export interface RewardCalculationResponse {
	success: boolean;
	action: string;
	user: string;
	base_reward_usd: number;
	multipliers: {
		activity: number;
		action: number;
		reputation: number;
		complexity: number;
		time: number;
	};
	total_multiplier: number;
	reward_usd: number;
	reward_eth: number;
	reward_wei: string;
	eth_price: number;
	network_activity: number;
	user_reputation: number;
	calculation_timestamp: string;
}

// Blockchain Transaction Types for VOTER Protocol
export interface BlockchainTransactionLog {
	address: string;
	topics: string[];
	data: string;
	blockNumber: number;
	transactionHash: string;
	transactionIndex: number;
	blockHash: string;
	logIndex: number;
}

export interface BlockchainTransactionReceipt {
	blockHash: string;
	blockNumber: number;
	transactionHash: string;
	transactionIndex: number;
	from: string;
	to: string | null;
	gasUsed: string; // BigInt as string
	gasPrice?: string; // BigInt as string
	effectiveGasPrice?: string; // BigInt as string
	cumulativeGasUsed: string; // BigInt as string
	status: number;
	type: number;
	logs: BlockchainTransactionLog[];
}

export interface VOTERTransactionSuccess {
	success: true;
	transactionHash: string;
	blockNumber: number;
	gasUsed: string;
	gasPrice?: string;
	effectiveGasPrice?: string;
	actionHash?: string;
	receipt: BlockchainTransactionReceipt;
}

export interface VOTERTransactionError {
	success: false;
	error: string;
	code?: string;
	details?: {
		reason?: string;
		method?: string;
		transaction?: any;
	};
}

export type VOTERTransactionResult = VOTERTransactionSuccess | VOTERTransactionError;

export interface CivicActionCertificationRequest {
	userAddress: string;
	actionType: 'CWC_MESSAGE' | 'LOCAL_ACTION' | 'DIRECT_ACTION' | 'TOWN_HALL' | 'PUBLIC_COMMENT';
	templateId?: string;
	deliveryConfirmation?: string;
	personalConnection?: string;
}

export interface UserRegistrationRequest {
	userAddress: string;
	phoneHash: string;
	selfProof: string;
}
