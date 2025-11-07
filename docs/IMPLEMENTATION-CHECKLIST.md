# Implementation Checklist: Cypherpunk Architecture

**Status:** Authoritative implementation plan
**Timeline:** 8 weeks to Phase 1 launch
**Updated:** 2025-11-01

---

## Week 1-2: Foundation Cleanup (CRITICAL PATH)

### ✅ Priority 1: Schema Privacy Audit

**Goal:** Remove all de-anonymization vectors from database schema

#### Tasks:

- [ ] **Audit current Prisma schema** (`prisma/schema.prisma`)
  - [ ] Identify all fields that enable de-anonymization
  - [ ] Document why each forbidden field exists
  - [ ] Create migration plan for data removal

- [ ] **Remove location data from User model:**
  ```prisma
  // DELETE these fields:
  city                    String?
  state                   String?
  zip                     String?
  congressional_district  String?
  latitude                Float?
  longitude               Float?
  ```
  - [ ] Create Prisma migration
  - [ ] Run migration in dev environment
  - [ ] Verify existing users not affected (no prod data yet)

- [ ] **Remove surveillance fields from analytics:**
  ```prisma
  // DELETE from analytics_session:
  device_data  Json?  // Contains ip_address, user_agent, fingerprint
  utm_source   String?
  utm_medium   String?
  utm_campaign String?
  referrer     String?

  // DELETE from AuditLog:
  ip_address  String?
  user_agent  String?
  ```
  - [ ] Create migration
  - [ ] Update analytics tracking code to not collect this data
  - [ ] Remove all `device_data` JSON blob generation

- [ ] **Remove behavioral profiling:**
  ```prisma
  // DELETE from User:
  trust_score         Int?
  civic_score         Int?
  discourse_score     Int?

  // DELETE entire user_writing_style table
  ```
  - [ ] Create migration
  - [ ] Remove scoring calculation logic
  - [ ] Delete scoring utilities from `src/lib/utils/`

- [ ] **Implement district hash-based lookup:**
  ```prisma
  // ADD to User:
  district_hash  String?  // Salted hash, computed in TEE only

  // District never stored in plaintext
  // Lookup happens in TEE during message delivery
  ```
  - [ ] Generate salt secret (store in env, never commit)
  - [ ] Implement hashing utility (TEE-only context)
  - [ ] Create migration

- [ ] **Run all migrations:**
  ```bash
  npx prisma migrate dev --name remove-surveillance-fields
  npx prisma generate
  npm run db:push
  ```

- [ ] **Verify schema cleanup:**
  ```bash
  # Ensure no PII storage
  npx prisma studio  # Manually inspect User table

  # Ensure no forbidden fields remain
  rg -i "city|state|zip|latitude|longitude" prisma/schema.prisma
  ```

**Acceptance criteria:**
- ✅ Zero location data stored in User table
- ✅ Zero IP addresses, user agents, device fingerprints
- ✅ Zero behavioral profiling scores
- ✅ District verification uses hash-based lookup only

---

### ✅ Priority 2: Code Cleanup

**Goal:** Remove all code that collects forbidden data

#### Tasks:

- [ ] **Audit verification flow:**
  - [ ] Review `src/lib/components/auth/IdentityVerificationFlow.svelte`
  - [ ] Ensure address only used for district lookup (in TEE)
  - [ ] Remove any address storage attempts
  - [ ] Verify progressive disclosure doesn't leak data

- [ ] **Audit analytics tracking:**
  - [ ] Review `src/lib/core/analytics/`
  - [ ] Remove IP address collection
  - [ ] Remove device fingerprinting
  - [ ] Remove UTM parameter tracking
  - [ ] Keep only: anonymous event counts, template aggregates

- [ ] **Audit API endpoints:**
  ```bash
  # Find all data collection points
  rg -i "ip.*address|user.*agent|fingerprint" src/routes/api --type ts
  ```
  - [ ] Remove IP logging from request handlers
  - [ ] Remove user agent parsing
  - [ ] Remove device detection

