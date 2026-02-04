# Implementation Status Report

**Date:** 2026-02-02 (Updated)
**Focus:** Where are we? What's done? What remains?
**Last Major Update:** Waves 1-3 Integration Remediation Complete

---

## TL;DR: MVP Status

**Database:** ✅ Privacy migration COMPLETE (PII removed, Message model added)
**Decision Maker Enrichment:** ✅ **PRODUCTION-READY** (3-phase AI pipeline, analytics integration, delivery coordination)
**Documentation Cleanup:** ✅ **COMPLETE** (95→15 active docs, 84% reduction, zero redundancy)
**Identity Verification:** ✅ **IMPLEMENTED** (Didit.me SDK with HMAC validation)
**Browser ZK Prover:** ✅ **INTEGRATED** (Svelte 5 store, witness builder, progress tracking)
**Congressional Submit:** ✅ **IMPLEMENTED** (nullifier-enforced, blockchain client)
**Security Hardening:** ✅ **COMPLETE** (rate limiting, URL validation, schema validation)
**Contract Security:** ✅ **COMPLETE** (164 tests, SA-001 through SA-018 remediated)
**TEE Infrastructure:** ⚪ **DEFERRED** (Phase 2)
**IPFS Sync:** ⚪ **DEFERRED** (Phase 2, SA-008)
**Launch Readiness:** 🟡 **90% COMPLETE** (Wave 4 in progress)

---

## What's COMPLETE ✅

### 1. Zero-Knowledge Proof Infrastructure (PRODUCTION-READY - voter-protocol)

**Status:** ✅ **BROWSER-NATIVE HALO2 PROVING FULLY IMPLEMENTED**

**What EXISTS and WORKS:**
- ✅ **Halo2 circuits** (K=14, 4,096-leaf Merkle trees):
  - Source: `/Users/noot/Documents/voter-protocol/packages/crypto/circuits/src/`
  - Trail of Bits audited (Axiom fork)
  - 117,473 cells, 8 columns, 16,384 rows
  - Public outputs: district_root, nullifier, action_id
- ✅ **Browser WASM prover** (wasm.rs, 621 lines):
  - Performance: 600ms-10s depending on device
  - Memory: ~800MB (mobile-compatible)
  - Proof size: ~4.6KB
  - API: `Prover::new(14)`, `prover.prove()`, `prover.verify()`
- ✅ **Native Rust prover** (prover.rs, 1141 lines):
  - EVM-compatible proof generation
  - KZG ceremony parameters (Ethereum, 141K participants)
  - Blake2b hash verification
  - Calldata encoding for Solidity verifier
- ✅ **Poseidon hash exports** (for Shadow Atlas Merkle tree building):
  - `hash_pair()` - matches circuit implementation exactly
  - `hash_single()` - leaf hashing
- ✅ **Solidity verifier contract** (generate_verifier.rs):
  - SHPLONK polynomial commitment
  - 300-500k gas verification
  - Deployed to Scroll zkEVM (pending)

**What's PENDING (Communique integration):**
- ⏳ Shadow Atlas registration API (backend)
- ⏳ WASM prover client (frontend)
- ⏳ Encrypted witness submission flow
- ⏳ On-chain proof verification integration

**Critical Correction:** Previous assessment incorrectly stated ZK proofs were "NOT IMPLEMENTED" and "TEE-based".
**Reality:** Browser-native proving is PRODUCTION-READY, no server-side proving needed (cypherpunk-compliant).

**Documentation:** `/Users/noot/Documents/communique/docs/ZK-PROOF-INTEGRATION-PHASE-1.md`

---

### 2. Database Privacy Migration (DONE)
- ✅ Removed ALL PII from User model:
  - `city`, `state`, `zip`, `congressional_district`
  - `latitude`, `longitude`
  - `political_embedding`, `community_sheaves`
- ✅ Created Message model (lines 257-292):
  - PUBLIC content (congressional offices read plaintext)
  - NO user_id linkage (pseudonymous)
  - Verification proofs + district hashes
  - Delivery tracking (office_read, office_responded)
