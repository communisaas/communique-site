# Remaining Implementation Gaps

Status: February 2026
Last updated by: gap-bridge team cycle

---

## Priority Summary

| Gap | Priority | Blocked On | Estimated Effort |
|-----|----------|------------|-----------------|
| 1. IACA Root Certificates | **P0 — Launch blocker** | AAMVA VICAL access + per-state rollout | 2-4 weeks (access) + 1 week (code) |
| 3. mDL Identity Commitment + Shadow Atlas Registration | **P0 — Launch blocker** (mDL users cannot generate ZK proofs without this) | Selective disclosure expansion + commitment pipeline | 1-2 weeks |
| 5. TEE Infrastructure | **P0 — Launch blocker** (production message delivery requires TEE decryption) | AWS Nitro Enclave provisioning + /api/tee/public-key server route | 3-5 weeks |
| 6. Apple Business Connect Registration | P1 — Required for iOS mDL | Apple merchant enrollment process | 1-2 weeks (process) |
| 2. Engagement Tier Computation Opaque to Client | P1 — UX gap, no functional blocker | Shadow Atlas API surface for tier explanation | 1-2 weeks |
| 4. Modal System Full Unification | P2 — Technical debt, no user-facing regression | Svelte 5 migration cleanup pass | 1-2 weeks |