- [ ] **Audit server utilities:**
  - [ ] Review `src/lib/core/server/`
  - [ ] Remove behavioral scoring utilities
  - [ ] Remove profiling functions
  - [ ] Keep only: verification, authentication, session management

- [ ] **Update TEE workload:**
  - [ ] Review `tee-workload/src/attestation.js`
  - [ ] Ensure address decryption happens only in TEE memory
  - [ ] Verify address destroyed after district lookup
  - [ ] Implement district hashing before storage
  - [ ] Add memory clearing (Node.js gc hints)

**Acceptance criteria:**
- ✅ Zero code paths that store forbidden data
- ✅ TEE workload properly destroys addresses
- ✅ Analytics only tracks aggregates

---

### ✅ Priority 3: Documentation Audit

**Goal:** Remove all contradictory claims about privacy/gamification

#### Tasks:

- [ ] **Search for privacy contradictions:**
  ```bash
  # Find all privacy claims
  rg -i "address never stored|never store.*address" docs/ src/

  # Verify they're true after schema cleanup
  ```

- [ ] **Remove gamification language:**
  ```bash
  # Find gamification references
  rg -i "leaderboard|achievement|badge|streak|ranking" docs/ src/

  # Delete or replace with collective/verification framing
  ```

- [ ] **Update key docs:**
  - [ ] `README.md` - Rewrite as cypherpunk civic infrastructure
  - [ ] `CLAUDE.md` - Update with new architecture principles
  - [ ] `docs/architecture.md` - Align with CYPHERPUNK-ARCHITECTURE.md
  - [ ] `docs/authentication/oauth-setup.md` - Emphasize privacy
  - [ ] `docs/features/template-creator.md` - Remove ranking language

- [ ] **Update component comments:**
  ```bash
  # Find misleading comments in components
  rg -i "engagement|ranking|leaderboard" src/lib/components --type svelte

  # Rewrite to reflect aggregate-only approach
  ```

- [ ] **Create new docs:**
  - [ ] `docs/PRIVACY-GUARANTEES.md` - Cryptographic privacy explainer
  - [ ] `docs/AMPLIFIER-GUIDE.md` - Guide for public figures
  - [ ] `docs/DATA-MODEL.md` - Document minimal data collection

**Acceptance criteria:**
- ✅ Zero contradictions between claims and implementation
- ✅ All docs reflect cypherpunk principles
- ✅ Privacy guarantees clearly documented

---

## Week 3-4: UI Redesign (Privacy-First)

### ✅ Priority 4: Landing Page Rewrite

**Goal:** Lead with employment protection, not generic engagement

#### Tasks:

- [ ] **Rewrite Hero component** (`src/lib/components/landing/hero/Hero.svelte`):
  ```svelte
  <!-- CURRENT (wrong): -->
  <h1>Make Your Voice <span>Count</span></h1>

  <!-- NEW (right): -->
  <h1>
    Your Voice, <span class="text-participation-accent-600">Protected</span>
  </h1>
  ```

- [ ] **Create three-problem value prop section:**
  - [ ] Problem 1: Employment discrimination risk
    - Cite federal law gap
    - Real example: teacher fired for political post
    - Solution: Cryptographic address protection

  - [ ] Problem 2: Dismissed as spam
    - Cite 66% statistic (McDonald 2018)
    - Explain staffer perspective
    - Solution: Cryptographic verification

  - [ ] Problem 3: Economic powerlessness
    - Cite $4.4B lobbying figure
    - Explain asymmetric influence
    - Solution: Coordinated verified blocs

- [ ] **Remove generic engagement language:**
  - Delete: "Make your voice count", "Send messages", "Get involved"
  - Replace with: "Employment-proof participation", "Cryptographic verification", "Protected advocacy"

- [ ] **Add progressive disclosure:**
  ```svelte
  <details>
    <summary>How this works (cryptographically) →</summary>
    <!-- Zero-knowledge proof explainer -->
  </details>
  ```

**Acceptance criteria:**
- ✅ Employment protection is primary value prop
- ✅ Cryptographic mystique present but not overwhelming
- ✅ Progressive disclosure for curious users

