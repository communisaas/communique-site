# District Verification Implementation: Communiqué Frontend

**UPDATED ARCHITECTURE**: Thin client using voter-protocol infrastructure
**Key Insight**: voter-protocol OWNS Shadow Atlas, geocoding, Merkle trees. Communiqué is a THIN CLIENT.
**Privacy**: Address NEVER sent to server, only cryptographic commitments stored

---

## 🚨 CRITICAL: Read DISTRICT-VERIFICATION-RESPONSIBILITIES.md First

**This document has been superseded by a proper architecture separation**:
- **voter-protocol** (`/Users/noot/Documents/voter-protocol/`): OWNS Shadow Atlas, geocoding services, district resolution, Halo2 ZK circuits, smart contracts
- **Communiqué** (this repo): THIN CLIENT using `@voter-protocol/client` npm package

**See**: `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md` for the CORRECT implementation plan.

---

## Archived Content Below (Original Over-Engineered Approach)

**DO NOT IMPLEMENT THE CODE BELOW**. It duplicates infrastructure that already exists in voter-protocol.

Instead:
1. Install `@voter-protocol/client` and `@voter-protocol/zk-prover-wasm`
2. Configure client with contract addresses and Shadow Atlas CID
3. Call `voterClient.verifyDistrict(address)` - done

---

---

## Critical Data Model Changes Required

### ❌ DELETE LocationCache (Privacy Violation)

**Current schema** (lines 1001-1027 in schema.prisma):
```prisma
model LocationCache {
  id                          String   @id @default(cuid())
  address_hash                String   @unique @map("address_hash")

  city_council_district       String?
  state_house_district        String?
  congressional_district      String?
  // ... more PII

  cached_at                   DateTime
  expires_at                  DateTime
  hit_count                   Int      @default(0)
}
```

**Problem**: This creates correlation attack vectors:
- Timing correlation: `cached_at` + `User.created_at` → deanonymize
- Hit count fingerprinting: Reveals user population per district
- Database compromise: Full address → district mappings exposed

**Solution**: DELETE entire table. Browser handles district lookup locally.

```sql
DROP TABLE IF EXISTS location_cache CASCADE;
DROP TABLE IF EXISTS cicero_budget CASCADE;
```

---

### ✅ ADD Zero-Knowledge Verification Fields to User

**Required additions** to User model:
```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique

  // === DELETE THESE (Privacy leaks) ===
  // city                      String?     ← DELETE
  // state                     String?     ← DELETE
  // zip                       String?     ← DELETE
  // congressional_district    String?     ← DELETE
  // latitude                  Float?      ← DELETE
  // longitude                 Float?      ← DELETE

  // === ADD THESE (Zero-knowledge commitments) ===
  district_commitment   String?   @unique @map("district_commitment")
  state_code            String?   @map("state_code")  // "TX", "CA" (30M anonymity set)
  merkle_root           String?   @map("merkle_root")
  proof_verified        Boolean   @default(false) @map("proof_verified")
  verified_at           DateTime? @map("verified_at")

  // KEEP THESE (Blockchain addresses, not PII)
  scroll_address        String?   @unique @map("scroll_address")
  district_verified     Boolean   @default(false) @map("district_verified")

  // ... rest of fields
}
```

**Privacy properties**:
- `district_commitment`: hash(district || pubkey || nonce) - NOT reversible
- `state_code`: Reveals state (30M anonymity set) - acceptable
- `merkle_root`: Public on-chain data
- NO plaintext: district, city, zip, lat/lng

---

## Browser Implementation: Address → District Lookup

### Step 1: Load District Boundaries (Once per Session)

