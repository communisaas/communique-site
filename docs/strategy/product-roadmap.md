# Product Roadmap

> commons.email — what we build, in what order, and why
> Last updated: 2026-03-07

---

## Roles

**Person** — sends verified letters to decision-makers, participates in debates. Optionally verifies identity via mDL for ZK proofs. Builds portable reputation through engagement tiers: New (0), Active (1), Established (2), Veteran (3), Pillar (4).

**Organization** — creates campaigns, sends mass email, manages supporters, views analytics with verification and coordination integrity signals.

**Decision-Maker** — receives messages with verification packets. Sees constituent count, engagement tier distribution, coordination integrity scores, debate market signals.

---

## Design Thesis

Every feature is verification-intrinsic. Not "commodity features plus ZK extras" but features where verification is woven into the surface. The product should be indistinguishable from existing advocacy tools for someone who has never heard of zero-knowledge proofs — while delivering guarantees that existing tools architecturally cannot.

We are pragmatically cypherpunk: privacy and verification are structural, not features. The platform cannot be subpoenaed for data it doesn't possess. Actions carry proofs, not promises. Reputation is earned on-chain, not assigned by an admin. These are engineering decisions, not marketing positions.

---

## What's Built (Reality Check)

Infrastructure that took years. Zero of this exists in any competitor's stack.

### Foundation Layer (voter-protocol)

| System | Status | Scale |
|---|---|---|
| ZK proof generation (browser-side, noir_js + bb.js) | Production | 5 circuits, 4 depths |
| mDL verification (ISO 18013-5) | Production | 8,665 lines, 37 tests |
| Shadow Atlas (hierarchical district tree) | Production | 94,166 districts, 24 boundary types, R-tree <50ms p95 |
| Smart contracts | Production | 13 contracts, 897 tests |
| DebateMarket (LMSR + AI panel) | Production | 193 tests |
| Noir prover (browser WASM) | Production | Client-side, zero server cost |
| Engagement tiers (on-chain) | Production | 0–4, non-purchasable, portable |
| Coordination integrity | Specified | GDS, ALD, temporal entropy, burst velocity |

### Person Layer (commons.email)

| System | Status | Lines |
|---|---|---|
| Postal Bubble (postal code → district resolution) | Production | ~700 |
| Power Landscape (decision-maker targeting + composition) | Production | 1,572 |
| AI agents (DM discovery, message writer, subject line, sources) | Production | 8,188 |
| Identity verification (mDL, passkey, address, district credentials) | Production | 8,665 |
| Debate participation (propose, argue, stake, resolve) | Production | Full lifecycle |
| Congressional submission (CWC + encrypted witness) | Production | 305 |
| Template system (create, share, browse) | Production | Full CRUD |
| Spatial Browse (3 views) | Production | Production |
| Chain abstraction (3 wallet paths) | Production | Production |
| OAuth + passkey auth | Production | Production |

### Org Layer (commons.email — built but not yet launched)

| System | Status | Lines |
|---|---|---|
| Org management (create, RBAC: owner/editor/member) | Production | 80 |
| Supporter management (list, search, filter, detail, edit) | Production | 1,190 |
| CSV import (field mapping, dedup, tag assignment) | Production | 776 |
| Action Network import (full OSDI sync, incremental) | Production | 920 |
| Campaign management (create, edit, status lifecycle) | Production | 525 |
| Email compose (WYSIWYG, merge fields, recipient preview, send) | Production | 556 |
| Email engine (SES, batching, rate limiting, filtering) | Production | 676 |
| Campaign verification packets (GDS, ALD, entropy, tiers) | Production | 734 |
| Campaign report rendering (HTML, merge fields, delivery tracking) | Production | 453 |
| Email deliverability verification (Reacher pipeline) | Production | 211 |
| Data models (50+ Prisma models, all indexed) | Production | 1,626 |

**Total org-layer code already written: ~7,747 lines.**

This is not a spec. The core org loop works: create org → import supporters → create campaign → compose email → send → verification packet assembles → report renders → deliver to decision-maker.

### What's Missing for Launch

