/**
 * Browser WASM Debate Weight Prover Client
 *
 * Lazy-initialized wrapper around @voter-protocol/noir-prover for in-browser
 * ZK proof generation of debate position weight.
 *
 * CIRCUIT SEMANTICS:
 *   weightedAmount = floor(sqrt(stake)) * 2^tier
 *   noteCommitment = H3(stake, tier, randomness)   [Poseidon2, DOMAIN_HASH3]
 *
 * Only weightedAmount and noteCommitment are revealed on-chain. Stake and
 * tier remain private.
 *
 * SECURITY INVARIANTS:
 * 1. Prover initialized ONCE and cached — cleared on failure (SA-006 pattern)
 * 2. All bigint inputs validated against BN254 modulus before proving
 * 3. stake must be non-zero and <= u64 max (circuit arithmetic constraint)
 * 4. randomness must be non-zero (prevents predictable note commitments)
 * 5. tier must be 1-4 (tier 0 rejected by DebateMarket contract)
 * 6. keccak: true ALWAYS used — on-chain verification requires keccak mode
 *
 * CONTROL FLOW:
 *   initializeDebateWeightProver() → DebateWeightNoirProver.init()
 *     → prover.generateProof({...}, { keccak: true })
 *       → DebateWeightProofResult { proof, publicInputs[2] }
 *
 * WASM INIT TIME: ~5-15s on first call (circuit + backend initialization).
 * Subsequent calls reuse the cached instance.
 *
 * SharedArrayBuffer: Falls back to single-threaded mode if COOP/COEP headers
 * are absent (handled transparently by the prover via detectThreads()).
 */

import {
	getDebateWeightProver,
	type DebateWeightNoirProver,
	DEBATE_WEIGHT_PUBLIC_INPUT_COUNT
} from '$lib/core/crypto/noir-prover-shim';
import { BN254_MODULUS } from '$lib/core/crypto/bn254';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inputs for in-browser debate weight proof generation.
 *
 * All bigint values must be < BN254_MODULUS
 * (21888242871839275222246405745257275088548364400416034343698204186575808495617n).
 */
export interface DebateWeightProofParams {
	/**
	 * USDC stake amount (6 decimals, e.g., 25_000_000n = $25 USDC).
	 * Must be > 0 and <= 2^64 - 1 (circuit u64 constraint).
	 * Max: 100_000_000n ($100 USDC per DebateMarket.MAX_STAKE).
	 */
	stake: bigint;

	/**
	 * User's engagement tier (1-4).
	 * Determines the 2^tier weight multiplier.
	 * Tier 0 is rejected by the DebateMarket contract on-chain.
	 */
	tier: 1 | 2 | 3 | 4;

	/**
	 * 128-bit random value for note commitment entropy.
	 * Must be non-zero. Must be < BN254_MODULUS.
	 * Generate with: crypto.getRandomValues(new Uint8Array(16)) → BigInt.
	 */
	randomness: bigint;
}

/**
 * Result of in-browser debate weight proof generation.
 *
 * PUBLIC INPUT LAYOUT (matches DebateMarket.revealTrade):
 *   publicInputs[0]  weighted_amount  — floor(sqrt(stake)) * 2^tier
 *   publicInputs[1]  note_commitment  — H3(stake, tier, randomness)
 */
export interface DebateWeightProofOutput {
	/** Raw proof bytes (keccak mode, on-chain verifiable). */
	proof: Uint8Array;

	/**
	 * All public inputs as 0x-prefixed hex strings.
	 * Length: 2 (DEBATE_WEIGHT_PUBLIC_INPUT_COUNT).
	 * For direct contract submission: pass this array as publicInputs arg.
	 */
	publicInputs: string[];

	/**
	 * Extracted weighted amount as 0x-prefixed hex.
	 * Convenience alias for publicInputs[0].
	 * = floor(sqrt(stake)) * 2^tier
	 */
	weightedAmount: string;

