/// <reference lib="webworker" />

import { initializeWasmProver, generateZkProof } from './prover-core';
import { isWorkerCommand, type WorkerEvent } from './worker-protocol';

// Type assertion for the worker scope
const ctx: Worker = self as any;

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
			case 'PROVE':
				await handleProve(data.witness);
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

	try {
		await initializeWasmProver(k, (stage, percent) => {
			sendEvent({ type: 'PROGRESS', stage, percent });
		});

		sendEvent({ type: 'STATUS', status: 'ready' });
	} catch (error) {
		sendEvent({ type: 'STATUS', status: 'error' });
		throw error;
	}
}

async function handleProve(witness: any) {
	sendEvent({ type: 'STATUS', status: 'proving' });

	try {
		const result = await generateZkProof(witness, (stage, percent) => {
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

// ============================================================================
// Helper
// ============================================================================

function sendEvent(event: WorkerEvent) {
	ctx.postMessage(event);
}
