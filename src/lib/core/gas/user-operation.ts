/**
 * UserOperation construction helpers — client-safe.
 *
 * Builds ERC-4337 UserOperations for debate market contract calls.
 * Encodes function calls using ethers v6 Interface and wraps them in
 * the smart account's execute() format.
 *
 * CLIENT-SAFE: No env vars, no server-only imports. Pure data construction.
 *
 * @see types.ts      — UserOperation type definition
 * @see pimlico.ts    — server-side bundler/paymaster (sponsors gas)
 * @see debate-client.ts (wallet/) — legacy client-side direct submission
 */

import { Interface } from 'ethers';
import type { UserOperation } from './types';
import { DEBATE_MARKET_ADDRESS } from '$lib/core/contracts';

// Re-export so any downstream code importing from here doesn't break.
export { DEBATE_MARKET_ADDRESS };

// =============================================================================
// ABIs
// =============================================================================

/** Minimal DebateMarket ABI for UserOp construction. */
const DEBATE_MARKET_ABI = [
	'function submitArgument(bytes32 debateId, uint8 stance, bytes32 bodyHash, bytes32 amendmentHash, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)',
	'function coSignArgument(bytes32 debateId, uint256 argumentIndex, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)'
];

/**
 * Simple Account execute() ABI.
 *
 * ERC-4337 smart accounts wrap target calls in execute(dest, value, func).
 * This is the standard interface used by SimpleAccount, Kernel, Safe, etc.
 */
const ACCOUNT_EXECUTE_ABI = [
	'function execute(address dest, uint256 value, bytes func)'
];

const debateMarketIface = new Interface(DEBATE_MARKET_ABI);
const accountIface = new Interface(ACCOUNT_EXECUTE_ABI);

// =============================================================================
// Generic UserOp Builder
// =============================================================================

/**
 * Build a UserOperation for a contract call.
 *
 * Wraps the target call in the smart account's execute(dest, value, func)
 * format. Gas fields are left as zero — they must be filled by
 * estimateUserOperationGas() before submission.
 *
 * @param params.sender - Smart account address
 * @param params.target - Contract to call (e.g. DebateMarket address)
 * @param params.callData - ABI-encoded function call on the target
 * @param params.nonce - Smart account nonce (if known)
 * @param params.value - ETH value to send with the call (default: 0)
 * @returns Partial UserOperation ready for gas estimation and signing
 */
export function buildUserOperation(params: {
	sender: string;
	target: string;
	callData: string;
	nonce?: bigint;
	value?: bigint;
}): Partial<UserOperation> {
	// Wrap the target call in execute(dest, value, func)
	const executeCallData = accountIface.encodeFunctionData('execute', [
		params.target,
		params.value ?? 0n,
		params.callData
	]);

	return {
		sender: params.sender,
		nonce: params.nonce ?? 0n,
		callData: executeCallData,
		callGasLimit: 0n,
		verificationGasLimit: 0n,
		preVerificationGas: 0n,
		maxFeePerGas: 0n,
		maxPriorityFeePerGas: 0n,
		signature: '0x'  // Placeholder — replaced after signing the UserOp hash
	};
}

// =============================================================================
// DebateMarket.submitArgument UserOp
// =============================================================================

/** Parameters for building a submitArgument UserOp. */
export interface SubmitArgumentParams {
	/** Smart account address (the ERC-4337 account submitting the UserOp). */
	sender: string;
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;
	/** Argument stance: 0=SUPPORT, 1=OPPOSE, 2=AMEND. */
	stance: number;
	/** keccak256 of the argument body text (bytes32). */
	bodyHash: string;
	/** keccak256 of the amendment text, or bytes32(0) if no amendment. */
	amendmentHash: string;
	/** Stake amount in ERC-20 token smallest unit (e.g. 6 decimals for USDC). */
	stakeAmount: bigint;
	/** Address of the EIP-712 proof signer. */
	signerAddress: string;
	/** Hex-encoded ZK proof bytes. */
	proof: string;
	/** 31 public inputs as bigints. */
	publicInputs: bigint[];
	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;
	/** EIP-712 authorization deadline (unix timestamp). */
	deadline: number;
	/** EIP-712 authorization signature (hex). */
	signature: string;
	/** Address receiving settlement proceeds. */
	beneficiary: string;
}