> **Priority note (2026-02-25):** Gap 3 elevated from P1 to P0. Without this pipeline,
> mDL-verified users complete identity verification but cannot generate ZK proofs — the
> entire submission flow is broken for the only remaining identity provider. Gap 5 elevated
> from P2 to P0: TEE infrastructure is required for production message delivery (witness
> decryption), not optional. See also: **[Launch Readiness Matrix](#launch-readiness-matrix)** below.

---

## Gap 1: IACA Root Certificates (Tier 4 mDL Verification)

### Current State

The COSE_Sign1 verification pipeline is structurally complete but cannot perform
issuer trust validation because the IACA root certificate store is empty.

**Trust store (empty):**
`/Users/noot/Documents/communique/src/lib/core/identity/iaca-roots.ts`, line 51:
```typescript
export const IACA_ROOTS: Record<string, IACACertificate> = {
	// Production entries from AAMVA VICAL will go here.
};
```

A development placeholder exists at line 73 (`DEV_IACA_ROOT`, state `'XX'`) but
its `certificateB64` field is an empty string -- it is not a valid X.509
certificate and exists solely to exercise the code path in tests.

**COSE_Sign1 implementation (complete):**
`/Users/noot/Documents/communique/src/lib/core/identity/cose-verify.ts` contains
a full RFC 9052 Section 4.2 implementation:
- Protected header parsing and ES256 algorithm check (lines 89-126)
- Issuer certificate extraction from unprotected header key 33 / x5chain (lines 329-361)
- Minimal ASN.1/DER EC P-256 public key extraction (lines 405-446)
- Sig_structure construction and Web Crypto ECDSA verify (lines 196-224)
- MSO parsing with valueDigest extraction (lines 453-531)
- MSO digest validation (`validateMsoDigests`, lines 257-319)

**Trust chain check (stub):**
`/Users/noot/Documents/communique/src/lib/core/identity/cose-verify.ts`, lines 373-394.
`checkTrustChain()` performs direct byte comparison of the issuer certificate DER
against each trusted root. It does not walk intermediate CA chains. The TODO at
line 389 notes: "Full chain validation -- extract issuer DN from cert, match
against root subject DN, verify intermediate signatures."

**Bypass logic in mDL verification:**
`/Users/noot/Documents/communique/src/lib/core/identity/mdl-verification.ts`,
lines 166-183. When `getIACARootsForVerification()` returns an empty array, the
code logs a warning and proceeds without issuer verification:
```typescript
if (roots.length > 0) {
    const coseResult = await verifyCoseSign1(issuerAuth, roots);
    // ...
} else {
    console.warn('[mDL] No IACA roots loaded -- skipping issuer verification');
}
```
This means all mDL credentials currently pass issuer verification by default,
which is acceptable for development but not for production.

### What's Needed

1. **AAMVA VICAL certificate ingestion.** Obtain root CA certificates (DER-encoded,
   base64) for each participating state DMV from
   `https://vical.dts.aamva.org`. Each entry is approximately 2KB base64.
   Populate the `IACA_ROOTS` record keyed by state abbreviation.

2. **Certificate rotation monitoring.** Each `IACACertificate` has an `expiresAt`
   field (line 35). Build a scheduled job or deploy-time check that warns when
   certificates approach expiration.

3. **Intermediate CA chain validation.** Replace the direct byte-comparison in
   `checkTrustChain()` (line 373) with proper X.509 chain walking: extract
   issuer DN, match against root subject DN, verify intermediate signatures.

4. **MSO digest validation integration.** The `validateMsoDigests()` function
   (cose-verify.ts, line 257) exists but is not called in the mDL verification
   pipeline. Line 177 has a comment: "Optionally: validate MSO digests." This
   should be wired in when IACA roots are populated.

5. **Enable the verification gate.** Remove the bypass at mdl-verification.ts
   line 179 (`else { console.warn(...) }`) or convert it to a hard failure once
   IACA roots are loaded for the target states.

### Blocking Issues

- **AAMVA access:** The VICAL service requires organizational registration.
  Timeline depends on AAMVA's approval process.
- **Per-state rollout:** Not all states publish IACA roots simultaneously.
  The trust store will grow incrementally. A "supported states" check
  (`supportedIACAStates()`, iaca-roots.ts line 102) already exists for this.
- **No X.509 library:** The current implementation avoids Node.js crypto for
  Cloudflare Workers compatibility. Full chain validation may require a
  lightweight WASM X.509 library or a build-time certificate validation step.

### Relevant Files

- `/Users/noot/Documents/communique/src/lib/core/identity/iaca-roots.ts` (lines 51-60, 73-81, 87-127)
- `/Users/noot/Documents/communique/src/lib/core/identity/cose-verify.ts` (lines 82-238, 257-319, 373-394, 405-446)
- `/Users/noot/Documents/communique/src/lib/core/identity/mdl-verification.ts` (lines 161-186)

---

## Gap 2: Engagement Tier Computation Opaque to Client

### Current State

Engagement tier derivation runs entirely server-side in the voter-protocol
Shadow Atlas. The communique client receives a pre-computed `engagementTier`
(0-4) from the `/api/shadow-atlas/engagement` endpoint but has no visibility
into the underlying metrics or how the tier was derived.

**Tier derivation logic (server-side only):**
`/Users/noot/Documents/voter-protocol/packages/crypto/engagement.ts`, lines 166-180:
```typescript
export function deriveTier(
  actionCount: number,
  diversityScore: number,
  tenureMonths: number,
  adoptionCount: number = 0,
): 0 | 1 | 2 | 3 | 4 {
  const shannonH = diversityScore / 1000;
  const E = computeCompositeScore(actionCount, shannonH, tenureMonths, adoptionCount);
  if (E >= 25.0) return 4;  // Pillar
  if (E >= 12.0) return 3;  // Veteran
  if (E >= 5.0) return 2;   // Established
  if (E > 0) return 1;      // Active
  return 0;                  // New
}
```

**EngagementTreeBuilder (builds from chain events):**
`/Users/noot/Documents/voter-protocol/packages/shadow-atlas/src/engagement-tree-builder.ts`,
lines 122-172. Computes `actionCount` (deduped nullifiers), `diversityScore`
(Shannon diversity over 5 action categories, encoded as `floor(H * 1000)`),
and `tenureMonths` from on-chain `NullifierEvent` data.

**ActionCategoryRegistry dependency (lines 77-101):**
Action domains are keccak256 hashes with no structured prefix byte. Category
resolution (1-5: congressional contact, template creation, challenge
participation, campaign support, governance vote) requires a server-side
`ActionCategoryRegistry` map. Without this registry, `diversityScore` is 0
for all users (line 119: "If not provided, diversityScore will be 0").

**Client consumption:**
`/Users/noot/Documents/communique/src/routes/api/shadow-atlas/engagement/+server.ts`
returns `engagementTier`, `actionCount`, and `diversityScore` as opaque
strings (lines 131-138). The client (ProofGenerator.svelte, prover-client.ts)
passes these values directly into the witness without interpreting them.

### What's Needed

1. **Client-side tier explanation UI.** Display to users what actions contribute
   to their engagement tier, what their current composite score is, and what
   thresholds they need to reach the next tier.

2. **Tier progression hints.** The composite score formula uses four factors:
   `actionFactor * diversityMult * tenureMult * adoptionMult`. Surface which
   factor is the bottleneck (e.g., "Try a different action category to increase
   your diversity multiplier").

3. **ActionCategoryRegistry population pipeline.** The registry must be populated
   when action domains are whitelisted in DistrictGate's `allowedActionDomains`
   mapping. Currently the tree builder notes this dependency but no automated
   pipeline exists to sync DistrictGate domain whitelisting events to the
   registry.

4. **Adoption count integration.** The `adoptionCount` parameter in `deriveTier()`
   defaults to 0 (engagement-tree-builder.ts line 153 comment: "adoption pipeline
   is Phase 2"). Template adoption tracking needs to feed into the engagement
   computation.

### Blocking Issues

- The tier derivation formula is part of the voter-protocol crypto package. Any
  changes to tier boundaries require circuit recompilation (the Noir circuit at
  `packages/crypto/noir/three_tree_membership/src/main.nr` range-checks
  `engagement_tier` to [0, 4]).
- No API endpoint currently returns the composite score breakdown or progression
  hints -- only the final tier value.

### Relevant Files

- `/Users/noot/Documents/voter-protocol/packages/crypto/engagement.ts` (lines 113-180)
- `/Users/noot/Documents/voter-protocol/packages/shadow-atlas/src/engagement-tree-builder.ts` (lines 77-101, 110-245)
- `/Users/noot/Documents/communique/src/routes/api/shadow-atlas/engagement/+server.ts` (lines 1-152)
- `/Users/noot/Documents/communique/src/lib/core/shadow-atlas/client.ts` (lines 1-57)

---

## Gap 3: mDL Identity Commitment + Shadow Atlas Registration

### Current State

The mDL verification path (Digital Credentials API -> CBOR decode -> COSE_Sign1 verify -> district derivation) completes successfully but does NOT generate an identity commitment or trigger Shadow Atlas three-tree registration. This means mDL-verified users cannot generate ZK proofs for congressional submissions.

**The gap in the pipeline:**

```
mDL verification -> District derivation -> Identity commitment X -> Shadow Atlas registration X -> ZK proof generation X
```

**What's missing:**

1. **Selective disclosure expansion.** The current `ItemsRequest` in `verify-mdl/start/+server.ts` requests only 3 fields:
   - `postal_code` (for district derivation)
   - `city` (for district derivation)
   - `state` (for district derivation)

   For identity commitment generation, we also need:
   - `birth_date` (year only, for `birth_year` parameter)
   - `document_number` (for Sybil resistance hash)

   These must be added to the `ItemsRequest` with `intent_to_retain: false`.

2. **Identity commitment computation on mDL path.** The existing `computeIdentityCommitment()` function in `identity-binding.ts` takes `(documentNumber, nationality, birthYear, documentType)`. The mDL path needs to:
   - Extract `document_number` and `birth_date_year` from the mdoc response
   - Pass these through `processCredentialResponse()` privacy boundary (which currently discards them)
   - Compute `SHA-256(SHA-256(document_number + 'US' + birth_year)) mod BN254_MODULUS`
   - Call `bindIdentityCommitment()` for cross-provider Sybil resistance

3. **Shadow Atlas registration trigger.** After identity commitment is computed, the mDL path must call `registerInShadowAtlas()` from `shadow-atlas-handler.ts` with:
   - `identityCommitment` (from step 2)
   - `congressionalDistrict` (already derived)
   - `cellId` (from Census geocoding -- requires address, which mDL provides)
   - `verificationMethod: 'digital-credentials-api'`

4. **Phase 2: Poseidon2 commitment.** The current SHA-256 squared approach (Phase 1) will be replaced with `Poseidon2_H4(user_secret, cell_id, registration_salt, authority_level)` computed client-side. This requires the Noir circuit's Poseidon2 implementation to be available as a standalone WASM module for browser use.

### Privacy Consideration

Adding `document_number` and `birth_date` to the selective disclosure request increases the data exposed by the wallet to the browser. However:
- These fields never leave the browser (processed in `processCredentialResponse()` and immediately hashed)
- The `intent_to_retain: false` flag instructs the wallet that data should not be stored
- Only the resulting `identity_commitment` hash (a single field element) is sent to the server
- The privacy boundary function must be updated to hash these fields before discarding them

### Relevant Files

- `/Users/noot/Documents/communique/src/routes/api/identity/verify-mdl/start/+server.ts` (ItemsRequest construction)
- `/Users/noot/Documents/communique/src/lib/core/identity/mdl-verification.ts` (processCredentialResponse privacy boundary)
- `/Users/noot/Documents/communique/src/lib/core/identity/identity-binding.ts` (computeIdentityCommitment, bindIdentityCommitment)
- `/Users/noot/Documents/communique/src/lib/core/identity/shadow-atlas-handler.ts` (registerInShadowAtlas)
- `/Users/noot/Documents/communique/src/lib/components/auth/IdentityVerificationFlow.svelte` (orchestration)

---

## Gap 4: Modal System Full Unification

### Current State

A centralized modal system exists in
`/Users/noot/Documents/communique/src/lib/stores/modalSystem.svelte.ts` with a
`ModalType` registry (lines 13-25) and a unified `UnifiedModal` component. However,
the system carries a parallel legacy API that duplicates state management.

**Dual API surface (lines 210-302):**
The `modalActions` object exposes both a "new unified API" (`openModal()`,
`closeModal()`, `closeAll()`, `closeTop()`) and a "legacy API" (`open()`,
`close()`, `setState()`, `setMailtoUrl()`, `confirmSend()`, `reset()`). The
legacy API maintains a separate `LegacyModalContext` state object (lines 57-64)
with its own `LegacyModalState` type (lines 45-55) that includes states like
`'cwc-submission'`, `'proof-generation'`, and `'celebration'`.

**ModalRegistry (partial migration):**
`/Users/noot/Documents/communique/src/lib/components/modals/ModalRegistry.svelte`
registers five modals through the unified system: onboarding, sign-in, address,
template, and progressive-form. But several modal components still exist as
standalone implementations:
- `TouchModal.svelte` -- `/Users/noot/Documents/communique/src/lib/components/ui/TouchModal.svelte`
- `SimpleModal.svelte` -- `/Users/noot/Documents/communique/src/lib/components/modals/SimpleModal.svelte`
- `TemplateSuccessModal.svelte` -- `/Users/noot/Documents/communique/src/lib/components/modals/TemplateSuccessModal.svelte`
- `ProfileEditModal.svelte` -- `/Users/noot/Documents/communique/src/lib/components/profile/ProfileEditModal.svelte`

These standalone modals manage their own open/close state and do not participate
in the centralized z-index stack or the body scroll lock coordination.

**Backward-compatibility exports (lines 344-376):**
The store file exports individual reactive getters (`activeModals`, `topModal`,
`hasActiveModal`, `modalContext`, `modalState`) and functions (`isModalOpen()`,
`currentTemplate()`) for components that have not yet migrated to the unified API.

### What's Needed

1. **Migrate standalone modals to ModalRegistry.** Register TouchModal,
   SimpleModal, TemplateSuccessModal, and ProfileEditModal in ModalRegistry.svelte
   using the `UnifiedModal` wrapper.

2. **Eliminate legacy API.** After all consumers migrate, remove the
   `LegacyModalState` type, `LegacyModalContext` interface, and the legacy
   methods (`open(template, user)`, `setState()`, `setMailtoUrl()`, etc.) from
   `modalSystem.svelte.ts`.

3. **Remove backward-compatibility exports.** The individual getter exports
   (lines 344-376) and the `createModalStore()` utility should be consolidated
   once all components use the unified API directly.

4. **Add missing modal types.** The `ModalType` union (line 13) does not
   include types for `profile_edit`, `template_success`, or `touch_modal`,
   which would be needed to register the standalone modals.

### Blocking Issues

- Components consuming the legacy API (particularly the template send flow with
  `setState('cwc-submission')` and `confirmSend()`) need careful migration to
  avoid breaking the CWC submission pipeline.
- The `TemplateModal.svelte` component likely has deep coupling with the legacy
  `modalContext` state through its send confirmation flow.

### Relevant Files

- `/Users/noot/Documents/communique/src/lib/stores/modalSystem.svelte.ts` (lines 13-25, 44-64, 210-302, 344-433)
- `/Users/noot/Documents/communique/src/lib/components/modals/ModalRegistry.svelte` (lines 1-140)
- `/Users/noot/Documents/communique/src/lib/components/ui/UnifiedModal.svelte` (lines 1-141)
- `/Users/noot/Documents/communique/src/lib/components/ui/TouchModal.svelte`
- `/Users/noot/Documents/communique/src/lib/components/modals/SimpleModal.svelte`
- `/Users/noot/Documents/communique/src/lib/components/modals/TemplateSuccessModal.svelte`
- `/Users/noot/Documents/communique/src/lib/components/profile/ProfileEditModal.svelte`
- `/Users/noot/Documents/communique/src/lib/types/modal.ts` (line 1-5)

---

## Gap 5: TEE Infrastructure

### Current State

The client-side witness encryption module is implemented. It encrypts witness
data to a TEE public key using X25519 ECDH + XChaCha20-Poly1305 via libsodium.
However, the server-side TEE components do not exist.

**Client-side encryption (complete):**
`/Users/noot/Documents/communique/src/lib/core/proof/witness-encryption.ts`
implements the full encryption flow:
- `WitnessData` interface (lines 25-87) with three-tree proof inputs, delivery
  address, and engagement data.
- `encryptWitness()` function (lines 180-234): generates ephemeral X25519 keypair,
  derives shared secret via ECDH, derives key via BLAKE2b, encrypts with
  XChaCha20-Poly1305.
- `getTEEPublicKey()` function (lines 119-169): fetches from `/api/tee/public-key`
  with retry logic and 1-hour caching.

**Missing server endpoint:**
The route `/api/tee/public-key` is referenced by the client (witness-encryption.ts
line 133) but does not exist in `src/routes/api/`. No SvelteKit route handler
has been created for it. The `getTEEPublicKey()` function will throw
"Witness encryption service unavailable" after 3 retry attempts.

**TEE architecture (documented, not deployed):**
`/Users/noot/Documents/communique/docs/architecture/tee-systems.md` describes
the TEE as being used exclusively for message delivery (decrypting congressional
messages for CWC API delivery), not for ZK proof generation. Target platform
is AWS Nitro Enclaves at approximately $350-400/month. The document indicates
implementation was "Week 13 Complete (October 22, 2025)" with files in a
`tee-workload/` directory, but this refers to the message delivery TEE, not the
witness encryption key management.

**Witness data scope:**
The `WitnessData` interface (witness-encryption.ts, lines 25-87) includes a
`deliveryAddress` field with full PII (name, email, street, city, state, zip,
phone). This data is encrypted client-side and should only be decryptable within
the TEE boundary. Without the TEE, this data cannot flow through the system.

### What's Needed

1. **Create `/api/tee/public-key` server route.** This endpoint must return a
   JSON response with `{ success: true, keyId: string, publicKey: string }`
   where `publicKey` is a hex-encoded X25519 public key. The corresponding
   private key must be stored in the TEE.

2. **TEE key management.** Generate and rotate X25519 keypairs within the TEE
   enclave. The `teeKeyId` returned by the endpoint allows clients to specify
   which key was used for encryption when submitting ciphertext.

3. **Decryption endpoint.** Create a TEE-internal endpoint that accepts
   `EncryptedWitness` payloads (ciphertext, nonce, ephemeralPublicKey, teeKeyId)
   and performs the reverse ECDH + XChaCha20-Poly1305 decryption within the
   enclave boundary.

4. **AWS Nitro Enclave provisioning.** Deploy the TEE workload with:
   - Key pair generation at enclave boot
   - Attestation document for clients to verify enclave identity
   - Network isolation (only the decryption endpoint accessible from the host)

5. **Interim development stub.** For local development, create a non-TEE
   implementation of `/api/tee/public-key` that generates a static X25519
   keypair stored in environment variables. Mark it clearly as insecure.

### Blocking Issues

- AWS Nitro Enclave requires EC2 instance types that support it (C5a, M5a, R5a,
  etc. with `.metal` or `.xlarge+` variants).
- Key rotation strategy must be defined before deployment -- clients cache the
  TEE public key for 1 hour (witness-encryption.ts line 157).
- Attestation verification (proving the key was generated inside a genuine
  enclave) is needed for production trust but is a significant implementation
  effort.
- The blob encryption module (`/Users/noot/Documents/communique/src/lib/core/identity/blob-encryption.ts`)
  also references TEE infrastructure and may share key management requirements.

### Relevant Files

- `/Users/noot/Documents/communique/src/lib/core/proof/witness-encryption.ts` (lines 25-87, 106-169, 180-234)
- `/Users/noot/Documents/communique/docs/architecture/tee-systems.md` (lines 1-60)
- `/Users/noot/Documents/communique/src/lib/core/identity/blob-encryption.ts`
- `/Users/noot/Documents/communique/src/routes/api/` (missing `tee/public-key` route)

---

## Gap 6: Apple Business Connect Registration (iOS mDL)

### Current State

Apple requires merchants/verifiers to register through Apple Business Connect before they can request mDL credentials via the Digital Credentials API on iOS (Safari). Without registration, the `navigator.credentials.get()` call with `digital-credentials` protocol will fail silently or return an error on iOS devices.

Google's implementation (Chrome on Android) does not have this requirement -- any website can request credentials.

### What's Needed

1. **Apple Business Connect enrollment.** Register Communique PBC as a verified merchant at `https://businessconnect.apple.com/`. This requires:
   - Apple Developer account (existing or new)
   - Business verification (D-U-N-S number or equivalent)
   - Merchant category assignment

2. **Entitlement configuration.** After registration, Apple provides merchant credentials that must be included in the Digital Credentials API request on iOS. The exact integration mechanism depends on Apple's current API surface (entitlement header, signed request, or domain verification).

3. **Platform detection.** `digital-credentials-api.ts` already has `isDigitalCredentialsSupported()` for feature detection. Add platform-specific logic to handle the case where the API exists but Apple registration is incomplete (graceful degradation to "not available on this device" message).

### Blocking Issues

- Apple Business Connect registration timeline is unpredictable (days to weeks)
- Registration may require a published privacy policy URL and terms of service
- Apple may restrict mDL verification to specific merchant categories

### Relevant Files

- `/Users/noot/Documents/communique/src/lib/core/identity/digital-credentials-api.ts` (feature detection, request construction)
- `/Users/noot/Documents/communique/src/lib/components/auth/GovernmentCredentialVerification.svelte` (error handling for iOS)

---

## Launch Readiness Matrix

**Last updated:** 2026-02-25
**Canonical source of truth** for what blocks production launch.

Cross-references: voter-protocol `MEMORY.md`, communique `implementation-status.md`

### P0: Launch Blockers (must complete before any production traffic)

| # | Item | Owner Repo | Status | Dependency |
|---|------|-----------|--------|------------|
| L-01 | Deploy contracts to Scroll mainnet | voter-protocol | **NOT STARTED** | Compiled + tested (473 Solidity tests, v4 Sepolia verified) |
| L-02 | `registerVerifier()` + `sealGenesis()` on mainnet | voter-protocol | **NOT STARTED** | Depends on L-01 |
| L-03 | IACA root certificate ingestion (Gap 1) | communique | **BLOCKED** — pending AAMVA VICAL access | Trust store structure ready; bypass logic in mdl-verification.ts must become hard fail |
| L-04 | mDL → identity commitment → Shadow Atlas registration (Gap 3) | communique | **NOT STARTED** | Selective disclosure expansion (`birth_date`, `document_number`) + `processCredentialResponse()` pipeline |
| L-05 | TEE infrastructure for witness decryption (Gap 5) | communique | **NOT STARTED** | AWS Nitro Enclave provisioning; `/api/tee/public-key` route; key management |
| L-06 | Production secrets + Shadow Atlas server deployment | voter-protocol | **NOT STARTED** | Server binary ready; needs hosting + DNS + TLS |
| L-07 | Update communique `file:` paths → npm registry refs | communique | **NOT STARTED** | @voter-protocol packages published (crypto@0.1.3, noir-prover@0.2.0) |

### P1: Pre-Production (should complete before public announcement)

| # | Item | Owner Repo | Status | Dependency |
|---|------|-----------|--------|------------|
| L-08 | Apple Business Connect registration (Gap 6) | communique | **NOT STARTED** | Apple enrollment process (days-to-weeks) |
| L-09 | Engagement tier explanation UI (Gap 2) | communique + voter-protocol | **NOT STARTED** | Shadow Atlas API surface expansion |
| L-10 | Debate on-chain settlement | voter-protocol + communique | **NOT STARTED** | Depends on L-01 (mainnet DebateMarket.sol deployment) |
| L-11 | Debate auto-resolution cron | communique | **NOT STARTED** | None |
| L-12 | CampaignRegistry timelock risk review (D4) | voter-protocol | **DEFERRED** | Audit resolution decision accepted risk; re-review before mainnet |

### P2: Post-Launch

| # | Item | Owner Repo | Notes |
|---|------|-----------|-------|
| L-13 | Modal system full unification (Gap 4) | communique | Technical debt, no user regression |
| L-14 | Congressional office dashboard | communique | Not started |
| L-15 | IPFS migration for encrypted blobs | communique | 99.97% cost reduction |
| L-16 | On-chain reputation (ERC-8004) | voter-protocol | Designed, not deployed |
| L-17 | Debate co-sign UI + event indexer | communique | API exists, UI missing |
| L-18 | Persistent rate limiting (Redis) | communique | In-memory currently |
| L-19 | Salt rotation automation | communique | Manual currently |
| L-20 | BA-017 (depth-24 env-blocked) | voter-protocol | Backlog |

### Critical Path

```
L-03 (IACA certs) ─────────────────────────────┐
L-04 (mDL→commitment→registration) ────────────┤
L-05 (TEE infrastructure) ─────────────────────→├──→ Production Launch
L-01 (mainnet deploy) → L-02 (genesis seal) ───┤
L-06 (Shadow Atlas server) ────────────────────┤
L-07 (npm registry refs) ──────────────────────┘
```

L-03 is externally blocked (AAMVA). All others are engineering effort with no external dependencies.
