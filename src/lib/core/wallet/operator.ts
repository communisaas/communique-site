/**
 * OperatorWallet — server-side admin key for system-only contract calls.
 *
 * This is the ONLY wallet provider that runs server-side. It wraps the
 * SCROLL_PRIVATE_KEY env var and is used exclusively for operations that
 * no user should trigger:
 *
 *   - submitAIEvaluation()    — AI model scoring
 *   - resolveDebateWithAI()   — resolution with evaluation data
 *   - executeEpoch()          — LMSR epoch transitions
 *   - escalateToGovernance()  — governance actions
 *   - submitGovernanceResolution() / finalizeAppeal()
 *   - proposeDebate()         — debate creation (operator bonds tokens)
 *   - resolveDebate()         — community resolution trigger
 *
 * User-facing operations (argue, co-sign, trade, claim) are signed by the
 * user's own wallet (EVM or NEAR-derived) and submitted client-side.
 *
 * SERVER-ONLY: Imports $env/dynamic/private. Cannot be imported in client code.
 *
 * @see types.ts § WalletProvider — interface this implements
 * @see debate-market-client.ts — legacy all-in-one relayer (being decomposed)
 */

import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import {
	JsonRpcProvider,
	Wallet,
	NonceManager,
	Contract,
	type TransactionReceipt
} from 'ethers';
import type {
	WalletProvider,
	WalletProviderType,
	EIP712Domain,
	EIP712TypeField,
	TxResult
} from './types';
import {
	isCircuitOpen,
	recordRpcFailure,
	recordRpcSuccess,
	getCircuitBreakerState
} from '../blockchain/district-gate-client';

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR WALLET IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Server-side operator wallet for system contract calls.
 *
 * Singleton per process — reuses the same provider/wallet/nonce manager.
 * Shares the circuit breaker with district-gate-client (same RPC endpoint).
 */
export class OperatorWallet implements WalletProvider {
	readonly providerType: WalletProviderType = 'operator';

	private _wallet: Wallet | null = null;
	private _nonceManager: NonceManager | null = null;
	private _provider: JsonRpcProvider | null = null;

	get address(): string {
		const wallet = this.getWallet();
		if (!wallet) throw new Error('OperatorWallet not configured (missing SCROLL_PRIVATE_KEY)');
		return wallet.address;
	}

	async signTypedData(
		domain: EIP712Domain,
		types: Record<string, EIP712TypeField[]>,
		value: Record<string, unknown>
	): Promise<string> {
		const wallet = this.getWallet();
		if (!wallet) throw new Error('OperatorWallet not configured');
		return wallet.signTypedData(
			{
				name: domain.name,
				version: domain.version,
				chainId: domain.chainId,
				verifyingContract: domain.verifyingContract
			},
			types,
			value
		);
	}

