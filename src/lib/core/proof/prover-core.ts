/**
 * Core Noir Prover Logic (WASM Wrapper)
 *
 * This module runs inside the Web Worker.
 * It handles the direct interaction with @voter-protocol/noir-prover.
 *
 * UPDATED for v0.2.0 API:
 * - Nullifier computed IN-CIRCUIT (not externally)
 * - New fields: actionDomain, districtId, authorityLevel, registrationSalt
 * - Removed: nullifier, authorityHash, epochId, campaignId, leaf
 */

import { NoirProver } from '@voter-protocol/noir-prover';
import type { CircuitInputs } from '@voter-protocol/noir-prover';

// ============================================================================
// Types
// ============================================================================

export interface WitnessData {
	// Public inputs
	merkleRoot: string;
	actionDomain: string; // Domain separator for nullifier (e.g., campaign ID)

	// Private inputs
	userSecret: string; // User's identity secret (commitment preimage)
	districtId: string; // User's district identifier
	authorityLevel: 1 | 2 | 3 | 4 | 5; // Authorization level
	registrationSalt: string; // Salt from registration

	// Merkle proof data
	merklePath: string[];
	leafIndex: number;

	// Legacy fields (for backwards compatibility during migration)
	identityCommitment?: string;
	actionId?: string;
	timestamp?: number;
	address?: string;
}

export interface ProofResult {
	success: boolean;
	proof?: Uint8Array; // Proof format depends on backend
	publicInputs?: {
		merkleRoot: string;
		nullifier: string;
		authorityLevel: number;
		actionDomain: string;
		districtId: string;
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
		console.debug('[ProverCore] Starting warmup...');
		const startTime = performance.now();

		await proverInstance.warmup();

		const duration = performance.now() - startTime;
		console.debug(`[ProverCore] Warmup complete in ${duration.toFixed(0)}ms`);

		progressCallback?.('ready', 100);
		return proverInstance;
	} catch (error) {
		console.error('[ProverCore] Initialization failed:', error);
		throw error;
	}
}

/**
 * Generate a ZK proof using v0.2.0 API
 *
 * Nullifier is computed IN-CIRCUIT from:
 * - userSecret
 * - actionDomain
 * - districtId
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
		console.debug('[ProverCore] Starting proof generation (v0.2.0 API)...');

		// Map witness to circuit inputs (v0.2.0 API)
		const circuitInputs: CircuitInputs = {
			// Public inputs
			merkleRoot: witness.merkleRoot,
			actionDomain: witness.actionDomain,

			// Private inputs
			userSecret: witness.userSecret,
			districtId: witness.districtId,
			authorityLevel: witness.authorityLevel,
			registrationSalt: witness.registrationSalt,

			// Merkle proof
			merklePath: witness.merklePath,
			leafIndex: witness.leafIndex
		};

		// Generate proof (nullifier computed in-circuit)
		const proveStart = performance.now();
		const result = await proverInstance.prove(circuitInputs);
		const proveTime = performance.now() - proveStart;
		console.debug(`[ProverCore] Proof generation took ${proveTime.toFixed(0)}ms`);

		progressCallback?.('complete', 100);

		return {
			success: true,
			proof: result.proof,
			publicInputs: {
				merkleRoot: result.publicInputs.merkleRoot,
				nullifier: result.publicInputs.nullifier,
				authorityLevel: result.publicInputs.authorityLevel,
				actionDomain: result.publicInputs.actionDomain,
				districtId: result.publicInputs.districtId
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
