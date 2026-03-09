# Vision

> Civic infrastructure where every action carries proof.

---

## What Commons Is

Commons is civic communication infrastructure. Not a mail merge tool with a database — infrastructure that makes civic speech *verifiable*.

A person sends a letter through Commons. That letter carries cryptographic proof that the sender holds a government-issued credential, lives in the decision-maker's district (verified against a hierarchical Merkle tree of every public district boundary — congressional, state legislative, county, municipal, school, judicial, fire, water, transit, and more), and has an engagement history that cannot be purchased or fabricated. The decision-maker's office doesn't trust Commons. They verify the math.

An organization runs campaigns through Commons. Those campaigns produce verification packets: district-level constituent counts, engagement tier distributions, coordination integrity scores, and adversarial quality signals. A staffer opens a campaign report and sees not "847 people emailed" but "847 verified constituents in your district, 89 at Pillar tier, coordination diversity score 0.91, debate market consensus 62% AMEND."

commons.email is the application. voter-protocol is the open protocol beneath it.

## Design Thesis

The system must be indistinguishable from existing advocacy tools for someone who has never heard of zero-knowledge proofs — while delivering guarantees that existing tools architecturally cannot.

Three constraints:
1. **Cheaper** — 40-60% lower pricing, 80%+ gross margin
2. **Simpler** — fewer clicks to send a verified message than competitors require for an unverified one
3. **Unreplicable** — ZK identity, debate markets, coordination integrity, privacy architecture are structural. They cannot be bolted on after the fact.

## What Makes It Different

These are not separate features bolted onto a platform. They are properties of every surface — woven into every email, every letter, every campaign report, every agent action.

### Verified Identity

Every other advocacy platform accepts whatever name and address a user types in. Commons binds actions to government-issued credentials through zero-knowledge proofs. The proof reveals nothing about the person — only that they are real, that they hold a valid credential, and that they reside in the claimed district. This is not a feature added to email campaigns. It is the foundation that makes every campaign report, every analytics dashboard, every supporter segment fundamentally different from what any other platform produces.

### Adversarial Quality (Debate Markets)

When a campaign reaches traction, verified participants can stake on positions (SUPPORT / OPPOSE / AMEND) with structured arguments. LMSR pricing surfaces genuine conviction. A 5-model AI panel scores argument quality. Engagement-weighted: `sqrt(stake) × 2^tier` — a Pillar's $2 outweighs a newcomer's $100. The result: campaigns become quality instruments, not volume instruments.

### Coordination Integrity (Anti-Astroturf)

Congressional staffers currently have no tool to distinguish authentic grassroots from manufactured campaigns. Commons provides structural observability — Geographic Diversity Score, Author Linkage Diversity, Shannon entropy, temporal velocity — computed automatically from every action, whether submitted by a person or an agent. These signals ship with every campaign report. An org can prove its campaign is authentic. A staffer can verify it.

### Privacy Architecture

Commons cannot be subpoenaed for supporter data it does not possess. ZK proofs reveal constituency and engagement tier without revealing identity. The platform never sees the credential — only the proof derived from it. Agent memory is encrypted to the constituent's identity commitment. For organizations working on controversial issues, this is an existential requirement that no other platform can offer.

### Protocol Composability

Commons is one application on voter-protocol. The protocol is open:

```
APPLICATION LAYER
  commons.email          app-2              app-3
  (email, letters,       (city council      (union
   debates, events)       engagement)        organizing)

PROTOCOL LAYER (voter-protocol)
  ZK identity    — shared across all apps
  District map   — hierarchical global tree (24 slots per cell, every public district type)
  Debate markets — adversarial quality assurance
  Nullifiers     — one person, one action
  Engagement     — portable, non-purchasable reputation
```

A supporter who builds reputation on one organization's campaign carries it everywhere on the protocol. Identity is not siloed per-org. Reputation is not reset per-platform. Network effects compound at the protocol layer, not the application layer.

### Verified Agentic Delegation

Every advocacy platform adding AI in 2026 — Bonterra Que, Quorum Quincy, AdvocacyAI — layers AI on top of unverified identity. Commons does something structurally different: AI agents act on behalf of cryptographically verified constituents, within delegated bounds, with privacy-preserving memory.

A constituent delegates authority to an agent: "monitor school board agendas, draft responses matching my positions, notify me before sending." The agent monitors legislation across all 24 district types — not just federal. It drafts grounding-verified messages. It pre-resolves decision-makers. Every action it takes carries the same ZK proof as a manual action.

The delegation is bound to the constituent's engagement tier. An Active's agent can draft but not send. A Pillar's agent can act semi-autonomously within configured bounds. The on-chain nullifier system prevents an agent from exceeding its delegation. Revocation is instant.

The agent's memory — policy positions, engagement history, communication preferences — is encrypted to the constituent's identity commitment. The platform stores ciphertext. This is the intersection of agent memory and ZK privacy that the frontier research identifies as unexplored.

Full specification: `specs/agentic-civic-infrastructure.md`

## Political Neutrality

Every major advocacy platform is either explicitly progressive (Action Network — 501(c)(4), stated in ToS) or progressive-leaning (EveryAction — 69.5% market share, Bonterra parent). Commons verifies constituency, not ideology. Science-focused orgs, single-issue groups, conservative advocacy, nonpartisan coalitions — the protocol doesn't filter by politics. It filters by proof.

This is not centrism. It is infrastructure. Roads don't check voter registration.

## Why "Commons"

The commons is shared infrastructure that belongs to no one and serves everyone. Public roads, public water, public airwaves. Civic communication infrastructure should be a commons — not a proprietary SaaS platform owned by an advocacy organization with undisclosed funding sources.
