# Communiqué Documentation

**Frontend for VOTER Protocol's democratic infrastructure.**

Communiqué is the user-facing application. Cryptographic primitives, blockchain contracts, and zero-knowledge proof systems live in [voter-protocol](https://github.com/communisaas/voter-protocol).

---

## Start Here

**New to the codebase?**
1. Read [CYPHERPUNK-ARCHITECTURE.md](CYPHERPUNK-ARCHITECTURE.md) - Product philosophy, honest scope
2. Read [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md) - SvelteKit 5 patterns, runes, component architecture
3. Read [DISTRICT-VERIFICATION-RESPONSIBILITIES.md](DISTRICT-VERIFICATION-RESPONSIBILITIES.md) - What Communiqué does vs voter-protocol

**Setting up development?**
- See root [README.md](../README.md) for `npm install`, `npm run dev`
- See [development/index.md](development/index.md) for complete development workflow
- See [features/oauth.md](features/oauth.md) for OAuth configuration

---

## Documentation Structure

Communiqué docs are organized into **7 core directories**, each with an **index.md** that explains what's inside, reading order, and cross-references.

### [strategy/](strategy/) - Strategic Direction

**What's inside**: Phase 1 launch plan, coordination mechanics, organizing reality, viral growth, product roadmap.

**Start with**: [strategy/index.md](strategy/index.md) → [strategy/launch.md](strategy/launch.md) → [strategy/coordination.md](strategy/coordination.md)

**Who reads this**: Product team, founders, strategic partners understanding Communiqué's direction.

---

### [features/](features/) - Feature Implementation

**What's inside**: Template system, OAuth, search, embeddings, verification, sharing, jurisdiction targeting.

**Start with**: [features/index.md](features/index.md) → [features/templates.md](features/templates.md) → [features/creator.md](features/creator.md)

**Who reads this**:
- **New developers**: templates.md → creator.md → oauth.md
- **UX designers**: onboarding.md → sharing.md → search.md
- **Backend engineers**: abstraction.md → embeddings.md → verification.md
- **Security engineers**: verification.md → oauth.md → /docs/architecture/tee.md

---

### [design/](design/) - Design System

**What's inside**: Design principles, voice & tone, component library, search UX, governance patterns.

**Start with**: [design/index.md](design/index.md) → [design/principles.md](design/principles.md) → [design/voice.md](design/voice.md)

**Who reads this**:
- **Designers**: principles.md → voice.md → system.md
- **Developers implementing UI**: system.md → structure.md → friction.md
- **Writers**: voice.md (writing style, copy patterns)

---

### [development/](development/) - Development & Operations

**What's inside**: Database schema, seeding, testing, deployment, analytics, maintenance.

**Start with**: [development/index.md](development/index.md) → [development/quickstart.md](development/quickstart.md) → [development/schema.md](development/schema.md)

**Who reads this**:
- **New developers**: quickstart.md → schema.md → testing.md
- **DevOps engineers**: deployment.md → analytics.md → flags.md
- **Database engineers**: schema.md → seeding.md

---

### [congressional/](congressional/) - Congressional Delivery

**What's inside**: CWC API integration, message delivery flow, congressional dashboard, privacy architecture.

**Start with**: [congressional/index.md](congressional/index.md) → [congressional/cwc.md](congressional/cwc.md) → [congressional/delivery.md](congressional/delivery.md)

**Who reads this**:
- **Backend engineers**: cwc.md → delivery.md
- **Security engineers**: delivery.md (privacy guarantees, TEE architecture)
- **Congressional staff**: dashboard.md (office dashboard, verification badges)

---

### [architecture/](architecture/) - Cryptographic & Infrastructure Architecture

**What's inside**: Architecture decision record (browser-native WASM proving), TEE systems overview, cloud-agnostic TEE abstraction.

**Start with**: [architecture/index.md](architecture/index.md) → [architecture/decision-record.md](architecture/decision-record.md) → [architecture/tee-systems.md](architecture/tee-systems.md)

**Who reads this**:
- **Security engineers**: decision-record.md (privacy model), tee-systems.md (AWS Nitro Enclaves)
- **Backend engineers**: cloud-tee.md (multi-cloud TEE deployment)
- **Auditors**: decision-record.md (zero-knowledge proof generation), tee-systems.md (TEE threat model)

---

### [research/](research/) - Strategic Research

**What's inside**: Power structure analysis (housing, workplace, education, healthcare), TEE security & backdoor analysis.

**Start with**: [research/index.md](research/index.md) → [research/power-structures.md](research/power-structures.md) → [research/tee-security.md](research/tee-security.md)

**Who reads this**:
- **Product team**: power-structures.md (expansion beyond Congress)
- **Security engineers**: tee-security.md (TEE vulnerability research)
- **Organizers**: power-structures.md (leverage points in systems)

---

## Architecture Documentation (Detailed)

**Product & Philosophy:**
- [CYPHERPUNK-ARCHITECTURE.md](CYPHERPUNK-ARCHITECTURE.md) - Authoritative. McDonald 2018 research, honest messaging, privacy model.

**Frontend Technical:**
- [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md) - SvelteKit 5, runes, SSR, type safety, performance patterns.

**Cryptographic Decisions:**
- [architecture/ARCHITECTURE-DECISION-RECORD.md](architecture/ARCHITECTURE-DECISION-RECORD.md) - Browser-native WASM proving (voter-protocol provides).
- [architecture/TEE-SYSTEMS-OVERVIEW.md](architecture/TEE-SYSTEMS-OVERVIEW.md) - Message delivery TEE (Communiqué implements).
- [architecture/cloud-agnostic-tee-abstraction.md](architecture/cloud-agnostic-tee-abstraction.md) - Multi-cloud TEE deployment.

**Responsibility Separation:**
- [DISTRICT-VERIFICATION-RESPONSIBILITIES.md](DISTRICT-VERIFICATION-RESPONSIBILITIES.md) - What voter-protocol owns vs Communiqué thin client.

---

## Integrations

**Blockchain:**
- [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md) - VOTER Protocol integration, passkey wallets, reputation tracking.

**Third-Party APIs:**
- [congressional/cwc.md](congressional/cwc.md) - Congressional delivery (CWC API)
- [features/oauth.md](features/oauth.md) - Social OAuth providers (Google, Facebook, Twitter, LinkedIn, Discord)
- [features/embeddings.md](features/embeddings.md) - Google Gemini embeddings for semantic search

---

## What Communiqué Does NOT Do

**These live in voter-protocol:**
- ❌ Shadow Atlas generation (Merkle tree building)
- ❌ Geocoding services (address → district resolution)
- ❌ Halo2 ZK circuit implementation (proof generation)
- ❌ Smart contract deployment (on-chain verification)
- ❌ Multi-agent treasury management (Phase 2 tokenomics)

**Communiqué is a thin client:**
- ✅ Installs `@voter-protocol/client` and `@voter-protocol/zk-prover-wasm`
- ✅ Calls `voterClient.verifyDistrict(address)` (browser-native WASM proving)
- ✅ Stores commitment hash in database (not plaintext district)
- ✅ Displays verification status in UI
- ✅ Implements congressional message delivery TEE

---

## Archive

**Historical documents** (design iterations, status updates, audits):
- [archive/historical/](archive/historical/) - Copy audits, visual comparisons, data model analyses, redesign summaries

**Rejected approaches** (strategic docs that didn't fit):
- [archive/rejected/](archive/rejected/) - Early synthesis docs, alternative strategic directions

---

## Quick Navigation

**I want to...**

- **Understand the product vision** → [CYPHERPUNK-ARCHITECTURE.md](CYPHERPUNK-ARCHITECTURE.md)
- **Learn SvelteKit 5 patterns** → [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md)
- **Set up development environment** → [development/quickstart.md](development/quickstart.md)
- **Understand database schema** → [development/schema.md](development/schema.md)
- **Implement a new feature** → [features/index.md](features/index.md)
- **Understand design system** → [design/index.md](design/index.md)
- **Deploy to production** → [development/deployment.md](development/deployment.md)
- **Deploy AWS TEE infrastructure** → [development/aws-deployment.md](development/aws-deployment.md)
- **Understand congressional delivery** → [congressional/index.md](congressional/index.md)
- **Integrate VOTER Protocol** → [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md)
- **Understand strategic direction** → [strategy/index.md](strategy/index.md)
- **Understand cryptographic architecture** → [architecture/index.md](architecture/index.md)
- **Research power structures** → [research/power-structures.md](research/power-structures.md)
- **Evaluate TEE security** → [research/tee-security.md](research/tee-security.md)

---

## Questions?

**Architecture questions:** Read [CYPHERPUNK-ARCHITECTURE.md](CYPHERPUNK-ARCHITECTURE.md) and [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md)

**voter-protocol questions:** See [voter-protocol repository](https://github.com/communisaas/voter-protocol)

**Feature implementation:** See [features/index.md](features/index.md)

**Design system:** See [design/index.md](design/index.md)

**Development workflow:** See [development/index.md](development/index.md)

**Congressional delivery:** See [congressional/index.md](congressional/index.md)

**Strategic direction:** See [strategy/index.md](strategy/index.md)

**Cryptographic architecture:** See [architecture/index.md](architecture/index.md)

**Research & analysis:** See [research/index.md](research/index.md)

---

*Communiqué PBC | 2025 | Open-source democratic infrastructure*