- ✅ Updated Template model:
  - Aggregate metrics (`verified_sends`, `unique_districts`, `avg_reputation`)
  - No individual user tracking
- ✅ Migration executed: `npx prisma db push --accept-data-loss`
  - Deleted 12 user records with PII
  - Deleted 16 template records with individual tracking

### 2. Documentation Cleanup (COMPLETE)
- ✅ **Comprehensive audit**: 110 markdown files analyzed, ~50% duplication identified
- ✅ **Wave 1 (DELETE)**: 9 obsolete/cruft files removed
- ✅ **Wave 2 (ARCHIVE)**: 6 Phase 2/superseded planning docs archived
- ✅ **Wave 3 (CONSOLIDATE)**: 11/12 consolidations complete (README.md pending)
- ✅ **Information ownership**: Every piece of info has ONE home, zero redundancy
- ✅ **Final state**: 95→15 active docs (84% reduction)

### 3. Decision Maker Enrichment Pipeline (PRODUCTION-READY)
- ✅ **3-phase AI pipeline**: Location clarification → Decision-maker resolution → Message generation
- ✅ **Multi-agent coordination**: OpenAI + Gemini/Claude consensus with drift detection
- ✅ **Analytics integration**: Privacy-preserving differential privacy, funnel tracking
- ✅ **Delivery coordination**: Multi-target delivery (Congress + corporations + HOAs + schools + nonprofits)
- ✅ **Integration tests**: API pipeline tests, delivery coordination tests, analytics tests
- ✅ **Verification scripts**: Decision-maker logic tests, crash prevention, strict enforcement

### 3. TEE Provider Interface (DESIGN ONLY)
- ✅ `src/lib/core/tee/provider.ts` (191 lines):
  - Cloud-agnostic TEE interface
  - Support for GCP/AWS/Azure
  - EncryptedPayload, AttestationToken types
  - TEEResponse, TEEHealthStatus types
- ⚠️ **CRITICAL:** This is just the interface, NO IMPLEMENTATION

---

## What's MISSING (Critical Gaps) ❌

### 1. Encrypted Blob Storage - ZERO IMPLEMENTATION

**Status:** INTERFACE EXISTS, NO CODE

**Current State:**
```typescript
// src/lib/core/tee/provider.ts defines:
export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  userId: string;
  templateId: string;
  recipient: { ... };
}
```

**What's NOT implemented:**
- ❌ Browser-side encryption (XChaCha20-Poly1305)
- ❌ Postgres encrypted blob storage
- ❌ TEE public key distribution
- ❌ Encrypted blob retrieval
- ❌ AWS Nitro Enclave decryption
- ❌ CWC API delivery

**Impact:** **CANNOT DELIVER MESSAGES TO CONGRESS**

---

### 2. TEE Infrastructure - ZERO DEPLOYMENT

**Status:** NO AWS NITRO ENCLAVES DEPLOYED

**What's missing:**
- ❌ AWS Nitro Enclave deployment
- ❌ TEE container image (decryption code)
- ❌ Attestation verification
- ❌ CWC API integration inside enclave
- ❌ Key management (TEE private keys)

**Impact:** **CANNOT DECRYPT ADDRESSES FOR DELIVERY**

---

### 3. Browser-Side Encryption - NOT IMPLEMENTED

**Status:** NO CLIENT-SIDE ENCRYPTION CODE

**What's needed:**
```typescript
// MISSING: src/lib/core/identity/blob-encryption.ts
export async function encryptAddressBlob(
  address: Address,
  teePublicKey: Uint8Array
): Promise<EncryptedBlob> {
  // XChaCha20-Poly1305 encryption
  // IPFS upload (Phase 2)
  // On-chain pointer update (Phase 2)
}
```

**Currently NO CODE for:**
- ❌ libsodium integration
- ❌ TEE public key fetching
- ❌ Address encryption
- ❌ Nonce generation
- ❌ Ciphertext storage

**Impact:** **CANNOT ENCRYPT USER ADDRESSES**

---

### 4. Message Delivery Pipeline - INCOMPLETE

**Database Model:** ✅ EXISTS (Message model created)
**Backend Logic:** ❌ MISSING

