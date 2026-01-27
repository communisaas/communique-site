# Cryptographic Requirements

**Cross-Repository Reference:**
- Cryptographic interface: `@voter-protocol/noir-prover` package

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

### CRITICAL: Do NOT use SHA-256, Keccak, or other hashes
Using any other hash function will produce Merkle roots that don't match the circuit, causing proof verification to fail.
