/**
 * Core Halo2 Prover Logic (WASM Wrapper)
 * 
 * This module runs inside the Web Worker.
 * It handles the direct interaction with the WASM module.
 */

import type { Prover } from '@voter-protocol/halo2-browser-prover';
import { computePoseidonNullifier, poseidonHash } from '$lib/core/crypto/poseidon';

// ============================================================================
// Types
// ============================================================================

export interface WitnessData {
    identityCommitment: string;
    leafIndex: number;
    merklePath: string[];
    merkleRoot: string;
    actionId: string;
    timestamp: number;
    address?: string;
}

export interface ProofResult {
    success: boolean;
    proof?: string; // Hex-encoded proof
    publicInputs?: {
        merkleRoot: string;
        nullifier: string;
        actionId: string;
    };
    nullifier?: string;
    error?: string;
}

// ============================================================================
// Core Logic
// ============================================================================

let proverInstance: Prover | null = null;

/**
 * Initialize the WASM prover
 */
export async function initializeWasmProver(
    k: number = 14,
    progressCallback?: (stage: string, percent: number) => void
): Promise<Prover> {
    if (proverInstance) return proverInstance;

    try {
        progressCallback?.('loading-wasm', 10);

        // Import WASM module
        const wasmModule = await import('@voter-protocol/halo2-browser-prover');

        // Initialize WASM runtime
        progressCallback?.('initializing-runtime', 30);
        await wasmModule.default();

        const { Prover } = wasmModule;

        // Perform Key Generation (expensive!)
        progressCallback?.('generating-keys', 50);
        console.log(`[ProverCore] Starting keygen for K=${k}...`);
        const startTime = performance.now();

        const prover = new Prover(k);

        const duration = performance.now() - startTime;
        console.log(`[ProverCore] Keygen complete in ${duration.toFixed(0)}ms`);

        progressCallback?.('ready', 100);
        proverInstance = prover;
        return prover;
    } catch (error) {
        console.error('[ProverCore] Initialization failed:', error);
        throw error;
    }
}

/**
 * Generate a ZK proof
 */
export async function generateZkProof(
    witness: WitnessData,
    progressCallback?: (stage: string, percent: number) => void
): Promise<ProofResult> {
    try {
        if (!proverInstance) {
            throw new Error('Prover not initialized');
        }

        progressCallback?.('proving', 0);
        console.log('[ProverCore] Starting proof generation...');

        // Validate inputs
        if (witness.merklePath.length !== 12) {
            throw new Error(`Invalid Merkle path length: ${witness.merklePath.length}`);
        }

        // Generate proof (Blocking WASM call)
        const proveStart = performance.now();
        const proofBytes = await proverInstance.prove(
            witness.identityCommitment,
            witness.actionId,
            witness.leafIndex,
            witness.merklePath
        );
        const proveTime = performance.now() - proveStart;
        console.log(`[ProverCore] Proof generation (WASM only) took ${proveTime.toFixed(0)}ms`);

        progressCallback?.('proving', 80);

        // Compute nullifier using Poseidon2
        const nullifier = await computePoseidonNullifier(
            witness.identityCommitment,
            witness.actionId
        );

        progressCallback?.('finalizing', 90);

        // Convert proof to hex
        const proofHex = '0x' + Array.from(proofBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        progressCallback?.('complete', 100);

        return {
            success: true,
            proof: proofHex,
            publicInputs: {
                merkleRoot: witness.merkleRoot,
                nullifier,
                actionId: witness.actionId
            },
            nullifier
        };
    } catch (error) {
        console.error('[ProverCore] Proof generation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