**What's needed:**
```typescript
// MISSING: src/routes/api/messages/send/+server.ts
export async function POST({ request }) {
  // 1. Decrypt encrypted blob (fetch from Postgres or IPFS)
  // 2. Send to TEE for decryption
  // 3. TEE calls CWC API
  // 4. Create Message record (PUBLIC content + verification proof)
  // 5. Update Template aggregate metrics
}
```

**Impact:** **CANNOT SEND VERIFIED MESSAGES**

---

### 5. IPFS Storage - DOCUMENTED, NOT IMPLEMENTED

**Status:** ARCHITECTURE COMPLETE, ZERO CODE

**What's documented:**
- ✅ Cost analysis ($500/month Postgres vs $10 IPFS)
- ✅ Pinata integration plan
- ✅ On-chain pointer strategy
- ✅ Migration path

**What's missing:**
- ❌ Pinata API integration
- ❌ IPFS blob upload
- ❌ IdentityRegistry contract extension
- ❌ On-chain pointer update
- ❌ Migration script (Postgres → IPFS)

**Impact:** Phase 2 feature, NOT blocking launch

---

## Launch Blockers (Critical Path) 🚨

### Blocker #1: No Message Delivery

**Problem:** Cannot send messages to congressional offices

**Missing pieces:**
1. Browser encrypts address → NOT IMPLEMENTED
2. Postgres stores encrypted blob → NOT IMPLEMENTED
3. Backend fetches encrypted blob → NOT IMPLEMENTED
4. TEE decrypts + calls CWC API → NOT DEPLOYED
5. Message record created → DATABASE MODEL EXISTS, NO BACKEND

**Est. Effort:** 2-3 weeks
- Week 1: Browser encryption + Postgres storage
- Week 2: TEE deployment + CWC integration
- Week 3: End-to-end testing + bug fixes

---

### Blocker #2: No Identity Verification Flow

**Problem:** Cannot verify users are real constituents

**Current state:**
- ✅ Database fields exist (`is_verified`, `verification_method`, `district_hash`)
- ❌ NO integration with self.xyz or Didit.me
- ❌ NO session credential caching
- ✅ **ZK PROOF GENERATION: PRODUCTION-READY** (voter-protocol WASM prover)
  - Browser-native Halo2 proving (600ms-10s)
  - See: `/Users/noot/Documents/voter-protocol/packages/crypto/circuits/src/wasm.rs`
  - Integration pending: `/Users/noot/Documents/communique/docs/ZK-PROOF-INTEGRATION-PHASE-1.md`

**Est. Effort:** 1-2 weeks
- Week 1: self.xyz NFC passport integration + Shadow Atlas registration
- Week 2: WASM prover integration + encrypted delivery flow

---

### Blocker #3: No TEE Deployment

**Problem:** No AWS Nitro Enclaves running

**Missing infrastructure:**
- ❌ AWS Nitro Enclave EC2 instances
- ❌ Container image with decryption code
- ❌ KMS key management
- ❌ VPC networking
- ❌ Load balancing
- ❌ Monitoring + logging

**Est. Effort:** 1 week (if using AWS expertise)
- Day 1-2: Enclave setup + attestation
- Day 3-4: CWC API integration
- Day 5-7: Security audit + testing

---

## What's Partially Done ⚠️

### 1. Congressional Data (SOME WORK DONE)

**Implemented:**
- ✅ Representative model (lines 387-427)
- ✅ user_representatives relation
- ✅ Basic congressional office data

**Missing:**
- ❌ CWC API integration
- ❌ Address → district lookup
- ❌ Representative assignment logic

---

### 2. Analytics (MODEL COMPLETE, TRACKING MISSING)

**Database:**
- ✅ analytics_session model (lines 665-693)
- ✅ analytics_event model (lines 695-719)
- ✅ Message tracking fields (office_read, office_responded)

**Code:**
- ⚠️ Partial tracking in `src/lib/core/analytics/`
- ❌ NO congressional office engagement tracking
- ❌ NO Message analytics queries

---

### 3. Blockchain Integration (READ-ONLY ONLY)

**Implemented:**
- ✅ `src/lib/core/blockchain/voter-client.ts` - Basic client
- ✅ Database fields (scroll_address, civic_action, etc.)