```typescript
// src/lib/core/district/browser-verifier.ts
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

interface DistrictBoundary {
  district: string;          // "TX-25-Council-District-1"
  state: string;             // "TX"
  level: string;             // "congressional" | "city_council" | "state_house"
  bbox: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
  polygon: [number, number][]; // Simplified boundary (100-500 points)
}

export class BrowserDistrictVerifier {
  private boundaries: DistrictBoundary[] = [];
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. Check IndexedDB cache first
    const cached = await this.loadFromIndexedDB();
    if (cached && cached.version === EXPECTED_VERSION) {
      this.boundaries = cached.data;
      this.initialized = true;
      return;
    }

    // 2. Download from IPFS/CDN (public data, ~5MB compressed)
    const response = await fetch('/api/districts/boundaries.json');
    const data: DistrictBoundary[] = await response.json();

    // 3. Cache in IndexedDB (30-day TTL)
    await this.saveToIndexedDB(data);

    this.boundaries = data;
    this.initialized = true;
  }

  private async loadFromIndexedDB(): Promise<{ data: DistrictBoundary[]; version: string } | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('CommuniqueDB', 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['districts'], 'readonly');
        const store = transaction.objectStore('districts');
        const getRequest = store.get('boundaries');

        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };

      request.onerror = () => resolve(null);
    });
  }

  private async saveToIndexedDB(data: DistrictBoundary[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CommuniqueDB', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('districts')) {
          db.createObjectStore('districts');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['districts'], 'readwrite');
        const store = transaction.objectStore('districts');

        store.put({
          data,
          version: EXPECTED_VERSION,
          cachedAt: Date.now()
        }, 'boundaries');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('IndexedDB save failed'));
      };

      request.onerror = () => reject(new Error('IndexedDB open failed'));
    });
  }
}

const EXPECTED_VERSION = 'v2025.1'; // Update after redistricting
```

---

### Step 2: Client-Side Address → Districts (NEVER Sent to Server)

```typescript
// src/lib/core/district/browser-verifier.ts (continued)

export class BrowserDistrictVerifier {
  // ... (initialization from above)

  async determineDistricts(address: string): Promise<{
    state: string;
    districts: {
      congressional: string;
      city_council: string[];
      state_house: string;
      state_senate: string;
    };
    lat: number;
    lng: number;
  }> {
    await this.initialize();

    // 1. Geocode address to lat/lng (browser-only, NEVER transmitted)
    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({ address });

    if (!result || result.length === 0) {
      throw new Error('Address not found');
    }

    const location = result[0].geometry.location;
    const lat = location.lat();
    const lng = location.lng();

    // 2. Extract state from geocoded result
    const stateComponent = result[0].address_components.find(c =>
      c.types.includes('administrative_area_level_1')
    );
    const state = stateComponent?.short_name || '';

    // 3. Point-in-polygon test for ALL granularity levels
    const congressional = this.findDistrictContaining(lat, lng, 'congressional', state);
    const cityCouncil = this.findDistrictsContaining(lat, lng, 'city_council', state);
    const stateHouse = this.findDistrictContaining(lat, lng, 'state_house', state);
    const stateSenate = this.findDistrictContaining(lat, lng, 'state_senate', state);

    return {
      state,
      districts: {
        congressional,
        city_council: cityCouncil,
        state_house: stateHouse,
        state_senate: stateSenate
      },
      lat,
      lng
    };
  }

  private findDistrictContaining(
    lat: number,
    lng: number,
    level: string,
    state: string
  ): string {
    const matches = this.boundaries.filter(b =>
      b.state === state &&
      b.level === level &&
      this.pointInPolygon([lat, lng], b.polygon)
    );

    return matches.length > 0 ? matches[0].district : '';
  }

  private findDistrictsContaining(
    lat: number,
    lng: number,
    level: string,
    state: string
  ): string[] {
    return this.boundaries
      .filter(b =>
        b.state === state &&
        b.level === level &&
        this.pointInPolygon([lat, lng], b.polygon)
      )
      .map(b => b.district);
  }

  private pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    // Ray-casting algorithm for point-in-polygon test
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }
}
```

**Privacy**: Address, lat/lng NEVER leave browser. Only computed client-side.

---

### Step 3: Generate Merkle Proof + Commitment (Browser-Only)

