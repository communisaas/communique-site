# Commons Documentation Map

**Purpose:** Find what you need, fast. Every piece of information has ONE home.

**Total Active Docs:** 89 files across organized folders (82 active + 7 archived)

---

## Quick Navigation

**"What's the current status?"** → `implementation-status.md`
**"How does Commons work?"** → `architecture.md`
**"How does identity/trust work?"** → `architecture/graduated-trust.md` **(north star for identity architecture)**
**"How do I integrate with voter-protocol?"** → `integration.md`
**"How does wallet / chain abstraction work?"** → `specs/chain-abstraction-architecture.md`
**"What's the remediation plan?"** → `specs/INTEGRATION-REMEDIATION-PLAN.md`
**"How do I build frontend features?"** → `frontend.md`
**"How do I test?"** → `development/testing.md`
**"Voice and design language?"** → `design/voice.md`

---

## Two Audiences, One Application

Commons serves **people** and **organizations** through the same platform. The docs reflect this.

**Person-facing** (verified civic speech): identity verification, spatial browse, postal bubble, power landscape, debate markets, proofs. A person uses commons.email to send a verified letter to their representative.

**Org-facing** (advocacy infrastructure): mass email, campaigns, list management, analytics, billing, multi-tenancy. An organization uses commons.email to mobilize supporters and deliver verified constituent signals at scale.

The org layer is what directly competes with Action Network, EveryAction, and Quorum — but it's built on top of the person layer, which none of them have.

---

## Core Documentation (6 files in root)

| File | Purpose |
|------|---------|
| `README.md` | This documentation map |
| `implementation-status.md` | What's done, in progress, blocked (SINGLE SOURCE OF TRUTH) |
| `architecture.md` | Commons/voter-protocol separation, privacy architecture |
| `integration.md` | CWC API, OAuth, voter-protocol, identity verification |
| `frontend.md` | SvelteKit 5, runes-based state, component patterns |
| `DOCUMENTATION-CLEANUP-PLAN.md` | Current documentation reorganization plan |

---

## Folder Guide

### `features/` (10 files)
Feature-specific documentation (person-facing).

**Key files:**
- `templates.md` - Template system (creation, customization, moderation)
- `creator.md` - Template creator UI (CodeMirror, variable system)
- `oauth.md` - OAuth provider flows
- `onboarding.md` - User onboarding flows
- `jurisdiction.md` - Jurisdiction system (TemplateJurisdiction model)
- `identity-verification.md` - mDL via Digital Credentials API flows

### `specs/` (18 files)
Technical specifications and design docs.

**Core specs:**
- `agentic-civic-infrastructure.md` - **Verified agentic civic action.** Delegation model, legislative intelligence, privacy-preserving memory, MCP civic servers, democratic guardrails. The spec for how AI agents act on behalf of verified constituents.
- `chain-abstraction-architecture.md` - **Wallet, signing, gas, funding layers** (5-layer stack, 3 entry paths, security model)
- `zk-proof-integration.md` - ZK proof integration (5 phases, 45K)
- `portable-identity.md` - IPFS + on-chain pointer (Phase 2)
- `universal-credibility.md` - Credential verification system
- `INTEGRATION-REMEDIATION-PLAN.md` - **MASTER** Multi-wave remediation plan (Wave 1 done, Waves 2-4 planned)

**Design specs:**
- `subject-line-clarifying-questions.md` - Clarification UI design
- `progressive-template-sections.md` - Template sectioning UX
- `proof-generation-ux.md` - Browser-native ZKP UX
- `header-redesign.md` - Header perceptual engineering
- `analytics-funnel.md` - Analytics tracking specification
- `interactive-location-breadcrumb.md` - Location filter breadcrumb UI

### `development/` (15 files including integrations/)
Development workflows and guides.

