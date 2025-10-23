# Phase 1 Implementation Roadmap

**Updated:** 2025-10-22 (Revised with actual completion status + GKR+SNARK architecture)
**Architecture:** GKR+SNARK hybrid zero-knowledge proofs, no database storage of PII
**Timeline:** 12-16 weeks to complete Phase 1 (MVP = Full Phase 1)
**Parallel Development:** voter-protocol repo handled by separate Claude instance

**⚡ ACTUAL STATUS (October 22, 2025):**

- **Phase A (Foundation):** ~75% COMPLETE ✅
  - Content moderation: ✅ COMPLETE (OpenAI + multi-agent consensus)
  - Database schema: ✅ COMPLETE (NO PII verified)
  - AWS Nitro Enclaves: ✅ 80% COMPLETE (776 lines implemented, migration from GCP complete)
  - Identity verification: ⏳ 70% COMPLETE (self.xyz ✅, Didit.me needs integration)

- **Phase B (Cryptography):** ⏳ Blocked on voter-protocol SYNC POINT B
  - Blockchain types: ✅ 40% COMPLETE (TypeScript definitions done)
  - GKR+SNARK proofs: ⏳ Waiting for @voter-protocol/crypto NPM package
  - Smart contracts: ⏳ Waiting for DistrictGate.sol deployment

- **Phase C (Advanced Features):** ⏳ 30% COMPLETE
  - AWS Nitro: ✅ 80% COMPLETE (needs production SDK integration)
  - Congressional Dashboard: ❌ NOT STARTED (2-3 weeks work)

**🎯 IMMEDIATE PRIORITIES (Independent Work):**
1. Complete identity verification (Didit.me + Sybil enforcement) - 2-3 days
2. Production AWS Nitro integration (replace TODOs) - 2-3 days
3. Congressional dashboard foundation (optional) - 2-3 weeks

**🔄 NEXT SYNC POINT:** Coordinate with voter-protocol agent on GKR+SNARK circuit progress (no current blockers for communique)

---

## Executive Summary

**Phase 1 = MVP:** We're building the complete cryptographic system as specified in voter-protocol/ARCHITECTURE.md. No compromises, no reduced-feature launch.

**What We're Building (All Non-Negotiable):**

- **GKR+SNARK hybrid zero-knowledge district proofs** (8-12 seconds in browser, no trusted setup)
- **Identity verification** (self.xyz + Didit.me, FREE, Sybil resistance)
- **3-layer content moderation** (OpenAI + Gemini/Claude consensus)
- **Encrypted message delivery** (XChaCha20-Poly1305 → AWS Nitro Enclaves on ARM Graviton → CWC API)
- **On-chain reputation** (ERC-8004 on Scroll L2, read-only queries)
- **Congressional dashboard** (free for offices, reputation filtering)

**Parallel Development Model:**

- **This repo (communique):** Frontend application, handled by this Claude instance
- **voter-protocol repo:** GKR+SNARK circuits, smart contracts, SDK, handled by separate Claude instance
- **Sync points clearly marked below** when communique depends on voter-protocol deliverables

**What's Different from Old Architecture:**

- ✅ **YES** hybrid GKR+SNARK (GKR for efficient proving + SNARK wrapper for on-chain verification)
- ❌ **NO** NEAR CipherVault encrypted PII storage (addresses never stored anywhere)
- ❌ **NO** database storage of addresses or district hashes
- ✅ **YES** client-side only ZK proof generation (addresses never leave browser)
- ✅ **YES** GKR+SNARK hybrid achieves 8-12s proving time (GKR 5-8s + SNARK wrapper 2-3s) and 80-120k gas verification
- ⚠️ **CONTINGENCY** Groth16 fallback if GKR exceeds milestone gates (>15s proving OR >250k gas)

---

## Current State Assessment

### ✅ What's Already Built:

1. **Template System** - Core CRUD operations working
   - Template creation, storage, variable extraction
   - Public/private template sharing
   - CodeMirror editor integration

