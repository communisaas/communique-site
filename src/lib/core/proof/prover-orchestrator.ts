import ProverWorker from './prover.worker?worker';
import type { WitnessData, ProofResult } from './prover-core';
import type { WorkerEvent } from './worker-protocol';
import {
	initMainThreadProver,
	generateProofMainThread,
	isProverInitialized
} from './prover-main-thread';

/**
 * Prover Orchestrator
 *
 * ARCHITECTURE:
 * - Proof generation runs on MAIN THREAD (UltraHonkBackend needs to create its own worker)
 * - Poseidon hashing runs in Web Worker (uses BarretenbergSync, no nested workers)
 *
 * Why this split?
 * - UltraHonkBackend internally calls Barretenberg.new() which creates workers
 * - Running this inside another worker causes nested worker deadlocks
 * - BarretenbergSync uses threads:1 and works safely in worker contexts
 */
export class ProverOrchestrator {
	private worker: Worker | null = null;
	private workerInitialized = false;
	private workerInitPromise: Promise<void> | null = null;
	private proverInitPromise: Promise<void> | null = null;

	// Event listeners
	private progressCallbacks: Set<(stage: string, percent: number) => void> = new Set();

	constructor() {
		// Lazy initialization handled in init()
	}

	/**
	 * Initialize the prover (main thread) and worker (for hashing)
	 */
	public async init(_k: number = 14): Promise<void> {
		// Initialize main-thread prover (for proof generation)
		if (!this.proverInitPromise && !isProverInitialized()) {
			console.log('[ProverOrchestrator] Initializing main-thread prover...');
			this.proverInitPromise = initMainThreadProver((stage, percent) => {
				this.notifyProgress(stage, percent);
			});
		}

		// Initialize worker (for Poseidon hashing operations)
		if (!this.workerInitPromise && !this.workerInitialized) {
			this.workerInitPromise = this.initWorker();
		}

		// Wait for both to complete
		await Promise.all([this.proverInitPromise, this.workerInitPromise]);
	}

	/**
	 * Initialize just the worker (for hashing operations)
	 */
	private async initWorker(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.log('[ProverOrchestrator] Spawning hash worker...');

			try {
				this.worker = new ProverWorker();

				this.worker.onmessage = (event: MessageEvent) => {
					this.handleWorkerMessage(event.data, resolve, reject);
				};

				this.worker.onerror = (error) => {
					console.error('[ProverOrchestrator] Worker error:', error);
					reject(error);
				};

				// Send INIT_HASH_ONLY command (don't initialize NoirProver in worker)
				this.worker.postMessage({ type: 'INIT_HASH_ONLY' });
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Generate a ZK proof (runs on main thread to avoid nested worker issues)
	 */
	public async prove(
		witness: WitnessData,
		onProgress?: (stage: string, percent: number) => void
	): Promise<ProofResult> {
		// Ensure main-thread prover is initialized
		if (!isProverInitialized()) {
			await this.init();
		}

		// Run proof generation on main thread
		// UltraHonkBackend creates its own internal worker, which works from main thread
		// but causes deadlocks when nested inside another worker
		return generateProofMainThread(witness, onProgress);
	}

	/**
	 * Compute Merkle root using Barretenberg Poseidon2 (runs in worker)
	 * This avoids initializing a separate Barretenberg instance in the main thread.
	 */
	public async computeMerkleRoot(
		leaf: string,
		merklePath: string[],
		leafIndex: number
	): Promise<string> {
		if (!this.worker) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			const messageHandler = (event: MessageEvent) => {
				const data = event.data as WorkerEvent;

				if (data.type === 'MERKLE_ROOT_RESULT') {
					cleanup();
					resolve(data.merkleRoot);
				} else if (data.type === 'ERROR') {
					cleanup();
					reject(new Error(data.message));
				}
			};

			const cleanup = () => {
				this.worker?.removeEventListener('message', messageHandler);
			};

			this.worker!.addEventListener('message', messageHandler);

			// Send COMPUTE_MERKLE_ROOT command
			this.worker!.postMessage({ type: 'COMPUTE_MERKLE_ROOT', leaf, merklePath, leafIndex });
		});
	}

	/**
	 * Hash a string using Barretenberg Poseidon2 (runs in worker)
	 * Converts string input to field element hash.
	 */
	public async poseidonHash(input: string): Promise<string> {
		if (!this.worker) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			const messageHandler = (event: MessageEvent) => {
				const data = event.data as WorkerEvent;

				if (data.type === 'POSEIDON_HASH_RESULT') {
					cleanup();
					resolve(data.hash);
				} else if (data.type === 'ERROR') {
					cleanup();
					reject(new Error(data.message));
				}
			};

			const cleanup = () => {
				this.worker?.removeEventListener('message', messageHandler);
			};

			this.worker!.addEventListener('message', messageHandler);

			// Send POSEIDON_HASH command
			this.worker!.postMessage({ type: 'POSEIDON_HASH', input });
		});
	}

	// Track last error message for better error reporting
	private lastErrorMessage: string | null = null;

	/**
	 * Handle messages during worker initialization
	 */
	private handleWorkerMessage(
		data: WorkerEvent,
		resolve: () => void,
		reject: (err: Error) => void
	) {
		switch (data.type) {
			case 'STATUS':
				console.log('[ProverOrchestrator] Hash worker status:', data.status);
				if (data.status === 'ready') {
					this.workerInitialized = true;
					this.lastErrorMessage = null;
					resolve();
				} else if (data.status === 'error') {
					const errorMsg = this.lastErrorMessage || 'Hash worker initialization failed';
					console.error('[ProverOrchestrator] Hash worker failed:', errorMsg);
					reject(new Error(errorMsg));
				}
				break;
			case 'ERROR':
				console.error('[ProverOrchestrator] Hash worker error:', data.message);
				this.lastErrorMessage = data.message;
				// Don't reject here - wait for STATUS: error to reject with full context
				break;
			case 'PROGRESS':
				// Notify global listeners if any
				this.notifyProgress(data.stage, data.percent);
				break;
		}
	}

	private notifyProgress(stage: string, percent: number) {
		this.progressCallbacks.forEach((cb) => cb(stage, percent));
	}

	/**
	 * Terminate the worker (e.g., on page unload or error recovery)
	 */
	public terminate() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
			this.workerInitialized = false;
			this.workerInitPromise = null;
		}
		// Note: main-thread prover state persists (NoirProver instance is module-level)
	}
}

// Singleton instance
export const proverOrchestrator = new ProverOrchestrator();
