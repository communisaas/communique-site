# Technical Feasibility Assessment: Revolutionary Pivot

**Date**: 2025-01-08
**Context**: Strategic pivot from civic engagement to class struggle infrastructure
**Question**: Can we build this with our existing tech stack?

---

## Executive Summary

**Answer**: **Yes, with one critical advantage: Our cryptographic infrastructure is already built.**

The revolutionary strategy in `WHAT-ACTUALLY-WORKS.md` requires:
- ✅ **Zero-knowledge proofs** - We have this (Halo2, 2-5s proving in TEE)
- ✅ **Encrypted coordination** - We have this (AWS Nitro Enclaves, XChaCha20-Poly1305)
- ✅ **Anonymous identity** - We have this (ZK proofs of eligibility without revealing identity)
- ✅ **Secure communication** - We have this (TEE-based encryption)
- ⚠️ **Data infrastructure** - Need new databases (landlord/employer data)
- ⚠️ **Organizing primitives** - Need new cryptographic protocols (threshold signatures)

**Key insight**: We built the hardest parts already. The pivot is mostly about:
1. Repurposing existing crypto infrastructure
2. Adding new data sources (public records scraping)
3. Building new UX flows (organizing vs. civic engagement)

---

## What We Already Have (95% Complete Infrastructure)

### 1. Zero-Knowledge Proof System

**Current implementation**:
```typescript
// src/lib/core/tee/provider.ts
export interface TEEProvider {
  generateProof(witnessData: WitnessData): Promise<ProofResult>;
  verifyProof(proof: Proof): Promise<boolean>;
}

// Halo2 proving: 2-5 seconds in AWS Nitro Enclaves
// Proves: "I have valid congressional district" without revealing address
```

**How this enables organizing**:
- **Anonymous union cards**: Prove "I work at Company X" without revealing identity
- **Tenant verification**: Prove "I live in Building Y" without revealing unit number
- **Mutual aid requests**: Prove "I'm a verified community member" without doxing yourself

**Adaptation needed**: Minimal. Change witness data structure.

**Current witness format**:
```typescript
interface CongressionalWitness {
  address: string;           // User's address
  district: string;          // Congressional district
  verificationMethod: string; // How we verified them
}
```

**New witness format for organizing**:
```typescript
interface OrganizingWitness {
  // For tenant organizing
  buildingId?: string;       // Which building (from landlord database)
  isVerifiedTenant?: boolean; // Proved they live there

  // For workplace organizing
  employerId?: string;        // Which employer (from employer database)
  isVerifiedWorker?: boolean; // Proved they work there

  // For mutual aid
  communityId?: string;       // Which neighborhood/community
  reputationScore?: number;   // Participation history (without identity)

  verificationMethod: string; // self.xyz, Didit.me, etc.
}
```

**Work required**: 1-2 days to adapt witness structure and proving logic.

---

### 2. Witness Encryption (XChaCha20-Poly1305)

**Current implementation**:
```typescript
// Encrypt sensitive data before sending to TEE
const encryptedAddress = await encrypt(userAddress, teePublicKey);

// Only TEE can decrypt, generate proof, then destroy plaintext
// Address exists in memory for <5 seconds during proving
```

**How this enables organizing**:
- **Protected organizing data**: Encrypt tenant/worker info before storing
- **Secure coordination**: Messages encrypted end-to-end through TEE
- **Ephemeral processing**: Sensitive data only decrypted during proof generation, never stored

**Adaptation needed**: None. Same encryption primitives work for any sensitive data.

---

### 3. Anonymous Identity Verification

**Current implementation**:
- **self.xyz** (70%): NFC passport scanning, government-issued ID verification
- **Didit.me** (30%): Alternative identity verification
- Both FREE, both privacy-preserving

**How this enables organizing**:
- Prove you're a real person without revealing who you are
- One verification, multiple anonymous organizing identities
- Can't be Sybil attacked (one person = one identity, but identity is pseudonymous)

**Adaptation needed**: None. Already handles anonymous verification.

---

### 4. AWS Nitro Enclaves (TEE Infrastructure)

**Current implementation**:
```
User browser → Encrypted witness → AWS Nitro Enclave
                                    ↓
                            Decrypt in isolated memory
                            Generate Halo2 proof (2-5s)
                            Destroy plaintext
                            Return proof
```

**Why this matters for organizing**:
- **Landlord/employer can't subpoena**: No database of who's organizing
- **Government can't raid**: Plaintext data never persists
- **Hypervisor-isolated**: Even AWS can't access enclave memory
- **ARM Graviton (no Intel ME/AMD PSP)**: No backdoors in CPU