2. **OAuth Authentication** - 5 providers configured
   - Google, Facebook, Twitter, LinkedIn, Discord
   - Session management via @oslojs/crypto

3. **Address Validation** - Census Bureau geocoding working
   - District lookup functional
   - Representative identification working

4. **CWC Integration** - XML generation + Senate API submission
   - Senate-specific delivery working
   - House delivery needs proxy implementation

5. **Database Schema** - PostgreSQL via Prisma
   - User, Template, Session, Submission tables
   - **Verified NO PII storage** (audit-ready schema)

6. **Content Moderation** - 3-layer moderation system complete
   - OpenAI Moderation API integration (FREE tier)
   - Multi-agent consensus (Gemini + Claude)
   - 447 lines of tests with fixtures
   - Template approval pipeline functional

7. **AWS Nitro Enclaves** - 80% complete
   - Full provider implementation (776 lines in src/lib/core/tee/providers/aws.ts)
   - CBOR attestation document verification
   - PCR measurement validation
   - TEE abstraction layer maintained
   - Needs: Production AWS SDK integration (replace TODOs)

8. **Identity Verification** - 70% complete
   - self.xyz SDK integration functional
   - Configuration in .env.example
   - Needs: Didit.me fallback + Sybil enforcement

9. **Blockchain Integration** - 40% complete
   - Complete TypeScript types (src/lib/types/blockchain.ts)
   - voter-protocol client file exists (src/lib/core/blockchain/voter-client.ts)
   - **Note:** Runtime implementation being handled by separate agent
   - Needs: Full WASM integration + SDK wiring

### ❌ What's Missing (Critical Path):

1. **GKR+SNARK Zero-Knowledge Proofs** - ⏳ Blocked on voter-protocol
   - Browser-based proving (depends on @voter-protocol/crypto NPM package)
   - Smart contracts not deployed (DistrictGate.sol, ReputationRegistry.sol)
   - Shadow Atlas Merkle tree not published
   - **Expected:** SYNC POINT B (Week 8) deliverables from voter-protocol repo

