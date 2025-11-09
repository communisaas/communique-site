# Communiqué: Coordination Platform

**Last Updated**: 2025-01-08
**Status**: Pre-launch, active development
**Single Source of Truth**: This document

---

## The Core Problem

**Individual action fails. Coordination works.**

- One complaint → Gets filed
- 5,000 coordinated messages → Get meetings

Decision-makers ignore scattered noise. They respond to coordinated pressure.

---

## What We Built

### A Coordination Platform

**NOT**:
- ❌ Message delivery service
- ❌ Verification platform
- ❌ Privacy tool
- ❌ Blockchain app

**YES**:
- ✅ **Template creation** - Anyone can start a campaign
- ✅ **Viral sharing** - Share everywhere (Discord, Twitter, QR codes)
- ✅ **Social proof** - Public counters show coordination
- ✅ **Smart routing** - Right decision-maker gets the message
- ✅ **Privacy preservation** - Zero data retention

---

## How It Works

### 1. Template Creator
Someone identifies an issue and writes a template:
- Clear subject line
- Persuasive message body
- Specific ask
- Target decision-makers

### 2. Viral Spread
Template gets shared everywhere:
- Social media (Twitter, Discord, Reddit)
- Group chats (Signal, Telegram, WhatsApp)
- Physical events (QR codes at protests, meetings)
- Email lists

### 3. Coordination Visible
Public counters show coordinated action:
- "5,247 people sent this"
- "Active in 47 states"
- "+127 in the last hour"

### 4. Decision-Makers See It
They can't ignore coordinated pressure:
- 5,000 identical messages = organized constituency
- Geographic spread = proves it's real (not bots)
- Public counters = "This issue has momentum"

---

## The Messaging (Coordination-First)

### Homepage Hero:

```
Your voice. Their decision.

Coordinate campaigns that decision-makers can't ignore.

One complaint gets filed. 5,000 coordinated messages get meetings.
```

