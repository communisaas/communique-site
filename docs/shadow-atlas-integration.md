# Shadow Atlas API Integration

**Last Updated:** 2026-02-02
**Status:** ✅ API Client Implemented (Wave 1.2)

Shadow Atlas provides district lookup and Merkle proof generation for ZK proofs.

**Cross-Repository References:**
- voter-protocol implementation: [SHADOW-ATLAS-SPEC.md](/Users/noot/Documents/voter-protocol/specs/SHADOW-ATLAS-SPEC.md)
- Proof architecture: [UNIFIED-PROOF-ARCHITECTURE.md](/Users/noot/Documents/voter-protocol/specs/UNIFIED-PROOF-ARCHITECTURE.md)
- Remediation status: [REMEDIATION-WAVE-PLAN.md](/Users/noot/Documents/voter-protocol/specs/REMEDIATION-WAVE-PLAN.md)

---

## Client Implementation

**Location:** `src/lib/core/shadow-atlas/shadow-atlas-handler.ts`

The Shadow Atlas client was implemented in Wave 1.2, replacing the mock implementation (-88 LOC deleted).

### Key Changes (Wave 1.2)

1. **Hash Unification:** SHA-256 → Poseidon2 for identity commitments
2. **Depth Fix:** Removed mock depth-12 trees, API returns depth-20
3. **API Client:** Created proper HTTP client for Shadow Atlas API

### Client Usage

```typescript
import { ShadowAtlasClient } from '$lib/core/shadow-atlas/shadow-atlas-handler';

const client = new ShadowAtlasClient({
  baseUrl: process.env.SHADOW_ATLAS_API_URL
});

// Lookup district by coordinates
const districts = await client.lookup(37.7749, -122.4194);
// Returns: { congressional: "CA-12", merkleRoot: "0x..." }

// Get Merkle proof for identity commitment
const proof = await client.getProof(districtId, identityCommitment);
// Returns: { path: [...], index: 1234, root: "0x...", depth: 20 }

// Register identity commitment
const registration = await client.register({
  identityCommitment,  // Poseidon2 hash
  lat,
  lng
});
// Returns: { leafIndex, merklePath, merkleRoot, districtId }
```

---

## API Endpoints

### District Lookup
```
GET /v1/lookup?lat={latitude}&lng={longitude}
```

**Response:**
```json
{
  "districts": {
    "congressional": "CA-12",
    "state_senate": "CA-SD-11",
    "state_house": "CA-AD-17",
    "city_council": "SF-D5"
  },
  "merkleRoots": {
    "congressional": "0x...",
    "state_senate": "0x..."
  }
}
```

### Identity Registration
```
POST /v1/register
Content-Type: application/json

{
  "identityCommitment": "0x...",  // Poseidon2 hash
  "lat": 37.7749,
  "lng": -122.4194
}
```

**Response:**
```json
{
  "leafIndex": 1234,
  "merklePath": ["0x...", "0x...", ...],  // 20 siblings
  "merkleRoot": "0x...",
  "districtId": "CA-12",
  "depth": 20
}
```

### Merkle Proof Retrieval
```
GET /v1/proof?district={district_id}&leaf={leaf_hash}
```

**Response:**
```json
{
  "path": ["0x...", "0x...", ...],
  "index": 1234,
  "root": "0x...",
  "depth": 20
}
```

---

## Security Considerations

### URL Validation (SA-009)

All Shadow Atlas URLs are validated against an allowlist before fetching:

```typescript
import { validateURL } from '../security/input-validator';

// Before any fetch
if (!validateURL(url)) {
  throw new Error(`URL not in allowlist: ${url}`);
}
```

### Rate Limiting (SA-010)

The rate limiter `consume()` method now actually consumes tokens (fixed in Wave 3):

```typescript
const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });
if (!limiter.consume(clientId)) {
  throw new Error('Rate limit exceeded');
}
```

### JSON Validation (SA-014)

All incoming JSON is validated with Zod schemas:

```typescript
import { DiscoveryResultSchema } from '../security/input-validator';

const results = DiscoveryResultSchema.parse(JSON.parse(data));
```

---

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid coordinates | Check lat/lng format |
| 401 | Unauthorized | Check API key |
| 404 | District not found | Coordinates outside coverage |
| 409 | Duplicate registration | Identity already registered |
| 429 | Rate limited | Retry after cooldown |
| 503 | Tree rebuilding | Retry in 30s |

---

## Environment Configuration

```bash
# Shadow Atlas API
SHADOW_ATLAS_API_URL=https://shadow-atlas.voter-protocol.org

# For development
SHADOW_ATLAS_API_URL=http://localhost:3001
```

---

## Integration Flow

```
1. User verifies identity (Didit.me or self.xyz)
   └→ Generates identity_commitment (Poseidon2 hash)

2. User provides address
   └→ Geocode to coordinates (lat, lng)

3. Register with Shadow Atlas
   └→ POST /v1/register { identityCommitment, lat, lng }
   └→ Receive { leafIndex, merklePath, merkleRoot, districtId }

4. Store registration locally (IndexedDB)
   └→ { identityCommitment, leafIndex, merklePath, merkleRoot, districtId }

5. Generate ZK proof (browser WASM)
   └→ Use merklePath as witness
   └→ Prove district membership without revealing identity

6. Submit congressional message
   └→ POST /api/congressional/submit { proof, publicInputs, ... }
```

---

## Testing

The Shadow Atlas integration is covered by:
- 84 security tests (input-validator, rate-limiter)
- Integration tests in `src/lib/core/shadow-atlas/__tests__/`
- E2E proof generation tests in voter-protocol
