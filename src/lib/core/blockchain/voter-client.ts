/**
 * VOTER Protocol Client Wrapper
 *
 * Application-specific wrapper around @voter-protocol/client SDK.
 * Handles browser-based blockchain interactions with UX considerations.
 *
 * Features:
 * - Deterministic address generation (NEAR Chain Signatures)
 * - Zero-knowledge district verification (Halo2, 4-6 seconds)
 * - On-chain reputation tracking (ERC-8004)
 * - Wallet-free blockchain participation via passkeys
 *
 * Architecture:
 * - Protocol SDK: @voter-protocol/client (reusable primitives)
 * - This wrapper: Communique-specific usage patterns + UI state
 */

import { VOTERClient, type VOTERClientConfig } from '@voter-protocol/client';
import { PUBLIC_SCROLL_RPC_URL } from '$env/static/public';

/**
 * Singleton instance of VOTER Protocol client
 * Initialized once per browser session
 */
let voterClient: VOTERClient | null = null;

/**
 * Initialize VOTER Protocol client with Communique-specific configuration
 *
 * @param options - Optional configuration overrides
 * @returns Initialized VOTER Protocol client
 */
export async function initVoterClient(options?: Partial<VOTERClientConfig>): Promise<VOTERClient> {
	if (voterClient) {
		return voterClient;
	}

	const config: VOTERClientConfig = {
		// Network configuration
		nearNetwork: 'mainnet', // NEAR mainnet for Chain Signatures MPC
		scrollRpcUrl: PUBLIC_SCROLL_RPC_URL || 'https://rpc.scroll.io',

		// Contract addresses (deployed on Scroll mainnet)
		districtGateAddress: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
		reputationRegistryAddress: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment

		// Zero-knowledge proof configuration
		enableZKProofs: true, // Enable Halo2 district verification
		shadowAtlasUrl: 'https://ipfs.io/ipfs/QmShadowAtlasDistrictMerkleTree', // TODO: Update with real IPFS hash

		// Development/testing overrides
		...options
	};

	voterClient = new VOTERClient(config);

	// Wait for client initialization (ZK circuits, Shadow Atlas, etc.)
	// This can take 1-2 seconds on first load
	await voterClient.ready();

	return voterClient;
}

/**
 * Get existing VOTER Protocol client instance
 * Throws if client hasn't been initialized yet
 *
 * @returns Active VOTER Protocol client
 */
export function getVoterClient(): VOTERClient {
	if (!voterClient) {
		throw new Error(
			'VOTER Protocol client not initialized. Call initVoterClient() first.'
		);
	}

	if (!voterClient.isReady()) {
		throw new Error(
			'VOTER Protocol client not ready. Await initVoterClient() before use.'
		);
	}

	return voterClient;
}

/**
 * Blockchain client wrapper with Communique-specific helpers
 * Wraps @voter-protocol/client with application-level conveniences
 */
export const voterBlockchainClient = {
	/**
	 * Create NEAR implicit account and derive Scroll address
	 * Uses Face ID/Touch ID for passkey-based account creation
	 *
	 * @param method - 'passkey' (recommended) or 'seed' (advanced)
	 * @returns Account details with NEAR account ID and derived addresses
	 */
	async createAccount(method: 'passkey' | 'seed' = 'passkey') {
		const client = await initVoterClient();

		// Create NEAR implicit account via passkey
		// This generates deterministic addresses on Scroll/Ethereum
		const account = await client.account.create({ method });

		return {
			nearAccountId: account.nearAccount,
			scrollAddress: account.scrollAddress,
			ethereumAddress: account.ethAddress
		};
	},

	/**
	 * Get current user's blockchain account state
	 *
	 * @returns Account state (may be null if not yet created)
	 */
	getCurrentAccount() {
		const client = getVoterClient();
		return client.account.getState();
	},

	/**
	 * Generate zero-knowledge proof of congressional district membership
	 * Proof generation takes 4-6 seconds in browser (Halo2 WASM)
	 *
	 * PRIVACY: Address NEVER leaves browser, NEVER stored anywhere
	 *
	 * @param streetAddress - User's full street address
	 * @param district - Congressional district (e.g., "CA-12")
	 * @param onProgress - Optional progress callback for UI updates
	 * @returns Zero-knowledge proof (256 bytes)
	 */
	async generateDistrictProof(
		streetAddress: string,
		district: string,
		onProgress?: (progress: { stage: string; percent: number }) => void
	) {
		const client = await initVoterClient();

		// Track progress for UI feedback (4-6 second proving time)
		const progressTracker = onProgress
			? {
					onStageChange: (stage: string) => {
						const stagePercent: Record<string, number> = {
							'Loading circuit': 10,
							'Generating witness': 30,
							'Computing proof': 60,
							'Finalizing': 90,
							'Complete': 100
						};
						onProgress({
							stage,
							percent: stagePercent[stage] || 0
						});
					}
				}
			: undefined;

		// Generate Halo2 proof client-side
		// Address NEVER leaves browser, NEVER touches any database
		const proof = await client.zk.generateDistrictProof(
			{
				streetAddress,
				district
			},
			progressTracker
		);

		return proof;
	},

	/**
	 * Get user's on-chain reputation score
	 * Queries Scroll L2 ReputationRegistry contract
	 *
	 * @param scrollAddress - User's Scroll address
	 * @returns Reputation score and tier
	 */
	async getUserStats(scrollAddress: string) {
		const client = await initVoterClient();

		const stats = await client.reputation.getScore(scrollAddress);

		return {
			actionCount: stats.actionCount,
			reputationScore: stats.totalScore,
			tier: stats.tier,
			lastActionTime: stats.lastActionTimestamp
		};
	},

	/**
	 * Get platform-wide statistics
	 * Aggregated data from ReputationRegistry contract
	 *
	 * @returns Platform metrics
	 */
	async getPlatformStats() {
		const client = await initVoterClient();

		const stats = await client.reputation.getPlatformStats();

		return {
			totalUsers: stats.totalUsers,
			totalActions: stats.totalActions,
			totalReputation: stats.totalReputation
		};
	},

	/**
	 * Submit action to blockchain for reputation tracking
	 * Records civic action on-chain (Phase 1: reputation only, no token rewards)
	 *
	 * @param params - Action submission parameters
	 * @returns Transaction receipt
	 */
	async recordAction(params: {
		actionType: 'CWC_MESSAGE' | 'TEMPLATE_CREATION' | 'DISTRICT_VERIFICATION';
		proof?: Uint8Array; // ZK proof for district verification
		metadata?: Record<string, unknown>; // Optional action metadata
	}) {
		const client = await initVoterClient();

		// Record action on-chain via DistrictGate contract
		const tx = await client.contracts.districtGate.recordAction({
			actionType: params.actionType,
			proof: params.proof,
			metadata: params.metadata ? JSON.stringify(params.metadata) : undefined
		});

		return tx;
	},

	/**
	 * Check if user has verified their congressional district
	 *
	 * @param scrollAddress - User's Scroll address
	 * @returns Verification status
	 */
	async isDistrictVerified(scrollAddress: string): Promise<boolean> {
		const client = await initVoterClient();

		const verified = await client.contracts.districtGate.isVerified(scrollAddress);

		return verified;
	}
};
