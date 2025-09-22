/**
 * Direct VOTER Protocol Blockchain Client
 *
 * Handles direct smart contract interactions with VOTER Protocol
 * Eliminates API proxy layers for better performance and reliability
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
	private signer: ethers.Wallet | null = null;
	private communiqueCore: ethers.Contract | null = null;
	private voterToken: ethers.Contract | null = null;
	private _voterRegistry: ethers.Contract | null = null;

	constructor() {
		// Initialize provider
		const rpcUrl = env.RPC_URL || 'http://localhost:8545';
		this.provider = new ethers.JsonRpcProvider(rpcUrl);

		// Initialize signer if private key is provided
		if (env.CERTIFIER_PRIVATE_KEY) {
			this.signer = new ethers.Wallet(env.CERTIFIER_PRIVATE_KEY, this.provider);
		}

		// Initialize contracts if addresses are provided
		if (env.COMMUNIQUE_CORE_ADDRESS && this.signer) {
			this.communiqueCore = new ethers.Contract(
				env.COMMUNIQUE_CORE_ADDRESS,
				COMMUNIQUE_CORE_ABI,
				this.signer
			);
		}

		if (env.VOTER_TOKEN_ADDRESS) {
			this.voterToken = new ethers.Contract(
				env.VOTER_TOKEN_ADDRESS,
				VOTER_TOKEN_ABI,
				this.provider
			);
		}

		if (env.VOTER_REGISTRY_ADDRESS) {
			this._voterRegistry = new ethers.Contract(
				env.VOTER_REGISTRY_ADDRESS,
				_VOTER_REGISTRY_ABI,
				this.provider
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
	 * Certify a civic action directly on blockchain
	 */
	async certifyAction(action: VOTERAction): Promise<VOTERActionResult> {
		try {
			if (!this.communiqueCore) {
				throw new Error('CommuniqueCore contract not initialized');
			}

			const actionType = this.getActionTypeEnum(action.actionType);
			const actionHash = this.generateActionHash(action);

			// Create metadata URI (could be IPFS in production)
			const metadata = {
				templateId: action.templateId,
				deliveryConfirmation: action.deliveryConfirmation,
				personalConnection: action.personalConnection,
				timestamp: Date.now()
			};
			const metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

			// Execute blockchain transaction
			const tx = await this.communiqueCore.processCivicAction(
				action.userAddress,
				actionType,
				actionHash,
				metadataUri,
				0 // No reward override
			);

			const receipt = await tx.wait();

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				gasUsed: receipt.gasUsed.toString(),
				gasPrice: receipt.gasPrice?.toString(),
				effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
				actionHash: actionHash,
				receipt: receipt as TransactionReceipt
			};
		} catch (_error) {
			console.error('Error occurred', _error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Unknown error',
				code:
					_error instanceof Error && 'code' in _error
						? String((_error as ErrorWithCode).code)
						: undefined,
				details: {
					reason:
						_error instanceof Error && 'reason' in _error
							? (_error as ErrorWithCode).reason
							: undefined,
					method: 'processCivicAction',
					transaction:
						_error instanceof Error && 'transaction' in _error
							? ((_error as ErrorWithCode).transaction as UnknownRecord)
							: undefined
				}
			};
		}
	}

	/**
	 * Register a new user on blockchain
	 */
	async registerUser(
		userAddress: string,
		phoneHash: string,
		selfProof: string
	): Promise<VOTERActionResult> {
		try {
			if (!this.communiqueCore) {
				throw new Error('CommuniqueCore contract not initialized');
			}

			const tx = await this.communiqueCore.registerUser(userAddress, phoneHash, selfProof);

			const receipt = await tx.wait();

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				gasUsed: receipt.gasUsed.toString(),
				gasPrice: receipt.gasPrice?.toString(),
				effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
				receipt: receipt as TransactionReceipt
			};
		} catch (_error) {
			console.error('Error occurred', _error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Unknown error',
				code:
					_error instanceof Error && 'code' in _error
						? String((_error as ErrorWithCode).code)
						: undefined,
				details: {
					reason:
						_error instanceof Error && 'reason' in _error
							? (_error as ErrorWithCode).reason
							: undefined,
					method: 'registerUser',
					transaction:
						_error instanceof Error && 'transaction' in _error
							? ((_error as ErrorWithCode).transaction as UnknownRecord)
							: undefined
				}
			};
		}
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
		} catch (_error) {
			console.error('Error occurred', _error);
			return null;
		}
	}

	/**
	 * Check if blockchain client is properly configured
	 */
	isConfigured(): boolean {
		return !!(this.communiqueCore && this.voterToken && this.signer);
	}

	/**
	 * Get configuration status
	 */
	getStatus() {
		return {
			configured: this.isConfigured(),
			contracts: {
				communiqueCore: env.COMMUNIQUE_CORE_ADDRESS || 'not set',
				voterToken: env.VOTER_TOKEN_ADDRESS || 'not set',
				voterRegistry: env.VOTER_REGISTRY_ADDRESS || 'not set'
			},
			network: {
				rpcUrl: env.RPC_URL || 'not set',
				hasPrivateKey: !!env.CERTIFIER_PRIVATE_KEY
			}
		};
	}
}

// Export singleton instance
export const voterBlockchainClient = new VOTERBlockchainClient();

// Export function for delivery service compatibility
export async function certifyEmailDelivery(certificationData: {
	userAddress: string;
	templateId: string;
	actionType: string;
	deliveryConfirmation: string;
}): Promise<VOTERActionResult> {
	return await voterBlockchainClient.certifyAction({
		actionType: certificationData.actionType as VOTERAction['actionType'],
		userAddress: certificationData.userAddress,
		templateId: certificationData.templateId,
		deliveryConfirmation: certificationData.deliveryConfirmation
	});
}
