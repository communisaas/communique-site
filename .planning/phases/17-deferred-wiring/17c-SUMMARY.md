---
phase: "17"
plan: "c"
subsystem: "proof-pipeline, scope-filtering, identity-webhook"
tags: [zk-proofs, scope-filtering, deprecated-removal, comment-cleanup]
dependency-graph:
  requires: [shadow-atlas-registration, two-tree-proofs]
  provides: [action-domain-wiring, county-district-matching]
  affects: [submissions-api, proof-generator, scope-filtering, didit-webhook]
tech-stack:
  patterns: [early-return-error-for-stale-credentials, nullish-coalescing-fallback]
key-files:
  modified:
    - src/routes/api/submissions/create/+server.ts
    - src/lib/components/template/ProofGenerator.svelte
    - src/lib/core/location/scope-filtering.ts
    - src/routes/api/identity/didit/webhook/+server.ts
decisions:
  - "Use nullish coalescing (??) for action_id fallback to templateId for legacy submissions"
  - "Hard error + re-verify prompt for stale single-tree credentials instead of silent failure"
  - "Remove legacy witness encryption branch as dead code after single-tree removal"
metrics:
  duration: "7m 37s"
  completed: "2026-02-19T07:59:02Z"
  tasks: 4
  files: 4
---

# Phase 17 Plan C: Wire Deferred Features and Remove Deprecated Single-Tree Flow Summary

JWT-style action domain extraction from ZK public inputs, deprecated single-tree prover removal with re-verify UX, and county/district scope matching against template specific_locations.

## Tasks Completed

| Task | Description | Commit |
|------|------------|--------|
| 1 | Extract action_id from ZK public inputs (actionDomain) | c2feaed9 |
| 2 | Remove deprecated single-tree proof flow, replace with error + re-verify | c2feaed9 |
| 3 | Wire county/district matching against template.specific_locations | c2feaed9 |
| 4 | Update Shadow Atlas registration comment to reflect actual architecture | c2feaed9 |

## Changes Detail

### Task 1: action_id from ZK Public Inputs
**File:** `src/routes/api/submissions/create/+server.ts`

Replaced hardcoded `action_id: templateId` with extraction from the structured public inputs payload:
```ts
const publicInputsTyped = publicInputs as Record<string, unknown> | undefined;
action_id: (publicInputsTyped?.actionDomain as string) ?? templateId,
```
The `templateId` fallback preserves backward compatibility for any legacy or non-proof submissions.

### Task 2: Remove Deprecated Single-Tree Flow
**File:** `src/lib/components/template/ProofGenerator.svelte`

Removed ~55 lines of deprecated single-tree prover code (orchestrator import, poseidonHash call, old witness construction, old prove() call, result handling). Replaced with a hard error state that prompts re-verification:
```ts
proofState = {
    status: 'error',
    message: 'Your verification credential needs to be updated. Please re-verify your identity to continue.',
    recoverable: true,
    retryAction: () => { oncancel?.(); }
};
```

Also removed the legacy witness encryption else branch (dead code since the else branch now returns early) and simplified the witness construction to a direct `WitnessData` type without the `Record<string, unknown>` union.

### Task 3: Scope-Filtering County/District Matching
**File:** `src/lib/core/location/scope-filtering.ts`

Replaced stub implementations with actual matching logic:
- **County:** Early return false if insufficient precision, accept any county-level user if template has no specific_locations, otherwise match `county_fips` against `template.specific_locations`
- **District:** Early return false if insufficient precision, accept any district-level user if template has no specific_locations, otherwise exact match `congressional_district` against `template.specific_locations`

Left stubs C and D (state/district COUNT estimates at lines ~210-225) as-is per plan -- they require aggregation infrastructure.

### Task 4: Shadow Atlas Registration Comment Cleanup
**File:** `src/routes/api/identity/didit/webhook/+server.ts`

Replaced 9-line TODO block with 5-line architectural comment explaining the intentional split between identity verification (this webhook) and Shadow Atlas registration (separate address collection step). Changed log message from "generated" to "stored" to reflect actual semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Dead code] Removed legacy witness encryption branch**
- **Found during:** Task 2
- **Issue:** After replacing the single-tree proof path with a hard error + return, the witness encryption section still had an else branch for legacy single-tree credentials. This branch was now unreachable dead code.
- **Fix:** Removed the conditional and legacy else branch, simplified `witnessForEncryption` to direct `WitnessData` type assignment, removed unnecessary `as WitnessData` cast on `encryptWitness()` call.
- **Files modified:** `src/lib/components/template/ProofGenerator.svelte`
- **Commit:** c2feaed9

## Verification

- svelte-check: 1 pre-existing error (template-modal recipient_config type), 88 pre-existing warnings. No new errors introduced.
- All 4 files modified as planned.
- Single atomic commit covering all tasks.

## Self-Check: PASSED
