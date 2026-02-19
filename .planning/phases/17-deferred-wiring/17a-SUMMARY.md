---
phase: "17"
plan: "a"
subsystem: "integrity"
tags: [honesty, stubs, error-handling, blockchain, cwc, legislative]
dependency-graph:
  requires: []
  provides: ["honest-failure-modes", "zero-address-detection"]
  affects: ["cwc-adapter", "voter-client", "address-lookup", "profile", "template-modal"]
tech-stack:
  added: []
  patterns: ["zero-address-guard", "config-check-before-operation", "honest-error-return"]
key-files:
  created: []
  modified:
    - src/lib/core/legislative/adapters/cwc/cwcAdapter.ts
    - src/lib/core/blockchain/voter-client.ts
    - src/lib/core/congress/address-lookup.ts
    - src/routes/profile/+page.server.ts
    - src/lib/components/template/TemplateModal.svelte
decisions:
  - "CWC submitToCWCAPI returns { success: false } with error message instead of throwing"
  - "Blockchain zero-address detection uses lastInitConfig to avoid accessing private VOTERClient.config"
  - "House rep lookup re-throws instead of returning fake placeholder data"
  - "Senator lookup returns empty array instead of fake placeholders"
  - "TemplateModal recipientOffices reads from template.recipient_config with fallback to default"
metrics:
  duration: "~16 min"
  completed: "2026-02-19T07:50:33Z"
---

# Phase 17 Plan A: Replace Fake Success Stubs with Honest Failure Summary

CWC adapter returns honest failure when API is unconfigured; blockchain client detects zero-address contracts and returns 'skipped' status; address lookup removes synthetic representatives; profile wires real campaign data; TemplateModal reads recipient config from template.

## Changes Made

### Task 1: CWC API Placeholder -> Honest Error
- `submitToCWCAPI()`: checks `this._apiKey` before attempting submission; returns `{ success: false, error: '...' }` if unconfigured, instead of fake `{ success: true, submissionId: 'CWC_PLACEHOLDER_...' }`
- `validateRepresentative()`: added `console.warn` to surface that validation is not implemented
- `getRepresentatives()`: added `console.warn` explaining the stub and pointing to address-lookup.ts

### Task 2: Blockchain Zero Addresses -> Config Check
- Added `isZeroAddress()` utility function and `lastInitConfig` to track config without accessing private `VOTERClient.config`
- `getUserStats()`: logs warning when reputation registry is at zero address
- `getPlatformStats()`: logs warning when reputation registry is at zero address
- `recordAction()`: returns `status: 'skipped'` instead of `status: 'pending'` when contracts not deployed

### Task 3: Placeholder Representatives -> Honest Empty (committed in 17b)
- House rep catch block: re-throws error with structured logging instead of returning fake `{ name: 'Representative for ...' }`
- Senator catch block + empty result: returns `[]` with structured logging instead of fake senator objects
- Already committed in `01827710` (wave 17b overlapped)

### Task 4: Profile Campaigns -> Read Real Data (committed in 17b)
- Replaced `const campaigns: Array<...> = []` with `const campaigns = template.template_campaign`
- Already committed in `01827710` (wave 17b overlapped)

### Task 5: TemplateModal Hardcoded Offices -> Template Config
- Replaced hardcoded `['Senate', 'House']` with IIFE that reads `template.recipient_config?.chambers` with safe casting and fallback to `['Senate', 'House']`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed private property access on VOTERClient**
- **Found during:** Task 2
- **Issue:** `client.config.reputationRegistryAddress` fails because `config` is private in `VOTERClient`
- **Fix:** Added `lastInitConfig` module-level variable that stores the config object at init time, accessed by wrapper functions instead
- **Files modified:** `src/lib/core/blockchain/voter-client.ts`
- **Commit:** `781ea265`

### Overlap with Wave 17b

Tasks 3 and 4 (address-lookup.ts placeholder removal and profile campaign wiring) were already committed in wave 17b (`01827710`). The changes are identical -- this wave's plan overlapped with 17b's error-handling sweep.

## Commits

| Commit | Description | Files |
|--------|-------------|-------|
| `01827710` | fix(17b): structured error logging (includes Tasks 3-4) | address-lookup.ts, profile/+page.server.ts |
| `781ea265` | fix(17a): replace fake success stubs with honest failure modes | cwcAdapter.ts, voter-client.ts, TemplateModal.svelte |

## Self-Check: PASSED

All 6 files verified present. Both commits (781ea265, 01827710) confirmed in git log.
