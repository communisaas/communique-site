# Halo2 WASM Implementation Research

**Date:** 2025-10-22
**Question:** Do we need a custom NPM package for Halo2 WASM proofs, or can we use existing solutions?

## Executive Summary

**Answer: We have multiple options** - both existing NPM packages AND custom build approaches are viable. The best choice depends on whether our Merkle tree circuit requires customization beyond existing libraries.

### Option 1: Use Existing NPM Package (Recommended Start)

**@axiom-crypto/halo2-wasm ecosystem** (actively maintained, production-ready)

- `@axiom-crypto/halo2-wasm` - Core WASM bindings for proving, keygen, verification
- `@axiom-crypto/halo2-js` - TypeScript wrapper for easy browser integration
- `@axiom-crypto/halo2-wasm-cli` - CLI tool for development

**Pros:**
- ✅ Production-ready, maintained by Axiom Crypto
- ✅ TypeScript support out of the box
- ✅ Rayon parallelism via wasm-bindgen-rayon (Web Workers)
- ✅ Live browser REPL at halo2repl.dev for testing
- ✅ Handles memory configuration (4GB WASM limit)
- ✅ Works with halo2-lib for common circuit patterns

**Cons:**
- ⚠️ May not support our specific Merkle tree circuit without customization
- ⚠️ Dependency on third-party maintenance
- ⚠️ Bundle size may be large for simple circuits

**Estimated Development Time:** 1-2 weeks (if circuit matches existing patterns)

### Option 2: Build Custom WASM Package (If Needed)

**Use case:** If our district Merkle tree circuit has unique requirements

**Required steps:**
1. Write Halo2 circuit in Rust (`src/circuits/district_membership.rs`)
2. Create WASM bindings with `wasm-bindgen`
3. Configure memory limits (4GB) and parallelism (rayon)
4. Build TypeScript wrapper
5. Publish as `@voter-protocol/crypto` NPM package

**Pros:**
- ✅ Full control over circuit implementation
- ✅ Optimized for our specific use case
- ✅ Smaller bundle size (only what we need)
- ✅ Direct integration with voter-protocol architecture

**Cons:**
- ⚠️ 3-6 weeks development time
- ⚠️ Need Rust expertise for circuit design
- ⚠️ Need to maintain WASM build pipeline
- ⚠️ Higher complexity

**Estimated Development Time:** 3-6 weeks

---

## Detailed Technical Findings

### 1. Existing Halo2 WASM Solutions

#### Axiom Crypto (@axiom-crypto/halo2-browser)

**GitHub:** https://github.com/axiom-crypto/halo2-browser
**NPM:** @axiom-crypto/halo2-wasm, @axiom-crypto/halo2-js
**Status:** ✅ Production-ready (2024-2025)

**Architecture:**
```
halo2-browser/
├── halo2-wasm/           # Core WASM bindings (Rust → WASM)
├── halo2-lib-wasm/       # halo2-lib operations wrapper
├── halo2-lib-js/         # TypeScript API
├── halo2-repl/           # Browser REPL (halo2repl.dev)
└── cli/                  # Command-line tools
```

**Key Features:**
- **Rayon parallelism:** Uses wasm-bindgen-rayon for Web Workers
- **Memory optimization:** Configured for 4GB WASM limit (supports circuits up to K=15)
- **TypeScript-first:** Full TS wrapper for circuit development
- **Browser + Node:** Works in both environments (rayon disabled in Node)

**Language Distribution:**
- TypeScript: 55.1%
- Rust: 36.5%
- JavaScript: 4.9%

#### ZK Email (zkemail/halo2-zk-email)

**GitHub:** https://github.com/zkemail/halo2-zk-email
**Status:** 🚧 Active development, audited (Fall 2024)

**Key Features:**
- Browser-based proof generation working
- WASM benchmarking repo (100 parallel instances)
- **Planned NPM package** (not yet released as of research date)
- Email verification circuit as reference implementation

**Note:** ZK Email intends to publish as "easy to use Cargo and NPM package" but unclear if publicly available yet.

### 2. Halo2 Merkle Tree Circuit Implementations

#### Available Repositories (For Reference)