| Gap | Severity | Effort |
|---|---|---|
| Billing UI (Stripe subscriptions + usage metering) | Blocking | Medium — schema exists, needs UI + webhook handlers |
| Org onboarding flow (guided first-run experience) | Important | Small — routing + empty states |
| Org dashboard (verification progress, aggregate metrics) | Important | Small-Medium — data exists, needs dashboard component |
| ~~Embeddable campaign widgets~~ | ~~Important~~ | ✅ Shipped — iframe + postMessage API |
| A/B email testing | Nice-to-have | Medium — variant allocation, winner selection |
| Advanced segmentation UI | Nice-to-have | Small — filter builder on existing query infrastructure |

---

## Launch Sequence

### Phase 0: Ship the Verification Loop (NOW — 4–6 weeks)

The verification loop is the product. Not email. Not CRM. Not petitions. The loop:

```
Org creates campaign → supporters take verified action → verification packet assembles →
org sends report to decision-maker → decision-maker sees proof, not volume
```

This loop already works in code. Phase 0 makes it launchable.

**Build:**

| Task | Why | Effort |
|---|---|---|
| Org onboarding flow | First-run: create org → name, slug, invite team | 1 week |
| Org dashboard | Verification progress: imported/postal-resolved/verified, tier distribution, campaign list with live packet status | 1–2 weeks |
| Billing (Stripe) | Subscription creation, plan selection, usage metering (verified actions + emails), webhook handlers for lifecycle events | 2 weeks |
| Public campaign page | Supporter-facing action surface: enter postal code → Postal Bubble → optional mDL → take action. Verified count display. | 1–2 weeks |

**Don't build yet:**
- A/B testing (ship single-variant email first)
- ~~Embeddable widgets~~ (shipped — `/embed/campaign/[slug]`)
- Advanced analytics (verification packet IS the analytics)
- SMS, automation, events, fundraising (all Phase 2+)

**Launch to:**
- 5–10 orgs in beachhead segments, by invitation
- Science/health advocacy (credibility over volume)
- Local government advocacy (school boards, water districts — 21 of 24 Shadow Atlas boundary types have zero competitor coverage)
- Nonpartisan groups excluded from AN

**Success metric:** One org sends a campaign report to a decision-maker's office. The office responds differently than they respond to unverified advocacy mail. That's the proof point.

---

### Phase 1: Compete on Verification, Not Features (Months 2–4)

Phase 0 proved the loop works. Phase 1 makes it self-serve and starts building the org base.

**Build:**

| Task | Why | Effort |
|---|---|---|
| Embeddable campaign widgets | Orgs embed action pages on their websites. iframe + postMessage. Postal Bubble → verified action in browser. This is AN's highest lock-in vector — we need the equivalent. | 2–3 weeks |
| Public API (RESTful, free, no rate cap) | Every competitor gates or caps their API. Free API on all tiers is a structural differentiator. | 2 weeks |
| AN migration promotion | The importer is built. Package it: landing page, guided walkthrough, parallel operation support. Target AN orgs frustrated with progressive-only restriction or deliverability issues. | 1 week |
| Email A/B testing | Two-variant split, winner selection, segment-aware. Table stakes for email. | 1–2 weeks |
| Supporter segmentation UI | Filter builder: tag + verification status + tier + district + source. The underlying query infrastructure exists — needs a UI surface. | 1 week |
| Campaign analytics dashboard | Opens, clicks, bounces + verified action count + tier distribution over time + geographic spread + coordination integrity scores. This is the dashboard no competitor can build. | 2 weeks |

**Position as:**
- Free tier: 500 supporters, 100 verified actions/month, 1,000 emails, full API, full analytics
- Starter ($10/mo): 1,000 verified actions, 20,000 emails, A/B testing
- Organization ($75/mo): 5,000 verified actions, 100,000 emails, custom domain, SQL mirror
- Coalition ($200/mo): 10,000 verified actions, 250,000 emails, white-label, child orgs

---

### Phase 2: Cancel Action Network (Months 4–8)

Phase 1 proved orgs will use verified advocacy. Phase 2 makes Commons a complete AN replacement. Every feature carries verification context — there is no "basic" layer underneath.

**Build:**