---

### ✅ Priority 5: Verification Flow Redesign

**Goal:** "Stealthily cypherpunk" - simple UX, sophisticated backend

#### Tasks:

- [ ] **Rewrite IdentityVerificationFlow.svelte:**
  - [ ] Remove technical jargon from primary flow
  - [ ] Add "How this stays private" progressive disclosure
  - [ ] Emphasize speed (30 seconds) over complexity

- [ ] **Update VerificationValueProp.svelte:**
  ```svelte
  <!-- CURRENT (wrong): Congressional office benefits -->
  stats = [
    { value: '3x', label: 'Higher Response Rate' },
    { value: '87%', label: 'Offices Prioritize' }
  ]

  <!-- NEW (right): User protection + efficacy -->
  stats = [
    { value: 'Protected', label: 'Employment Safe' },
    { value: '3.2x', label: 'Higher Response Rate' },
    { value: 'Verified', label: 'Cryptographically' }
  ]
  ```

- [ ] **Create post-verification confirmation:**
  ```svelte
  <div class="bg-slate-900 text-white rounded-xl p-6">
    <h3>You're Now a Verified Constituent</h3>
    <p>Congressional offices will authenticate your messages</p>

    <details>
      <summary>How this works (cryptographically) →</summary>
      <!-- XChaCha20-Poly1305, TEE, ZK proof explainer -->
    </details>
  </div>
  ```

**Acceptance criteria:**
- ✅ Verification feels simple (not technical)
- ✅ Cryptographic sophistication discoverable for curious users
- ✅ Status comes from verified group membership, not badges

---

### ✅ Priority 6: Template & Submission Redesign

**Goal:** Aggregate social proof, zero individual tracking

#### Tasks:

- [ ] **Update TemplatePreview.svelte:**
  - [ ] Remove any individual user references
  - [ ] Show only aggregate stats:
    - Total verified sends
    - Districts reached
    - Response rate (if available)
  - [ ] Add momentum indicator (if >1.5x normal pace)
  - [ ] Privacy disclosure: "All statistics anonymized"

- [ ] **Rewrite SubmissionStatus.svelte:**
  ```svelte
  <!-- Delivery confirmation -->
  <div class="bg-green-50 border border-green-200">
    <CheckCircle class="text-green-600" />
    <h4>Message Delivered</h4>
    <p>Congressional office verified: Real constituent in their district</p>
  </div>

  <!-- Cryptographic transparency (progressive disclosure) -->
  <details>
    <summary>What just happened (cryptographically) →</summary>
    <ol>
      <li>Your address encrypted in browser (XChaCha20-Poly1305)</li>
      <li>Zero-knowledge proof generated in isolated TEE</li>
      <li>Address existed only in memory, then destroyed</li>
      <li>Congressional office received authenticated message with no PII</li>
    </ol>
  </details>

  <!-- Collective framing -->
  <div class="bg-blue-50 border border-blue-200">
    <h5>Collective Impact</h5>
    <p>You're one of 247 verified constituents on this issue.</p>
    <p>Offices prioritize issues with 150+ verified messages.</p>
  </div>
  ```

- [ ] **Create MomentumIndicator.svelte** (NEW):
  - [ ] Show aggregate activity (no individuals)
  - [ ] Velocity: "2.3x normal pace today"
  - [ ] Geographic coverage: "89 districts reached"
  - [ ] Tipping point: "Just 47 more to critical mass" (if applicable)

**Acceptance criteria:**
- ✅ Zero individual user activity displayed
- ✅ Collective power visualized through aggregates
- ✅ Cryptographic transparency available for curious users

---

### ✅ Priority 7: Remove Forbidden Components

**Goal:** Delete all gamification/surveillance UI

#### Tasks:

- [ ] **Delete or disable leaderboard components:**
  ```bash
  # Find leaderboard code
  rg -i "leaderboard" src/lib/components --type svelte

  # Delete files or comment out usage
  ```

- [ ] **Delete achievement/badge components:**
  ```bash
  # Find achievement code
  rg -i "achievement|badge|trophy" src/lib/components --type svelte

  # Delete badge displays, milestone celebrations (except verification complete)
  ```

