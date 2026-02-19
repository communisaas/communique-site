/**
 * Main Thread Noir Prover
 *
 * IMPORTANT: This module MUST run on the main thread, NOT inside a Web Worker.
 *
 * Why? UltraHonkBackend internally calls Barretenberg.new() which creates its own
 * internal worker. Running this inside another worker causes nested worker deadlocks.
 *
 * Architecture:
 * - Main thread → NoirProver → UltraHonkBackend → Barretenberg.new() → internal worker ✓
 * - Worker → NoirProver → UltraHonkBackend → Barretenberg.new() → nested worker DEADLOCK ✗
 *
 * For lightweight operations like Poseidon hashing, use the worker with BarretenbergSync.
 */

import type { WitnessData, ProofResult } from './prover-core';

// Type for the NoirProver instance (avoiding direct import to prevent SSR issues)
// Using 'any' for the actual NoirProver class since it's dynamically imported
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoirProverInstance = any;

// Lazy-loaded prover instance
let noirProverInstance: NoirProverInstance | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Noir prover on the main thread
 *
 * @param threads - Number of threads for proving (default: auto-detect)
 */
export async function initMainThreadProver(
	progressCallback?: (stage: string, percent: number) => void,
	threads?: number
): Promise<void> {
	if (noirProverInstance) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			progressCallback?.('loading-wasm', 10);
			console.debug('[MainThreadProver] Loading NoirProver...');

			// Import buffer shim first
			await import('./buffer-shim');

			// Dynamically import to avoid SSR issues
			const { NoirProver } = await import('@voter-protocol/noir-prover');

			progressCallback?.('initializing-runtime', 30);
			// Pass threads config - NoirProver will auto-detect if not specified
			noirProverInstance = new NoirProver(threads !== undefined ? { threads } : {});

			console.debug('[MainThreadProver] Initializing NoirProver...');
			await noirProverInstance.init();

			progressCallback?.('generating-keys', 50);
			console.debug('[MainThreadProver] Warming up prover...');
			const startTime = performance.now();
			await noirProverInstance.warmup();
			const duration = performance.now() - startTime;
			console.debug(`[MainThreadProver] Warmup complete in ${duration.toFixed(0)}ms`);

			progressCallback?.('ready', 100);
		} catch (error) {
			console.error('[MainThreadProver] Initialization failed:', error);
			initPromise = null;
			throw error;
		}
	})();

	return initPromise;
}

/**
 * Generate a ZK proof on the main thread using v0.2.0 API
 *
 * This allows Barretenberg to create its internal worker properly.
 * Nullifier is computed IN-CIRCUIT (not externally).
 */
export async function generateProofMainThread(
	witness: WitnessData,
	progressCallback?: (stage: string, percent: number) => void
): Promise<ProofResult> {
	try {
		if (!noirProverInstance) {
			throw new Error('Prover not initialized - call initMainThreadProver first');
		}

		progressCallback?.('proving', 0);
		console.debug('[MainThreadProver] Starting proof generation (v0.2.0 API)...');

		// Map witness to circuit inputs (v0.2.0 API)
		// Nullifier is computed IN-CIRCUIT from userSecret + actionDomain + districtId
		const circuitInputs = {
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
		console.debug('[MainThreadProver] Generating proof with UltraHonkBackend...');
		const result = await noirProverInstance.prove(circuitInputs);
		const proveTime = performance.now() - proveStart;
		console.debug(`[MainThreadProver] Proof generation took ${proveTime.toFixed(0)}ms`);

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
		console.error('[MainThreadProver] Proof generation failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Check if the prover is initialized
 */
export function isProverInitialized(): boolean {
	return noirProverInstance !== null;
}
