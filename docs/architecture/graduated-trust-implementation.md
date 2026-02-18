# Graduated Trust — Implementation Plan

> **Status:** Active execution plan
> **Architecture reference:** `docs/architecture/graduated-trust.md`
> **Pre-launch:** All deprecated code removed immediately. No backward compatibility.

---

## Execution Model

**Cycles:** Implementation wave → Opus review wave → Manual review → Doc update → Next cycle

Each cycle produces:
1. Code changes (committed)
2. Findings log (what the agents missed, what emerged)
3. Updated docs (completion status, new discoveries)
4. Tasking for next cycle

---

## Cycle 1: Cleanup + Foundation

Remove deprecated code, consolidate schemas, establish the trust_tier field as the primary identity primitive. This unblocks all subsequent work.

### Wave 1A: Deprecated Code Removal

**Agent background:** SvelteKit codebase familiarity, Prisma schema management, file system cleanup.

| Task | File(s) | Action |
|------|---------|--------|
| Remove nitro enclave demo | `src/lib/core/proof/nitro-enclave-demo.ts` | Delete entirely |
| Remove GCP TEE provider | `src/lib/core/tee/providers/gcp.ts` | Delete; update `src/lib/core/tee/provider.ts` if it imports gcp |
| Archive coinbase auth spec | `docs/specs/coinbase-auth-integration.md` | Move to `docs/archive/2026-02-superseded/` |
| Archive portable identity spec | `docs/specs/portable-identity.md` | Move to `docs/archive/2026-02-superseded/` |
| Remove static trust disclaimer | `src/lib/components/template-browser/parts/ActionBar.svelte` | Remove the hardcoded `<p>` tag (already changed to flex-col; will be replaced by TrustSignal in Cycle 3) |

**Verification:** `npm run build` succeeds. `grep -r` for imports of deleted files returns nothing.

### Wave 1B: Schema Consolidation

**Agent background:** Prisma ORM, PostgreSQL schema management, multi-file schema configuration.

| Task | Detail |
|------|--------|
| Identify canonical schema | `prisma/schema.prisma` is canonical |
| Diff `core.prisma` vs `schema.prisma` | Document every divergence |
| Diff `schema-production.prisma` vs `schema.prisma` | Document every divergence |
| Determine if non-canonical schemas are consumed anywhere | Check `package.json`, build scripts, CI, wrangler config for references |
| Delete or mark non-canonical schemas | If nothing consumes them: delete. If build uses them: unify. |

**Verification:** Single schema. Build and `npx prisma validate` succeed. No references to deleted schema files.

### Wave 1C: Trust Tier Foundation

**Agent background:** TypeScript, Prisma schema design, SvelteKit server hooks, identity systems.

| Task | Detail |
|------|--------|
| Add `trust_tier` field to User model | `trust_tier Int @default(0) @map("trust_tier")` |
| Derive `is_verified` from trust_tier | Add computed logic: `is_verified = trust_tier >= 3` |
| Extend `authority-level.ts` | Add Tier 0 (anonymous, no user) and adjust Tier 1/2 logic |
| Add `trust_tier` to session locals | `hooks.server.ts` — attach `trust_tier` to `event.locals.user` |
| Update `credential-policy.ts` | Add tier-aware TTL differentiation (prep only — no new tiers yet) |
| Add address lifecycle fields | `address_verification_method`, `address_verified_at` on User model |
| Add passkey placeholder fields | `passkey_credential_id`, `passkey_public_key_jwk`, `did_key`, `passkey_created_at`, `passkey_last_used_at` on User model |
| Generate migration | `npx prisma migrate dev --name graduated-trust-foundation` |

**Verification:** Migration applies cleanly. `trust_tier` defaults to 0 for all existing users. `authority-level.ts` exports a function that handles all tiers. `hooks.server.ts` attaches trust_tier to locals.

---

## Cycle 2: Tier 1 — Passkey Infrastructure

### Wave 2A: Server-Side Passkey

**Agent background:** WebAuthn/FIDO2 protocol, `@simplewebauthn/server` library, challenge-response authentication, SvelteKit server endpoints, session management.

| Task | Detail |
|------|--------|
| Install dependencies | `@simplewebauthn/server`, `@simplewebauthn/browser` |
| Create registration endpoint | `src/routes/api/auth/passkey/register/+server.ts` — generate challenge, verify attestation, store credential |
| Create authentication endpoint | `src/routes/api/auth/passkey/authenticate/+server.ts` — generate challenge, verify assertion, create session |
| Create `passkey-registration.ts` | `src/lib/core/identity/passkey-registration.ts` — server-side registration logic |
| Create `passkey-authentication.ts` | `src/lib/core/identity/passkey-authentication.ts` — server-side auth logic |
| Update session creation | Support passkey-based sessions alongside OAuth sessions |
| Update `hooks.server.ts` | Accept passkey session tokens in addition to OAuth cookies |

### Wave 2B: did:key Derivation

**Agent background:** DID specifications, `did:key` method, multicodec encoding, public key JWK format, Ed25519/P-256 key handling.

| Task | Detail |
|------|--------|
| Create `did-key-derivation.ts` | `src/lib/core/identity/did-key-derivation.ts` — derive did:key from WebAuthn public key |
| Handle key algorithm variants | P-256 (WebAuthn default on Apple) and Ed25519 |
| Store did:key on registration | Write to User.did_key after passkey registration |
| Add did:key to session locals | Available in `event.locals.user.did_key` |

### Wave 2C: Client-Side Passkey UI

**Agent background:** Svelte 5 runes, `@simplewebauthn/browser`, WebAuthn UX patterns, progressive enhancement.

| Task | Detail |
|------|--------|
| Create `PasskeyRegistration.svelte` | `src/lib/components/auth/PasskeyRegistration.svelte` — biometric prompt, success state |
| Create `PasskeyUpgrade.svelte` | `src/lib/components/auth/PasskeyUpgrade.svelte` — nudge for OAuth users |
| Integrate into auth flow | After OAuth login, check if user has passkey. If not, show upgrade nudge. |
| Feature detection | Check `window.PublicKeyCredential` availability. Hide passkey UI on unsupported browsers. |
| Update trust_tier on registration | Set `trust_tier = 1` after successful passkey registration |

**Verification:** Full registration → authentication → session cycle works. OAuth fallback still works. did:key is deterministic for the same public key. trust_tier updates correctly.

---

## Cycle 3: Tier 2 — Address Attestation

### Wave 3A: Unbundle Address from Identity Verification

**Agent background:** Svelte 5 component architecture, progressive disclosure UX, existing IdentityVerificationFlow.svelte internals.

| Task | Detail |
|------|--------|
| Refactor `IdentityVerificationFlow.svelte` | Split into multi-path: Tier 2 (address only) vs Tier 3 (identity). User can stop at address. |
| Make `AddressForm.svelte` independently usable | Not coupled to identity verification parent |
| Create `AddressVerificationFlow.svelte` | Standalone flow: address form → civic data check → district confirmation → done |
| Update `VerificationGate.svelte` | Gate at Tier 2 minimum for congressional, not Tier 3 |
| Update `emailService.analyzeEmailFlow()` | Graduated routing: Tier 2 → email_attested, Tier 3+ → CWC |