**How this enables organizing**:
- **Anonymous union card signing**: Worker signs in enclave, signature released only at threshold
- **Rent strike voting**: Tenant votes in enclave, only aggregated count revealed
- **Mutual aid matching**: Requests processed in enclave, identities never exposed

**Adaptation needed**: Add new enclave workloads for organizing primitives.

**Work required**: 2-3 weeks to implement threshold signatures and ZK voting in enclave.

---

### 5. Multi-Layer Security (Already Production-Ready)

**Current security layers**:
1. Honeypot fields (catch bots)
2. Timing analysis (detect automation)
3. Mouse tracking (behavioral verification)
4. Cloudflare Turnstile CAPTCHA (90%+ bot blocking)
5. ThumbmarkJS device fingerprinting (278KB bundle, 90% uniqueness)
6. In-memory rate limiting (10 requests/hour per IP, 5 per device)
7. Circuit breaker ($5/day hard limit)

**How this protects organizing**:
- **Anti-spam for tenant databases**: Prevents employer/landlord from flooding fake reports
- **Sybil resistance for mutual aid**: Can't game reputation system with fake accounts
- **DDoS protection**: Organizing platforms are targets, we're already hardened

**Adaptation needed**: None. Security layers are domain-agnostic.

---

## What We Need to Build (New Infrastructure)

### 1. Power Mapping Database (Landlord/Employer Data)

**Data sources** (all public):
- **Property ownership**: County assessor records, property deeds
- **Corporate filings**: Secretary of State business registrations
- **Eviction records**: Court records (public in most jurisdictions)
- **Code violations**: Municipal building department records
- **Labor violations**: OSHA, NLRB, Department of Labor records
- **Tax breaks**: Municipal/state tax incentive databases

**Schema** (already designed in WHAT-ACTUALLY-WORKS.md):
```prisma
model PowerStructure {
  id              String   @id @default(cuid())
  type            String   // "landlord", "employer", "politician"

  // Public info (scraped from records)
  legalName       String
  dbaNames        String[]
  addresses       String[]

  // Ownership (often hidden behind LLCs)
  parentCompanies String[]
  executives      Json

  // Impact data
  rentIncreases   Json
  evictions       Json
  violations      Json
  taxBreaks       Json

  // Crowdsourced organizing data
  tenantReports   Int      @default(0)
  workerReports   Int      @default(0)
  organizing      Json
}
```

**Implementation plan**:

**Week 1-2: Data scraping MVP**
- Start with one city (NYC has best public data)
- Scrape property ownership from NYC ACRIS (property records)
- Build address → ownership lookup
- Manual verification of 100 records

**Week 3-4: Crowdsourced reporting**
- Anonymous tenant reports (via ZK proofs)
- Rate limiting per verified identity (prevent spam)
- Reputation system for data quality

**Week 5-8: Expand to employers**
- OSHA violation scraping
- NLRB case lookup
- Wage theft complaints (crowdsourced)

**Technical challenges**:
- **Data quality**: Public records are messy, need deduplication
- **Entity resolution**: "ABC Holdings LLC" vs "ABC Holdings, LLC" are same entity
- **Ownership chains**: Shell companies hide beneficial owners
- **Update frequency**: Records change, need refresh strategy

**Existing tech we can use**:
- Prisma (already configured)
- Supabase Postgres (already deployed)
- Rate limiting (already implemented)
- Anonymous reporting (ZK proofs already work)

**Work required**: 8-12 weeks for MVP (one city, landlords only)

---

### 2. Threshold Signature Protocol (Anonymous Union Cards)

**Cryptographic primitive needed**: BLS threshold signatures

**How it works**:
1. Worker signs union card anonymously in TEE
2. Signature goes into aggregated pool
3. Only count is visible: "23 of 50 workers have signed"
4. At 50%+1 threshold, all signatures become public simultaneously
5. Can't single out early organizers

**Why BLS signatures**:
- **Aggregation**: Many signatures compress to single signature
- **Threshold support**: Native support for k-of-n signing
- **Pairing-friendly**: Efficient verification

**Implementation in TEE**:
```typescript
// Worker signs in enclave
async function signUnionCard(workerId: string, campaignId: string): Promise<void> {
  // Generate signature in enclave (private key never leaves)
  const signature = await blsSign(workerId, campaignId);

  // Add to aggregated signature
  await aggregateSignature(campaignId, signature);

  // Check if threshold reached
  const count = await getSignatureCount(campaignId);
  const threshold = await getThreshold(campaignId);

  if (count >= threshold) {
    // Reveal all signatures simultaneously
    await revealSignatures(campaignId);
  }
}
```