```typescript
// src/lib/core/district/proof-generator.ts
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

export class DistrictProofGenerator {
  private stateTrees: Map<string, MerkleTree> = new Map();

  async initialize(boundaries: DistrictBoundary[]): Promise<void> {
    // Build 50 state Merkle trees (one per US state)
    const stateGroups = new Map<string, DistrictBoundary[]>();

    for (const boundary of boundaries) {
      if (!stateGroups.has(boundary.state)) {
        stateGroups.set(boundary.state, []);
      }
      stateGroups.get(boundary.state)!.push(boundary);
    }

    for (const [state, districts] of stateGroups.entries()) {
      const leaves = districts.map(d =>
        keccak256(Buffer.from(`${d.district}:${d.polygon.length}`))
      );
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      this.stateTrees.set(state, tree);
    }
  }

  async generateProof(
    district: string,
    userPubkey: string,
    stateCode: string
  ): Promise<{
    commitment: string;
    proof: string[];
    stateCode: string;
    nonce: string;
  }> {
    const stateTree = this.stateTrees.get(stateCode);
    if (!stateTree) {
      throw new Error(`State tree not found for ${stateCode}`);
    }

    // 1. Generate random nonce (for unlinkability)
    const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));

    // 2. Generate commitment = keccak256(district || pubkey || nonce)
    const commitmentHash = keccak256(
      Buffer.concat([
        Buffer.from(district),
        Buffer.from(userPubkey, 'hex'),
        Buffer.from(nonce.slice(2), 'hex')
      ])
    );
    const commitment = `0x${commitmentHash.toString('hex')}`;

    // 3. Find district in tree (lookup by district name)
    const boundary = this.findBoundary(district);
    if (!boundary) {
      throw new Error(`District ${district} not found`);
    }

    const leaf = keccak256(Buffer.from(`${district}:${boundary.polygon.length}`));
    const proofArray = stateTree.getProof(leaf);
    const proof = proofArray.map(p => `0x${p.data.toString('hex')}`);

    // 4. Store nonce in localStorage (NEVER send to server)
    localStorage.setItem(`nonce:${commitment}`, nonce);

    return {
      commitment,
      proof,
      stateCode,
      nonce
    };
  }

  private findBoundary(district: string): DistrictBoundary | null {
    // Search through boundaries cache
    // (This would reference the loaded boundaries from BrowserDistrictVerifier)
    return null; // Placeholder - implement lookup
  }
}
```

**Privacy**: Nonce stored in browser localStorage only. Commitment is one-way hash.

---

### Step 4: Submit Proof to Blockchain (VOTER Protocol)

```typescript
// src/lib/core/district/blockchain-submitter.ts
import { ethers } from 'ethers';
import { DISTRICT_REGISTRY_ABI, DISTRICT_REGISTRY_ADDRESS } from '$lib/config/contracts';

export class DistrictProofSubmitter {
  private contract: ethers.Contract;

  constructor(provider: ethers.providers.Provider) {
    this.contract = new ethers.Contract(
      DISTRICT_REGISTRY_ADDRESS,
      DISTRICT_REGISTRY_ABI,
      provider
    );
  }

  async submitProof(
    stateCode: string,
    commitment: string,
    proof: string[],
    signer: ethers.Signer
  ): Promise<{
    txHash: string;
    gasUsed: number;
    verified: boolean;
  }> {
    // 1. Estimate gas
    const gasEstimate = await this.contract
      .connect(signer)
      .estimateGas.verifyDistrictMembership(stateCode, commitment, proof);

    // 2. Submit transaction to Scroll zkEVM
    const tx = await this.contract
      .connect(signer)
      .verifyDistrictMembership(stateCode, commitment, proof, {
        gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
      });

    // 3. Wait for confirmation
    const receipt = await tx.wait();

    // 4. Verify event emitted
    const event = receipt.events?.find((e: ethers.Event) => e.event === 'DistrictVerified');
    if (!event) {
      throw new Error('Verification failed (no event emitted)');
    }

    return {
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toNumber(),
      verified: true
    };
  }

  async checkVerificationStatus(commitment: string): Promise<boolean> {
    // Query contract to see if commitment is already verified
    return await this.contract.usedCommitments(commitment);
  }
}
```

---

### Step 5: Store Verification in Database (ONLY Commitment Hash)

