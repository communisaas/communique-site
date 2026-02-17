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

## Cycle 6: Government Credentials (scoped after Cycle 5)

- Digital Credentials API integration
- mDL verification
- Feature detection + graceful degradation

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

---

*Communique PBC | Implementation Plan | 2026-02-17*
