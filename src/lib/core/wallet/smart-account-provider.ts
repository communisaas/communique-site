/**
 * SmartAccountProvider — EIP-7702 delegation wrapper for EOA wallets.
 *
 * Wraps an existing EVMWalletProvider to add EIP-7702 delegation capability.
 * With 7702, the EOA delegates to a smart contract implementation, enabling
 * future gas sponsorship (paymaster) while keeping the same msg.sender.
 *
 * KEY PROPERTY: msg.sender stays the original EOA address. This means:
 *   - DistrictGate and DebateMarket contracts need ZERO modifications
 *   - ECDSA.recover still works, existing proofs still verify
 *   - debate-client.ts works without modification
 *
 * BROWSER ONLY: No $env imports, no server-only dependencies.
 * Feature-flagged via PUBLIC_ENABLE_SMART_ACCOUNTS (default: off).
 *
 * Scroll EIP-7702 support: Euclid upgrade (March 2025 Sepolia, April 2025 Mainnet).
 * Delegation via raw EIP-1193 eth_sendTransaction (type 4 tx with authorizationList).
 * MetaMask handles 7702 authorization natively — no ethers or viem 7702 API needed.
 *
 * @see evm-provider.ts — EVMWalletProvider (wrapped by this provider)
 * @see types.ts — WalletProvider interface
 * @see debate-client.ts — consumer (transparent — msg.sender unchanged)
 */

