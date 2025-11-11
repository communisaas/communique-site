# District Verification: Communiqué Responsibilities

**Date**: 2025-01-09
**Critical Insight**: voter-protocol OWNS Shadow Atlas, geocoding, Merkle trees. Communiqué is a THIN CLIENT.

---

## The Correct Architecture Separation

### ❌ WRONG (What I Initially Designed)

**Communiqué doing everything**:
- Browser builds Merkle trees
- Browser loads district boundaries
- Browser does geocoding
- Browser generates proofs

**Problem**: Massive complexity duplication. voter-protocol already has:
- Shadow Atlas infrastructure (`/packages/crypto/data/`)
- Geocoding services (`/packages/crypto/services/geocoding/`)
- District resolver (`/packages/crypto/services/district-resolver.ts`)
- Merkle tree generation (`/scripts/build-shadow-atlas.ts`)
- Halo2 WASM prover (`/packages/crypto/circuits/` - Rust compiled to WASM)

---

### ✅ CORRECT (Proper Responsibility Separation)

## voter-protocol Responsibilities (OWNS THE INFRASTRUCTURE)

### 1. Shadow Atlas Generation (Off-Chain, Pre-Built)

**Location**: `/packages/crypto/`

**Responsibilities**:
- Download city council district GeoJSON files (50 cities)
- Geocode addresses to lat/lng (Geocodio: $0.0005/address)
- Point-in-polygon district resolution (turf.js)
- Build 50 state-based Merkle trees (one per US state)
- Publish to IPFS (CIDv1, immutable)
- Update quarterly (after redistricting events)

**Output**:
```typescript
// Published to IPFS: /ipfs/Qm.../shadow-atlas/
{
  "version": "v2025.Q1",
  "states": {
    "TX": {
      "merkleRoot": "0x1234...",
      "tree": "ipfs://Qm.../TX.merkle",  // Binary tree structure
      "districts": [
        {
          "id": "TX-25",
          "type": "congressional",
          "population": 700000
        },
        {
          "id": "TX-Austin-District-1",
          "type": "city_council",
          "population": 80000
        }
      ]
    },
    "CA": { ... },
    // ... 48 more states
  }
}
```

---

### 2. Geocoding Service (Runtime, Provider-Agnostic)

**Location**: `/packages/crypto/services/geocoding/`

**Already implemented**:
```typescript
// voter-protocol/packages/crypto/services/geocoding/index.ts
export class GeocodingService {
  // Abstraction - supports Geocodio, Nominatim, Google Maps, Mapbox
  async geocode(address: Address): Promise<GeocodeResult> {
    const provider = this.selectProvider(address.country);
    return await provider.geocode(address);
  }
}
```

**Providers implemented**:
- ✅ Geocodio (US + CA, $0.0005/lookup)
- ✅ Nominatim (Global, FREE)

**Communiqué does NOT reimplement geocoding**. voter-protocol provides it as a service.

---

### 3. District Resolution (Runtime, Multi-Tier)

**Location**: `/packages/crypto/services/district-resolver.ts`

**Already implemented**:
```typescript
export class DistrictResolver {
  async resolveDistricts(address: Address): Promise<District[]> {
    // Tier 1: City council (if available)
    const cityCouncil = await this.resolveCityCouncil(address);
    if (cityCouncil) return [cityCouncil];

    // Tier 2: Census Bureau API (congressional + state legislature)
    return await this.resolveCensusDistricts(address);
  }
}
```

**Communiqué calls this as a service**. voter-protocol handles the complexity.

---

### 4. Halo2 ZK Proof Generation (Browser WASM)

**Location**: `/packages/crypto/circuits/` (Rust)

**Already implemented**:
- Halo2 K=14 circuit (16,384 rows, 117,473 cells)
- Compiled to WASM for browser execution
- 8-15s mobile proving time
- 384-512 byte proofs
- NO trusted setup (KZG from Ethereum ceremony)

**Output**: WASM binary published to npm:
```bash
npm install @voter-protocol/zk-prover-wasm
```

