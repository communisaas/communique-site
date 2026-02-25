/**
 * Browser WASM Position Note Prover Client
 *
 * Lazy-initialized wrapper around @voter-protocol/noir-prover for in-browser
 * ZK proof generation of debate settlement position notes.
 *
 * CIRCUIT SEMANTICS:
 * Proves that the user owns a commitment in the position Merkle tree that:
 *   - Corresponds to the winning argument (argumentIndex == winningArgumentIndex)
 *   - Has not been claimed before (nullifier not yet consumed on-chain)
 *
 * Without revealing which specific commitment in the tree is theirs.
 *
 * PUBLIC INPUT LAYOUT (matches DebateMarket.settleTrade):
 *   [0]  position_root           — Merkle root of position tree (contract-verified)
 *   [1]  nullifier               — H_PNL(nullifierKey, commitment, debateId)
 *   [2]  debate_id               — debate identifier
 *   [3]  winning_argument_index  — resolution outcome (contract-controlled)
 *   [4]  claimed_weighted_amount — amount the payout is proportional to
 *
 * SECURITY INVARIANTS:
 * 1. Prover initialized ONCE and cached — cleared on failure (SA-006 pattern)
 * 2. All bigint inputs validated against BN254 modulus before proving
 * 3. randomness must be non-zero (prevents predictable commitments)
 * 4. nullifierKey must be non-zero (prevents predictable nullifiers)
 * 5. positionPath.length must equal POSITION_TREE_DEPTH (20, fixed by circuit)
 * 6. positionIndex must be in [0, 2^20) (range-checked in circuit)
 * 7. keccak: true ALWAYS used — on-chain verification requires keccak mode
 *
 * CONTROL FLOW:
 *   initializePositionNoteProver() → PositionNoteNoirProver.init()
 *     → prover.generateProof({...}, { keccak: true })
 *       → PositionNoteProofResult { proof, publicInputs[5] }
 *
 * WASM INIT TIME: ~15-40s on first call (position_note circuit is larger
 * than debate_weight). Subsequent calls reuse the cached instance.
 *
 * SharedArrayBuffer: Falls back to single-threaded mode if COOP/COEP headers
 * are absent (handled transparently by the prover via detectThreads()).
 *
 * DOMAIN SEPARATION (critical for security — no cross-circuit hash collisions):
 *   DOMAIN_POS_COMMIT = 0x50434d ("PCM") — position commitment
 *   DOMAIN_POS_NUL    = 0x504e4c ("PNL") — position nullifier
 *   These are computed inside the prover; callers do not need them directly.
 */

import {
	getPositionNoteProver,
	type PositionNoteNoirProver,
	POSITION_NOTE_PUBLIC_INPUT_COUNT,
	POSITION_TREE_DEPTH
} from '$lib/core/crypto/noir-prover-shim';
import { BN254_MODULUS } from '$lib/core/crypto/bn254';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inputs for in-browser position note proof generation.
 *
 * All bigint values must be < BN254_MODULUS. The positionPath array must
 * have exactly 20 elements (POSITION_TREE_DEPTH — fixed by circuit).
 */
export interface PositionNoteProofParams {
	// =========================================================================
	// PRIVATE INPUTS (witnesses, never revealed on-chain)
	// =========================================================================

	/**
	 * Index of the argument this position is on.
	 * Must match winningArgumentIndex for the proof to satisfy the circuit.
	 * Must be < BN254_MODULUS.
	 */
	argumentIndex: bigint;

	/**
	 * Weighted amount from the debate_weight proof (weightedAmount output).
	 * Used to reconstruct the position commitment: H_PCM(argumentIndex, weightedAmount, randomness).
	 * Must be non-zero and < BN254_MODULUS.
	 */
	weightedAmount: bigint;

	/**
	 * Random value used when the position commitment was created (at revealTrade).
	 * Must match the randomness passed to generateDebateWeightProof.
	 * Must be non-zero and < BN254_MODULUS.
	 */
	randomness: bigint;

	/**
	 * User-secret key for nullifier derivation.
	 * Must be non-zero and < BN254_MODULUS.
	 * Derived deterministically per user — prevents double-claim across debates.
	 * nullifier = H_PNL(nullifierKey, commitment, debateId)
	 */
	nullifierKey: bigint;

	/**
	 * Merkle path siblings from the position commitment leaf to the root.
	 * Length must be exactly 20 (POSITION_TREE_DEPTH — fixed by circuit).
	 * Provided by shadow-atlas PositionTreeBuilder.getProof().
	 * Each element must be < BN254_MODULUS.
	 */
	positionPath: bigint[];

	/**
	 * Leaf index of the position commitment in the position tree.
	 * Must be an integer in [0, 2^20) = [0, 1_048_575].
	 * Determines left/right sibling selection at each Merkle level.
	 */
	positionIndex: number;