**Key files:**
- `testing.md` - Integration-first test strategy, mocks, fixtures
- `database.md` - Prisma schema, migrations, seeding
- `deployment.md` - Production deployment
- `integrations/` - External service integrations (11 files)
  - `clarification-panel-usage.md` - Clarification panel guide
  - `message-generation-integration.md` - AI message generation
  - `decision-maker-resolution-integration.md` - Decision-maker lookup
  - `multi-target-delivery-spec.md` - Multi-target delivery

### `architecture/` (6 files)
Architectural deep-dives.

**Key files:**
- `graduated-trust.md` - **Identity & trust tier architecture (Tiers 0-4).** North star for all identity/verification work.
- `platform-extension.md` - **Org-facing platform architecture.** What exists vs. what needs building to match AN feature set (email engine, campaigns, list mgmt, billing, multi-tenancy).
- `LOCATION-SIGNAL-ACCURACY-LIMITS.md` - Location signal accuracy matrix (IP = state only)
- `progressive-precision.md` - Progressive precision framework

### `design/` (9 files)
Design system and voice.

**Key files:**
- `voice.md` - Pragmatic cypherpunk voice guide
- `design-system.md` - Component design system
- `TYPOGRAPHY-SYSTEM.md` - Typography standards
- `ux-responsibilities.md` - UX layer responsibilities
- `colors.md` - Color system
- `motion.md` - Animation and transitions

### `congressional/` (2 files)
Congressional delivery system.

**Key files:**
- `delivery.md` - Delivery system spec (includes CWC API technical reference)
- `dashboard.md` - Dashboard spec

### `strategy/` (11 files)
Business strategy, pricing, and launch planning.

**Key files:**
- `vision.md` - Product vision, design thesis, protocol layer diagram
- `economics.md` - Pricing tiers, unit economics, revenue projections (org-facing)
- `product-roadmap.md` - MVP feature list, key flows, competitive positioning (org-facing)
- `launch-checklist.md` - Pre-launch requirements
- `beta-strategy.md` - Beta testing approach

### `testing/` (2 files)
Testing guides and documentation.

**Key files:**
- `DATABASE-CLEARING-ISSUE.md` - Important: test database clearing behavior
- `ZK-PROOF-TESTING-STRATEGY.md` - ZK proof testing

### `research/` (4 files)
Research and analysis.

**Key files:**
- `competitive-analysis.md` - Competitive landscape (AN, EveryAction, Quorum, NationBuilder)
- `power-structures.md` - Multi-stakeholder power structure research

### `implementation/` (1 file)
Implementation tracking.

**Key file:**
- `current-work.md` - Detailed current work tracking

### `archive/` (7 files)
Historical documentation and superseded specs.

Contains archived docs from past migrations, refactors, and design iterations. Reference only for historical context.

---

## Information Ownership

| Topic | Home |
|-------|------|
| Implementation Status | `implementation-status.md` |
| Architecture | `architecture.md` |
| **Identity & Trust Tiers** | `architecture/graduated-trust.md` |
| **Org Platform Extension** | `architecture/platform-extension.md` |
| Integration | `integration.md` |
| **Agentic Civic Infrastructure** | `specs/agentic-civic-infrastructure.md` |
| **Chain Abstraction** | `specs/chain-abstraction-architecture.md` |
| **Integration Remediation** | `specs/INTEGRATION-REMEDIATION-PLAN.md` |
| **Vision & Design Thesis** | `strategy/vision.md` |
| **Pricing & Economics** | `strategy/economics.md` |
| **Competitive Landscape** | `research/competitive-analysis.md` |
| Frontend | `frontend.md` |
| Features | `features/*.md` |
| Specs | `specs/*.md` |
| Development | `development/*.md` |
| Design | `design/*.md` |

**Principle:** Every piece of information has ONE home. No duplication.

---

## Finding Information

1. **Check `implementation-status.md`** - Current state of everything
2. **Check this README** - Navigate to specific folder
3. **Use grep** - `grep -r "keyword" docs/` (finds information fast)

---

*Commons | Documentation Map | 2026-03-05*
