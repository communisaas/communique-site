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

### Solution: Start Simple, Add Paths as Needed

**Phase 1 (Launch - What We're Building NOW):**

**Path 1: Government ID (self.xyz / Didit.me)**
- NFC passport scan (self.xyz) - FREE, 30 seconds
- Government ID + biometric (Didit.me) - FREE, 2 minutes
- Fastest path to full platform access
- Instant reputation earning
- **THIS IS THE MAIN PATH. Build this first.**

**Path 2: Time-Locked Participation (Email Only)**
- Email-verified users can send 1 Congressional message/week
- No reputation earned initially
- After 10 weeks of sustained participation → auto-upgrade to "Community Verified"
- Earn +10 retroactive reputation for past messages
- **Accessible to anyone with email, no ID required**
- **THIS IS THE FALLBACK. Build if time permits.**

---

**Phase 2 (Post-Launch - Only Build If We See Demand):**

**Path 3: Social Vouching (FUTURE)**
- 3 existing Tier 3+ users vouch for you
- Vouchers stake reputation (lose points if you're a bad actor)
- **Don't build until we have enough Tier 3+ users to make this viable**

**Path 4: Community Verification (FUTURE)**
- In-person verification at community events
- Local organizers (Tier 4) verify attendees
- **Don't build until we have established local communities**

---

**What We're NOT Building:**
- ❌ BrightID integration (too niche, maintenance burden)
- ❌ Gitcoin Passport (changing too fast, complex integration)
- ❌ Worldcoin (privacy nightmare, centralized, Sam Altman bullshit)
- ❌ Web of trust systems we'd have to build from scratch

**Why This Approach:**
- **80% of users** will use self.xyz/Didit.me (free, fast, proven)
- **15% of users** can use time-locked email path (no ID needed)
- **5% of users** who need alternatives can wait for Phase 2 social vouching
- **0% of users** need us to integrate every identity provider on the planet

### Updated Tier Structure

#### Tier 1: Email Verified
**Access:**
- Create email templates (3/day)
- Send 1 Congressional message/week (time-locked)
- Messages don't earn reputation initially

**Upgrade Paths:**
- → Tier 2: Verify with self.xyz/Didit.me (MAIN PATH)
- → Tier 1.5: Send 10 messages over 10 weeks → auto-upgrade (FALLBACK)

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

#### Tier 2: Identity Verified
**Requirements:**
- self.xyz NFC passport scan OR
- Didit.me government ID + biometric

**Access:**
- Create Congressional templates (verified delivery)
- Unlimited template creation
- Earn reputation for verified civic actions
- Templates marked "verified author"

**Why This Works:**
- Free verification (self.xyz and Didit.me both free)
- Fast (30 seconds - 2 minutes)
- Proven anti-sybil (government IDs are hard to fake)
- No maintenance burden on our end (they handle fraud detection)

### Social Vouching (FUTURE - Don't Build Yet)

See code examples in git history if needed later. Not building this until we have enough Tier 3+ users to make it viable.

### Database Schema Updates (Phase 1 Only)

```prisma
model User {
  // ... existing fields ...

  // Email verification (Tier 1)
  email_verified        Boolean  @default(false)
  email_verified_at     DateTime?

  // Identity verification (Tier 2)
  identity_verified     Boolean  @default(false)
  identity_verified_at  DateTime?
  verification_method   String?  // 'self.xyz' | 'didit'
  verification_proof    Json?    // ZK proof metadata (for audit trail)

  // Time-locked progression (Tier 1.5)
  weekly_messages_sent  Int      @default(0)
  weeks_active          Int      @default(0)
  first_message_at      DateTime?
  time_lock_verified    Boolean  @default(false)  // Auto-set after 10 weeks
  time_lock_verified_at DateTime?

  // Reputation (ERC-8004 blockchain)
  reputation_score      Int      @default(0)
  verified_actions      Int      @default(0)

  // Governance
  governance_tier       Int      @default(0) // 0-4 based on verification + reputation
  can_vote              Boolean  @default(false)
  voting_weight         Int      @default(0) // Based on reputation
}
```

**What We're NOT Adding (Yet):**
- ❌ Vouch tables (future)
- ❌ BrightID/Gitcoin/Worldcoin fields (not building these integrations)
- ❌ Community organizer verification (future)

### UI for Verification (Phase 1 Only)

```svelte
<!-- src/lib/components/auth/VerificationOptions.svelte -->

<div class="space-y-4">
  <h3>Verify Your Identity</h3>
  <p class="text-sm text-slate-600">
    Choose how you want to verify (both are free and take under 2 minutes)
  </p>

  <!-- Path 1: NFC Passport (self.xyz) - MAIN -->
  <VerificationOption
    title="Scan Your Passport"
    description="Use NFC to scan your passport chip. Takes 30 seconds."
    icon={Shield}
    badge="Recommended"
    onclick={() => verifyWithSelfXyz()}
  />

  <!-- Path 2: Government ID (Didit.me) - ALTERNATIVE -->
  <VerificationOption
    title="Verify with ID"
    description="Upload government ID + take a selfie. Takes 2 minutes."
    icon={IdCard}
    badge="Alternative"
    onclick={() => verifyWithDidit()}
  />

  <!-- Path 3: Time-Locked (Tier 1.5) - FALLBACK -->
  <VerificationOption
    title="No ID? Build Trust Over Time"
    description="Send 1 message/week for 10 weeks. Auto-verified after sustained participation."
    icon={Clock}
    badge="No ID Needed"
    onclick={() => showTimeLockInfo()}
  />
</div>
```

**What We're NOT Building:**
- ❌ Social vouching UI (future)
- ❌ BrightID/Gitcoin/Worldcoin options (not integrating)
- ❌ Community event finder (future)

### Anti-Sybil Analysis (Phase 1 Paths Only)

**Government ID (self.xyz / Didit.me):**
- ✅ Free verification (both providers free)
- ✅ Fast (30 seconds - 2 minutes)
- ✅ Proven anti-sybil (government IDs hard to fake at scale)
- ✅ No maintenance burden (providers handle fraud detection)
- ⚠️ Risk: Excludes users without ID
- 🛡️ Mitigation: Offer time-locked path as fallback

**Time-Locked Participation (10 weeks):**
- ✅ No ID required (email only)
- ✅ Proof-of-work over time
- ✅ Self-correcting (sybils need sustained effort per identity)
- ⚠️ Risk: Patient sybil attackers
- 🛡️ Mitigation: 10 weeks × 1 message/week = expensive at scale

### Actual Launch Plan

**80% of users:** Will verify with self.xyz or Didit.me (free, fast, proven)
**15% of users:** Will use time-locked email path (no ID, 10 weeks patience)
**5% of users:** Will request alternative paths (we'll build social vouching when we see demand)

## Open Questions

1. **Should Tier 1 users be able to send Congressional messages?**
   - Current: ✅ Yes, but time-locked (1/week, no reputation until 10 weeks)
   - Trade-off: Accessibility (anyone with email) vs. slow reputation earning
   - **Decision needed before launch**

2. **Should time-locked users earn retroactive reputation?**
   - Current: ✅ Yes, after 10 weeks they earn +10 reputation for past messages
   - Alternative: ❌ No, reputation only for future messages
   - Trade-off: Incentive alignment vs. preventing gaming
   - **Decision needed before launch**

3. **What's the right rate limit for Tier 1?**
   - Current: 3 email templates/day, 1 Congressional message/week
   - Alternative: More strict (1/day, 1/week) or more permissive (5/day, 2/week)
   - **Can adjust after launch based on data**

4. **How do we handle template transfers/ownership?**
   - If a Tier 4 user creates a template, then loses reputation, what happens?
   - Should templates be transferable to other verified users?
   - **Can defer to Phase 2**

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
