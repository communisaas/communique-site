import type { ProofRequest, ProofResult, WorkerMessage, WorkerResponse } from './types';

// Import the worker using Vite's worker import syntax
import ProverWorker from './prover.worker?worker';

export class ProverClient {
	private worker: Worker | null = null;
	private isInitialized = false;
	private initPromise: Promise<void> | null = null;

	constructor() {}

	/**
	 * Initialize the prover worker.
	 * This should be called once, preferably when the app starts or when the user enters a flow that might need proving.
	 */
	async init(circuitSize = 14): Promise<void> {
		if (this.isInitialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = new Promise((resolve, reject) => {
			try {
				this.worker = new ProverWorker();

				this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
					const { type, payload } = event.data;
					if (type === 'INIT_SUCCESS') {
						this.isInitialized = true;
						resolve();
					} else if (type === 'ERROR') {
						reject(new Error(payload));
					}
				};

				this.worker.postMessage({ type: 'INIT', payload: { circuitSize } } as WorkerMessage);
			} catch (error) {
				reject(error);
			}
		});

		return this.initPromise;
	}

	/**
	 * Generate a Zero-Knowledge Proof.
	 * @param request Proof inputs
	 * @param onProgress Optional callback for progress updates
	 */
	async prove(
		request: ProofRequest,
		onProgress?: (step: string, percent: number) => void
	): Promise<ProofResult> {
		if (!this.isInitialized || !this.worker) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.worker) return reject(new Error('Worker not created'));

			// Set up a one-time listener for this proof request
			// In a more robust implementation, we'd use request IDs to handle concurrent requests
			const handler = (event: MessageEvent<WorkerResponse>) => {
				const { type, payload } = event.data;

				switch (type) {
					case 'PROOF_SUCCESS':
						this.worker?.removeEventListener('message', handler);
						resolve(payload);
						break;
					case 'PROGRESS':
						onProgress?.(payload.step, payload.percent);
						break;
					case 'ERROR':
						this.worker?.removeEventListener('message', handler);
						reject(new Error(payload));
						break;
				}
			};

			this.worker.addEventListener('message', handler);
			this.worker.postMessage({ type: 'PROVE', payload: request } as WorkerMessage);
		});
	}

	/**
	 * Terminate the worker to free memory.
	 */
	terminate() {
		this.worker?.terminate();
		this.worker = null;
		this.isInitialized = false;
		this.initPromise = null;
	}
}

// Singleton instance
export const proverClient = new ProverClient();
