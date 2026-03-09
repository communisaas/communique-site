# Product Roadmap

> commons.email — what we build, in what order

---

## Roles

**Person** — sends verified letters to decision-makers, participates in debates. Optionally verifies identity via mDL for ZK proofs. Builds portable reputation through engagement tiers: New (0), Active (1), Established (2), Veteran (3), Pillar (4).

**Organization** — creates campaigns, sends mass email, manages supporters, views analytics with verification and coordination integrity signals.

**Decision-Maker** — receives messages with verification packets. Sees constituent count, engagement tier distribution, coordination integrity scores, debate market signals.

---

## Design Thesis

Every feature is verification-intrinsic. Not "commodity features plus ZK extras" but features where verification is woven into the surface. The product should be indistinguishable from existing advocacy tools for someone who has never heard of zero-knowledge proofs — while delivering guarantees that existing tools architecturally cannot. There is no unverified layer that gets verification bolted on later. District resolution, engagement tiers, coordination integrity, and privacy-preserving identity are structural to every feature from day one.

---

## Phase 1: Verified Campaign Infrastructure

The thing no other platform can build. Campaign creation through verified action through proof delivery to decision-makers.

| Feature | Details |
|---|---|
| **Verified letters** | Compose → postal code → Postal Bubble renders district(s) → optional mDL identity verification (4-6s, browser-side ZK) → letter + proof delivered to decision-maker. Any of 24 boundary types — congressional, state legislative, county, municipal, school board, judicial, water district, transit authority. |
| **Verification packet** | Auto-produced with every campaign. Verified constituent count by district, tier distribution (New through Pillar), GDS, ALD, temporal entropy. Ships without org intervention. |
| **Proof dashboard** | Decision-maker sees: "248 verified constituents in your district. 12 Pillars, 43 Veterans, 89 Established, 104 Active. GDS: 0.91. ALD: 0.87." Per-sender verification status — identity verified, not identity revealed. |
| **Embeddable widgets** | iframe + postMessage. Supporter enters postal code → sees district → takes verified action. Drops into any org website. |

---

## Phase 2: Cancel Action Network

Everything needed to replace AN. Every feature carries verification context — there is no "basic" layer underneath.

| Feature | Details |
|---|---|
| **Mass email** | WYSIWYG compose, merge fields, A/B testing, scheduling. Segments by engagement tier + district + verification status. SES backend. |
| **List management** | CSV import/export, tags, custom fields, dedup on email. Segments filter by engagement tier (non-fakeable, on-chain), verification status, district membership across all 24 boundary types. |
| **Admin dashboard** | Shows what the decision-maker will see — verified counts, tier distribution, coordination signals. The org's view and the decision-maker's view are the same data. |
| **Analytics** | Not just opens/clicks/bounces — verified action count, tier distribution over time, coordination integrity scores, geographic distribution. |
| **Billing** | Stripe subscriptions + usage metering. Verified actions as primary metered unit. |
| **API** | RESTful, free on all tiers, no rate cap. |
| **Events** | RSVP, map, attendee management, calendar export. |
| **Fundraising** | Stripe checkout, one-time + recurring, 0% platform fee. |

---

## Phase 3: Transcend the Paradigm

Capabilities that redefine civic infrastructure. Only possible because Phases 1-2 built the verification substrate.

| Feature | Details |
|---|---|
| **Debate markets** | Campaign reaches traction threshold → verified participants stake SUPPORT/OPPOSE/AMEND → LMSR pricing → 5-model AI panel scores argument quality → quality signal on campaign page. sqrt(stake) * 2^tier. Quality of reasoning, not just count. |
| **Verified agentic delegation** | Agents act for verified constituents. Monitor legislation across all 24 district types. Draft grounding-verified messages. Participate in debates. ZK proof on every action. Tier-gated authority, revocable, private memory. |
| **SMS campaigns** | Twilio send/receive, segmentation, delivery status. |
| **Automation** | Event-driven workflows: verified action → debate invitation → follow-up → escalation. |
| **Coalition networks** | Parent org, child orgs, shared supporter pools with portable reputation, cross-org coordination. |

---

## Key Flows

### Verified Letter (90 seconds, person-facing)

Click campaign link → enter name, email, postal code → Postal Bubble renders district(s) → optional mDL scan (4-6s, browser-side ZK) → send → letter + proof delivered to decision-maker → "You're verified constituent #248 in CA-12." The verification is the action — not a separate step bolted onto a form submission. Works for any public office across all 24 boundary types.

### Decision-Maker Receives Campaign Report (org-facing → decision-maker)

Open email from org → normal campaign letter → footer: "248 verified constituents in your district. Tier distribution: 12 Pillars, 43 Veterans, 89 Established, 104 Active. GDS: 0.91. ALD: 0.87." → click verification link → proof dashboard with per-sender verification status (identity verified, not identity revealed). Every number is backed by a proof the decision-maker can check. No other platform can produce this report.

### Debate Market Spawns from Campaign (person-facing → org-facing)

Campaign reaches traction threshold → org enables debate market → verified supporters stake on SUPPORT/OPPOSE/AMEND with structured arguments → LMSR pricing reflects genuine conviction → 5-model AI panel scores argument quality → campaign page shows: "62% AMEND (market depth $247). Top argument: 'Bill should index to CPI, not flat rate.' Score: 0.84." → org delivers to decision-maker as quality signal alongside constituent count.

### Organization Onboarding (org-facing)

Sign up → create org → import supporter CSV (dedup, tag) → create first campaign → set targets (auto-resolved from Postal Bubble geography across any district type) → publish → embed widget on org website → supporters take action → dashboard shows verified counts, tier distribution, coordination signals from the first action. Verification signals are structural to the dashboard, not a tab the org discovers later.

---

## Positioning

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
                          |
                    Low Verification
```

Commons occupies the only quadrant no competitor can reach: high verification at low cost. Debate markets add a vertical axis no one else has — quality signals, not just volume.
