# Cryptographic Requirements

**Last Updated:** 2026-02-02
**Status:** ✅ Hash unification complete (Wave 1.1)

**Cross-Repository Reference:**
- Cryptographic interface: `@voter-protocol/noir-prover` package
- Hash implementation: `voter-protocol/packages/crypto/poseidon2.ts`
- Domain separation: SA-007 fix (DOMAIN_HASH1, DOMAIN_HASH2)

## Hash Function: Poseidon2

All hashes in the voter-protocol MUST use Poseidon2 over BN254.

### Why Poseidon2?
- ZK-friendly: ~160 constraints per hash vs ~25,000 for SHA-256
- Circuit-compatible: Same algorithm in TypeScript and Noir
- Field-native: Operates directly on BN254 field elements

### Import
```typescript
import { Poseidon2Hasher } from '@voter-protocol/noir-prover';

const hasher = await Poseidon2Hasher.getInstance();
const hash = await hasher.hashPair(left, right);
```

### Domain Separation (SA-007)

To prevent hash collisions between different use cases, domain tags are used:

```typescript
// Hash pair with domain separation
const DOMAIN_HASH2 = 0x48324d; // "H2M" for pair hash
hashPair(a, b) → poseidon2([a, b, DOMAIN_HASH2, 0])

// Hash single with domain separation
const DOMAIN_HASH1 = 0x48314d; // "H1M" for single hash
hashSingle(x) → poseidon2([x, DOMAIN_HASH1, 0, 0])
```

**Breaking Change (Wave 2):** All persisted hashes using `hashSingle()` or `hashPair()` must be regenerated due to domain separation.

### Identity Commitment Generation

Identity commitments are generated using Poseidon2 for ZK circuit compatibility:

```typescript
import { generateIdentityCommitment } from '$lib/core/shadow-atlas/shadow-atlas-handler';

const commitment = await generateIdentityCommitment({
  provider: 'didit.me',
  credentialHash: result.credentialHash,
  issuedAt: Date.now()
});
// Returns: Poseidon2 hash as hex string (BN254 field element)
```

### CRITICAL: Do NOT use SHA-256, Keccak, or other hashes
Using any other hash function will produce Merkle roots that don't match the circuit, causing proof verification to fail.

**Wave 1.1 Fix:** The `shadow-atlas-handler.ts` was updated to use Poseidon2 instead of SHA-256 for identity commitments.

### Circuit Constraints

The ZK circuit enforces:
1. `user_secret != 0` (SA-011 fix) - Prevents predictable nullifiers
2. All inputs must be valid BN254 field elements (< modulus)
3. Merkle path must have exactly 20 siblings for depth-20 circuits

### Field Element Validation

```typescript
import { validateFieldElement } from '$lib/core/zkp/prover-client';

// BN254 modulus
const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Validate before proving
validateFieldElement(userSecret, 'userSecret');
// Throws if >= BN254_MODULUS
```
