---
phase: 10
plan: 10c
subsystem: dead-code-cleanup
tags: [refactor, dead-code, types, prover, cwc, env]
dependency_graph:
  requires: []
  provides: [clean-prover-client, typed-cwc-template, env-documentation]
  affects: [prover-client, delivery-worker, cwc-client, cwc-generator]
tech_stack:
  added: []
  patterns: [minimal-interface-pattern, prisma-select-narrowing]
key_files:
  created: []
  modified:
    - src/lib/core/zkp/prover-client.ts
    - src/lib/server/delivery-worker.ts
    - src/lib/core/congress/cwc-client.ts
    - src/lib/core/congress/cwc-generator.ts
    - src/lib/types/template.ts
    - .env.example
    - wrangler.toml
decisions:
  - Use CwcTemplate minimal interface rather than select-and-cast to full Template; avoids touching cwc-generator internals while still removing the unsafe cast
  - ProofGenerator.svelte task was no-op: file does not exist; actual component (ProofGenerationModal.svelte) already uses two-tree only
metrics:
  duration_seconds: 382
  completed: "2026-02-17T23:35:16Z"
  tasks_completed: 4
  files_modified: 7
---

# Phase 10 Plan 10C: Dead Code + Type Cleanup Summary

Single-line: Removed 240 lines of deprecated single-tree prover code, eliminated `as unknown as Template` unsafe cast via CwcTemplate minimal interface, and documented GOOGLE_CIVIC_API_KEY/CWC_PRODUCTION/DC_SESSION_KV in env files.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove legacy single-tree from ProofGenerator.svelte | (no-op) | ProofGenerationModal.svelte already clean |
| 2 | Remove legacy single-tree code from prover-client | 7b5077c6 | src/lib/core/zkp/prover-client.ts |
| 3 | Fix delivery-worker Template cast | 7b989b1f | src/lib/server/delivery-worker.ts, src/lib/types/template.ts, src/lib/core/congress/cwc-client.ts, src/lib/core/congress/cwc-generator.ts |
| 4 | Update env documentation | 5bf20d0a | .env.example, wrangler.toml |

## What Was Done

### Task 1 — ProofGenerator.svelte (No-op)
The file `src/lib/components/proof/ProofGenerator.svelte` does not exist. The actual component is `ProofGenerationModal.svelte`, which already exclusively uses two-tree code (`generateTwoTreeProof`, `credential.credentialType !== 'two-tree'` guard). No changes needed.

### Task 2 — prover-client.ts Legacy Removal
Removed 240 lines of deprecated single-tree proving infrastructure:
- `ProofInputs` interface (marked `@deprecated`)
- `ProofResult` interface (marked `@deprecated`)
- `initializeProver()` function
- `generateProof()` function
- `validateProofInputs()` function
- `proverInstance`, `initPromise`, `currentDepth` module-level singletons
- `resetProver()` function; updated `resetAllProvers()` to call only `resetTwoTreeProver()`
- Removed `getProverForDepth`, `NoirProver`, `CircuitInputs`, `NoirProofResult` imports (single-tree only)
- Updated header comment control flow to document two-tree only

Verified none of these exports were imported elsewhere in the codebase before removal.

### Task 3 — delivery-worker.ts Template Cast
Root cause: `cwcClient.submitToSenate/submitToHouse` expected `Template` (from `$lib/types/template`), but delivery-worker had a bare Prisma `findUnique()` result — requiring `as unknown as Template`.

Fix:
1. Added `CwcTemplate` minimal interface to `$lib/types/template` with only the fields the CWC pipeline actually uses: `id`, `title`, `description`, `message_body`, `delivery_config`
2. Updated `cwc-client.ts` and `cwc-generator.ts` to import `CwcTemplate` instead of `Template`
3. Updated `delivery-worker.ts` to use a Prisma `select` for exactly those 5 fields; the narrowed Prisma result satisfies `CwcTemplate` directly — no cast needed

### Task 4 — Env Documentation
`.env.example`:
- Added `GOOGLE_CIVIC_API_KEY` with description (mDL district derivation, link to Google Cloud Console)
- Expanded `CWC_PRODUCTION` from a commented-out stub to a documented active entry with sandbox vs production warning

`wrangler.toml`:
- Added multi-line comment before `DC_SESSION_KV` explaining what the binding is for and the creation command (`npx wrangler kv namespace create DC_SESSION_KV`)

## Deviations from Plan

### Auto-fixed Issues

None.

### Observations

**Task 1 file discrepancy:** Plan references `ProofGenerator.svelte` but the actual component is `ProofGenerationModal.svelte`. The component was already clean — treated as no-op per the plan's "When in doubt, keep the code" rule.

**Task 3 approach:** Plan offered three options (Prisma type with select/include, minimal interface, or `EmailFlowTemplate`). Used option (b) — minimal `CwcTemplate` interface — because `EmailFlowTemplate` lacks `delivery_config` which `cwc-generator.ts` accesses. This required touching `cwc-client.ts` and `cwc-generator.ts` in addition to `delivery-worker.ts`, but eliminated the unsafe cast without breaking anything.

## Verification

`npx svelte-check` run after all tasks: 18 errors, 95 warnings — all pre-existing (baseline confirmed via `svelte-check-baseline.txt`). Zero errors introduced by this wave.

## Self-Check: PASSED

Files verified:
- src/lib/core/zkp/prover-client.ts — EXISTS, single-tree code removed
- src/lib/server/delivery-worker.ts — EXISTS, no Template cast
- src/lib/types/template.ts — EXISTS, CwcTemplate interface added
- src/lib/core/congress/cwc-client.ts — EXISTS, uses CwcTemplate
- src/lib/core/congress/cwc-generator.ts — EXISTS, uses CwcTemplate
- .env.example — EXISTS, GOOGLE_CIVIC_API_KEY and CWC_PRODUCTION documented
- wrangler.toml — EXISTS, DC_SESSION_KV comment added

Commits verified:
- 7b5077c6 — refactor(10-10c): remove legacy single-tree code from prover-client
- 7b989b1f — refactor(10-10c): fix delivery-worker Template cast with CwcTemplate interface
- 5bf20d0a — refactor(10-10c): update env documentation for new vars and CF bindings
