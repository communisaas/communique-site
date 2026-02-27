/**
 * NEARWalletProvider — browser-side wallet for NEAR Chain Signatures users.
 *
 * Wraps a NEAR keypair and delegates ECDSA signing to the NEAR MPC network.
 * The derived Scroll address is deterministic for a given (NEAR account + path).
 * This is the wallet implementation for:
 *   - Path 1: Non-crypto users (invisible NEAR implicit account)
 *   - Path 3: Non-EVM crypto users (NEAR native accounts)
 *
 * Unlike EVMWalletProvider (which wraps MetaMask via BrowserProvider), this
 * provider computes EIP-712 / EIP-191 hashes locally and sends the 32-byte
 * digest to the MPC network for threshold ECDSA signing.
 *
 * BROWSER-SAFE: No $env imports, no server-only dependencies.
 * Latency: 5-15 seconds per signature (MPC consensus across 8 threshold nodes).
 *
 * Usage:
 *   const provider = new NEARWalletProvider({ nearAccountId, nearKeyPair, scrollAddress });
 *   const sig = await provider.signTypedData(domain, types, value);
 *
 * Or with the factory (auto-derives Scroll address from the MPC contract):
 *   const provider = await createNEARWalletProvider({ nearAccountId, nearKeyPair });
 *
 * @see types.ts  WalletProvider — interface this implements
 * @see evm-provider.ts  EVMWalletProvider — EVM counterpart (MetaMask/injected)
 * @see $lib/core/near/chain-signatures.ts — MPC signing + address derivation
 */

import { KeyPair } from '@near-js/crypto';
import { TypedDataEncoder, hashMessage } from 'ethers';
import type {
	WalletProvider,
	WalletProviderType,
	EIP712Domain,
	EIP712TypeField
} from './types';
import {
	signWithChainSignatures,
	deriveScrollAddress,
	ChainSignatureError,
	hexToBytes
} from '$lib/core/near/chain-signatures';
import type { ChainSignatureOptions } from '$lib/core/near/chain-signatures';

// ═══════════════════════════════════════════════════════════════════════════
// LOG PREFIX
// ═══════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = '[wallet/near]';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Constructor parameters for NEARWalletProvider.
 *
 * The keypair is provided by the application layer — typically loaded from
 * the server (decrypted there) and passed to the client via a secure session.
 * The Scroll address should be pre-derived via `deriveScrollAddress()` to
 * avoid an async call in the constructor.
 */
export interface NEARWalletProviderParams {
	/** NEAR account ID that owns the derived key (e.g., "alice.testnet"). */
	nearAccountId: string;

	/** NEAR Ed25519 keypair for signing the MPC request transaction on NEAR. */
	nearKeyPair: KeyPair;

	/**
	 * Pre-derived Scroll address for this NEAR account.
	 * Obtained via `deriveScrollAddress(nearAccountId)` at account creation.
	 * Must be 0x-prefixed and checksummed.
	 */
	scrollAddress: string;

	/** NEAR network to target. Default: 'testnet'. */
	network?: 'testnet' | 'mainnet';

	/** Derivation path for the MPC key. Default: 'scroll'. */
	derivationPath?: string;
}

/**
 * Reactive-friendly state type for Svelte 5 $state() usage.
 *
 * Usage in a .svelte component:
 *   let nearState = $state<NEARConnectionState>(NEAR_DISCONNECTED_STATE);
 *   nearState = provider.toConnectionState();
 */
export interface NEARConnectionState {
	connected: boolean;
	nearAccountId: string | null;
	scrollAddress: string | null;
	provider: NEARWalletProvider | null;
	network: 'testnet' | 'mainnet';
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION STATE
// ═══════════════════════════════════════════════════════════════════════════

/** Default disconnected state — use as initializer for $state(). */
export const NEAR_DISCONNECTED_STATE: NEARConnectionState = {
	connected: false,
	nearAccountId: null,
	scrollAddress: null,
	provider: null,
	network: 'testnet'
};

// ═══════════════════════════════════════════════════════════════════════════
// NEAR WALLET PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Browser-side NEAR Chain Signatures wallet provider.
 *
 * Implements the WalletProvider interface by computing EIP-712 / EIP-191
 * hashes locally and signing them via the NEAR MPC network. The derived
 * Scroll address is deterministic for a given (NEAR account + derivation path).
 *
 * Each signing operation takes 5-15 seconds due to MPC consensus.
 * Callers should display a loading indicator during signing.
 */
export class NEARWalletProvider implements WalletProvider {
	readonly address: string;
	readonly providerType: WalletProviderType = 'near-chain-sig';

	private readonly _nearAccountId: string;
	private readonly _nearKeyPair: KeyPair;
	private readonly _network: 'testnet' | 'mainnet';
	private readonly _derivationPath: string;

