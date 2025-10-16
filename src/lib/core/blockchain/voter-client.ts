/**
 * VOTER Protocol Blockchain Client - READ-ONLY
 *
 * STATUS: REFACTORED FOR CLIENT-SIDE SIGNING
 *
 * ⚠️ SECURITY: This client is READ-ONLY. All transaction signing happens CLIENT-SIDE.
 * NO PRIVATE KEYS ARE STORED OR USED SERVER-SIDE.
 *
 * Architecture (VOTER Protocol Specification):
 * - NEAR Protocol: Passkey-based accounts (WebAuthn/FIDO2), Chain Signatures
 * - Scroll zkEVM: Settlement layer ($0.135/action), EVM smart contracts
 * - Client-side signing: User signs with Touch ID/Face ID
 * - Server role: Query blockchain state, prepare unsigned transactions, listen for confirmations
 *
 * For complete architecture:
 * - voter-protocol/ARCHITECTURE.md (3400+ lines)
 * - docs/integrations.md (Communique integration notes)
 *
 * Current functionality:
 * - Query user stats and balances (READ-ONLY)
 * - Query platform metrics (READ-ONLY)
 * - Prepare unsigned transaction data for client signing
 * - Validate transaction structure before client submission
 *
 * Client-side signing implemented in:
 * - src/lib/core/blockchain/client-signing.ts (passkey wallet)
 * - src/lib/components/blockchain/TransactionSigning.svelte (signing UI)
 */

import { ethers } from 'ethers';
import { env } from '$env/dynamic/private';
import type { ErrorWithCode, UnknownRecord } from '$lib/types/any-replacements.js';

// Smart contract ABIs (only the functions we use)
const COMMUNIQUE_CORE_ABI = [
	'function registerUser(address user, bytes32 phoneHash, bytes memory selfProof) external',
	'function processCivicAction(address participant, uint8 actionType, bytes32 actionHash, string memory metadataUri, uint256 rewardOverride) external',
	'function getUserStats(address user) view returns (uint256 actionCount, uint256 civicEarned, uint256 lastActionTime)',
	'function getPlatformStats() view returns (uint256 totalUsers, uint256 totalActions, uint256 totalCivicMinted, uint256 avgActionsPerUser, uint256 activeUsersLast30Days)'
];

const VOTER_TOKEN_ABI = [
	'function balanceOf(address account) view returns (uint256)',
	'function totalSupply() view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)'
];

const _VOTER_REGISTRY_ABI = [
	'function getCitizenRecords(address citizen) view returns (tuple(address participant, uint8 actionType, bytes32 actionHash, string metadataUri, uint256 timestamp, uint256 rewardAmount)[])',
	'function isVerifiedCitizen(address citizen) view returns (bool)'
];

export interface VOTERAction {
	actionType: 'CWC_MESSAGE' | 'LOCAL_ACTION' | 'DIRECT_ACTION' | 'TOWN_HALL' | 'PUBLIC_COMMENT';
	userAddress: string;
	templateId?: string;
	deliveryConfirmation?: string;
	personalConnection?: string;
}

// Ethers.js transaction receipt types
export interface TransactionReceipt {
	blockHash: string;
	blockNumber: number;
	transactionHash: string;
	transactionIndex: number;
	from: string;
	to: string | null;
	gasUsed: bigint;
	gasPrice?: bigint;
	effectiveGasPrice?: bigint;
	cumulativeGasUsed: bigint;
	status: number;
	type: number;
	logs: Array<{
		address: string;
		topics: string[];
		data: string;
		blockNumber: number;
		transactionHash: string;
		transactionIndex: number;
		blockHash: string;
		logIndex: number;
	}>;
}

// Success result type for blockchain transactions
export interface VOTERActionSuccess {
	success: true;
	transactionHash: string;
	blockNumber: number;
	gasUsed: string; // BigInt as string
	gasPrice?: string; // BigInt as string
	effectiveGasPrice?: string; // BigInt as string
	actionHash?: string;
	receipt: TransactionReceipt;
}

// Error result type for blockchain transactions
export interface VOTERActionError {
	success: false;
	error: string;
	code?: string;
	details?: {
		reason?: string;
		method?: string;
		transaction?: UnknownRecord;
	};
}

// Discriminated union type for VOTER action results
export type VOTERActionResult = VOTERActionSuccess | VOTERActionError;

export interface UserStats {
	actionCount: number;
	civicEarned: string; // BigInt as string
	lastActionTime: number;
	voterTokenBalance: string;
}

