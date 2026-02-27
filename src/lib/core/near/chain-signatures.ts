/**
 * NEAR Chain Signatures — MPC threshold signing for Scroll (EVM) transactions.
 *
 * Chain Signatures is a threshold MPC network (8 nodes) on NEAR that can sign
 * for any chain. This module derives Scroll addresses from NEAR accounts and
 * signs EVM transactions via the MPC signer contract.
 *
 * Flow:
 *   1. Derive a deterministic secp256k1 public key for (NEAR account + path)
 *   2. Convert to an Ethereum/Scroll address (keccak256 of uncompressed key)
 *   3. Sign a 32-byte hash via the MPC `sign()` function call on NEAR
 *   4. Decode the MPC response into EVM-compatible (r, s, v) signature
 *
 * Environment-agnostic: runs in both browser (via NEARWalletProvider) and
 * server (for key derivation at account creation). No $env imports.
 *
 * @see https://docs.near.org/abstraction/chain-signatures
 * @see https://github.com/near/mpc-recovery — MPC signer implementation
 */

import { Account } from '@near-js/accounts';
import { KeyPair } from '@near-js/crypto';
import { KeyPairSigner } from '@near-js/signers';
import { JsonRpcProvider } from '@near-js/providers';
import { computeAddress, Transaction } from 'ethers';
import type { FinalExecutionOutcome } from '@near-js/types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MPC signer contract for NEAR testnet. */
export const MPC_SIGNER_TESTNET = 'v1.signer-prod.testnet';

/** MPC signer contract for NEAR mainnet. */
export const MPC_SIGNER_MAINNET = 'v1.signer.near';

/** NEAR RPC endpoint for testnet. */
export const NEAR_RPC_TESTNET = 'https://rpc.testnet.near.org';

/** NEAR RPC endpoint for mainnet. */
export const NEAR_RPC_MAINNET = 'https://rpc.mainnet.near.org';

/**
 * Gas to attach to the MPC sign() call: 300 TGas.
 * The MPC nodes need significant gas for the threshold signing protocol.
 */
export const MPC_SIGN_GAS = BigInt('300000000000000');

/**
 * Deposit to attach to the MPC sign() call: 0.05 NEAR (in yoctoNEAR).
 *
 * The MPC network uses congestion-based dynamic pricing:
 * - Normal load: 1 yoctoNEAR
 * - Under load (4+ pending requests): 50 milliNEAR per step
 *
 * We use 0.05 NEAR as a safe deposit that covers congestion spikes.
 * Unused deposit is refunded.
 */
export const MPC_SIGN_DEPOSIT = BigInt('50000000000000000000000');

/** Default derivation path for Scroll addresses. */
export const DEFAULT_DERIVATION_PATH = 'scroll';

/** Log prefix for this module. */
const LOG_PREFIX = '[near/chain-sig]';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw MPC signature response from the NEAR Chain Signatures protocol.
 *
 * The MPC network returns an ECDSA signature as three components:
 * - `big_r`: The R point on the secp256k1 curve (affine coordinates)
 * - `s`: The scalar component of the signature
 * - `recovery_id`: Parity bit for recovering the public key (0 or 1)
 */
export interface MPCSignatureResponse {
	big_r: {
		affine_point: string;
	};
	s: {
		scalar: string;
	};
	recovery_id: number;
}

/**
 * EVM-compatible ECDSA signature with r, s, v components.
 * Includes the serialized 65-byte hex representation for convenience.
 */
export interface ChainSignatureResult {
	/** 32-byte r value as 0x-prefixed hex. */
	r: string;
	/** 32-byte s value as 0x-prefixed hex. */
	s: string;
	/** Recovery parameter (27 or 28 for EVM). */
	v: number;
	/** Full 65-byte serialized signature as 0x-prefixed hex (r + s + v). */
	serialized: string;
}

/**
 * Network configuration for NEAR Chain Signatures operations.
 * Defaults to testnet if not specified.
 */