**Missing:**
- ❌ On-chain reputation updates
- ❌ Transaction signing
- ❌ Gas management
- ❌ voter-protocol smart contract deployment

---

## Implementation Plan (Week-by-Week)

### Overview: Parallel UX + Backend Development (8-10 weeks)

**Strategy:** Build UX layer FIRST to validate user flow, then wire up backend crypto as each piece completes.

**Team Structure:**
- **Frontend Track:** SvelteKit components, UX flows, progressive disclosure
- **Backend Track:** Encryption, TEE deployment, ZK proof integration, blockchain
- **Integration Points:** Connect frontend to backend as features complete

---

### ✅ COMPLETE: Decision Maker Enrichment Pipeline (2026-01-15)

**Goal:** 3-phase AI pipeline for location clarification, decision-maker resolution, and message generation

**Status:** PRODUCTION-READY

**What's Complete:**
- ✅ **Phase 1 (Location Clarification)**: Multi-agent location resolution with Claude + Gemini consensus
- ✅ **Phase 2 (Decision-Maker Resolution)**: Strict validation, crash prevention, and fallback handling
- ✅ **Phase 3 (Message Generation)**: Context-aware message generation with template variables
- ✅ **Analytics Integration**: Privacy-preserving analytics with differential privacy
- ✅ **Delivery Coordination**: Multi-target delivery (Congress + corporations + HOAs + schools + nonprofits)
- ✅ **Integration Tests**: API pipeline tests, delivery coordination tests, analytics tests (53→6 tests)
- ✅ **Verification Scripts**: Decision-maker logic tests, crash prevention validation

**Production Features:**
- Multi-agent consensus with drift detection
- Comprehensive error handling and fallback strategies
- Privacy-preserving analytics (differential privacy, k-anonymity)
- Smart mocks for testing (no external API dependencies)
- Integration-first test suite (database, API, auth flows)

**Documentation:**
- Integration: `docs/development/integrations/decision-maker-resolution-integration.md`
- Analytics: `docs/specs/analytics/*.md` (7 comprehensive docs)
- Testing: `docs/development/testing.md` (integration-first approach)

---

### Week 1-2: Core UX Foundation (FRONTEND FIRST)

**Goal:** Validate user flow with fake data, perfect UX before adding crypto complexity

#### Frontend Tasks:
1. **Template Browsing UI** (2 days)
   - Component: `<TemplateCard>` with aggregate metrics
   - Route: `/browse`, `/template/:slug`
   - State: Svelte 5 runes ($state, $derived)
   - Data: Mock templates (hardcoded JSON)

2. **Template Customization UI** (2 days)
   - Component: `<TemplateEditor>` with character limits
   - Feature: localStorage auto-save (draft recovery)
   - Validation: Max 500 chars personal story
   - Data: LOCAL STATE ONLY (not persisted yet)

3. **Message Preview UI** (1 day)
   - Component: `<MessagePreview>` showing what office sees
   - Feature: Privacy badges (🔒 Anonymous, ✅ Verified)
   - Mock: "From: Verified Constituent (TX-07)"

4. **Mobile-Responsive Design** (2 days)
   - Layout: Mobile-first (80% of users on mobile)
   - Testing: iPhone SE, Pixel 5, iPad
   - Performance: <3s initial load

#### Backend Tasks (Parallel):
5. **Database Schema Updates** (2 days)
   - Add `encrypted_delivery_data` table
   - Add `ShadowAtlasTree` model
   - Add `Submission` model (ZK proofs)
   - Migration: `npx prisma db push`

6. **Install Dependencies** (1 day)
   - `npm install libsodium-wrappers` (browser encryption)
   - `npm install @voter-protocol/crypto` (ZK proofs)
   - `npm install @self-id/sdk` (NFC passport)
   - `npm install @didit/sdk` (government ID)

**Deliverable (Week 2):** Fully functional UX with mock data. User can browse templates, customize, preview message. NO BACKEND yet.

---

### Week 3-4: Identity Verification + Session Management

**Goal:** User can verify identity (self.xyz or Didit.me), session credential cached