	/**
	 * Extracted note commitment as 0x-prefixed hex.
	 * Convenience alias for publicInputs[1].
	 * = H3(stake, tier, randomness) — binds the position without revealing inputs.
	 */
	noteCommitment: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVER INITIALIZATION (singleton with SA-006 failure recovery)
// ═══════════════════════════════════════════════════════════════════════════

let debateWeightProverInstance: DebateWeightNoirProver | null = null;
let debateWeightInitPromise: Promise<DebateWeightNoirProver> | null = null;

/**
 * Initialize the debate weight prover with lazy WASM circuit loading.
 *
 * CONCURRENCY: Safe for concurrent calls — deduplicates initialization via
 * promise caching. A second call while init is in flight returns the same
 * promise, not a second init.
 *
 * CACHING: Singleton — instance reused across all proof generations in the
 * browser session until page reload or explicit reset.
 *
 * SA-006 FIX: Clears the promise cache on failure so a retry attempt will
 * re-run initialization rather than returning the failed promise indefinitely.
 *
 * SharedArrayBuffer availability is handled internally by the prover:
 * if COOP/COEP headers are absent, it silently falls back to 1 thread.
 *
 * @param onProgress - Optional string callback for UI stage updates
 */
export async function initializeDebateWeightProver(
	onProgress?: (stage: string) => void
): Promise<DebateWeightNoirProver> {
	if (debateWeightProverInstance) {
		return debateWeightProverInstance;
	}

	if (debateWeightInitPromise) {
		return debateWeightInitPromise;
	}

	debateWeightInitPromise = (async () => {
		try {
			onProgress?.('loading');

			const prover = await getDebateWeightProver();

			onProgress?.('initializing');

			debateWeightProverInstance = prover;

			onProgress?.('ready');

			return prover;
		} catch (error) {
			// SA-006: Clear cache on failure to allow retry
			debateWeightInitPromise = null;
			debateWeightProverInstance = null;
			throw error;
		}
	})();

	return debateWeightInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const U64_MAX = 2n ** 64n - 1n;

function validateDebateWeightParams(params: DebateWeightProofParams): void {
	// stake: non-zero, within u64, within BN254 field
	if (params.stake === 0n) {
		throw new Error('stake must be non-zero');
	}
	if (params.stake < 0n) {
		throw new Error('stake cannot be negative');
	}
	if (params.stake > U64_MAX) {
		throw new Error(
			`stake (${params.stake}) exceeds u64 max (${U64_MAX}). ` +
				`Max USDC stake is $100 = 100_000_000.`
		);
	}
	if (params.stake >= BN254_MODULUS) {
		throw new Error('stake exceeds BN254 scalar field modulus');
	}

	// tier: integer 1-4
	if (!Number.isInteger(params.tier) || params.tier < 1 || params.tier > 4) {
		throw new Error(
			`tier must be an integer in [1, 4], got ${params.tier}. ` +
				`Tier 0 is rejected by the DebateMarket contract.`
		);
	}

	// randomness: non-zero, within BN254 field
	if (params.randomness === 0n) {
		throw new Error('randomness must be non-zero (prevents predictable note commitments)');
	}
	if (params.randomness < 0n) {
		throw new Error('randomness cannot be negative');
	}
	if (params.randomness >= BN254_MODULUS) {
		throw new Error('randomness exceeds BN254 scalar field modulus');
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a debate weight ZK proof in the browser.
 *
 * Proves that:
 *   weightedAmount = floor(sqrt(stake)) * 2^tier
 *   noteCommitment = H3(stake, tier, randomness)
 *
 * without revealing stake or tier on-chain.
 *
 * SECURITY:
 * - Validates all inputs before passing to the circuit
 * - stake checked against u64 max and BN254 modulus
 * - randomness non-zero check prevents predictable commitments
 * - tier range [1, 4] enforced (DebateMarket rejects tier 0)
 * - keccak: true always set for on-chain compatibility
 *
 * PERFORMANCE: First call takes ~5-15s (WASM init). Subsequent calls
 * on the same prover instance take ~2-8s (proof generation only).
 *
 * @param params - Stake, tier, and randomness for the debate position
 * @param onProgress - Optional callback for UI stage updates ('loading' |
 *   'initializing' | 'ready' | 'generating' | 'complete' | 'error')
 * @returns Proof bytes and extracted public inputs
 * @throws Error if inputs are invalid or proof generation fails
 */
export async function generateDebateWeightProof(
	params: DebateWeightProofParams,
	onProgress?: (stage: string) => void
): Promise<DebateWeightProofOutput> {
	// Validate before the heavy init() call to fail fast
	validateDebateWeightParams(params);

	const prover = await initializeDebateWeightProver(onProgress);

	onProgress?.('generating');

	let result: { proof: Uint8Array; publicInputs: string[] };
	try {
		result = await prover.generateProof(
			{
				stake: params.stake,
				tier: params.tier,
				randomness: params.randomness
			},
			{ keccak: true }
		);
	} catch (error) {
		onProgress?.('error');
		throw error;
	}

	if (result.publicInputs.length !== DEBATE_WEIGHT_PUBLIC_INPUT_COUNT) {
		throw new Error(
			`Unexpected public input count from debate_weight circuit: ` +
				`expected ${DEBATE_WEIGHT_PUBLIC_INPUT_COUNT}, got ${result.publicInputs.length}`
		);
	}

	onProgress?.('complete');

	return {
		proof: result.proof,
		publicInputs: result.publicInputs,
		weightedAmount: result.publicInputs[0],
		noteCommitment: result.publicInputs[1]
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP (for testing and hot module replacement)
// ═══════════════════════════════════════════════════════════════════════════

/** @internal Reset singleton state. Used in tests and HMR. */
export function resetDebateWeightClient(): void {
	debateWeightProverInstance = null;
	debateWeightInitPromise = null;
}
