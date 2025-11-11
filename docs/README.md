# Communiqué Documentation Map

**Purpose:** Find what you need, fast. Every piece of information has ONE home.

**Total Active Docs:** 15 (down from 95+)

---

## Quick Navigation

**"What's the current status?"** → `IMPLEMENTATION-STATUS.md`
**"How does Communiqué work?"** → `ARCHITECTURE.md`
**"How do I integrate with voter-protocol?"** → `INTEGRATION.md`
**"How do I build frontend features?"** → `FRONTEND.md`
**"How do I test?"** → `development/testing.md`
**"How do I deploy?"** → `development/deployment.md`

---

## Documentation by Purpose

### I need to understand the CURRENT state

→ **`IMPLEMENTATION-STATUS.md`** (SINGLE SOURCE OF TRUTH)

- What's complete (encryption, database, refactor)
- What's in progress (voter-protocol ZK proofs)
- What's blocked (TEE deployment, message delivery)
- Launch blockers
- Privacy violations fixed

### I need to understand the ARCHITECTURE

→ **`ARCHITECTURE.md`**

- **Separation of Concerns**: What Communiqué handles vs voter-protocol
  - Communiqué: UI/UX, OAuth, database, browser encryption, API proxies
  - voter-protocol: Cryptography, TEE deployment, ZK proofs, ReputationAgent, blockchain
- **Cypherpunk Principles**: Browser-native ZK proving (no server-side secrets)
- **Privacy Architecture**: What's private (address), public (message content), pseudonymous (reputation)
- **Cost Analysis**: $682.50/month Gemini savings, 99.97% IPFS savings

### I need to INTEGRATE with external systems

→ **`INTEGRATION.md`**

- **voter-protocol Integration**: ReputationAgent API, geocoding, district resolution, ZK proving
- **CWC API**: Congressional message delivery through TEE
- **OAuth Providers**: Google, Facebook, Twitter, LinkedIn, Discord (full flow examples)
- **Identity Verification**: self.xyz (NFC passport) + Didit.me (government ID)
- **TEE Encrypted Delivery**: Browser encryption → AWS Nitro Enclaves → CWC API
- **Rate Limiting**: CWC API limits, error handling, retry logic

### I need to build FRONTEND features

→ **`FRONTEND.md`**

- **SvelteKit 5 Architecture**: SSR vs CSR, when to use each
- **Runes-Based State Management**: `$state`, `$derived`, `$effect`
- **Component Patterns**: Props, events, composition
- **Form Handling**: Validation, error states, progressive enhancement
- **Type Safety**: Zero tolerance for `any` types

### I need to understand SPECIFIC FEATURES

→ **`features/templates.md`** - Template system (creation, customization, moderation)
→ **`features/creator.md`** - Template creator UI (CodeMirror editor, variable system)
→ **`features/identity-verification.md`** - self.xyz + Didit.me flows (session-based verification)

### I need to TEST or DEPLOY

→ **`development/testing.md`** - Test strategy, mocks, fixtures (integration-first approach)
→ **`development/database.md`** - Prisma schema, migrations, seeding
→ **`development/deployment.md`** - How to deploy Communiqué (production build, environment variables)

### I need DEEP TECHNICAL SPECS

→ **`specs/zk-proof-integration.md`** - ZK proof integration guide (5 phases, 10 weeks, 45K comprehensive)
→ **`specs/portable-identity.md`** - IPFS + on-chain pointer architecture (Phase 2, 19K)
→ **`specs/universal-credibility.md`** - Credential verification system (17K)

### I need HISTORICAL CONTEXT

→ **`archive/`** - Superseded docs, migrations, historical decisions

- `archive/2025-01-district-verification/` - Pre-voter-protocol separation
- `archive/2025-11-refactor/` - Architecture refactor process
- `archive/migrations/` - Database privacy migration records

---

## Information Ownership (No Redundancy)

**Implementation Status:** ONLY in `IMPLEMENTATION-STATUS.md`
**Architecture:** ONLY in `ARCHITECTURE.md`
**Integration:** ONLY in `INTEGRATION.md`
**Frontend:** ONLY in `FRONTEND.md`
**Features:** ONLY in `features/*.md`
**Development:** ONLY in `development/*.md`
**Specs:** ONLY in `specs/*.md`

**Principle:** Every piece of information has ONE home. No duplication across docs.

---

## Finding Information

### Search Strategy

1. **Check `IMPLEMENTATION-STATUS.md`** - Current state of everything
2. **Check `docs/README.md`** (this file) - Navigate to specific topic
3. **Use grep** - `grep -r "keyword" docs/` (finds information fast)

### Don't

- ❌ Read multiple docs for same topic (shouldn't exist after consolidation)
- ❌ Check archived docs first (unless researching historical decisions)
- ❌ Assume information is duplicated (it's not - ONE home per piece of info)

---

## Complete Documentation Structure

```
/ (2 docs)
├── CLAUDE.md                           # Entry point for Claude Code
└── README.md                           # Project overview

docs/ (13 docs)
├── README.md                           # This navigation map
├── IMPLEMENTATION-STATUS.md            # What's done, what remains (SINGLE SOURCE OF TRUTH)
├── ARCHITECTURE.md                     # Communiqué/voter-protocol separation
├── INTEGRATION.md                      # CWC API, OAuth, voter-protocol
├── FRONTEND.md                         # SvelteKit 5, runes, components
│
├── features/ (3 docs)
│   ├── templates.md                    # Template system
│   ├── creator.md                      # Template creator UI
│   └── identity-verification.md        # self.xyz + Didit.me (CONSOLIDATED)
│
├── development/ (3 docs)
│   ├── testing.md                      # Test strategy, mocks, fixtures
│   ├── database.md                     # Schema, migrations, seeding
│   └── deployment.md                   # How to deploy
│
├── specs/ (3 docs)
│   ├── zk-proof-integration.md         # ZK proof integration guide (45K)
│   ├── portable-identity.md            # IPFS + on-chain pointer (19K)
│   └── universal-credibility.md        # Credential verification (17K)
│
└── archive/ (historical, not counted)
    ├── 2025-01-district-verification/
    ├── 2025-11-refactor/
    └── migrations/
```

**Total Active Docs:** 15 (vs 95+ before consolidation)
**Reduction:** 84% fewer docs, 100% of critical information retained
**Navigation Time:** <30 seconds to find any piece of information

---

## Documentation Principles

### No Cruft
Every document serves a clear purpose. Historical/superseded content lives in `archive/`.

### No Redundancy
"Redundancy kills context." Every piece of information has exactly ONE home.

### No Fragmentation
"Fragmentation tears us into development hell." Related information lives together.

### Claude Code Navigation
Docs optimized for AI instances to quickly find relevant context without confusion.

---

*Communiqué PBC | Documentation Map | 2025-11-09*