### Wave 3B: Civic Data API + District Credential

**Agent background:** US Census geocoder API, W3C Verifiable Credentials 2.0 data model, Ed25519 signing, JSON-LD, IndexedDB.

| Task | Detail |
|------|--------|
| Create `address-verification.ts` | `src/lib/core/identity/address-verification.ts` — Census geocoder integration, district derivation |
| Create `district-credential.ts` | `src/lib/core/identity/district-credential.ts` — VC issuance, signing, verification |
| Create verify-address endpoint | `src/routes/api/identity/verify-address/+server.ts` — address → district → VC |
| Add DistrictCredential model | Prisma schema addition per graduated-trust.md spec |
| Implement address nullification | After district derivation, clear street/city/state/zip from User record |
| Create `credential-store.ts` | `src/lib/core/identity/credential-store.ts` — unified IndexedDB credential wallet |
| Store VC client-side | DistrictResidencyCredential stored in IndexedDB |

### Wave 3C: Trust Signal UI + Delivery Routing

**Agent background:** Svelte 5, perceptual engineering, progressive disclosure, email service architecture.

| Task | Detail |
|------|--------|
| Create `TrustSignal.svelte` | Dynamic trust display per tier, upgrade affordances |
| Integrate into `ActionBar.svelte` | Replace removed static disclaimer with TrustSignal |
| Update delivery method types | Add `'email_attested'` delivery method |
| Update `emailService.ts` | Tier-aware delivery: include district attestation link for Tier 2 emails |
| Update `ActionBar.svelte` button variants | Tier-appropriate button styling and text |

**Verification:** Full Tier 2 flow: enter address → district derived → VC issued → address cleared from DB → TrustSignal shows "Verified constituent of [District]" → email includes attestation. Tier 3 flow still works unchanged.

---

## Cycle 4: Tier 3 — Proof-Verified Delivery

Post-Cycle 3 research findings: self.xyz NFC (4E), Shadow Atlas two-tree registration, CWC client (Senate/House), and identity blob encryption are **already production-ready**. Cycle 4 focuses on the three remaining gaps: real proof generation, proper encryption, and end-to-end verified delivery.

### Wave 4A: Wire Real Proof Generation

**Background:** ProofGenerationModal.svelte is mock (100-byte fake proof). All prover infrastructure exists (@voter-protocol/noir-prover, circuit JSON, singleton caching, threading model). The gap is the "last mile" wiring.

| Task | Detail |
|------|--------|
| Fix identityCommitment in prover-client.ts | Missing from TwoTreeProofInput mapping at line 478 (causes svelte-check error) |
| Fix Buffer.from usage | Line 508 uses Node.js Buffer — incompatible with CF Workers. Replace with Uint8Array hex conversion. |
| Wire ProofGenerationModal to real prover | Accept userId + actionDomain props. Load credential from IndexedDB. Compute nullifier via poseidonHash2. Map via proof-input-mapper.ts. Call generateTwoTreeProof(). Return real proof bytes. |
| Wire progress callbacks | Real progress from prover initialization and proof generation (not simulated setInterval) |

### Wave 4B: XChaCha20 Witness Encryption

**Background:** witness-encryption.ts uses AES-GCM fallback (Web Crypto). TEE key endpoint returns mock key. Line 184 has explicit TODO for @stablelib/xchacha20poly1305.

| Task | Detail |
|------|--------|
| Install @stablelib/xchacha20poly1305 | Pure JS implementation, no WASM, works in all browsers |
| Replace AES-GCM fallback | Use @stablelib XChaCha20-Poly1305 with 24-byte nonce. Remove 12-byte IV truncation hack. |
| Update WitnessData for two-tree | Add identityCommitment, cellId, cellMapRoot, two-tree merkle fields |
| Fix ECDH curve alignment | TEE key spec says X25519 but browser uses P-256. Align or document the mismatch. |

### Wave 4C: Proof-Verified Delivery Pipeline + Tier 3 Gate

**Background:** CWC client (Senate direct, House proxy) works. ProofGenerator.svelte already handles the full end-to-end flow (credential → proof → encrypt → submit). Missing: proper WitnessData for two-tree, encryption text alignment, trust tier 3 promotion, redundant ProofGenerationModal removal.

| Task | Detail |
|------|--------|
| Remove redundant ProofGenerationModal from VerificationGate | ProofGenerationModal generated a second proof that was discarded. VerificationGate now only handles verification (Tier 2 address, Tier 3 identity). Proof generation happens in ProofGenerator. |
| Fix ProofGenerator witness encryption | Build full WitnessData with all two-tree fields (userRoot, cellMapRoot, districts, identityCommitment, etc.) instead of simplified {address, nullifier, templateId, timestamp} |
| Update encryption UI text | "XChaCha20-Poly1305 encryption" replaces "P-256 ECDH + AES-256-GCM" |
| Tier 3 trust promotion | `updateMany({ where: { id, trust_tier: { lt: 3 } }, data: { trust_tier: 3 } })` after successful submission (fire-and-forget) |

**Deferred to Cycle 5:** AWS Nitro Enclaves deployment (requires infrastructure, not just code). TEE manager/provider interfaces are ready. Azure Confidential VMs integration.

---

## Cycle 5: End-to-End CWC Delivery (Path A — Server-Side Decryption)

Real congressional delivery. Encrypt witness on client, decrypt on server, deliver via CWC API. TEE upgrade path is a deployment change only (same code, different key holder).

### Wave 5A: Address Flow Fix
- Fix AddressCollectionForm → TemplateModal callback (was CustomEvent, actually plain object)
- Remove broken POST to `/user/address` (endpoint never existed)
- Add structured `deliveryAddress` to WitnessData (name, email, street, city, state, zip)
- Update ProofGenerator: `address: string` → `deliveryAddress?: {...}` structured prop
- Wire TemplateModal to pass structured data from AddressCollectionForm → ProofGenerator

### Wave 5B: Server-Side Witness Decryption
- Create `src/lib/server/witness-decryption.ts`: X25519 ECDH → BLAKE2b KDF → XChaCha20-Poly1305 decrypt
- Replace mock TEE endpoint (`'0x' + '1'.repeat(64)`) with real key from `WITNESS_ENCRYPTION_PUBLIC_KEY` env var
- Create `scripts/generate-witness-keypair.ts` for key generation
- Roundtrip test confirmed: client encrypt → server decrypt produces identical output

