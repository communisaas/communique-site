# Feature Documentation

**Feature implementation guides - what Communiqué actually implements (thin client).**

---

## Responsibility Separation

**Communiqué implements**:
- ✅ Template system (create, customize, moderate)
- ✅ OAuth authentication (Google, Facebook, Twitter, LinkedIn, Discord)
- ✅ UI for address collection
- ✅ Semantic search (Google Gemini embeddings)
- ✅ Congressional email lookup (Hunter.io for template creators)
- ✅ Universal sharing (navigator.share API)

**voter-protocol owns** (Communiqué just calls as thin client):
- ❌ District verification (Shadow Atlas, geocoding, Halo2 proofs)
- ❌ Merkle trees (built off-chain, published to IPFS)
- ❌ Smart contracts (Scroll zkEVM)
- ❌ Reputation tracking (ERC-8004 on-chain)

**See**: [DISTRICT-VERIFICATION-RESPONSIBILITIES.md](../DISTRICT-VERIFICATION-RESPONSIBILITIES.md) for complete architecture separation.

---

## Core Features (Start Here)

### 1. [templates.md](templates.md) - Template System

Variable extraction, customization, multi-agent content moderation.

**What it does**: Users create/customize message templates, AI agents moderate for quality.

**Dependencies**: None (core feature)

**Implementation**: Communiqué feature (not voter-protocol)

---

### 2. [creator.md](creator.md) - Template Creator

CodeMirror editor, jurisdiction picker, variable extraction UI.

**What it does**: Rich text editor for creating templates with jurisdiction targeting.

**Dependencies**: templates.md

**Implementation**: Communiqué UI (calls congressional email lookup)

---

### 3. [email-lookup.md](email-lookup.md) - Congressional Email Lookup

Hunter.io integration for template creators finding congressional office emails.

**What it does**: Template creators can look up congressional office emails (3/day limit).

**Dependencies**: None (standalone Hunter.io API integration)

**Implementation**: Communiqué feature (rate-limited API calls)

---

## Authentication & Onboarding

### 4. [oauth.md](oauth.md) - OAuth Integration

Google, Facebook, Twitter, LinkedIn, Discord authentication. Token persistence and management.

**What it does**: Single sign-on, encrypted token storage, user can revoke anytime.

**Dependencies**: None

**Implementation**: Communiqué feature (token storage in database)

---

### 5. [onboarding.md](onboarding.md) - Progressive Onboarding

Progressive disclosure patterns, step-by-step user activation.

**What it does**: Gradual feature introduction, reduces cognitive load.

**Dependencies**: oauth.md

**Implementation**: Communiqué UI flow

---

## Discovery & Search

### 6. [search.md](search.md) - Semantic Search

Template discovery via semantic embeddings, natural language queries.

**What it does**: "Find templates about housing" → relevant templates ranked by semantic similarity.

**Dependencies**: embeddings.md

**Implementation**: Communiqué feature (Google Gemini API integration)

---

### 7. [jurisdiction.md](jurisdiction.md) - Jurisdiction Targeting

Geographic targeting for templates (city council, state legislature, congressional district).

**What it does**: Templates can target specific elected officials by geography.

**Dependencies**: templates.md

**Implementation**: Communiqué feature (TemplateJurisdiction database model)

---

## Advanced Features

### 8. [embeddings.md](embeddings.md) - Gemini Embeddings

Google Gemini integration for semantic search, template clustering, recommendation engine.

**What it does**: Generate vector embeddings for templates, enable semantic search.

**Dependencies**: None (standalone service)

**Implementation**: Communiqué feature (API client for Google Gemini)

**Roadmap**: See "Next Steps" section in embeddings.md

---

### 9. [sharing.md](sharing.md) - Universal Sharing

Native share API (mobile) + clipboard (desktop). Platform-agnostic sharing patterns.

**What it does**: One button shares everywhere (WhatsApp, Discord, Slack, Twitter, email, SMS).

**Dependencies**: templates.md

**Implementation**: Communiqué UI feature (navigator.share API)

---

### 10. [abstraction.md](abstraction.md) - Legislative Abstraction

Adapter pattern for different legislative bodies (US Congress, state legislatures, city councils).

**What it does**: Unified interface for delivering messages to any legislative body.

**Dependencies**: None (architecture pattern)

**Implementation**: Communiqué adapter layer (US Congress implemented, UK/EU planned)

---

## What Features Are NOT Here

**These are voter-protocol responsibilities** (NOT Communiqué features):

❌ **District verification** → voter-protocol provides `@voter-protocol/client`
- Shadow Atlas (Merkle trees, district boundaries)
- Geocoding services (Geocodio/Nominatim abstraction)
- Halo2 WASM proving (browser-native ZK proofs)
- See: `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md`

❌ **Reputation tracking** → voter-protocol smart contracts
- ERC-8004 on-chain reputation
- Multi-agent treasury management (Phase 2)
- Token rewards (Phase 2)
- See: `/docs/INTEGRATION-GUIDE.md`

❌ **Blockchain infrastructure** → voter-protocol contracts
- Scroll zkEVM deployment
- DistrictRegistry.sol, DistrictGate.sol, Halo2Verifier.sol
- See: voter-protocol repository

---

## Cross-References

**Search UX patterns** → See `/docs/design/search-ux.md`

**OAuth setup guide** → See `/docs/features/oauth.md`

**Template design guidelines** → See `/docs/design/discovery.md`

**Database schema** → See `/docs/development/schema.md`

**Congressional delivery** → See `/docs/congressional/delivery.md`

**District verification (voter-protocol)** → See `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md`

---

## Implementation Status

| Feature | Status | Priority | Owner |
|---------|--------|----------|-------|
| templates.md | ✅ Complete | P0 (core) | Communiqué |
| creator.md | ✅ Complete | P0 (core) | Communiqué |
| oauth.md | ✅ Complete | P0 (core) | Communiqué |
| onboarding.md | ✅ Complete | P1 | Communiqué |
| jurisdiction.md | ✅ Complete | P1 | Communiqué |
| sharing.md | ✅ Complete | P1 | Communiqué |
| abstraction.md | ✅ Complete (US) | P1 | Communiqué |
| search.md | 🚧 In Progress | P2 | Communiqué |
| embeddings.md | 🚧 In Progress | P2 | Communiqué |
| email-lookup.md | 🚧 In Progress | P2 | Communiqué |
| **District verification** | ✅ Complete | P0 | **voter-protocol** |
| **Reputation tracking** | ✅ Complete | P0 | **voter-protocol** |

---

## Reading Order

**New developers**: templates.md → creator.md → oauth.md

**UX designers**: onboarding.md → sharing.md → search.md

**Backend engineers**: abstraction.md → embeddings.md → email-lookup.md

**Understanding voter-protocol integration**: See `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md` first

**Understanding blockchain integration**: See `/docs/INTEGRATION-GUIDE.md`
