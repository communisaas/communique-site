---
phase: 16
plan: b
subsystem: infrastructure
tags: [cloudflare-workers, caching, dead-code]
dependency-graph:
  requires: []
  provides: [cf-workers-cache-compat]
  affects: [rate-limit-db, coordination-metrics]
tech-stack:
  added: []
  patterns: [per-isolate-cache-awareness]
key-files:
  created: []
  modified:
    - src/lib/core/analytics/rate-limit-db.ts
    - src/lib/core/metrics/coordination-metrics.ts
  deleted:
    - src/lib/server/llm-cache.ts
decisions:
  - Delete llm-cache.ts (zero callers confirmed via grep)
  - Keep localCache in rate-limit-db (DB is authoritative, cache is optimization)
  - Keep coordination-metrics cache (acceptable per-isolate reset for 5-min TTL)
  - setInterval guard already present in rate-limit-db (no change needed)
metrics:
  duration: 78s
  completed: 2026-02-19T07:35:00Z
---

# Wave 16B: Fix In-Memory Caches for CF Workers Compatibility Summary

Deleted unused LLM cache module and added per-isolate awareness comments to rate-limit and subgraph caches that correctly degrade on Workers.

## Changes Made

### 1. Deleted `src/lib/server/llm-cache.ts` (Dead Code)

Verified via grep that `extractWithLLMCached`, `getCachedLLMExtraction`, and `setCachedLLMExtraction` have zero callers outside the file itself. No imports of `llm-cache` exist anywhere in `src/`. The file contained a module-level `Map` with 90-day TTL that would be meaningless on Workers. Deleted entirely.

### 2. `src/lib/core/analytics/rate-limit-db.ts` — Workers Comment Added

The `localCache` Map at line 441 is an optimization for fast-path rejection of known rate-limit violators. The DB is authoritative; the cache just avoids a DB round-trip for repeat offenders. On Workers, each isolate starts with an empty cache -- this is acceptable since the DB check still works correctly.

The `setInterval` guard at line 519 was **already present** (`typeof setInterval !== 'undefined'`), so no code change was needed there. Only the documentation comment was added.

### 3. `src/lib/core/metrics/coordination-metrics.ts` — Workers Comment Added

The subgraph query cache at line 24 has a 5-minute TTL. On Workers, each isolate will re-fetch from the subgraph independently. This is acceptable -- the cache only provides value within a long-running isolate and the subgraph can handle the additional queries.

## Deviations from Plan

### Auto-observed (no fix needed)

**1. [Observation] setInterval in rate-limit-db.ts already guarded**
- **Found during:** Task 2
- **Issue:** Plan asked to wrap `setInterval` in `typeof setInterval !== 'undefined'` guard, but this guard was already present at line 519
- **Action:** No code change needed; added only the Workers documentation comment on `localCache`

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| 88c2544e | fix(16b): guard in-memory caches for CF Workers compatibility | 3 files (1 deleted, 2 modified) |

## Self-Check: PASSED

- CONFIRMED: src/lib/server/llm-cache.ts deleted
- FOUND: commit 88c2544e
- FOUND: Workers comment in rate-limit-db.ts (line 441)
- FOUND: Workers comment in coordination-metrics.ts (line 24)