class VOTERBlockchainClient {
	private provider: ethers.JsonRpcProvider;
	// 🔥 REMOVED: private signer - NO SERVER-SIDE SIGNING
	private communiqueCore: ethers.Contract | null = null;
	private voterToken: ethers.Contract | null = null;
	private _voterRegistry: ethers.Contract | null = null;

	constructor() {
		// Initialize provider (READ-ONLY)
		const rpcUrl = env.RPC_URL || 'http://localhost:8545';
		this.provider = new ethers.JsonRpcProvider(rpcUrl);

		// 🔥 REMOVED: Signer initialization - NO PRIVATE KEYS ON SERVER

		// Initialize contracts (READ-ONLY - no signer)
		if (env.COMMUNIQUE_CORE_ADDRESS) {
			this.communiqueCore = new ethers.Contract(
				env.COMMUNIQUE_CORE_ADDRESS,
				COMMUNIQUE_CORE_ABI,
				this.provider // READ-ONLY: No signer attached
			);
		}

		if (env.VOTER_TOKEN_ADDRESS) {
			this.voterToken = new ethers.Contract(
				env.VOTER_TOKEN_ADDRESS,
				VOTER_TOKEN_ABI,
				this.provider // READ-ONLY
			);
		}

		if (env.VOTER_REGISTRY_ADDRESS) {
			this._voterRegistry = new ethers.Contract(
				env.VOTER_REGISTRY_ADDRESS,
				_VOTER_REGISTRY_ABI,
				this.provider // READ-ONLY
			);
		}
	}

	/**
	 * Get action type enum value
	 */
	private getActionTypeEnum(actionType: string): number {
		const types: Record<string, number> = {
			CWC_MESSAGE: 0,
			LOCAL_ACTION: 1,
			DIRECT_ACTION: 2,
			TOWN_HALL: 3,
			PUBLIC_COMMENT: 4
		};
		return types[actionType] || 2; // Default to DIRECT_ACTION
	}

	/**
	 * Generate deterministic action hash
	 */
	private generateActionHash(action: VOTERAction): string {
		const data = ethers.solidityPacked(
			['address', 'string', 'string', 'uint256'],
			[
				action.userAddress,
				action.templateId || '',
				action.deliveryConfirmation || '',
				Math.floor(Date.now() / 1000)
			]
		);
		return ethers.keccak256(data);
	}

	/**
	 * Prepare unsigned transaction data for civic action
	 *
	 * 🔒 SECURITY: This method ONLY prepares transaction data.
	 * User must sign the transaction CLIENT-SIDE with their passkey.
	 *
	 * @returns Unsigned transaction data for client-side signing
	 */
	async prepareActionTransaction(action: VOTERAction): Promise<{
		success: true;
		unsignedTx: {
			to: string;
			data: string;
			value: string;
			gasLimit?: string;
		};
		actionHash: string;
		metadataUri: string;
	} | VOTERActionError> {
		try {
			if (!this.communiqueCore) {
				throw new Error('CommuniqueCore contract not initialized');
			}

			const actionType = this.getActionTypeEnum(action.actionType);
			const actionHash = this.generateActionHash(action);

			// Create metadata URI (will be moved to IPFS in Week 2)
			const metadata = {
				templateId: action.templateId,
				deliveryConfirmation: action.deliveryConfirmation,
				personalConnection: action.personalConnection,
				timestamp: Date.now()
			};
			const metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

			// Prepare unsigned transaction data (no signing)
			const txData = this.communiqueCore.interface.encodeFunctionData('processCivicAction', [
				action.userAddress,
				actionType,
				actionHash,
				metadataUri,
				0 // No reward override
			]);

			// Estimate gas (optional, helps client prepare tx)
			let gasLimit: string | undefined;
			try {
				const estimated = await this.provider.estimateGas({
					to: await this.communiqueCore.getAddress(),
					data: txData
				});
				gasLimit = estimated.toString();
			} catch {
				// Gas estimation failed, client will handle
				gasLimit = undefined;
			}

			return {
				success: true,
				unsignedTx: {
					to: await this.communiqueCore.getAddress(),
					data: txData,
					value: '0',
					gasLimit
				},
				actionHash,
				metadataUri
			};
		} catch (error) {
			console.error('[VOTER Client] Error preparing transaction:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to prepare transaction',
				code: error instanceof Error && 'code' in error ? (error as ErrorWithCode).code : undefined,
				details: {
					reason:
						error instanceof Error && 'reason' in error
							? (error as ErrorWithCode).reason
							: undefined,
					method: 'prepareActionTransaction'
				}
			};
		}
	}

