# Implementation Status Report

**Date:** 2026-02-25 (Updated)
**Focus:** Honest assessment after Cycles 1-15 of Graduated Trust Architecture
**Last Major Update:** Cycle 15 (Staked Deliberation + mDL-Only Identity Simplification) complete

---

## TL;DR

15 implementation cycles completed across Graduated Trust Architecture. The core identity verification, ZK proof generation, encrypted delivery, and congressional submission pipeline are implemented. Government credential (mDL) verification is the sole identity path (self.xyz + Didit.me removed in Cycle 15). Staked deliberation infrastructure added: 9 Svelte 5 components, 6 API routes, Prisma models, debate-scoped ZK proofs. Production deployment on Cloudflare Workers with Hyperdrive connection pooling. 7 P0 launch blockers remain — see [Launch Readiness Matrix](./architecture/REMAINING-GAPS.md#launch-readiness-matrix).

**What works end-to-end:** User verifies identity (mDL via Digital Credentials API) → address encrypted client-side (XChaCha20-Poly1305) → ZK proof generated in browser (Noir/WASM) → submission created with nullifier uniqueness → encrypted witness decrypted server-side → CWC API delivery to congressional offices → status tracking with polling.

**What doesn't work yet:** IACA root certificates loaded for CA and NM only; remaining states available via AAMVA VICAL parser (follow-up). TEE infrastructure (L-05) needed for production witness decryption.

---

## Tier Status

| Tier | Name | Status | Key Components |
|------|------|--------|----------------|
| 0 | Anonymous Guest | **IMPLEMENTED** | Email path via `mailto:`, template browsing, no auth |
| 1 | Passkey-bound | **IMPLEMENTED** | WebAuthn registration/authentication, did:key derivation, PasskeyRegistration/Login/Upgrade components |
| 2 | Address-attested | **IMPLEMENTED** | AddressVerificationFlow, district credential (W3C VC 2.0), VerificationGate with tier-aware routing |
| 3 | ZK-verified | **IMPLEMENTED** | Browser Noir prover, Shadow Atlas registration, ProofGenerator, encrypted witness, CWC delivery |
| 4 | Government credential | **IMPLEMENTED** | W3C Digital Credentials API, mDL selective disclosure, privacy boundary function, ephemeral ECDH keys |

---

## What's COMPLETE

### Identity & Authentication (Cycles 1-3, 9)
- **Passkey registration/authentication** — @simplewebauthn/server + /browser, P-256 + Ed25519, did:key derivation
- **Address verification** — AddressVerificationFlow, Google Civic API district lookup, DistrictCredential (W3C VC 2.0)
- **Identity verification** — mDL via W3C Digital Credentials API (sole provider; self.xyz and Didit.me removed 2026-02-24)
- **Session credential caching** — IndexedDB wallet with TTL, SSR-safe
- **Trust tier computation** — `deriveTrustTier()` per-request in hooks.server.ts, 5-tier graduated model
- **Authority levels** — 0-5 scale, `trustTierToAuthorityLevel()` mapping
- **Credential policy** — Action-based TTL (constituent_message: 30 days)

### Zero-Knowledge Proofs (Cycles 4-5)
- **Browser WASM prover** — Noir circuits (UltraHonk backend, 4096-leaf Merkle trees), 600ms-10s proving time
- **Shadow Atlas registration** — Identity commitment, district Merkle trees, two-tree architecture
- **ProofGenerator component** — Credential → proof inputs → generate → encrypt witness → submit
- **Nullifier enforcement** — Unique constraint in DB, checked in transaction

### Encrypted Delivery (Cycles 4-5)
- **Client-side encryption** — XChaCha20-Poly1305 via libsodium, X25519 ECDH key agreement
- **Server-side decryption** — `witness-decryption.ts` mirrors client encryption
- **CWC delivery pipeline** — `delivery-worker.ts` (10-step: decrypt → extract address → lookup reps → build CWC payload → submit per-rep → update status)
- **Submission endpoint** — Nullifier uniqueness, idempotency key, pseudonymous ID, trust tier promotion
- **Status tracking** — `/api/submissions/[id]/status` with polling, atomic retry

### Government Credentials / mDL (Cycle 9)
- **Digital Credentials API wrapper** — Feature detection, dual-protocol (mdoc + oid4vp), 60s timeout
- **GovernmentCredentialVerification component** — 6-state Svelte 5 component with callback props
- **Privacy boundary function** — `processCredentialResponse()`: CBOR decode, extract address, derive district, discard PII
- **Ephemeral key lifecycle** — ECDH P-256 key pairs, Workers KV with 5-min TTL, one-time use
- **Selective disclosure** — ONLY postal_code + city + state requested, `intent_to_retain: false`
- **Progressive enhancement** — mDL option shown only when `isDigitalCredentialsSupported()` returns true

### Infrastructure (Cycles 1, 8)
- **Cloudflare Workers deployment** — SvelteKit adapter-cloudflare, Hyperdrive DB pooling
- **Per-request PrismaClient** — AsyncLocalStorage scoping, `getRequestClient()` for waitUntil
- **Rate limiting** — Sliding window on sensitive identity paths
- **Schema consolidated** — Single canonical `schema.prisma`, non-canonical deleted

### UI/UX (Cycles 3, 6-8)
- **VerificationGate** — Tier-aware modal (Tier 2/3/4 specific headers + flows)
- **TrustSignal** — Compact tier badge with upgrade affordance
- **VerificationChoice** — Removed (single-method mDL flow, no choice needed)
- **SubmissionStatus** — Polling-based delivery tracking with terminal state detection
- **Svelte 5 migration** — All auth components on callback props. ~15 non-auth components still on createEventDispatcher (UI modals, template browser, address collection)

### Staked Deliberation / Debates (Cycle 15)
- **Database models** — `Debate` + `DebateArgument` in Prisma, migrated to production DB
- **9 Svelte 5 components** — DebateSurface, ActiveDebatePanel, ArgumentCard, DebateMetrics, PropositionDisplay, StanceSelector, StakeVisualizer, DebateProofGenerator, DebateModal
- **6 API routes** — create, by-template, arguments (GET/POST), cosign, resolve, claim
- **State store** — `debateState.svelte.ts` (runes-based, factory pattern)
- **ZK integration** — `buildDebateActionDomain()` exported, DebateProofGenerator uses debate-scoped action domain
- **Modal integration** — DebateModal registered in ModalRegistry via UnifiedModal
- **Deep link route** — `/s/[slug]/debate/[debateId]` with template context from parent layout
- **Resolved debate display** — Resolution banner with stance colors, winner badge on ArgumentCard
- **Off-chain only** — All debate state in Prisma; on-chain integration pending DebateMarket.sol deployment
- **Gaps documented** — See [docs/features/debates.md](./features/debates.md) for known gaps and resolution plan

---

## What's NOT Production-Ready

> **Canonical priority tracker:** [`docs/architecture/REMAINING-GAPS.md` → Launch Readiness Matrix](./architecture/REMAINING-GAPS.md#launch-readiness-matrix)
> Items L-01 through L-20 with cross-repo ownership, status, and critical path diagram.

### Resolved (Cycles 1-15)

All P0 engineering gaps from Cycles 1-14 are resolved. Summary of what was fixed:

| Gap | Resolution | Cycle |
|-----|-----------|-------|
| libsodium on CF Workers | Replaced with @noble/curves + @noble/hashes + @noble/ciphers (pure JS) | 11C |
| Workers KV namespace | `DC_SESSION_KV` provisioned | 11C |
| CF build verification | cbor-web + libsodium-wrappers compatible | 10A |
| svelte-check errors | 0 errors, 88 warnings | 11A |
| COSE_Sign1 verification | Full RFC 9052 ECDSA P-256 via Web Crypto | 13A |
| IACA trust store structure | DER decode, AAMVA VICAL reference ready | 13A |
| Auth component Svelte 5 | mDL-only flow, self.xyz + Didit.me removed | 10B → 15 |
| Legacy single-tree code | ~1300 lines removed | 10C-10D |
| delivery-worker bugs | Template cast, ALS scope, status misclassification | 10C → 11B |
| OpenID4VP protocol | JWT/SD-JWT parsing + privacy boundary | 13C |
| Ed25519 credential signing | Replaces HMAC-SHA256 | 13B |
| Debate browse-view discovery | Amber "Deliberating" indicator on TemplateCard/TemplateList | 15 |

### Open (see Launch Readiness Matrix for full detail)

**P0 — Launch blockers:** TEE infrastructure (L-05), mainnet deploy (L-01/02), Shadow Atlas server (L-06), npm registry refs (L-07)

**P1 — Pre-production:** Apple Business Connect (L-08), engagement tier UI (L-09), debate on-chain settlement (L-10), debate auto-resolution (L-11), CampaignRegistry timelock review (L-12)

**P2 — Post-launch:** Modal unification (L-13), congressional dashboard (L-14), IPFS migration (L-15), ERC-8004 (L-16), debate co-sign UI + indexer (L-17), rate limiting (L-18), salt rotation (L-19), BA-017 (L-20)

---

## Cycle History

| Cycle | Focus | Waves | Key Outcome |
|-------|-------|-------|-------------|
| 1 | Cleanup + Foundation | 3 | Deprecated code removed, schema consolidated, trust_tier field established |
| 2 | Passkey Identity (Tier 1) | 3 | WebAuthn registration/auth, did:key derivation, client UI components |
| 3 | Address Attestation (Tier 2) | 3 | AddressVerificationFlow, district credential, TrustSignal, VerificationGate |
| 4 | ZK Proofs + Encryption (Tier 3) | 3 | Real Noir prover integration, XChaCha20-Poly1305, proof-verified delivery |
| 5 | Delivery Pipeline | 4 | Address flow fix, server-side decryption, CWC delivery worker, Opus review |
| 6 | UX Fixes | 4 | Status tracking, modal dead ends, dead code cleanup |
| 7 | Correctness | 4 | Nullifier fix (BR5-010), trust tier propagation, Svelte 5 event migration |
| 8 | Production Hardening | 4 | ALS safety, type safety, Svelte 5 migration, legacy gating |
| 9 | Government Credentials (Tier 4) | 4 | mDL via Digital Credentials API, privacy boundary, ephemeral keys, integration |
| 10 | Production Readiness | 4 | CF build fix, final Svelte 5 auth migration, ~1300 lines dead code removed, build verified |
| 11 | Type Safety + Submission Hardening | 4 | 0 svelte-check errors, 3 delivery-worker bugs fixed, libsodium→noble (pure JS), KV provisioned |
| 12 | Dead Code Purge + Broken Wiring | 4 | 3 broken event mismatches repaired, ~10,500 lines dead code deleted (50+ files), Svelte 5 migration complete (0 live dispatchers), SSR nested-button bugs fixed, warnings 95→88 |
| 13 | Cryptographic Verification Hardening | 4 | Real COSE_Sign1 ECDSA P-256 verification (RFC 9052), IACA trust store with DER decode, Ed25519 credential signing (replaces HMAC-SHA256), OpenID4VP JWT/SD-JWT support, 47 new tests |
| 14 | Security-Critical Test Coverage + Production Hygiene | 4 | 36 new tests covering authority level, pseudonymous ID, user secret derivation, witness encrypt→decrypt round-trip. Debug console floods removed, HACKATHON limits tightened (title 200, body 10k), demo pages dev-gated, empty catches fixed |
| 15 | Staked Deliberation + Identity Simplification | 4 | Debate infrastructure (9 components, 6 API routes, Prisma models, debate-scoped ZK proofs, DebateModal in ModalRegistry, deep link route, debate browse indicator). Identity simplified to mDL-only: self.xyz + Didit.me removed (8 files deleted, 16 files edited), VerificationChoice removed, single-path verification flow. |

**Full cycle details:** `docs/architecture/graduated-trust-implementation.md`

---

## Identity Verification: mDL-Only Architecture (Cycle 15 Decision)

**Date:** 2026-02-24
**Decision:** Remove self.xyz (NFC passport) and Didit.me (government ID + face verification) providers. Consolidate to mDL via W3C Digital Credentials API as the sole identity verification path.

### Rationale

1. **Privacy alignment.** mDL via Digital Credentials API is browser-native — no third-party SDK, no server-to-server webhooks, no vendor lock-in. Credential presentation happens between the user's wallet and their browser. The platform never sees raw credential data; only the privacy boundary output (district string) crosses the trust boundary.

2. **Selective disclosure.** ISO 18013-5 mdoc format allows requesting individual data elements (`age_over_18`, `resident_state`, `postal_code`) without revealing full credential. This is architecturally superior to passport NFC (which extracts full MRZ data) or photo ID verification (which transmits face images to a third party).

3. **Cypherpunk coherence.** Self.xyz required a proprietary mobile app and QR code scan flow. Didit.me required server-to-server webhook with HMAC validation and stored verification sessions. Both introduced third-party trust dependencies incompatible with the project's privacy-first architecture.

4. **Ecosystem convergence.** Chrome 141+ and Safari 26+ (both shipped September 2025) support the W3C Digital Credentials API natively. ~22 US states have mDL programs. Platform support will only grow.

### What Was Removed (8 files deleted, 16 files edited)

**Deleted:**
- `src/routes/api/identity/didit/` (init + webhook endpoints)
- `src/routes/api/identity/init/+server.ts` (self.xyz QR generation)
- `src/routes/api/identity/verify/+server.ts` (self.xyz proof verification)
- `src/lib/core/identity/didit-client.ts` (SDK wrapper)
- `src/lib/core/server/selfxyz-verifier.ts` (SDK singleton)
- `src/lib/components/auth/address-steps/SelfXyzVerification.svelte`
- `src/lib/components/auth/address-steps/DiditVerification.svelte`
- `src/lib/components/auth/address-steps/VerificationChoice.svelte`
- `DIDIT-IMPLEMENTATION-SUMMARY.md` (root-level summary doc)

**Edited:** IdentityVerificationFlow.svelte (simplified to single-path), verification-handler.ts, blob-encryption.ts, shadow-atlas-handler.ts, authority-level.ts, hooks.server.ts, session-credentials.ts, identity-binding.ts, package.json (@selfxyz deps removed), vite.config.ts, .env.example

**Dependencies removed:** `@selfxyz/core`, `@selfxyz/qrcode`

### Legacy Database Compatibility

Existing users with `verification_method = 'self.xyz'` or `verification_method = 'didit'` retain their verification status. The `deriveAuthorityLevel()` and `deriveTrustTier()` functions still recognize these values for backward compatibility. No database migration needed — the code simply no longer creates new records with these values.

### Remaining mDL Gaps (see REMAINING-GAPS.md)

1. **IACA root certificates** — **RESOLVED** (Cycle 41). DSC→IACA chain verification implemented (`verifyDscAgainstRoot()`). CA and NM roots loaded from .gov downloads. 37 tests including real CA cert self-signature verification and DSC validity period enforcement. Expansion to all states via AAMVA VICAL parser is follow-up.
2. **Poseidon2 identity commitment** — mDL path uses SHA-256² mod BN254 (Phase 1); Poseidon2 planned for Phase 2
3. **Selective disclosure expansion** — **RESOLVED**. `birth_date` + `document_number` in ItemsRequest, identity commitment computed in privacy boundary
4. **Shadow Atlas registration** — **RESOLVED** (Cycle 42). Census tract GEOID resolved via Census Bureau geocoding in privacy boundary. cellId threaded through client pipeline to `triggerShadowAtlasRegistration()`. Registration status UI with spinner/error/success.

---

## Architecture Quick Reference

| Layer | Key Files |
|-------|-----------|
| DB + ALS | `src/lib/core/db.ts` |
| Auth + Session | `src/hooks.server.ts` |
| Trust Tier | `src/lib/core/identity/authority-level.ts`, `credential-policy.ts` |
| Identity Verification | `src/lib/components/auth/IdentityVerificationFlow.svelte` |
| Address Verification | `src/lib/components/auth/AddressVerificationFlow.svelte` |
| mDL Verification | `src/lib/core/identity/mdl-verification.ts`, `digital-credentials-api.ts` |
| ZK Proofs | `src/lib/components/proof/ProofGenerator.svelte`, `prover-client.ts` |
| Encryption | `src/lib/core/identity/blob-encryption.ts`, `witness-decryption.ts` |
| Submission | `src/routes/api/submissions/create/+server.ts` |
| CWC Delivery | `src/lib/server/delivery-worker.ts` |
| Status Tracking | `src/routes/api/submissions/[id]/status/+server.ts` |
| CF Config | `wrangler.toml` |
| Schema | `prisma/schema.prisma` |

---

*Communique PBC | Implementation Status | 2026-02-25*