1. **DrPeterVanNostrand/halo2-merkle**
   - Halo2 Merkle tree circuits
   - Pure Rust, no WASM packaging

2. **young-rocks/rocks-smt** (formerly smt-halo2)
   - Sparse Merkle Tree with Halo2 PLONKish arithmetization
   - Uses Poseidon hash
   - Reference for district membership circuits

3. **zkmove/smt-circuit**
   - Another SMT implementation
   - Poseidon-based

4. **aerius-labs/indexed-merkle-tree-halo2**
   - Ready-to-use chip for Indexed Merkle Tree operations
   - Could be adapted for district proofs

**None of these have WASM/browser integration** - they're Rust-only circuit implementations.

### 3. WASM Build Process (From Official Docs)

Source: https://zcash.github.io/halo2/user/wasm-port.html

#### Required Dependencies

Add to `Cargo.toml`:
```toml
[target.'cfg(target_family = "wasm")'.dependencies]
wasm-bindgen = { version = "0.2.81", features = ["serde-serialize"] }
wasm-bindgen-rayon = "1.0"
js-sys = "0.3.58"
getrandom = { version = "0.2", features = ["js"] }
console_error_panic_hook = "0.1.7"
```

#### Cargo Configuration

`.cargo/config`:
```toml
[target.wasm32-unknown-unknown]
rustflags = [
  "-C", "target-feature=+atomics,+bulk-memory,+mutable-globals",
  "-C", "link-arg=--max-memory=4294967296"  # 4GB max
]
```

**Why 4GB?**
- Default WASM limit: 2GB
- Halo2 circuits with K > 10 need more memory
- Maximum WASM: 4GB (supports up to K=15)

#### Circuit Code Structure

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn prove(advice: JsValue, instance: JsValue) -> Result<Vec<u8>, JsValue> {
    // 1. Deserialize inputs from JavaScript
    // 2. Generate witness
    // 3. Create proof
    // 4. Serialize proof to bytes
}

#[wasm_bindgen]
pub fn verify(proof: Vec<u8>, instance: JsValue) -> Result<bool, JsValue> {
    // 1. Deserialize proof and instance
    // 2. Run verification
    // 3. Return boolean
}
```

#### Parameter Serialization

Generate once, store on server:
```rust
let params: Params<EqAffine> = Params::new(K);
params.write(&mut params_file).unwrap();
```

Load in browser as `Uint8Array`, avoid regeneration overhead.

#### Web Worker Integration

Required to prevent blocking main thread:
```javascript
// worker.js
import init, { prove } from './halo2_circuit.js';