- [ ] **Delete streak tracking:**
  ```bash
  # Find streak code
  rg -i "streak|daily.*active|consecutive" src/lib/components --type svelte

  # Remove streak counters, reminder notifications
  ```

- [ ] **Delete individual activity feeds:**
  ```bash
  # Find activity feed code
  rg -i "activity.*feed|recent.*activity|live.*feed" src/lib/components --type svelte

  # Remove "Sarah in TX-07 just sent this" type displays
  ```

- [ ] **Delete comparative rankings:**
  ```bash
  # Find ranking code
  rg -i "percentile|ranking|top.*percent|leaderboard" src/lib/components --type svelte

  # Remove "You're in top 12%" displays
  ```

**Acceptance criteria:**
- ✅ Zero gamification components remain
- ✅ Zero individual activity tracking UI
- ✅ Zero competitive ranking displays

---

## Week 5-6: Amplifier Infrastructure

### ✅ Priority 8: Opt-In Sharing System

**Goal:** Amplifiers can choose to share, platform never reveals

#### Tasks:

- [ ] **Create AmplifierOptIn.svelte** (NEW):
  ```svelte
  <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
    <h5>Want to tell your followers?</h5>
    <p>You can share that you sent a verified message (completely optional).</p>

    <button on:click={shareToTwitter}>
      Share: "I just sent a cryptographically verified message using @Communique_xyz"
    </button>

    <p class="text-xs">Platform never reveals your participation. You control all disclosure.</p>
  </div>
  ```

- [ ] **Implement sharing templates:**
  - [ ] Twitter/X: Pre-formatted thread
  - [ ] Blog post: Markdown template with experience narrative
  - [ ] Generic: Shareable link with UTM (privacy-preserving)

- [ ] **Create amplifier detection:**
  ```typescript
  // Detect if user likely to be amplifier (opt-in only)
  function detectAmplifierIntent(user: User): boolean {
    // Check if user has connected social accounts (OAuth)
    // Check if user opted into "public sharing"
    // Never assume - always ask permission
  }
  ```

- [ ] **Build referral tracking (privacy-preserving):**
  ```typescript
  // Track referrals without revealing referrer identity
  model ReferralEvent {
    referral_code: String  // Anonymous code, not linked to user
    referred_users: Int    // Count only
    created_at: DateTime

    // NO: referrer_id (can't link to user)
    // Amplifiers get anonymous code to share
  }
  ```

**Acceptance criteria:**
- ✅ Sharing is opt-in only
- ✅ Platform never reveals without user consent
- ✅ Pre-formatted sharing templates available
- ✅ Referral tracking doesn't de-anonymize

---

### ✅ Priority 9: Amplifier Content Kit

**Goal:** Make it easy for amplifiers to explain + promote

#### Tasks:

- [ ] **Create docs/AMPLIFIER-GUIDE.md:**
  - [ ] Who amplifiers are (activists, journalists, influencers)
  - [ ] Why this tool is different (cryptographic privacy + efficacy)
  - [ ] How to explain to audiences
  - [ ] Pre-written content templates

- [ ] **Blog post template:**
  - [ ] Personal narrative structure
  - [ ] Key stats to include
  - [ ] Technical explainer (optional depth)
  - [ ] Call to action

- [ ] **Twitter/X thread template:**
  - [ ] 8-10 tweet structure
  - [ ] Shocking stats (66% dismissed, employment risk)
  - [ ] Technical mystique (zero-knowledge proofs)
  - [ ] Personal experience hook

- [ ] **Podcast talking points:**
  - [ ] Opening hook (employment discrimination stat)
  - [ ] Problem explanation (surveillance + spam)
  - [ ] Solution (cryptographic verification)
  - [ ] Personal narrative (I used it, got response)
  - [ ] Technical deep dive (for technical podcasts)

- [ ] **Shareable assets:**
  - [ ] Infographic: "How Verified Messages Work"
  - [ ] Diagram: Cryptographic flow
  - [ ] Stats sheet: Response rates, efficacy data
  - [ ] FAQ: Common questions

