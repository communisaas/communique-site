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
- Store encrypted PII on NEAR blockchain
- Generate ZK proofs of district membership
- Track on-chain reputation
- Run challenge markets for truth verification
- Coordinate democratic participation

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

#### 2. NEAR Contracts (CipherVault + Account Management)
**Location:** `voter-protocol/contracts/near/`

```
contracts/near/
├── ciphervault.near/             # Encrypted PII storage
│   ├── src/
│   │   ├── lib.rs                # Main contract
│   │   ├── envelope.rs           # CipherEnvelope struct
│   │   ├── encryption.rs         # Validation logic (not crypto)
│   │   └── guardian.rs           # Social recovery
│   └── Cargo.toml
└── signer.near/                  # Chain Signatures (existing NEAR contract)
```

**Ownership:** voter-protocol
**Why:** CipherVault is reusable infrastructure. Any app can store encrypted PII.

#### 3. Cryptographic Primitives (SDKs)
**Location:** `voter-protocol/packages/crypto/`

```
packages/crypto/
├── encryption/
│   ├── xchacha20poly1305.ts      # Client-side encryption
│   ├── sovereign-keys.ts         # Key generation/management
│   └── near-key-derivation.ts   # NEAR account key derivation
├── zk-proofs/
│   ├── circuits/                 # Circom circuits
│   │   ├── ResidencyCircuit.circom
│   │   └── poseidon.circom
│   ├── groth16.ts                # Proof generation
│   ├── verifier.ts               # Proof verification
│   └── shadow-atlas.ts           # District Merkle tree
└── commitments/
    └── poseidon.ts               # Poseidon hash for ZK commitments
```

**Ownership:** voter-protocol
**Why:** These are protocol-level cryptographic operations. Any app needs these.

**Dependencies:**
- `libsodium-wrappers` (XChaCha20-Poly1305)
- `circomlibjs` (Poseidon commitments)
- `snarkjs` (Groth16 proofs)

#### 4. Protocol Client SDK
**Location:** `voter-protocol/packages/client/`

```
packages/client/
├── ciphervault.ts                # CipherVault integration
├── chain-signatures.ts           # NEAR Chain Signatures
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
import { CipherVault, ReputationClient } from '@voter-protocol/client';

const vault = new CipherVault('ciphervault.near');
const envelopeId = await vault.storeEnvelope({ address, name, phone });

const reputation = new ReputationClient(scrollProvider);
const score = await reputation.getScore('0xABCD...1234');
```

#### 5. Shared Types
**Location:** `voter-protocol/packages/types/`

```
packages/types/
├── envelope.ts                   # CipherEnvelope type
├── reputation.ts                 # Reputation types
├── challenge.ts                  # Challenge market types
└── proof.ts                      # ZK proof types
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
├── ciphervault-wrapper.ts        # Communique-specific CipherVault usage
├── congressional-certification.ts # Certify messages to Congress
└── reputation-display.ts         # Show reputation in Communique UI
```

**Pattern:**
```typescript
// communique wraps protocol SDK with app-specific logic
import { CipherVault } from '@voter-protocol/client';
import { db } from '$lib/core/db';

export class CommuniqueCipherVault {
  private vault: CipherVault;

  async storeUserProfile(userId: string, pii: PIIData) {
    // Protocol: Store in CipherVault
    const envelopeId = await this.vault.storeEnvelope(pii);

    // Application: Update PostgreSQL with reference
    await db.user.update({
      where: { id: userId },
      data: { ciphervault_envelope_id: envelopeId }
    });

    return envelopeId;
  }
}
```

**Ownership:** communique
**Why:** Application-specific usage patterns, database integration, UI state management.

#### 3. Database Schema (Application Data)
**Location:** `communique/prisma/schema.prisma`

```prisma
model User {
  id                        String   @id
  email                     String?

  // VOTER Protocol integration
  near_account_id           String?
  scroll_address            String?
  ciphervault_envelope_id   String?  // Reference to protocol storage

  // Application data
  templates                 Template[]
  sessions                  Session[]
}

model Template {
  id                        String   @id
  title                     String
  category                  String
  body                      String   // Public template text

  // Application-specific
  is_public                 Boolean
  view_count                Int
  fork_count                Int
}
```

**Ownership:** communique
**Why:** Application data model. Other apps would have different schemas.

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
import { CipherVault, ReputationClient } from '@voter-protocol/client';
import { generatePoseidonCommitment } from '@voter-protocol/crypto';