#### Frontend Tasks:
7. **Verification Prompt UI** (2 days)
   - Component: `<VerificationPrompt>` with provider choice
   - Options: self.xyz (30s) vs Didit.me (2min)
   - Progressive disclosure: "How is this private?" details

8. **self.xyz NFC Integration** (3 days)
   - SDK: `@self-id/sdk` NFC passport flow
   - Loading: "Verifying with self.xyz..." (30s)
   - Error: "NFC not available" → fallback to Didit.me
   - Output: `identity_commitment` (Poseidon hash)

9. **Didit.me Integration** (2 days)
   - SDK: `@didit/sdk` government ID flow
   - Loading: "Verifying with Didit.me..." (2min)
   - Output: `identity_proof` (ZK credential)

10. **Session Credential Caching** (1 day)
    - Storage: IndexedDB (not localStorage - can store Uint8Array)
    - Schema: `{ identity_commitment, leaf_index, merkle_path, expires_at }`
    - Expiration: 3-6 months
    - UI: "✅ Verified TX-07 Constituent (expires 2026-01-01)"

#### Backend Tasks (Parallel):
11. **Browser Encryption Module** (3 days)
    - File: `src/lib/core/identity/blob-encryption.ts`
    - Function: `encryptAddressBlob(address, teePublicKey)`
    - Crypto: XChaCha20-Poly1305 AEAD (libsodium)
    - Test: Encrypt → decrypt round-trip

12. **TEE Public Key Endpoint** (1 day)
    - Route: `GET /api/tee/public-key`
    - Response: `{ publicKey: "base64...", keyId: "phase1-v1" }`
    - Source: Environment variable (Phase 1), AWS KMS (Phase 2)

13. **Encrypted Blob Storage** (2 days)
    - Route: `POST /api/identity/store-blob`
    - Input: `{ ciphertext, nonce, ephemeralPublicKey, userId }`
    - Storage: Postgres `encrypted_delivery_data` table
    - Security: Platform CANNOT decrypt (TEE key only)

**Deliverable (Week 4):** User can verify identity, encrypted address stored in Postgres, session credential cached. NO ZK PROOFS yet.

---

### Week 5-6: ZK Proof Generation + Shadow Atlas

**Goal:** Browser generates ZK proofs, Shadow Atlas Merkle trees operational

#### Frontend Tasks:
14. **WASM Prover Client** (3 days)
    - File: `src/lib/core/zkp/prover-client.ts`
    - Function: `initializeProver()` (5-10s first time)
    - Function: `generateDistrictMembershipProof(params)`
    - Performance: 600ms-10s depending on device

15. **Proof Generation UI** (2 days)
    - Loading: "Loading privacy tools..." (prover init, 5-10s)
    - Loading: "Preparing anonymous delivery..." (proof gen, 8-15s mobile)
    - Progress: Accurate time estimates, progress bar
    - Error: "Proof generation failed" → retry or contact support

16. **Mobile Optimization** (2 days)
    - Memory: Reduce WASM footprint (~800MB)
    - Cancel: Handle user navigating away during proving
    - Fallback: Detect low-memory devices, graceful degradation

#### Backend Tasks (Parallel):
17. **Shadow Atlas Registration API** (4 days)
    - Route: `POST /api/shadow-atlas/register`
    - Input: `{ identity_commitment, congressional_district, identity_proof }`
    - Process:
      1. Verify identity proof (self.xyz or Didit.me)
      2. Add commitment to district Merkle tree (4,096 max)
      3. Recompute root using Poseidon hash
      4. Generate merkle_path for user (12 sibling hashes)
    - Output: `{ leaf_index, merkle_path, merkle_root, district_size }`

18. **Merkle Tree Building** (2 days)
    - Function: `computeMerkleRoot(leaves)` using `@voter-protocol/crypto`
    - Function: `generateMerklePath(leaves, leafIndex)`
    - Hashing: Poseidon (MUST match circuit implementation)
    - Storage: Update `ShadowAtlasTree` model in Postgres

**Deliverable (Week 6):** Browser generates ZK proofs, Shadow Atlas stores commitments, merkle_path returned for proving. NO DELIVERY yet.

