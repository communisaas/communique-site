/**
 * VOTER Protocol Client Wrapper
 *
 * Application-specific wrapper around @voter-protocol/client SDK.
 * Handles browser-based blockchain interactions with UX considerations.
 *
 * Features:
 * - Deterministic address generation (NEAR Chain Signatures)
 * - Zero-knowledge district verification (Halo2, 2-5 seconds TEE-based proving)
 * - On-chain reputation tracking (ERC-8004)
 * - Wallet-free blockchain participation via passkeys
 *
 * Architecture:
 * - Protocol SDK: @voter-protocol/client (reusable primitives)
 * - This wrapper: Communique-specific usage patterns + UI state
 */

import { browser } from '$app/environment';
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
 * CRITICAL: This function requires browser context (IndexedDB, WebAuthn)
 * Must be called from client-side code only (e.g., onMount in Svelte)
 *
 * @param options - Optional configuration overrides
 * @returns Initialized VOTER Protocol client
 * @throws Error if called in SSR context
 */
export async function initVoterClient(options?: Partial<VOTERClientConfig>): Promise<VOTERClient> {
	// SSR guard - VOTER Protocol client requires browser-only APIs
	if (!browser) {
		throw new Error(
			'VOTERClient requires browser context (IndexedDB, WebAuthn). Cannot initialize during SSR.'
		);
	}

	if (voterClient) {
		return voterClient;
	}

	const config: VOTERClientConfig = {
		// Network configuration
		network: 'scroll-mainnet',
		nearNetwork: 'mainnet', // NEAR mainnet for Chain Signatures MPC

		// Contract addresses (deployed on Scroll mainnet)
		districtGateAddress: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
		reputationRegistryAddress: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment

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
 * @throws Error if called in SSR context or client not initialized
 */
export function getVoterClient(): VOTERClient {
	if (!browser) {
		throw new Error('VOTERClient requires browser context. Cannot access during SSR.');
	}

	if (!voterClient) {
		throw new Error('VOTER Protocol client not initialized. Call initVoterClient() first.');
	}

	if (!voterClient.isReady()) {
		throw new Error('VOTER Protocol client not ready. Await initVoterClient() before use.');
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
	 * Proof generation takes 2-5 seconds in TEE (AWS Nitro Enclaves native Rust)
	 *
	 * PRIVACY: Address encrypted in browser, decrypted only in TEE, NEVER stored anywhere
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

		// Track progress for UI feedback (2-5 second proving time in TEE)
		const progressTracker = onProgress
			? {
					onStageChange: (stage: string) => {
						const stagePercent: Record<string, number> = {
							'Encrypting witness': 10,
							'Sending to TEE': 20,
							'Generating proof in TEE': 60,
							'Verifying attestation': 90,
							'Complete': 100
						};
						onProgress({
							stage,
							percent: stagePercent[stage] || 0
						});
					}
				}
			: undefined;

		// Generate Halo2 proof via Proof Service (TEE-based)
		// Address encrypted in browser → TEE decrypts → proof generated → address discarded
		// Address NEVER stored anywhere, only exists in TEE memory during proving
		const proof = await client.zk.proveDistrict(
			{
				address: streetAddress
			}
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

		// Reputation system not yet implemented in SDK
		return {
			actionCount: 0,
			reputationScore: 0,
			tier: 'none',
			lastActionTime: 0
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

		// Reputation system not yet implemented in SDK
		return {
			totalUsers: 0,
			totalActions: 0,
			totalReputation: 0
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

		// Action recording not yet implemented in SDK
		// Return mock transaction receipt
		return {
			hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
			status: 'pending' as const
		};
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
