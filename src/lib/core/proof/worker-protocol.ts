import type { WitnessData, ProofResult } from './prover-core';

// ============================================================================
// Worker Protocol Definitions
// ============================================================================

/**
 * Commands sent from Orchestrator (Main Thread) to Worker
 *
 * Note: INIT initializes full NoirProver (for legacy use)
 * INIT_HASH_ONLY initializes only BarretenbergSync for Poseidon hashing
 * (proof generation now runs on main thread to avoid nested worker issues)
 */
export type WorkerCommand =
	| { type: 'INIT'; k?: number }
	| { type: 'INIT_HASH_ONLY' }
	| { type: 'PROVE'; witness: WitnessData }
	| { type: 'COMPUTE_MERKLE_ROOT'; leaf: string; merklePath: string[]; leafIndex: number }
	| { type: 'POSEIDON_HASH'; input: string };

/**
 * Events sent from Worker to Orchestrator (Main Thread)
 */
export type WorkerEvent =
	| { type: 'STATUS'; status: 'idle' | 'initializing' | 'ready' | 'proving' | 'error' }
	| { type: 'PROGRESS'; stage: string; percent: number }
	| { type: 'PROOF_COMPLETE'; result: ProofResult }
	| { type: 'MERKLE_ROOT_RESULT'; merkleRoot: string }
	| { type: 'POSEIDON_HASH_RESULT'; hash: string }
	| { type: 'ERROR'; message: string };

/**
 * Type guard for WorkerCommand
 */
export function isWorkerCommand(data: unknown): data is WorkerCommand {
	return (
		typeof data === 'object' &&
		data !== null &&
		'type' in data &&
		(data.type === 'INIT' ||
			data.type === 'INIT_HASH_ONLY' ||
			data.type === 'PROVE' ||
			data.type === 'COMPUTE_MERKLE_ROOT' ||
			data.type === 'POSEIDON_HASH')
	);
}