	constructor(params: NEARWalletProviderParams) {
		if (!params.nearAccountId) {
			throw new Error(`${LOG_PREFIX} nearAccountId is required`);
		}
		if (!params.nearKeyPair) {
			throw new Error(`${LOG_PREFIX} nearKeyPair is required`);
		}
		if (!params.scrollAddress || !params.scrollAddress.startsWith('0x')) {
			throw new Error(
				`${LOG_PREFIX} scrollAddress must be a 0x-prefixed Ethereum address`
			);
		}

		this._nearAccountId = params.nearAccountId;
		this._nearKeyPair = params.nearKeyPair;
		this.address = params.scrollAddress;
		this._network = params.network ?? 'testnet';
		this._derivationPath = params.derivationPath ?? 'scroll';
	}

	// ── WalletProvider: signTypedData ──────────────────────────────────────

	/**
	 * Sign EIP-712 typed data via NEAR Chain Signatures MPC.
	 *
	 * Computes the EIP-712 struct hash locally using ethers TypedDataEncoder,
	 * then sends the 32-byte digest to the MPC network for threshold ECDSA
	 * signing. Returns the 65-byte signature (r + s + v) as a hex string.
	 *
	 * Latency: 5-15 seconds (MPC consensus).
	 *
	 * @param domain — EIP-712 domain separator (name, version, chainId, verifyingContract)
	 * @param types — EIP-712 type definitions (e.g., { SubmitThreeTreeProof: [...] })
	 * @param value — The struct values to sign
	 * @returns 0x-prefixed 65-byte ECDSA signature hex string
	 *
	 * @throws {ChainSignatureError} if the MPC signing fails
	 */
	async signTypedData(
		domain: EIP712Domain,
		types: Record<string, EIP712TypeField[]>,
		value: Record<string, unknown>
	): Promise<string> {
		console.log(
			`${LOG_PREFIX} signTypedData: computing EIP-712 hash (account=${this._nearAccountId})`
		);

		try {
			// 1. Compute the full EIP-712 hash locally.
			//    TypedDataEncoder.hash() returns the 32-byte digest as 0x-prefixed hex.
			//    We pass the domain fields explicitly to match ethers TypedDataDomain shape.
			const digest = TypedDataEncoder.hash(
				{
					name: domain.name,
					version: domain.version,
					chainId: domain.chainId,
					verifyingContract: domain.verifyingContract
				},
				types,
				value
			);

			// 2. Convert the hex digest to a 32-byte Uint8Array for MPC signing
			const hashBytes = hexToBytes(digest);

			console.log(
				`${LOG_PREFIX} signTypedData: sending to MPC network (digest=${digest.slice(0, 18)}...)`
			);

			// 3. Sign via Chain Signatures (5-15s MPC latency)
			const sig = await signWithChainSignatures(
				this._nearAccountId,
				this._nearKeyPair,
				hashBytes,
				{
					network: this._network,
					derivationPath: this._derivationPath
				}
			);

			console.log(
				`${LOG_PREFIX} signTypedData: MPC signature received (v=${sig.v})`
			);

			// 4. Return serialized signature (65 bytes: r + s + v, 0x-prefixed)
			return sig.serialized;
		} catch (err) {
			if (err instanceof ChainSignatureError) {
				console.error(
					`${LOG_PREFIX} signTypedData: Chain Signature error — ${err.code}: ${err.message}`
				);
				throw err;
			}

			const message = err instanceof Error ? err.message : String(err);
			console.error(`${LOG_PREFIX} signTypedData failed: ${message}`);
			throw new ChainSignatureError(
				`Failed to sign typed data: ${message}`,
				'SIGNING_FAILED',
				err
			);
		}
	}

	// ── WalletProvider: signMessage ────────────────────────────────────────

	/**
	 * Sign a raw message via personal_sign (EIP-191) using NEAR Chain Signatures.
	 *
	 * Computes the EIP-191 message hash locally using ethers hashMessage,
	 * then sends the 32-byte digest to the MPC network for signing.
	 *
	 * Used for wallet binding (proving ownership of the derived Scroll address).
	 *
	 * Latency: 5-15 seconds (MPC consensus).
	 *
	 * @param message — UTF-8 string or raw bytes to sign
	 * @returns 0x-prefixed 65-byte ECDSA signature hex string
	 *
	 * @throws {ChainSignatureError} if the MPC signing fails
	 */
	async signMessage(message: string | Uint8Array): Promise<string> {
		const messagePreview =
			typeof message === 'string'
				? message.slice(0, 40) + (message.length > 40 ? '...' : '')
				: `<${message.length} bytes>`;

		console.log(
			`${LOG_PREFIX} signMessage: computing EIP-191 hash (message="${messagePreview}")`
		);

		try {
			// 1. Compute the EIP-191 personal_sign hash.
			//    hashMessage() prepends "\x19Ethereum Signed Message:\n" + length,
			//    then keccak256 hashes the result. Returns 0x-prefixed 32-byte hex.
			const digest = hashMessage(message);

			// 2. Convert to bytes for MPC signing
			const hashBytes = hexToBytes(digest);

			console.log(
				`${LOG_PREFIX} signMessage: sending to MPC network (digest=${digest.slice(0, 18)}...)`
			);

			// 3. Sign via Chain Signatures (5-15s MPC latency)
			const sig = await signWithChainSignatures(
				this._nearAccountId,
				this._nearKeyPair,
				hashBytes,
				{
					network: this._network,
					derivationPath: this._derivationPath
				}
			);

			console.log(
				`${LOG_PREFIX} signMessage: MPC signature received (v=${sig.v})`
			);

			// 4. Return serialized signature (65 bytes: r + s + v, 0x-prefixed)
			return sig.serialized;
		} catch (err) {
			if (err instanceof ChainSignatureError) {
				console.error(
					`${LOG_PREFIX} signMessage: Chain Signature error — ${err.code}: ${err.message}`
				);
				throw err;
			}

			const message_ = err instanceof Error ? err.message : String(err);
			console.error(`${LOG_PREFIX} signMessage failed: ${message_}`);
			throw new ChainSignatureError(
				`Failed to sign message: ${message_}`,
				'SIGNING_FAILED',
				err
			);
		}
	}

