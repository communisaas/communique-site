/**
 * ZK Proof Generation - Browser WASM Integration
 *
 * Public API for in-browser ZK proof generation using Noir circuits.
 * Wraps @voter-protocol/noir-prover with Svelte-friendly interfaces.
 */

// Prover client API
export {
	initializeProver,
	generateProof,
	resetProver,
	type ProverProgress,
	type ProgressCallback,
	type ProofInputs,
	type ProofResult
} from './prover-client';

// Witness builder utilities
export {
	buildWitness,
	validateFieldElement,
	derivePathIndices,
	normalizeHex,
	formatFieldElement,
	type UserRegistration
} from './witness-builder';

// Action domain builder
export {
	buildActionDomain,
	isValidActionDomain,
	type ActionDomainParams,
	type JurisdictionType
} from './action-domain-builder';
