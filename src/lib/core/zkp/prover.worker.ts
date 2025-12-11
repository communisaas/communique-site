import init, { Prover } from '@voter-protocol/crypto';
import type { WorkerMessage, ProofRequest } from './types';

let proverInstance: Prover | null = null;
let isInitialized = false;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'INIT':
                await initializeProver(payload?.circuitSize || 14);
                self.postMessage({ type: 'INIT_SUCCESS' });
                break;

            case 'PROVE':
                if (!isInitialized || !proverInstance) {
                    throw new Error('Prover not initialized');
                }
                const result = await generateProof(payload);
                self.postMessage({ type: 'PROOF_SUCCESS', payload: result });
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
            type: 'ERROR',
            payload: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

async function initializeProver(circuitSize: number) {
    if (isInitialized) return;

    // Load WASM
    await init();

    // Initialize prover
    // This might take a few seconds
    proverInstance = new Prover(circuitSize);
    isInitialized = true;
}

async function generateProof(params: ProofRequest) {
    if (!proverInstance) throw new Error('Prover not initialized');

    // Simulate progress updates (since actual WASM might not emit them yet)
    // In a real implementation, we'd hook into the WASM if possible
    self.postMessage({ type: 'PROGRESS', payload: { step: 'witness', percent: 20 } });

    const proofBytes = await proverInstance.prove(
        params.identityCommitment,
        params.actionId,
        params.leafIndex,
        params.merklePath
    );

    self.postMessage({ type: 'PROGRESS', payload: { step: 'proving', percent: 100 } });

    // Extract public outputs (mock implementation for now until we have the exact extraction logic)
    // In the real circuit, these are the first bytes of the proof or returned separately
    // For now, we'll assume the Prover class handles this or we extract them
    // This matches the interface we defined
    const publicOutputs = {
        district_root: '0x...', // TODO: Extract from proof
        nullifier: '0x...',     // TODO: Extract from proof
        action_id: params.actionId
    };

    return {
        proof: proofBytes,
        publicOutputs
    };
}