	// ── Connection State ──────────────────────────────────────────────────

	/**
	 * Build a NEARConnectionState snapshot.
	 * Convenience for updating Svelte reactive state after connection.
	 *
	 * Unlike EVMWalletProvider.toConnectionState(), this is synchronous
	 * because the NEAR provider has no chain-detection RPC call.
	 */
	toConnectionState(): NEARConnectionState {
		return {
			connected: true,
			nearAccountId: this._nearAccountId,
			scrollAddress: this.address,
			provider: this,
			network: this._network
		};
	}

	// ── Accessors ─────────────────────────────────────────────────────────

	/** The NEAR account ID this provider signs on behalf of. */
	get nearAccountId(): string {
		return this._nearAccountId;
	}

	/** The NEAR network this provider targets. */
	get network(): 'testnet' | 'mainnet' {
		return this._network;
	}

	/** The derivation path used for MPC key derivation. */
	get derivationPath(): string {
		return this._derivationPath;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parameters for the async factory function.
 * Same as NEARWalletProviderParams but scrollAddress is optional —
 * if omitted, it will be derived via MPC view call.
 */
export interface CreateNEARWalletProviderParams {
	/** NEAR account ID that owns the derived key. */
	nearAccountId: string;

	/** NEAR Ed25519 keypair for signing the MPC request transaction on NEAR. */
	nearKeyPair: KeyPair;

	/**
	 * Pre-derived Scroll address. If omitted, the factory will call
	 * `deriveScrollAddress()` which makes an RPC view call to the MPC contract.
	 */
	scrollAddress?: string;

	/** NEAR network to target. Default: 'testnet'. */
	network?: 'testnet' | 'mainnet';

	/** Derivation path for the MPC key. Default: 'scroll'. */
	derivationPath?: string;
}

/**
 * Create a NEARWalletProvider, optionally deriving the Scroll address.
 *
 * If `scrollAddress` is provided, the provider is created synchronously
 * (wrapped in a resolved promise). If omitted, an RPC view call to the
 * MPC signer contract derives the deterministic Scroll address first.
 *
 * Prefer providing `scrollAddress` when possible (it's stored at account
 * creation time) to avoid the extra RPC round-trip.
 *
 * @param params — Account ID, keypair, and optional pre-derived address
 * @returns A configured NEARWalletProvider
 *
 * @throws {ChainSignatureError} with code 'DERIVATION_FAILED' if address
 *   derivation fails (only when scrollAddress is not provided)
 *
 * @example
 * ```ts
 * // With pre-derived address (fast, no RPC):
 * const provider = await createNEARWalletProvider({
 *   nearAccountId: 'alice.testnet',
 *   nearKeyPair: keyPair,
 *   scrollAddress: '0x742d35Cc...'
 * });
 *
 * // Without address (derives via MPC view call):
 * const provider = await createNEARWalletProvider({
 *   nearAccountId: 'alice.testnet',
 *   nearKeyPair: keyPair
 * });
 * ```
 */
export async function createNEARWalletProvider(
	params: CreateNEARWalletProviderParams
): Promise<NEARWalletProvider> {
	const network = params.network ?? 'testnet';
	const derivationPath = params.derivationPath ?? 'scroll';

	let scrollAddress = params.scrollAddress;

	if (!scrollAddress) {
		console.log(
			`${LOG_PREFIX} createNEARWalletProvider: deriving Scroll address for ${params.nearAccountId}`
		);

		scrollAddress = await deriveScrollAddress(params.nearAccountId, {
			network,
			derivationPath
		});

		console.log(
			`${LOG_PREFIX} createNEARWalletProvider: derived ${scrollAddress}`
		);
	}

	return new NEARWalletProvider({
		nearAccountId: params.nearAccountId,
		nearKeyPair: params.nearKeyPair,
		scrollAddress,
		network,
		derivationPath
	});
}

