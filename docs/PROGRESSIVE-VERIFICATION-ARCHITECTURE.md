# Progressive Verification Architecture

## The Problem: Email Templates & Sybil Attacks

**Current State (Phase 1):**
- Congressional messages: ✅ Verified (self.xyz NFC passport / Didit.me)
- Email templates to decision-makers: ❌ No verification required to CREATE templates
- This creates a **critical sybil attack surface**: malicious actors can flood the platform with fake templates

**The Insight:**
> "We can verify any email template. But how should the writer be considered as a stakeholder in voter-protocol?"

Template creators aren't just writers—they're **protocol participants who need progressive verification** to establish trust and earn reputation.

## Progressive Verification Tiers

### Tier 0: Anonymous (No Verification)
**Capabilities:**
- Browse templates
- View analytics (public metrics only)
- Share template links

**Limitations:**
- ❌ Cannot create templates
- ❌ Cannot send messages
- ❌ No reputation tracking
- ❌ No voting rights

**Anti-Sybil Protection:** None needed (read-only)

---

### Tier 1: Email Verified
**Verification:** Email confirmation link

**Capabilities:**
- Create email templates (rate-limited: 3/day)
- Send email messages (via mailto)
- View own analytics

**Limitations:**
- ❌ Cannot create Congressional templates
- ❌ Cannot earn reputation
- ❌ No voting rights
- ⚠️ Templates marked "unverified author"

**Anti-Sybil Protection:**
- Email verification (weak, but better than nothing)
- Rate limiting on template creation
- Cooldown periods between template publications

**Reputation:** 0 (email verification alone doesn't grant reputation)

---

### Tier 2: Identity Verified (Personhood Proven)
**Verification:** self.xyz NFC passport OR Didit.me identity verification

**Capabilities:**
- Create Congressional templates (verified delivery)
- Create email templates (unlimited, no rate limits)
- Send Congressional messages with ZK proofs
- **Earn reputation** for verified civic actions
- Templates marked "verified author"
- Access to template analytics dashboards

**Limitations:**
- ❌ No governance voting rights (requires reputation threshold)
- ❌ Limited challenge market participation

**Anti-Sybil Protection:**
- Government-issued ID verification (NFC passport via self.xyz)
- Biometric verification (Didit.me liveness check)
- One identity per person (enforced by verification providers)

**Reputation:** Starts at 0, earns +1 per verified Congressional message sent

---

### Tier 3: Reputation Holder (≥10 Verified Actions)
**Verification:** Identity verified + ≥10 verified Congressional messages sent

**Capabilities:**
- Everything in Tier 2
- Governance voting rights (weighted by reputation)
- Challenge market participation (dispute resolution)
- Template endorsements (boost template visibility)
- Advanced analytics (cross-template insights)

**Anti-Sybil Protection:**
- Proof-of-work (10+ verified messages = real participation)
- On-chain reputation (ERC-8004, immutable)
- Economic skin-in-the-game (reputation at stake in challenges)

**Reputation:** 10+ (grows with verified actions)

---

### Tier 4: High-Reputation Stakeholder (≥100 Verified Actions)
**Verification:** Identity verified + ≥100 verified Congressional messages sent

**Capabilities:**
- Everything in Tier 3
- Template moderation powers (flag spam, endorse quality)
- Featured template placement
- Early access to Phase 2 features (token rewards, outcome markets)
- Platform governance proposals
- Weighted voting (reputation-based quadratic voting)

**Anti-Sybil Protection:**
- Massive proof-of-work (100+ messages = serious participant)
- Economic incentives aligned with platform health
- Reputation loss mechanisms (bad actors lose standing)

**Reputation:** 100+ (platform power user)

---

## Template Creation Flow (Tier-Gated)

```typescript
// src/lib/core/auth/verification-gates.ts

export function canCreateTemplate(
  user: User,
  templateType: 'congressional' | 'email'
): { allowed: boolean; reason?: string } {
  // Congressional templates require identity verification (Tier 2+)
  if (templateType === 'congressional') {
    if (!user.identity_verified) {
      return {
        allowed: false,
        reason: 'Congressional templates require identity verification'
      };
    }
    return { allowed: true };
  }

  // Email templates require at least email verification (Tier 1+)
  if (templateType === 'email') {
    if (!user.email_verified) {
      return {
        allowed: false,
        reason: 'Email templates require email verification'
      };
    }

    // Rate limit for Tier 1 (email-only verified)
    if (!user.identity_verified) {
      const recentTemplates = await getRecentTemplates(user.id, '24h');
      if (recentTemplates.length >= 3) {
        return {
          allowed: false,
          reason: 'Daily limit reached. Verify your identity to remove limits.'
        };
      }
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Unknown template type' };
}
```

## Database Schema Updates

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  email_verified        Boolean  @default(false)
  email_verified_at     DateTime?

  // Tier 2: Identity Verification
  identity_verified     Boolean  @default(false)
  identity_verified_at  DateTime?
  verification_method   String?  // 'self.xyz' | 'didit'
  verification_proof    Json?    // ZK proof metadata

  // Reputation (ERC-8004 on-chain)
  reputation_score      Int      @default(0)
  verified_actions      Int      @default(0)

  // Governance
  governance_tier       Int      @default(0) // 0-4 based on verification + reputation
  can_vote              Boolean  @default(false)
  voting_weight         Int      @default(0) // Based on reputation

  templates             Template[]
  messages              Message[]

  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}

