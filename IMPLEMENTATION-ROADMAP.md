# Phase 1 Implementation Roadmap

**Updated:** 2025-10-22
**Architecture:** Halo2 zero-knowledge proofs, no database storage of PII
**Timeline:** 6-8 weeks to MVP, 12-16 weeks to full Phase 1

---

## Executive Summary

**What We're Building:**
- **Halo2 zero-knowledge district proofs** (4-6 seconds in browser, no trusted setup)
- **Identity verification** (self.xyz + Didit.me, FREE, Sybil resistance)
- **3-layer content moderation** (OpenAI + Gemini/Claude consensus)
- **Encrypted message delivery** (XChaCha20-Poly1305 → GCP Confidential Space → CWC API)
- **On-chain reputation** (ERC-8004 on Scroll L2, read-only in Phase 1)
- **Congressional dashboard** (free for offices, reputation filtering)

**What's Different from Old Plan:**
- ❌ **NO** hybrid GKR+SNARK (replaced with Halo2 recursive proofs)
- ❌ **NO** NEAR CipherVault encrypted PII storage (addresses never stored anywhere)
- ❌ **NO** database storage of addresses or district hashes
- ✅ **YES** client-side only ZK proof generation (addresses never leave browser)
- ✅ **YES** Halo2 is 2x faster (4-6s vs 8-12s) and 50% cheaper (60-100k gas vs 80-120k)

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
   - **CRITICAL:** Schema needs PII field removal

### ❌ What's Missing (Critical Path):

1. **Halo2 Zero-Knowledge Proofs** - No implementation
   - Browser-based proving not built
   - Smart contracts not deployed
   - Shadow Atlas Merkle tree not implemented

2. **Identity Verification** - Partial implementation
   - Config exists, but no SDK integration
   - No Sybil resistance enforcement
   - self.xyz/Didit.me callbacks not handled

3. **Content Moderation** - Deleted during pruning
   - No OpenAI Moderation API integration
   - Multi-agent consensus code removed
   - Template approval pipeline missing

4. **Encrypted Delivery** - No implementation
   - No XChaCha20-Poly1305 encryption
   - No GCP Confidential Space TEE
   - Messages currently travel in plaintext

5. **Blockchain Integration** - Deleted during pruning
   - No read-only reputation queries
   - voter-protocol client code removed
   - PasskeySetup UI deleted

6. **Congressional Dashboard** - No implementation
   - No congressional-facing routes
   - No reputation filtering
   - No impact tracking

7. **Test Coverage** - Minimal
   - 6 high-value integration tests (good foundation)
   - Zero template creation tests
   - Zero E2E proof generation tests

---

## Implementation Strategy: 3 Phases

### Phase A: Foundation (Weeks 1-4) - MVP Launch Blockers

**Goal:** Minimum viable system without cryptography

**Week 1-2: Content Moderation + Identity Verification**
- [ ] OpenAI Moderation API integration (FREE tier)
- [ ] Template moderation pipeline (auto-reject illegal content)
- [ ] self.xyz SDK integration (NFC passport verification)
- [ ] Didit.me fallback integration (government ID)
- [ ] Sybil resistance (identity hash checking)

**Week 3-4: Database Schema Cleanup + Test Coverage**
- [ ] Remove ALL PII fields from Prisma schema
- [ ] Add verification status fields (district_verified, last_proof_timestamp)
- [ ] Template CRUD integration tests
- [ ] Identity verification E2E tests
- [ ] CWC delivery integration tests

**Deliverables:**
- ✅ Users can verify identity via NFC passport or government ID
- ✅ Templates auto-moderated for illegal content
- ✅ Database stores ZERO PII (only metadata)
- ✅ 80%+ test coverage on core flows

**MVP Without Cryptography:**
Can launch with OAuth + identity verification + content moderation ONLY. No ZK proofs, no encryption, no blockchain. Addresses stored temporarily during session, deleted after submission.

---

### Phase B: Cryptography (Weeks 5-12) - Full Phase 1 Core

**Goal:** Halo2 zero-knowledge proofs + blockchain reputation

