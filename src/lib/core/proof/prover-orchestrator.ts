import type { WitnessData, ProofResult } from './prover-core';
import type { WorkerEvent } from './worker-protocol';
import ProverWorker from './prover.worker?worker'; // Vite worker import

/**
 * Prover Orchestrator
 * 
 * Manages the lifecycle of the Halo2 Prover Web Worker.
 * Ensures the main thread remains non-blocking during proof generation.
 */
export class ProverOrchestrator {
    private worker: Worker | null = null;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    // Event listeners
    private progressCallbacks: Set<(stage: string, percent: number) => void> = new Set();

    constructor() {
        // Lazy initialization handled in init()
    }

    /**
     * Initialize the prover worker (idempotent)
     */
    public async init(k: number = 14): Promise<void> {
        if (this.isInitialized) return;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = new Promise((resolve, reject) => {
            console.log('[ProverOrchestrator] Spawning worker...');

            try {
                this.worker = new ProverWorker();

                this.worker.onmessage = (event: MessageEvent) => {
                    this.handleWorkerMessage(event.data, resolve, reject);
                };

                this.worker.onerror = (error) => {
                    console.error('[ProverOrchestrator] Worker error:', error);
                    reject(error);
                };

                // Send INIT command
                this.worker.postMessage({ type: 'INIT', k });
            } catch (error) {
                reject(error);
            }
        });

        return this.initializationPromise;
    }

    /**
     * Generate a ZK proof
     */
    public async prove(
        witness: WitnessData,
        onProgress?: (stage: string, percent: number) => void
    ): Promise<ProofResult> {
        if (!this.worker) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            // Register one-time listener for this proof
            const messageHandler = (event: MessageEvent) => {
                const data = event.data as WorkerEvent;

                if (data.type === 'PROOF_COMPLETE') {
                    cleanup();
                    resolve(data.result);
                } else if (data.type === 'ERROR') {
                    cleanup();
                    reject(new Error(data.message));
                } else if (data.type === 'PROGRESS') {
                    onProgress?.(data.stage, data.percent);
                }
            };

            const cleanup = () => {
                this.worker?.removeEventListener('message', messageHandler);
            };

            this.worker!.addEventListener('message', messageHandler);

            // Send PROVE command
            this.worker!.postMessage({ type: 'PROVE', witness });
        });
    }

    /**
     * Handle messages during initialization
     */
    private handleWorkerMessage(
        data: WorkerEvent,
        resolve: () => void,
        reject: (err: Error) => void
    ) {
        switch (data.type) {
            case 'STATUS':
                if (data.status === 'ready') {
                    this.isInitialized = true;
                    resolve();
                } else if (data.status === 'error') {
                    reject(new Error('Worker initialization failed'));
                }
                break;
            case 'ERROR':
                reject(new Error(data.message));
                break;
            case 'PROGRESS':
                // Notify global listeners if any
                this.notifyProgress(data.stage, data.percent);
                break;
        }
    }

    private notifyProgress(stage: string, percent: number) {
        this.progressCallbacks.forEach(cb => cb(stage, percent));
    }

    /**
     * Terminate the worker (e.g., on page unload or error recovery)
     */
    public terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            this.initializationPromise = null;
        }
    }
}

// Singleton instance
export const proverOrchestrator = new ProverOrchestrator();
