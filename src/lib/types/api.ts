/**
 * API TYPES - Eliminate 'any' pollution in API handlers
 */

// Analytics Event Types - Updated for Phase 1 Consolidation
export interface AnalyticsEventCreate {
	name: string;
	event_type: 'pageview' | 'interaction' | 'conversion' | 'funnel' | 'campaign';
	template_id?: string;
	user_id?: string;
	session_id: string;
	funnel_step?: number;
	experiment_id?: string;
	properties?: Record<string, any>;
	timestamp?: string;
}

export interface EnrichedAnalyticsEvent extends AnalyticsEventCreate {
	id: string;
	computed_metrics: Record<string, any>;
	created_at: Date;
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
export interface ApiResponse<T = Record<string, any>> {
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

export interface ProcessChallengeVoteParams {
	challengeId: string;
	userId: string;
	side: 'support' | 'oppose';
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

// N8N Process Template Response Types
export interface N8NStageVerification {
	approved: boolean;
	severityLevel: number;
	corrections?: {
		subject?: string;
		body?: string;
	};
	violations?: string[];
}

export interface N8NStageConsensus {
	approved: boolean;
	score: number;
	agentCount: number;
	diversityScore: number;
}

export interface N8NStageReward {
	amount: string;
	formatted: string;
	breakdown: {
		supply: string;
		marketMultiplier: number;
		impactMultiplier: number;
	};
}

export interface N8NStageReputation {
	changes: Array<{
		challenge?: number;
		civic?: number;
		discourse?: number;
	}>;
	newTier: string;
	badges: string[];
}

export interface N8NCWCReady {
	subject: string;
	body: string;
	recipients: string[];
	templateId: string;
}

export interface N8NProcessTemplateResponse {
	success: boolean;
	templateId: string;
	submissionId: string;
	approved?: boolean;
	reason?: string;
	stages: {
		verification?: N8NStageVerification;
		consensus?: N8NStageConsensus;
		reward?: N8NStageReward;
		reputation?: N8NStageReputation;
	};
	cwcReady?: N8NCWCReady;
}

// Template verification correction types
export interface TemplateCorrections {
	subject?: string;
	body?: string;
}
