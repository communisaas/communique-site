# Codebase Ownership: voter-protocol vs communique

**Purpose:** Define clear engineering boundaries between protocol layer (voter-protocol) and application layer (communique)
**Principle:** Protocol primitives vs. application implementation

---

## Engineering Philosophy

**voter-protocol:** Protocol-level primitives, reusable across any application
**communique:** First application built on VOTER Protocol (congressional advocacy)

Think: Ethereum (protocol) vs. Uniswap (application)

---

## 📦 voter-protocol Repository (Protocol Layer)

### Purpose
**Reusable infrastructure** for any application that wants to:
- Generate zero-knowledge proofs of district membership (Halo2, addresses never stored anywhere)
- Track on-chain reputation (ERC-8004 portable credibility)
- Run challenge markets for truth verification (Phase 2)
- Coordinate democratic participation with cryptographic privacy
- Deliver encrypted messages via hardware-attested TEEs

### What Belongs Here

#### 1. Smart Contracts (Scroll L2)
**Location:** `voter-protocol/contracts/scroll/`

```
contracts/scroll/
├── CommuniqueCoreV2.sol          # Civic action certification
├── VOTERToken.sol                # ERC-20 token
├── UnifiedRegistry.sol           # Challenge markets + reputation
├── ChallengeMarket.sol           # Truth verification via staking
├── ReputationRegistry.sol        # ERC-8004 on-chain reputation
├── OutcomeMarket.sol             # Prediction markets for legislation
├── DistrictGate.sol              # ZK proof verification
└── TEEAttestationVerifier.sol    # GCP Confidential Space verification
```

**Ownership:** voter-protocol
**Why:** These contracts define the protocol. Any app can integrate with them.

#### 2. NEAR Chain Signatures (Cross-Chain Account Abstraction)
**Location:** `voter-protocol/contracts/near/`

```
contracts/near/
└── signer.near/                  # Chain Signatures (existing NEAR contract)
```

**Ownership:** voter-protocol
**Why:** NEAR Chain Signatures enable deterministic address generation for wallet-free blockchain participation via passkeys. Addresses are never stored—generated client-side when needed.

#### 3. Cryptographic Primitives (SDKs)
**Location:** `voter-protocol/packages/crypto/`

```
packages/crypto/
├── encryption/
│   ├── xchacha20poly1305.ts      # Message encryption (delivery) + witness encryption (TEE)
│   └── passkey-derivation.ts     # Deterministic address generation
├── zk-proofs/
│   ├── circuits/                 # Halo2 circuits (Rust)
│   │   └── district-membership.rs # Halo2 two-tier Merkle proof circuit
│   ├── tee-prover.ts             # TEE proof generation client (2-5s)
│   ├── verifier.ts               # Proof verification
│   └── shadow-atlas.ts           # Two-tier Shadow Atlas (535 district trees + 1 global tree)
└── commitments/
    └── poseidon.ts               # Poseidon hash for ZK commitments
```

**Ownership:** voter-protocol
**Why:** These are protocol-level cryptographic operations. Any app needs these.

**Dependencies:**
- `libsodium-wrappers` (XChaCha20-Poly1305 for message delivery encryption)
- `circomlibjs` (Poseidon commitments)
- `halo2_proofs` (Halo2 recursive proofs, no trusted setup)

#### 4. Protocol Client SDK
**Location:** `voter-protocol/packages/client/`

```
packages/client/
├── proof-service.ts              # Proof Service API client (witness generation)
├── tee-prover.ts                 # TEE-based Halo2 proof generation
├── chain-signatures.ts           # NEAR Chain Signatures (deterministic addresses)
├── reputation.ts                 # On-chain reputation queries
├── challenges.ts                 # Challenge market interactions
├── outcome-markets.ts            # Prediction market interactions
└── index.ts                      # Unified client
```

**Ownership:** voter-protocol
**Why:** Reusable client for any app integrating with VOTER Protocol.

**Example Usage:**
```typescript
// Any app can use this
import { ProofServiceClient, ReputationClient } from '@voter-protocol/client';

// Generate zero-knowledge proof via TEE (2-5 seconds)
const proofService = new ProofServiceClient();
const encryptedWitness = await encryptWitness(address, teePublicKey);
const proof = await proofService.generateProof(encryptedWitness, district);
// Address encrypted in browser, decrypted only in TEE, never stored anywhere

const reputation = new ReputationClient(scrollProvider);
const score = await reputation.getScore('0xABCD...1234');
```

#### 5. Shared Types
**Location:** `voter-protocol/packages/types/`