// 3. Wrap with application logic
export class CommuniqueUser {
  async updateProfile(userId: string, profile: ProfileData) {
    // Protocol: Store PII in CipherVault
    const vault = new CipherVault('ciphervault.near');
    const envelopeId = await vault.storeEnvelope({
      legal_name: profile.name,
      address: profile.address,
      phone: profile.phone
    });

    // Application: Update database with reference
    await db.user.update({
      where: { id: userId },
      data: {
        ciphervault_envelope_id: envelopeId,
        updated_at: new Date()
      }
    });
  }
}
```

---

## 📐 Architectural Boundaries

### Protocol Layer (voter-protocol)
**Responsibility:** "How to store encrypted PII, generate ZK proofs, track reputation"
**Not Responsible:** "What UI to show users, how to organize templates, when to send emails"

**Examples:**
- ✅ CipherVault contract implementation
- ✅ XChaCha20-Poly1305 encryption
- ✅ ZK proof generation circuits
- ✅ On-chain reputation tracking
- ❌ Template editor UI
- ❌ Congressional directory
- ❌ OAuth integration
- ❌ Email delivery timing

### Application Layer (communique)
**Responsibility:** "Congressional advocacy user experience built on protocol primitives"
**Not Responsible:** "How encryption works, how ZK proofs are generated"

**Examples:**
- ✅ Template creator/editor
- ✅ Congressional office lookup
- ✅ CWC API integration
- ✅ Supabase database schema
- ✅ SvelteKit routes/pages
- ❌ CipherVault contract code
- ❌ Encryption primitives
- ❌ ZK circuit design
- ❌ Reputation smart contracts

---

## 🚀 Current Implementation Status

### voter-protocol (NEEDS BUILDING)
```
❌ contracts/scroll/          # Smart contracts not deployed
❌ contracts/near/            # CipherVault contract not built
❌ packages/crypto/           # No encryption SDK yet
❌ packages/client/           # No client SDK yet
✅ ARCHITECTURE.md            # Specification complete
```

**Priority:** Build CipherVault contract + crypto SDK first

### communique (PARTIALLY COMPLETE)
```
✅ src/lib/core/blockchain/rpc/        # RPC abstraction (correct)
✅ src/lib/core/auth/                  # OAuth + passkey auth (correct)
✅ src/lib/core/congress/              # CWC integration (correct)
✅ prisma/schema.prisma                # Clean schema (no PII, only refs)
❌ src/lib/core/blockchain/ciphervault.ts  # NOT STARTED
❌ Integration with @voter-protocol/client # Can't integrate until SDK exists
```

**Blocker:** Can't integrate protocol SDK until voter-protocol builds it.

---

## 🎯 Development Strategy

### Phase 1: Build Protocol Primitives (voter-protocol)
**Timeline:** 1-2 weeks

1. **CipherVault Contract** (Rust/NEAR)
   - Deploy to testnet
   - `store_envelope`, `get_envelope`, `update_envelope`
   - Guardian recovery logic

2. **Crypto SDK** (TypeScript)
   - XChaCha20-Poly1305 encryption
   - Poseidon commitment generation
   - Sovereign key management
   - NEAR key derivation

3. **Client SDK** (TypeScript)
   - CipherVault integration
   - Chain Signatures wrapper
   - Reputation queries

4. **Publish NPM Packages**
   ```bash
   @voter-protocol/crypto
   @voter-protocol/client
   @voter-protocol/types
   ```

### Phase 2: Integrate in Communique (communique)
**Timeline:** 1 week

1. **Install Protocol SDK**
   ```bash
   npm install @voter-protocol/crypto @voter-protocol/client
   ```

2. **Create Integration Wrappers**
   - `src/lib/core/integrations/voter-protocol/`
   - Application-specific usage patterns

3. **Update Data Flows**
   - Template personalization → CipherVault
   - User profile → CipherVault
   - Congressional delivery → CipherVault references

### Phase 3: Deploy Both (coordinated)
**Timeline:** 1 week

1. Deploy CipherVault contract to NEAR mainnet
2. Deploy Scroll contracts (when ready)
3. Update communique to use mainnet contracts
4. Launch

---

## 📦 Package Structure (Future)

### voter-protocol Monorepo
```
voter-protocol/
├── contracts/
│   ├── scroll/                   # Solidity contracts
│   └── near/                     # Rust contracts
├── packages/
│   ├── crypto/                   # Encryption + ZK proofs
│   ├── client/                   # Protocol SDK
│   └── types/                    # Shared types
├── docs/
│   ├── ARCHITECTURE.md
│   └── integration-guide.md
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
1. Create `contracts/near/ciphervault/` directory
2. Implement basic CipherVault contract (Rust)
3. Create `packages/crypto/` with encryption primitives
4. Deploy contract to NEAR testnet
5. Publish `@voter-protocol/crypto` package

### This Week (communique):
1. Install protocol dependencies when available
2. Create integration wrappers
3. Update data flows to use CipherVault
4. Test end-to-end with testnet

### Next Week:
1. Build Scroll contracts (voter-protocol)
2. Create full protocol SDK (voter-protocol)
3. Complete communique integration
4. Deploy to production

---

**Principle:** Protocol primitives enable applications. Don't build application logic into protocol. Don't rebuild protocol primitives in applications.

**Current Blocker:** voter-protocol needs to build CipherVault contract + crypto SDK before communique can integrate.

**Next Step:** Decide where to start building (contract or SDK) and execute.