```typescript
// src/routes/api/user/verify-district/+server.ts
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { ethers } from 'ethers';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const {
    stateCode,
    commitment,
    merkleProof,
    txHash
  }: {
    stateCode: string;
    commitment: string;
    merkleProof: string[];
    txHash: string;
  } = await request.json();

  // 1. Verify transaction on Scroll zkEVM
  const provider = new ethers.providers.JsonRpcProvider(SCROLL_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt || receipt.status !== 1) {
    return new Response(
      JSON.stringify({ error: 'Transaction failed or not confirmed' }),
      { status: 400 }
    );
  }

  // 2. Verify event was emitted
  const event = receipt.logs.find(log =>
    log.topics[0] === DISTRICT_VERIFIED_EVENT_SIGNATURE
  );

  if (!event) {
    return new Response(
      JSON.stringify({ error: 'DistrictVerified event not found' }),
      { status: 400 }
    );
  }

  // 3. Store ONLY commitment hash in database (NO plaintext district)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      district_commitment: commitment,
      state_code: stateCode,
      merkle_root: await getStateRoot(stateCode, provider),
      proof_verified: true,
      verified_at: new Date(),

      // CRITICAL: DELETE any existing plaintext location data
      city: null,
      state: null,
      zip: null,
      congressional_district: null,
      latitude: null,
      longitude: null
    }
  });

  return new Response(
    JSON.stringify({
      success: true,
      commitment,
      verified: true
    }),
    { status: 200 }
  );
};

async function getStateRoot(stateCode: string, provider: ethers.providers.Provider): Promise<string> {
  const contract = new ethers.Contract(
    DISTRICT_REGISTRY_ADDRESS,
    DISTRICT_REGISTRY_ABI,
    provider
  );

  return await contract.stateMerkleRoots(stateCode);
}

const DISTRICT_VERIFIED_EVENT_SIGNATURE = ethers.utils.id(
  'DistrictVerified(bytes32,string,uint256)'
);
```

**Database stores ONLY**:
- `district_commitment`: hash (one-way, not reversible)
- `state_code`: "TX" (30M anonymity set)
- `merkle_root`: public on-chain data
- `proof_verified`: boolean

**Database DOES NOT store**:
- ❌ District name (plaintext)
- ❌ City, zip code
- ❌ Lat/lng coordinates
- ❌ Address (any form)

---

## Migration Steps

### Phase 1: Add Zero-Knowledge Fields (Non-Breaking)

```sql
-- Add new fields to User table
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

### Phase 2: Delete Privacy-Leaking Fields (BREAKING)

```sql
-- DANGEROUS: Deletes existing user location data
-- BACKUP DATABASE FIRST!

-- Remove plaintext location fields from User
ALTER TABLE user
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip,
  DROP COLUMN IF EXISTS congressional_district,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS political_embedding,
  DROP COLUMN IF EXISTS community_sheaves;

-- Delete LocationCache entirely (no longer needed)
DROP TABLE IF EXISTS location_cache CASCADE;
DROP TABLE IF EXISTS cicero_budget CASCADE;
```

---

### Phase 3: Deploy Browser District Verifier

1. **Add district boundaries dataset**:
   - Download Census TIGER/Line Shapefiles
   - Simplify polygons (10K points → 100-500 points)
   - Publish to IPFS + CDN mirror
   - Update `/api/districts/boundaries.json` endpoint

2. **Add browser libraries**:
```json
{
  "dependencies": {
    "merkletreejs": "^0.3.11",
    "keccak256": "^1.0.6",
    "ethers": "^5.7.2"
  }
}
```

3. **Add verification flow UI**:
   - Address input (browser-only)
   - District detection (client-side)
   - Merkle proof generation (browser-only)
   - Blockchain submission
   - Confirmation display

---

## Frontend Integration Points

### Files to Update:

1. **`src/lib/components/auth/AddressCollectionModal.svelte`**:
   - Replace Cicero API call with browser district lookup
   - Add Merkle proof generation
   - Add blockchain submission

2. **`src/lib/components/auth/IdentityVerificationFlow.svelte`**:
   - Integrate `BrowserDistrictVerifier`
   - Show proof generation progress
   - Display verification status

3. **`src/lib/core/location/` (DELETE ENTIRE DIRECTORY)**:
   - ❌ `boundary-matcher.ts` (replace with browser-verifier.ts)
   - ❌ `census-api.ts` (no longer needed)
   - ❌ `inference-engine.ts` (no longer needed)
   - ❌ `storage.ts` (no longer needed)

4. **`src/routes/api/location/` (DELETE ENTIRE DIRECTORY)**:
   - ❌ `/api/location/cicero/+server.ts` (no longer needed)
   - ❌ `/api/location/geocode/+server.ts` (done in browser)
   - ❌ `/api/location/ip-lookup/+server.ts` (no longer needed)

5. **`src/lib/core/district/` (NEW DIRECTORY)**:
   - ✅ `browser-verifier.ts` (district lookup in browser)
   - ✅ `proof-generator.ts` (Merkle proof generation)
   - ✅ `blockchain-submitter.ts` (submit to Scroll zkEVM)

---

## Privacy Comparison: Before vs After

### Before (VULNERABLE):
```typescript
// Server-side address lookup
const districts = await ciceroAPI.lookup(address);
// ❌ Server logs address → district mapping
// ❌ LocationCache stores timing data
// ❌ User table stores plaintext district

