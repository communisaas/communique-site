# ZK Proof Generation - Browser WASM Integration

This module provides browser-native ZK proof generation using the `@voter-protocol/noir-prover` WASM package.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Application                      │
├─────────────────────────────────────────────────────────────┤
│  Svelte Components → proof-generation.svelte.ts (Store)    │
│                              ↓                               │
│                     prover-client.ts (API)                  │
│                              ↓                               │
│                  @voter-protocol/noir-prover                │
│                   (WASM + Barretenberg)                     │
└─────────────────────────────────────────────────────────────┘
```

## Files

### `prover-client.ts`
Low-level prover wrapper with singleton management, input validation, and progress tracking.

**Key Functions:**
- `initializeProver(depth, onProgress)` - Initialize prover (cached)
- `generateProof(inputs, onProgress)` - Generate ZK proof
- `validateFieldElement(value, name)` - BN254 validation

### `witness-builder.ts`
Constructs circuit inputs from application-level data.

**Key Functions:**
- `buildWitness(registration, userSecret, actionDomain, authorityLevel)` - Build circuit inputs
- `validateFieldElement(value, name)` - Input validation
- `derivePathIndices(leafIndex, depth)` - Debug helper

### `proof-generation.svelte.ts`
Svelte 5 runes-based reactive store for proof generation state.

**Key Functions:**
- `getProofState()` - Get reactive state
- `initProver()` - Warm up prover
- `generate(inputs)` - Generate proof
- `reset()` - Clear state

## Usage Example

```typescript
import { buildWitness } from '$lib/core/zkp/witness-builder';
import { getProofState, initProver, generate } from '$lib/stores/proof-generation.svelte';

// 1. Get reactive state (Svelte component)
const proofState = getProofState();

// 2. Initialize prover early (hide latency)
await initProver();

// 3. Build witness from registration data
const registration = {
  identityCommitment: '0x1234...',
  merkleRoot: '0x5678...',
  merklePath: [...], // 20 siblings
  leafIndex: 42,
  districtId: '0xabcd...',
  registrationSalt: '0xef01...'
};

const witness = await buildWitness(
  registration,
  userSecret,      // From secure storage
  actionDomain,    // From contract
  authorityLevel   // 1-5
);

// 4. Generate proof
const result = await generate(witness);

// 5. Use proof
console.log('Proof:', result.proof);
console.log('Nullifier:', result.publicInputs.nullifier);
console.log('Authority:', result.publicInputs.authorityLevel);
```

## Svelte Component Example

```svelte
<script lang="ts">
  import { getProofState, initProver, generate } from '$lib/stores/proof-generation.svelte';

  const state = getProofState();

  onMount(async () => {
    await initProver(); // Warm up on page load
  });

  async function handleGenerateProof() {
    const inputs = {
      merkleRoot: '0x...',
      actionDomain: '0x...',
      userSecret: '0x...',
      districtId: '0x...',
      authorityLevel: 1,
      registrationSalt: '0x...',
      merklePath: [...],
      leafIndex: 42
    };

    await generate(inputs);
  }
</script>

{#if state.isGenerating}
  <div class="progress">
    <span>{state.progress.message}</span>
    <progress value={state.progress.percent} max={100} />
  </div>
{/if}

{#if state.error}
  <div class="error">{state.error}</div>
{/if}

{#if state.result}
  <div class="success">
    <h3>Proof Generated!</h3>
    <code>{state.result.proof.slice(0, 20)}...</code>
  </div>
{/if}

<button onclick={handleGenerateProof} disabled={state.isGenerating}>
  Generate Proof
</button>
```

## Security Invariants

1. **Singleton Management**: Prover initialized once per depth and cached (SA-006: clear on failure)
2. **Field Validation**: All inputs validated against BN254 modulus before proving
3. **Path Length**: Merkle path must have exactly 20 siblings (depth-20 circuits)
4. **Non-Blocking**: All operations are async via WASM (never blocks main thread)
5. **Concurrency**: Only one proof generation at a time (prevents race conditions)

## Performance

- **First Load**: ~1-2s (circuit download + WASM initialization)
- **Subsequent Proofs**: ~3-5s (proving time only, prover cached)
- **Warmup Strategy**: Call `initProver()` on app load or route entry to hide latency

## Control Flow

### Initialization
```
initializeProver()
  → Check cache (return if exists)
  → getProverForDepth(20)
    → Load circuit JSON (lazy)
    → Initialize Barretenberg backend
    → Cache instance
  → Return cached prover
```

### Proof Generation
```
generate(inputs)
  → Validate inputs (fail fast)
  → initializeProver() (cached if already initialized)
  → generateProof()
    → Map to circuit inputs
    → prover.prove() (WASM)
      → Generate witness
      → Generate proof
    → Format result
  → Update state reactively
```

## Error Handling

All errors are caught and exposed via the store's `error` state:

```typescript
try {
  await generate(inputs);
} catch (error) {
  console.error('Proof generation failed:', error);
  // Error is also in proofState.error
}
```

## Testing

```typescript
import { resetProver } from '$lib/core/zkp/prover-client';
import { reset } from '$lib/stores/proof-generation.svelte';

// Reset between tests
afterEach(() => {
  resetProver();
  reset();
});
```

## Dependencies

- `@voter-protocol/noir-prover@^0.1.4` - WASM prover package
- `@aztec/bb.js@^2.1.9` - Barretenberg backend (transitive)
- `@noir-lang/noir_js@^1.0.0-beta.16` - Witness generation (transitive)

## Browser Compatibility

- **Multithreading**: Requires COOP/COEP headers for SharedArrayBuffer
- **WASM**: All modern browsers (Chrome 87+, Firefox 89+, Safari 15.2+)
- **BigInt**: ES2020+ (all modern browsers)

Without COOP/COEP headers, proving falls back to single-threaded mode (slower but functional).