| Task | Why |
|---|---|
| Events (RSVP, map, attendee management, calendar export) | AN parity. Attendance verified against identity commitment. |
| Fundraising (Stripe checkout, one-time + recurring, 0% platform fee) | AN parity. Donation linked to verified supporter. |
| Automation / ladders | Event-driven workflows: verified action → debate invitation → follow-up → escalation. Trigger conditions include tier transitions and verification events. |
| Patch-through calling (Twilio) | Verified caller district before connection. No competitor has this. A staffer picks up and hears: "Connecting you with a verified constituent from your district." |
| SMS campaigns (Twilio) | Segmentation by tier + district. Delivery status. |
| Multi-org networks (Coalition tier) | Parent org, child orgs, shared supporter pools with portable reputation, cross-org coordination. |

**AN migration accelerator:**
- API sync tool (built) + marketing campaign targeting AN orgs
- Parallel operation mode (shadow → split → primary, spec'd in `docs/specs/AN-MIGRATION-SPEC.md`)
- "Why switch" landing page showing side-by-side: AN campaign report vs. Commons verification packet

**Target orgs:**
- Progressive orgs frustrated with AN's limitations (one-action-at-a-time export, 4 req/s API, no CRM)
- Mid-size orgs (5K–50K contacts) who are AN's core market
- Conservative/nonpartisan orgs who had no affordable option

---

### Phase 3: Transcend the Paradigm (Months 8–14)

Capabilities that redefine civic infrastructure. Only possible because Phases 0–2 built the verification substrate.

**Build:**

| Task | Why |
|---|---|
| Debate markets on campaigns | Campaign reaches traction → verified participants stake SUPPORT/OPPOSE/AMEND → LMSR pricing → 5-model AI panel scores argument quality. sqrt(stake) * 2^tier. Quality of reasoning, not just count. The contracts and AI evaluator are built (193 tests). Need campaign integration. |
| Verified agentic delegation | Agents act for verified constituents. Monitor legislation across all 24 district types. Draft grounding-verified messages. Participate in debates. ZK proof on every action. Tier-gated authority, revocable, private memory. Agent infrastructure is built (8,188 lines). Need delegation contract + UI. |
| Agentic legislative monitoring | Agent queries Shadow Atlas for constituent's districts → monitors bills → alerts constituent. Personalized to verified districts, not keyword-based. ~$6.50/org/month (Gemini + LegiScan). |
| Legislator scorecards | Track campaign delivery → official response. "This legislator received 891 verified constituent messages on this bill and voted No." Accountability instrument no scorecard platform can produce. |
| Coalition verification aggregation | Template-level metrics across endorsing orgs. "1,462 verified constituents across 3 organizations." Decision-maker sees collective weight. |

---

## What We Explicitly Skip

| Capability | Why Skip |
|---|---|
| Web form navigation (à la EveryAction 99.6% deliverability) | Fragile — forms change constantly, get CAPTCHAd, break. Our verification packet sent directly via email is more impactful than navigating an intake form. The packet IS the delivery. |
| Legislative tracking breadth (à la Quorum) | We'll never match Quorum's 50-state legislative corpus. We don't need to. Agentic monitoring personalized to verified districts is a better product for our users than a search engine across all bills. |
| Full CRM (à la Bonterra) | CRM is not our product. Verification is. An org can use EveryAction for donor management and Commons for advocacy. We stay focused on what no one else can build. |
| Social media advocacy | Low ROI relative to engineering cost. Verification doesn't carry to social platforms. |
| Video messages to officials | Niche (only CiviClick offers this). Low adoption. |
| Fax to officials | Legacy channel. Declining relevance. |
| Gamification | Engagement tiers are structural, not gamified. Earned through civic labor, not badges. |

---

## Key Flows

### Verified Letter (90 seconds, person-facing)

Click campaign link → enter name, email, postal code → Postal Bubble renders district(s) → optional mDL scan (4-6s, browser-side ZK) → send → letter + proof delivered to decision-maker → "You're verified constituent #248 in CA-12." The verification is the action — not a separate step bolted onto a form submission. Works for any public office across all 24 boundary types.

### Decision-Maker Receives Campaign Report (org-facing → decision-maker)

Open email from org → normal campaign letter → footer: "248 verified constituents in your district. Tier distribution: 12 Pillars, 43 Veterans, 89 Established, 104 Active. GDS: 0.91. ALD: 0.87." → click verification link → proof dashboard with per-sender verification status (identity verified, not identity revealed). Every number is backed by a proof the decision-maker can check. No other platform can produce this report.

### Organization Onboarding (org-facing)

Sign up → create org → import supporter CSV or connect AN API → create first campaign → set targets (auto-resolved from Postal Bubble geography across any district type) → publish → share campaign URL (embed widget in Phase 1) → supporters take action → dashboard shows verified counts, tier distribution, coordination signals from the first action.

### Debate Market Spawns from Campaign (person-facing → org-facing)

Campaign reaches traction threshold → org enables debate market → verified supporters stake on SUPPORT/OPPOSE/AMEND with structured arguments → LMSR pricing reflects genuine conviction → 5-model AI panel scores argument quality → campaign page shows: "62% AMEND (market depth $247). Top argument: 'Bill should index to CPI, not flat rate.' Score: 0.84." → org delivers to decision-maker as quality signal alongside constituent count.

---

## Competitive Positioning

```
                    High Verification
                          |
                    Debate |  COMMONS
                   Markets |
                          |
   Low Cost ──────────────┼────────────── High Cost
                          |
        Action Network    |         Quorum
         NationBuilder    |       EveryAction
              Muster      |      VoterVoice
                          |
                    Low Verification
```

Commons occupies the only quadrant no competitor can reach: high verification at low cost. Debate markets add a vertical axis no one else has — quality signals, not just volume.

**Against Quorum:** We don't compete on legislative intelligence breadth. We compete on the output — what the staffer receives. Proof beats volume.

**Against Bonterra:** We don't compete on CRM. We complement it. Use EveryAction for fundraising, Commons for advocacy. When the advocacy campaigns consistently outperform, the conversation shifts.

**Against VoterVoice:** We don't compete on mobilization speed. We compete on mobilization credibility. SmartCheck makes messages sound authentic. Commons makes messages be authentic.

**Against Action Network:** We compete directly. Same market (grassroots advocacy orgs), lower price, stronger product (verification), wider market (political neutrality). Migration pipeline built and spec'd.

**Against the conservative void:** We don't compete. We fill a vacuum. There is no conservative AN. We're it — and we serve both sides.

---

## Go-to-Market Sequence

### Beachhead (Phase 0–1, months 1–4)

| Segment | Why First | Acquisition |
|---|---|---|
| Science/health advocacy | Credibility is the product. "847 verified constituents" changes how a committee staffer reads testimony. | Direct outreach to 10–20 foundations/coalitions. |
| Local government advocacy | School boards, water districts, transit authorities — 21 of 24 Shadow Atlas boundary types have zero competitor coverage. We're the only platform that can target these offices. | Partner with local government transparency orgs. |
| Nonpartisan/conservative groups | No affordable tooling exists. Free tier is immediately the best option they've ever had. | Content marketing: "The advocacy platform that doesn't check your politics." |

### Expansion (Phase 2, months 4–8)

| Segment | Why Now | Acquisition |
|---|---|---|
| Progressive orgs wanting proof | Run Commons alongside AN. Compare staffer response rates. Migration when they see the difference. | AN migration tool + comparison landing page. |
| Small orgs (<5K contacts) | Free tier vs. AN's $15/mo minimum. Full API. No paywall on analytics. | Product-led growth. Self-serve signup. |

### Scale (Phase 3, months 8–14)

| Segment | Why Now | Acquisition |
|---|---|---|
| Corporate advocacy / trade associations | Currently paying Quorum $10K–$30K+/year. Commons Organization tier at $900/year with verification packets. | Case studies from beachhead orgs showing staffer response rate improvement. |
| Coalition networks | Cross-org reputation portable. Template-level verification aggregation. | Coalition tier feature launch + outreach to multi-org alliances. |

---

## Revenue Trajectory

From `docs/strategy/economics.md`:

| Milestone | Orgs | Revenue | Margin |
|---|---|---|---|
| Phase 0–1 (beta) | 10–50 | $500–$3,000/mo | — (pre-revenue / beta) |
| Phase 1 end (month 4) | 100–300 | $6K–$18K/mo | ~75% |
| Phase 2 end (month 8) | 500–1,000 | $30K–$60K/mo | ~80% |
| Phase 3 end (month 14) | 2,000–5,000 | $120K–$300K/mo | ~81% |

Growth is on verified actions, not email volume. As orgs discover that verified constituent contacts produce measurably better legislative response rates, they move up tiers to unlock more verified actions. Email overage revenue is noise. Verified action overage at $1.50–$3.00/1K against $0.01 COGS is the margin engine.