**Existing libraries**:
- `@noble/bls12-381`: Pure JS implementation
- `blst`: Rust/WASM (faster, can run in enclave)

**Work required**: 3-4 weeks to implement and test threshold signing in TEE

**Security considerations**:
- Signatures must be timestamped (prevent replay attacks)
- Campaign must be immutable once started (prevent threshold manipulation)
- Revocation mechanism needed (worker can withdraw signature before threshold)

---

### 3. Zero-Knowledge Voting (Tenant Associations)

**Cryptographic primitive needed**: zk-SNARKs for vote counting

**How it works**:
1. Tenant proves "I live in this building" (ZK proof)
2. Casts encrypted vote (yes/no on rent strike)
3. Votes aggregated in TEE
4. Only count revealed: "32 of 40 tenants voted yes"
5. Individual votes never revealed

**Implementation**:
```typescript
async function castVote(
  tenantProof: TenantProof,
  vote: boolean,
  proposalId: string
): Promise<void> {
  // Verify tenant is eligible
  const isValid = await verifyTenantProof(tenantProof, proposalId);
  if (!isValid) throw new Error('Invalid tenant proof');

  // Encrypt vote
  const encryptedVote = await encryptVote(vote);

  // Submit to TEE for aggregation
  await aggregateVote(proposalId, encryptedVote);
}

async function tallyVotes(proposalId: string): Promise<VoteResult> {
  // Decrypt and count votes in TEE
  const { yes, no, total } = await decryptAndCount(proposalId);

  return {
    outcome: yes > no ? 'passed' : 'failed',
    yesCount: yes,
    noCount: no,
    totalVotes: total,
    // Individual votes never revealed
  };
}
```

**Reuse of existing infrastructure**:
- Same Halo2 proving system (already 2-5s proving time)
- Same TEE infrastructure (AWS Nitro Enclaves)
- Same verification flow (self.xyz/Didit.me)

**Work required**: 2-3 weeks to adapt existing ZK proof system for voting

---

### 4. Cryptographic Mutual Aid Coordination

**Problem**: How do you coordinate mutual aid without:
- Revealing requester identity (protection from retaliation)
- Enabling fraud (proving request is legitimate)
- Creating centralized database (can be subpoenaed)

**Solution**: Zero-knowledge reputation + anonymous matching

**Implementation**:
```typescript
// Request help anonymously
async function requestAid(amount: number): Promise<string> {
  // Generate ZK proof: "I'm verified community member with reputation X"
  const proof = await generateReputationProof({
    communityId: 'neighborhood-123',
    hasReputation: true,
    // Identity NOT included
  });

  // Submit encrypted request to TEE
  const requestId = await submitRequest({
    amount,
    proof,
    // No identity, only proof of legitimacy
  });

  return requestId;
}

// Fulfill request anonymously
async function fulfillAid(requestId: string, amount: number): Promise<void> {
  // Verify request is legitimate (proof checked in TEE)
  const isValid = await verifyRequest(requestId);
  if (!isValid) throw new Error('Invalid request');

  // Transfer funds through TEE (both parties anonymous)
  await processTransfer({
    requestId,
    amount,
    // TEE coordinates transfer without revealing identities
  });

  // Update reputation for both parties (cryptographically)
  await updateAnonymousReputation(requestId, amount);
}
```

**Reputation without identity**:
- Use ZK proofs: "I've contributed $X over Y months" without revealing transactions
- Cryptographic commitments to contribution history
- Can prove reputation without revealing identity

**Work required**: 4-6 weeks to implement anonymous mutual aid matching

**Reuse of existing infrastructure**:
- TEE coordination (already have AWS Nitro Enclaves)
- ZK proofs (already have Halo2 proving)
- Payment rails (can add later, start with coordination only)

---

### 5. Truth Amplification (Data → Narrative → Viral)

**Goal**: Turn landlord/employer database into shareable infographics

**Implementation**:
```typescript
// User queries landlord database
const landlordData = await getLandlordData(address);

// Generate infographic
const infographic = await generateInfographic({
  template: 'landlord-expose',
  data: {
    landlordName: landlordData.legalName,
    buildingCount: landlordData.properties.length,
    rentIncrease: landlordData.avgRentIncrease,
    taxBreaks: landlordData.totalTaxBreaks,
    violations: landlordData.violations.length
  }
});

// One-click share to social
const shareUrl = await uploadAndShare(infographic);
// Returns: Twitter/Instagram/TikTok share links
```