	// =========================================================================
	// PUBLIC INPUTS (contract-controlled, visible on-chain)
	// =========================================================================

	/**
	 * Root of the position Merkle tree stored on-chain.
	 * The DebateMarket contract verifies this matches its stored root.
	 * Must be < BN254_MODULUS.
	 */
	positionRoot: bigint;

	/**
	 * Identifies which debate this settlement claim is for.
	 * Prevents cross-debate replay: nullifier = H_PNL(nullifierKey, commitment, debateId).
	 * Must be < BN254_MODULUS.
	 */
	debateId: bigint;

	/**
	 * The winning argument index from debate resolution (contract-controlled).
	 * The circuit verifies argumentIndex (private) equals winningArgumentIndex (public).
	 * Must be < BN254_MODULUS.
	 */
	winningArgumentIndex: bigint;
}

/**
 * Result of in-browser position note proof generation.
 *
 * PUBLIC INPUT LAYOUT (matches DebateMarket.settleTrade):
 *   publicInputs[0]  position_root           — Merkle root
 *   publicInputs[1]  nullifier               — H_PNL(nullifierKey, commitment, debateId)
 *   publicInputs[2]  debate_id               — debate identifier
 *   publicInputs[3]  winning_argument_index  — resolution outcome
 *   publicInputs[4]  claimed_weighted_amount — payout weight
 */
export interface PositionNoteProofOutput {
	/** Raw proof bytes (keccak mode, on-chain verifiable). */
	proof: Uint8Array;

	/**
	 * All public inputs as 0x-prefixed hex strings.
	 * Length: 5 (POSITION_NOTE_PUBLIC_INPUT_COUNT).
	 * For direct contract submission: pass this array as publicInputs arg.
	 */
	publicInputs: string[];

