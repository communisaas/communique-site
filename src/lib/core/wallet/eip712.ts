/**
 * Pure EIP-712 typed data construction for DistrictGate proof authorization.
 *
 * This module constructs the EIP-712 domain, types, and values for the
 * SubmitThreeTreeProof authorization signature. It does NOT sign anything —
 * signing is handled by the WalletProvider implementation.
 *
 * RUNS ON BOTH CLIENT AND SERVER — no $env imports, no ethers.Wallet.
 * Uses ethers for keccak256/solidityPacked hashing only.
 *
 * Usage:
 *   const { domain, types, value } = buildProofAuthorizationData(params);
 *   const signature = await walletProvider.signTypedData(domain, types, value);
 *
 * @see DistrictGate.sol § verifyThreeTreeProof — contract-side verification
 * @see district-gate-client.ts § buildEIP712Signature — legacy server-side equivalent
 */

import { keccak256, solidityPacked } from 'ethers';
import type {
	ProofAuthorizationParams,
	EIP712Domain,
	EIP712TypeField
} from './types';
import { DISTRICT_GATE_EIP712_TYPES } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Number of public inputs in the three-tree circuit. */
export const THREE_TREE_PUBLIC_INPUT_COUNT = 31;

/** Valid circuit depths for verifier selection. */
export const VALID_VERIFIER_DEPTHS = [18, 20, 22, 24] as const;

/** Default deadline: 1 hour from now. */
const DEFAULT_DEADLINE_SECONDS = 3600;

/** Indices into the 31-element public inputs array. */
export const PUBLIC_INPUT_INDEX = {
	USER_ROOT: 0,
	CELL_MAP_ROOT: 1,
	DISTRICTS_START: 2,
	DISTRICTS_END: 25,
	NULLIFIER: 26,
	ACTION_DOMAIN: 27,
	AUTHORITY_LEVEL: 28,
	ENGAGEMENT_ROOT: 29,
	ENGAGEMENT_TIER: 30
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CORE: Build EIP-712 typed data for proof authorization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construct the EIP-712 domain, types, and value for proof authorization.
 *
 * The caller passes this to `walletProvider.signTypedData(domain, types, value)`
 * to get the authorization signature. The contract verifies:
 *   ECDSA.recover(hashStruct(domain, types, value), signature) == signer
 *
 * @param params — Proof parameters including chainId, contract address, and nonce
 * @returns { domain, types, value } ready for signTypedData
 */
export function buildProofAuthorizationData(params: ProofAuthorizationParams): {
	domain: EIP712Domain;
	types: Record<string, EIP712TypeField[]>;
	value: Record<string, unknown>;
} {
	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;
	const proofHash = keccak256(proofBytes);

	const publicInputsAsBigInt = params.publicInputs.map((v) => BigInt(v));
	const publicInputsPacked = solidityPacked(
		Array(THREE_TREE_PUBLIC_INPUT_COUNT).fill('uint256'),
		publicInputsAsBigInt
	);
	const publicInputsHash = keccak256(publicInputsPacked);

	const domain: EIP712Domain = {
		name: 'DistrictGate',
		version: '1',
		chainId: params.chainId,
		verifyingContract: params.districtGateAddress
	};

	const value = {
		proofHash,
		publicInputsHash,
		verifierDepth: params.verifierDepth,
		nonce: params.nonce,
		deadline: params.deadline
	};

	return {
		domain,
		types: { ...DISTRICT_GATE_EIP712_TYPES },
		value
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/** BN254 scalar field modulus — public inputs must be < this value. */
const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

/**
 * Validate proof inputs shared by all proof-bearing contract calls.
 * Returns null if valid, error string if invalid.
 */
export function validateProofInputs(
	proof: string,
	publicInputs: string[],
	verifierDepth: number
): string | null {
	if (publicInputs.length !== THREE_TREE_PUBLIC_INPUT_COUNT) {
		return `Expected ${THREE_TREE_PUBLIC_INPUT_COUNT} public inputs, got ${publicInputs.length}`;
	}

	const proofRaw = proof.startsWith('0x') ? proof.slice(2) : proof;
	if (!proofRaw || proofRaw.length === 0) {
		return 'Proof is empty';
	}
	if (!/^[0-9a-fA-F]+$/.test(proofRaw)) {
		return 'Proof contains invalid hex characters';
	}

	if (!(VALID_VERIFIER_DEPTHS as readonly number[]).includes(verifierDepth)) {
		return `Invalid verifierDepth ${verifierDepth}. Must be one of: ${VALID_VERIFIER_DEPTHS.join(', ')}`;
	}

	for (let i = 0; i < publicInputs.length; i++) {
		try {
			const val = BigInt(publicInputs[i]);
			if (val < 0n || val >= BN254_MODULUS) {
				return `Public input [${i}] out of BN254 field range`;
			}
		} catch {
			return `Public input [${i}] is not a valid integer or hex string`;
		}
	}

	return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a default deadline (1 hour from now) as a Unix timestamp.
 */
export function defaultDeadline(): number {
	return Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS;
}

/**
 * Convert public inputs from hex strings to BigInt array.
 * Used by both client-side signing and server-side contract calls.
 */
export function publicInputsToBigInt(publicInputs: string[]): bigint[] {
	return publicInputs.map((v) => BigInt(v));
}