---

### Week 7-8: Message Delivery Pipeline + TEE Deployment

**Goal:** End-to-end delivery - browser encrypts → TEE decrypts → CWC delivers

#### Frontend Tasks:
19. **Submission Endpoint Integration** (2 days)
    - Route: `POST /api/congressional/submit`
    - Payload: `{ proof, publicOutputs, encryptedWitness, encryptedMessage, templateId }`
    - Loading: "Delivering to Representative Smith..."
    - Success: "✅ Delivered anonymously!"
    - Error: "Delivery failed" → show retry UI

20. **Delivery Queue UI** (1 day)
    - Component: `<DeliveryQueue>` showing pending/failed deliveries
    - Feature: Manual retry for failed deliveries
    - Status: "Pending", "Delivered", "Failed", "Retrying"

#### Backend Tasks (Parallel):
21. **Submission Endpoint** (3 days)
    - Route: `POST /api/congressional/submit`
    - Process:
      1. Check nullifier not reused (prevent double-action)
      2. Store submission in Postgres (encrypted blobs)
      3. Submit ZK proof to Scroll L2 (async, gas-free for user)
      4. Send encrypted blob to TEE for delivery
      5. Create Message record (PUBLIC content, no user_id)
    - Response: `{ submission_id, status: "pending" }`

22. **AWS Nitro Enclave Deployment** (5-7 days)
    - Infrastructure:
      - EC2 c6g.large (ARM Graviton with Nitro Enclaves)
      - VPC networking, security groups
      - KMS key management (TEE private key)
    - Container:
      - Rust decryption service (XChaCha20-Poly1305)
      - CWC API client (SOAP)
      - Attestation verification
    - Testing:
      - Decrypt test blob → verify plaintext address
      - Call CWC API with test data
      - Confirm address DESTROYED after delivery

23. **CWC API Integration (Inside TEE)** (3-5 days)
    - Endpoint: `POST https://<tee-endpoint>/decrypt-and-deliver`
    - Input: `{ encrypted_witness, encrypted_message, representative_ids }`
    - Process:
      1. Decrypt witness inside enclave (address exists ONLY in memory)
      2. Call CWC SOAP API with plaintext address
      3. Receive delivery confirmation
      4. ZERO all secrets (address destroyed)
    - Output: `{ delivery_id, status: "delivered", timestamp }`

**Deliverable (Week 8):** Full E2E delivery. User sends message → TEE decrypts → CWC delivers → congressional office receives. NO BLOCKCHAIN yet.

---

### Week 9-10: On-Chain Reputation + Polish

**Goal:** ZK proofs verified on-chain, reputation updates, progressive disclosure polished

#### Frontend Tasks:
24. **Progressive Disclosure** (2 days)
    - Feature: `<details>` elements for technical explanations
    - Page: `/docs/privacy` (how anonymity works)
    - Component: `<CryptographicProofViewer>` (power users only)
    - Links: Scroll block explorer for on-chain transactions

25. **Error State Polish** (2 days)
    - Error: "NFC unavailable" → clear fallback to Didit.me
    - Error: "Proof generation failed" → retry or contact support
    - Error: "Delivery failed" → automatic retry queue
    - Error: "Session expired" → re-verification prompt

26. **Performance Optimization** (1 day)
    - Lazy load: WASM prover (only load when needed)
    - Code split: Template editor, verification UI
    - Image optimization: WebP, lazy loading
    - Target: <3s initial load, <1s navigation

#### Backend Tasks (Parallel):
27. **Blockchain Integration** (5-7 days)
    - Deploy smart contracts to Scroll L2:
      - IdentityRegistry.sol (identity commitments)
      - ReputationRegistry.sol (ERC-8004)
      - DistrictGate.sol (Halo2 verifier)
    - Integration:
      - `voterBlockchainClient.submitProof(proof, publicOutputs)`
      - `voterBlockchainClient.updateReputation(nullifier, domain, amount)`
      - Gas management (platform pays fees)
    - Testing:
      - Submit test proof → verify on-chain
      - Check nullifier reuse prevention
      - Confirm reputation update event