**Visual generation**:
- Use Canvas API (client-side, no backend needed)
- Pre-designed templates (Figma → Canvas)
- Dynamic data insertion
- Export as image (PNG/JPG for social media)

**Virality mechanism**:
- Each infographic links back to database
- Database shows other buildings by same landlord
- "37 tenants in your building have viewed this"
- Join organizing link embedded

**Work required**: 3-4 weeks to build infographic generator

**Reuse of existing infrastructure**:
- Template system (already have variable resolution)
- Database (Prisma + Postgres already configured)
- Analytics (already tracking engagement)

---

## Technical Complexity Assessment

### Easy (1-2 weeks each):
- ✅ Adapt ZK proof system for organizing use cases
- ✅ Build infographic generator
- ✅ Anonymous reporting with rate limiting

### Medium (3-6 weeks each):
- ⚠️ Threshold signature protocol in TEE
- ⚠️ Zero-knowledge voting system
- ⚠️ Landlord database scraping (one city)

### Hard (8-12 weeks each):
- ⚠️ Cryptographic mutual aid coordination
- ⚠️ Multi-city landlord database
- ⚠️ Employer database with wage theft tracking

### Very Hard (3-6 months):
- ❌ Decentralized coordination (no central server)
- ❌ On-chain organizing primitives (smart contracts)
- ❌ Cross-platform encrypted messaging (Signal integration)

---

## MVP Recommendation: 3-Month Timeline

**Phase 1 (Month 1): Landlord Database MVP**
- Scrape NYC property ownership data (ACRIS)
- Build address → ownership lookup
- Anonymous tenant reporting
- Basic infographic generator

**Goal**: "Find your landlord, see their empire, join your neighbors"

**Success metric**: 100 tenants use database, 5 organizing conversations started

---

**Phase 2 (Month 2): Organizing Tools v1**
- Zero-knowledge tenant verification
- Anonymous tenant association formation
- Encrypted Signal group creation
- ZK voting on demands

**Goal**: "Form tenant association without landlord knowing until you're ready"

**Success metric**: 5 buildings form associations, 2 vote on demands

---

**Phase 3 (Month 3): First Victory**
- Support active organizing campaign
- Media strategy (infographic sharing)
- Legal support coordination
- Victory documentation

**Goal**: One rent strike or significant tenant victory

**Success metric**: Measurable improvement in tenant conditions (rent decrease, repairs, eviction stopped)

---

## Critical Dependencies

### External Services (Free Tier Sufficient):
- ✅ Supabase (already using, 500MB free)
- ✅ AWS Nitro Enclaves (pay per use, <$50/month for MVP)
- ✅ self.xyz / Didit.me (both FREE)
- ✅ Cloudflare Turnstile (FREE)

### New External Services (Needed):
- ⚠️ NYC ACRIS API access (FREE, rate limited)
- ⚠️ Twilio for SMS coordination (optional, ~$20/month)
- ⚠️ Vercel/Netlify for infographic hosting (FREE tier)

### Skills/Knowledge Gaps:
- ⚠️ BLS threshold signatures (learn curve: 2-3 weeks)
- ⚠️ Public records scraping (legal compliance, data quality)
- ⚠️ Organizing strategy (need organizer consultation)

---

## Risk Assessment

### Technical Risks:

**Risk 1: TEE performance doesn't scale**
- **Likelihood**: Low (already proven 2-5s proving times)
- **Impact**: High (core infrastructure)
- **Mitigation**: Benchmark with organizing use cases, optimize hot paths

**Risk 2: Public data is too messy**
- **Likelihood**: High (public records are notoriously inconsistent)
- **Impact**: Medium (affects data quality)
- **Mitigation**: Start with NYC (best data), build deduplication pipeline, crowdsource corrections

**Risk 3: Threshold signatures are too slow**
- **Likelihood**: Medium (depends on implementation)
- **Impact**: Medium (affects UX for union organizing)
- **Mitigation**: Benchmark BLS libraries, consider hybrid approach (aggregate off-chain, verify on-chain)

### Operational Risks:

