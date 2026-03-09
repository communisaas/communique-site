# Competitive Analysis

> commons.email vs. the advocacy software market

---

## The Structural Gap

No platform in the advocacy software market verifies constituent identity. Every platform — Action Network, Quorum, EveryAction, Muster, NationBuilder — relies on self-reported addresses. This is not a missing feature. It is an architectural impossibility to retrofit: verification requires ZK circuits, on-chain nullifiers, government credential parsing, and a hierarchical district resolution system mapping every public boundary type (congressional through fire, water, transit, school, judicial — 24 slots per cell). Years of infrastructure work, not a sprint.

---

## Market Landscape

| Platform | Verification | Political Scope | Pricing | Key Limitation |
|---|---|---|---|---|
| Bonterra EveryAction (69.5% share) | None | Progressive-leaning | Enterprise | Vendor lock-in, no API |
| Quorum (+ Capitol Canary) | None | Bipartisan | Enterprise | $10K+ annual, enterprise sales only |
| Action Network | None | Progressive-only | $15-$125/mo | No CRM, CSV-only analytics, 4 req/s API |
| NationBuilder | None | All | $34-$199/mo | CMS-first, weak advocacy tooling |
| Phone2Action (now Capitol Canary) | None | Bipartisan | Enterprise | Acquired by Quorum, consolidating |
| **Commons** | **ZK-verified** | **All** | **$0-$200/mo** | New entrant, building org tooling |

---

## Action Network — Deep Comparison

**What they are:** SaaS advocacy toolkit for progressive orgs. 12,000+ orgs, 55M+ letters sent, ~14 years in market. OSDI API v1.1.1 (capped at 4 req/s on paid plans, unavailable on free).

**What Commons is:** Not Action Network with verification bolted on. A different thing. Every feature — email, letters, list management, analytics — works differently when built on verified identity, because the atom of the system is a cryptographic proof, not an email address.

### Unified Comparison

| Feature | Action Network | Commons |
|---|---|---|
| **Email** | WYSIWYG, A/B, SES. No identity context. Every recipient is an email address. | WYSIWYG, A/B, SES. Segments by engagement tier + verified district. Every send references verification state. An email to "Established-tier constituents in CA-12" is a fundamentally different object than an email to "people who typed 94607 into a form." |
| **Letter campaigns** | Congress + state legislatures. District from self-reported ZIP. No way to verify the sender lives there. | Any of 24 district types — congressional through fire, water, transit, school, judicial. District from Postal Bubble + mDL. Letter carries a ZK proof. The letter is a verified civic instrument, not a form submission. |
| **List management** | Tags, CSV import/export, self-reported geography. An org's list is a collection of unverified claims. | Tags, CSV import/export, engagement tiers (non-fakeable, on-chain), district membership across 24 boundary types. An org's list is a set of cryptographically attested relationships. |
| **Analytics** | CSV export. Opens, clicks. No way to distinguish real constituents from bots or out-of-district signers. | Full dashboard. Opens, clicks, verified actions, tier distribution, GDS, ALD, temporal entropy. Analytics answer "who engaged" with mathematical certainty, not probabilistic guessing. |
| **Identity** | Email + self-reported address. Platform stores full PII. | ZK proof of government credential. Platform stores commitment, not PII. Identity is a proof, not a record. |
| **Credibility signal** | Count of emails sent. Staffers have no basis for trust. | Verification packet: verified count, tier distribution, coordination integrity scores (GDS, ALD, entropy), debate market signal. Staffers can mathematically verify every claim. |
| **Pricing** | $15-$125/mo, no free tier | $0-$200/mo, free tier with full API |
| **Political scope** | Progressive only (501(c)(4) ToS). Half the market excluded by policy. | All — protocol verifies proof, not politics. Verification is orthogonal to ideology. |
| **API** | Paid plans only, 4 req/s cap | Free, all tiers, no cap |
| **Reputation** | None. Every supporter is equally weightless. | Engagement tiers: New (0), Active (1), Established (2), Veteran (3), Pillar (4). Non-purchasable, on-chain, portable across orgs. A Pillar who built trust over years carries that weight into every campaign. |
| **Privacy** | Plaintext PII. Fully subpoena-able. An org on a controversial issue exposes every supporter to legal discovery. | ZK proofs. Platform cannot link proof to person. Cannot be compelled to disclose what it doesn't possess. Privacy is structural, not policy. |
| **Debate / quality** | None. Volume is the only metric. No mechanism to surface quality of reasoning. | LMSR market + AI panel. sqrt(stake) * 2^tier. Campaigns deliver not just count but quality — structured arguments, adversarial pricing, scored reasoning. |
| **Agentic** | None. Bonterra Que does fundraising only. Quorum Quincy does legislative analysis at $10K+. Neither verifies the identity behind the agent. | Verified delegation. Tier-gated. Privacy-preserving memory. ZK proof on every agent action. An agent monitoring legislation across 24 district types on behalf of a Veteran-tier constituent is a categorically different thing than an unverified bot. |
| **Portability** | Per-org silos. Reputation resets with every new org. | Protocol-level identity. A supporter's verification and reputation travel across every org on the protocol. |
| **Custom domain** | Paid add-on | Included (Organization tier+) |
| **SQL mirror** | +$200/month add-on | Included (Organization tier+) |