**Communiqué imports and executes WASM**:
```typescript
import { generateProof } from '@voter-protocol/zk-prover-wasm';

const proof = await generateProof({
  district: "TX-25",
  userPubkey: "0xabc...",
  merkleProof: stateTree.getProof(leaf)
});
```

---

### 5. Smart Contracts (On-Chain Verification)

**Location**: `/contracts/src/`

**Already deployed** (Scroll zkEVM):
- `DistrictRegistry.sol` - 50 state Merkle roots
- `DistrictGate.sol` - Master verification contract
- `Halo2Verifier.sol` - On-chain proof verifier

**Communiqué submits transactions**, voter-protocol validates.

---

## Communiqué Responsibilities (THIN CLIENT)

### 1. Address Collection UI

**What**: Simple form for user to enter address

```svelte
<!-- src/lib/components/auth/AddressCollectionModal.svelte -->
<script lang="ts">
  let street = $state('');
  let city = $state('');
  let state = $state('');
  let zipCode = $state('');

  async function handleSubmit() {
    // Send to voter-protocol client
    const districts = await voterClient.resolveDistricts({
      street,
      city,
      state,
      zipCode,
      country: 'US'
    });
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={street} placeholder="Street address" />
  <input bind:value={city} placeholder="City" />
  <input bind:value={state} placeholder="State" />
  <input bind:value={zipCode} placeholder="Zip code" />
  <button type="submit">Verify Districts</button>
</form>
```

**Privacy**: Address stays in browser, sent to voter-protocol client (which runs locally).

---

### 2. VOTER Protocol Client Integration

**What**: Import and use voter-protocol client library

```typescript
// src/lib/core/district/voter-client.ts
import { VOTERClient } from '@voter-protocol/client';

export const voterClient = new VOTERClient({
  network: 'scroll-mainnet',
  ipfsGateway: 'https://ipfs.io/ipfs/',
  geocodingApiKey: import.meta.env.VITE_GEOCODIO_API_KEY
});

// This client handles EVERYTHING:
// - Geocoding (via voter-protocol/services/geocoding)
// - District resolution (via voter-protocol/services/district-resolver)
// - Shadow Atlas loading (from IPFS)
// - Merkle proof generation (via voter-protocol/crypto/circuits WASM)
// - Blockchain submission (via voter-protocol/contracts)
```

**Key insight**: Communiqué doesn't reimplement ANY of this. It's all in voter-protocol.

---

### 3. Proof Generation Flow (Browser)

```typescript
// src/lib/core/district/verification-flow.ts
import { voterClient } from './voter-client';

export async function verifyDistrict(address: Address) {
  // Step 1: Resolve districts (calls voter-protocol services)
  const districts = await voterClient.resolveDistricts(address);

  // Step 2: Generate proof (calls voter-protocol WASM prover)
  const proof = await voterClient.generateProof({
    district: districts.congressional,
    userPubkey: await getUserPublicKey(),
    stateCode: address.state
  });

  // Step 3: Submit to blockchain (calls voter-protocol contracts)
  const txHash = await voterClient.submitProof({
    stateCode: address.state,
    commitment: proof.commitment,
    proof: proof.merkleProof
  });

  return { txHash, proof, districts };
}
```

**Communiqué orchestrates** the flow. voter-protocol provides all the pieces.

---

### 4. Store Verification Result (Database)

```typescript
// src/routes/api/user/verify-district/+server.ts
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const {
    stateCode,
    commitment,
    txHash
  }: {
    stateCode: string;
    commitment: string;
    txHash: string;
  } = await request.json();

  // ONLY store:
  // 1. Commitment hash (not reversible)
  // 2. State code (30M anonymity set)
  // 3. Transaction hash (public blockchain data)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      district_commitment: commitment,
      state_code: stateCode,
      merkle_root: await voterClient.getStateRoot(stateCode),
      proof_verified: true,
      verified_at: new Date(),

      // DELETE any existing plaintext location data
      city: null,
      state: null,
      zip: null,
      congressional_district: null,
      latitude: null,
      longitude: null
    }
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

---

### 5. Display Verification Status

```svelte
<!-- src/lib/components/auth/VerificationPrompt.svelte -->
<script lang="ts">
  import type { User } from '@prisma/client';

  let { user }: { user: User } = $props();
