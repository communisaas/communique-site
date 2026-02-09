/**
 * Proof Generation Store - Svelte 5 Runes
 *
 * Reactive state management for ZK proof generation workflow. Uses Svelte 5's
 * $state runes for fine-grained reactivity without subscriptions.
 *
 * ARCHITECTURE:
 * - Singleton store with reactive getters (no subscriptions needed)
 * - Progress tracking for UI feedback during async operations
 * - Error recovery with explicit reset capability
 * - Prevents concurrent proof generation (one at a time)
 *
 * CONTROL FLOW:
 * initProver() → initializeProver() → prover cached
 * generate() → validateInputs → generateProof() → update state
 *
 * USAGE:
 * ```ts
 * import { getProofState, initProver, generate } from '$lib/stores/proof-generation.svelte';
 *
 * const state = getProofState();
 * await initProver(); // Warm up prover
 * const result = await generate(inputs); // Generate proof
 * ```
 */

import {
	generateProof,
	initializeProver,
	type ProverProgress,
	type ProofResult,
	type ProofInputs
} from '$lib/core/zkp/prover-client';

// ═══════════════════════════════════════════════════════════════════════════
// STATE (Svelte 5 Runes)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Current proof generation progress
 * Updated reactively during prover initialization and proof generation
 */
let progress = $state<ProverProgress>({
	stage: 'loading',
	percent: 0,
	message: ''
});

/**
 * Whether a proof is currently being generated
 * Used to prevent concurrent generation attempts
 */
let isGenerating = $state(false);

/**
 * Error message if proof generation failed
 * Cleared on successful generation or explicit reset
 */
let error = $state<string | null>(null);

/**
 * Generated proof result (null until first successful generation)
 * Contains proof bytes and public inputs for contract submission
 */
let result = $state<ProofResult | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get reactive proof generation state
 *
 * Returns getters that automatically track dependencies in Svelte 5.
 * No subscriptions needed - reactive updates happen automatically.
 *
 * @returns Reactive state object with getters
 *
 * @example
 * ```svelte
 * <script>
 *   const state = getProofState();
 * </script>
 *
 * {#if state.isGenerating}
 *   <ProgressBar percent={state.progress.percent} />
 * {/if}
 * ```
 */
export function getProofState() {
	return {
		get progress() {
			return progress;
		},
		get isGenerating() {
			return isGenerating;
		},
		get error() {
			return error;
		},
		get result() {
			return result;
		}
	};
}

/**
 * Initialize the prover (warm up circuit loading)
 *
 * PERFORMANCE: Call this early (e.g., on app load or route entry) to hide
 * latency from users. The prover takes ~1-2s to initialize on first load.
 *
 * CACHING: Subsequent calls return immediately if already initialized.
 *
 * @throws Error if initialization fails (network, WASM, etc.)
 */
export async function initProver(): Promise<void> {
	error = null;

	try {
		// Initialize depth-20 prover (production default)
		await initializeProver(20, (p) => {
			progress = p;
		});
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		error = errorMessage;
		progress = { stage: 'error', percent: 0, message: errorMessage };
		throw e;
	}
}

/**
 * Generate a ZK proof for district membership
 *
 * CONCURRENCY: Prevents concurrent generation - only one proof at a time.
 * VALIDATION: Inputs validated before proving to fail fast on invalid data.
 * PROGRESS: Updates progress state reactively during generation.
 *
 * @param inputs - Proof inputs (witness data)
 * @returns Generated proof and public inputs
 * @throws Error if generation fails or already in progress
 *
 * @example
 * ```ts
 * const inputs: ProofInputs = {
 *   merkleRoot: "0x1234...",
 *   actionDomain: "0x5678...",
 *   userSecret: "0xabcd...",
 *   districtId: "0xef01...",
 *   authorityLevel: 1,
 *   registrationSalt: "0x2345...",
 *   merklePath: [...], // 20 siblings
 *   leafIndex: 42
 * };
 *
 * const result = await generate(inputs);
 * console.log('Proof:', result.proof);
 * console.log('Nullifier:', result.publicInputs.nullifier);
 * ```
 */
export async function generate(inputs: ProofInputs): Promise<ProofResult> {
	// ───────────────────────────────────────────────────────────────────────
	// PHASE 1: Concurrency check
	// ───────────────────────────────────────────────────────────────────────

	if (isGenerating) {
		throw new Error('Proof generation already in progress');
	}

	isGenerating = true;
	error = null;
	result = null;

	try {
		// ───────────────────────────────────────────────────────────────────
		// PHASE 2: Generate proof with progress tracking
		// ───────────────────────────────────────────────────────────────────

		const proofResult = await generateProof(inputs, (p) => {
			progress = p;
		});

		// ───────────────────────────────────────────────────────────────────
		// PHASE 3: Update state on success
		// ───────────────────────────────────────────────────────────────────

		result = proofResult;
		return proofResult;
	} catch (e) {
		// ───────────────────────────────────────────────────────────────────
		// PHASE 4: Handle errors
		// ───────────────────────────────────────────────────────────────────

		const errorMessage = e instanceof Error ? e.message : String(e);
		error = errorMessage;
		progress = { stage: 'error', percent: 0, message: errorMessage };
		throw e;
	} finally {
		// ───────────────────────────────────────────────────────────────────
		// PHASE 5: Cleanup (always runs, even on error)
		// ───────────────────────────────────────────────────────────────────

		isGenerating = false;
	}
}

/**
 * Reset proof generation state
 *
 * USAGE: Call after navigation, error recovery, or starting new proof flow.
 * Does NOT reset the prover instance itself (remains cached for performance).
 */
export function reset(): void {
	progress = { stage: 'loading', percent: 0, message: '' };
	isGenerating = false;
	error = null;
	result = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DERIVED STATE (computed properties for UI convenience)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if prover is ready to generate proofs
 * @returns true if prover initialized and not currently generating
 */
export function isReady(): boolean {
	const state = getProofState();
	return state.progress.stage === 'ready' && !state.isGenerating;
}

/**
 * Check if initialization or generation failed
 * @returns true if error state
 */
export function hasError(): boolean {
	const state = getProofState();
	return state.progress.stage === 'error' || state.error !== null;
}

/**
 * Check if proof generation completed successfully
 * @returns true if result available
 */
export function isComplete(): boolean {
	const state = getProofState();
	return state.result !== null && state.progress.stage === 'complete';
}
