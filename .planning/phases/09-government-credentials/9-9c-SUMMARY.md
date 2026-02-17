---
phase: 9
plan: 9c
subsystem: identity/mdl-verification
tags: [mdl, iso18013-5, privacy-boundary, cbor, digital-credentials-api, workers-kv]
dependency-graph:
  requires: [9-9a, 9-9b]
  provides: [mdl-server-verification, ephemeral-key-sessions, district-derivation]
  affects: [trust-tier, address-verification, user-schema]
tech-stack:
  added: [cbor-web]
  patterns: [discriminated-union, privacy-boundary, ephemeral-keys, kv-session-store]
key-files:
  created:
    - src/lib/core/identity/iaca-roots.ts
    - src/lib/core/identity/mdl-verification.ts
    - src/routes/api/identity/verify-mdl/start/+server.ts
    - src/routes/api/identity/verify-mdl/verify/+server.ts
    - src/lib/types/cbor-web.d.ts
  modified:
    - wrangler.toml
    - src/app.d.ts
    - package.json
    - package-lock.json
decisions:
  - "Use cbor-web (not cbor2 or cborg) for Workers-compatible CBOR decoding"
  - "IACA root certificates left as empty placeholder — production population is a separate task"
  - "OpenID4VP verification deferred — org-iso-mdoc covers Safari + Chrome critical path"
  - "Google Civic API for district derivation — same pipeline as existing address verification"
  - "updateMany with lt condition for trust_tier to prevent downgrades"
metrics:
  duration: "6m 52s"
  completed: "2026-02-17T21:15:39Z"
  tasks: 6
  files-created: 5
  files-modified: 4
---

# Phase 9 Plan 9C: Server-Side mDL Verification Pipeline Summary

Server-side mDL verification pipeline with ISO 18013-5 CBOR decoding, privacy boundary function that derives congressional district from address and discards raw PII, ephemeral ECDH key pairs stored in Workers KV with 5-min TTL.

## What Was Built

### Infrastructure (Tasks 1-2)
- **Workers KV binding** (`DC_SESSION_KV`) added to `wrangler.toml` for ephemeral session key storage
- **KV type declaration** added to `App.Platform.env` in `app.d.ts`
- **cbor-web** installed as Workers-compatible CBOR decoder (no Node.js native deps)
- **Type declarations** for `cbor-web` created since the package ships none

### Trust Store (Task 3)
- **IACA root certificate structure** (`iaca-roots.ts`) with `IACACertificate` interface
- Empty `IACA_ROOTS` record — real certificates from AAMVA Digital Trust Service needed before production
- Lookup helpers: `getIACARootForIssuer()`, `hasIACARoot()`, `supportedIACAStates()`

### Privacy Boundary (Task 4)
- **`processCredentialResponse()`** is THE privacy boundary for mDL data
- Raw address fields (postal_code, city, state) enter; only derived district string leaves
- CBOR decode DeviceResponse via dynamic `import('cbor-web')`
- Extract IssuerSignedItem elements from `org.iso.18013.5.1` namespace
- Derive congressional district via Google Civic Information API
- SHA-256 credential hash for deduplication
- COSE_Sign1 verification stubbed (needs IACA roots populated)
- OpenID4VP stubbed (mdoc covers critical path)

### API Endpoints (Tasks 5-6)
- **`POST /api/identity/verify-mdl/start`** — generates ephemeral ECDH P-256 key pair, stores private key in KV with 5-min TTL, returns dual-protocol request configs (org-iso-mdoc + openid4vp) with selective disclosure (intent_to_retain: false on all fields)
- **`POST /api/identity/verify-mdl/verify`** — retrieves one-time-use ephemeral key from KV, processes credential through privacy boundary, upgrades user trust_tier to 4 (never downgrades), sets address_verification_method to 'mdl'
- Dev fallback: in-memory session store when DC_SESSION_KV unavailable

## Decisions Made

1. **cbor-web over cborg/cbor2**: Only cbor-web has zero Node.js native dependencies, critical for Workers runtime
2. **Empty IACA roots**: Structure matters for Wave 9C; populating real certificates is a distinct production readiness task
3. **OpenID4VP deferred**: org-iso-mdoc covers both Safari 26+ and Chrome 141+; OpenID4VP adds complexity for minimal coverage gain
4. **Google Civic API for district**: Reuses the same district derivation pipeline as existing address verification
5. **updateMany with lt guard**: Prevents trust_tier downgrade if user already verified at tier 4+ via another method

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DC_SESSION_KV to Platform.env type**
- **Found during:** Task 1
- **Issue:** `platform?.env?.DC_SESSION_KV` would be a TypeScript error without type declaration
- **Fix:** Added `DC_SESSION_KV?: KVNamespace` to `App.Platform.env` in `app.d.ts`
- **Files modified:** `src/app.d.ts`
- **Commit:** f6d303cc

**2. [Rule 3 - Blocking] Added GOOGLE_CIVIC_API_KEY to ProcessEnv**
- **Found during:** Task 4
- **Issue:** `process.env.GOOGLE_CIVIC_API_KEY` referenced in deriveDistrict() but not declared
- **Fix:** Added to `NodeJS.ProcessEnv` interface in `app.d.ts`
- **Files modified:** `src/app.d.ts`
- **Commit:** b5ca3cc3

**3. [Rule 3 - Blocking] Created cbor-web type declarations**
- **Found during:** Verification
- **Issue:** `cbor-web` ships no TypeScript declarations, causing svelte-check error
- **Fix:** Created `src/lib/types/cbor-web.d.ts` with decode/encode/Tagged stubs
- **Files modified:** `src/lib/types/cbor-web.d.ts` (new)
- **Commit:** b55f25d3

**4. [Rule 1 - Bug] Used updateMany instead of update for trust_tier**
- **Found during:** Task 6
- **Issue:** Plan's original code used `Math.max(4, 0)` with `set` — doesn't prevent downgrades
- **Fix:** Used `updateMany` with `where: { trust_tier: { lt: 4 } }` condition, plus separate `update` for address method on all users
- **Files modified:** `src/routes/api/identity/verify-mdl/verify/+server.ts`
- **Commit:** 4fa37e21

## Verification

- `svelte-check`: 2 pre-existing errors (PrismaClient cast in db.ts, layout.svelte data.user), 0 new errors from 9-9c code
- All 5 new files exist and are committed
- All 7 commits verified in git log

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f6d303cc | Add DC_SESSION_KV binding to wrangler.toml |
| 2 | 37d239d7 | Install cbor-web for CBOR decoding |
| 3 | b7f1db3d | IACA root certificate trust store structure |
| 4 | b5ca3cc3 | mDL verification privacy boundary function |
| 5 | e1cc6688 | mDL verification start endpoint with ephemeral keys |
| 6 | 4fa37e21 | mDL verification verify endpoint |
| fix | b55f25d3 | Add cbor-web type declarations |

## Self-Check: PASSED

- 5/5 created files exist on disk
- 7/7 commits found in git history
