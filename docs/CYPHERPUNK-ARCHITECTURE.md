# Cypherpunk Architecture: The Reality

**Updated:** 2025-11-02
**Status:** Authoritative
**Replaces:** All previous design assumptions

---

## The Actual Problem (McDonald 2018)

Congressional offices don't ignore constituents because they're evil.
They ignore constituents because **they can't identify signal from noise at scale**.

> **"We respond to mail, but we don't communicate with constituents."**
> — Congressional staffer, McDonald 2018

**The research:**
- 66% of digital contact perceived as "campaign mail with minimal policy value"
- Information reaches policy staff "anecdotally upon discretion" (no systematic pathway)
- Databases are "painfully slow, hard to learn, confusing to use"
- Staffers want "small surprising things like bills they may have missed" or "niche issues" with informed expertise
- Instead they get: "50, 60, 70 of the same email minus names and addresses" from "click-happy" constituents

**The problem isn't verification alone.**
Even if you verify all 70 are real humans, it's still 69 repetitive form letters.

**What staffers need:**
1. Proof sender is real constituent (not bot)
2. Signal which messages have informed expertise
3. Systematic pathway to route quality input to policy team

**What we're building:**
Cryptographic verification + reputation scoring + congressional CMS that surfaces quality signals.

**What we're NOT building:**
A way to force representatives to care more than $4.4B in lobbying.

---

## The Honest Scope

