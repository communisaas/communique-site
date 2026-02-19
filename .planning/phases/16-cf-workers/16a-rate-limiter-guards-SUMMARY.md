---
phase: "16"
plan: "a"
subsystem: "security/rate-limiting"
tags: [cloudflare-workers, rate-limiting, compatibility]
dependency-graph:
  requires: []
  provides: [workers-compatible-rate-limiters]
  affects: [hooks.server.ts, llm-cost-protection, exa-client, firecrawl-client, analytics]
tech-stack:
  added: []
  patterns: [runtime-guards, typeof-checks, per-isolate-warnings]
key-files:
  modified:
    - src/lib/core/security/rate-limiter.ts
    - src/lib/server/rate-limiter.ts
    - src/lib/core/analytics/aggregate.ts
    - src/lib/server/exa/rate-limiter.ts
    - src/lib/server/firecrawl/rate-limiter.ts
decisions:
  - "Kept all in-memory stores rather than deleting -- they still work for dev and single-request throttling"
  - "Used typeof setInterval guard instead of try/catch for cleaner runtime detection"
  - "Detected Workers via typeof caches !== undefined (Workers-specific global) for warning"
metrics:
  duration: "153s"
  completed: "2026-02-19T07:36:01Z"
---

# Phase 16 Plan A: Rate Limiter CF Workers Guards Summary

Runtime guards and warnings for all in-memory rate limiters to prevent crashes on CF Workers isolates

## Changes Made

### 1. `src/lib/core/security/rate-limiter.ts` (hooks.server.ts rate limiter)
- Wrapped `setInterval` in `InMemoryStore` constructor with `typeof setInterval !== 'undefined'` guard
- Changed `cleanupInterval` type to allow `undefined`
- Added `if` guard in `destroy()` before `clearInterval`
- Added Workers environment detection in `getRateLimiter()` that logs a warning when in-memory store is used on Workers (detected via `typeof caches !== 'undefined'`)
- Process exit handlers already had `typeof process !== 'undefined'` guard -- no change needed

### 2. `src/lib/server/rate-limiter.ts` (LLM cost protection + documents API)
- Wrapped `setInterval` in constructor with `typeof setInterval !== 'undefined'` guard
- Changed `cleanupInterval` type from `NodeJS.Timeout` to `NodeJS.Timeout | undefined`
- Added `if` guard in `destroy()` before `clearInterval`
- Process exit handlers already had `typeof process !== 'undefined'` guard -- no change needed

### 3. `src/lib/core/analytics/aggregate.ts` (contribution rate limiter)
- Added warning comment above `checkContributionLimit()`: in-memory Map does not work on CF Workers, use `RATE_LIMIT_USE_DB=true` for production
- Did NOT delete the fallback -- it's used when DB rate limiting is disabled

### 4. `src/lib/server/exa/rate-limiter.ts` (Exa API circuit breaker)
- Added NOTE to module docblock: per-isolate state reset on Workers, proactive throttling within a single request still works, circuit breaker across requests does not
- No setInterval calls exist -- no guards needed

### 5. `src/lib/server/firecrawl/rate-limiter.ts` (Firecrawl circuit breaker)
- Added same NOTE to module docblock about per-isolate state limitations
- No setInterval calls exist -- no guards needed

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passed with no new errors (2 pre-existing errors in unrelated test files)
- All 5 files modified, no files deleted
- No new dependencies introduced

## Commits

| Hash | Message |
|------|---------|
| 8cae82dd | fix(16a): guard rate limiters for CF Workers compatibility |

## Self-Check: PASSED

All 5 modified files exist on disk. Commit 8cae82dd verified in git log.