### Feature Build Status

| Feature | Status | Verification Context |
|---|---|---|
| Mass email (A/B, scheduling) | Upcoming | SES backend, MJML templates. Segments by tier + verified district, not just tags. |
| Letter campaigns (Congress + state + 22 more types) | Built (Power Landscape) | CWC API, decision-maker resolution. Postal Bubble + mDL verification. Any public office, not just Congress. |
| Events (RSVP, map) | Upcoming | Standard CRUD. Attendance verified against identity commitment. |
| Fundraising (0% fee) | Upcoming | Stripe integration. Donation linked to verified supporter, not just email. |
| List management / CRM | Upcoming | CSV import/export, tags, segments. Tier-aware. District membership across 24 boundary types. |
| Embeddable widgets | Upcoming | iframe + postMessage. Verification flow embeddable in org sites. |
| Multi-org networks | Upcoming | Coalition tier. Cross-org reputation portable at protocol layer. |
| Automation / ladders | Upcoming | Event-driven workflows. Trigger conditions include tier transitions and verification events. |
| Click-to-call | Upcoming | Twilio integration. Caller verified against district before connection. |
| Debate markets | Built | LMSR + AI panel. sqrt(stake) * 2^tier. On-chain resolution with appeals. |
| Engagement tiers | Built | New (0) through Pillar (4). Non-purchasable. Composite of action diversity, temporal consistency, debate participation. |
| Postal Bubble (district resolution) | Built | Postal code to district without address verification. US/CA/UK/AU. Disambiguation UI. |
| Shadow Atlas (district tree) | Built | 94,166 districts, 24 boundary types per cell, H3-indexed. |
| ZK verification pipeline | Built | 5 circuits, 4 depths, mDL parsing, browser-side proof generation. |

---

## What Congressional Offices Receive

| Signal | Action Network | Commons |
|---|---|---|
| Count | "847 people emailed" | "847 verified constituents in CA-12" |
| Identity | Email address (self-reported) | ZK proof of government credential |
| District | Self-reported ZIP (often wrong) | Merkle proof against hierarchical district tree (24 boundary types) |
| Credibility | None | Engagement tier distribution (89 Pillars, 112 Established) |
| Quality | None | Debate market signal (62% AMEND, market depth $247) |
| Authenticity | None | GDS 0.91, ALD 0.87, temporal entropy 0.93 |
| Privacy | Org has full PII, can be compelled to disclose | ZK — platform cannot link proof to person |

---

## Moats

**Theirs (AN):** Switching cost (supporter lists locked in), coalition network effects (multi-org campaigns), brand recognition (14 years, progressive ecosystem). All eroding — OSDI provides some portability, brand doesn't help with spam reputation problems, progressive-only restriction halves addressable market.

**Ours:** Cryptographic verification (5 circuits, 4 depths, 13 contracts, 7 audit rounds — years of work), zero marginal cost for verification (browser-side ZK), protocol composability (identity portable, reputation portable, network effects at protocol layer not app layer), political neutrality (2x addressable market), open source (trust through transparency).

AN's moat is organizational inertia. Ours is mathematical proof. Inertia erodes. Math doesn't.

---

## Go-to-Market

1. **Science/health advocacy** — credibility over volume. ALI, disease foundations, research coalitions. These orgs need staffers to *believe* the signers are real. Verification is the product.
2. **Nonpartisan/conservative groups** — structurally excluded from AN (progressive-only ToS). Underserved market with no good tooling.
3. **Small orgs** — free tier vs AN's $15/month minimum. Full API access. No paywall on analytics.
4. **Progressive orgs wanting proof** — run Commons alongside AN. Use AN for volume, Commons for verified actions. Migration path when they see the difference in staffer response rates.