### We're Solving (Phase 1):
✅ Systematic pathway problem (McDonald 2018 documented this)
✅ Signal-from-noise filtering (reputation scores + verification)
✅ Tool inadequacy (replace "painfully slow" databases with fast dashboard)
✅ Employment protection (subset who can't participate due to career risk)

### We're NOT Solving:
❌ Lobbying money dominance ($4.4B corporate vs constituent voice)
❌ Representatives who genuinely don't care what constituents think
❌ Structural power imbalances in democracy

### Phase 2 Attempts (12-18 months, untested):
⚠️ Outcome markets (constituents financially compete with lobbying)
⚠️ Challenge markets (bad faith becomes expensive)
⚠️ Token rewards (economic stakes for participation)

**We're removing one bottleneck in a system with many bottlenecks.**

---

## The Two Actual Segments

### Segment 1: The Jaded Majority (75%)

**Who:** Everyone who's tried and given up
**State:** Checked out, apathetic, rationally disengaged
**Why:** "I've emailed before. Got form letter 6 weeks later. Nothing changed. Why bother?"

**Not thinking:** "I need privacy protection"
**Thinking:** "Democracy doesn't respond, why participate?"

**What they need:** Proof that participation creates outcomes THIS time

**Research:** 80% of Americans believe elected officials don't care what they think (Pew 2024)

### Segment 2: The Worried Minority (5%)

**Who:** Teachers, government workers, healthcare professionals
**State:** Want to participate but can't risk employment
**Why:** Federal law doesn't protect private sector political speech discrimination

**Thinking:** "I want to speak up but can't risk my job"

**What they need:** Cryptographic protection so they can participate safely

**Privacy is for this segment. Not the hero message.**

---

## Privacy Architecture (Corrected)

### What's Private:
- **Your address** (verified once, cached as session credential)
- **Your real identity** (employer can't link pseudonymous ID to you)
- **PII linkage** (congressional office can't Google your name)

### What's Public:
- **Message content** (congressional offices READ this, moderators REVIEW this, community SEES themes)
- **Template adoption** ("247 constituents sent variations of this")
- **Community voice** ("TX-07 cares about: healthcare 34%, climate 28%")
- **Verification status** ("Verified constituent in TX-07")

### What's Pseudonymous:
- **Your reputation score** (on-chain, not linked to real identity)
- **Your message history** (traceable to pseudonym, not to you)

### Session-Based Verification Flow

**FIRST TIME (one-time identity verification):**
```
1. User provides address via self.xyz NFC passport or Didit.me
2. Address encrypted, sent to TEE
3. TEE decrypts in isolated memory, geocodes to district
4. TEE generates verification credential: "Verified constituent, TX-07"
5. Address DESTROYED (existed only in memory)
6. Session credential cached on device (expires in X months)
7. User is now verified - no re-verification needed
```

**SUBSEQUENT SENDS (using cached credential):**
```
1. User selects template, adds personal story
2. Message content is PUBLIC (plaintext)
3. User signs message with cached session credential
4. Platform verifies signature (proves valid session)
5. Moderation reviews PUBLIC content
6. Message sent to congressional office with verification proof
7. Office receives: PUBLIC message + proof sender is verified TX-07 constituent
```

**What Congressional Office Sees:**
```
FROM: Verified Constituent (TX-07)
REPUTATION: 8,740 in Healthcare Policy
VERIFICATION: ✓ Self.xyz NFC (verified 2025-10-15, expires 2026-01-01)

MESSAGE:
[Public template content]

Personal story:
"I'm a nurse at Memorial Hospital. I've seen firsthand..."

CONTEXT:
- 247 verified constituents sent variations of this template
- Healthcare costs mentioned in 34% of TX-07 messages this month
```

**What Office DOESN'T See:**
- Name, address, any PII
- Real-world identity linkage

**The Protection:**
- Employer can't Google your name and find your political messages
- Government can't link pseudonymous ID to real identity
- But congressional office CAN read what you're saying
- And moderators CAN review content quality
- And community CAN see aggregate themes

---

## Data Model (Reality-Based)

### Allowed:
```typescript
model User {
  id: String  // Pseudonymous, deterministic from passkey
  verification_status: String
  reputation_score: Int  // On-chain verifiable
  session_credential: String  // Cached verification (expires)
}

model Message {
  content: String  // PUBLIC plaintext
  template_id: String
  verification_proof: String  // ZK proof of district
  // NO user_id linkage (can't trace who sent)
}

model Template {
  verified_sends: Int  // Aggregate count
  districts_reached: Int  // Unique count
  // NO individual send tracking
}
```

### Forbidden:
```typescript
// ❌ NEVER STORE THESE
city, state, zip  // De-anonymization
latitude, longitude  // Geographic tracking
congressional_district  // Plaintext (use hash only)
ip_address, user_agent  // Tracking identifiers
trust_score, civic_score  // Behavioral profiling
```

---

## UI/UX Principles

### Principle 1: Privacy Is Background

**WRONG (leading with crypto):**
```
"Zero-knowledge proof verification!"
"XChaCha20-Poly1305 encryption!"
"Employment-proof political participation!"
```

**RIGHT (leading with responsiveness):**
```
DEMOCRACY DOESN'T RESPOND BECAUSE OFFICES CAN'T VERIFY YOU'RE REAL

66% of emails dismissed as spam (McDonald 2018)
Last time you emailed: form letter, nothing changed

Verified messages prove you're a real constituent.
Offices finally have the quality signal they need.

[Send Verified Message]

(Optional: What if I'm worried about privacy? →)
```

**The crypto is collapsed by default.**
Available for the 5% who need employment protection.
Not the hero message for the 75% who are jaded.

### Principle 2: Show Community Voice

**Template page shows:**
- "247 verified constituents sent this"
- "TX-07 priorities: healthcare 34%, climate 28%"
- "89 congressional districts reached"

**NOT:**
- "Sarah in TX-07 just sent this"
- "You're in top 12% of engaged constituents"
- Individual activity feeds

**Pseudonymous message feed (optional):**
Show what people are saying without revealing who.
Community building without surveillance.

### Principle 3: Moderation Is Pre-Delivery

**3-agent consensus reviews PUBLIC content before delivery:**
- Checks for spam, threats, misinformation
- Offices only receive quality messages
- Moderation time: 2-5 minutes
- Trade-off: Slight delay for quality assurance

---

## Distribution Reality

**Virality happens on social networks, not platform.**

**The flow:**
```
CULTURAL ZEITGEIST
(What's everyone doom-scrolling about TODAY?)
    ↓
AMPLIFIER POSTS ON TWITTER/IG/TIKTOK
("Rep X voting on climate bill TOMORROW")
    ↓
JADED PERSON SEES IN FEED
(Default: "Nothing I do matters")
    ↓
CLICK TO TEMPLATE LANDING PAGE
(communique.xyz/t/climate-bill-2025)
    ↓
VERIFY ONCE (30 seconds, cached credential)
    ↓
SEND MESSAGE (2 minutes, public content)
    ↓
CONGRESSIONAL OFFICE RECEIVES & READS
(Quality signal, proves real constituent)
    ↓
OFFICE RESPONDS (hypothesis to test)
    ↓
USER SHARES OUTCOME
("I sent verified message, got response in 14 days")
    ↓
VIRALITY LOOP
(Proof spreads on social networks)
```

**Platform is where ACTION happens.**
**Twitter/IG/TikTok is where DISCOVERY happens.**

---

## The Honest Messaging

### For The Jaded Majority (Hero Message):
```
Congressional offices have no system for constituent input.

66% of emails dismissed as "campaign mail" (McDonald 2018)
No systematic pathway for your voice to reach policy staff
Staffers want to hear from you - they just can't find you in the noise

We're building the systematic pathway that's missing.

Cryptographic verification proves you're real.
Reputation scoring shows your expertise.
Template adoption reveals community priorities.

Offices get tools to identify quality voices.
What they do with those voices is their choice.

We're removing the excuse that they can't tell signal from noise.
```

### For The Worried Minority (Fine Print):
```
(Optional: What if I'm worried about privacy? →)

Some people can't participate due to employment risk.
Federal law doesn't protect private sector political speech.

Your address is verified once, then cached locally.
Congressional offices verify authenticity without seeing your identity.
Your employer can't link pseudonymous messages to you.

Same cryptography that protects whistleblowers.
```

---

## What We Can't Claim Yet

**FORBIDDEN (no data):**
- ❌ "3x higher response rate"
- ❌ "Offices respond at 150+ verified messages"
- ❌ "14 day average response time"
- ❌ Any case studies or success stories

**ALLOWED (research-backed):**
- ✅ "66% of contact perceived as spam" (McDonald 2018)
- ✅ "80% believe officials don't care" (Pew 2024)
- ✅ "No systematic pathway exists" (McDonald 2018)
- ✅ "Federal law doesn't protect political speech" (legal reality)

**HYPOTHESIS (testing):**
- ⚠️ "We hypothesize verified messages will get better responses"
- ⚠️ "If staffers can verify authenticity, they might prioritize quality"
- ⚠️ "Testing whether this solves the systematic pathway problem"

---

## Implementation Priorities

### Week 1-2: Session Architecture
- Build session-based verification (verify once, cache credential)
- Remove per-message encryption of content
- Implement PUBLIC message storage (plaintext)
- Congressional office dashboard (read public messages + verification proofs)

### Week 3-4: Moderation & Community
- 3-agent pre-delivery content moderation
- Community voice aggregation (themes, adoption metrics)
- Optional pseudonymous message feed

### Week 5-6: Data Model Cleanup
- Remove all forbidden fields (city, state, zip, tracking IDs)
- Implement district hash-based lookup (TEE only)
- Privacy audit (red team de-anonymization attempts)

### Week 7-8: Congressional Office Pilots
- Target 3-5 offices with spam problem
- Demo: Verified vs unverified message quality
- Value prop: "Cut through spam, hear constituent priorities"

---

## Success Metrics (Honest)

### Phase 1 Launch:
- Zero privacy breaches
- First 100 verified constituents
- First 1,000 verified messages sent

### Month 3 (Evidence Gathering):
- Congressional response rate data (verified vs unverified)
- Office feedback on CMS utility
- First documented response correlation

### Month 6 (Can We Claim Efficacy?):
**Decision point:** Do we have data showing this works?
- If YES → Pivot messaging to proven outcomes
- If NO → Honest assessment: didn't solve the problem, pivot

---

## The Narrative

**Not:** "Fix democracy with cryptography"
**Actually:** "Build the systematic pathway that McDonald 2018 showed is missing, then test if offices use it"

**Not:** "Make representatives care about constituents"
**Actually:** "Give offices tools to identify quality constituent voices, remove excuse that they can't"

**Not:** "Everyone needs privacy protection"
**Actually:** "75% are jaded by unresponsiveness, 5% need employment protection, both get cryptographic infrastructure"

**Story:**
> Congressional offices can't hear you. Not because they don't care, but because they can't verify you're real.
>
> 66% of emails dismissed as spam. Staffers desperate for quality signals.
>
> We're building cryptographic verification + congressional CMS.
>
> Offices can finally identify constituent expertise.
> What they do with it is their choice.
>
> But we're removing the excuse that they can't find you in the noise.

---

**End of Document**

*This is the reality-based architecture. All claims must be backed by research or marked as hypothesis. Privacy is background feature, not hero message. We're solving one bottleneck, not all of democracy.*