import { BrowserProvider } from 'ethers';
import type { Eip1193Provider } from './evm-provider';
import { EVMWalletProvider, WalletConnectionError } from './evm-provider';
import type {
	WalletProvider,
	WalletProviderType,
	EIP712Domain,
	EIP712TypeField
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SimpleAccount factory on Scroll Sepolia (Pimlico deployment).
 * Used as the delegation target for EIP-7702 authorization.
 */
export const SIMPLE_ACCOUNT_ADDRESS = '0x9406Cc6185a346906296840746125a0E44976454';

/** Scroll Sepolia chain ID for 7702 authorization. */
const SCROLL_SEPOLIA_CHAIN_ID = BigInt(534351);

// ═══════════════════════════════════════════════════════════════════════════
// SMART ACCOUNT PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-7702 smart account provider.
 *
 * Composition over inheritance: wraps an EVMWalletProvider and adds
 * 7702 delegation. All signing operations pass through to the inner
 * provider since msg.sender stays the EOA.
 *
 * Delegation lifecycle:
 *   1. User connects wallet -> EVMWalletProvider created
 *   2. SmartAccountProvider wraps it
 *   3. Call delegate() to authorize the EOA to the SimpleAccount contract
 *   4. isDelegated() checks if delegation is active
 *   5. All signing/tx operations are transparent (same EOA, same msg.sender)
 */
export class SmartAccountProvider implements WalletProvider {
	readonly address: string;
	readonly providerType: WalletProviderType = 'smart-account';

	private readonly _inner: EVMWalletProvider;
	private _delegated: boolean = false;

	/**
	 * @param inner — The underlying EVMWalletProvider to wrap
	 */
	constructor(inner: EVMWalletProvider) {
		this._inner = inner;
		this.address = inner.address;
	}

	/**
	 * Sign EIP-712 typed data — passes through to the inner EVMWalletProvider.
	 *
	 * 7702 delegation does not change the signing key or msg.sender,
	 * so EIP-712 signing is identical to the unwrapped provider.
	 */
	async signTypedData(
		domain: EIP712Domain,
		types: Record<string, EIP712TypeField[]>,
		value: Record<string, unknown>
	): Promise<string> {
		return this._inner.signTypedData(domain, types, value);
	}

	/**
	 * Sign a raw message — passes through to the inner EVMWalletProvider.
	 */
	async signMessage(message: string | Uint8Array): Promise<string> {
		return this._inner.signMessage(message);
	}

	/**
	 * Authorize the EOA to delegate to the SimpleAccount contract via EIP-7702.
	 *
	 * Sends a type 4 transaction with an authorization list that delegates
	 * the EOA's code to the SimpleAccount implementation. This enables
	 * future paymaster/gas sponsorship without changing msg.sender.
	 *
	 * @param delegateAddress — Contract to delegate to (default: SIMPLE_ACCOUNT_ADDRESS)
	 * @throws WalletConnectionError if the wallet rejects or the tx fails
	 */
	async delegate(delegateAddress: string = SIMPLE_ACCOUNT_ADDRESS): Promise<{ txHash: string }> {
		try {
			// Use raw EIP-1193 eth_sendTransaction with type 4 (EIP-7702).
			// MetaMask handles 7702 authorization natively — the wallet builds
			// the authorization tuple and prompts the user for delegation approval.
			// This avoids depending on ethers/viem 7702 APIs which are unstable.
			const provider = this._inner.eip1193Provider;

			// Read actual account nonce (not hardcoded 0 — fails for any EOA that has sent a tx)
			const nonceHex = await provider.request({
				method: 'eth_getTransactionCount',
				params: [this.address, 'latest']
			}) as string;

			// Build EIP-7702 authorization tuple
			const authorization = {
				chainId: '0x' + SCROLL_SEPOLIA_CHAIN_ID.toString(16),
				address: delegateAddress,
				nonce: nonceHex
			};

			// Send type 4 transaction via EIP-1193 — wallet handles signing + authorization
			const txHash = await provider.request({
				method: 'eth_sendTransaction',
				params: [{
					from: this.address,
					to: this.address,
					value: '0x0',
					type: '0x04',
					authorizationList: [authorization]
				}]
			}) as string;

			// Wait for receipt
			const ethersProvider = this._inner.ethersProvider;
			const receipt = await ethersProvider.waitForTransaction(txHash);
			this._delegated = true;

			return { txHash: receipt?.hash ?? txHash };
		} catch (err) {
			if (err instanceof WalletConnectionError) throw err;

			const code = err && typeof err === 'object' && 'code' in err
				? (err as { code: number }).code
				: undefined;
			const message = err instanceof Error ? err.message : String(err);

			throw new WalletConnectionError(
				`EIP-7702 delegation failed: ${message}`,
				code,
				err
			);
		}
	}

	/**
	 * Check if the EOA has an active 7702 delegation.
	 *
	 * Queries the EOA's code via eth_getCode. If the code matches the
	 * EIP-7702 delegation prefix (0xef0100), delegation is active.
	 */
	async isDelegated(): Promise<boolean> {
		try {
			const code = await this._inner.ethersProvider.getCode(this.address);
			// EIP-7702 delegation prefix: 0xef0100 + 20-byte delegate address
			const delegated = code.length > 2 && code.startsWith('0xef0100');
			this._delegated = delegated;
			return delegated;
		} catch {
			return false;
		}
	}

	/** Whether delegation has been confirmed (cached from delegate() or isDelegated()). */
	get delegated(): boolean {
		return this._delegated;
	}

	/** Access the underlying ethers BrowserProvider (same as inner — 7702 is transparent). */
	get ethersProvider(): BrowserProvider {
		return this._inner.ethersProvider;
	}

	/** Access the underlying EIP-1193 provider. */
	get eip1193Provider(): Eip1193Provider {
		return this._inner.eip1193Provider;
	}

	/** Access the wrapped EVMWalletProvider. */
	get innerProvider(): EVMWalletProvider {
		return this._inner;
	}

	/** Get the current chain ID from the provider. */
	async getChainId(): Promise<number> {
		return this._inner.getChainId();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a SmartAccountProvider from an existing EVMWalletProvider.
 *
 * Checks the PUBLIC_ENABLE_SMART_ACCOUNTS feature flag. If disabled,
 * returns null (caller should fall back to the plain EVMWalletProvider).
 *
 * @param inner — Connected EVMWalletProvider
 * @param featureEnabled — Whether smart accounts are enabled (from PUBLIC_ENABLE_SMART_ACCOUNTS)
 * @returns SmartAccountProvider or null if feature is disabled
 */
export function createSmartAccountProvider(
	inner: EVMWalletProvider,
	featureEnabled: boolean
): SmartAccountProvider | null {
	if (!featureEnabled) return null;
	return new SmartAccountProvider(inner);
}
