/**
 * Browser WASM Community Field Prover Client
 *
 * Lazy-initialized wrapper around @voter-protocol/noir-prover for in-browser
 * ZK proof generation of BubbleMembershipProof (community field contribution).
 *
 * CIRCUIT SEMANTICS (~22K constraints):
 *   engagement_data_commitment = H3(tier, action_count, diversity_score)
 *   engagement_leaf = H2(identity_commitment, engagement_data_commitment)
 *   cell_set_root = Merkle(sorted cell_ids, depth=4)
 *   epoch_nullifier = H2(identity_commitment, epoch_domain)
 *
 * Proves: user is a verified person (Tree 3 engagement), their bubble maps
 * to the committed H3 cells, and the epoch nullifier prevents double-contribution.
 *
 * SECURITY INVARIANTS:
 * 1. Prover initialized ONCE and cached — cleared on failure (SA-006 pattern)
 * 2. All bigint inputs validated against BN254 modulus before proving
 * 3. Engagement path length must match ENGAGEMENT_TREE_DEPTH (20)
 * 4. Cell IDs array must be ≤ MAX_CELLS (16), zero-padded
 * 5. identity_commitment must be non-zero (Sybil resistance)
 * 6. keccak: true ALWAYS used — on-chain verification requires keccak mode
 *
 * CONTROL FLOW:
 *   initializeCommunityFieldProver() → CommunityFieldNoirProver.init()
 *     → prover.generateProof({...}, { keccak: true })
 *       → CommunityFieldProofOutput { proof, publicInputs, cellSetRoot, epochNullifier, cellCount }
 *
 * WASM INIT TIME: ~5-15s on first call. Subsequent calls reuse the cached instance.
 *
 * PUBLIC INPUT LAYOUT (from compiled circuit ABI):
 *   publicInputs[0]  engagement_root   — Tree 3 root (checked on-chain)
 *   publicInputs[1]  epoch_domain      — daily epoch tag
 *   publicInputs[2]  cell_set_root     — Merkle root over sorted H3 cells (returned)
 *   publicInputs[3]  epoch_nullifier   — H2(identity_commitment, epoch_domain) (returned)
 *   publicInputs[4]  cell_count        — number of non-zero cells (returned)
 */

import {
	getCommunityFieldProver,
	type CommunityFieldNoirProver,
	type CommunityFieldProofInput,
	COMMUNITY_FIELD_PUBLIC_INPUT_COUNT,
	ENGAGEMENT_TREE_DEPTH
} from '$lib/core/crypto/noir-prover-shim';
import { BN254_MODULUS } from '$lib/core/crypto/bn254';
import { MAX_CELLS } from '$lib/core/bubble/h3-cells';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inputs for in-browser community field proof generation.
 * All hex strings must be 0x-prefixed and represent valid BN254 field elements.
 */
export interface CommunityFieldProofParams {
	/** Identity commitment from verification provider (non-zero). */
	identityCommitment: string;

	/** Tree 3 engagement tier (0-4). */
	engagementTier: number;

	/** Tree 3 cumulative action count. */
	actionCount: string;

	/** Tree 3 Shannon diversity score. */
	diversityScore: string;

	/** Tree 3 Merkle siblings (length = ENGAGEMENT_TREE_DEPTH = 20). */
	engagementPath: string[];

	/** Tree 3 leaf position. */
	engagementIndex: number;

	/** Sorted H3 cell IDs as field elements (≤ MAX_CELLS, zero-padded to 16). */
	cellIds: string[];

	/** Actual cell count before padding (≤ MAX_CELLS). */
	cellCount: number;

	/** Tree 3 root (verified against EngagementRootRegistry on-chain). */
	engagementRoot: string;

	/** Daily epoch domain from buildCommunityFieldEpochDomain(). */
	epochDomain: string;
}

/**
 * Result of community field proof generation.
 *
 * PUBLIC INPUT LAYOUT (compiled circuit ABI):
 *   publicInputs[0]  engagement_root
 *   publicInputs[1]  epoch_domain
 *   publicInputs[2]  cell_set_root     (circuit return)
 *   publicInputs[3]  epoch_nullifier   (circuit return)
 *   publicInputs[4]  cell_count        (circuit return)
 */