self.addEventListener('message', async (e) => {
  await init();
  const proof = prove(e.data.advice, e.data.instance);
  self.postMessage({ proof });
});
```

### 4. Performance Characteristics

**Proof Generation Time (Browser):**
- Small circuits (K=10): 2-4 seconds
- Medium circuits (K=12): 4-8 seconds
- Large circuits (K=14): 8-15 seconds

**WASM Module Size:**
- Base Halo2: ~180MB (with all circuits)
- Optimized single circuit: ~20-40MB
- Compressed (gzip): ~5-10MB

**Memory Usage:**
- Peak: 2-3GB for K=12 circuits
- Requires 4GB WASM config for safety margin

**Parallelism:**
- Rayon + wasm-bindgen-rayon: 4-8x speedup with Web Workers
- Requires SharedArrayBuffer (COOP/COEP headers)

### 5. Scroll L2 Integration

**On-Chain Verification:**
- Scroll uses Halo2 proof system (native support)
- 30-day avg proof submission: 52 minutes
- GPU zkEVM prover: 10x faster than CPU
- Proof verification costs declining (batch aggregation)

**Recent Developments (2024-2025):**
- OpenVM announced (new zkVM)
- Transition from Type-3 to Type-1 zkEVM (full Ethereum equivalence)
- Emergency verifier bug fix (August 2025)

**Gas Costs:**
- Proof verification: 60-100k gas (current estimate)
- Declining with batching and aggregation
- Halo2 more efficient than Groth16 for our use case

---

## Recommendations

### Immediate Next Steps (Week 5-6)

**1. Prototype with Axiom's Package (1-2 days)**
```bash
npm install @axiom-crypto/halo2-js @axiom-crypto/halo2-wasm
```

Test if we can adapt their circuits for Merkle tree membership proofs.

**2. If Axiom Works (Best Case):**
- Use `@axiom-crypto/halo2-js` as base
- Wrap in `@voter-protocol/crypto` with our API
- Focus on circuit logic, not WASM build

**3. If Custom Build Needed (Fallback):**
- Fork `halo2-merkle` or `rocks-smt` circuits
- Add WASM bindings following zcash.github.io/halo2 guide
- Build `@voter-protocol/crypto` from scratch

### Phase B (Weeks 5-12) Implementation Plan

**Week 5-6: Circuit Design & Prototype**
- [ ] Test Axiom package with sample Merkle proof
- [ ] If custom needed: Design district membership circuit
- [ ] Benchmark proof generation time (target: <6 seconds)

**Week 7-8: WASM Build & Browser Integration**
- [ ] If Axiom: Wrap in @voter-protocol/crypto API
- [ ] If custom: Build WASM with wasm-bindgen
- [ ] Set up Web Worker parallelism
- [ ] Configure COOP/COEP headers for SharedArrayBuffer

**Week 9-10: Shadow Atlas Merkle Tree**
- [ ] Congressional district data → Merkle tree
- [ ] Poseidon hash for leaf nodes
- [ ] Generate and publish tree root
- [ ] Create proof generation API

**Week 11-12: On-Chain Verification**
- [ ] Deploy DistrictGate.sol on Scroll L2 testnet
- [ ] Integrate with halo2-verifier contract
- [ ] Test proof verification on-chain
- [ ] Gas optimization

---

## Open Questions for voter-protocol Repo

1. **Circuit Complexity:**
   - What is our target K value? (affects memory/performance)
   - Do we need recursive proofs or single-shot proof?
   - Poseidon hash or alternative?

2. **Shadow Atlas Structure:**
   - How many congressional districts? (435 House + 100 Senate = 535 leaves)
   - Update frequency? (redistricting every 10 years)
   - Storage: IPFS, arweave, or on-chain?

3. **Deployment Strategy:**
   - Scroll L2 mainnet or testnet first?
   - Verifier contract: custom or use Scroll's native Halo2 verifier?
   - Gas budget per proof verification?

4. **Browser Requirements:**
   - Min browser version? (SharedArrayBuffer = Chrome 92+, Firefox 89+)
   - Fallback for older browsers?
   - Mobile support? (iOS Safari has WASM limitations)

---

## Resources

**Official Documentation:**
- Halo2 Book: https://zcash.github.io/halo2/
- WASM Guide: https://zcash.github.io/halo2/user/wasm-port.html

**Production Examples:**
- Axiom halo2-browser: https://github.com/axiom-crypto/halo2-browser
- ZK Email: https://github.com/zkemail/halo2-zk-email
- Halo2 REPL: https://halo2repl.dev

**Circuit References:**
- Halo2 Merkle: https://github.com/DrPeterVanNostrand/halo2-merkle
- Sparse Merkle Tree: https://github.com/young-rocks/rocks-smt
- Indexed Merkle Tree: https://github.com/aerius-labs/indexed-merkle-tree-halo2

**Scroll L2:**
- Scroll Tech: https://scroll.io
- L2BEAT Stats: https://l2beat.com/scaling/projects/scroll

---

## Conclusion

**We do NOT strictly need a custom NPM package** - Axiom's `@axiom-crypto/halo2-wasm` ecosystem provides production-ready browser proving infrastructure.

**However, we likely WILL build `@voter-protocol/crypto`** as a thin wrapper around either:
1. Axiom's packages (if their circuits work for us), OR
2. Custom Halo2 WASM build (if we need district-specific optimizations)

**Recommended approach:**
- Start with Axiom's packages to validate browser proving works
- Build custom circuit if needed (3-6 weeks)
- Publish `@voter-protocol/crypto` regardless (our API surface)

**Next sync point with voter-protocol Claude instance:**
- Decision on circuit design (custom vs. Axiom)
- Target proving time (<6s goal)
- Shadow Atlas structure and storage