**Acceptance criteria:**
- ✅ Complete amplifier guide in docs
- ✅ Pre-written content templates
- ✅ Shareable assets for social media
- ✅ Easy for non-technical amplifiers to explain

---

### ✅ Priority 10: Amplifier Recognition (Opt-In)

**Goal:** Recognize amplifiers who choose visibility

#### Tasks:

- [ ] **Create public amplifier registry (opt-in):**
  ```typescript
  model PublicAmplifier {
    id: String
    display_name: String  // User chooses
    social_links: Json    // Twitter, blog, etc.
    referrals: Int        // Count of referred users
    content_pieces: Int   // Count of published content
    opted_in_at: DateTime

    // NO: link to User table (privacy firewall)
    // Separate opt-in identity
  }
  ```

- [ ] **Build /amplifiers public page:**
  - [ ] List of amplifiers who opted in
  - [ ] Their content pieces
  - [ ] Referral counts (anonymous)
  - [ ] "Become an amplifier" CTA

- [ ] **Early access for amplifiers:**
  - [ ] New features previewed to amplifiers first
  - [ ] Direct feedback channel
  - [ ] Feature requests prioritized

**Acceptance criteria:**
- ✅ Recognition only for those who opt in
- ✅ No linking public identity to private user account
- ✅ Amplifiers get early access, direct line to development

---

## Week 7-8: Testing & Launch Prep

### ✅ Priority 11: Privacy Audit (Red Team)

**Goal:** Prove users cannot be de-anonymized

#### Tasks:

- [ ] **Database de-anonymization test:**
  - [ ] Create test users with realistic data
  - [ ] Attempt to reconstruct addresses from database
  - [ ] Verify: Impossible without TEE decryption

- [ ] **Network traffic analysis:**
  - [ ] Monitor all API calls during verification
  - [ ] Verify: No plaintext address transmission
  - [ ] Confirm: Encrypted payload only

- [ ] **TEE memory inspection:**
  - [ ] Verify address decryption only in TEE
  - [ ] Confirm address destroyed after use
  - [ ] Check: No logging, no persistence

- [ ] **Congressional office data:**
  - [ ] Verify offices receive verification proof
  - [ ] Confirm offices never receive PII
  - [ ] Test: District verification without address

**Acceptance criteria:**
- ✅ Zero paths to de-anonymization
- ✅ TEE properly isolates address decryption
- ✅ Congressional offices verify without seeing PII

---

### ✅ Priority 12: User Testing (Cypherpunk Community)

**Goal:** Validate UX with privacy-conscious users

#### Tasks:

- [ ] **Recruit 10-20 testers:**
  - [ ] Privacy advocates
  - [ ] Infosec professionals
  - [ ] Cypherpunk community members

- [ ] **Test scenarios:**
  - [ ] First-time verification flow
  - [ ] Template customization + sending
  - [ ] Understanding cryptographic protection
  - [ ] Progressive disclosure usage

- [ ] **Gather feedback:**
  - [ ] Is complexity invisible?
  - [ ] Is mystique compelling?
  - [ ] Do they trust privacy guarantees?
  - [ ] Would they actually use this?

- [ ] **Iterate based on feedback:**
  - [ ] Simplify confusing flows
  - [ ] Add missing privacy explanations
  - [ ] Improve progressive disclosure

**Acceptance criteria:**
- ✅ Cypherpunk community validates privacy model
- ✅ UX feels simple to non-technical users
- ✅ Technical users can verify cryptographic claims

---

### ✅ Priority 13: Launch Preparation

**Goal:** Seed content, recruit amplifiers, prepare narrative

#### Tasks:

- [ ] **Seed initial templates:**
  - [ ] 10-20 high-quality templates on current issues
  - [ ] Moderated for quality (3-agent consensus)
  - [ ] Cover range of political positions (non-partisan)

- [ ] **Recruit 5-10 initial amplifiers:**
  - [ ] Privacy advocates with audiences
  - [ ] Civic tech journalists
  - [ ] Political activists (various positions)
  - [ ] Academic researchers