**Why it works**:
- Problem/solution clear (1 vs 5,000)
- Outcome-focused ("get meetings")
- No fake numbers (we're pre-launch)
- Coordination = core value prop

---

### Address Collection (When Needed):

```
Find who represents you

Your address routes your message to the right officials.
Used once. Deleted immediately.

[Why your address? →]
Officials only respond to constituents in their jurisdiction.
Your address proves you're affected by their decisions.
```

**Why it works**:
- Explains WHY (routing, not data collection)
- Clear benefit ("find who represents you")
- Privacy promise (used once, deleted)
- Progressive disclosure (deeper why)

---

### Template Card (With Real Data):

**Pre-launch** (no fake numbers):
```
[Template Title]
Created by [Author]
Last updated [Date]

[Send Now] [Share Campaign]
```

**Post-launch** (with real counters):
```
[Template Title]
5,247 people sent this
Active in 47 states
+127 in the last hour

[Send Now] [Share Campaign]
```

---

## The Technical Stack (Simplified)

### What Users See:
1. Browse templates (homepage)
2. Click "Send Now" (button)
3. Enter address if needed (modal)
4. Message sent (mailto: or API)
5. Share campaign (social proof)

### What Happens Behind:
1. **Routing** - Address → Census API → Congressional district → Representatives
2. **Privacy** - Address encrypted → Used once → Deleted
3. **Counters** - Increment send count → Update geographic spread
4. **Attribution** - Template creator gets credit

### What We DON'T Do:
- ❌ Store addresses (deleted after routing)
- ❌ Track individual users (only aggregate counts)
- ❌ Sell data (never)
- ❌ Centralize control (open template creation)

---

## The Routing Logic

### Decision Tree:

```
User clicks "Send Now"
    ↓
What type of decision-maker?
    │
    ├─ Government (Congress, state, local)
    │   → Require address (constituent verification)
    │   → "Find who represents you"
    │
    ├─ School Board / HOA / Local
    │   → Require zip code (lighter touch)
    │   → "Find your school board"
    │
    └─ Company / Public Figure
        → Email verification (OAuth)
        → "Verify your message"
```

---

## The Privacy Model

### What We Collect:

**For Routing** (temporary):
- Address (if government target)
- Encrypted → Routed → Deleted

**For Coordination** (aggregate):
- Send count per template
- Geographic distribution (state-level)
- Momentum (hourly send rate)

**For Attribution**:
- Template creator (public)
- Creation date (public)

### What We DON'T Collect:
- ❌ Who sent which template
- ❌ Individual addresses (deleted after routing)
- ❌ Email credentials (OAuth, never stored)
- ❌ User behavior tracking

---

## The Viral Mechanics

### Social Proof:
- "5,247 people sent this" (FOMO)
- "Active in 47 states" (not astroturf)
- "+127 in the last hour" (momentum)

### Easy Sharing:
- Pre-written messages (4 contexts: Twitter, Slack, Email, SMS)
- QR codes (physical → digital)
- Native share API (mobile)
- Clipboard fallback (desktop)

### Attribution:
- Template creator gets credit
- Public profile shows impact
- Reputation builds over time

---

## Implementation Status

### ✅ Complete:
1. Template browsing & preview
2. Address collection & routing (congressional)
3. Privacy-first UX (progressive disclosure)
4. Universal voice (Congress, companies, school boards)
5. Email provider OAuth component (stub)

### 🚧 In Progress:
1. Real send counters (no fake numbers)
2. Geographic distribution tracking
3. Momentum tracking (+127/hour)
4. Template creator profiles

### 📋 Planned:
1. Smart routing (government vs company vs school)
2. OAuth email verification (Gmail, Outlook, etc.)
3. Multi-country support (UK, Canada, EU)
4. A/B testing infrastructure

---

## The Copy Framework

### Universal Structure:

**Problem** (Individual action fails):
> One complaint gets filed.

**Solution** (Coordination works):
> 5,000 coordinated messages get meetings.

**How** (The platform):
> Coordinate campaigns that decision-makers can't ignore.

**Outcome** (Measurable):
> Get meetings. Change decisions.

---

## What NOT to Say (Cruft to Avoid)

### ❌ Verification Language:
- "Send verified messages" (solves wrong problem)
- "Proof of delivery" (nice to have, not core)
- "Zero-knowledge proofs" (tech flex, users don't care)

### ❌ Privacy-Defensive:
- "but never stored" (defensive tone)
- "We protect your privacy" (everyone says this)
- Over-explaining what we DON'T do

### ❌ Individual Action Framing:
- "Your voice matters" (weak)
- "Make a difference" (vague)
- "Be heard" (passive)

### ❌ Fake Numbers:
- "Join 12,847 people" (WE HAVEN'T LAUNCHED YET)
- "2,134 campaigns" (FAKE)
- Any made-up social proof

---

## What TO Say (Core Truth)

### ✅ Coordination Language:
- "5,247 people sent this" (when true)
- "Active in 47 states" (when true)
- "+127 in the last hour" (when true)
- "Coordinate campaigns that can't be ignored"

### ✅ Routing Logic:
- "Your address routes your message"
- "Find who represents you"
- Clear WHY (constituent verification)

### ✅ Privacy Promise (Brief):
- "Used once. Deleted immediately."
- Progressive disclosure for details

### ✅ Outcome-Focused:
- "Get meetings" (not "be heard")
- "Can't ignore" (not "might listen")
- "Coordinated pressure works" (truth)

---

## Next Steps

### Phase 1: Real Counters (This Week)
1. Remove all fake numbers
2. Implement real send tracking
3. Show counters only when > 0
4. "Be the first to send this" (when = 0)

### Phase 2: Geographic Spread (Next Week)
1. Track state-level distribution
2. Show "Active in X states"
3. Heatmap visualization
4. Prevent astroturf (rate limiting)

### Phase 3: Momentum Tracking (Week 3)
1. Hourly send rate calculation
2. "+127 in the last hour" display
3. FOMO-driven urgency
4. Viral coefficient measurement

### Phase 4: Launch (Week 4)
1. Real campaigns from real users
2. A/B test coordination messaging
3. Measure viral spread (k > 1.0)
4. Decision-maker responses

---

## The Bottom Line

**What we are**:
> Coordination platform for civic pressure campaigns.

**What we're not**:
> Message delivery service with verification features.

**Core insight**:
> Scattered complaints get filed. Coordinated campaigns get meetings.

**Next**:
> Remove fake numbers. Ship real counters. Launch.

---

**Status**: Pre-launch, documentation consolidated, ready for real data.