	/**
	 * Extracted nullifier as 0x-prefixed hex.
	 * Convenience alias for publicInputs[1].
	 * = H_PNL(nullifierKey, commitment, debateId)
	 * The DebateMarket contract checks this against its consumed nullifier set.
	 */
	nullifier: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVER INITIALIZATION (singleton with SA-006 failure recovery)
// ═══════════════════════════════════════════════════════════════════════════

let positionNoteProverInstance: PositionNoteNoirProver | null = null;
let positionNoteInitPromise: Promise<PositionNoteNoirProver> | null = null;

/**
 * Initialize the position note prover with lazy WASM circuit loading.
 *
 * CONCURRENCY: Safe for concurrent calls — deduplicates initialization via
 * promise caching. A second call while init is in flight returns the same
 * promise.
 *
 * CACHING: Singleton — instance reused across all proof generations in the
 * browser session until page reload or explicit reset.
 *
 * SA-006 FIX: Clears the promise cache on failure so a retry attempt will
 * re-run initialization rather than returning the failed promise indefinitely.
 *
 * INIT TIME WARNING: The position_note circuit is larger than debate_weight.
 * Expect 15-40s on first init. Consider calling this during page load or on
 * "Enter debate" to warm up the backend before the user needs a proof.
 *
 * @param onProgress - Optional string callback for UI stage updates
 */
export async function initializePositionNoteProver(
	onProgress?: (stage: string) => void
): Promise<PositionNoteNoirProver> {
	if (positionNoteProverInstance) {
		return positionNoteProverInstance;
	}

	if (positionNoteInitPromise) {
		return positionNoteInitPromise;
	}

	positionNoteInitPromise = (async () => {
		try {
			onProgress?.('loading');

			const prover = await getPositionNoteProver();

			onProgress?.('initializing');

			positionNoteProverInstance = prover;

			onProgress?.('ready');

			return prover;
		} catch (error) {
			// SA-006: Clear cache on failure to allow retry
			positionNoteInitPromise = null;
			positionNoteProverInstance = null;
			throw error;
		}
	})();

	return positionNoteInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const POSITION_INDEX_MAX = 2 ** POSITION_TREE_DEPTH; // 1_048_576

function validateBigintField(value: bigint, name: string): void {
	if (value < 0n) {
		throw new Error(`${name} cannot be negative`);
	}
	if (value >= BN254_MODULUS) {
		throw new Error(`${name} exceeds BN254 scalar field modulus`);
	}
}

function validatePositionNoteParams(params: PositionNoteProofParams): void {
	// argumentIndex: within field
	validateBigintField(params.argumentIndex, 'argumentIndex');

	// weightedAmount: non-zero, within field
	if (params.weightedAmount === 0n) {
		throw new Error('weightedAmount must be non-zero');
	}
	validateBigintField(params.weightedAmount, 'weightedAmount');

	// randomness: non-zero, within field
	if (params.randomness === 0n) {
		throw new Error('randomness must be non-zero (prevents predictable position commitments)');
	}
	validateBigintField(params.randomness, 'randomness');

	// nullifierKey: non-zero, within field
	if (params.nullifierKey === 0n) {
		throw new Error('nullifierKey must be non-zero (prevents predictable nullifiers)');
	}
	validateBigintField(params.nullifierKey, 'nullifierKey');

	// positionPath: must be exactly POSITION_TREE_DEPTH elements
	if (!Array.isArray(params.positionPath)) {
		throw new Error('positionPath must be an array');
	}
	if (params.positionPath.length !== POSITION_TREE_DEPTH) {
		throw new Error(
			`positionPath must have exactly ${POSITION_TREE_DEPTH} elements ` +
				`(circuit TREE_DEPTH), got ${params.positionPath.length}`
		);
	}
	params.positionPath.forEach((sibling, i) => {
		validateBigintField(sibling, `positionPath[${i}]`);
	});

	// positionIndex: integer in [0, 2^POSITION_TREE_DEPTH)
	if (!Number.isInteger(params.positionIndex)) {
		throw new Error(`positionIndex must be an integer, got ${params.positionIndex}`);
	}
	if (params.positionIndex < 0 || params.positionIndex >= POSITION_INDEX_MAX) {
		throw new Error(
			`positionIndex must be in [0, ${POSITION_INDEX_MAX - 1}] ` +
				`(2^${POSITION_TREE_DEPTH} leaves), got ${params.positionIndex}`
		);
	}

	// positionRoot: within field
	validateBigintField(params.positionRoot, 'positionRoot');

	// debateId: within field
	validateBigintField(params.debateId, 'debateId');

	// winningArgumentIndex: within field
	validateBigintField(params.winningArgumentIndex, 'winningArgumentIndex');
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a position note ZK proof in the browser.
 *
 * Proves ownership of a winning position commitment in the position Merkle
 * tree and issues a one-time nullifier to prevent double-claim.
 *
 * SETTLEMENT FLOW (caller context):
 *   1. User called revealTrade → position commitment inserted into tree
 *   2. Debate resolved → winningArgumentIndex known
 *   3. Caller fetches positionPath + positionIndex from shadow-atlas
 *   4. Call this function → proof + nullifier
 *   5. Submit to DebateMarket.settleTrade(proof, publicInputs)
 *
 * SECURITY:
 * - Validates all inputs before the WASM circuit is invoked
 * - positionPath length strictly enforced at 20 (circuit constant)
 * - randomness and nullifierKey non-zero checks prevent degenerate inputs
 * - All bigint values checked against BN254 modulus
 * - keccak: true always set for on-chain compatibility
 *
 * PERFORMANCE: First call takes ~15-40s (WASM init + Merkle witness).
 * Subsequent calls ~5-15s (proof generation only). Consider prewarming
 * with initializePositionNoteProver() during page load.
 *
 * @param params - Position proof inputs (see PositionNoteProofParams)
 * @param onProgress - Optional callback for UI stage updates ('loading' |
 *   'initializing' | 'ready' | 'generating' | 'complete' | 'error')
 * @returns Proof bytes, all public inputs, and extracted nullifier
 * @throws Error if inputs are invalid or proof generation fails
 */
export async function generatePositionNoteProof(
	params: PositionNoteProofParams,
	onProgress?: (stage: string) => void
): Promise<PositionNoteProofOutput> {
	// Validate before the heavy init() call to fail fast
	validatePositionNoteParams(params);

	const prover = await initializePositionNoteProver(onProgress);

	onProgress?.('generating');

	let result: { proof: Uint8Array; publicInputs: string[] };
	try {
		result = await prover.generateProof(
			{
				argumentIndex: params.argumentIndex,
				weightedAmount: params.weightedAmount,
				randomness: params.randomness,
				nullifierKey: params.nullifierKey,
				positionPath: params.positionPath,
				positionIndex: params.positionIndex,
				positionRoot: params.positionRoot,
				debateId: params.debateId,
				winningArgumentIndex: params.winningArgumentIndex
			},
			{ keccak: true }
		);
	} catch (error) {
		onProgress?.('error');
		throw error;
	}

	if (result.publicInputs.length !== POSITION_NOTE_PUBLIC_INPUT_COUNT) {
		throw new Error(
			`Unexpected public input count from position_note circuit: ` +
				`expected ${POSITION_NOTE_PUBLIC_INPUT_COUNT}, got ${result.publicInputs.length}`
		);
	}

	onProgress?.('complete');

	// publicInputs layout:
	//   [0] position_root, [1] nullifier, [2] debate_id,
	//   [3] winning_argument_index, [4] claimed_weighted_amount
	return {
		proof: result.proof,
		publicInputs: result.publicInputs,
		nullifier: result.publicInputs[1]
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP (for testing and hot module replacement)
// ═══════════════════════════════════════════════════════════════════════════

/** @internal Reset singleton state. Used in tests and HMR. */
export function resetPositionNoteClient(): void {
	positionNoteProverInstance = null;
	positionNoteInitPromise = null;
}