	async signMessage(message: string | Uint8Array): Promise<string> {
		const wallet = this.getWallet();
		if (!wallet) throw new Error('OperatorWallet not configured');
		return wallet.signMessage(message);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// SYSTEM OPERATION HELPERS
	// ═══════════════════════════════════════════════════════════════════════

	/** Check if the operator is configured (env vars present). */
	get isConfigured(): boolean {
		return !!(env.SCROLL_PRIVATE_KEY && this.getRpcUrl() && env.DEBATE_MARKET_ADDRESS);
	}

	/** Get the RPC URL for Scroll. */
	getRpcUrl(): string {
		return env.SCROLL_RPC_URL || publicEnv.PUBLIC_SCROLL_RPC_URL || 'https://sepolia-rpc.scroll.io';
	}

	/** Get the ethers provider instance. */
	getProvider(): JsonRpcProvider {
		if (!this._provider) {
			this._provider = new JsonRpcProvider(this.getRpcUrl());
		}
		return this._provider;
	}

	/** Get the ethers Wallet instance (with NonceManager). Returns null if not configured. */
	getWallet(): Wallet | null {
		if (!env.SCROLL_PRIVATE_KEY) return null;

		if (!this._wallet) {
			this._provider = new JsonRpcProvider(this.getRpcUrl());
			this._wallet = new Wallet(env.SCROLL_PRIVATE_KEY, this._provider);
			this._nonceManager = new NonceManager(this._wallet);
		}
		return this._wallet;
	}

	/** Get the NonceManager for automatic nonce tracking. */
	getNonceManager(): NonceManager | null {
		this.getWallet(); // ensure initialized
		return this._nonceManager;
	}

	/**
	 * Create an ethers Contract instance connected to the NonceManager.
	 * For system operations that need to submit transactions.
	 */
	getContract(address: string, abi: string[]): Contract | null {
		const nm = this.getNonceManager();
		if (!nm) return null;
		return new Contract(address, abi, nm);
	}

	/**
	 * Submit a transaction with circuit breaker and error classification.
	 *
	 * Wraps the common pattern: preflight check → submit → wait → classify error.
	 * Used by all system operations.
	 */
	async submitTx(
		label: string,
		txFn: () => Promise<{ wait: () => Promise<TransactionReceipt> }>
	): Promise<TxResult> {
		if (isCircuitOpen()) {
			return {
				success: false,
				error: 'Circuit breaker OPEN: RPC failures exceeded threshold. Retry after cooldown.'
			};
		}

		if (!this.isConfigured) {
			return { success: false, error: 'Blockchain not configured (operator wallet missing env vars)' };
		}

		try {
			const tx = await txFn();
			const receipt = await tx.wait();
			recordRpcSuccess();

			console.debug(`[OperatorWallet] ${label} confirmed:`, {
				txHash: receipt.hash,
				gasUsed: receipt.gasUsed.toString()
			});

			return { success: true, txHash: receipt.hash };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);

			if (classifyAsRpcError(msg)) {
				recordRpcFailure();
				console.warn(`[OperatorWallet] RPC error in ${label}:`, msg);
			}

			const revertReason = extractRevertReason(msg);
			console.error(`[OperatorWallet] ${label} failed:`, { error: revertReason });

			return { success: false, error: `Transaction failed: ${revertReason}` };
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// HEALTH & MONITORING
	// ═══════════════════════════════════════════════════════════════════════

	/** Balance monitoring thresholds. */
	static readonly BALANCE_WARNING = 50000000000000000n;  // 0.05 ETH
	static readonly BALANCE_CRITICAL = 10000000000000000n; // 0.01 ETH

	/**
	 * Get operator health for admin monitoring.
	 * Does not expose exact balance or full address.
	 */
	async getHealth(): Promise<OperatorHealth> {
		const wallet = this.getWallet();
		if (!wallet) {
			return {
				configured: false,
				address: null,
				balanceStatus: 'unknown',
				circuitBreakerState: getCircuitBreakerState(),
			};
		}

		const addr = wallet.address;
		const truncated = `${addr.slice(0, 6)}...${addr.slice(-4)}`;

		let balanceStatus: OperatorHealth['balanceStatus'] = 'unknown';
		try {
			const balance = await wallet.provider!.getBalance(wallet.address);
			if (balance < OperatorWallet.BALANCE_CRITICAL) {
				balanceStatus = 'critical';
			} else if (balance < OperatorWallet.BALANCE_WARNING) {
				balanceStatus = 'low';
			} else {
				balanceStatus = 'healthy';
			}
		} catch {
			balanceStatus = 'unknown';
		}

		return {
			configured: true,
			address: truncated,
			balanceStatus,
			circuitBreakerState: getCircuitBreakerState(),
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface OperatorHealth {
	configured: boolean;
	address: string | null;
	balanceStatus: 'healthy' | 'low' | 'critical' | 'unknown';
	circuitBreakerState: 'closed' | 'open' | 'half_open';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Classify error as RPC-level (circuit breaker) vs. contract revert. */
function classifyAsRpcError(msg: string): boolean {
	const lower = msg.toLowerCase();
	const patterns = [
		'network', 'timeout', 'econnrefused', 'etimedout', 'enotfound',
		'econnreset', 'could not detect network', 'socket hang up',
		'429', 'too many requests', '503', 'service unavailable',
		'502', 'bad gateway', '504', 'gateway timeout',
		'insufficient funds for gas', 'nonce too low'
	];
	return patterns.some((p) => lower.includes(p));
}

/** Extract revert reason from ethers error. */
function extractRevertReason(msg: string): string {
	const match = msg.match(/reason="([^"]+)"/);
	return match ? match[1] : msg;
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

/** Singleton operator wallet instance. */
let _operatorWallet: OperatorWallet | null = null;

/**
 * Get the singleton OperatorWallet instance.
 *
 * NOTE: On Cloudflare Workers, module-level singletons persist across requests
 * within the same isolate. This is safe because the operator wallet is stateless
 * (env vars are read fresh each time, ethers provider handles connections).
 * The NonceManager tracks nonces in-memory which is correct for single-isolate
 * environments. For multi-isolate deployments, nonce conflicts are resolved by
 * the blockchain (nonce too low → retry).
 */
export function getOperatorWallet(): OperatorWallet {
	if (!_operatorWallet) {
		_operatorWallet = new OperatorWallet();
	}
	return _operatorWallet;
}
