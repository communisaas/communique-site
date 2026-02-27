/**
 * EVMWalletProvider — browser-side EVM wallet for MetaMask/injected providers.
 *
 * Wraps an EIP-1193 injected provider (window.ethereum) via ethers v6 BrowserProvider.
 * Handles account connection, typed data signing (EIP-712), personal_sign (EIP-191),
 * and chain switching for Scroll Sepolia / Mainnet.
 *
 * BROWSER ONLY: No $env imports, no server-only dependencies.
 * Does NOT include WalletConnect SDK — that's a future wave.
 *
 * Usage:
 *   const provider = await connectInjectedWallet();
 *   const sig = await provider.signTypedData(domain, types, value);
 *
 * @see types.ts  WalletProvider — interface this implements
 * @see operator.ts  OperatorWallet — server-side counterpart
 * @see eip712.ts  buildProofAuthorizationData — constructs the typed data to sign
 */

import { BrowserProvider } from 'ethers';
import type {
	WalletProvider,
	WalletProviderType,
	EIP712Domain,
	EIP712TypeField
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// EIP-1193 TYPE (minimal — avoids pulling in full @metamask/providers)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal EIP-1193 provider interface.
 * MetaMask, Coinbase Wallet, and other injected wallets all expose this shape
 * on window.ethereum. We only depend on `request()` and optional brand flags.
 */
export interface Eip1193Provider {
	request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
	isMetaMask?: boolean;
	isCoinbaseWallet?: boolean;
	on?(event: string, handler: (...args: unknown[]) => void): void;
	removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const SCROLL_SEPOLIA_CHAIN_ID = 534351;
export const SCROLL_MAINNET_CHAIN_ID = 534352;

/** Config for wallet_addEthereumChain (EIP-3085). */
export const SCROLL_SEPOLIA_CONFIG = {
	chainId: '0x' + SCROLL_SEPOLIA_CHAIN_ID.toString(16), // '0x8274f'
	chainName: 'Scroll Sepolia Testnet',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18
	},
	rpcUrls: ['https://sepolia-rpc.scroll.io'],
	blockExplorerUrls: ['https://sepolia.scrollscan.com']
} as const;

export const SCROLL_MAINNET_CONFIG = {
	chainId: '0x' + SCROLL_MAINNET_CHAIN_ID.toString(16), // '0x82750'
	chainName: 'Scroll',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18
	},
	rpcUrls: ['https://rpc.scroll.io'],
	blockExplorerUrls: ['https://scrollscan.com']
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ERROR TYPE
// ═══════════════════════════════════════════════════════════════════════════

/** Well-known EIP-1193 / EIP-1474 error codes. */
export const WALLET_ERROR_CODES = {
	USER_REJECTED: 4001,
	UNAUTHORIZED: 4100,
	UNSUPPORTED_METHOD: 4200,
	DISCONNECTED: 4900,
	CHAIN_DISCONNECTED: 4901,
	CHAIN_NOT_ADDED: 4902
} as const;

/**
 * Structured error for wallet operations.
 * Preserves the provider's numeric error code so callers can branch on it
 * (e.g., show a gentler message for user-rejected vs. unexpected failure).
 */
export class WalletConnectionError extends Error {
	/** EIP-1193 error code (4001=user rejected, 4902=chain not added, etc.) */
	readonly code: number | undefined;

	/** Original error for debugging. */
	readonly cause: unknown;

	constructor(message: string, code?: number, cause?: unknown) {
		super(message);
		this.name = 'WalletConnectionError';
		this.code = code;
		this.cause = cause;
	}

	/** True if the user explicitly rejected the request in their wallet UI. */
	get isUserRejection(): boolean {
		return this.code === WALLET_ERROR_CODES.USER_REJECTED;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION STATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reactive-friendly state type for Svelte 5 $state() usage.
 *
 * Usage in a .svelte component:
 *   let walletState = $state<EVMConnectionState>({ connected: false, ... });
 *   walletState = await connectInjectedWallet().then(toConnectionState);
 */
export interface EVMConnectionState {
	connected: boolean;
	address: string | null;
	chainId: number | null;
	provider: EVMWalletProvider | null;
}

/** Default disconnected state — use as initializer for $state(). */
export const DISCONNECTED_STATE: EVMConnectionState = {
	connected: false,
	address: null,
	chainId: null,
	provider: null
};

// ═══════════════════════════════════════════════════════════════════════════
// EVM WALLET PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Browser-side EVM wallet provider.
 *
 * Wraps an EIP-1193 injected provider (MetaMask, Coinbase Wallet, etc.)
 * via ethers v6 BrowserProvider + Signer for signing operations.
 */
export class EVMWalletProvider implements WalletProvider {
	readonly address: string;
	readonly providerType: WalletProviderType;

	private readonly _ethersProvider: BrowserProvider;
	private readonly _eip1193: Eip1193Provider;

	/**
	 * @param eip1193Provider — The raw EIP-1193 provider (window.ethereum or similar)
	 * @param address — The connected account address (0x-prefixed, checksummed)
	 * @param providerType — Detected or explicit provider type label
	 */
	constructor(
		eip1193Provider: Eip1193Provider,
		address: string,
		providerType?: WalletProviderType
	) {
		this._eip1193 = eip1193Provider;
		this._ethersProvider = new BrowserProvider(eip1193Provider as never);
		this.address = address;
		this.providerType = providerType ?? detectProviderType(eip1193Provider);
	}

	/**
	 * Sign EIP-712 typed data via eth_signTypedData_v4.
	 *
	 * The ethers v6 Signer.signTypedData() method dispatches to the wallet's
	 * native EIP-712 signing popup (MetaMask shows the structured fields).
	 *
	 * @throws WalletConnectionError with code 4001 if user rejects
	 */
	async signTypedData(
		domain: EIP712Domain,
		types: Record<string, EIP712TypeField[]>,
		value: Record<string, unknown>
	): Promise<string> {
		try {
			const signer = await this._ethersProvider.getSigner(this.address);

			// ethers v6 Signer.signTypedData expects ethers TypedDataDomain shape.
			// Our EIP712Domain uses `chainId: bigint | number` which ethers handles natively.
			return await signer.signTypedData(
				{
					name: domain.name,
					version: domain.version,
					chainId: domain.chainId,
					verifyingContract: domain.verifyingContract
				},
				types,
				value
			);
		} catch (err) {
			throw wrapProviderError('signTypedData', err);
		}
	}

	/**
	 * Sign a raw message via personal_sign (EIP-191).
	 *
	 * @param message — UTF-8 string or raw bytes to sign
	 * @returns 65-byte ECDSA signature as hex string (0x-prefixed)
	 * @throws WalletConnectionError with code 4001 if user rejects
	 */
	async signMessage(message: string | Uint8Array): Promise<string> {
		try {
			const signer = await this._ethersProvider.getSigner(this.address);
			return await signer.signMessage(message);
		} catch (err) {
			throw wrapProviderError('signMessage', err);
		}
	}

	/**
	 * Get the current chain ID from the provider.
	 * Useful for verifying the user is on the expected network before signing.
	 */
	async getChainId(): Promise<number> {
		try {
			const network = await this._ethersProvider.getNetwork();
			return Number(network.chainId);
		} catch (err) {
			throw wrapProviderError('getChainId', err);
		}
	}

	/** Access the underlying ethers BrowserProvider (for advanced usage). */
	get ethersProvider(): BrowserProvider {
		return this._ethersProvider;
	}

	/** Access the underlying EIP-1193 provider (for event subscription). */
	get eip1193Provider(): Eip1193Provider {
		return this._eip1193;
	}

	/**
	 * Build an EVMConnectionState snapshot.
	 * Convenience for updating Svelte reactive state after connection.
	 */
	async toConnectionState(): Promise<EVMConnectionState> {
		let chainId: number | null = null;
		try {
			chainId = await this.getChainId();
		} catch {
			// Non-fatal — chain detection can fail transiently
		}
		return {
			connected: true,
			address: this.address,
			chainId,
			provider: this
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the injected EIP-1193 provider (window.ethereum) if available.
 *
 * Returns null if no wallet extension is installed. Simple window.ethereum
 * detection — EIP-6963 multi-provider discovery is not implemented yet.
 *
 * @returns The EIP-1193 provider or null
 */
export function getInjectedProvider(): Eip1193Provider | null {
	if (typeof window === 'undefined') return null;

	const ethereum = (window as WindowWithEthereum).ethereum;
	if (!ethereum || typeof ethereum.request !== 'function') return null;

	return ethereum as Eip1193Provider;
}

/**
 * Connect to the user's injected wallet (MetaMask, Coinbase Wallet, etc.)
 *
 * Triggers the wallet popup to request account access via eth_requestAccounts.
 * Returns an EVMWalletProvider ready for signing.
 *
 * @throws WalletConnectionError if no wallet is installed or user rejects
 */
export async function connectInjectedWallet(): Promise<EVMWalletProvider> {
	const eip1193 = getInjectedProvider();
	if (!eip1193) {
		throw new WalletConnectionError(
			'No Ethereum wallet detected. Please install MetaMask or another EVM wallet extension.',
			undefined,
			undefined
		);
	}

	try {
		const accounts = (await eip1193.request({
			method: 'eth_requestAccounts'
		})) as string[];

		if (!accounts || accounts.length === 0) {
			throw new WalletConnectionError(
				'No accounts returned from wallet. Please unlock your wallet and try again.'
			);
		}

		const address = accounts[0];
		return new EVMWalletProvider(eip1193, address);
	} catch (err) {
		// Already a WalletConnectionError — re-throw as-is
		if (err instanceof WalletConnectionError) throw err;

		throw wrapProviderError('eth_requestAccounts', err);
	}
}

/**
 * Switch the wallet to the Scroll Sepolia testnet.
 *
 * Attempts wallet_switchEthereumChain first. If the chain hasn't been added
 * to the user's wallet yet (error 4902), falls back to wallet_addEthereumChain.
 *
 * @param provider — The EIP-1193 provider to send the RPC call to
 * @throws WalletConnectionError if user rejects or switch fails
 */
export async function switchToScrollSepolia(provider: Eip1193Provider): Promise<void> {
	const chainIdHex = '0x' + SCROLL_SEPOLIA_CHAIN_ID.toString(16);

	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: chainIdHex }]
		});
	} catch (err) {
		const code = extractErrorCode(err);

		// 4902 = chain not added — try adding it
		if (code === WALLET_ERROR_CODES.CHAIN_NOT_ADDED) {
			try {
				await provider.request({
					method: 'wallet_addEthereumChain',
					params: [SCROLL_SEPOLIA_CONFIG]
				});
				return;
			} catch (addErr) {
				throw wrapProviderError('wallet_addEthereumChain', addErr);
			}
		}

		throw wrapProviderError('wallet_switchEthereumChain', err);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to account and chain changes on an EIP-1193 provider.
 *
 * Returns a cleanup function to remove all listeners. Designed for use
 * in Svelte 5 $effect() or onDestroy():
 *
 *   $effect(() => {
 *     const cleanup = subscribeToWalletEvents(eip1193, { ... });
 *     return cleanup;
 *   });
 */
export function subscribeToWalletEvents(
	provider: Eip1193Provider,
	handlers: {
		onAccountsChanged?: (accounts: string[]) => void;
		onChainChanged?: (chainId: number) => void;
		onDisconnect?: () => void;
	}
): () => void {
	if (!provider.on || !provider.removeListener) {
		// Provider doesn't support events — return no-op cleanup
		return () => {};
	}

	const accountsHandler = (accounts: unknown) => {
		const accts = accounts as string[];
		handlers.onAccountsChanged?.(accts);
	};

	const chainHandler = (chainIdHex: unknown) => {
		// MetaMask emits chainId as hex string (e.g. '0x8274f')
		const chainId = typeof chainIdHex === 'string'
			? parseInt(chainIdHex, 16)
			: Number(chainIdHex);
		handlers.onChainChanged?.(chainId);
	};

	const disconnectHandler = () => {
		handlers.onDisconnect?.();
	};

	provider.on('accountsChanged', accountsHandler);
	provider.on('chainChanged', chainHandler);
	provider.on('disconnect', disconnectHandler);

	return () => {
		provider.removeListener!('accountsChanged', accountsHandler);
		provider.removeListener!('chainChanged', chainHandler);
		provider.removeListener!('disconnect', disconnectHandler);
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Window type augmentation for window.ethereum. */
interface WindowWithEthereum {
	ethereum?: Eip1193Provider;
}

/**
 * Detect the wallet provider type from brand flags on the EIP-1193 object.
 * Falls back to 'injected' for unknown providers.
 */
function detectProviderType(provider: Eip1193Provider): WalletProviderType {
	if (provider.isCoinbaseWallet) return 'coinbase-wallet';
	// Check isCoinbaseWallet first — Coinbase Wallet also sets isMetaMask for compat
	if (provider.isMetaMask) return 'metamask';
	return 'injected';
}

/**
 * Extract the numeric error code from a wallet RPC error.
 * Providers are inconsistent — code may be on err.code, err.error.code, or deeply nested.
 */
function extractErrorCode(err: unknown): number | undefined {
	if (err == null || typeof err !== 'object') return undefined;

	const errObj = err as Record<string, unknown>;

	// Direct code (most common)
	if (typeof errObj.code === 'number') return errObj.code;

	// Nested error object (some providers wrap)
	if (errObj.error && typeof errObj.error === 'object') {
		const inner = errObj.error as Record<string, unknown>;
		if (typeof inner.code === 'number') return inner.code;
	}

	return undefined;
}

/**
 * Wrap an EIP-1193 provider error into a WalletConnectionError.
 * Preserves the numeric code and provides a human-readable message.
 */
function wrapProviderError(method: string, err: unknown): WalletConnectionError {
	const code = extractErrorCode(err);
	const rawMessage = err instanceof Error ? err.message : String(err);

	// User-friendly messages for common codes
	if (code === WALLET_ERROR_CODES.USER_REJECTED) {
		return new WalletConnectionError(
			'Request rejected. You declined the transaction in your wallet.',
			code,
			err
		);
	}

	if (code === WALLET_ERROR_CODES.UNAUTHORIZED) {
		return new WalletConnectionError(
			'Wallet is locked or the app is not authorized. Please unlock your wallet and try again.',
			code,
			err
		);
	}

	if (code === WALLET_ERROR_CODES.CHAIN_NOT_ADDED) {
		return new WalletConnectionError(
			'The requested network has not been added to your wallet.',
			code,
			err
		);
	}

	return new WalletConnectionError(
		`Wallet operation failed (${method}): ${rawMessage}`,
		code,
		err
	);
}
