/**
 * Noir Prover Shim
 *
 * Provides runtime-safe factory functions for all circuit provers used in
 * communique. Each factory tries the npm package (@voter-protocol/noir-prover)
 * first, then fails with a clear error if the export is unavailable.
 *
 * HISTORY:
 * - Originally shimmed three-tree because @voter-protocol/noir-prover@0.2.0
 *   only exported two-tree. The npm package now exports all provers, but
 *   the shim is retained as a stable internal interface and fallback boundary.
 * - Debate weight and position note provers added (Cycle 18).
 *
 * When this shim becomes unnecessary (all provers stable in npm), delete it
 * and import directly from '@voter-protocol/noir-prover'.
 */

// Re-export everything the npm package DOES provide
export type { CircuitDepth } from '@voter-protocol/noir-prover';

/** Number of public inputs in three-tree circuit (29 two-tree + engagement_root + engagement_tier) */
export const THREE_TREE_PUBLIC_INPUT_COUNT = 31;

/** Three-tree proof input — matches Noir circuit interface */
export interface ThreeTreeProofInput {
	// Public inputs
	userRoot: bigint;
	cellMapRoot: bigint;
	districts: bigint[];
	nullifier: bigint;
	actionDomain: bigint;
	authorityLevel: 1 | 2 | 3 | 4 | 5;
	engagementRoot: bigint;
	engagementTier: 0 | 1 | 2 | 3 | 4;

	// Private inputs
	userSecret: bigint;
	cellId: bigint;
	registrationSalt: bigint;
	identityCommitment: bigint;

	// Tree 1 proof
	userPath: bigint[];
	userIndex: number;

	// Tree 2 proof (SMT)
	cellMapPath: bigint[];
	cellMapPathBits: number[];

	// Tree 3 proof (engagement)
	engagementPath: bigint[];
	engagementIndex: number;
	actionCount: bigint;
	diversityScore: bigint;
}

/** Three-tree proof result */
export interface ThreeTreeProofResult {
	proof: Uint8Array;
	publicInputs: string[];
}

/** Three-tree prover interface */
export interface ThreeTreeNoirProver {
	generateProof(
		input: ThreeTreeProofInput,
		options?: { keccak?: boolean }
	): Promise<ThreeTreeProofResult>;
	destroy(): void;
}

/**
 * Get a three-tree prover for the specified depth.
 *
 * Tries the npm package first (for when it's updated with three-tree).
 * Falls back to a clear error message.
 */
export async function getThreeTreeProverForDepth(
	depth: 18 | 20 | 22 | 24
): Promise<ThreeTreeNoirProver> {
	// Try loading from the npm package (future-proofing)
	try {
		const mod = await import('@voter-protocol/noir-prover');
		if ('getThreeTreeProverForDepth' in mod && typeof mod.getThreeTreeProverForDepth === 'function') {
			return mod.getThreeTreeProverForDepth(depth) as Promise<ThreeTreeNoirProver>;
		}
	} catch {
		// Expected — npm package doesn't have three-tree yet
	}

	throw new Error(
		`Three-tree prover not available for depth ${depth}. ` +
			'Publish @voter-protocol/noir-prover with three-tree support, ' +
			'or run against the local package.'
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBATE WEIGHT PROVER
// ═══════════════════════════════════════════════════════════════════════════

/** Number of public inputs in debate_weight circuit: [weighted_amount, note_commitment] */
export const DEBATE_WEIGHT_PUBLIC_INPUT_COUNT = 2;

/** Debate weight prover interface (matches DebateWeightNoirProver from noir-prover) */
export interface DebateWeightNoirProver {
	generateProof(
		input: { stake: bigint; tier: 1 | 2 | 3 | 4; randomness: bigint },
		options?: { keccak?: boolean }
	): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
	destroy(): Promise<void>;
}

/**
 * Get the debate weight prover singleton.
 *
 * Tries the npm package (@voter-protocol/noir-prover).
 * Falls back to a clear error if the export is unavailable.
 *
 * Circuit: debate_weight — no depth parameter (no Merkle trees).
 * Expected init time: 5-15s (browser WASM).
 */
export async function getDebateWeightProver(): Promise<DebateWeightNoirProver> {
	try {
		const mod = await import('@voter-protocol/noir-prover');
		if ('getDebateWeightProver' in mod && typeof mod.getDebateWeightProver === 'function') {
			return mod.getDebateWeightProver() as Promise<DebateWeightNoirProver>;
		}
	} catch (err) {
		throw new Error(
			`Failed to load @voter-protocol/noir-prover for debate weight prover: ${err instanceof Error ? err.message : String(err)}`
		);
	}

	throw new Error(
		'Debate weight prover not available in @voter-protocol/noir-prover. ' +
			'Ensure @voter-protocol/noir-prover >= 0.3.0 is installed with debate_weight circuit support.'
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION NOTE PROVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Number of public inputs in position_note circuit.
 * Layout: [position_root, nullifier, debate_id, winning_argument_index, claimed_weighted_amount]
 */
export const POSITION_NOTE_PUBLIC_INPUT_COUNT = 5;

/**
 * Position tree depth (fixed at 20 — circuit global TREE_DEPTH).
 * 2^20 = 1,048,576 position slots.
 */
export const POSITION_TREE_DEPTH = 20;

/** Position note prover interface (matches PositionNoteNoirProver from noir-prover) */
export interface PositionNoteNoirProver {
	generateProof(
		input: {
			argumentIndex: bigint;
			weightedAmount: bigint;
			randomness: bigint;
			nullifierKey: bigint;
			positionPath: bigint[];
			positionIndex: number;
			positionRoot: bigint;
			debateId: bigint;
			winningArgumentIndex: bigint;
		},
		options?: { keccak?: boolean }
	): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
	destroy(): Promise<void>;
}

/**
 * Get the position note prover singleton.
 *
 * Tries the npm package (@voter-protocol/noir-prover).
 * Falls back to a clear error if the export is unavailable.
 *
 * Circuit: position_note — depth fixed at 20, no depth parameter.
 * Expected init time: 15-40s (larger circuit, browser WASM).
 */
export async function getPositionNoteProver(): Promise<PositionNoteNoirProver> {
	try {
		const mod = await import('@voter-protocol/noir-prover');
		if ('getPositionNoteProver' in mod && typeof mod.getPositionNoteProver === 'function') {
			return mod.getPositionNoteProver() as Promise<PositionNoteNoirProver>;
		}
	} catch (err) {
		throw new Error(
			`Failed to load @voter-protocol/noir-prover for position note prover: ${err instanceof Error ? err.message : String(err)}`
		);
	}

	throw new Error(
		'Position note prover not available in @voter-protocol/noir-prover. ' +
			'Ensure @voter-protocol/noir-prover >= 0.3.0 is installed with position_note circuit support.'
	);
}
