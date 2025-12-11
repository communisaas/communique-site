export interface ProofResult {
    proof: Uint8Array;
    publicOutputs: {
        district_root: string;
        nullifier: string;
        action_id: string;
    };
}

export interface ProverConfig {
    circuitSize: number; // e.g., 14 for K=14
    wasmUrl?: string;
    zkeyUrl?: string;
}

export interface WorkerMessage {
    type: 'INIT' | 'PROVE' | 'STATUS';
    payload?: any;
}

export interface WorkerResponse {
    type: 'INIT_SUCCESS' | 'PROOF_SUCCESS' | 'ERROR' | 'PROGRESS';
    payload?: any;
}

export interface ProofRequest {
    identityCommitment: string;
    actionId: string;
    leafIndex: number;
    merklePath: string[];
}