- [ ] **Prepare launch narrative:**
  - [ ] Press release: "Cryptographic Civic Infrastructure"
  - [ ] Launch blog post: "Employment-Proof Political Participation"
  - [ ] Technical explainer: "How Zero-Knowledge Proofs Protect Constituents"
  - [ ] FAQ: Common questions about privacy + efficacy

- [ ] **Set up monitoring:**
  - [ ] Privacy breach alerts (should never trigger)
  - [ ] Congressional response tracking
  - [ ] Aggregate adoption metrics (no individual tracking)

**Acceptance criteria:**
- ✅ 10-20 quality templates ready
- ✅ 5-10 amplifiers committed to launch content
- ✅ Launch narrative prepared
- ✅ Monitoring in place

---

## Post-Launch: Continuous Validation

### Ongoing Privacy Monitoring

- [ ] **Weekly privacy audits:**
  - [ ] Database schema unchanged (no new PII fields)
  - [ ] TEE logs empty (no address persistence)
  - [ ] Zero de-anonymization attempts successful

- [ ] **Monthly red team exercises:**
  - [ ] Attempt to reconstruct user identities
  - [ ] Test new attack vectors
  - [ ] Verify cryptographic guarantees hold

### Ongoing Efficacy Tracking

- [ ] **Congressional response monitoring:**
  - [ ] Track response rates (verified vs unverified)
  - [ ] Document policy outcomes
  - [ ] Correlate verified message waves with votes

- [ ] **Amplifier content tracking:**
  - [ ] Blog posts, articles, podcast appearances
  - [ ] Referral conversion rates
  - [ ] Narrative spread in media

### Phase 2 Preparation (Month 12-18)

- [ ] **Token economics design:**
  - [ ] Reputation → governance rights
  - [ ] Challenge market mechanics
  - [ ] Outcome market structure
  - [ ] Multi-agent treasury management

- [ ] **Smart contract development:**
  - [ ] ERC-8004 reputation token
  - [ ] Challenge resolution contracts
  - [ ] Outcome verification contracts
  - [ ] Treasury management contracts

---

## Dependencies & Blockers

### External Dependencies

- [ ] **VOTER Protocol ZK implementation:**
  - Halo2 proving infrastructure
  - Witness encryption libraries
  - TEE integration
  - **Status:** In development by voter-protocol team

- [ ] **Congressional office verification:**
  - CWC API integration
  - Delivery confirmation webhooks
  - Response tracking
  - **Status:** Needs partnership discussions

### Internal Blockers

- [ ] **Schema migration risks:**
  - Production data (if any) must be handled
  - Rollback plan for failed migrations
  - **Mitigation:** Thorough testing in dev/staging

- [ ] **TEE infrastructure costs:**
  - AWS Nitro Enclave pricing
  - Proving time optimization (target: 2-5s)
  - **Mitigation:** Optimize proving, explore alternatives

---

## Success Criteria Summary

### Week 1-2: Foundation
- ✅ Schema cleaned of all PII
- ✅ Code removes all surveillance
- ✅ Docs updated for consistency

### Week 3-4: UI Redesign
- ✅ Landing page leads with employment protection
- ✅ Verification flow is "stealthily cypherpunk"
- ✅ Templates show aggregates only

### Week 5-6: Amplifiers
- ✅ Opt-in sharing system built
- ✅ Content kit created
- ✅ Recognition system (opt-in only)

### Week 7-8: Launch
- ✅ Privacy audit passed (zero de-anonymization paths)
- ✅ Cypherpunk community validates
- ✅ 5-10 amplifiers recruited

### Phase 1 Success (Month 6)
- ✅ Zero privacy breaches
- ✅ 3.2x response rate verified
- ✅ First documented policy outcome
- ✅ 5,000+ verified constituents

---

**End of Implementation Checklist**

*This checklist is the authoritative task breakdown for CYPHERPUNK-ARCHITECTURE.md implementation. All work should reference these tasks. Update completion status as work progresses.*
