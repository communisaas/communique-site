---
phase: 8
plan: 8a
subsystem: infrastructure
tags: [als, cloudflare-workers, security, error-sanitization]
dependency-graph:
  requires: [db.ts ALS infrastructure, delivery-worker.ts, submission endpoints]
  provides: [ALS-safe background delivery, sanitized client errors]
  affects: [submission create flow, retry flow, status polling]
tech-stack:
  added: []
  patterns: [explicit-db-passthrough for waitUntil, getRequestClient() for ALS escape hatch]
key-files:
  created: []
  modified:
    - src/lib/core/db.ts
    - src/lib/server/delivery-worker.ts
    - src/routes/api/submissions/create/+server.ts
    - src/routes/api/submissions/[id]/retry/+server.ts
    - src/routes/api/submissions/[id]/status/+server.ts
decisions:
  - Export getRequestClient() from db.ts to capture concrete client outside ALS scope
  - Use optional db parameter with ALS fallback for backward compatibility
metrics:
  duration: 175s
  completed: 2026-02-17T07:27:24Z
  tasks: 3/3
  files: 5
---

# Phase 8 Wave 8A: ALS Safety + Error Sanitization Summary

Explicit PrismaClient passthrough for waitUntil callbacks plus delivery error sanitization to prevent internal detail leakage.

## What Was Done

### Task 1: Fix delivery-worker.ts ALS dependency
- Added optional `db?: typeof prisma` parameter to `processSubmissionDelivery()`
- Internal variable `client = db ?? prisma` provides backward compatibility
- Replaced all 5 `prisma.*` calls inside the function body with `client.*`
- Import of `prisma` retained for type annotation and fallback default

### Task 2: Update callers to pass PrismaClient
- Exported `getRequestClient()` from `db.ts` -- resolves the concrete PrismaClient from ALS store while still in request context
- Updated submission create endpoint (`/api/submissions/create`) to call `getRequestClient()` and pass result to `processSubmissionDelivery()`
- Updated retry endpoint (`/api/submissions/[id]/retry`) with the same pattern
- Both capture the client BEFORE the response is sent, ensuring the concrete client (not the ALS-backed Proxy) is available in `waitUntil()` callbacks

### Task 3: Sanitize delivery_error in status endpoint
- Status endpoint (`/api/submissions/[id]/status`) no longer returns raw `delivery_error`
- Maps any truthy `delivery_error` to a generic user-safe message
- Raw error remains in the database for admin/debugging purposes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getRequestClient() export to db.ts**
- **Found during:** Task 2
- **Issue:** Plan suggested `const db = prisma` to "capture" the client, but `prisma` is a Proxy that lazily reads from ALS on every property access. Capturing it doesn't snapshot the underlying client -- it just gets another reference to the same Proxy. When `waitUntil()` runs after the response, ALS store is gone and the Proxy would throw.
- **Fix:** Added `getRequestClient()` export to `db.ts` that calls the existing private `getInstance()` function, returning the concrete PrismaClient. This is the minimal change needed -- it doesn't modify ALS infrastructure, just exposes a way to get the resolved client.
- **Files modified:** `src/lib/core/db.ts`
- **Commit:** 265a0e92

## Verification

- TypeScript compilation: 0 new errors introduced (1 pre-existing error in db.ts Proxy cast is unrelated)
- All `prisma.*` references inside `processSubmissionDelivery` replaced with `client.*`
- Both callers pass concrete client via `getRequestClient()` before response
- Status endpoint returns sanitized error string, not raw internal error

## Commits

| Task | Commit     | Message                                                     |
| ---- | ---------- | ----------------------------------------------------------- |
| 1    | c93270e9   | fix(8-8a): add explicit db parameter to delivery worker     |
| 2    | 265a0e92   | fix(8-8a): capture concrete PrismaClient for waitUntil      |
| 3    | e451994d   | fix(8-8a): sanitize delivery_error in status endpoint       |

## Self-Check: PASSED

All 5 modified files found on disk. All 3 task commits verified in git log.
