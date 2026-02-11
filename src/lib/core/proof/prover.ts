/**
 * Prover barrel - re-exports from orchestrator for backwards compatibility
 */
export { ProverOrchestrator as default } from './prover-orchestrator';
export { initMainThreadProver as initializeProver, generateProofMainThread as generateProof } from './prover-main-thread';
