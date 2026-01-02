# Communiqué Documentation Map

**Purpose:** Find what you need, fast. Every piece of information has ONE home.

**Total Active Docs:** ~70 files across organized folders

---

## Quick Navigation

**"What's the current status?"** → `implementation-status.md`
**"How does Communiqué work?"** → `architecture.md`
**"How do I integrate with voter-protocol?"** → `integration.md`
**"How do I build frontend features?"** → `frontend.md`
**"How do I test?"** → `development/testing.md`
**"Voice and design language?"** → `design/voice.md`

---

## Core Documentation (5 files)

| File | Purpose |
|------|---------|
| `implementation-status.md` | What's done, in progress, blocked (SINGLE SOURCE OF TRUTH) |
| `architecture.md` | Communiqué/voter-protocol separation, privacy architecture |
| `integration.md` | CWC API, OAuth, voter-protocol, identity verification |
| `frontend.md` | SvelteKit 5, runes-based state, component patterns |

---

## Folder Guide

### `features/` (12 files)
Feature-specific documentation.

**Key files:**
- `templates.md` - Template system (creation, customization, moderation)
- `creator.md` - Template creator UI (CodeMirror, variable system)
- `oauth.md` - OAuth provider flows
- `onboarding.md` - User onboarding flows
- `jurisdiction.md` - Jurisdiction system (TemplateJurisdiction model)

### `specs/` (12 files)
Technical specifications and design docs.

**Core specs (mentioned in CLAUDE.md):**
- `zk-proof-integration.md` - ZK proof integration (5 phases, 45K)
- `portable-identity.md` - IPFS + on-chain pointer (Phase 2)
- `universal-credibility.md` - Credential verification system

**Design specs:**
- `subject-line-clarifying-questions.md` - Clarification UI design
- `progressive-template-sections.md` - Template sectioning UX
- `proof-generation-ux.md` - Browser-native ZKP UX
- `header-redesign.md` - Header perceptual engineering

### `development/` (11 files + integrations/)
Development workflows and guides.

**Key files:**
- `testing.md` - Integration-first test strategy, mocks, fixtures
- `database.md` - Prisma schema, migrations, seeding
- `deployment.md` - Production deployment
- `integrations/` - External service integrations (4 files)
  - `clarification-panel-usage.md` - Clarification panel guide
  - `message-generation-integration.md` - AI message generation
  - `decision-maker-resolution-integration.md` - Decision-maker lookup
  - `multi-target-delivery-spec.md` - Multi-target delivery

### `architecture/` (5 files)
Architectural deep-dives.

- `LOCATION-SIGNAL-ACCURACY-LIMITS.md` - Location signal accuracy matrix (IP = state only)

### `design/` (5 files)
Design system and voice.

**Key files:**
- `voice.md` - Pragmatic cypherpunk voice guide (mentioned in CLAUDE.md)
- `design-system.md` - Component design system
- `TYPOGRAPHY-SYSTEM.md` - Typography standards
- `ux-responsibilities.md` - UX layer responsibilities

### `congressional/` (4 files)
Congressional delivery system.

- `cwc.md` - CWC API documentation
- `delivery.md` - Delivery system spec
- `dashboard.md` - Dashboard spec

### `strategy/` (8 files)
Business and launch strategy (non-technical).

### `testing/` (2 files)
Testing guides.

- `DATABASE-CLEARING-ISSUE.md` - Important: test database clearing behavior
- `ZK-PROOF-TESTING-STRATEGY.md` - ZK proof testing

### `research/` (3 files)
Research and analysis.

- `power-structures.md` - Multi-stakeholder power structure research (mentioned in CLAUDE.md)

---

## Archive

**`archive/`** - Superseded docs, completed migrations, historical decisions

- `2025-12-clarification-implementation/` - Clarification feature implementation docs
- `2025-12-completed-specs/` - Completed specs (Gemini migration, geocoding)
- `toolhouse/` - Deprecated Toolhouse integration

---

## Information Ownership

| Topic | Home |
|-------|------|
| Implementation Status | `implementation-status.md` |
| Architecture | `architecture.md` |
| Integration | `integration.md` |
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

*Communiqué PBC | Documentation Map | 2025-01-02*
