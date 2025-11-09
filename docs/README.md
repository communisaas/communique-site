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
- See [features/oauth-setup.md](features/oauth-setup.md) for OAuth configuration
- See [database-seeding.md](database-seeding.md) for test data

---

## Architecture

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

## Congressional Delivery

**How messages reach congressional offices:**
- [congressional/cwc-integration.md](congressional/cwc-integration.md) - Communicating With Congress API integration.
- [congressional/DELIVERY-PATHS.md](congressional/DELIVERY-PATHS.md) - End-to-end message delivery flow.
- [congressional/dashboard-implementation-plan.md](congressional/dashboard-implementation-plan.md) - Office dashboard for verified constituent messages.

---

## Features

**Template System:**
- [features/TEMPLATE-SYSTEM.md](features/TEMPLATE-SYSTEM.md) - Variable extraction, customization, moderation.
- [features/template-creator.md](features/template-creator.md) - CodeMirror editor, jurisdiction picker.

**Identity & Verification:**
- [features/oauth-setup.md](features/oauth-setup.md) - Google, Facebook, Twitter, LinkedIn, Discord OAuth.
- [DISTRICT-VERIFICATION-RESPONSIBILITIES.md](DISTRICT-VERIFICATION-RESPONSIBILITIES.md) - Zero-knowledge district verification (voter-protocol).

**Legislative Abstraction:**
- [features/legislative-abstraction.md](features/legislative-abstraction.md) - US congressional delivery adapter pattern.

---

## Design System

**Visual Language:**
- [design/design-system-principles.md](design/design-system-principles.md) - Color tokens, typography, spacing.
- [design/language-voice-guidelines.md](design/language-voice-guidelines.md) - Writing style, tone, messaging.
- [design/README.md](design/README.md) - Complete design system overview.

**UI Patterns:**
- [design-system.md](design-system.md) - Component library reference.
- [ui-structure-guidelines.md](ui-structure-guidelines.md) - Layout conventions.

---

## Development

**Database:**
- [database-seeding.md](database-seeding.md) - Seed scripts for test data.
- [DATA-MODEL-SPECIFICATION.md](DATA-MODEL-SPECIFICATION.md) - Prisma schema, zero-knowledge fields.

**Testing:**
- [tests/README.md](../tests/README.md) - Integration-first test suite (53→6 tests, smart mocks).

**Feature Flags:**
- [feature-flags.md](feature-flags.md) - Beta feature toggles, configuration.

---

## Integrations

**Blockchain:**
- [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md) - VOTER Protocol integration, passkey wallets, reputation tracking.

**Third-Party APIs:**
- [congressional/cwc-integration.md](congressional/cwc-integration.md) - Congressional delivery.
- [features/oauth-setup.md](features/oauth-setup.md) - Social OAuth providers.

---

## Documentation Maintenance

**Cleanup Plans:**
- [DOCUMENTATION-CLEANUP-PLAN.md](DOCUMENTATION-CLEANUP-PLAN.md) - Ongoing consolidation roadmap.
- [DOCUMENTATION-CLEANUP-PHASE-2.md](DOCUMENTATION-CLEANUP-PHASE-2.md) - Phase 2 analysis.

**Archive:**
- [archive/historical/](archive/historical/) - Historical status updates, obsolete docs.

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

## Questions?

**Architecture questions:** Read [CYPHERPUNK-ARCHITECTURE.md](CYPHERPUNK-ARCHITECTURE.md) and [FRONTEND-ARCHITECTURE.md](FRONTEND-ARCHITECTURE.md)

**voter-protocol questions:** See [voter-protocol repository](https://github.com/communisaas/voter-protocol)

**Congressional delivery questions:** See [congressional/](congressional/) directory

**Feature implementation questions:** See [features/](features/) directory

---

*Communiqué PBC | 2025 | Open-source democratic infrastructure*