model Template {
  id                    String   @id @default(cuid())
  creator_id            String
  creator               User     @relation(fields: [creator_id], references: [id])

  // Template verification status
  creator_tier          Int      // Tier at time of creation (0-4)
  is_verified_author    Boolean  @default(false) // Tier 2+

  // Anti-spam
  rate_limit_bucket     String?  // For Tier 1 rate limiting
  cooldown_until        DateTime? // Template publication cooldown

  // ... rest of template fields
}
```

## UI Changes Required

### Template Creator Gate
```svelte
<!-- src/lib/components/template/TemplateCreator.svelte -->

{#if !user}
  <p>Sign in to create templates</p>
{:else if channelId === 'congressional' && !user.identity_verified}
  <VerificationPrompt
    tier={2}
    message="Congressional templates require identity verification"
    action="Verify with Passport (self.xyz)"
  />
{:else if channelId === 'email' && !user.email_verified}
  <VerificationPrompt
    tier={1}
    message="Email templates require email verification"
    action="Verify Email Address"
  />
{:else if channelId === 'email' && !user.identity_verified && rateLimitHit}
  <VerificationPrompt
    tier={2}
    message="Daily limit reached (3 templates/day)"
    action="Verify Identity to Remove Limits"
  />
{:else}
  <!-- Show template creator -->
{/if}
```

### Template Display Badge
```svelte
<!-- Show verification tier on templates -->
{#if template.is_verified_author}
  <Badge variant="verified">Verified Author</Badge>
{:else}
  <Badge variant="neutral">Unverified Author</Badge>
{/if}
```

## Anti-Sybil Economics

### Why Progressive Verification Works:

1. **Tier 0 → Tier 1 (Email):**
   - Barrier: Email confirmation (free, 30 seconds)
   - Cost to sybil: ~$5-10 per identity (buying emails in bulk)
   - Rate limit: 3 templates/day
   - **Sybil attack becomes expensive at scale**

2. **Tier 1 → Tier 2 (Identity):**
   - Barrier: Government ID + biometric verification (free via self.xyz/Didit)
   - Cost to sybil: **Nearly impossible** (requires real passports)
   - Unlock: Unlimited template creation + reputation earning
   - **Sybil attacks become infeasible**

3. **Tier 2 → Tier 3 (Reputation):**
   - Barrier: 10+ verified Congressional messages sent
   - Cost to sybil: **10+ district verifications + actual Congressional office routing**
   - Time investment: Days/weeks of real civic participation
   - **Economic alignment: bad actors can't fake this**

4. **Tier 3 → Tier 4 (High Reputation):**
   - Barrier: 100+ verified messages
   - Cost to sybil: **Months of sustained civic participation**
   - **Only genuine power users reach this tier**

## Phase 1 Implementation Priority

**URGENT (Pre-Launch):**
- [ ] Add `email_verified` field to User model
- [ ] Implement email verification flow
- [ ] Gate template creation behind email verification (Tier 1)
- [ ] Add rate limiting for Tier 1 users (3 templates/day)
- [ ] Add "Unverified Author" badges to non-identity-verified templates

**Important (Launch Week):**
- [ ] Add `identity_verified` field to User model
- [ ] Integrate self.xyz NFC passport verification
- [ ] Integrate Didit.me identity verification
- [ ] Gate Congressional templates behind identity verification (Tier 2)
- [ ] Add "Verified Author" badges to identity-verified templates

**Nice-to-Have (Post-Launch):**
- [ ] Implement governance_tier calculations
- [ ] Add reputation-based voting (Tier 3)
- [ ] Add template endorsements (Tier 3)
- [ ] Add moderation powers (Tier 4)

## Security Considerations

### Attack Vectors & Mitigations:

**1. Email Sybil Attack (Tier 1):**
- **Attack:** Buy 1000 email addresses, create 3000 templates/day
- **Mitigation:**
  - Rate limiting (3/day per email)
  - Mark templates as "unverified author"
  - Require identity verification for unlimited creation
  - Implement email domain reputation scoring

**2. Template Spam (Tier 1):**
- **Attack:** Create low-quality/spam templates at rate limit
- **Mitigation:**
  - Agent-based content moderation (existing 3-layer consensus)
  - User reporting system
  - Tier 3+ users can flag spam
  - Automatic suspension after 3 flagged templates

**3. Identity Verification Bypass (Tier 2):**
- **Attack:** Fake NFC passport chips or biometric spoofing
- **Mitigation:**
  - Use trusted providers (self.xyz, Didit.me) with proven anti-spoofing
  - NFC chips are cryptographically signed by governments
  - Didit.me uses liveness detection + government ID cross-reference
  - **Nearly impossible to fake at scale**

**4. Reputation Gaming (Tier 3+):**
- **Attack:** Send 100 identical messages to farm reputation
- **Mitigation:**
  - Reputation earned per UNIQUE Congressional office contacted
  - Diminishing returns on duplicate messages
  - Time-gating (max 10 reputation/week)
  - Challenge markets (Phase 2) allow community to dispute fake actions

## Voter-Protocol Stakeholder Model

### Template Creators as Protocol Stakeholders:

**Phase 1 (Reputation-Only):**
- Identity-verified template creators earn reputation per verified message sent
- Reputation grants governance voting rights (Tier 3+)
- High-reputation users (Tier 4) gain moderation powers
- **No token rewards yet**

**Phase 2 (Token Economy):**
- Template creators earn tokens when users send their templates
- Reputation multiplies token rewards (high-rep = higher rewards)
- Template endorsements cost tokens (skin-in-the-game)
- Challenge markets allow disputing fake templates (slashing mechanism)
- Outcome markets reward impactful templates (measured by legislative outcomes)

**Stakeholder Alignment:**
- **Good actors:** Create quality templates → earn reputation → gain governance power → earn tokens (Phase 2)
- **Bad actors:** Spam templates → get flagged → lose reputation → lose governance power → lose tokens (Phase 2)

## The Identity Paradox: Access vs. Anti-Sybil

### The Problem
**Requiring government ID verification excludes legitimate users:**
- Undocumented immigrants (11M+ in US)
- Homeless individuals (580K+ in US)
- People with expired/lost IDs
- Privacy advocates who refuse government tracking
- International users supporting US civic action

**BUT: Not requiring ID creates sybil attack surface:**
- Spam templates flood the platform
- Bad actors manipulate template rankings
- Fake messages dilute genuine civic participation

### Solution: Multiple Paths to Trust

**Path 1: Government ID (Traditional - Tier 2)**
- self.xyz NFC passport or Didit.me verification
- Fastest path to full platform access
- Instant reputation earning

**Path 2: Social Vouching (Alternative - Tier 2 Alt)**
- 3 existing Tier 3+ users vouch for you
- Vouchers stake reputation (lose points if you're a bad actor)
- Unlock same capabilities as ID-verified users
- **Enables access for those without government IDs**

**Path 3: Proof-of-Humanity (Web of Trust - Tier 2 Alt)**
- BrightID social graph verification (meeting-based)
- Gitcoin Passport (aggregate identity score)
- Worldcoin (iris scan - controversial but effective)
- **Doesn't require government ID, just humanness proof**

**Path 4: Time-Locked Participation (Gradual Trust - Tier 1.5)**
- Email-verified users can send 1 Congressional message/week
- No reputation earned initially
- After 10 weeks of sustained participation → auto-upgrade to Tier 2 Alt
- **Proof-of-work over time, accessible to anyone with email**

**Path 5: Community Verification (Local Trust - Tier 2 Alt)**
- In-person verification at community events
- Local organizers (Tier 4) can verify attendees
- Photo + signature (not stored, just attestation)
- **Builds local trust networks, no government ID needed**

### Updated Tier Structure

#### Tier 1: Email Verified
**Access:**
- Create email templates (3/day)
- Send 1 Congressional message/week (time-locked)
- Messages don't earn reputation initially

**Upgrade Paths:**
- → Tier 2 (ID): Verify with self.xyz/Didit.me
- → Tier 2 Alt (Social): Get 3 Tier 3+ vouches
- → Tier 2 Alt (Proof-of-Humanity): BrightID/Gitcoin Passport
- → Tier 1.5 (Time-Lock): Send 10 messages over 10 weeks → auto-upgrade

#### Tier 1.5: Sustained Participation (NEW)
**Requirements:**
- Email verified + 10 Congressional messages over 10+ weeks

**Access:**
- Same as Tier 2, but labeled "Community Verified"
- Earn reputation going forward (retroactive for last 10 messages)
- Unlimited template creation

**Why This Works:**
- Sybil attacks require sustained effort (10 weeks)
- Real users naturally participate over time
- No government ID required

#### Tier 2 Alt: Alternative Verification (NEW)
**Requirements (any one of):**
- 3 Tier 3+ vouches (vouchers stake reputation)
- BrightID verification (in-person social graph)
- Gitcoin Passport score ≥20
- Worldcoin iris scan (controversial, optional)
- Community organizer attestation (Tier 4)

**Access:**
- Identical to Tier 2 (ID verified)
- Badge says "Community Verified" instead of "ID Verified"

**Why This Works:**
- Multiple paths to humanness proof
- No single point of failure (government ID)
- Distributed trust (vouching, social graphs, communities)

### Social Vouching Mechanism

```typescript
// src/lib/core/auth/social-vouching.ts

export async function requestVouch(
  requesterId: string,
  voucherId: string
): Promise<VouchRequest> {
  // Voucher must be Tier 3+ (≥10 reputation)
  const voucher = await getUser(voucherId);
  if (voucher.reputation_score < 10) {
    throw new Error('Voucher must have ≥10 reputation');
  }

  // Requester must be Tier 1
  const requester = await getUser(requesterId);
  if (!requester.email_verified) {
    throw new Error('Must verify email first');
  }

  // Create vouch request
  return await prisma.vouchRequest.create({
    data: {
      requester_id: requesterId,
      voucher_id: voucherId,
      status: 'pending',
      stakes: 3, // Voucher stakes 3 reputation points
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });
}

export async function approveVouch(vouchRequestId: string) {
  const request = await prisma.vouchRequest.findUnique({
    where: { id: vouchRequestId },
    include: { requester: true, voucher: true }
  });

  // Deduct staked reputation from voucher
  await prisma.user.update({
    where: { id: request.voucher_id },
    data: {
      reputation_staked: { increment: request.stakes }
    }
  });

  // Track vouch
  await prisma.vouch.create({
    data: {
      requester_id: request.requester_id,
      voucher_id: request.voucher_id,
      stakes: request.stakes,
      status: 'active'
    }
  });

  // Check if requester now has 3 vouches
  const vouchCount = await prisma.vouch.count({
    where: {
      requester_id: request.requester_id,
      status: 'active'
    }
  });

  if (vouchCount >= 3) {
    // Upgrade to Tier 2 Alt (Community Verified)
    await prisma.user.update({
      where: { id: request.requester_id },
      data: {
        community_verified: true,
        governance_tier: 2
      }
    });
  }
}

// If vouched user turns out to be bad actor
export async function slashVoucher(badActorId: string, voucherId: string) {
  const vouch = await prisma.vouch.findFirst({
    where: {
      requester_id: badActorId,
      voucher_id: voucherId,
      status: 'active'
    }
  });

  if (vouch) {
    // Voucher loses staked reputation permanently
    await prisma.user.update({
      where: { id: voucherId },
      data: {
        reputation_score: { decrement: vouch.stakes },
        reputation_staked: { decrement: vouch.stakes }
      }
    });

    // Mark vouch as slashed
    await prisma.vouch.update({
      where: { id: vouch.id },
      data: { status: 'slashed' }
    });
  }
}
```

### Database Schema Updates

```prisma
model User {
  // ... existing fields ...

  // Alternative verification paths
  community_verified    Boolean  @default(false)
  community_verified_at DateTime?
  verification_path     String?  // 'government_id' | 'social_vouch' | 'proof_of_humanity' | 'time_locked' | 'community_organizer'

  // Social vouching
  vouches_received      Vouch[]  @relation("VouchReceiver")
  vouches_given         Vouch[]  @relation("VouchGiver")
  reputation_staked     Int      @default(0) // Reputation staked in vouching

  // Time-locked progression
  weekly_messages_sent  Int      @default(0)
  weeks_active          Int      @default(0)
  first_message_at      DateTime?

  // Proof-of-humanity scores
  brightid_verified     Boolean  @default(false)
  gitcoin_passport_score Float?
  worldcoin_verified    Boolean  @default(false)
}

model Vouch {
  id            String   @id @default(cuid())
  requester_id  String
  requester     User     @relation("VouchReceiver", fields: [requester_id], references: [id])
  voucher_id    String
  voucher       User     @relation("VouchGiver", fields: [voucher_id], references: [id])
  stakes        Int      // Reputation staked by voucher
  status        String   // 'active' | 'slashed' | 'released'
  created_at    DateTime @default(now())
  expires_at    DateTime?
}

model VouchRequest {
  id            String   @id @default(cuid())
  requester_id  String
  voucher_id    String
  status        String   // 'pending' | 'approved' | 'rejected' | 'expired'
  stakes        Int      // How much voucher will stake
  message       String?  // Personal message to voucher
  created_at    DateTime @default(now())
  expires_at    DateTime
}
```

### UI for Alternative Verification

```svelte
<!-- src/lib/components/auth/VerificationOptions.svelte -->

<div class="space-y-4">
  <h3>Choose Your Verification Path</h3>

  <!-- Path 1: Government ID (Fastest) -->
  <VerificationOption
    title="Verify with Passport"
    description="Instant access. Scan your passport with NFC."
    icon={Shield}
    badge="Fastest"
    onclick={() => verifyWithSelfXyz()}
  />

  <!-- Path 2: Social Vouching (No ID needed) -->
  <VerificationOption
    title="Get 3 Community Vouches"
    description="Have trusted community members vouch for you. No ID required."
    icon={UsersRound}
    badge="No ID Needed"
    onclick={() => showVouchingFlow()}
  />

  <!-- Path 3: Proof-of-Humanity (Alternative) -->
  <VerificationOption
    title="Proof of Humanity Verification"
    description="BrightID, Gitcoin Passport, or Worldcoin. No government ID."
    icon={Network}
    badge="Privacy-Friendly"
    onclick={() => showProofOfHumanityOptions()}
  />

  <!-- Path 4: Time-Locked (Gradual) -->
  <VerificationOption
    title="Build Trust Over Time"
    description="Send 1 message/week for 10 weeks. Auto-verified after sustained participation."
    icon={Clock}
    badge="No Rush"
    onclick={() => showTimeLockInfo()}
  />

  <!-- Path 5: Community Event (In-Person) -->
  <VerificationOption
    title="Verify at Community Event"
    description="Attend a local event with a community organizer."
    icon={MapPin}
    badge="Local"
    onclick={() => findLocalEvents()}
  />
</div>
```

### Anti-Sybil Analysis: Alternative Paths

**Social Vouching:**
- ✅ No ID required
- ✅ Distributed trust (3 independent vouchers)
- ✅ Economic skin-in-the-game (vouchers stake reputation)
- ⚠️ Risk: Sybil networks vouch for each other
- 🛡️ Mitigation: Vouchers must be Tier 3+ (10+ verified messages = proof-of-work)

**Proof-of-Humanity (BrightID):**
- ✅ No ID required
- ✅ Social graph verification (in-person meetings)
- ✅ Decentralized (no central authority)
- ⚠️ Risk: Sybil networks create fake social graphs
- 🛡️ Mitigation: BrightID requires sustained in-person connections

**Time-Locked Participation:**
- ✅ No ID required
- ✅ Proof-of-work over time (10 weeks)
- ✅ Self-correcting (sybils need sustained effort)
- ⚠️ Risk: Patient sybil attackers
- 🛡️ Mitigation: 10 weeks per identity = expensive at scale

**Community Verification:**
- ✅ No ID required
- ✅ Local trust networks
- ✅ In-person verification
- ⚠️ Risk: Corrupt organizers verify sybils
- 🛡️ Mitigation: Organizers must be Tier 4 (100+ reputation = high stakes)

### Recommendation: Hybrid Approach

**Default Path (70% of users):**
- Government ID verification (self.xyz / Didit.me)
- Fastest, most secure, instant access

**Alternative Paths (30% of users):**
- **No ID Available (15%):** Social vouching or community verification
- **Privacy Advocates (10%):** BrightID or Gitcoin Passport
- **Patient Builders (5%):** Time-locked progression (10 weeks)

**Why This Works:**
- Inclusive: Multiple paths ensure access for all
- Secure: Each path has anti-sybil mechanisms
- Aligned: All paths require proof-of-work (time, social, economic)
- Democratic: No single gatekeeping authority

## Open Questions

1. **Should Tier 1 users be able to send Congressional messages?**
   - Current: ✅ Yes, but time-locked (1/week, no reputation until 10 weeks)
   - Trade-off: Accessibility (anyone with email) vs. slow reputation earning

2. **What's the right vouch threshold?**
   - Current: 3 vouches from Tier 3+ users
   - Alternative: 5 vouches (stricter) or 2 vouches from Tier 4 (high-trust)
   - Data needed: How many Tier 3+ users will realistically vouch?

3. **Should we integrate Worldcoin despite privacy concerns?**
   - Pro: Iris scans are nearly impossible to fake
   - Con: Centralized biometric database, privacy nightmare
   - Alternative: Make it optional, alongside BrightID/Gitcoin

4. **How do we handle template transfers/ownership?**
   - If a Tier 4 user creates a template, then loses reputation, what happens?
   - Should templates be transferable to other verified users?
   - Should there be a "template marketplace" (Phase 2)?

5. **Should time-locked users earn retroactive reputation?**
   - Current: ✅ Yes, after 10 weeks they earn +10 reputation for past messages
   - Alternative: ❌ No, reputation only for future messages
   - Trade-off: Incentive alignment vs. preventing gaming

## Next Steps

**Before launch:**
1. Implement email verification (Tier 1 gate)
2. Add rate limiting for unverified users
3. Update UI to show verification prompts
4. Add "verified author" badges to templates
5. Document verification flows for users

**Post-launch (Week 1-2):**
1. Integrate self.xyz + Didit.me (Tier 2 gate)
2. Implement reputation tracking (on-chain ERC-8004)
3. Add governance voting (Tier 3 unlock)
4. Monitor sybil attack attempts and adjust rate limits

**Future (Phase 2):**
1. Token rewards for template creators
2. Challenge markets for dispute resolution
3. Outcome markets for impact verification
4. Template marketplace (buy/sell/transfer templates)
