/**
 * Three-Tree Noir Prover Shim
 *
 * The published @voter-protocol/noir-prover@0.2.0 only exports two-tree
 * functionality. Three-tree support exists in the local repo but hasn't
 * been published yet. This shim provides the types and a runtime-safe
 * factory that tries the npm package first, then fails with a clear error.
 *
 * When @voter-protocol/noir-prover is updated with three-tree support,
 * delete this file and import directly from the package.
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