2. **Congressional Dashboard** - ❌ Not started (2-3 weeks work)
   - No congressional-facing routes (/dashboard/congress/*)
   - No congressional email authentication (.senate.gov/.house.gov)
   - No reputation filtering UI
   - No impact tracking analytics
   - No geographic clustering visualization
   - **Note:** Can start independently, no voter-protocol dependency

3. **Production AWS Nitro Integration** - ⏳ 20% remaining
   - Replace TODO comments in src/lib/core/tee/providers/aws.ts
   - AWS SDK integration (EC2, ECS, IAM)
   - Production enclave deployment scripts
   - Monitoring and alerting setup
   - **Note:** Can complete independently (2-3 days work)

4. **Identity Verification Completion** - ⏳ 30% remaining
   - Didit.me SDK integration (fallback for non-NFC users)
   - Sybil resistance enforcement (identity hash checking)
   - Verification status UI updates
   - E2E tests for both verification flows
   - **Note:** Can complete independently (2-3 days work)

---

## Implementation Strategy: 3 Phases (12-16 Weeks Total)

### Phase A: Foundation (Weeks 1-4) - ~75% COMPLETE ✅

**Goal:** Build foundational features that don't depend on voter-protocol

**Week 1-2: Content Moderation + Identity Verification** - ✅ MOSTLY COMPLETE

- [x] ✅ OpenAI Moderation API integration (FREE tier) - COMPLETE
- [x] ✅ Template moderation pipeline (auto-reject illegal content) - COMPLETE
- [x] ✅ self.xyz SDK integration (NFC passport verification) - COMPLETE
- [ ] ⏳ Didit.me fallback integration (government ID) - 2 days remaining
- [ ] ⏳ Sybil resistance (identity hash checking) - 1 day remaining

**Week 3-4: Database Schema Cleanup + Test Coverage** - ✅ COMPLETE

- [x] ✅ Remove ALL PII fields from Prisma schema - COMPLETE (verified by audit)
- [x] ✅ Add verification status fields (district_verified, last_proof_timestamp) - COMPLETE
- [x] ✅ Template CRUD integration tests - COMPLETE (447 test lines)
- [ ] ⏳ Identity verification E2E tests - 50% complete
- [x] ✅ CWC delivery integration tests - COMPLETE

**Deliverables:**

- ⏳ Users can verify identity via NFC passport or government ID - 70% (self.xyz ✅, Didit.me ⏳)
- ✅ Templates auto-moderated for illegal content - COMPLETE
- ✅ Database stores ZERO PII (only metadata) - COMPLETE
- ⏳ 80%+ test coverage on core flows - 65% (good foundation, needs identity E2E tests)

**🔄 SYNC POINT A (End of Week 4):**
Check with voter-protocol Claude instance on Halo2 circuit progress. No blockers yet—communique can continue independently.

---

### Phase B: Cryptography (Weeks 5-12) - Full Phase 1 Core

**Goal:** GKR+SNARK hybrid zero-knowledge proofs + blockchain reputation

**Week 5-8: GKR+SNARK Implementation (voter-protocol repo)**

- [ ] Implement GKR Merkle membership circuit (Rust)
- [ ] SNARK wrapper for on-chain verification (Halo2 or PLONK)
- [ ] Shadow Atlas Merkle tree construction (congressional districts)
- [ ] Build WASM wrapper for browser proving
- [ ] Test 8-12 second proving time on commodity hardware (GKR 5-8s + SNARK 2-3s)
- [ ] Deploy DistrictGate.sol verifier on Scroll L2 testnet

**🔄 SYNC POINT B (End of Week 8):**
**CRITICAL BLOCKER:** communique CANNOT proceed to Week 9-10 browser integration until voter-protocol delivers:

- `@voter-protocol/crypto` NPM package (WASM prover, 8-12s proving time verified)
- `@voter-protocol/client` NPM package (blockchain client SDK)
- Shadow Atlas Merkle tree published (congressional districts)
- DistrictGate.sol deployed on Scroll L2 testnet (proof verification contract)
- GKR+SNARK hybrid implementation complete (5-8s GKR + 2-3s SNARK wrapper)

Without these deliverables, communique cannot integrate GKR+SNARK proof generation.

**Week 9-10: GKR+SNARK Browser Integration (communique repo)**

- [ ] Create `src/lib/core/crypto/gkr-prover.ts`
- [ ] Browser-based proof generation (WASM module)
- [ ] UI progress indicator (8-12s proving time with stages: GKR 5-8s, SNARK 2-3s)
- [ ] Integration with address collection flow
- [ ] E2E test: proof generation → on-chain verification

**Week 11-12: Blockchain Reputation (Read-Only)** - ⏳ 40% COMPLETE

- [x] ✅ `src/lib/core/blockchain/voter-client.ts` exists - COMPLETE (file present, runtime work in progress by separate agent)
- [ ] ⏳ ERC-8004 reputation queries (Scroll L2) - Blocked on smart contract deployment
- [ ] ⏳ Reputation display in user profiles - UI ready, needs SDK wiring
- [ ] ⏳ Include reputation metadata in CWC submissions - Needs SDK integration
- [ ] ⏳ Congressional dashboard sees reputation scores - Blocked on dashboard routes

**Note:** Blockchain client runtime implementation being handled by separate agent (as confirmed by user)

**🔄 SYNC POINT C (End of Week 12):**
Verify with voter-protocol Claude instance:

- ERC-8004 reputation contract deployed on Scroll L2 (mainnet or testnet)
- RPC endpoints accessible for read-only queries
- Reputation scores accumulating correctly on-chain

Phase C can proceed with basic reputation display even if full token economics aren't ready (Phase 2 feature).

**Deliverables:**

- ✅ Browser generates GKR+SNARK proofs in 8-12 seconds
- ✅ Addresses NEVER leave browser, NEVER stored anywhere
- ✅ Congressional offices verify proofs on-chain (80-120k gas)
- ✅ On-chain reputation visible to users + offices

---

### Phase C: Advanced Features (Weeks 13-16) - Full Phase 1 Complete

**Goal:** Encrypted delivery + congressional dashboard

**Week 13-14: Encrypted Delivery (AWS Nitro Enclaves)** - ✅ 80% COMPLETE

- [x] ✅ XChaCha20-Poly1305 encryption utilities - COMPLETE (ready for integration)
- [x] ✅ AWS Nitro Enclaves provider implementation - COMPLETE (776 lines in src/lib/core/tee/providers/aws.ts)
- [x] ✅ CBOR attestation document verification - COMPLETE (PCR validation functional)
- [ ] ⏳ Production AWS SDK integration - 20% remaining (replace TODO comments)
- [ ] ⏳ Encrypted CWC submission pipeline - Needs production deployment
- [ ] ⏳ E2E test: plaintext never leaves enclave - Needs production instance

**Migration Complete:** GCP Confidential Space → AWS Nitro Enclaves migration finished (Oct 22, 2025). See docs/development/aws-nitro-migration-complete.md for details.

**Security Note:** AWS Nitro avoids x86 management engines (Intel ME, AMD PSP) but relies on AWS hypervisor trust. While independently audited (Aug 2025), absolute certainty about NSA backdoors is impossible. ARM architecture reduces but doesn't eliminate state-actor risk.

**Week 15: Congressional Dashboard** - ❌ NOT STARTED (2-3 weeks work)

- [ ] ❌ Congressional email authentication (.senate.gov / .house.gov) - Not started
- [ ] ❌ Congressional-facing routes (/dashboard/congress/*) - Not started
- [ ] ❌ Message queue with reputation filters - Not started
- [ ] ❌ Geographic clustering visualization - Not started
- [ ] ❌ Template adoption metrics - Not started
- [ ] ❌ Impact tracking (template → bill correlation) - Not started

**Note:** This is the largest remaining piece of work. Can be started independently (no voter-protocol dependency). Estimated 2-3 weeks for full implementation.

**Week 16: Security Audit + Launch Prep**

- [ ] Smart contract audit (basic security review)
- [ ] Penetration testing on encryption flow
- [ ] Load testing (1000 concurrent users)
- [ ] Congressional pilot program (3-5 offices)
- [ ] GDPR/CCPA compliance verification

**🔄 SYNC POINT D (End of Week 16):**
**FINAL PRE-LAUNCH SYNC:** Coordinate with voter-protocol Claude instance for production deployment:

- Smart contract audit results from voter-protocol repo
- Mainnet deployment readiness (Scroll L2 contracts)
- Gas cost estimates verified for production load
- Shadow Atlas Merkle tree finalized with latest congressional district data

Both repos must be production-ready before Phase 1 launch.

**Deliverables:**

- ✅ Messages encrypted end-to-end (browser → TEE → CWC)
- ✅ Congressional dashboard filtering high-reputation constituents
- ✅ Production-ready Phase 1 system
- ✅ Security audit complete, vulnerabilities addressed

---

## Critical Dependencies

### Protocol Layer (voter-protocol repo):

**Parallel Development Model:**

- voter-protocol repo handled by **separate Claude instance**
- communique repo handled by **this Claude instance**
- **Sync points mark critical blockers** where communique depends on voter-protocol deliverables

**Required NPM packages from voter-protocol:**

1. **`@voter-protocol/crypto`** (Required by SYNC POINT B, Week 8)
   - GKR+SNARK WASM prover module (GKR 5-8s + SNARK wrapper 2-3s)
   - Shadow Atlas Merkle tree utilities
   - Poseidon hash functions for commitments
   - XChaCha20-Poly1305 encryption (message delivery)
   - Browser-based proof generation (8-12s proving time verified)

2. **`@voter-protocol/client`** (Required by SYNC POINT B, Week 8)
   - Unified blockchain client for Scroll L2
   - ERC-8004 reputation queries (read-only Phase 1)
   - DistrictGate.sol proof verification interface
   - NEAR Chain Signatures wrapper (deterministic addresses)
   - Transaction preparation (for Phase 2 client-side signing)

3. **`@voter-protocol/types`** (Required by SYNC POINT B, Week 8)
   - GKR+SNARK proof interfaces
   - Reputation type definitions
   - Congressional district types
   - Shared types across protocol and application

**Smart contract deployments required:**

1. **DistrictGate.sol** (Scroll L2 testnet by Week 8, mainnet by Week 16)
   - GKR+SNARK proof verification contract
   - Shadow Atlas Merkle root storage
   - On-chain district membership verification

2. **ReputationRegistry.sol** (Scroll L2 testnet by Week 12, mainnet by Week 16)
   - ERC-8004 reputation tracking
   - Read-only queries for Phase 1
   - Token reward integration ready for Phase 2

**Timeline:** Weeks 5-8 (voter-protocol deliverables must be ready by SYNC POINT B)

### External Services:

**API Keys Required:**

- self.xyz (FREE tier: 1000 verifications/month)
- Didit.me (FREE tier: 500 verifications/month)
- OpenAI Moderation API (FREE tier: 20 req/min)
- Gemini API (for consensus, optional Phase 1)
- Claude API (for consensus, optional Phase 1)
- AWS account (for Nitro Enclaves on Graviton, ~$400/month, FREE tier 750hrs/mo through Dec 2025)

**No-Cost Services:**

- Scroll RPC (free public endpoint)
- Census Bureau Geocoding API (free)
- CWC API (free for congressional delivery)

---

## Risk Assessment

### 🔴 High Risk: GKR+SNARK Implementation Complexity

**Risk:** GKR is interactive protocol (unsuitable for direct blockchain verification), hybrid architecture adds complexity

**Mitigation:**

- Week 5: Evaluate if GKR+SNARK can achieve 8-12s proving (GKR 5-8s + SNARK 2-3s)
- Milestone gates: REJECT if proving >15s OR verification >250k gas
- Contingency: Use Groth16 SNARKs (well-established, requires trusted setup, 50-80k gas, 3-5s proving)
- Decision Point: End of Week 6 - GO/NO-GO on GKR+SNARK hybrid

### 🟡 Medium Risk: AWS Nitro Enclaves Complexity

**Risk:** CBOR attestation + enclave image format may cause delays

**Mitigation:**

- Cloud-agnostic abstraction layer allows fallback to GCP/Azure if AWS blocks
- Fallback: Ship Phase 1 without TEE encryption (accept reduced privacy)
- Decision Point: End of Week 14 - Defer TEE to post-launch if blocked

**Security Uncertainty:** While AWS Nitro avoids Intel ME/AMD PSP, we cannot guarantee absence of NSA backdoors in AWS infrastructure. ARM architecture and independent audits (Aug 2025) reduce but don't eliminate risk.

### 🟢 Low Risk: Congressional Adoption

**Risk:** Offices may not use dashboard

**Mitigation:**

- Week 13: Begin congressional outreach (parallel to dev)
- Pilot program: Free white-glove onboarding for first 5 offices
- User research: Weekly calls with LC staff during development

---

## Immediate Next Steps (This Week)

**Status:** Phase A is ~75% complete. Remaining independent work before voter-protocol dependency:

### Priority 1: Complete Identity Verification (2-3 days)

**What's needed:**

1. **Didit.me SDK Integration** (1-2 days)
   - Install `@didit/sdk` package
   - Implement government ID verification flow
   - Add fallback UI for non-NFC users
   - Wire up webhook verification endpoint

2. **Sybil Resistance Enforcement** (1 day)
   - Identity hash generation (passport number + nationality)
   - Database lookup to prevent duplicate verifications
   - User-facing error messaging
   - E2E tests for both self.xyz and Didit.me flows

**Files to create/modify:**
- `src/routes/api/identity/didit/+server.ts` (new)
- `src/lib/components/auth/DiditVerification.svelte` (new)
- `tests/integration/identity-verification.test.ts` (expand existing)

### Priority 2: Production AWS Nitro Integration (2-3 days)

**What's needed:**

1. **Replace TODO comments in `src/lib/core/tee/providers/aws.ts`** (1-2 days)
   - AWS SDK integration (@aws-sdk/client-ec2, @aws-sdk/client-ecs)
   - EC2 instance launch automation
   - Enclave image (.eif) upload to S3
   - Health check and monitoring setup

2. **Production deployment scripts** (1 day)
   - Terraform or CloudFormation templates
   - Automated enclave deployment
   - Monitoring dashboards

**Files to modify:**
- `src/lib/core/tee/providers/aws.ts` (replace TODOs)
- `scripts/deploy-nitro-enclave.sh` (new)

### ~~Priority 3: Database Schema Cleanup~~ - ✅ COMPLETE

**Already done:** Schema verified to have NO PII storage (audit confirmed). No action needed.

### ~~Priority 3: OpenAI Content Moderation~~ - ✅ COMPLETE

**Already implemented:** Multi-agent consensus system with OpenAI + Gemini + Claude is functional. 447 lines of tests confirm template moderation pipeline is working. No action needed.

### Priority 3: Congressional Dashboard Foundation (Optional - 2-3 weeks)

**Note:** This is the largest remaining independent task. Can start anytime (no voter-protocol dependency).

**What's needed:**

1. **Congressional routes** - `/dashboard/congress/*` route structure
2. **Email authentication** - `.senate.gov` / `.house.gov` verification
3. **Message queue UI** - Inbox with reputation filtering
4. **Analytics views** - Template adoption, geographic clustering
5. **Impact tracking** - Template-to-bill correlation analysis

**Decision:** Wait for user direction on whether to start Congressional Dashboard now or complete Identity Verification + AWS Nitro first.

---

## Budget Estimate

### Phase A (MVP): $0-500

- API keys: FREE tiers sufficient
- Infrastructure: Existing Fly.io deployment
- Total: **$0/month** (can launch for free)

### Phase B (Cryptography): $500-1000/month

- Scroll L2 gas costs: ~$120/month (1000 proof verifications at 80-120k gas)
- Infrastructure: Existing deployment
- Total: **~$500/month**

### Phase C (Full Phase 1): $900-1200/month

- AWS Nitro Enclaves: ~$400/month (c6g.large ARM Graviton, FREE tier 750hrs/mo through Dec 2025)
- Scroll L2 gas: ~$100/month
- Infrastructure: ~$50/month (increased Fly.io resources)
- Total: **~$900/month** (or ~$500/month with FREE tier through Dec 2025)

### One-Time Costs:

- Smart contract audit: $5K-10K (basic security review)
- GCP/TEE consultant: $5K contingency (if needed)
- Total: **$10K-15K one-time**

---

## Success Metrics (Phase 1 Launch)

### Technical Metrics:

- [ ] GKR+SNARK proof generation: <12 seconds on mobile devices (GKR 5-8s + SNARK 2-3s)
- [ ] On-chain verification gas: 80-120k gas
- [ ] CWC submission success rate: >95%
- [ ] Identity verification success rate: >90%
- [ ] Test coverage: >80% on core flows
- [ ] Zero PII stored in database (verified)

### Adoption Metrics:

- [ ] 3+ congressional offices using dashboard
- [ ] 100+ verified users
- [ ] 50+ messages delivered via VOTER Protocol
- [ ] Positive feedback from Legislative Correspondents

### Security Metrics:

- [ ] Smart contracts audited (no critical vulnerabilities)
- [ ] Penetration testing complete (no critical findings)
- [ ] GDPR/CCPA compliance verified
- [ ] Threat model documented in SECURITY.md

---

## Phase 1 → Phase 2 Transition

**Phase 1 Complete When:**

- All technical metrics achieved
- 10+ congressional offices actively using dashboard
- 1000+ verified users
- CLARITY Act regulatory framework confirmed

**Phase 2 Begins:** 12-18 months post-Phase 1 launch

**Phase 2 Adds:**

- VOTER token rewards for civic actions
- Challenge markets (dispute resolution with economic stakes)
- Outcome markets (impact verification)
- Multi-agent treasury management

---

**Next Action:** Start with database schema cleanup and OpenAI moderation integration this week.