```
packages/types/
├── halo2-proof.ts                # Halo2 proof types
├── reputation.ts                 # Reputation types
├── challenge.ts                  # Challenge market types
└── district.ts                   # Congressional district types
```

**Ownership:** voter-protocol
**Why:** Shared across protocol and all applications.

---

## 🏛️ communique Repository (Application Layer)

### Purpose
**Congressional advocacy application** built on VOTER Protocol. First of many apps that will use the protocol.

### What Belongs Here

#### 1. Application-Specific Features
**Location:** `communique/src/lib/`

```
src/lib/
├── components/                   # UI components (Svelte)
│   ├── template/                 # Template editor/creator
│   ├── congress/                 # Congressional directory
│   ├── auth/                     # OAuth + passkey UI
│   └── blockchain/               # Wallet connection UI
├── routes/                       # SvelteKit routes/pages
│   ├── +page.svelte              # Landing page
│   ├── s/[slug]/                 # Template sharing
│   ├── create/                   # Template creator
│   └── api/                      # Backend API endpoints
└── core/
    ├── congress/                 # US Congressional specific logic
    │   ├── cwc-client.ts         # Communicating With Congress API
    │   ├── address-lookup.ts     # US district lookup
    │   └── delivery.ts           # Email delivery to Congress
    ├── legislative/              # Legislative abstraction (future: UK, etc.)
    │   ├── adapters/             # Per-country adapters
    │   ├── delivery-pipeline.ts  # Generic delivery
    │   └── variable-resolution.ts
    └── integrations/
        └── voter-protocol/       # WRAPPER around @voter-protocol/client
```

**Ownership:** communique
**Why:** Congressional advocacy is one application. Protocol is reusable for any democratic action.

#### 2. Integration Layer (Wrapper)
**Location:** `communique/src/lib/core/integrations/voter-protocol/`

```
integrations/voter-protocol/
├── proof-service-wrapper.ts      # TEE-based Halo2 proof generation wrapper
├── witness-encryption.ts         # Witness encryption utilities
├── congressional-certification.ts # Certify messages to Congress
└── reputation-display.ts         # Show reputation in Communique UI
```

**Pattern:**
```typescript
// communique wraps protocol SDK with app-specific logic
import { ProofServiceClient, encryptWitness } from '@voter-protocol/client';
import { db } from '$lib/core/db';

export class CommuniqueProofServiceWrapper {
  private proofService: ProofServiceClient;

  async generateProofWithUI(userId: string, address: string, district: string) {
    // Show progress UI to user (2-5 seconds proving time)
    this.showProgressIndicator("Encrypting witness...");

    // Protocol: Encrypt witness to TEE public key
    const encryptedWitness = await encryptWitness(address, this.proofService.getTEEPublicKey());

    this.showProgressIndicator("Generating zero-knowledge proof in TEE...");

    // Protocol: Generate Halo2 proof in TEE
    const proof = await this.proofService.generateProof(encryptedWitness, district);
    // Address encrypted in browser, decrypted only in TEE, never stored anywhere

    // Application: Store proof result reference (not PII)
    await db.user.update({
      where: { id: userId },
      data: {
        district_verified: true,
        last_proof_timestamp: new Date()
      }
    });

    this.hideProgressIndicator();
    return proof;
  }
}
```

**Ownership:** communique
**Why:** Application-specific usage patterns, UI state management, user experience wrapping protocol primitives. Database stores ONLY metadata (verified status, timestamps), never PII.

#### 3. Database Schema (Application Data)
**Location:** `communique/prisma/schema.prisma`

```prisma
model User {
  id                        String   @id
  email                     String?

  // VOTER Protocol integration (NO PII STORED)
  scroll_address            String?  // Deterministic address (passkey-derived)
  district_verified         Boolean  // ZK proof verification status
  last_proof_timestamp      DateTime? // When last proof was generated

  // Application data
  templates                 Template[]
  sessions                  Session[]
}

model Template {
  id                        String   @id
  title                     String
  category                  String
  body                      String   // Public template text (no PII)

  // Application-specific
  is_public                 Boolean
  view_count                Int
  fork_count                Int
}
```

**Ownership:** communique
**Why:** Application data model. Other apps would have different schemas. Database stores ONLY metadata and public content, NEVER addresses or PII.

#### 4. Feature Flags & Config
**Location:** `communique/src/lib/features/`

```
features/
├── config.ts                     # Feature flags
├── ai-suggestions/               # AI template intelligence (beta)
└── experimental/                 # Research features
```

**Ownership:** communique
**Why:** Application-specific features, not protocol concerns.