export interface ChainSignatureOptions {
	/** NEAR network to use. Default: 'testnet'. */
	network?: 'testnet' | 'mainnet';
	/** Derivation path for address generation. Default: 'scroll'. */
	derivationPath?: string;
}

/**
 * Unsigned EVM transaction parameters.
 * Matches the EIP-1559 (Type 2) transaction format used on Scroll.
 */
export interface UnsignedScrollTransaction {
	/** Recipient address (0x-prefixed). */
	to: string;
	/** Calldata (0x-prefixed hex). */
	data: string;
	/** Value in wei. Default: 0. */
	value?: bigint;
	/** Chain ID (534351 for Scroll Sepolia, 534352 for Scroll Mainnet). */
	chainId: number;
	/** Gas limit. If omitted, caller must estimate beforehand. */
	gasLimit?: bigint;
	/** EIP-1559 max fee per gas in wei. */
	maxFeePerGas?: bigint;
	/** EIP-1559 max priority fee per gas in wei. */
	maxPriorityFeePerGas?: bigint;
	/** Transaction nonce. If omitted, caller must fetch beforehand. */
	nonce?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve the MPC signer contract ID for the given network.
 */
function getSignerContract(network: 'testnet' | 'mainnet'): string {
	return network === 'mainnet' ? MPC_SIGNER_MAINNET : MPC_SIGNER_TESTNET;
}

/**
 * Resolve the NEAR RPC URL for the given network.
 */
function getRpcUrl(network: 'testnet' | 'mainnet'): string {
	return network === 'mainnet' ? NEAR_RPC_MAINNET : NEAR_RPC_TESTNET;
}

/**
 * Create a NEAR Account instance for making function calls.
 *
 * Uses the modern @near-js v2 API:
 *   - JsonRpcProvider for the RPC connection
 *   - KeyPairSigner for transaction signing
 *   - Account constructed directly (no deprecated `connect()`)
 *
 * @param nearAccountId - The NEAR account ID
 * @param nearKeyPair - The key pair for signing NEAR transactions
 * @param network - Target NEAR network
 * @returns A configured Account instance
 */
function createNearAccount(
	nearAccountId: string,
	nearKeyPair: KeyPair,
	network: 'testnet' | 'mainnet'
): Account {
	const provider = new JsonRpcProvider({ url: getRpcUrl(network) });
	const signer = new KeyPairSigner(nearKeyPair);
	return new Account(nearAccountId, provider, signer);
}

/**
 * Parse the MPC signature response from a NEAR function call outcome.
 *
 * The sign() call is async on NEAR — the actual signature is returned in a
 * receipt's SuccessValue (base64-encoded JSON). We walk the receipts_outcome
 * array looking for the one that contains the MPC response.
 *
 * @param outcome - The FinalExecutionOutcome from the sign() function call
 * @returns The parsed MPC signature response
 * @throws If the MPC call failed or no signature was found in the outcome
 */
function parseMPCSignatureFromOutcome(outcome: FinalExecutionOutcome): MPCSignatureResponse {
	// Check top-level status for failure
	if (
		typeof outcome.status === 'object' &&
		'Failure' in outcome.status &&
		outcome.status.Failure
	) {
		const errMsg = outcome.status.Failure.error_message || 'Unknown MPC error';
		throw new ChainSignatureError(
			`MPC sign() call failed: ${errMsg}`,
			'MPC_CALL_FAILED'
		);
	}

	// The MPC response comes back in a receipt's SuccessValue.
	// Walk all receipt outcomes to find the one with the signature.
	for (const receiptOutcome of outcome.receipts_outcome) {
		const status = receiptOutcome.outcome.status;
		if (typeof status === 'object' && 'SuccessValue' in status && status.SuccessValue) {
			try {
				const decoded = atob(status.SuccessValue);
				const parsed = JSON.parse(decoded);

				// Validate it looks like an MPC signature response
				if (parsed.big_r?.affine_point && parsed.s?.scalar && 'recovery_id' in parsed) {
					return parsed as MPCSignatureResponse;
				}
			} catch {
				// Not the receipt we're looking for — try next
				continue;
			}
		}
	}

	// Also check the top-level SuccessValue (some contract versions return here)
	if (typeof outcome.status === 'object' && 'SuccessValue' in outcome.status && outcome.status.SuccessValue) {
		try {
			const decoded = atob(outcome.status.SuccessValue);
			const parsed = JSON.parse(decoded);
			if (parsed.big_r?.affine_point && parsed.s?.scalar && 'recovery_id' in parsed) {
				return parsed as MPCSignatureResponse;
			}
		} catch {
			// Fall through to error
		}
	}

	throw new ChainSignatureError(
		'No MPC signature found in transaction outcome. The MPC network may not have responded.',
		'NO_SIGNATURE_IN_OUTCOME'
	);
}

/**
 * Convert an MPC signature response to EVM-compatible (r, s, v) format.
 *
 * The MPC returns:
 * - `big_r.affine_point`: Hex-encoded secp256k1 point (65 bytes uncompressed, or 33 compressed)
 *   The x-coordinate of R is the `r` value in ECDSA.
 * - `s.scalar`: Hex-encoded 32-byte scalar
 * - `recovery_id`: 0 or 1, maps to EVM v = 27 or 28
 *
 * @param mpcSig - The raw MPC signature response
 * @returns EVM-compatible signature components
 */
function mpcSignatureToEVM(mpcSig: MPCSignatureResponse): ChainSignatureResult {
	// Extract r from the affine_point of big_r.
	// The affine_point is a hex-encoded secp256k1 point.
	// Uncompressed format: 04 + x(32 bytes) + y(32 bytes) — r is the x-coordinate.
	// Compressed format: 02/03 + x(32 bytes) — r is the x-coordinate.
	const affineHex = mpcSig.big_r.affine_point.startsWith('0x')
		? mpcSig.big_r.affine_point.slice(2)
		: mpcSig.big_r.affine_point;

	let rHex: string;
	if (affineHex.length === 130 && affineHex.startsWith('04')) {
		// Uncompressed point: 04 || x(64 hex chars) || y(64 hex chars)
		rHex = affineHex.slice(2, 66);
	} else if (affineHex.length === 66 && (affineHex.startsWith('02') || affineHex.startsWith('03'))) {
		// Compressed point: 02/03 || x(64 hex chars)
		rHex = affineHex.slice(2, 66);
	} else {
		// Fallback: assume the hex is the raw x-coordinate (64 chars / 32 bytes)
		rHex = affineHex.padStart(64, '0');
	}

	// Extract s from the scalar
	const sRaw = mpcSig.s.scalar.startsWith('0x')
		? mpcSig.s.scalar.slice(2)
		: mpcSig.s.scalar;
	const sHex = sRaw.padStart(64, '0');

	// EVM recovery: v = recovery_id + 27
	const v = mpcSig.recovery_id + 27;

	const r = '0x' + rHex;
	const s = '0x' + sHex;

	// Serialized: 65 bytes = r(32) + s(32) + v(1)
	const vHex = v.toString(16).padStart(2, '0');
	const serialized = '0x' + rHex + sHex + vHex;

	return { r, s, v, serialized };
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Error codes for Chain Signatures operations.
 */
export type ChainSignatureErrorCode =
	| 'MPC_CALL_FAILED'
	| 'NO_SIGNATURE_IN_OUTCOME'
	| 'DERIVATION_FAILED'
	| 'INVALID_PAYLOAD'
	| 'SIGNING_FAILED'
	| 'SERIALIZATION_FAILED';

/**
 * Structured error for Chain Signatures operations.
 * Includes a machine-readable code for programmatic error handling.
 */
export class ChainSignatureError extends Error {
	readonly code: ChainSignatureErrorCode;
	readonly cause: unknown;

	constructor(message: string, code: ChainSignatureErrorCode, cause?: unknown) {
		super(message);
		this.name = 'ChainSignatureError';
		this.code = code;
		this.cause = cause;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Derive Scroll Address
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive the Scroll address for a NEAR account via Chain Signatures.
 *
 * Makes a view call to the MPC signer contract's `derived_public_key` method,
 * which returns the deterministic secp256k1 public key for the given
 * (NEAR account, derivation path) pair. This public key is then converted
 * to an Ethereum/Scroll address via keccak256.
 *
 * This is a read-only operation — no NEAR transaction is submitted and
 * no deposit is required.
 *
 * @param nearAccountId - The NEAR account ID (e.g., "alice.testnet")
 * @param options - Network and derivation path options
 * @returns 0x-prefixed checksummed Scroll/Ethereum address
 *
 * @throws {ChainSignatureError} with code 'DERIVATION_FAILED' if the
 *   view call fails or returns an unexpected format
 *
 * @example
 * ```ts
 * const scrollAddr = await deriveScrollAddress('alice.testnet');
 * // => "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
 * ```
 *
 * @see https://docs.near.org/abstraction/chain-signatures#deriving-the-foreign-address
 */
export async function deriveScrollAddress(
	nearAccountId: string,
	options?: ChainSignatureOptions
): Promise<string> {
	const network = options?.network ?? 'testnet';
	const path = options?.derivationPath ?? DEFAULT_DERIVATION_PATH;
	const signerContract = getSignerContract(network);

	console.log(
		`${LOG_PREFIX} Deriving Scroll address for ${nearAccountId} (path="${path}", network=${network})`
	);

	try {
		const provider = new JsonRpcProvider({ url: getRpcUrl(network) });

		// View call to derived_public_key — returns the secp256k1 public key
		// as a hex-encoded string (uncompressed format: "04" + x + y)
		const result = await provider.callFunction<string>(
			signerContract,
			'derived_public_key',
			{ path, predecessor: nearAccountId }
		);

		if (!result || typeof result !== 'string') {
			throw new ChainSignatureError(
				`MPC signer returned unexpected result for derived_public_key: ${JSON.stringify(result)}`,
				'DERIVATION_FAILED'
			);
		}

		// The result is a hex-encoded secp256k1 uncompressed public key.
		// ethers.computeAddress expects "0x04..." format.
		const pubKeyHex = result.startsWith('0x') ? result : '0x' + result;

		// Ensure it's an uncompressed key (starts with 04 after 0x prefix)
		// computeAddress handles both compressed and uncompressed keys.
		const scrollAddress = computeAddress(pubKeyHex);

		console.log(`${LOG_PREFIX} Derived Scroll address: ${scrollAddress}`);
		return scrollAddress;
	} catch (err) {
		if (err instanceof ChainSignatureError) throw err;

		throw new ChainSignatureError(
			`Failed to derive Scroll address for ${nearAccountId}: ${err instanceof Error ? err.message : String(err)}`,
			'DERIVATION_FAILED',
			err
		);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Sign Hash with Chain Signatures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sign a 32-byte hash using NEAR Chain Signatures MPC protocol.
 *
 * Submits a function call transaction to the MPC signer contract's `sign()`
 * method. The MPC network (8 threshold nodes) performs distributed ECDSA
 * signing and returns the signature components.
 *
 * Latency: 5-15 seconds (MPC consensus across threshold nodes).
 *
 * @param nearAccountId - The NEAR account ID that owns the derived key
 * @param nearKeyPair - Key pair for signing the NEAR transaction
 * @param payload - 32-byte hash to sign (e.g., keccak256 of unsigned EVM tx)
 * @param options - Network and derivation path options
 * @returns EVM-compatible signature with r, s, v, and serialized form
 *
 * @throws {ChainSignatureError} with code 'INVALID_PAYLOAD' if payload is
 *   not exactly 32 bytes
 * @throws {ChainSignatureError} with code 'SIGNING_FAILED' if the MPC
 *   signing request fails
 * @throws {ChainSignatureError} with code 'MPC_CALL_FAILED' if the NEAR
 *   function call reverts
 * @throws {ChainSignatureError} with code 'NO_SIGNATURE_IN_OUTCOME' if the
 *   MPC network did not return a signature
 *
 * @example
 * ```ts
 * import { KeyPair } from '@near-js/crypto';
 * import { keccak256 } from 'ethers';
 *
 * const keyPair = KeyPair.fromString('ed25519:...');
 * const hash = keccak256('0x...');  // 32-byte hash
 * const hashBytes = new Uint8Array(Buffer.from(hash.slice(2), 'hex'));
 *
 * const sig = await signWithChainSignatures(
 *   'alice.testnet',
 *   keyPair,
 *   hashBytes,
 *   { network: 'testnet' }
 * );
 * // sig.r, sig.s, sig.v, sig.serialized
 * ```
 *
 * @see https://docs.near.org/abstraction/chain-signatures#sign-the-transaction
 */
export async function signWithChainSignatures(
	nearAccountId: string,
	nearKeyPair: KeyPair,
	payload: Uint8Array,
	options?: ChainSignatureOptions
): Promise<ChainSignatureResult> {
	// Validate payload is exactly 32 bytes
	if (payload.length !== 32) {
		throw new ChainSignatureError(
			`Payload must be exactly 32 bytes, got ${payload.length}`,
			'INVALID_PAYLOAD'
		);
	}

	const network = options?.network ?? 'testnet';
	const path = options?.derivationPath ?? DEFAULT_DERIVATION_PATH;
	const signerContract = getSignerContract(network);

	console.log(
		`${LOG_PREFIX} Signing payload via MPC (account=${nearAccountId}, path="${path}", network=${network})`
	);

	try {
		const account = createNearAccount(nearAccountId, nearKeyPair, network);

		// The MPC sign() method expects the payload as an array of numbers (bytes)
		const payloadArray = Array.from(payload);

		// Call sign() on the MPC signer contract
		const outcome: FinalExecutionOutcome = await account.callFunctionRaw({
			contractId: signerContract,
			methodName: 'sign',
			args: {
				request: {
					payload: payloadArray,
					path,
					key_version: 0
				}
			},
			gas: MPC_SIGN_GAS,
			deposit: MPC_SIGN_DEPOSIT
		});

		// Parse the MPC signature from the transaction outcome
		const mpcSignature = parseMPCSignatureFromOutcome(outcome);

		console.log(
			`${LOG_PREFIX} MPC signature received (recovery_id=${mpcSignature.recovery_id})`
		);

		// Convert to EVM-compatible format
		const evmSig = mpcSignatureToEVM(mpcSignature);

		console.log(`${LOG_PREFIX} Signature converted to EVM format (v=${evmSig.v})`);
		return evmSig;
	} catch (err) {
		if (err instanceof ChainSignatureError) throw err;

		throw new ChainSignatureError(
			`Chain Signatures signing failed: ${err instanceof Error ? err.message : String(err)}`,
			'SIGNING_FAILED',
			err
		);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Sign a Scroll Transaction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sign an unsigned EVM transaction for Scroll using NEAR Chain Signatures.
 *
 * This is the high-level convenience function that:
 *   1. Builds an EIP-1559 (Type 2) unsigned transaction from parameters
 *   2. Serializes and hashes it (keccak256 of RLP-encoded unsigned tx)
 *   3. Signs the hash via the MPC network
 *   4. Attaches the (r, s, v) signature to produce a signed transaction
 *   5. Returns the signed transaction bytes ready for broadcast
 *
 * The caller should have already:
 *   - Fetched the nonce from the Scroll RPC
 *   - Estimated gas parameters (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
 *
 * @param nearAccountId - The NEAR account ID that owns the derived Scroll key
 * @param nearKeyPair - Key pair for signing the NEAR MPC request transaction
 * @param unsignedTx - Unsigned EVM transaction parameters
 * @param options - Network options (defaults to testnet)
 * @returns 0x-prefixed signed transaction bytes, ready for eth_sendRawTransaction
 *
 * @throws {ChainSignatureError} with code 'SERIALIZATION_FAILED' if the
 *   transaction cannot be serialized
 * @throws {ChainSignatureError} with code 'SIGNING_FAILED' if MPC signing fails
 *
 * @example
 * ```ts
 * const signedTx = await signScrollTransaction(
 *   'alice.testnet',
 *   keyPair,
 *   {
 *     to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
 *     data: '0x',
 *     value: 1000000000000000n,  // 0.001 ETH
 *     chainId: 534351,           // Scroll Sepolia
 *     gasLimit: 21000n,
 *     maxFeePerGas: 1000000000n,
 *     maxPriorityFeePerGas: 1000000n,
 *     nonce: 0
 *   },
 *   { network: 'testnet' }
 * );
 *
 * // Broadcast via Scroll RPC:
 * // await scrollProvider.send('eth_sendRawTransaction', [signedTx]);
 * ```
 *
 * @see https://docs.near.org/abstraction/chain-signatures#relay-the-signed-transaction
 */
export async function signScrollTransaction(
	nearAccountId: string,
	nearKeyPair: KeyPair,
	unsignedTx: UnsignedScrollTransaction,
	options?: Pick<ChainSignatureOptions, 'network'>
): Promise<string> {
	const network = options?.network ?? 'testnet';

	console.log(
		`${LOG_PREFIX} Signing Scroll tx (to=${unsignedTx.to}, chainId=${unsignedTx.chainId}, network=${network})`
	);

	try {
		// Build an ethers Transaction object (EIP-1559 / Type 2)
		const tx = Transaction.from({
			type: 2,
			to: unsignedTx.to,
			data: unsignedTx.data,
			value: unsignedTx.value ?? 0n,
			chainId: unsignedTx.chainId,
			gasLimit: unsignedTx.gasLimit,
			maxFeePerGas: unsignedTx.maxFeePerGas,
			maxPriorityFeePerGas: unsignedTx.maxPriorityFeePerGas,
			nonce: unsignedTx.nonce
		});

		// Get the unsigned transaction hash (keccak256 of RLP-encoded unsigned tx)
		const unsignedHash = tx.unsignedHash;

		console.log(`${LOG_PREFIX} Unsigned tx hash: ${unsignedHash}`);

		// Convert hash to 32-byte Uint8Array for signing
		const hashBytes = hexToBytes(unsignedHash);

		// Sign the hash via Chain Signatures MPC
		const signature = await signWithChainSignatures(
			nearAccountId,
			nearKeyPair,
			hashBytes,
			{ network, derivationPath: DEFAULT_DERIVATION_PATH }
		);

		// Attach the signature to the transaction
		tx.signature = {
			r: signature.r,
			s: signature.s,
			v: signature.v
		};

		// Serialize the signed transaction
		const signedTxBytes = tx.serialized;

		console.log(
			`${LOG_PREFIX} Signed Scroll tx ready (${signedTxBytes.length} hex chars)`
		);

		return signedTxBytes;
	} catch (err) {
		if (err instanceof ChainSignatureError) throw err;

		throw new ChainSignatureError(
			`Failed to sign Scroll transaction: ${err instanceof Error ? err.message : String(err)}`,
			'SERIALIZATION_FAILED',
			err
		);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a 0x-prefixed hex string to a Uint8Array.
 *
 * @param hex - Hex string, with or without 0x prefix
 * @returns Byte array
 */
export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

/**
 * Convert a Uint8Array to a 0x-prefixed hex string.
 *
 * @param bytes - Byte array
 * @returns 0x-prefixed hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
	return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
