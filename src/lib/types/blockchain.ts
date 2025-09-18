/**
 * Blockchain-related types for VOTER Protocol integration
 *
 * Defines types for addresses, rewards, reputation, and blockchain state
 * without requiring actual wallet connections.
 */

/**
 * User's blockchain identity and state
 */
export interface BlockchainUser {
	// Addresses
	derivedAddress?: string; // Generated deterministic address
	connectedAddress?: string; // Real wallet if connected
	activeAddress: string; // Which address to use
	addressType: 'derived' | 'connected' | 'certified';

	// VOTER Protocol state
	voterBalance: bigint; // VOTER token balance (virtual or real)
	stakedBalance: bigint; // sVOTER staked tokens
	votingPower: bigint; // Governance voting power

	// Reputation (from ERC-8004 registries)
	challengeScore: number; // Carroll Mechanisms score (0-100)
	civicScore: number; // Civic engagement score (0-100)
	discourseScore: number; // Discourse quality score (0-100)
	totalReputation: number; // Weighted total (0-100)
	reputationTier: ReputationTier;

	// Rewards tracking
	pendingRewards: bigint; // Unclaimed rewards
	totalEarned: bigint; // All-time earnings
	lastRewardClaim?: Date; // Last claim timestamp

	// Metadata
	addressGeneratedAt?: Date;
	walletConnectedAt?: Date;
	lastCertification?: Date;
}

/**
 * Reputation tiers for information quality markets
 */
export enum ReputationTier {
	TRUSTED = 'trusted', // 80-100 score
	ESTABLISHED = 'established', // 60-79 score
	EMERGING = 'emerging', // 40-59 score
	NOVICE = 'novice', // 20-39 score
	UNTRUSTED = 'untrusted' // 0-19 score
}

/**
 * Civic action certification
 */
export interface CivicCertification {
	id: string;
	userAddress: string;
	actionType: 'cwc_message' | 'direct_action' | 'challenge_market';
	actionHash: string;
	certificationHash: string;

	// Verification
	verified: boolean;
	verificationMethod: 'agent_consensus' | 'manual' | 'automatic';
	verificationAgents: string[]; // Agent addresses that verified
	consensusScore: number; // 0-1 consensus strength

	// Rewards
	rewardAmount: bigint;
	rewardTxHash?: string; // On-chain transaction
	rewardStatus: 'pending' | 'virtual' | 'claimed' | 'failed';

	// Reputation impact
	reputationChange: {
		challenge: number;
		civic: number;
		discourse: number;
		total: number;
	};

	// Metadata
	timestamp: Date;
	blockNumber?: number;
	ipfsHash?: string; // Decentralized storage
}

/**
 * Challenge market participation (Carroll Mechanisms)
 */
export interface ChallengeParticipation {
	challengeId: string;
	userAddress: string;

	// Challenge details
	claimHash: string;
	stance: 'support' | 'oppose';
	stakeAmount: bigint;

	// Quality assessment
	sourcesProvided: string[];
	sourcesQuality: number; // 0-100 score
	argumentQuality: number; // 0-100 score
	goodFaithScore: number; // 0-100 score

	// Outcome
	resolution: 'won' | 'lost' | 'pending';
	rewardEarned: bigint;
	reputationImpact: number;

	// Timestamps
	createdAt: Date;
	resolvedAt?: Date;
}

/**
 * Virtual reward tracking (before on-chain)
 */
export interface VirtualReward {
	id: string;
	userAddress: string;
	amount: bigint;

	// Source
	sourceType: 'certification' | 'challenge' | 'governance';
	sourceId: string; // Reference to source action

	// Status
	status: 'pending' | 'available' | 'claiming' | 'claimed';

	// Claiming
	claimable: boolean;
	claimRequirements?: string[]; // e.g., "connect_wallet", "kyc"
	claimTxHash?: string;

	// Timestamps
	earnedAt: Date;
	availableAt: Date; // When it becomes claimable
	claimedAt?: Date;
}

/**
 * Governance participation
 */
export interface GovernanceActivity {
	userAddress: string;
	proposalId: string;

	// Action
	actionType: 'propose' | 'vote' | 'delegate';
	voteChoice?: 'for' | 'against' | 'abstain';
	votingPower: bigint;

	// Delegation
	delegatedTo?: string;
	delegatedFrom?: string[];

	// Timestamps
	timestamp: Date;
	blockNumber: number;
}

/**
 * Address migration record
 */
export interface AddressMigration {
	userId: string;
	oldAddress?: string;
	newAddress: string;
	migrationType: 'generation' | 'wallet_connection' | 'wallet_change';

	// Migration details
	rewardsTransferred: bigint;
	reputationTransferred: boolean;
	historyMigrated: boolean;

	// Status
	status: 'pending' | 'in_progress' | 'completed' | 'failed';
	error?: string;

	// Timestamps
	initiatedAt: Date;
	completedAt?: Date;
}

/**
 * Blockchain connection state
 */
export interface BlockchainConnectionState {
	connected: boolean;
	chainId?: number;
	chainName?: string;

	// Contract addresses
	contracts?: {
		voterToken: string;
		voterRegistry: string;
		communiqueCore: string;
		challengeMarket: string;
		stakedVoter: string;
		identityRegistry: string;
		reputationRegistry: string;
	};

	// Network state
	blockNumber?: number;
	gasPrice?: bigint;

	// User state
	userAddress?: string;
	userConnected: boolean;
	walletType?: 'metamask' | 'walletconnect' | 'coinbase' | 'derived';
}

/**
 * Transaction status for tracking
 */
export interface TransactionStatus {
	hash: string;
	status: 'pending' | 'confirmed' | 'failed';
	confirmations: number;

	// Transaction details
	from: string;
	to: string;
	value?: bigint;
	gasUsed?: bigint;

	// Error handling
	error?: string;
	retryCount: number;
	maxRetries: number;

	// Timestamps
	submittedAt: Date;
	confirmedAt?: Date;
}

/**
 * Utility type for amounts that can be virtual or on-chain
 */
export type TokenAmount = {
	virtual: bigint; // Off-chain tracked
	onChain: bigint; // Actual blockchain balance
	total: bigint; // Combined total
};

/**
 * Helper to convert reputation score to tier
 */
export function getReputationTier(score: number): ReputationTier {
	if (score >= 80) return ReputationTier.TRUSTED;
	if (score >= 60) return ReputationTier.ESTABLISHED;
	if (score >= 40) return ReputationTier.EMERGING;
	if (score >= 20) return ReputationTier.NOVICE;
	return ReputationTier.UNTRUSTED;
}

/**
 * Helper to check if address is derived or connected
 */
export function isConnectedWallet(addressType: string): boolean {
	return addressType === 'connected' || addressType === 'certified';
}

/**
 * Helper to format token amounts for display
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
	const divisor = BigInt(10 ** decimals);
	const whole = amount / divisor;
	const fraction = amount % divisor;

	if (fraction === BigInt(0)) {
		return whole.toString();
	}

	// Format with 2 decimal places
	const fractionStr = fraction.toString().padStart(decimals, '0');
	return `${whole}.${fractionStr.slice(0, 2)}`;
}