**Week 5-8: Halo2 Implementation (voter-protocol repo)**
- [ ] Implement Halo2 Merkle membership circuit (Rust)
- [ ] Shadow Atlas Merkle tree construction (congressional districts)
- [ ] Build WASM wrapper for browser proving
- [ ] Test 4-6 second proving time on commodity hardware
- [ ] Deploy DistrictGate.sol verifier on Scroll L2 testnet

**Week 9-10: Halo2 Browser Integration (communique repo)**
- [ ] Create `src/lib/core/crypto/halo2-prover.ts`
- [ ] Browser-based proof generation (WASM module)
- [ ] UI progress indicator (4-6s proving time)
- [ ] Integration with address collection flow
- [ ] E2E test: proof generation → on-chain verification

**Week 11-12: Blockchain Reputation (Read-Only)**
- [ ] Restore `src/lib/core/blockchain/voter-client.ts`
- [ ] ERC-8004 reputation queries (Scroll L2)
- [ ] Reputation display in user profiles
- [ ] Include reputation metadata in CWC submissions
- [ ] Congressional dashboard sees reputation scores

**Deliverables:**
- ✅ Browser generates Halo2 proofs in 4-6 seconds
- ✅ Addresses NEVER leave browser, NEVER stored anywhere
- ✅ Congressional offices verify proofs on-chain
- ✅ On-chain reputation visible to users + offices

---

### Phase C: Advanced Features (Weeks 13-16) - Full Phase 1 Complete

**Goal:** Encrypted delivery + congressional dashboard

**Week 13-14: Encrypted Delivery (GCP Confidential Space)**
- [ ] XChaCha20-Poly1305 encryption in browser
- [ ] Deploy GCP Confidential Space TEE (AMD SEV-SNP)
- [ ] TEE attestation verification
- [ ] Encrypted CWC submission pipeline
- [ ] Test: plaintext never leaves enclave

**Week 15: Congressional Dashboard**
- [ ] Congressional email authentication (.senate.gov / .house.gov)
- [ ] Message queue with reputation filters
- [ ] Geographic clustering visualization
- [ ] Template adoption metrics
- [ ] Impact tracking (template → bill correlation)

**Week 16: Security Audit + Launch Prep**
- [ ] Smart contract audit (basic security review)
- [ ] Penetration testing on encryption flow
- [ ] Load testing (1000 concurrent users)
- [ ] Congressional pilot program (3-5 offices)
- [ ] GDPR/CCPA compliance verification

**Deliverables:**
- ✅ Messages encrypted end-to-end (browser → TEE → CWC)
- ✅ Congressional dashboard filtering high-reputation constituents
- ✅ Production-ready Phase 1 system
- ✅ Security audit complete, vulnerabilities addressed

---

## Critical Dependencies

### Protocol Layer (voter-protocol repo):

**Required before communique can integrate:**
1. Halo2 circuit implementation (Rust)
2. WASM build of prover
3. DistrictGate.sol verifier deployed on Scroll L2
4. ERC-8004 reputation contract deployed
5. Shadow Atlas Merkle tree published
6. NPM package: `@voter-protocol/crypto`
7. NPM package: `@voter-protocol/client`

**Timeline:** 6-8 weeks (voter-protocol team, parallel to Phase A+B)

### External Services:

**API Keys Required:**
- self.xyz (FREE tier: 1000 verifications/month)
- Didit.me (FREE tier: 500 verifications/month)
- OpenAI Moderation API (FREE tier: 20 req/min)
- Gemini API (for consensus, optional Phase 1)
- Claude API (for consensus, optional Phase 1)
- GCP account (for Confidential Space, ~$350/month)

**No-Cost Services:**
- Scroll RPC (free public endpoint)
- Census Bureau Geocoding API (free)
- CWC API (free for congressional delivery)

---

## Risk Assessment

### 🔴 High Risk: Halo2 SDK Maturity

**Risk:** Halo2 is production-grade (Zcash since 2022), but district proof circuits need custom implementation

**Mitigation:**
- Week 5: Evaluate if Halo2 Merkle circuit can achieve 4-6s proving
- Contingency: Use Groth16 SNARKs (well-established, requires trusted setup)
- Decision Point: End of Week 6 - GO/NO-GO on Halo2

### 🟡 Medium Risk: GCP Confidential Space Complexity

**Risk:** AMD SEV-SNP attestation + TEE deployment may cause delays

