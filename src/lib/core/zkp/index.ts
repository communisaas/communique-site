/**
 * ZK Proof Generation - Browser WASM Integration
 *
 * Public API for in-browser ZK proof generation using Noir circuits.
 * Wraps @voter-protocol/noir-prover with Svelte-friendly interfaces.
 *
 * Architecture: Two-tree (district + cell Merkle trees)
 */

// Two-tree prover client API
export {
	initializeTwoTreeProver,
	generateTwoTreeProof,
	resetTwoTreeProver,
	resetAllProvers,
	type ProverProgress,
	type ProgressCallback,
	type TwoTreeProofInputs,
	type TwoTreeProofResult
} from './prover-client';

// Action domain builder
export {
	buildActionDomain,
	isValidActionDomain,
	type ActionDomainParams,
	type JurisdictionType
} from './action-domain-builder';
