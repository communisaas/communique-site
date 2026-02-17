---
phase: 9
plan: 9a
subsystem: identity-verification
tags: [types, authority-level, mdl, digital-credentials-api, government-credentials]
dependency-graph:
  requires: []
  provides: [mdl-types, authority-level-5, digital-credentials-api-types]
  affects: [authority-level, verification-types, session-cache, shadow-atlas-handler, session-credentials, hooks]
tech-stack:
  added: []
  patterns: [w3c-digital-credentials-api, mdl-verification]
key-files:
  created:
    - src/lib/types/digital-credentials.d.ts
  modified:
    - src/lib/core/identity/authority-level.ts
    - src/lib/types/verification.ts
    - src/lib/core/identity/session-cache.ts
    - src/lib/core/identity/shadow-atlas-handler.ts
    - src/lib/core/identity/session-credentials.ts
    - src/hooks.server.ts
decisions:
  - Authority Level 5 allocated to government credentials (mDL/EUDIW), Level 4 remains passport-verified
  - VerificationMethod union type extended with 'mdl' alongside existing 'nfc-passport' and 'government-id'
  - VerificationProvider extended with 'digital-credentials-api' for W3C Digital Credentials API flow
metrics:
  duration: 195s
  completed: 2026-02-17T21:04:07Z
  tasks: 8
  files-modified: 7
---

# Phase 9 Plan 9A: Foundation + Types for Tier 4 (Government Credentials) Summary

Type system and authority level foundation for mDL / EUDIW government credential verification via the W3C Digital Credentials API.

## What Was Done

### Tasks 1-2: Authority Level Mapping (authority-level.ts)
- `trustTierToAuthorityLevel(4)` now returns `5` instead of `4`, allocating the highest authority level to government-issued credentials
- Added `deriveAuthorityLevel()` check for `document_type === 'mdl'` returning Level 5, placed before the Level 4 passport check
- Updated header comment to document Level 5 allocation for government credentials

### Tasks 3-5: Verification Types (verification.ts)
- Extended `VerificationMethod` with `'mdl'`
- Extended `VerificationProvider` with `'digital-credentials-api'`
- Added `mdl` entry to `VERIFICATION_METHODS` constant record with Digital ID metadata
- Updated `isVerificationMethod()` type guard to include `'mdl'`

### Task 6: Session + Handler Types (3 files)
- `session-cache.ts`: Added `'mdl'` to `verificationMethod` union in `SessionCredential`, `StoredCredential`, and deserialization cast (3 locations)
- `shadow-atlas-handler.ts`: Added `'digital-credentials-api'` to `verificationMethod` in `TwoTreeRegistrationRequest` and `TwoTreeRecoveryRequest` (2 locations)
- `session-credentials.ts`: Added `'digital-credentials-api'` to `verificationMethod` in `SessionCredential` and `StoredCredential` (2 locations, required + optional)

### Task 7: Rate Limit Path (hooks.server.ts)
- Added `/api/identity/verify-mdl` to `SENSITIVE_IDENTITY_PATHS` array for CSRF protection

### Task 8: Digital Credentials Type Declarations
- Created `src/lib/types/digital-credentials.d.ts` with W3C Digital Credentials API ambient types
- `DigitalCredentialRequestOptions`, `DigitalCredentialResponse`, `DigitalCredential` class extending `Credential`
- Augments global `CredentialRequestOptions` with `digital` property

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Updated isVerificationMethod type guard**
- **Found during:** Task 3
- **Issue:** Adding 'mdl' to `VerificationMethod` type without updating the runtime type guard would cause `isVerificationMethod('mdl')` to return false
- **Fix:** Added `|| value === 'mdl'` to the type guard function
- **Files modified:** src/lib/types/verification.ts
- **Commit:** 4313b5ea

**2. [Rule 2 - Missing Critical Functionality] Fixed optional verificationMethod in session-credentials.ts**
- **Found during:** Task 6
- **Issue:** Line 159 had `verificationMethod?: 'self.xyz' | 'didit'` (optional variant) that was missed by the plan's line-specific instructions because it uses `?:` not `:`
- **Fix:** Updated the optional variant to include `'digital-credentials-api'`
- **Files modified:** src/lib/core/identity/session-credentials.ts
- **Commit:** 8f7e308e

## Verification

- `svelte-check` passes with zero new errors (2 pre-existing unrelated errors in layout and PrismaClient types)
- All type unions consistently widened across all files
- `VERIFICATION_METHODS` record satisfies `Record<VerificationMethod, VerificationMethodInfo>` with all 3 method entries

## Self-Check: PASSED

All 8 files verified present. All 5 commit hashes verified in git log.