/**
 * Build a UserOp for DebateMarket.submitArgument().
 *
 * Encodes the submitArgument call and wraps it in the
 * smart account's execute() format.
 *
 * NOTE: ERC-20 token approval must be handled separately before
 * submitting this UserOp (the smart account must have approved
 * the DebateMarket to spend stakeAmount of the staking token).
 *
 * @param params - All parameters for the submitArgument call
 * @returns Partial UserOperation ready for gas estimation
 */
export function buildSubmitArgumentUserOp(params: SubmitArgumentParams): Partial<UserOperation> {
	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;

	// Pad publicInputs to exactly 31 elements
	const publicInputs = padPublicInputs(params.publicInputs);

	const innerCallData = debateMarketIface.encodeFunctionData('submitArgument', [
		params.debateId,
		params.stance,
		params.bodyHash,
		params.amendmentHash,
		params.stakeAmount,
		params.signerAddress,
		proofBytes,
		publicInputs,
		params.verifierDepth,
		params.deadline,
		params.signature,
		params.beneficiary
	]);

	return buildUserOperation({
		sender: params.sender,
		target: DEBATE_MARKET_ADDRESS,
		callData: innerCallData,
		value: 0n
	});
}

// =============================================================================
// DebateMarket.coSignArgument UserOp
// =============================================================================

/** Parameters for building a coSignArgument UserOp. */
export interface CoSignArgumentParams {
	/** Smart account address (the ERC-4337 account submitting the UserOp). */
	sender: string;
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;
	/** Index of the argument to co-sign (0-based). */
	argumentIndex: number;
	/** Stake amount in ERC-20 token smallest unit (e.g. 6 decimals for USDC). */
	stakeAmount: bigint;
	/** Address of the EIP-712 proof signer. */
	signerAddress: string;
	/** Hex-encoded ZK proof bytes. */
	proof: string;
	/** 31 public inputs as bigints. */
	publicInputs: bigint[];
	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;
	/** EIP-712 authorization deadline (unix timestamp). */
	deadline: number;
	/** EIP-712 authorization signature (hex). */
	signature: string;
	/** Address receiving settlement proceeds. */
	beneficiary: string;
}

/**
 * Build a UserOp for DebateMarket.coSignArgument().
 *
 * Encodes the coSignArgument call and wraps it in the
 * smart account's execute() format.
 *
 * NOTE: ERC-20 token approval must be handled separately before
 * submitting this UserOp (the smart account must have approved
 * the DebateMarket to spend stakeAmount of the staking token).
 *
 * @param params - All parameters for the coSignArgument call
 * @returns Partial UserOperation ready for gas estimation
 */
export function buildCoSignArgumentUserOp(params: CoSignArgumentParams): Partial<UserOperation> {
	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;

	// Pad publicInputs to exactly 31 elements
	const publicInputs = padPublicInputs(params.publicInputs);

	const innerCallData = debateMarketIface.encodeFunctionData('coSignArgument', [
		params.debateId,
		params.argumentIndex,
		params.stakeAmount,
		params.signerAddress,
		proofBytes,
		publicInputs,
		params.verifierDepth,
		params.deadline,
		params.signature,
		params.beneficiary
	]);

	return buildUserOperation({
		sender: params.sender,
		target: DEBATE_MARKET_ADDRESS,
		callData: innerCallData,
		value: 0n
	});
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Pad publicInputs array to exactly 31 elements.
 *
 * The three-tree circuit produces 31 public inputs. If fewer are provided,
 * the remaining slots are filled with 0n. If more are provided, excess
 * elements are truncated.
 */
function padPublicInputs(inputs: bigint[]): bigint[] {
	const EXPECTED_COUNT = 31;

	if (inputs.length === EXPECTED_COUNT) {
		return inputs;
	}

	if (inputs.length > EXPECTED_COUNT) {
		console.warn(
			`[gas/user-operation] publicInputs has ${inputs.length} elements, truncating to ${EXPECTED_COUNT}`
		);
		return inputs.slice(0, EXPECTED_COUNT);
	}

	// Pad with zeros
	const padded = [...inputs];
	while (padded.length < EXPECTED_COUNT) {
		padded.push(0n);
	}
	return padded;
}