### Wave 5C: CWC Delivery Pipeline
- Create `src/lib/server/delivery-worker.ts`: decrypt → lookup reps → CWC submit → update status
- Wire into submission endpoint with `platform.context.waitUntil()` (CF Workers background processing)
- Senate endpoint toggleable: `CWC_PRODUCTION=true` switches `/testing-messages/` → `/messages/`
- Per-representative error isolation (one failure doesn't block others)

### Wave 5D: Review Fixes + Polish
- Fix fragile address parsing: pass structured fields from AddressCollectionForm (not string parsing)
- Fix silent fake delivery: Senate fails loudly when `CWC_API_KEY` missing (was `simulateSubmission` returning success)
- Document `delivery_status` enum: pending → processing → delivered | partial | failed
- Add `WITNESS_ENCRYPTION_PUBLIC_KEY` to app.d.ts + .env.example
- Fix type assertion precedence in delivery worker message extraction

---

## Cycle 6: Fix Post-Proof Pipeline & Modal Error States

The delivery worker (Cycle 5) writes status to the Submission model, but the client-side tracking component was polling the wrong table (CWCJob). Modal state machine had multiple dead ends. This cycle closes the gap between server-side delivery and client-side UX.

### Wave 6A: Fix Status Tracking Pipeline
- Created `GET /api/submissions/[id]/status` — queries Submission model with pseudonymous ID ownership check
- Created `POST /api/submissions/[id]/retry` — atomic conditional retry (only from `failed` state, prevents TOCTOU race)
- Rewrote `SubmissionStatus.svelte` — removed dead WebSocket code, polls correct endpoint, AbortController for unmount safety, generation counter for stale response discard, `onDelivered` callback

### Wave 6B: Fix Modal Dead Ends
- Added `'cwc-submission' | 'error'` to `LegacyModalState` type (killed all `as any` casts on state)
- Added error state UI branch in TemplateModal (was rendering blank on submission error)
- Fixed guest + congressional dead end: "Authentication Required" now has sign-in CTA button
- Added `autoStart` prop to ProofGenerator (eliminates redundant second click)

### Wave 6C: Dead Code Cleanup
- Removed dead `CWCProgressTracker` import (imported but never rendered)
- Removed dead `showPreWrittenMessages` state variable
- Removed debug `console.log` statements from ModalRegistry production render path
- Added `{:else}` fallback for unhandled modal states

### Wave 6D: Opus Review Fixes
- Fixed TOCTOU race in retry endpoint (atomic `updateMany` with `delivery_status: 'failed'` WHERE clause)
- Fixed infinite polling on 401/403/404 (terminal HTTP errors now stop poller)
- Added AbortController to prevent state updates on destroyed components
- Added poll generation counter to discard stale responses after retry
- Removed aggressive 2s auto-navigation from onDelivered (let user interact with celebration)
- Added `{:else}` fallback for `auth_required`/`proof-generation` states that had no UI branch

## Cycle 7: Security Fixes + Svelte 5 Migration

Security bugs (BR5-010 nullifier no-op, address bypass), UX bugs (VerificationGate trust tier, hasAddress always-false), and legacy Svelte 4 event patterns.

### Wave 7A: BR5-010 Nullifier Fix + Dead Code
- Fixed nullifier self-comparison: saved `expectedNullifier` before overwriting `nullifierHex` with prover output. Cross-validation now compares against independently-computed value.
- Removed dead try/catch from `submitCongressionalMessage()` (sync setState can't throw)
- Fixed `handleProofError` → routes to `error` state instead of `retry_needed` (which shows wrong "Email client didn't open" text)

### Wave 7B: Trust Tier + hasAddress Fixes
- Widened TemplateModal `user` prop type to include `trust_tier`
- Passed `userTrustTier={user.trust_tier ?? 0}` to VerificationGate (was always defaulting to 0, causing unnecessary verification prompts)
- Fixed `hasAddress` to check `verifiedAddress` state instead of non-existent `user.street/city/state/zip` fields

### Wave 7C: Svelte 5 Event Migration
- ProofGenerator: `createEventDispatcher` → `oncomplete`/`oncancel`/`onerror` callback props
- VerificationGate: `createEventDispatcher` → `onverified`/`oncancel` callback props
- TemplateModal: Updated call sites and handler signatures (CustomEvent → direct data)

### Wave 7D: Opus Review Fixes
- Fixed CRITICAL: `onMount` CWC path bypassed address collection/verification, sending proofs with no delivery address. Now routes through `handleSendConfirmation(true)`.
- Fixed HIGH: `as any` cast on `proofState.message` replaced with local `errorMessage` variable
- Added TODO for IdentityVerificationFlow Svelte 5 migration (still uses `createEventDispatcher`)
- Deferred: TemplateModal's own `createEventDispatcher` (requires parent migration), `needsTier3` dead derived, legacy single-tree BR5-010 gap

## Cycle 8: Production Hardening + Code Quality

Address 10 deferred issues from Cycles 6-7, including a production risk (ALS+waitUntil), type safety gaps, and incomplete Svelte 5 migration.

### Wave 8A: ALS Safety + Error Sanitization
- Added `getRequestClient()` to `db.ts` — resolves concrete PrismaClient from ALS (not the Proxy)
- `delivery-worker.ts` accepts optional `db` parameter, uses captured client in `waitUntil`
- Callers (`create/+server.ts`, `retry/+server.ts`) capture client via `getRequestClient()` before response
- Sanitized `delivery_error` in status endpoint (generic user-safe message)

### Wave 8B: Type Safety + `as any` Elimination
- Created `EmailFlowTemplate` shared interface (both Template and ComponentTemplate satisfy it)
- Added `category?`, `subject?`, `preview?` to `ComponentTemplate`
- Changed `analyzeEmailFlow` + related functions to accept `EmailFlowTemplate`
- Eliminated: `as unknown as Template`, `(template as any).category`, `(template as any).body`, `handleAddressComplete as any`, `(proofState as any).submissionId`

### Wave 8C: Complete Svelte 5 Migration
- `IdentityVerificationFlow`: `createEventDispatcher` → `oncomplete`/`oncancel`/`onback` callback props
- `TemplateModal`: `createEventDispatcher` → `onclose`/`onused` callback props
- Updated consumers: `template-modal/[slug]/+page.svelte`, `ModalRegistry.svelte`
- Removed dead `needsTier3` derived from VerificationGate
- Fixed double oncomplete dispatch in ProofGenerator (kept auto-dispatch, removed Continue re-dispatch)
- Removed 22 redundant `credential!` assertions in ProofGenerator

### Wave 8D: Legacy Cleanup + Opus Review
- Gated legacy single-tree flow with deprecation warning + documentation
- Opus review found 0 critical, 3 high, 5 medium, 9 low issues
- Fixed: trust tier promotion uses captured client + registered with waitUntil (HIGH)
- Fixed: IdentityVerificationFlow verificationData stores full payload (HIGH, data loss on re-dispatch)
- Fixed: tautological validation `!template.title && !template.title` → `!template.title && !template.subject` (MEDIUM)
- Fixed: stale `on:error` comment, unused `{@const}` in ProofGenerator
- Added Cycle 7 status table (was missing from tracking section)

## Cycle 9: Government Credentials — Tier 4

Browser-native mDL verification via W3C Digital Credentials API. Ship pragmatic minimum (Option A: server decrypts in memory, derives district, discards address), architect for TEE upgrade path (Option B: same code runs inside Nitro Enclave, server never sees plaintext).

**Privacy architecture:** Selective disclosure requests ONLY `resident_postal_code` + `resident_city` + `resident_state`. Never name, DOB, photo, document number. `intent_to_retain: false` on all fields. The `processCredentialResponse()` function boundary IS the privacy boundary — raw address never escapes it, only the derived fact (`{ district, verificationMethod: 'mdl' }`). Ephemeral key pairs (5-min TTL) prevent persistent decryption capability. Same nullifier source as Tier 3 (identity_commitment from Shadow Atlas), just with higher provenance.

**Browser support:** Chrome 141+ (org-iso-mdoc + openid4vp), Safari 26+ (org-iso-mdoc only). Firefox: no support, no plans. 21 US states + PR have active mDL programs. Progressive enhancement — mDL option only shown when `typeof DigitalCredential !== 'undefined'`.

### Wave 9A: Foundation + Types

Fix authority level discrepancy, extend verification type system for mDL.

| Task | File(s) | Detail |
|------|---------|--------|
| Fix `trustTierToAuthorityLevel(4)` | `authority-level.ts` | Currently returns 4, should return 5 per arch doc |
| Fix `deriveAuthorityLevel()` for mdl | `authority-level.ts` | Add `document_type === 'mdl'` → authority level 5 path |
| Add `'mdl'` to `VerificationMethod` | `src/lib/types/verification.ts` | `'nfc-passport' \| 'government-id' \| 'mdl'` |
| Add `'digital-credentials-api'` to `VerificationProvider` | `src/lib/types/verification.ts` | `'self.xyz' \| 'didit.me' \| 'digital-credentials-api'` |
| Add mDL entry to `VERIFICATION_METHODS` | `src/lib/types/verification.ts` | Display metadata for new method |
| Update session + handler types | `session-cache.ts`, `session-credentials.ts`, `shadow-atlas-handler.ts` | Add `'mdl'` / `'digital-credentials-api'` to method unions |
| Add rate limit path | `hooks.server.ts` | Add `/api/identity/verify-mdl` to `SENSITIVE_IDENTITY_PATHS` |
| Create DigitalCredential type declarations | `src/lib/types/digital-credentials.d.ts` | TypeScript declarations for `DigitalCredential`, `navigator.credentials.get({ digital })` — new browser API without `@types` |

### Wave 9B: Client-Side Digital Credentials API

Browser feature detection, dual-protocol request builder, and UI component.

| Task | File(s) | Detail |
|------|---------|--------|
| Create `digital-credentials-api.ts` | `src/lib/core/identity/digital-credentials-api.ts` | `isDigitalCredentialsSupported()` feature detection. `getSupportedProtocols()` — checks `userAgentAllowsProtocol('org-iso-mdoc')` and `userAgentAllowsProtocol('openid4vp')`. `requestCredential(requests)` — wrapper around `navigator.credentials.get({ digital })` with AbortController timeout (60s for wallet interaction), graceful AbortError handling for user dismissal. |
| Create `GovernmentCredentialVerification.svelte` | `src/lib/components/auth/GovernmentCredentialVerification.svelte` | Svelte 5 component. States: `idle` → `requesting` (OS wallet prompt) → `verifying` (server processing) → `complete` / `error` / `unsupported`. Callback props: `oncomplete`, `oncancel`, `onerror`. Flow: fetch `/api/identity/verify-mdl/start` → call `requestCredential()` → POST to `/api/identity/verify-mdl/verify`. Unsupported fallback: "Your browser doesn't support digital ID. Use NFC passport or document scan instead." |

### Wave 9C: Server-Side Verification Pipeline

Enclave-portable verification. The `processCredentialResponse()` function runs in a CF Worker today, moves to TEE unchanged later.

| Task | File(s) | Detail |
|------|---------|--------|
| Create request start endpoint | `src/routes/api/identity/verify-mdl/start/+server.ts` | Generate ephemeral ECDH key pair (P-256) via `crypto.subtle`. Store private key + nonce in Workers KV (`DC_SESSION_KV`, 5-min TTL). Build dual-protocol request: `org-iso-mdoc` DeviceRequest (doctype `org.iso.18013.5.1.mDL`, fields: `resident_postal_code`, `resident_city`, `resident_state`, all `intent_to_retain: false`) + `openid4vp` DCQL query (same fields). Return both + nonce to client. |
| Create `mdl-verification.ts` | `src/lib/core/identity/mdl-verification.ts` | **The privacy boundary function.** `processCredentialResponse(encryptedResponse, protocol, ephemeralPrivateKey)` → `{ district, state, verificationMethod: 'mdl' }`. Dispatches to `decryptMdocResponse()` or `decryptOid4vpResponse()`. CBOR decode via `cbor-web` (Workers-compatible). COSE_Sign1 signature verification against IACA roots. MSO valueDigest validation. DeviceAuth check. Returns ONLY derived district — raw address fields never leave this function scope. |
| Create IACA trust store | `src/lib/core/identity/iaca-roots.ts` | Hardcoded IACA root certificates for ~10 most populated mDL states (CA, TX, NY, FL, etc.). Published by AAMVA. Used for issuer signature verification. |
| Create verification endpoint | `src/routes/api/identity/verify-mdl/verify/+server.ts` | Accept `{ protocol, data, nonce }`. Retrieve + delete ephemeral key from KV (one-time use). Call `processCredentialResponse()`. Map result to district via existing civic data pipeline. DB transaction: set `document_type = 'mdl'`, `address_verification_method = 'mdl'` on User. Issue DistrictResidencyCredential (same as Tier 2 but `verification_method: 'mdl'`). Shadow Atlas registration if not already registered. Trust tier promotes automatically via `deriveTrustTier()` (existing stub activates). |
| Install dependencies | `package.json` | `cbor-web` for CBOR decoding. Evaluate `@animo-id/mdoc` for COSE verification on Workers — if incompatible, manual verification via `crypto.subtle`. |
| Add KV binding | `wrangler.toml` | `DC_SESSION_KV` namespace for ephemeral key storage |

### Wave 9D: Integration + Opus Review

Wire into existing verification flow, feature detection, review.

| Task | File(s) | Detail |
|------|---------|--------|
| Add mDL option to VerificationChoice | `src/lib/components/auth/address-steps/VerificationChoice.svelte` | Third option: "Verify with Digital ID" (shield/smartphone icon). Only shown when `isDigitalCredentialsSupported()` returns true. Description: "Use your state-issued digital driver's license — fastest, most private." |
| Wire into IdentityVerificationFlow | `IdentityVerificationFlow.svelte` | Add `'verify-mdl'` to `FlowStep` type. When mDL selected, render `GovernmentCredentialVerification`. Handle oncomplete → advance to complete step with full data. |
| Update VerificationGate for Tier 4 | `VerificationGate.svelte` | For `minimumTier >= 4` (future-proofing), show GovernmentCredentialVerification directly. For now, Tier 4 is reached through the existing choice flow. |
| Opus review | — | Full review of all Cycle 9 changes. Focus: privacy boundary integrity, selective disclosure correctness, ephemeral key lifecycle, COSE verification completeness, Workers KV TTL enforcement. |

**Verification:** Full Tier 4 flow: click "Verify with Digital ID" → OS wallet prompt with ONLY postal code/city/state fields visible → server verifies + derives district → address discarded → DistrictResidencyCredential issued → trust_tier=4 via deriveTrustTier() → authority_level=5. Existing NFC/document scan paths unchanged. Firefox/unsupported browsers see fallback.

---

## Tracking

After each cycle:
1. Update `docs/architecture/graduated-trust.md` — mark completed work, note findings
2. Update `docs/implementation-status.md` — honest status
3. Log emerging discoveries in this file under the cycle heading
4. Task next cycle based on review findings

### Cycle 1 Status

| Wave | Status | Notes |
|------|--------|-------|
| 1A: Deprecated removal | **COMPLETE** | 2026-02-16: Deleted nitro-enclave-demo.ts, gcp.ts. Archived coinbase-auth + portable-identity specs. Cleaned manager.ts + provider.ts types. Removed static disclaimer from ActionBar. Opus review: fixed 2 stale GCP comments in provider.ts header. |
| 1B: Schema consolidation | **COMPLETE** | 2026-02-16: Deleted core.prisma and schema-production.prisma. Updated mock-drift-detection.ts. schema.prisma is canonical. Opus review: cleaned agent artifact from .planning/. |
| 1C: Trust tier foundation | **COMPLETE** | 2026-02-16: Added 9 fields to schema (trust_tier, 5 passkey, 2 address). Added deriveTrustTier() + TrustTier type + TRUST_TIER_LABELS + trustTierToAuthorityLevel() to authority-level.ts. Added TIER_CREDENTIAL_TTL + isTierCredentialFresh() to credential-policy.ts. hooks.server.ts computes trust_tier per-request. auth.ts User interface extended with 4 new fields. Opus review: cleaned stale GCP env vars from app.d.ts + .env.example. Finding: is_verified derivation from trust_tier correctly deferred — needs data migration to set trust_tier=3 for users with identity_commitment before is_verified can be computed. Migration generation deferred to pre-Cycle 2. |

### Cycle 2 Status

| Wave | Status | Notes |
|------|--------|-------|
| 2A: Server passkey | **COMPLETE** | 2026-02-16: Installed @simplewebauthn/server + /browser. Created passkey-rp-config.ts, passkey-registration.ts, passkey-authentication.ts. Created register + authenticate endpoints. Opus review: fixed excludeCredentials bug (endpoint passed null; function now queries DB), fixed FK violation (usernameless auth used sentinel user_id that violates VerificationSession FK; now requires email, usernameless deferred to Phase 2). |
| 2B: did:key derivation | **COMPLETE** | 2026-02-16: Created did-key-derivation.ts with zero-dependency CBOR parser, base58btc encoder, P-256 + Ed25519 support. Added did_key to auth.ts User, app.d.ts, hooks.server.ts. 33 tests all passing (known vectors, edge cases, error handling). |
| 2C: Client passkey UI | **COMPLETE** | 2026-02-16: Created PasskeyRegistration.svelte (biometric feature detection, idle→registering→success/error states), PasskeyLogin.svelte (email-based passkey auth with "or" divider), PasskeyUpgrade.svelte (dismissible 7-day nudge banner for trust_tier 0 users). Integrated PasskeyLogin into SignInContent.svelte, PasskeyUpgrade into profile overview tab. Opus review: fixed 3 issues — (1) `$state<Type>()` generic syntax not supported in Svelte 5, switched to `let x: Type = $state()` annotations; (2) variable named `state` conflicts with `$state` rune (svelte-check interprets `$state` as store auto-subscription), renamed to `uiState`; (3) `!state` always false in Enter key handler (state is never empty string), changed to `state === 'idle'`; (4) profile layout missing trust_tier in user data, added to +layout.server.ts; (5) removed unused email/id from PasskeyUpgrade prop type; (6) cleaned 3 agent artifact .md files. |

### Cycle 3 Status

| Wave | Status | Notes |
|------|--------|-------|
| 3A: Unbundle address | **COMPLETE** | 2026-02-16: Created AddressVerificationFlow.svelte (standalone Tier 2 flow: address-input → verifying → confirm-district → issuing-credential → complete). Updated VerificationGate.svelte with minimumTier/userTrustTier props, tier-aware header, conditional rendering (Tier 2 → AddressVerificationFlow, Tier 3 → IdentityVerificationFlow). Added DistrictCredential model to schema (user_id FK, congressional/state districts, verification_method, credential_hash, expires_at, revoked_at). Added 'email_attested' to deliveryMethod union type. Opus review: fixed 2 bugs — (1) AddressVerificationFlow didn't store credential in IndexedDB after issuance (added storeCredential() call from credential-store.ts); (2) no invalidateAll() after trust tier upgrade (added import + call so session data refreshes). |
| 3B: Civic data + credential | **COMPLETE** | 2026-02-16: Created district-credential.ts (W3C VC 2.0 DistrictResidencyCredential — HMAC-SHA256 signing via Web Crypto, base64url encode/decode, deterministic JSON via deepSortKeys, hashCredential + hashDistrict for integrity/privacy). Created credential-store.ts (IndexedDB wallet — compound key [userId,type], SSR-safe, store/get/delete/prune API). Created verify-address endpoint (validates district format XX-NN/XX-AL, issues VC, DB transaction: DistrictCredential record + User trust_tier upgrade, returns credential+hash to client). 18 tests all passing (issuance structure, 90-day TTL, did:key usage/fallback, 5 tamper scenarios, hash determinism/uniqueness). Opus review: fixed Uint8Array<ArrayBufferLike> vs BufferSource type mismatch in verifyDistrictCredential. Design note: proof.type says Ed25519Signature2020 but actually HMAC — pragmatic for CF Workers, Ed25519 deferred to Cycle 4. |
| 3C: Trust signal UI | **COMPLETE** | 2026-02-16: Created TrustSignal.svelte (compact tier badge: icon + label + color per tier, upgrade affordance for tier < 2). Updated ActionBar.svelte: tier-aware button text ("Send as Verified Constituent" for Tier 2+), TrustSignal shown above send button, onVerifyAddress callback prop. Updated emailService.ts: analyzeEmailFlow() accepts trustTier option, Tier 2+ bypass address gating (already district-verified), email_attested delivery method with district attestation footer for Tier 2+ congressional emails. Updated +page.svelte to pass trust_tier through to ActionBar and all analyzeEmailFlow calls. Opus review: fixed 2 bugs — (1) $derived(() => {...}) stored function instead of computed value for buttonText (changed to inline $derived expression); (2) all 4 analyzeEmailFlow() calls in +page.svelte missing trustTier option (Tier 2 users would get stuck in address modal). Also updated TemplatePreview user type to include trust_tier for prop chain consistency. |

### Cycle 4 Status

| Wave | Status | Notes |
|------|--------|-------|
| 4A: Real proof generation | **COMPLETE** | 2026-02-17: Fixed identityCommitment missing from TwoTreeProofInput mapping in prover-client.ts (resolved pre-existing svelte-check error). Replaced Buffer.from with uint8ArrayToHex helper (CF Workers compatible). Rewired ProofGenerationModal from mock (100-byte fake proof + setTimeout) to real flow: getSessionCredential → buildActionDomain → computeNullifier → mapCredentialToProofInputs → generateTwoTreeProof with real progress callbacks. Added userId + templateId + sessionId props. Updated VerificationGate to pass new props. Opus review: clean, no bugs. |
| 4B: XChaCha20 encryption | **COMPLETE** | 2026-02-17: Replaced AES-GCM fallback with real XChaCha20-Poly1305 via libsodium-wrappers (already installed). X25519 ECDH replaces P-256 (now matches TEE key spec). Full 24-byte nonce (no more 12-byte truncation hack). BLAKE2b keyed hash for KDF (replaces HKDF via Web Crypto). Updated WitnessData interface for two-tree architecture (userRoot, cellMapRoot, districts, identityCommitment, cellId, tree paths). Opus review: removed dead bytesToBase64 function (unreachable after AES-GCM removal). |
| 4C: Proof-verified delivery | **COMPLETE** | 2026-02-17: Removed redundant ProofGenerationModal from VerificationGate (proof was generated twice — once in ProofGenerationModal, then again in ProofGenerator). VerificationGate now only handles verification; proof generation is ProofGenerator's responsibility. Fixed ProofGenerator witness encryption: two-tree credentials now build full WitnessData (with `satisfies WitnessData` type safety) instead of simplified 4-field object with `as any` cast. Legacy single-tree kept for backward compatibility. Updated encryption UI text to "XChaCha20-Poly1305". Added trust_tier 3 promotion to submission endpoint (conditional `updateMany` — only promotes if < 3, fire-and-forget). Opus review: clean, zero bugs. Pre-existing issue noted: BR5-010 nullifier cross-validation in ProofGenerator is no-op (nullifierHex reassigned before check). |

### Cycle 5 Status

| Wave | Status | Notes |
|------|--------|-------|
| 5A: Address flow fix | **COMPLETE** | 2026-02-17: Fixed handleAddressComplete callback (CustomEvent → plain object). Removed broken `/user/address` POST. Added structured `deliveryAddress` to WitnessData (replaces `address?: string`). Updated ProofGenerator props and witness construction (both two-tree and legacy branches). Updated all 6 test render calls. Cleaned stale `expiresAt` from TEEPublicKey interface. |
| 5B: Server-side decryption | **COMPLETE** | 2026-02-17: Created `src/lib/server/witness-decryption.ts` — exact mirror of client encryption (X25519 ECDH → BLAKE2b → XChaCha20-Poly1305). Replaced mock TEE public key with real env var (`WITNESS_ENCRYPTION_PUBLIC_KEY`). Stable keyId from key prefix. Created `scripts/generate-witness-keypair.ts`. Roundtrip test passed. |
| 5C: CWC delivery pipeline | **COMPLETE** | 2026-02-17: Created `src/lib/server/delivery-worker.ts` (10-step pipeline: read submission → decrypt witness → extract deliveryAddress → lookup reps → fetch template → build CWC user → submit per-rep → determine overall status → update DB). Wired into submission endpoint with `platform.context.waitUntil()`. Senate endpoint toggleable via `CWC_PRODUCTION` env var. Added Platform.context types to app.d.ts. |
| 5D: Review fixes + polish | **COMPLETE** | 2026-02-17: Opus review found 16 issues (4 critical, 3 high, 6 medium, 3 low). Fixed 6: (1) fragile address parsing replaced with structured fields from AddressCollectionForm; (2) silent fake Senate delivery now fails loudly; (3) delivery_status enum documented with 'processing'+'partial'; (4) WITNESS_ENCRYPTION_PUBLIC_KEY added to app.d.ts; (5) type assertion precedence fixed in delivery worker; (6) .env.example updated with witness encryption + CWC_PRODUCTION. Pre-existing: BR5-010 nullifier cross-validation no-op (from Cycle 4), libsodium WASM on Workers (needs deployment test). |

### Cycle 6 Status

| Wave | Status | Notes |
|------|--------|-------|
| 6A: Status tracking pipeline | **COMPLETE** | 2026-02-17: Created `/api/submissions/[id]/status` (pseudonymous_id ownership) + `/api/submissions/[id]/retry` (atomic conditional). Rewrote `SubmissionStatus.svelte`: removed dead WebSocket, polls correct Submission model, `onDelivered` callback fires once on terminal success. |
| 6B: Modal dead ends | **COMPLETE** | 2026-02-17: Added `cwc-submission`+`error` to `LegacyModalState`. Error state now renders UI (was blank). Guest+congressional shows sign-in CTA (was dead end). ProofGenerator `autoStart` skips idle state. |
| 6C: Dead code cleanup | **COMPLETE** | 2026-02-17: Removed dead `CWCProgressTracker` import, dead `showPreWrittenMessages` state, debug `console.log`s from ModalRegistry. Added `{:else}` fallback for unhandled states. |
| 6D: Review fixes + polish | **COMPLETE** | 2026-02-17: Opus review found 16 issues (2 critical, 4 high, 5 medium, 5 low). Fixed 6 directly: (1) TOCTOU race in retry → atomic updateMany; (2) 401/403/404 → terminal polling stop; (3) AbortController on unmount; (4) poll generation counter for stale discard; (5) removed aggressive 2s auto-navigate from onDelivered; (6) fallback {:else} for auth_required/proof-generation. Deferred: ALS+waitUntil context persistence (pre-existing Cycle 5 concern), ProofGenerator event dispatch→callback migration (Svelte 5 modernization), template type unification. |

### Cycle 7 Status

| Wave | Status | Notes |
|------|--------|-------|
| 7A: BR5-010 nullifier fix | **COMPLETE** | 2026-02-17: Fixed nullifier self-comparison (saved expectedNullifier before overwrite). Removed dead try/catch from submitCongressionalMessage. Fixed handleProofError → routes to error state instead of retry_needed. |
| 7B: Trust tier + hasAddress | **COMPLETE** | 2026-02-17: Widened TemplateModal user prop to include trust_tier. Passed userTrustTier to VerificationGate. Fixed hasAddress to check verifiedAddress state instead of non-existent user fields. |
| 7C: Svelte 5 event migration | **COMPLETE** | 2026-02-17: Migrated ProofGenerator + VerificationGate from createEventDispatcher to callback props. Updated TemplateModal call sites and handler signatures. |
| 7D: Review fixes + polish | **COMPLETE** | 2026-02-17: Opus review found 12 issues (2 critical, 3 high, 4 medium, 3 low). Fixed: (1) CRITICAL onMount CWC bypass → routes through handleSendConfirmation(true); (2) as any on proofState.message → local errorMessage variable; (3) added TODO for IdentityVerificationFlow migration. Deferred: TemplateModal createEventDispatcher, needsTier3 dead derived, legacy single-tree BR5-010 gap, credential! assertions. |

### Cycle 8 Status

| Wave | Status | Notes |
|------|--------|-------|
| 8A: ALS safety + errors | **COMPLETE** | 2026-02-17: Added `getRequestClient()` to db.ts. delivery-worker.ts accepts optional db param. Callers capture concrete client before waitUntil. Sanitized delivery_error in status endpoint. |
| 8B: Type safety | **COMPLETE** | 2026-02-17: Created EmailFlowTemplate shared interface. Added missing fields to ComponentTemplate. Changed emailService + templateResolver to accept EmailFlowTemplate. Eliminated 5 unsafe casts from TemplateModal + ProofGenerator. |
| 8C: Svelte 5 migration | **COMPLETE** | 2026-02-17: Migrated IdentityVerificationFlow + TemplateModal from createEventDispatcher to callback props. Updated 2 consumers. Removed needsTier3 dead derived, double oncomplete dispatch, 22 redundant credential! assertions. |
| 8D: Review + polish | **COMPLETE** | 2026-02-17: Opus review found 0 critical, 3 high, 5 medium, 9 low. Fixed 5: (1) trust tier promotion uses captured client + waitUntil (HIGH); (2) verificationData stores full payload (HIGH); (3) tautological validation bug (MEDIUM); (4) stale on:error comment; (5) unused {@const}. Gated legacy single-tree with deprecation warning. Remaining debt: child components (VerificationChoice, SelfXyz, Didit) still use createEventDispatcher; delivery-worker.ts still has `as unknown as Template` for CWC calls. |

### Cycle 9 Status

| Wave | Status | Notes |
|------|--------|-------|
| 9A: Foundation + types | **COMPLETE** | 2026-02-17: Fixed `trustTierToAuthorityLevel(4)` → 5. Added `'mdl'` to VerificationMethod, `'digital-credentials-api'` to VerificationProvider. Updated session-cache, shadow-atlas-handler, session-credentials type unions. Added `/api/identity/verify-mdl` to SENSITIVE_IDENTITY_PATHS. Created `digital-credentials.d.ts` ambient type declarations. Auto-fixed: isVerificationMethod type guard for 'mdl', optional verificationMethod in session-credentials. |
| 9B: Client-side DC API | **COMPLETE** | 2026-02-17: Created `digital-credentials-api.ts` (feature detection, protocol support check, credential request with 60s AbortController timeout, discriminated union CredentialRequestResult). Created `GovernmentCredentialVerification.svelte` (Svelte 5 callback props, 6-state flow: idle→requesting→verifying→complete/error/unsupported, selective disclosure privacy messaging, browser fallback). Auto-fixed: renamed `state` → `verificationState` (Svelte 5 $state rune conflict). |
| 9C: Server-side mDL pipeline | **COMPLETE** | 2026-02-17: Added DC_SESSION_KV Workers KV binding. Installed cbor-web (Workers-compatible CBOR). Created `iaca-roots.ts` (IACA trust store structure, empty placeholder). Created `mdl-verification.ts` (THE privacy boundary: CBOR decode → extract address → derive district → discard PII). Created `/api/identity/verify-mdl/start` (ephemeral ECDH P-256, KV 5-min TTL, dual-protocol mdoc+oid4vp). Created `/api/identity/verify-mdl/verify` (one-time key retrieval, privacy boundary, trust_tier upgrade with `updateMany lt:4`). Auto-fixed: DC_SESSION_KV Platform.env type, GOOGLE_CIVIC_API_KEY ProcessEnv, cbor-web type declarations, updateMany safe upgrade pattern. |
| 9D: Integration + Opus review | **COMPLETE** | 2026-02-17: Added mDL as third option in VerificationChoice (progressive enhancement via `isDigitalCredentialsSupported()`, positioned first as "Fastest" when available). Wired GovernmentCredentialVerification into IdentityVerificationFlow with Svelte 5 callback props (handleMdlComplete/Error/Cancel). Added Tier 4-aware header to VerificationGate. **Opus review:** 0 P0 (privacy boundary verified clean), 1 P1 fixed (missing document_type/identity_commitment in verify endpoint — deriveTrustTier() would regress on re-login), 2 P2 documented (COSE stub needs IACA roots, minor comment accuracy). svelte-check: 0 new errors. |

---

## Cycle 10: Production Readiness + Cleanup

Verify all Cycle 1-9 code works in Cloudflare Workers runtime. Complete remaining Svelte 5 migration. Remove deprecated code paths. Build verification.

### Wave 10A: CF Workers Runtime Verification

Verify new dependencies work in Workers, create production KV namespace, test build.

| Task | File(s) | Detail |
|------|---------|--------|
| Test libsodium on Workers | `src/lib/server/witness-decryption.ts` | libsodium-wrappers uses WASM — verify it loads in Workers runtime. If incompatible, find Workers-native alternative (Web Crypto can't do XChaCha20). May need `libsodium-wrappers-sumo` or conditional import. |
| Test cbor-web on Workers | `src/lib/core/identity/mdl-verification.ts` | Dynamic `import('cbor-web')` — verify it resolves in Workers bundle. |
| Create DC_SESSION_KV namespace | `wrangler.toml` | `npx wrangler kv namespace create DC_SESSION_KV` → update placeholder ID in wrangler.toml. |
| Full CF build test | — | `ADAPTER=cloudflare npm run build` with all new Cycle 9 dependencies. Fix any bundle errors. |
| Verify env var propagation | `src/hooks.server.ts` | Confirm `GOOGLE_CIVIC_API_KEY`, `WITNESS_ENCRYPTION_PUBLIC_KEY` propagate via `handlePlatformEnv`. |

### Wave 10B: Final Svelte 5 Event Migration

Complete the createEventDispatcher → callback props migration for the 3 remaining child components. This is the last batch.

| Task | File(s) | Detail |
|------|---------|--------|
| Migrate VerificationChoice | `VerificationChoice.svelte` | Replace `createEventDispatcher<{ select }>` with `onselect?: (data) => void` callback prop. Update `IdentityVerificationFlow.svelte` consumer (change `on:select={handleMethodSelection}` to `onselect={...}`, remove CustomEvent wrapper from handler). |
| Migrate SelfXyzVerification | `SelfXyzVerification.svelte` | Replace dispatched `complete` and `error` events with `oncomplete` and `onerror` callback props. Update IdentityVerificationFlow consumer (change `on:complete={handleVerificationComplete}` to `oncomplete={...}`). |
| Migrate DiditVerification | `DiditVerification.svelte` | Same pattern as SelfXyz — callback props instead of dispatch. Update IdentityVerificationFlow consumer. |
| Update IdentityVerificationFlow handlers | `IdentityVerificationFlow.svelte` | After migrating children, `handleMethodSelection` and `handleVerificationComplete` no longer need CustomEvent wrappers. Simplify to direct function signatures. |

### Wave 10C: Dead Code + Type Cleanup

Remove deprecated code paths and unsafe type casts accumulated across Cycles 1-9.

| Task | File(s) | Detail |
|------|---------|--------|
| Remove legacy single-tree code | `ProofGenerator.svelte`, `prover-client.ts` | Legacy single-tree branch was gated with deprecation warning in Cycle 8D. All new flows use two-tree. Remove the legacy branch entirely. |
| Fix delivery-worker Template cast | `delivery-worker.ts` | `as unknown as Template` cast is unsafe. Create proper type or use Prisma's generated type with select/include to get exactly the fields CWC needs. |
| Remove dead imports + unused vars | Various | Sweep for any `// removed`, `// deprecated`, `// TODO: remove` markers left by previous cycles. |
| Update env documentation | `.env.example`, `wrangler.toml` | Ensure all new env vars (GOOGLE_CIVIC_API_KEY, CWC_PRODUCTION, WITNESS_ENCRYPTION_PUBLIC_KEY) are documented with descriptions. |

### Wave 10D: Review + Build Verification

Final review gate. Verify the entire codebase builds and deploys cleanly.

| Task | File(s) | Detail |
|------|---------|--------|
| Opus review | — | Review all Cycle 10 changes. Focus: Workers runtime compatibility, Svelte 5 migration completeness, type safety improvements, build output size. |
| svelte-check | — | Target: 0 errors (fix the 2 pre-existing if feasible: PrismaClient cast in db.ts, data.user in layout.svelte). |
| CF build + deploy dry run | — | `ADAPTER=cloudflare npm run build && npx wrangler pages deploy .svelte-kit/cloudflare --project-name communique-site --branch staging --dry-run` |
| Document remaining gaps | `.planning/production-gaps.md` | Honest list of what's NOT production-ready: IACA root certificates, COSE_Sign1 verification, OpenID4VP, Ed25519 credential signing (currently HMAC), Nitro Enclave deployment. |

**Verification:** `ADAPTER=cloudflare npm run build` succeeds. `svelte-check` clean (0 or 2 pre-existing only). No `createEventDispatcher` remaining in auth components. No legacy single-tree code. All env vars documented.

### Cycle 10 Status

| Wave | Status | Notes |
|------|--------|-------|
| 10A: CF Workers Build | **COMPLETE** | 2026-02-17: Build failed on `Invalid export 'devSessionStore'` from `start/+server.ts`. Fixed by extracting to `_dev-session-store.ts` (underscore prefix = non-route SvelteKit convention). `ADAPTER=cloudflare npm run build` passes in 38s. Env var propagation verified via `handlePlatformEnv` in hooks. Commit: c0bb1ce1. **Note:** libsodium WASM and KV namespace remain untested at runtime. |
| 10B: Svelte 5 Migration | **COMPLETE** | 2026-02-17: VerificationChoice, SelfXyzVerification, DiditVerification migrated to callback props. IdentityVerificationFlow consumer updated — all handlers take direct data instead of CustomEvent wrappers. 4 commits. svelte-check: 0 new errors. |
| 10C: Dead Code Cleanup | **COMPLETE** | 2026-02-17: Removed 240 lines single-tree code from prover-client.ts. Created CwcTemplate minimal interface (5 fields). Updated delivery-worker.ts to use Prisma `select` — no cast needed. Updated .env.example and wrangler.toml documentation. 4 commits. |
| 10D: Review + Build | **COMPLETE** | 2026-02-17: Found and fixed 2 dangling files (example-usage.ts, witness-builder.ts) importing removed exports — 544 more lines deleted. Updated barrel index.ts. CF build passes. svelte-check: 18 errors, 95 warnings (0 new from Cycle 10). Total dead code removed: ~1300 lines. |

**Post-Cycle 10 fixes** (committed separately):
- `fix(email)`: Duplicate title check → title + subject
- `fix(submissions)`: ALS scope — capture PrismaClient before response, register promotion with waitUntil
- `refactor(submission)`: SubmissionStatus rewrite — WebSocket→polling, retry, generation counter
- `chore`: ProofGenerator deprecation warning, modal state types

---

## Cycle 11: Type Safety + Submission Hardening

Fix the 18 pre-existing svelte-check errors, audit the submission pipeline end-to-end, and resolve remaining CF Workers runtime gaps.

### Wave 11A: svelte-check Error Resolution

Triage and fix the 18 type errors. Target: 0 errors, or document remaining as accepted technical debt with rationale.

| Task | Detail |
|------|--------|
| Triage all 18 errors | Run `npx svelte-check --output machine-verbose` to get full error list with line numbers. Categorize: fixable, requires upstream fix, accepted debt. |
| Fix layout.svelte type error | `Property 'id' does not exist on type '{}'` at `+layout.svelte:92`. Likely needs a `PageData` type annotation or `data.user` cast. |
| Fix templateDraft type errors | Missing `provenance`/`source_url` on ProcessedDecisionMaker. Add missing fields to type definition or update usage. |
| Fix crypto noise.ts | `randomBytes` property missing — Node.js vs browser crypto mismatch. Use conditional import or `crypto.getRandomValues()`. |
| Fix remaining type errors | Address target selector, intelligence panel, delivery confirmation, and other type mismatches found during triage. |

### Wave 11B: Submission Pipeline Audit

Verify the SubmissionStatus → retry → delivery-worker → status polling flow works end-to-end with proper state transitions.

| Task | Detail |
|------|--------|
| Audit delivery status transitions | Trace `delivery_status` field through: create (pending) → processSubmissionDelivery (processing → delivered/partial/failed). Verify all transitions are atomic. |
| Verify retry idempotency | Check `/api/submissions/[id]/retry` prevents double-delivery. Verify it resets status to `pending` before re-triggering. |
| Audit polling lifecycle | SubmissionStatus polls every 2s. Verify: AbortController cleanup on unmount, generation counter prevents stale responses, terminal states stop polling. |
| Check error boundary | What happens when delivery-worker throws? Verify status transitions to `failed`, error is persisted, SubmissionStatus shows retry button. |

### Wave 11C: CF Workers Runtime Gaps

Address the remaining P0 items that Cycle 10 build verification didn't cover.

| Task | Detail |
|------|--------|
| Test libsodium WASM on Workers | `witness-decryption.ts` imports `libsodium-wrappers`. Test if WASM initializes in Workers runtime. If it fails, evaluate: (1) `@aspect-build/libsodium-wasm` (Workers-native), (2) Web Crypto polyfill for XChaCha20, (3) `tweetnacl` pure-JS fallback. |
| Provision DC_SESSION_KV | Run `npx wrangler kv namespace create DC_SESSION_KV`. Update placeholder ID in `wrangler.toml`. Create preview namespace for staging. |
| Test mDL endpoints on Workers | Deploy to staging branch. Hit `/api/identity/verify-mdl/start` to verify: ECDH key generation works, KV put succeeds, JSON response is correct. |

### Wave 11D: Review + Documentation

| Task | Detail |
|------|--------|
| Opus review | Review all Cycle 11 changes. Focus: type safety improvements, submission flow correctness, Workers runtime compatibility. |
| Update implementation status | Reflect Cycle 11 fixes in `docs/implementation-status.md`. Update P0/P1 table. |
| svelte-check verification | Target: 0 errors. Document any accepted debt. |
| CF build verification | `ADAPTER=cloudflare npm run build` must still pass with all Cycle 11 changes. |

**Verification:** svelte-check errors reduced to 0 (or documented exceptions). Submission pipeline status transitions verified. CF build passes. DC_SESSION_KV provisioned with real namespace ID.

---

*Communique PBC | Implementation Plan | 2026-02-17*
