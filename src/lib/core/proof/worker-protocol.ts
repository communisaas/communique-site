import type { WitnessData, ProofResult } from './prover-core';

// ============================================================================
// Worker Protocol Definitions
// ============================================================================

/**
 * Commands sent from Orchestrator (Main Thread) to Worker
 */
export type WorkerCommand =
    | { type: 'INIT'; k?: number }
    | { type: 'PROVE'; witness: WitnessData };

/**
 * Events sent from Worker to Orchestrator (Main Thread)
 */
export type WorkerEvent =
    | { type: 'STATUS'; status: 'idle' | 'initializing' | 'ready' | 'proving' | 'error' }
    | { type: 'PROGRESS'; stage: string; percent: number }
    | { type: 'PROOF_COMPLETE'; result: ProofResult }
    | { type: 'ERROR'; message: string };

/**
 * Type guard for WorkerCommand
 */
export function isWorkerCommand(data: any): data is WorkerCommand {
    return (
        typeof data === 'object' &&
        data !== null &&
        (data.type === 'INIT' || data.type === 'PROVE')
    );
}
