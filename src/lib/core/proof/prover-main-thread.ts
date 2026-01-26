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
interface NoirProverInstance {
	init(): Promise<void>;
	warmup(): Promise<void>;
	prove(inputs: Record<string, unknown>): Promise<{
		proof: Uint8Array;
		publicInputs: Record<string, unknown>;
	}>;
}

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
			console.log('[MainThreadProver] Loading NoirProver...');

			// Import buffer shim first
			await import('./buffer-shim');

			// Dynamically import to avoid SSR issues
			const { NoirProver } = await import('@voter-protocol/noir-prover');

			progressCallback?.('initializing-runtime', 30);
			// Pass threads config - NoirProver will auto-detect if not specified
			noirProverInstance = new NoirProver(threads !== undefined ? { threads } : {});

			console.log('[MainThreadProver] Initializing NoirProver...');
			await noirProverInstance.init();

			progressCallback?.('generating-keys', 50);
			console.log('[MainThreadProver] Warming up prover...');
			const startTime = performance.now();
			await noirProverInstance.warmup();
			const duration = performance.now() - startTime;
			console.log(`[MainThreadProver] Warmup complete in ${duration.toFixed(0)}ms`);

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
 * Generate a ZK proof on the main thread
 *
 * This allows Barretenberg to create its internal worker properly.
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
		console.log('[MainThreadProver] Starting proof generation...');

		// Import poseidon for nullifier computation
		const { computePoseidonNullifier } = await import('../crypto/poseidon');

		// Prepare public input defaults
		const userSecret = witness.userSecret || witness.identityCommitment;
		const campaignId = witness.campaignId || witness.actionId;
		const epochId = witness.epochId || witness.actionId;
		const authorityHash = witness.authorityHash || '0x0';

		// Compute nullifier
		const nullifier = await computePoseidonNullifier(
			userSecret,
			campaignId,
			authorityHash,
			epochId
		);

		// Map witness to circuit inputs
		const circuitInputs = {
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
		console.log('[MainThreadProver] Generating proof with UltraHonkBackend...');
		const result = await noirProverInstance.prove(circuitInputs);
		const proveTime = performance.now() - proveStart;
		console.log(`[MainThreadProver] Proof generation took ${proveTime.toFixed(0)}ms`);

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