**Risk 4: Legal challenges from landlords/employers**
- **Likelihood**: High (if successful, we'll be targeted)
- **Impact**: High (could shut down platform)
- **Mitigation**: Public data only, strong terms of service, legal counsel, decentralization plan

**Risk 5: Can't find organizers to partner with**
- **Likelihood**: Medium (organizing is fragmented)
- **Impact**: High (need real campaigns to validate)
- **Mitigation**: Start with existing networks (DSA, tenant unions), offer infrastructure for free

**Risk 6: User adoption is slow**
- **Likelihood**: Medium (new paradigm, requires trust)
- **Impact**: High (need critical mass for organizing)
- **Mitigation**: Partner with established organizing campaigns, prove value with small wins first

---

## Comparison to Original Civic Engagement Approach

### Civic Engagement (Original Plan):
- **User journey**: Browse templates → customize message → send to congress
- **Value prop**: "Make your voice heard"
- **Success metric**: Messages sent, representatives contacted
- **Infrastructure needed**: ✅ All built (95% complete)
- **Time to launch**: 2-3 weeks (just testing + polish)
- **Addressable market**: 3% of population (already engaged citizens)

### Class Struggle Infrastructure (New Plan):
- **User journey**: Find your landlord → join neighbors → organize rent strike
- **Value prop**: "Stop your eviction, lower your rent, win material improvements"
- **Success metric**: Rent decreases, evictions stopped, unions formed
- **Infrastructure needed**: 60% built (crypto done, need databases + organizing tools)
- **Time to launch**: 3 months for MVP, 6 months for first victory
- **Addressable market**: 40% of population (renters, workers facing exploitation)

---

## Recommendation

**We should build the revolutionary version.**

**Why:**

1. **Crypto infrastructure is already built**: We spent months building ZK proofs, TEE coordination, encrypted delivery. This is the HARD part. Repurposing it is comparatively easy.

2. **Bigger addressable market**: 97% of people don't engage with civic tech because the system is broken. 40% of people are renters or workers facing exploitation who WOULD organize if given tools.

3. **Measurable impact**: "Rent decreased 15%" is more compelling than "sent 1000 congressional messages that were ignored."

4. **Competitive moat**: No one else has privacy-preserving organizing infrastructure. Lots of people have civic engagement platforms.

5. **Alignment with our values**: We built cryptographic tools to protect people from surveillance. Organizing is where that protection actually matters.

**But:**

- This is a 3-month MVP, not 2-3 weeks
- We need to partner with real organizers (can't just build in isolation)
- Legal risk is higher (landlords/employers will fight back)
- Success is binary: either we win material victories or we fail

**Decision point**: Are we willing to spend 3 months on revolutionary infrastructure, or do we want quick launch with civic engagement?

---

## Next Steps (If We Choose Revolutionary Path)

### Week 1: Validation
- Interview 20 tenants facing eviction/rent increases
- Interview 10 labor organizers
- Interview 5 mutual aid coordinators
- **Goal**: Validate problem, ensure tools would actually be used

### Week 2-3: Technical Spike
- Implement BLS threshold signatures in TEE
- Benchmark ZK voting performance
- Scrape 1000 NYC property records
- **Goal**: De-risk hardest technical challenges

### Week 4-6: Landlord Database MVP
- Full NYC ACRIS scraping pipeline
- Address → ownership lookup
- Anonymous tenant reporting
- Basic infographic generator
- **Goal**: Ship something useful to 100 tenants

### Week 7-9: Organizing Tools v1
- ZK tenant verification
- Anonymous tenant association formation
- Encrypted Signal integration
- ZK voting on demands
- **Goal**: 5 buildings form tenant associations

### Week 10-12: First Campaign
- Partner with existing organizing effort
- Support with infrastructure
- Media strategy
- Legal coordination
- **Goal**: One measurable victory (rent decrease, eviction stopped, repairs completed)

---

## Conclusion

**The technical infrastructure is 60% built.**

**The hard part (zero-knowledge proofs, TEE coordination, encrypted delivery) is done.**

**What we need to build:**
- Landlord/employer databases (8-12 weeks)
- Threshold signatures for organizing (3-4 weeks)
- ZK voting system (2-3 weeks)
- Mutual aid coordination (4-6 weeks)
- Infographic generator (3-4 weeks)

**Total: 3-6 months for full MVP, 3 months for minimal viable organizing tools.**

**The question isn't "can we build this?" — we can.**

**The question is: "should we?"**

**My analysis**: Yes. Because:
1. We already built the hardest parts
2. Bigger addressable market (40% vs 3%)
3. Measurable material impact
4. No one else has privacy-preserving organizing infrastructure
5. Aligns with our cryptographic values

**But this requires**:
- 3-month timeline (not 3 weeks)
- Partnership with real organizers
- Higher legal/operational risk
- Binary outcome (material victories or failure)

**The choice is yours.**
