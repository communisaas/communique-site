# Client-Side Proving Architecture

## Core Philosophy
**"The Hum"** must be a background hum, not a blocking scream. The proving process is computationally intensive but must remain invisible to the UI thread. We employ a strict **Actor Model** architecture to isolate the Halo2 WASM runtime.

## Architecture Components

### 1. The Orchestrator (`ProverOrchestrator`)
**Role:** The Conductor.
- Resides in the **Main Thread**.
- Manages the lifecycle of the `ProverWorker`.
- Handles UX state transitions (Idle → Initializing → Proving → Complete).
- **Resonant Abstraction:** A reactive state machine that exposes a simple `prove(witness)` async method.

### 2. The Worker (`ProverWorker`)
**Role:** The Engine Room.
- Resides in a **Web Worker**.
- Owns the WASM memory instance (4GB+ limit).
- Executes the blocking `keygen` and `prove` operations.
- **Resonant Abstraction:** An isolated actor processing a command queue.

### 3. The Core (`ProverCore`)
**Role:** The Mathematician.
- The raw `@voter-protocol/halo2-browser-prover` WASM module.
- **Constraint:** Single-threaded execution context (for now).
- **Optimization:** Uses `Poseidon2` for all cryptographic hashing.

## Data Flow & Messaging Protocol

We use a strictly typed messaging protocol for zero-ambiguity communication.

```typescript
// Command: Orchestrator -> Worker
type WorkerCommand = 
  | { type: 'INIT'; k: number }
  | { type: 'PROVE'; witness: WitnessData };

// Event: Worker -> Orchestrator
type WorkerEvent = 
  | { type: 'STATUS'; status: 'ready' | 'proving' | 'error' }
  | { type: 'PROGRESS'; percent: number }
  | { type: 'PROOF_COMPLETE'; result: ProofResult }
  | { type: 'ERROR'; message: string };
```

## Performance & Memory Strategy

### 1. Initialization (The "Cold Start")
- **Problem:** `keygen` takes ~5-10s.
- **Solution:** 
  - Trigger `INIT` immediately upon app load (low priority).
  - If user arrives at "The Hum" before `INIT` completes, show "Initializing Secure Enclave..."
  - Once initialized, the `ProverWorker` stays alive.

### 2. Memory Management
- **Problem:** WASM requires contiguous memory.
- **Solution:** 
  - Worker is allocated a dedicated heap.
  - If proof fails due to OOM, the Orchestrator kills the worker and restarts with a higher memory limit (if browser allows).

### 3. Cryptographic Primitives
- **Hashing:** `Poseidon2` (BN254) via `@zkpassport/poseidon2`.
- **Curve:** BN254 (native to Halo2).
- **Encryption:** P-256 ECDH + AES-256-GCM (Web Crypto API) for TEE transport.

## Implementation Pattern

```typescript
// src/lib/core/proof/orchestrator.ts
export class ProverOrchestrator {
  private worker: Worker;
  
  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  public async prove(witness: WitnessData): Promise<ProofResult> {
    // The clean API surface
    this.worker.postMessage({ type: 'PROVE', witness });
    return this.waitForProof();
  }
}
```

## Security Boundaries
- **Private Inputs:** Witness data is passed to Worker via `postMessage` (structured clone).
- **Isolation:** Worker has no DOM access, no network access (except WASM loading).
- **Sanitization:** All inputs validated against schema before passing to WASM.

This architecture ensures the UI remains buttery smooth (60fps) even while the CPU is maxed out generating the ZK proof.
