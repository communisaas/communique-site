/// <reference lib="webworker" />

// ============================================================================
// CRITICAL: Buffer polyfill MUST run before any code that imports @aztec/bb.js
// Static ES imports are HOISTED, so we use dynamic imports to control order.
// ============================================================================

// Use local buffer shim to avoid Vite dev server module resolution issues
// The 'buffer/' package doesn't resolve correctly in workers during dev mode
import { Buffer } from './buffer-shim';
(globalThis as any).Buffer = Buffer;

// Type for proof results (matching prover-core.ts)
interface ProofResult {
	success: boolean;
	proof?: Uint8Array;
	publicInputs?: Record<string, unknown>;
	nullifier?: string;
	error?: string;
}

// Type for witness data (v0.2.0 API - nullifier computed in-circuit)
interface WitnessData {
	// Public inputs
	merkleRoot: string;
	actionDomain: string;

	// Private inputs
	userSecret: string;
	districtId: string;
	authorityLevel: 1 | 2 | 3 | 4 | 5;
	registrationSalt: string;

	// Merkle proof
	merklePath: string[];
	leafIndex: number;

	// Allow additional fields for flexibility
	[key: string]: unknown;
}

// Type for worker events (inline to avoid hoisting issues)
type WorkerEvent =
	| { type: 'STATUS'; status: string }
	| { type: 'ERROR'; message: string }
	| { type: 'PROGRESS'; stage: string; percent: number }
	| { type: 'PROOF_COMPLETE'; result: ProofResult }
	| { type: 'MERKLE_ROOT_RESULT'; merkleRoot: string }
	| { type: 'POSEIDON_HASH_RESULT'; hash: string };

type WorkerCommand =
	| { type: 'INIT'; k?: number }
	| { type: 'INIT_HASH_ONLY' }
	| { type: 'PROVE'; witness: WitnessData }
	| { type: 'COMPUTE_MERKLE_ROOT'; leaf: string; merklePath: string[]; leafIndex: number }
	| { type: 'POSEIDON_HASH'; input: string };

function isWorkerCommand(data: unknown): data is WorkerCommand {
	return typeof data === 'object' && data !== null && 'type' in data;
}

const ctx: Worker = self as unknown as Worker;

// Dynamic import wrapper to load prover-core AFTER Buffer is set
let proverCore: typeof import('./prover-core') | null = null;

async function loadProverCore() {
	if (!proverCore) {
		proverCore = await import('./prover-core');
	}
	return proverCore;
}

// ============================================================================
// Message Handler
// ============================================================================

ctx.onmessage = async (event: MessageEvent) => {
	const data = event.data;

	if (!isWorkerCommand(data)) {
		console.warn('[ProverWorker] Received invalid command:', data);
		return;
	}

	try {
		switch (data.type) {
			case 'INIT':
				await handleInit(data.k);
				break;
			case 'INIT_HASH_ONLY':
				await handleInitHashOnly();
				break;
			case 'PROVE':
				await handleProve(data.witness);
				break;
			case 'COMPUTE_MERKLE_ROOT':
				await handleComputeMerkleRoot(data.leaf, data.merklePath, data.leafIndex);
				break;
			case 'POSEIDON_HASH':
				await handlePoseidonHash(data.input);
				break;
		}
	} catch (error) {
		sendEvent({
			type: 'ERROR',
			message: error instanceof Error ? error.message : 'Unknown worker error'
		});
	}
};

// ============================================================================
// Command Handlers
// ============================================================================