---

## 🔄 Integration Pattern

### How communique Uses voter-protocol

```typescript
// 1. Install protocol SDK
npm install @voter-protocol/client @voter-protocol/crypto @voter-protocol/types

// 2. Use in communique application
import { ProofServiceClient, encryptWitness } from '@voter-protocol/client';
import { generatePoseidonCommitment } from '@voter-protocol/crypto';

// 3. Wrap with application logic
export class CommuniqueUser {
  async verifyDistrict(userId: string, address: string, district: string) {
    // Protocol: Encrypt witness to TEE, generate Halo2 proof (2-5 seconds)
    const proofService = new ProofServiceClient();
    const encryptedWitness = await encryptWitness(address, proofService.getTEEPublicKey());
    const proof = await proofService.generateProof(encryptedWitness, district);
    // Address encrypted in browser, decrypted only in TEE, NEVER stored anywhere

    // Application: Store ONLY verification status (not PII)
    await db.user.update({
      where: { id: userId },
      data: {
        district_verified: true,
        last_proof_timestamp: new Date()
        // NO address, NO district hash, ONLY metadata
      }
    });

    return proof; // Proof submitted to blockchain for verification
  }
}
```

---

## 📐 Architectural Boundaries

### Protocol Layer (voter-protocol)
**Responsibility:** "How to generate ZK proofs, track reputation, verify messages cryptographically"
**Not Responsible:** "What UI to show users, how to organize templates, when to send emails"

**Examples:**
- ✅ Halo2 proof generation circuits
- ✅ XChaCha20-Poly1305 encryption (message delivery only)
- ✅ On-chain reputation tracking
- ✅ Deterministic address generation (passkey-derived)
- ❌ Template editor UI
- ❌ Congressional directory
- ❌ OAuth integration
- ❌ Email delivery timing
- ❌ PII storage (addresses never stored anywhere)

### Application Layer (communique)
**Responsibility:** "Congressional advocacy user experience built on protocol primitives"
**Not Responsible:** "How encryption works, how ZK proofs are generated"

**Examples:**
- ✅ Template creator/editor
- ✅ Congressional office lookup
- ✅ CWC API integration
- ✅ Supabase database schema (metadata only, NO PII)
- ✅ SvelteKit routes/pages
- ❌ Halo2 circuit design
- ❌ Cryptographic primitives
- ❌ ZK proof verification logic
- ❌ Reputation smart contracts

---

## 🚀 Current Implementation Status

### voter-protocol (NEEDS BUILDING)
```
❌ contracts/scroll/          # Smart contracts not deployed
❌ packages/crypto/           # Halo2 proof SDK not built
❌ packages/client/           # Client SDK not built
✅ ARCHITECTURE.md            # Specification complete (Halo2, no database)
✅ TECHNICAL.md               # Implementation spec complete
✅ SECURITY.md                # Threat model complete
```

**Priority:** Build Halo2 proof generation SDK + Scroll smart contracts

### communique (PARTIALLY COMPLETE)
```
✅ src/lib/core/blockchain/rpc/        # RPC abstraction (correct)
✅ src/lib/core/auth/                  # OAuth + passkey auth (correct)
✅ src/lib/core/congress/              # CWC integration (correct)
✅ prisma/schema.prisma                # Clean schema (metadata only, NO PII)
❌ src/lib/core/blockchain/halo2.ts    # NOT STARTED (waiting on SDK)
❌ Integration with @voter-protocol/client # Can't integrate until SDK exists
```

**Blocker:** Can't integrate protocol SDK until voter-protocol builds Halo2 proof generation.

---

## 🎯 Development Strategy

### Phase 1: Build Protocol Primitives (voter-protocol)
**Timeline:** 6-8 weeks

1. **Halo2 Circuit Implementation** (Rust)
   - Merkle tree membership circuit
   - Shadow Atlas district proof
   - 4-6 second proving time on commodity hardware

2. **Crypto SDK** (TypeScript + Rust WASM)
   - Halo2 proof generation (browser-based, 4-6s)
   - XChaCha20-Poly1305 encryption (message delivery only)
   - Poseidon commitment generation
   - Passkey-based deterministic address derivation

3. **Smart Contracts** (Solidity)
   - DistrictGate.sol (Halo2 proof verification on Scroll L2)
   - ReputationRegistry.sol (ERC-8004 on-chain reputation)
   - Deploy to Scroll testnet

4. **Client SDK** (TypeScript)
   - Halo2Prover (browser-based proof generation)
   - Chain Signatures wrapper (deterministic addresses)
   - Reputation queries