</script>

{#if user.proof_verified}
  <div class="verification-badge">
    ✅ District Verified (State: {user.state_code})
  </div>
{:else}
  <button onclick={() => startVerification()}>
    Verify Your District
  </button>
{/if}
```

---

## What Communiqué Does NOT Do

### ❌ Build Merkle Trees
**voter-protocol does this**: `/scripts/build-shadow-atlas.ts`

### ❌ Load District Boundaries
**voter-protocol does this**: Shadow Atlas on IPFS

### ❌ Geocode Addresses
**voter-protocol does this**: `/packages/crypto/services/geocoding/`

### ❌ Resolve Districts
**voter-protocol does this**: `/packages/crypto/services/district-resolver.ts`

### ❌ Generate Halo2 Proofs
**voter-protocol does this**: `/packages/crypto/circuits/` (WASM)

### ❌ Verify Proofs On-Chain
**voter-protocol does this**: `/contracts/src/Halo2Verifier.sol`

---

## Data Model Changes Required in Communiqué

### DELETE Privacy-Leaking Fields:

```sql
-- Remove plaintext location fields from User
ALTER TABLE user
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip,
  DROP COLUMN IF EXISTS congressional_district,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

-- Delete LocationCache entirely (voter-protocol handles this)
DROP TABLE IF EXISTS location_cache CASCADE;
DROP TABLE IF EXISTS cicero_budget CASCADE;
```

---

### ADD Zero-Knowledge Fields:

```sql
ALTER TABLE user
  ADD COLUMN district_commitment TEXT UNIQUE,
  ADD COLUMN state_code TEXT,
  ADD COLUMN merkle_root TEXT,
  ADD COLUMN proof_verified BOOLEAN DEFAULT false,
  ADD COLUMN verified_at TIMESTAMP;

CREATE INDEX idx_user_district_commitment ON user(district_commitment);
CREATE INDEX idx_user_state_code ON user(state_code);
```

---

## Integration Points

### 1. Install voter-protocol Client

```bash
cd /Users/noot/Documents/communique
npm install @voter-protocol/client
npm install @voter-protocol/zk-prover-wasm
```

---

### 2. Configure voter-protocol Client

```typescript
// src/lib/config/voter-protocol.ts
import { VOTERClient } from '@voter-protocol/client';

export const voterClient = new VOTERClient({
  // Blockchain
  network: import.meta.env.VITE_SCROLL_NETWORK || 'scroll-mainnet',
  rpcUrl: import.meta.env.VITE_SCROLL_RPC_URL,

  // Smart Contracts (deployed by voter-protocol)
  districtRegistryAddress: import.meta.env.VITE_DISTRICT_REGISTRY_ADDRESS,
  districtGateAddress: import.meta.env.VITE_DISTRICT_GATE_ADDRESS,

  // Shadow Atlas
  ipfsGateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  shadowAtlasCID: import.meta.env.VITE_SHADOW_ATLAS_CID, // Published by voter-protocol

  // Geocoding (voter-protocol service)
  geocodingApiKey: import.meta.env.VITE_GEOCODIO_API_KEY,
  geocodingStrategy: 'cost-optimized', // or 'accuracy-first'

  // WASM Prover (voter-protocol circuit)
  wasmProverUrl: '/wasm/halo2-prover.wasm' // Bundled from npm package
});
```

---

### 3. Use in Components

```typescript
// src/lib/core/district/verification.ts
import { voterClient } from '$lib/config/voter-protocol';

export async function verifyUserDistrict(address: {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  try {
    // voter-protocol handles EVERYTHING
    const result = await voterClient.verifyDistrict({
      ...address,
      country: 'US'
    });

    return {
      success: true,
      commitment: result.commitment,
      txHash: result.transactionHash,
      stateCode: result.stateCode,
      districts: result.districts
    };
  } catch (error) {
    console.error('District verification failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

---

## File Structure (Communiqué)

### NEW Files (Minimal):

```
src/lib/
├── config/
│   └── voter-protocol.ts           # Client configuration
├── core/
│   └── district/
│       ├── verification.ts         # Orchestration (calls voter-protocol client)
│       └── types.ts                # TypeScript types (re-export from @voter-protocol/client)
└── components/
    └── auth/
        ├── AddressCollectionModal.svelte   # Simple address form
        └── VerificationPrompt.svelte       # Status display
```

### DELETE Files (Complexity Now in voter-protocol):

```bash
# DELETE ENTIRE DIRECTORIES:
rm -rf src/lib/core/location/              # voter-protocol/services/geocoding
rm -rf src/routes/api/location/           # voter-protocol/services/district-resolver

# DELETE SPECIFIC FILES:
rm src/lib/core/census/district-lookup.ts  # voter-protocol/services/census-geocoder
rm src/lib/core/census/fips-lookup.ts      # voter-protocol/services/district-resolver
```

---

## Dependencies (package.json)

```json
{
  "dependencies": {
    "@voter-protocol/client": "^0.1.0",
    "@voter-protocol/zk-prover-wasm": "^0.1.0",
    "ethers": "^5.7.2"
  }
}
```

**Key insight**: Communiqué does NOT depend on:
- ❌ `merkletreejs` (voter-protocol builds trees off-chain)
- ❌ `@turf/turf` (voter-protocol does point-in-polygon)
- ❌ `keccak256` (voter-protocol WASM handles hashing)
- ❌ Geocoding libraries (voter-protocol abstracts providers)

---

## Cost Analysis

### voter-protocol Costs (Infrastructure):
- Shadow Atlas generation: $25k one-time (50M addresses × $0.0005 Geocodio)
- IPFS hosting: $50/month (Pinata/Infura)
- Quarterly updates: $5k/quarter (redistricting events)

### Communiqué Costs (Zero):
- Client library: FREE (npm package)
- WASM prover: FREE (runs in browser)
- Geocoding: FREE (voter-protocol service abstraction)
- District resolution: FREE (voter-protocol service)

**Total Communiqué cost**: $0 infrastructure (thin client)

---

## The Bottom Line

**voter-protocol OWNS**:
- Shadow Atlas infrastructure
- Geocoding services (provider-agnostic)
- District resolution (multi-tier)
- Halo2 ZK circuit + WASM prover
- Smart contracts on Scroll zkEVM
- Merkle tree generation and IPFS publishing

**Communiqué USES**:
- `@voter-protocol/client` (npm package)
- `@voter-protocol/zk-prover-wasm` (npm package)
- Simple UI for address collection
- Database storage of commitment hash only
- Orchestration of verification flow

**Result**: Communiqué is a THIN CLIENT (200-300 lines of code) instead of reimplementing 5,000+ lines of cryptographic infrastructure.

---

## Migration Checklist

**Phase 1: Install Dependencies**
- [ ] `npm install @voter-protocol/client @voter-protocol/zk-prover-wasm`
- [ ] Configure client in `src/lib/config/voter-protocol.ts`
- [ ] Test connection to Scroll zkEVM

**Phase 2: Database Migration**
- [ ] Add zero-knowledge fields to User model
- [ ] Delete plaintext location fields
- [ ] Delete LocationCache table
- [ ] Run migration on staging

**Phase 3: Delete Old Code**
- [ ] Delete `src/lib/core/location/` directory
- [ ] Delete `src/routes/api/location/` directory
- [ ] Delete Census integration files
- [ ] Update imports across codebase

**Phase 4: Implement Thin Client**
- [ ] Create `src/lib/core/district/verification.ts`
- [ ] Update `AddressCollectionModal.svelte` to use voter-protocol client
- [ ] Update `VerificationPrompt.svelte` to show commitment status
- [ ] Test end-to-end verification flow

**Total timeline**: 1-2 weeks (vs 5-8 weeks for full reimplementation)

---

**Next step**: Install voter-protocol client packages and configure integration.