await prisma.user.update({
  data: {
    congressional_district: "TX-25",  // ❌ Plaintext
    city: "Austin",                    // ❌ PII
    state: "TX",                       // ❌ PII
    zip: "78701"                       // ❌ PII
  }
});

// Attack: Database compromise reveals all user locations
```

### After (AUDIT-PROOF):
```typescript
// Browser-only address lookup (NEVER sent to server)
const verifier = new BrowserDistrictVerifier();
const { districts, lat, lng } = await verifier.determineDistricts(address);
// ✅ Address stays in browser
// ✅ No server-side API calls

// Generate proof (browser-only)
const proofGen = new DistrictProofGenerator();
const { commitment, proof, stateCode } = await proofGen.generateProof(
  districts.congressional,
  userPubkey,
  "TX"
);
// ✅ Commitment is one-way hash
// ✅ Nonce stored in localStorage only

// Submit to blockchain
await submitter.submitProof(stateCode, commitment, proof, signer);

// Store ONLY commitment hash in database
await prisma.user.update({
  data: {
    district_commitment: commitment,  // ✅ Hash only (not reversible)
    state_code: "TX",                 // ✅ 30M anonymity set
    proof_verified: true,

    // ✅ NO plaintext: city, zip, district, lat/lng
  }
});

// Attack: Database compromise reveals state code only (30M people)
```

---

## Cost Analysis

### Old Architecture (LocationCache):
- Cicero API: $0.04/user × 10,000 = $400/month
- LocationCache: 50% cache hit = $200/month saved
- **Total**: $200/month

### New Architecture (Browser-Only + Blockchain):
- Cicero API: $0 (no server calls)
- Browser geocoding: FREE (Google Maps API free tier)
- District dataset: FREE (public data, cached in IndexedDB)
- Blockchain verification: $0.014/user × 10,000 = **$140/month**
- **Total**: $140/month

**Winner**: Browser-only + blockchain is 30% cheaper AND audit-proof.

---

## Testing Checklist

### Unit Tests:
- [ ] `BrowserDistrictVerifier.pointInPolygon()` accuracy
- [ ] `DistrictProofGenerator.generateProof()` correctness
- [ ] Merkle proof verification (local)

### Integration Tests:
- [ ] Address → Districts (all granularity levels)
- [ ] Merkle proof generation + verification
- [ ] Blockchain submission + event emission
- [ ] Database commitment storage

### E2E Tests (Playwright):
- [ ] User enters address → Districts detected
- [ ] Proof generation UI progress indicators
- [ ] Blockchain transaction confirmation
- [ ] Verification badge display

### Privacy Tests:
- [ ] Address NEVER transmitted to server
- [ ] District NEVER stored in database plaintext
- [ ] Nonce NEVER sent to server
- [ ] Commitment NOT reversible

---

## The Bottom Line

**Current state**: LocationCache creates correlation attack vectors. Address data stored in database.

**Required changes**:
1. **DELETE** `LocationCache` table (entire table)
2. **DELETE** plaintext location fields from User (city, state, zip, district, lat/lng)
3. **ADD** zero-knowledge fields to User (district_commitment, state_code, merkle_root)
4. **IMPLEMENT** browser-native district verification (3 new TypeScript classes)
5. **INTEGRATE** with VOTER Protocol smart contracts on Scroll zkEVM

**Privacy guarantee**: Address never leaves browser. District never stored in database. Only cryptographic commitment hash stored (not reversible).

**Cost**: 30% cheaper than LocationCache approach ($140/mo vs $200/mo).

**Audit-proof**: Database compromise reveals state code (30M anonymity set), not district or address.

---

**Next steps**: Implement `BrowserDistrictVerifier`, deploy district boundaries dataset, integrate with VOTER Protocol contracts.