	/**
	 * @deprecated Use prepareActionTransaction() instead
	 *
	 * This method previously executed transactions server-side (INSECURE).
	 * It now throws an error to prevent accidental use of the old API.
	 */
	async certifyAction(_action: VOTERAction): Promise<never> {
		throw new Error(
			'certifyAction() is DEPRECATED and INSECURE. ' +
			'Use prepareActionTransaction() to get unsigned tx data, ' +
			'then have the user sign it CLIENT-SIDE with their passkey. ' +
			'See src/lib/core/blockchain/client-signing.ts for implementation.'
		);
	}

	/**
	 * Prepare unsigned transaction for user registration
	 *
	 * 🔒 SECURITY: User must sign this CLIENT-SIDE with their passkey
	 */
	async prepareUserRegistration(
		userAddress: string,
		phoneHash: string,
		selfProof: string
	): Promise<{
		success: true;
		unsignedTx: {
			to: string;
			data: string;
			value: string;
			gasLimit?: string;
		};
	} | VOTERActionError> {
		try {
			if (!this.communiqueCore) {
				throw new Error('CommuniqueCore contract not initialized');
			}

			// Prepare unsigned transaction data
			const txData = this.communiqueCore.interface.encodeFunctionData('registerUser', [
				userAddress,
				phoneHash,
				selfProof
			]);

			// Estimate gas
			let gasLimit: string | undefined;
			try {
				const estimated = await this.provider.estimateGas({
					to: await this.communiqueCore.getAddress(),
					data: txData
				});
				gasLimit = estimated.toString();
			} catch {
				gasLimit = undefined;
			}

			return {
				success: true,
				unsignedTx: {
					to: await this.communiqueCore.getAddress(),
					data: txData,
					value: '0',
					gasLimit
				}
			};
		} catch (error) {
			console.error('[VOTER Client] Error preparing registration:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to prepare registration',
				code: error instanceof Error && 'code' in error ? (error as ErrorWithCode).code : undefined,
				details: {
					reason:
						error instanceof Error && 'reason' in error
							? (error as ErrorWithCode).reason
							: undefined,
					method: 'prepareUserRegistration'
				}
			};
		}
	}

	/**
	 * @deprecated Use prepareUserRegistration() instead
	 */
	async registerUser(
		_userAddress: string,
		_phoneHash: string,
		_selfProof: string
	): Promise<never> {
		throw new Error(
			'registerUser() is DEPRECATED and INSECURE. ' +
			'Use prepareUserRegistration() for client-side signing.'
		);
	}

	/**
	 * Get user statistics from blockchain
	 */
	async getUserStats(userAddress: string): Promise<UserStats | null> {
		try {
			if (!this.communiqueCore || !this.voterToken) {
				throw new Error('Contracts not initialized');
			}

			const [stats, balance] = await Promise.all([
				this.communiqueCore.getUserStats(userAddress),
				this.voterToken.balanceOf(userAddress)
			]);

			return {
				actionCount: Number(stats[0]),
				civicEarned: stats[1].toString(),
				lastActionTime: Number(stats[2]),
				voterTokenBalance: balance.toString()
			};
		} catch (error) {
			console.error('Error occurred');
			return null;
		}
	}

	/**
	 * Check if blockchain client is properly configured (READ-ONLY)
	 */
	isConfigured(): boolean {
		return !!(this.communiqueCore && this.voterToken);
	}

	/**
	 * Get configuration status
	 */
	getStatus() {
		return {
			configured: this.isConfigured(),
			readOnly: true, // Always true - no server-side signing
			contracts: {
				communiqueCore: env.COMMUNIQUE_CORE_ADDRESS || 'not set',
				voterToken: env.VOTER_TOKEN_ADDRESS || 'not set',
				voterRegistry: env.VOTER_REGISTRY_ADDRESS || 'not set'
			},
			network: {
				rpcUrl: env.RPC_URL || 'not set'
				// 🔥 REMOVED: hasPrivateKey check - NO KEYS ON SERVER
			}
		};
	}
}

// Export singleton instance
export const voterBlockchainClient = new VOTERBlockchainClient();

/**
 * @deprecated This function previously executed server-side signing (INSECURE).
 * Use voterBlockchainClient.prepareActionTransaction() for client-side signing.
 */
export async function certifyEmailDelivery(_certificationData: {
	userAddress: string;
	templateId: string;
	actionType: string;
	deliveryConfirmation: string;
}): Promise<never> {
	throw new Error(
		'certifyEmailDelivery() is DEPRECATED and INSECURE. ' +
		'Use voterBlockchainClient.prepareActionTransaction() for client-side signing.'
	);
}
