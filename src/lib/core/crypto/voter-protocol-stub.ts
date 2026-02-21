/**
 * Stub for @voter-protocol/noir-prover — used in CI/test environments
 * where the local package isn't linked.
 *
 * Exports only the symbols actually imported by communique source files.
 * Real implementation lives in ../voter-protocol/packages/noir-prover.
 */

/** BN254 scalar field modulus (Fr order) */
export const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Number of public inputs in three-tree circuit */
export const THREE_TREE_PUBLIC_INPUT_COUNT = 5;

/** Circuit depth type — stub for type imports */
export type CircuitDepth = 10 | 20 | 32;

/** Three-tree proof input — stub interface */
export interface ThreeTreeProofInput {
	identityCommitment: string;
	merkleRoot: string;
	merklePath: string[];
	merklePathIndices: number[];
	districtRoot: string;
	districtPath: string[];
	districtPathIndices: number[];
	actionRoot: string;
	actionPath: string[];
	actionPathIndices: number[];
	nullifier: string;
	externalNullifier: string;
}

/** Three-tree proof result — stub interface */
export interface ThreeTreeProofResult {
	proof: Uint8Array;
	publicInputs: string[];
}

/** Three-tree prover — stub interface */
export interface ThreeTreeNoirProver {
	generateProof(input: ThreeTreeProofInput): Promise<ThreeTreeProofResult>;
	destroy(): void;
}

/** Stub — throws at runtime (should never be called in tests) */
export function getThreeTreeProverForDepth(_depth: CircuitDepth): Promise<ThreeTreeNoirProver> {
	throw new Error('@voter-protocol/noir-prover stub: getThreeTreeProverForDepth not available in CI');
}
