/**
 * ERC-4337 UserOperation types and gas sponsorship interfaces.
 *
 * Type definitions for the Account Abstraction (ERC-4337) infrastructure
 * used to sponsor gas for debate market operations. Users submit UserOperations
 * instead of regular transactions; the Pimlico paymaster covers gas costs so
 * participants never need ETH.
 *
 * UNIVERSAL: No env vars, no server-only imports. Safe for client and server.
 *
 * @see pimlico.ts       — server-side Pimlico bundler/paymaster client
 * @see user-operation.ts — UserOp construction helpers (client-safe)
 */

// =============================================================================
// ERC-4337 UserOperation v0.7 (EntryPoint v0.7)
// =============================================================================

/**
 * ERC-4337 UserOperation v0.7.
 *
 * Mirrors the on-chain PackedUserOperation struct used by EntryPoint v0.7
 * (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`). All gas fields are bigint
 * to avoid precision loss in hex encoding.
 */
export interface UserOperation {
	/** Smart account address (counterfactual if not yet deployed). */
	sender: string;

	/** Anti-replay nonce managed by the smart account. */
	nonce: bigint;

	/** Smart account factory address (only for first tx / account deployment). */
	factory?: string;

	/** Factory initialization data (only for first tx / account deployment). */
	factoryData?: string;

	/** Encoded function call on the smart account (e.g. execute(target, value, data)). */
	callData: string;

	/** Gas limit for the main execution phase. */
	callGasLimit: bigint;

	/** Gas limit for the verification phase (signature + paymaster). */
	verificationGasLimit: bigint;

	/** Gas overhead paid to the bundler for calldata and off-chain work. */
	preVerificationGas: bigint;

	/** EIP-1559 max fee per gas. */
	maxFeePerGas: bigint;

	/** EIP-1559 max priority fee per gas (tip to the block builder). */
	maxPriorityFeePerGas: bigint;

	/** Pimlico paymaster address (set by sponsorship). */
	paymaster?: string;

	/** Gas limit for paymaster's validatePaymasterUserOp(). */
	paymasterVerificationGasLimit?: bigint;

	/** Gas limit for paymaster's postOp() callback. */
	paymasterPostOpGasLimit?: bigint;

	/** Paymaster-specific validation data (signed by Pimlico). */
	paymasterData?: string;

	/** User's signature over the UserOp hash. */
	signature: string;
}

// =============================================================================
// Gas Estimation
// =============================================================================

/** Gas estimation result from eth_estimateUserOperationGas. */
export interface GasEstimate {
	/** Gas limit for the main execution phase. */
	callGasLimit: bigint;

	/** Gas limit for the verification phase. */
	verificationGasLimit: bigint;

	/** Bundler overhead gas. */
	preVerificationGas: bigint;

	/** EIP-1559 max fee per gas. */
	maxFeePerGas: bigint;

	/** EIP-1559 max priority fee per gas. */
	maxPriorityFeePerGas: bigint;

	/** Paymaster verification gas (present when sponsored). */
	paymasterVerificationGasLimit?: bigint;

	/** Paymaster postOp gas (present when sponsored). */
	paymasterPostOpGasLimit?: bigint;
}

// =============================================================================
// Sponsorship
// =============================================================================

/** Result of a gas sponsorship request to the Pimlico paymaster. */
export interface SponsorshipResult {
	/** Whether the UserOp was approved for gas sponsorship. */
	sponsored: boolean;

	/** Pimlico paymaster contract address (set when sponsored). */
	paymaster?: string;

	/** Signed paymaster data to include in the UserOp (set when sponsored). */
	paymasterData?: string;

	/** Gas limit for paymaster verification (set when sponsored). */
	paymasterVerificationGasLimit?: bigint;

	/** Gas limit for paymaster postOp (set when sponsored). */
	paymasterPostOpGasLimit?: bigint;

	/**
	 * Estimated gas limits from eth_estimateUserOperationGas (set when sponsored).
	 * Callers must merge these into the UserOp before submission to sendUserOperation.
	 */
	callGasLimit?: bigint;
	verificationGasLimit?: bigint;
	preVerificationGas?: bigint;
	maxFeePerGas?: bigint;
	maxPriorityFeePerGas?: bigint;

	/** Human-readable reason if sponsorship was denied. */
	reason?: string;
}

// =============================================================================
// Submission
// =============================================================================

/** Result of submitting a UserOperation to the bundler. */
export interface UserOpResult {
	/** Whether the UserOp was successfully submitted and included. */
	success: boolean;

	/** UserOp hash returned by eth_sendUserOperation. */
	userOpHash?: string;

	/** On-chain transaction hash (available after inclusion). */
	txHash?: string;

	/** Error message if submission failed. */
	error?: string;
}

// =============================================================================
// Sponsorship Policy
// =============================================================================

/**
 * Policy controlling which UserOps qualify for gas sponsorship.
 *
 * The server enforces these constraints before forwarding to Pimlico's
 * paymaster. This prevents abuse (e.g. sponsoring calls to arbitrary
 * contracts or excessive gas consumption).
 */
export interface SponsorshipPolicy {
	/**
	 * Only sponsor calls targeting these contract addresses.
	 * Hex-encoded, checksummed or lowercase. Empty array = deny all.
	 */
	allowedTargets: string[];

	/** Maximum total gas value to sponsor per UserOp (in wei). */
	maxGasPerOp?: bigint;

	/** Maximum UserOps to sponsor per user address per 24-hour window. */
	maxOpsPerUserPerDay?: number;
}