28. **Message Analytics** (2 days)
    - Track: office_read, office_responded (congressional engagement)
    - Aggregate: Template metrics (verified_sends, unique_districts)
    - Dashboard: Admin view of delivery success rates

**Deliverable (Week 10):** MVP COMPLETE. Full E2E flow with on-chain verification, reputation updates, polished UX, production-ready.

---

## Integration Points (Frontend ↔ Backend)

### Week 2 → Week 3
**Handoff:** Frontend template UI → Backend template API
- Frontend: Mock template data
- Backend: Real Postgres queries
- Integration: `GET /api/templates` returns actual templates

### Week 4 → Week 5
**Handoff:** Frontend verification UI → Backend encryption
- Frontend: self.xyz/Didit.me returns identity_commitment
- Backend: Encrypt address, store in Postgres
- Integration: `POST /api/identity/store-blob`

### Week 6 → Week 7
**Handoff:** Frontend ZK proof → Backend Shadow Atlas
- Frontend: Browser generates proof
- Backend: Shadow Atlas returns merkle_path
- Integration: `POST /api/shadow-atlas/register`

### Week 8 → Week 9
**Handoff:** Frontend submission → Backend TEE delivery
- Frontend: Submit proof + encrypted blobs
- Backend: TEE decrypts, CWC delivers
- Integration: `POST /api/congressional/submit`

### Week 10
**Handoff:** Frontend blockchain links → Backend on-chain verification
- Frontend: Display Scroll transaction links
- Backend: Submit proofs, update reputation
- Integration: `voterBlockchainClient` queries

---

## Team Parallel Work (Maximize Efficiency)

### Frontend Developer (Weeks 1-10)
- Week 1-2: Template browsing, customization UI (mock data)
- Week 3-4: Verification UI (self.xyz, Didit.me)
- Week 5-6: WASM prover client, loading states
- Week 7-8: Submission UI, delivery queue
- Week 9-10: Progressive disclosure, error states, polish

### Backend Developer (Weeks 1-10)
- Week 1-2: Database schema, install dependencies
- Week 3-4: Browser encryption, encrypted blob storage
- Week 5-6: Shadow Atlas API, Merkle tree building
- Week 7-8: TEE deployment, CWC API integration
- Week 9-10: Blockchain deployment, reputation updates

### Integration Sprints (End of Each 2-Week Block)
- Week 2: Connect frontend to template API
- Week 4: Connect verification UI to encryption backend
- Week 6: Connect ZK prover to Shadow Atlas
- Week 8: Connect submission UI to TEE delivery
- Week 10: Connect frontend to blockchain verification

---

## Total MVP Timeline: 8-10 Weeks

**What This Means:**
- Browser-native ZK proving (anonymous constituent verification)
- Shadow Atlas Merkle trees (district membership proofs)
- On-chain reputation tracking (ERC-8004)
- Both identity providers (self.xyz + Didit.me)
- Full encrypted delivery flow (TEE-based)

**NO SHORTCUTS. THIS IS THE MVP.**

---

### P1: POST-LAUNCH OPTIMIZATIONS (Phase 2, 3-6 months)

1. **IPFS Migration** (1-2 weeks)
   - Pinata API integration
   - IdentityRegistry contract extension
   - Migration script (Postgres → IPFS)
   - Cost savings: 99.97%

2. **Multi-Agent Content Moderation** (3-4 weeks)
   - LangGraph workflow orchestration
   - 3-agent consensus (OpenAI, Gemini, Claude)
   - Template quality scoring

3. **Congressional Office Dashboard** (4-6 weeks)
   - Office verification badges
   - Constituent engagement analytics
   - Response tracking

---

### P2: FUTURE ENHANCEMENTS (Phase 2+)

1. Congressional Office Dashboard
2. Multi-agent content moderation
3. Template analytics
4. Outcome markets
5. Challenge markets

---

## Critical Decisions Needed

### Decision #1: Launch Strategy

**Option A: Ship Phase 1 with Postgres blobs** (RECOMMENDED)
- ✅ Faster to market (3-4 weeks)
- ✅ Proven technology (Postgres)
- ✅ Can migrate to IPFS later
- ❌ Higher costs ($500/month for 100k users)
- ❌ Vendor lock-in (temporary)