**Mitigation:**
- Budget $5K for GCP/TEE consultant if blocked
- Fallback: Ship Phase 1 without TEE encryption (accept reduced privacy)
- Decision Point: End of Week 14 - Defer TEE to post-launch if blocked

### 🟢 Low Risk: Congressional Adoption

**Risk:** Offices may not use dashboard

**Mitigation:**
- Week 13: Begin congressional outreach (parallel to dev)
- Pilot program: Free white-glove onboarding for first 5 offices
- User research: Weekly calls with LC staff during development

---

## Immediate Next Steps (This Week)

### 1. Database Schema Cleanup (1-2 days)

**Remove these fields from Prisma schema:**
```prisma
model User {
  // ❌ REMOVE:
  // near_account_id           String?
  // ciphervault_envelope_id   String?

  // ✅ ADD:
  scroll_address            String?  // Deterministic (passkey-derived)
  district_verified         Boolean  @default(false)
  last_proof_timestamp      DateTime?
  verification_method       String?  // 'self.xyz' or 'didit.me'
}
```

**Test:** Ensure no PII stored after migration

### 2. OpenAI Content Moderation (2-3 days)

**Create:** `src/lib/core/server/content-moderation.ts`
```typescript
import OpenAI from 'openai';

export async function moderateTemplate(template: {
  title: string;
  message_body: string;
}): Promise<{ approved: boolean; flagged_categories: string[] }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.moderations.create({
    input: `${template.title}\n\n${template.message_body}`
  });

  const flagged = Object.entries(response.results[0].categories)
    .filter(([_, flagged]) => flagged)
    .map(([category]) => category);

  return {
    approved: flagged.length === 0,
    flagged_categories: flagged
  };
}
```

**Integrate:** Update `src/routes/api/templates/+server.ts` to call moderation

### 3. self.xyz Identity Verification (3-5 days)

**Install:** `npm install @self.xyz/sdk`

**Update:** `src/routes/api/identity/verify/+server.ts`
```typescript
import { SelfSDK } from '@self.xyz/sdk';

export const POST: RequestHandler = async ({ request }) => {
  const { sessionId, verificationData } = await request.json();

  // Verify passport NFC signature
  const result = await SelfSDK.verify(verificationData);

  if (!result.valid) {
    return json({ success: false, error: 'Invalid passport verification' });
  }

  // Create identity hash (NOT storing passport number)
  const identityHash = sha256(result.passportNumber + result.nationality);

  // Check Sybil resistance
  const existing = await db.user.findFirst({
    where: { verification_data: { path: ['identityHash'], equals: identityHash } }
  });

  if (existing) {
    return json({ success: false, error: 'Identity already verified' });
  }

  // Update user
  await db.user.update({
    where: { id: sessionId },
    data: {
      is_verified: true,
      verification_method: 'self.xyz',
      verification_data: { identityHash, nationality: result.nationality },
      verified_at: new Date()
    }
  });

  return json({ success: true });
};
```

### 4. Test Coverage Expansion (3-5 days)

**Add tests:**
- `tests/integration/template-moderation.test.ts`
- `tests/integration/identity-verification.test.ts`
- `tests/e2e/address-collection-flow.spec.ts`

---

## Budget Estimate

### Phase A (MVP): $0-500
- API keys: FREE tiers sufficient
- Infrastructure: Existing Fly.io deployment
- Total: **$0/month** (can launch for free)

### Phase B (Cryptography): $500-1000/month
- Scroll L2 gas costs: ~$100/month (1000 proof verifications)
- Infrastructure: Existing deployment
- Total: **~$500/month**

### Phase C (Full Phase 1): $850-1200/month
- GCP Confidential Space: ~$350/month (n2d-standard-2 TEE)
- Scroll L2 gas: ~$100/month
- Infrastructure: ~$50/month (increased Fly.io resources)
- Total: **~$850/month**

### One-Time Costs:
- Smart contract audit: $5K-10K (basic security review)
- GCP/TEE consultant: $5K contingency (if needed)
- Total: **$10K-15K one-time**

---

## Success Metrics (Phase 1 Launch)

### Technical Metrics:
- [ ] Halo2 proof generation: <6 seconds on mobile devices
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
