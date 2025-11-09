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

## Open Questions

1. **Should Tier 1 users be able to send Congressional messages?**
   - Current: ❌ No (requires identity verification)
   - Alternative: ✅ Yes, but without reputation tracking
   - Trade-off: Accessibility vs. anti-sybil protection

2. **What's the right rate limit for Tier 1?**
   - Current: 3 templates/day
   - Alternative: 1 template/day (stricter) or 5 templates/day (more permissive)
   - Data needed: User research on template creation patterns

3. **Should we allow Tier 0 (anonymous) template browsing?**
   - Current: ✅ Yes (public good, no sybil risk)
   - Alternative: ❌ Require login even to browse
   - Trade-off: Viral growth vs. user tracking

4. **How do we handle template transfers/ownership?**
   - If a Tier 4 user creates a template, then loses reputation, what happens?
   - Should templates be transferable to other verified users?
   - Should there be a "template marketplace" (Phase 2)?

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
