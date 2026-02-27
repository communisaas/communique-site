/**
 * Wallet Provider Abstraction — unified signing interface for all entry paths.
 *
 * Three implementations:
 *   1. EVMWalletProvider  — MetaMask/WalletConnect/injected (browser, Path 2)
 *   2. NEARWalletProvider — Chain Signatures MPC signing (browser/server, Paths 1+3)
 *   3. OperatorWallet     — Server-side admin key for system operations only
 *
 * ARCHITECTURE:
 *   The wallet layer is orthogonal to the identity layer. Identity lives in the
 *   shadow-atlas (mDL → identity commitment → ZK proofs). The wallet is just the
 *   vehicle that delivers proofs on-chain and stakes tokens.
 *
 *   User operations (argue, co-sign, trade, claim) use the user's own wallet.
 *   System operations (AI eval, epochs, governance) use the OperatorWallet.
 *
 * @see .planning/wallet-onramp-research.md — Architecture: Three Entry Paths
 * @see debate-market-client.ts — current server-side implementation (legacy relayer)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal wallet interface for Scroll transaction signing.
 *
 * Implementations handle the mechanics of signing (MetaMask popup, NEAR MPC call,
 * or server-side ethers.Wallet) — callers just get back signatures and addresses.
 */
export interface WalletProvider {
	/** The Scroll address this wallet controls (0x-prefixed, checksummed). */
	readonly address: string;

	/** Human-readable label for logging/UI: 'metamask', 'walletconnect', 'near-chain-sig', 'operator' */
	readonly providerType: WalletProviderType;

	/**
	 * Sign EIP-712 typed data.
	 *
	 * Used for DistrictGate proof authorization (SubmitThreeTreeProof).
	 * EVM wallets call `eth_signTypedData_v4`. NEAR uses Chain Signatures
	 * to sign the struct hash. Operator uses ethers.Wallet.signTypedData.
	 */
	signTypedData(
		domain: EIP712Domain,
		types: Record<string, EIP712TypeField[]>,
		value: Record<string, unknown>
	): Promise<string>;

	/**
	 * Sign a raw message hash (32 bytes, 0x-prefixed).
	 *
	 * Used for EIP-191 personal_sign (wallet binding) and arbitrary signatures.
	 * Returns the 65-byte signature (r + s + v) as a hex string.
	 */
	signMessage(message: string | Uint8Array): Promise<string>;
}

export type WalletProviderType =
	| 'metamask'
	| 'walletconnect'
	| 'coinbase-wallet'
	| 'injected'
	| 'near-chain-sig'
	| 'operator';

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** EIP-712 domain separator fields. */
export interface EIP712Domain {
	name: string;
	version: string;
	chainId: bigint | number;
	verifyingContract: string;
}

/** Single field in an EIP-712 type definition. */
export interface EIP712TypeField {
	name: string;
	type: string;
}

/**
 * DistrictGate EIP-712 type definition for proof authorization.
 * The signer authorizes a ZK proof to be verified on-chain.
 *
 * This is the ONLY EIP-712 type currently used. If new typed data structures
 * are needed, add them here and update the signing functions.
 */
export const DISTRICT_GATE_EIP712_TYPES = {
	SubmitThreeTreeProof: [
		{ name: 'proofHash', type: 'bytes32' },
		{ name: 'publicInputsHash', type: 'bytes32' },
		{ name: 'verifierDepth', type: 'uint8' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' }
	]
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PROOF AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parameters for authorizing a ZK proof via EIP-712 signature.
 *
 * The signer produces an EIP-712 signature over the proof hash and public inputs hash.
 * The contract (DistrictGate) verifies `ECDSA.recover(digest, signature) == signer`.
 *
 * This structure is consumed by both the client-side signing flow (user's wallet)
 * and the server-side operator flow (system operations).
 */
export interface ProofAuthorizationParams {
	/** Raw proof bytes, 0x-prefixed hex. */
	proof: string;

	/** 31 field elements as hex strings (three-tree circuit public outputs). */
	publicInputs: string[];

	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;

	/** Unix timestamp. Signature invalid after this time. Default: +1 hour. */
	deadline: number;

	/** DistrictGate contract address (verifyingContract in EIP-712 domain). */
	districtGateAddress: string;

	/** Scroll chain ID (534351 for Sepolia, 534352 for mainnet). */
	chainId: bigint | number;

	/** Current nonce for the signer from DistrictGate.nonces(signerAddress). */
	nonce: bigint | number;
}

/** Result of signing a proof authorization. */
export interface ProofAuthorizationResult {
	/** 65-byte ECDSA signature (r + s + v), 0x-prefixed hex. */
	signature: string;

	/** Address that signed (for the `signer` parameter in contract calls). */
	signerAddress: string;

	/** The deadline used (may differ from input if defaulted). */
	deadline: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of an on-chain transaction attempt.
 * Used by both user operations (client-submitted) and system operations (server-submitted).
 */
export interface TxResult {
	success: boolean;
	txHash?: string;
	error?: string;
}

/**
 * Wallet entry path — determines which provider and flow a user needs.
 *
 * Set at account creation / wallet linking time. Stored in User model.
 */
export type WalletEntryPath =
	/** Non-crypto users: invisible NEAR implicit account → Chain Signatures → Scroll */
	| 'near'
	/** EVM wallet users: direct Scroll interaction via MetaMask/WC */
	| 'evm'
	/** Users with no wallet connected yet (pre-onboarding state) */
	| 'none';

// ═══════════════════════════════════════════════════════════════════════════
// USER WALLET STATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wallet state for a user, as stored in the database.
 *
 * A user may have:
 *   - An EVM wallet (wallet_address from MetaMask/WC binding)
 *   - A NEAR implicit account (near_account_id from invisible onboarding)
 *   - Both (if a NEAR user later connects an EVM wallet)
 *   - Neither (not yet onboarded to wallet layer)
 */
export interface UserWalletState {
	/** EVM wallet address (from wallet binding), null if not connected. */
	evmAddress: string | null;

	/** NEAR implicit account ID (hex public key), null if not created. */
	nearAccountId: string | null;

	/** Scroll address derived from NEAR Chain Signatures, null if not computed. */
	nearDerivedScrollAddress: string | null;

	/** Which path this user primarily uses for Scroll transactions. */
	entryPath: WalletEntryPath;
}