5. **Publish NPM Packages**
   ```bash
   @voter-protocol/crypto
   @voter-protocol/client
   @voter-protocol/types
   ```

### Phase 2: Integrate in Communique (communique)
**Timeline:** 2-3 weeks

1. **Install Protocol SDK**
   ```bash
   npm install @voter-protocol/crypto @voter-protocol/client
   ```

2. **Create Integration Wrappers**
   - `src/lib/core/integrations/voter-protocol/halo2-wrapper.ts`
   - UI progress indicators for 4-6s proving time
   - Application-specific usage patterns

3. **Update Data Flows**
   - Address collection → Halo2 proof generation (client-side only)
   - Template personalization → encrypted delivery (no storage)
   - Congressional delivery → ZK proof verification

4. **Database Schema Updates**
   - Remove all PII storage fields
   - Store ONLY verification status and timestamps
   - NO addresses, NO district hashes

### Phase 3: Deploy Both (coordinated)
**Timeline:** 1-2 weeks

1. Deploy Scroll smart contracts to mainnet
2. Update communique to use mainnet contracts
3. Load test Halo2 proving on various devices
4. Launch

---

## 📦 Package Structure (Future)

### voter-protocol Monorepo
```
voter-protocol/
├── contracts/
│   ├── scroll/                   # Solidity contracts
│   └── near/                     # NEAR Chain Signatures only
├── packages/
│   ├── crypto/                   # Halo2 proofs + encryption (delivery only)
│   ├── client/                   # Protocol SDK
│   └── types/                    # Shared types
├── docs/
│   ├── ARCHITECTURE.md           # Full ZK architecture, no database
│   ├── TECHNICAL.md              # Halo2 implementation details
│   └── SECURITY.md               # Threat model
├── package.json
└── turbo.json                    # Turborepo config
```

### communique Application
```
communique/
├── src/
│   ├── lib/
│   │   ├── core/
│   │   │   ├── integrations/
│   │   │   │   └── voter-protocol/  # Wrapper around protocol SDK
│   │   │   ├── congress/            # US-specific logic
│   │   │   └── legislative/         # Generic legislative abstraction
│   │   ├── components/              # Svelte UI
│   │   └── routes/                  # SvelteKit pages
│   └── routes/
├── prisma/
│   └── schema.prisma               # Application database
├── docs/
│   └── ARCHITECTURE.md             # Application architecture
└── package.json
```

---

## 🔑 Key Decisions

### What Goes Where?

**Protocol (voter-protocol):**
- ✅ Anything reusable across applications
- ✅ Smart contracts (truth source)
- ✅ Cryptographic primitives
- ✅ Core data structures

**Application (communique):**
- ✅ Congressional-specific features
- ✅ UI/UX implementation
- ✅ Database schema
- ✅ API endpoints
- ✅ Application business logic

### Why This Matters

**Without clear boundaries:**
- ❌ Can't build other apps on protocol
- ❌ Tight coupling makes changes risky
- ❌ Testing becomes harder
- ❌ Code duplication across apps

**With clear boundaries:**
- ✅ Other apps can use protocol
- ✅ Protocol evolves independently
- ✅ Clean testing boundaries
- ✅ Single source of truth for primitives

---

## 🚧 Immediate Action Items

### This Week (voter-protocol):
1. Create `packages/crypto/zk-proofs/circuits/` directory
2. Implement Halo2 Merkle membership circuit (Rust)
3. Build WASM wrapper for browser proving
4. Test 4-6 second proving time on commodity hardware
5. Begin Scroll smart contract implementation

### This Week (communique):
1. Update Prisma schema to remove all PII fields
2. Add `district_verified` and `last_proof_timestamp` fields
3. Prepare UI for 4-6s proof generation progress indicators
4. Remove any CipherVault integration code

### Next 2-4 Weeks:
1. Complete Halo2 circuit + WASM build (voter-protocol)
2. Deploy DistrictGate.sol to Scroll testnet (voter-protocol)
3. Publish `@voter-protocol/crypto` package
4. Integrate Halo2 prover in communique
5. End-to-end testing on testnet

---

**Principle:** Protocol primitives enable applications. Don't build application logic into protocol. Don't rebuild protocol primitives in applications. Addresses encrypted in browser, decrypted only in TEE, NEVER stored anywhere.

**Current Blocker:** voter-protocol needs to build TEE prover service + Proof Service API before communique can integrate.

**Next Step:** Build Halo2 two-tier Merkle circuit, deploy TEE prover in AWS Nitro, test 2-5s proving time, publish SDK.