export interface CommunityFieldProofOutput {
	/** Raw proof bytes (keccak mode, on-chain verifiable). */
	proof: Uint8Array;

	/** All public inputs/outputs as 0x-prefixed hex (length: 5). */
	publicInputs: string[];

	/** Convenience: Poseidon Merkle root over sorted H3 cells (publicInputs[2]). */
	cellSetRoot: string;

	/** Convenience: H2(identity_commitment, epoch_domain) (publicInputs[3]). */
	epochNullifier: string;

	/** Convenience: number of non-zero cells (publicInputs[4]). */
	cellCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVER INITIALIZATION (singleton with SA-006 failure recovery)
// ═══════════════════════════════════════════════════════════════════════════

let communityFieldProverInstance: CommunityFieldNoirProver | null = null;
let communityFieldInitPromise: Promise<CommunityFieldNoirProver> | null = null;

/**
 * Initialize the community field prover with lazy WASM circuit loading.
 *
 * CONCURRENCY: Safe for concurrent calls — deduplicates initialization.
 * CACHING: Singleton — reused across proof generations in the session.
 * SA-006 FIX: Clears cache on failure to allow retry.
 *
 * @param onProgress - Optional string callback for UI stage updates
 */
export async function initializeCommunityFieldProver(
	onProgress?: (stage: string) => void
): Promise<CommunityFieldNoirProver> {
	if (communityFieldProverInstance) {
		return communityFieldProverInstance;
	}

	if (communityFieldInitPromise) {
		return communityFieldInitPromise;
	}

	communityFieldInitPromise = (async () => {
		try {
			onProgress?.('loading');

			const prover = await getCommunityFieldProver();

			onProgress?.('initializing');

			communityFieldProverInstance = prover;

			onProgress?.('ready');

			return prover;
		} catch (error) {
			// SA-006: Clear cache on failure to allow retry
			communityFieldInitPromise = null;
			communityFieldProverInstance = null;
			throw error;
		}
	})();

	return communityFieldInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validateFieldElement(value: string, name: string): void {
	try {
		const bigValue = BigInt(value);
		if (bigValue < 0n) {
			throw new Error(`${name} cannot be negative`);
		}
		if (bigValue >= BN254_MODULUS) {
			throw new Error(`${name} exceeds BN254 field modulus`);
		}
	} catch (error) {
		if (error instanceof Error && (error.message.includes('field modulus') || error.message.includes('negative'))) {
			throw error;
		}
		throw new Error(`${name} is not a valid field element: ${value}`);
	}
}

function validateCommunityFieldParams(params: CommunityFieldProofParams): void {
	// Identity commitment: non-zero, valid field element
	validateFieldElement(params.identityCommitment, 'identityCommitment');
	if (BigInt(params.identityCommitment) === 0n) {
		throw new Error('identityCommitment cannot be zero (required for Sybil prevention)');
	}

	// Engagement tier: integer 0-4
	if (!Number.isInteger(params.engagementTier) || params.engagementTier < 0 || params.engagementTier > 4) {
		throw new Error(`engagementTier must be an integer in [0, 4], got ${params.engagementTier}`);
	}

	// Engagement leaf data
	validateFieldElement(params.actionCount, 'actionCount');
	validateFieldElement(params.diversityScore, 'diversityScore');

	// Engagement path: length must match tree depth
	if (!Array.isArray(params.engagementPath)) {
		throw new Error('engagementPath must be an array');
	}
	if (params.engagementPath.length !== ENGAGEMENT_TREE_DEPTH) {
		throw new Error(
			`engagementPath must have ${ENGAGEMENT_TREE_DEPTH} siblings, got ${params.engagementPath.length}`
		);
	}
	params.engagementPath.forEach((sibling, i) => {
		validateFieldElement(sibling, `engagementPath[${i}]`);
	});

	// Engagement index
	if (!Number.isInteger(params.engagementIndex) || params.engagementIndex < 0) {
		throw new Error(`engagementIndex must be a non-negative integer, got ${params.engagementIndex}`);
	}
	if (params.engagementIndex >= 2 ** ENGAGEMENT_TREE_DEPTH) {
		throw new Error(
			`engagementIndex ${params.engagementIndex} out of range for depth-${ENGAGEMENT_TREE_DEPTH} tree`
		);
	}

	// Cell IDs: ≤ MAX_CELLS, valid field elements
	if (!Array.isArray(params.cellIds)) {
		throw new Error('cellIds must be an array');
	}
	if (params.cellIds.length > MAX_CELLS) {
		throw new Error(`cellIds length ${params.cellIds.length} exceeds MAX_CELLS (${MAX_CELLS})`);
	}
	params.cellIds.forEach((cell, i) => {
		validateFieldElement(cell, `cellIds[${i}]`);
	});

	// Cell count
	if (!Number.isInteger(params.cellCount) || params.cellCount < 0) {
		throw new Error(`cellCount must be a non-negative integer, got ${params.cellCount}`);
	}
	if (params.cellCount > MAX_CELLS) {
		throw new Error(`cellCount ${params.cellCount} exceeds MAX_CELLS (${MAX_CELLS})`);
	}
	if (params.cellCount === 0) {
		throw new Error('cellCount must be at least 1 (bubble must intersect at least one cell)');
	}

	// Public inputs
	validateFieldElement(params.engagementRoot, 'engagementRoot');
	validateFieldElement(params.epochDomain, 'epochDomain');
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

const ZERO_FIELD = '0x' + '0'.padStart(64, '0');

/**
 * Generate a community field ZK proof in the browser.
 *
 * Proves:
 *   1. User is a verified person (Tree 3 engagement membership)
 *   2. Cell set matches the committed root (depth-4 Merkle)
 *   3. Epoch nullifier prevents double-contribution per epoch
 *
 * without revealing identity_commitment, engagement data, or cell IDs on-chain.
 *
 * PERFORMANCE: First call ~5-15s (WASM init). Subsequent: 5-8s desktop, 15-30s mobile.
 *
 * @param params - Community field proof inputs (see CommunityFieldProofParams)
 * @param onProgress - Optional stage callback ('loading'|'initializing'|'ready'|'generating'|'complete'|'error')
 * @returns Proof bytes and extracted public inputs/outputs
 */
export async function generateCommunityFieldProof(
	params: CommunityFieldProofParams,
	onProgress?: (stage: string) => void
): Promise<CommunityFieldProofOutput> {
	// Validate before heavy init to fail fast
	validateCommunityFieldParams(params);

	const prover = await initializeCommunityFieldProver(onProgress);

	onProgress?.('generating');

	// Zero-pad cell IDs to MAX_CELLS for circuit's fixed-size array
	const paddedCellIds: bigint[] = params.cellIds.map((c) => BigInt(c));
	while (paddedCellIds.length < MAX_CELLS) {
		paddedCellIds.push(0n);
	}

	const circuitInput: CommunityFieldProofInput = {
		identityCommitment: BigInt(params.identityCommitment),
		engagementTier: BigInt(params.engagementTier),
		actionCount: BigInt(params.actionCount),
		diversityScore: BigInt(params.diversityScore),
		engagementPath: params.engagementPath.map((p) => BigInt(p)),
		engagementIndex: params.engagementIndex,
		cellIds: paddedCellIds,
		cellCount: params.cellCount,
		engagementRoot: BigInt(params.engagementRoot),
		epochDomain: BigInt(params.epochDomain)
	};

	let result: { proof: Uint8Array; publicInputs: string[] };
	try {
		result = await prover.generateProof(circuitInput, { keccak: true });
	} catch (error) {
		onProgress?.('error');
		throw error;
	}

	if (result.publicInputs.length !== COMMUNITY_FIELD_PUBLIC_INPUT_COUNT) {
		throw new Error(
			`Unexpected public input count from bubble_membership circuit: ` +
				`expected ${COMMUNITY_FIELD_PUBLIC_INPUT_COUNT}, got ${result.publicInputs.length}`
		);
	}

	onProgress?.('complete');

	return {
		proof: result.proof,
		publicInputs: result.publicInputs,
		cellSetRoot: result.publicInputs[2],
		epochNullifier: result.publicInputs[3],
		cellCount: Number(BigInt(result.publicInputs[4]))
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP (for testing and hot module replacement)
// ═══════════════════════════════════════════════════════════════════════════

/** @internal Reset singleton state. Used in tests and HMR. */
export function resetCommunityFieldClient(): void {
	communityFieldProverInstance = null;
	communityFieldInitPromise = null;
}
