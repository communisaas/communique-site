/**
 * ZK Proof Generation - Browser WASM Integration
 *
 * Public API for in-browser ZK proof generation using Noir circuits.
 * Wraps @voter-protocol/noir-prover with Svelte-friendly interfaces.
 *
 * Architecture: Three-tree (user identity + cell-district map + engagement)
 */

// Three-tree prover client API
export {
	initializeThreeTreeProver,
	generateThreeTreeProof,
	resetThreeTreeProver,
	resetAllProvers,
	type ProverProgress,
	type ProgressCallback,
	type EngagementTier,
	type ThreeTreeProofInputs,
	type ThreeTreeProofResult
} from './prover-client';

// Action domain builder
export {
	buildActionDomain,
	isValidActionDomain,
	type ActionDomainParams,
	type JurisdictionType
} from './action-domain-builder';