**Option B: Wait for IPFS architecture**
- ✅ Lower costs ($10 one-time)
- ✅ Portable from day one
- ❌ Slower to market (+2-3 weeks)
- ❌ More complex (blockchain + IPFS)

**Recommendation:** Option A (ship with Postgres, migrate Phase 2)

---

### Decision #2: TEE Provider

**Option A: AWS Nitro Enclaves** (RECOMMENDED)
- ✅ Battle-tested (used by AWS KMS)
- ✅ Best documentation
- ✅ ARM-based (no Intel ME/AMD PSP)
- ❌ AWS vendor lock-in
- **Cost:** ~$500-800/month

**Option B: GCP Confidential Space**
- ✅ AMD SEV-SNP (strong isolation)
- ✅ Google Cloud ecosystem
- ❌ Less mature
- ❌ Worse documentation

**Recommendation:** AWS Nitro (easier to implement)

---

### Decision #3: Identity Verification

**Option A: self.xyz NFC passport** (PRIMARY)
- ✅ FREE
- ✅ 30-second verification
- ✅ Strong identity proof
- ❌ Requires NFC-enabled passport

**Option B: Didit.me** (FALLBACK)
- ✅ FREE
- ✅ Government ID + liveness
- ❌ 2-3 minute flow
- ❌ Less convenient

**Recommendation:** Both (70% self.xyz, 30% Didit.me)

---

## Next Steps (Immediate)

### This Week (Nov 9-15):

1. **Browser Encryption** (3 days)
   - Install libsodium.js
   - Implement `encryptAddressBlob()`
   - Test encryption/decryption locally

2. **Postgres Encrypted Storage** (2 days)
   - Create `encrypted_delivery_data` table
   - Implement storage/retrieval API

3. **TEE Deployment Planning** (2 days)
   - AWS account setup
   - Nitro Enclave documentation review
   - Container image architecture

### Next Week (Nov 16-22):

1. **TEE Deployment** (5 days)
   - Deploy Nitro Enclave EC2
   - Build decryption container
   - Attestation verification

2. **CWC Integration** (2 days)
   - SOAP API client
   - Delivery confirmation handling

### Week After (Nov 23-29):

1. **Message Delivery Pipeline** (3 days)
   - API endpoint implementation
   - End-to-end testing

2. **Identity Verification** (4 days)
   - self.xyz integration
   - Session credential caching

**Launch Target:** Mid-December 2025 (4-5 weeks)

---

## Summary: The Honest Picture

**What we have:**
- ✅ Privacy-compliant database schema
- ✅ Comprehensive architecture documentation
- ✅ voter-protocol ZK proving infrastructure (PRODUCTION-READY)
- ✅ TEE provider interface design
- ✅ Cost analysis (Postgres vs IPFS)

**What we MUST implement for MVP:**
- ⏳ Browser-side encryption (XChaCha20-Poly1305)
- ⏳ Encrypted blob storage (Postgres)
- ⏳ TEE deployment (AWS Nitro Enclaves)
- ⏳ Message delivery pipeline
- ⏳ Identity verification (self.xyz + Didit.me)
- ⏳ ZK proof integration (WASM prover client)
- ⏳ Shadow Atlas Merkle trees
- ⏳ On-chain reputation (ERC-8004)

**Launch readiness:** **~15% complete** (only crypto infrastructure from voter-protocol done)

**MVP Timeline:** **8-10 weeks** of focused implementation

**What's REQUIRED (no shortcuts):**
- ✅ Browser-native ZK proving (anonymous verification)
- ✅ Shadow Atlas Merkle trees (district membership proofs)
- ✅ On-chain reputation (ERC-8004 updates)
- ✅ Both identity providers (self.xyz + Didit.me)
- ✅ Full TEE encrypted delivery

**Phase 2 optimizations (post-launch):**
- IPFS migration (99.97% cost savings)
- Multi-agent content moderation
- Congressional office dashboard

---

**This is the reality. No bullshit. No shortcuts. This is what the MVP requires.**
