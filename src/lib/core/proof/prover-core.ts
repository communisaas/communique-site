/**
 * Core Noir Prover Logic (WASM Wrapper)
 *
 * This module runs inside the Web Worker.
 * It handles the direct interaction with @voter-protocol/noir-prover.
 */

import { NoirProver } from '@voter-protocol/noir-prover';
import type { CircuitInputs } from '@voter-protocol/noir-prover';
import { computePoseidonNullifier } from '../crypto/poseidon';

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
	// New fields for Noir circuit
	authorityHash?: string;
	epochId?: string;
	campaignId?: string;
	userSecret?: string;
}

export interface ProofResult {
	success: boolean;
	proof?: Uint8Array; // Proof format depends on backend
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

let proverInstance: NoirProver | null = null;

/**
 * Initialize the Noir prover
 */
export async function initializeWasmProver(
	_k: number = 14, // Ignored for Noir, kept for API compatibility
	progressCallback?: (stage: string, percent: number) => void
): Promise<NoirProver> {
	if (proverInstance) return proverInstance;

	try {
		progressCallback?.('loading-wasm', 10);

		// Create prover instance
		proverInstance = new NoirProver();

		// Initialize (loads WASM + circuit bytecode)
		progressCallback?.('initializing-runtime', 30);
		await proverInstance.init();

		// Pre-generate proving key (expensive, but cached)
		progressCallback?.('generating-keys', 50);
		console.log('[ProverCore] Starting warmup...');
		const startTime = performance.now();

		await proverInstance.warmup();

		const duration = performance.now() - startTime;
		console.log(`[ProverCore] Warmup complete in ${duration.toFixed(0)}ms`);

		progressCallback?.('ready', 100);
		return proverInstance;
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

		// Prepare public input defaults
		const userSecret = witness.userSecret || witness.identityCommitment;
		const campaignId = witness.campaignId || witness.actionId;
		const epochId = witness.epochId || witness.actionId;
		const authorityHash = witness.authorityHash || '0x0';

		// Compute nullifier to verify inputs (must match circuit assertion)
		const nullifier = await computePoseidonNullifier(
			userSecret,
			campaignId,
			authorityHash,
			epochId
		);

		// Map witness to circuit inputs
		const circuitInputs: CircuitInputs = {
			merkleRoot: witness.merkleRoot,
			nullifier,
			authorityHash,
			epochId,
			campaignId,
			leaf: witness.identityCommitment,
			merklePath: witness.merklePath,
			leafIndex: witness.leafIndex,
			userSecret
		};

		// Generate proof
		const proveStart = performance.now();
		const result = await proverInstance.prove(circuitInputs);
		const proveTime = performance.now() - proveStart;
		console.log(`[ProverCore] Proof generation took ${proveTime.toFixed(0)}ms`);

		progressCallback?.('complete', 100);

		return {
			success: true,
			proof: result.proof,
			publicInputs: {
				merkleRoot: result.publicInputs.merkleRoot,
				nullifier: result.publicInputs.nullifier,
				actionId: result.publicInputs.campaignId
			},
			nullifier: result.publicInputs.nullifier
		};
	} catch (error) {
		console.error('[ProverCore] Proof generation failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