async function handleInit(k: number = 14) {
	sendEvent({ type: 'STATUS', status: 'initializing' });
	console.debug('[ProverWorker] Starting initialization...');

	try {
		console.debug('[ProverWorker] Loading prover-core...');
		const core = await loadProverCore();
		console.debug('[ProverWorker] prover-core loaded, initializing WASM...');
		await core.initializeWasmProver(k, (stage, percent) => {
			sendEvent({ type: 'PROGRESS', stage, percent });
		});

		console.debug('[ProverWorker] Initialization complete!');
		sendEvent({ type: 'STATUS', status: 'ready' });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
		console.error('[ProverWorker] Initialization failed:', error);
		// Send ERROR first with details, then STATUS
		sendEvent({ type: 'ERROR', message: errorMessage });
		sendEvent({ type: 'STATUS', status: 'error' });
	}
}

/**
 * Initialize ONLY the Poseidon hashing capability (BarretenbergSync)
 *
 * This is used when proof generation runs on the main thread.
 * BarretenbergSync uses threads:1 and doesn't create nested workers,
 * so it's safe to use in a worker context.
 */
async function handleInitHashOnly() {
	sendEvent({ type: 'STATUS', status: 'initializing' });
	console.debug('[ProverWorker] Starting hash-only initialization (BarretenbergSync)...');

	try {
		// Pre-load poseidon module which initializes BarretenbergSync
		const { poseidonHash } = await import('../crypto/poseidon');

		// Do a warmup hash to ensure BarretenbergSync is fully initialized
		console.debug('[ProverWorker] Warming up BarretenbergSync...');
		await poseidonHash('warmup');

		console.debug('[ProverWorker] Hash worker ready!');
		sendEvent({ type: 'STATUS', status: 'ready' });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
		console.error('[ProverWorker] Hash initialization failed:', error);
		sendEvent({ type: 'ERROR', message: errorMessage });
		sendEvent({ type: 'STATUS', status: 'error' });
	}
}

async function handleProve(witness: WitnessData) {
	sendEvent({ type: 'STATUS', status: 'proving' });

	try {
		const core = await loadProverCore();
		const result = await core.generateZkProof(witness, (stage, percent) => {
			sendEvent({ type: 'PROGRESS', stage, percent });
		});

		if (result.success) {
			sendEvent({ type: 'PROOF_COMPLETE', result });
			sendEvent({ type: 'STATUS', status: 'ready' });
		} else {
			sendEvent({ type: 'ERROR', message: result.error || 'Proof generation failed' });
			sendEvent({ type: 'STATUS', status: 'error' });
		}
	} catch (error) {
		sendEvent({ type: 'STATUS', status: 'error' });
		throw error;
	}
}

async function handleComputeMerkleRoot(leaf: string, merklePath: string[], leafIndex: number) {
	try {
		// Import poseidon module (uses Barretenberg which is already initialized in worker context)
		const { computeMerkleRoot } = await import('../crypto/poseidon');
		console.debug('[ProverWorker] Computing merkle root...');
		const merkleRoot = await computeMerkleRoot(leaf, merklePath, leafIndex);
		console.debug('[ProverWorker] Merkle root computed:', merkleRoot.slice(0, 16) + '...');
		sendEvent({ type: 'MERKLE_ROOT_RESULT', merkleRoot });
	} catch (error) {
		console.error('[ProverWorker] Merkle root computation failed:', error);
		sendEvent({
			type: 'ERROR',
			message: error instanceof Error ? error.message : 'Merkle root computation failed'
		});
	}
}

async function handlePoseidonHash(input: string) {
	try {
		const { poseidonHash } = await import('../crypto/poseidon');
		console.debug('[ProverWorker] Computing poseidon hash...');
		const hash = await poseidonHash(input);
		console.debug('[ProverWorker] Hash computed:', hash.slice(0, 16) + '...');
		sendEvent({ type: 'POSEIDON_HASH_RESULT', hash });
	} catch (error) {
		console.error('[ProverWorker] Poseidon hash failed:', error);
		sendEvent({
			type: 'ERROR',
			message: error instanceof Error ? error.message : 'Poseidon hash failed'
		});
	}
}

// ============================================================================
// Helper
// ============================================================================

function sendEvent(event: WorkerEvent) {
	ctx.postMessage(event);
}
