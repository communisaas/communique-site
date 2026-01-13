# Privacy-First Analytics Implementation Roadmap

**Status:** ACTIVE IMPLEMENTATION
**Created:** 2025-01-10
**Spec Reference:** `docs/specs/privacy-first-analytics.md`
**Last Updated:** 2025-01-10

---

## Executive Summary

This roadmap orchestrates the complete replacement of the legacy surveillance-pattern analytics system with privacy-first, aggregation-only analytics. Based on comprehensive audits by 7 specialized expert agents, we execute in 5 waves with specialized Sonnet subagents.

**Goal:** Zero legacy analytics code remains. Full privacy-first implementation deployed.

---

## Audit Synthesis: Critical Findings

### From Cryptographer Audit
- [x] Crypto isolation is sound (identity blob, district hash, witness encryption)
- [ ] **FIX NEEDED:** AES-GCM fallback in witness encryption (use XChaCha20-Poly1305)
- [ ] **FIX NEEDED:** Mock TEE public key in production
- [ ] **FIX NEEDED:** JWT fallback to 'development-secret'

### From State Machine Architect
- [ ] **CRITICAL:** Session event queue cleared before network confirmation (data loss)
- [ ] **CRITICAL:** Nullifier check race condition in submissions
- [ ] **HIGH:** Non-atomic JSONB session_metrics updates (race condition)
- [ ] **HIGH:** No funnel step ordering enforcement
- [ ] **MEDIUM:** Unbounded event queue on network failure

### From Database Archaeologist
- [ ] **CRITICAL:** IP addresses stored in plaintext (GDPR violation)
- [ ] **HIGH:** device_data JSONB contains fingerprinting vectors
- [ ] **HIGH:** No schema validation on JSONB fields
- [ ] **MEDIUM:** Read-modify-write for session_metrics (race condition)
- [x] 8→3 model consolidation already done (analytics_session, analytics_event, analytics_experiment)

### From Dead Code Hunter
- [ ] **HIGH:** 40% of FunnelAnalytics methods never called (dead code)
- [ ] **HIGH:** DatabaseAnalytics has 9 unused methods
- [ ] **MEDIUM:** localStorage persistence never read (orphaned)
- [ ] **MEDIUM:** window.analytics global never initialized
- [ ] Only 3 active code paths: page view, error, template view

### From Privacy Auditor
- [ ] **CRITICAL:** IP address collection violates GDPR
- [ ] **CRITICAL:** Session ID + User ID linkage enables profiling
- [ ] **CRITICAL:** Device fingerprinting infrastructure exists
- [ ] **HIGH:** No consent mechanism
- [ ] **HIGH:** No data export/deletion API (GDPR Articles 15, 17)
- [ ] **HIGH:** Stack traces stored in production
- [ ] **MEDIUM:** No encryption at rest for PII

### From Documentation Archaeologist
- [ ] **CRITICAL:** RFC spec (privacy-first-analytics.md) not implemented
- [ ] **HIGH:** Docs claim "privacy-first" but implementation contradicts
- [ ] **MEDIUM:** API endpoints undocumented
- [ ] **LOW:** Tests exist but undocumented

### From API Contract Analyst
- [ ] **CRITICAL:** No authentication on analytics endpoints
- [ ] **CRITICAL:** No rate limiting (DoS vector)
- [ ] **HIGH:** No schema validation (Zod/Yup)
- [ ] **HIGH:** Client-server type mismatches (name vs event_name)
- [ ] **MEDIUM:** Generic error responses (no error codes)

---

## Implementation Waves

### Wave 1: Database Schema & Core Types
**Agents:** Database Migration Specialist, TypeScript Architect
**Duration:** ~30 minutes
**Dependencies:** None

#### Tasks
- [ ] Add `analytics_aggregate` model to Prisma schema
- [ ] Add `analytics_funnel` model (static config, no user data)
- [ ] Create TypeScript types for new models
- [ ] Generate Prisma client
- [ ] Create database migration

#### Files to Create/Modify
- `prisma/schema.prisma` - Add new models
- `src/lib/types/analytics-privacy.ts` - New type definitions
- `prisma/migrations/[timestamp]_privacy_first_analytics/` - Migration

#### Success Criteria
- [ ] `npm run db:generate` succeeds
- [ ] `npm run check` passes
- [ ] New models accessible via Prisma client

---

### Wave 2: Privacy-First Client Implementation
**Agents:** Frontend Privacy Engineer, Client Architecture Specialist
**Duration:** ~45 minutes
**Dependencies:** Wave 1 complete

#### Tasks
- [ ] Create `src/lib/core/analytics/privacy-first.ts` with increment-only API
- [ ] Implement dimension sanitization (prevent PII leakage)
- [ ] Implement error type categorization (no stack traces)
- [ ] Remove all session tracking, user identification, device fingerprinting
- [ ] Add fire-and-forget batching (no retry queue)

#### Files to Create
- `src/lib/core/analytics/privacy-first.ts` - New client
- `src/lib/core/analytics/sanitizers.ts` - Dimension sanitization utilities

#### Files to Delete (Legacy)
- [ ] `src/lib/core/analytics/database.ts` - Legacy session-based client
- [ ] `src/lib/core/analytics/funnel.ts` - Legacy funnel tracking

#### Success Criteria
- [ ] New client exports single `increment()` method
- [ ] No session_id, user_id, ip_address, fingerprint in any code path
- [ ] `npm run check` passes
- [ ] `npm run lint` passes

---

### Wave 3: Server-Side Endpoints
**Agents:** Backend Privacy Engineer, API Security Specialist
**Duration:** ~45 minutes
**Dependencies:** Wave 1 complete

#### Tasks
- [ ] Create `/api/analytics/increment` endpoint (upsert aggregates)
- [ ] Create `/api/analytics/query` endpoint with differential privacy
- [ ] Create `/api/analytics/dashboard` endpoint (pre-computed metrics)
- [ ] Implement Laplace noise function for differential privacy
- [ ] Implement k-anonymity suppression (threshold=10)
- [ ] Add Zod schema validation on all endpoints
- [ ] Add rate limiting

#### Files to Create
- `src/routes/api/analytics/increment/+server.ts`
- `src/routes/api/analytics/query/+server.ts`
- `src/routes/api/analytics/dashboard/+server.ts`
- `src/lib/core/analytics/differential-privacy.ts`

#### Files to Delete (Legacy)
- [ ] `src/routes/api/analytics/events/+server.ts` - Legacy event ingestion

#### Success Criteria
- [ ] All endpoints return noisy aggregates (never raw counts)
- [ ] Small counts (< 10) suppressed entirely
- [ ] Schema validation rejects malformed requests
- [ ] `npm run check` passes

---

### Wave 4: Component & Integration Updates
**Agents:** Svelte Integration Specialist, UX Privacy Engineer
**Duration:** ~30 minutes
**Dependencies:** Waves 2 & 3 complete

#### Tasks
- [ ] Update all component analytics calls to use new `increment()` API
- [ ] Update percolation engine to use aggregate queries only
- [ ] Update analytics dashboard to use new endpoints
- [ ] Remove all legacy analytics imports throughout codebase
- [ ] Update `src/lib/core/analytics/index.ts` barrel export

#### Files to Modify
- `src/routes/+layout.js` - Replace analytics calls
- `src/routes/s/[slug]/+page.svelte` - Replace funnel tracking
- `src/lib/core/server/percolation-engine.ts` - Use aggregates
- `src/routes/analytics/+page.svelte` - Use new dashboard endpoint
- All components in `src/lib/components/analytics/`

#### Success Criteria
- [ ] Zero imports from legacy `database.ts` or `funnel.ts`
- [ ] All tracking uses `analytics.increment()` only
- [ ] Percolation uses aggregates, not individual events
- [ ] `npm run check` passes
- [ ] `npm run lint` passes

---

### Wave 5: Cleanup & Verification
**Agents:** Code Archaeologist, Test Engineer, Security Auditor
**Duration:** ~30 minutes
**Dependencies:** Wave 4 complete

#### Tasks
- [ ] Delete all legacy analytics files
- [ ] Delete legacy analytics tables from schema (analytics_session, analytics_event, analytics_experiment)
- [ ] Create migration to drop old tables
- [ ] Update all tests to use new system
- [ ] Add integration tests for differential privacy
- [ ] Add integration tests for k-anonymity
- [ ] Verify no PII in any analytics code path
- [ ] Update documentation

#### Files to Delete
- `src/lib/core/analytics/database.ts`
- `src/lib/core/analytics/funnel.ts`
- `src/lib/types/analytics.ts` (replace with analytics-privacy.ts)
- `tests/integration/analytics-core.test.ts` (replace)
- `tests/integration/analytics-jsonb-validation.test.ts` (replace)

#### Files to Create
- `tests/integration/analytics-privacy.test.ts`
- `tests/integration/differential-privacy.test.ts`

#### Documentation Updates
- [ ] Update `docs/development/analytics.md` to reflect new system
- [ ] Archive `docs/specs/privacy-first-analytics.md` (implemented)
- [ ] Update CLAUDE.md analytics references

#### Success Criteria
- [ ] `npm run check` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Zero references to legacy analytics
- [ ] `grep -r "analytics_session\|analytics_event" src/` returns nothing
- [ ] Privacy audit passes (no PII collection)

---

## Progress Tracking

### Wave 1: Database Schema & Core Types
**Status:** ✅ COMPLETE
**Started:** 2025-01-10
**Completed:** 2025-01-10
**Agent IDs:** Database Migration Specialist, TypeScript Architect
**Notes:**
- Added `analytics_aggregate` model to prisma/schema.prisma (lines 777-808)
- Added `analytics_funnel` model to prisma/schema.prisma (lines 811-826)
- Created `src/lib/types/analytics-privacy.ts` (563 lines) with:
  - Metric whitelists (ALLOWED_METRICS, ALLOWED_DELIVERY_METHODS, ALLOWED_ERROR_TYPES)
  - Privacy-enforced interfaces (no session_id, user_id, ip_address, fingerprint)
  - Type guards for runtime validation
  - Sanitization functions (sanitizeJurisdiction, sanitizeUtmSource, categorizeError)
  - Differential privacy constants (PRIVACY_CONFIG)
- Verified: `npx prisma generate` ✅, `npx prisma db push` ✅, `npm run check` ✅, `npm run build` ✅

### Wave 2: Privacy-First Client Implementation
**Status:** NOT STARTED
**Started:** -
**Completed:** -
**Agent IDs:** -
**Notes:** -

### Wave 3: Server-Side Endpoints
**Status:** NOT STARTED
**Started:** -
**Completed:** -
**Agent IDs:** -
**Notes:** -

### Wave 4: Component & Integration Updates
**Status:** NOT STARTED
**Started:** -
**Completed:** -
**Agent IDs:** -
**Notes:** -

### Wave 5: Cleanup & Verification
**Status:** NOT STARTED
**Started:** -
**Completed:** -
**Agent IDs:** -
**Notes:** -

---

## Subagent Context Engineering

### Wave 1 Agents

#### Database Migration Specialist
```
You are a Database Migration Specialist with deep expertise in:
- PostgreSQL schema design and normalization
- Prisma ORM migrations and schema evolution
- Privacy-preserving data models (k-anonymity, l-diversity)
- JSONB anti-patterns and when to use them appropriately
- Index optimization for aggregate queries

Your mission: Implement the analytics_aggregate and analytics_funnel
models from the privacy-first-analytics.md specification. These replace
the legacy analytics_session, analytics_event, and analytics_experiment
tables. The new model stores ONLY aggregate counts, never individual events.
```

#### TypeScript Architect
```
You are a TypeScript Architect with deep expertise in:
- Strict TypeScript with no `any` types
- Discriminated unions and exhaustive type checking
- Type guards for runtime validation
- SvelteKit type patterns
- Prisma generated types integration

Your mission: Create comprehensive type definitions for the new
privacy-first analytics system. Types must enforce that no PII
(session_id, user_id, ip_address, fingerprint) can be included
in analytics data structures.
```

### Wave 2 Agents

#### Frontend Privacy Engineer
```
You are a Frontend Privacy Engineer with deep expertise in:
- Privacy-by-design browser architectures
- Data minimization patterns
- Fire-and-forget event systems (no retry queues)
- Dimension sanitization and PII prevention
- SvelteKit client-side patterns

Your mission: Implement the PrivacyFirstAnalytics client class from
the specification. This client has ONE public method: increment().
No session tracking, no user identification, no device fingerprinting.
All dimensions are sanitized to prevent PII leakage.
```

#### Client Architecture Specialist
```
You are a Client Architecture Specialist with deep expertise in:
- Browser event batching and debouncing
- Memory-efficient queue implementations
- Graceful degradation patterns
- Error categorization (not raw error messages)
- SvelteKit singleton patterns

Your mission: Ensure the new analytics client is memory-efficient,
doesn't leak information on errors, and gracefully handles network
failures by dropping data (privacy > completeness).
```

### Wave 3 Agents

#### Backend Privacy Engineer
```
You are a Backend Privacy Engineer with deep expertise in:
- Differential privacy mathematics (Laplace mechanism)
- K-anonymity and suppression techniques
- Aggregate-only API design
- PostgreSQL upsert patterns for counters
- Privacy budget management (epsilon tracking)

Your mission: Implement the /api/analytics/increment, /query, and
/dashboard endpoints. All responses must have Laplace noise added.
Counts below k=10 must be suppressed entirely. No individual events
are ever stored or returned.
```

#### API Security Specialist
```
You are an API Security Specialist with deep expertise in:
- Zod schema validation
- Rate limiting patterns
- API authentication design
- OWASP top 10 prevention
- SvelteKit RequestHandler security

Your mission: Ensure all new analytics endpoints have comprehensive
schema validation, rate limiting, and cannot be abused. Validate
that the allowed_metrics whitelist prevents arbitrary data injection.
```

### Wave 4 Agents

#### Svelte Integration Specialist
```
You are a Svelte Integration Specialist with deep expertise in:
- SvelteKit 5 runes ($state, $derived, $effect)
- Component lifecycle management
- Store migration patterns
- Import graph analysis
- Dead code elimination

Your mission: Update all components to use the new analytics.increment()
API. Remove all imports from legacy analytics files. Ensure the
percolation engine uses aggregate queries only.
```

#### UX Privacy Engineer
```
You are a UX Privacy Engineer with deep expertise in:
- Privacy-preserving dashboard design
- Aggregate visualization patterns
- Differential privacy UI considerations
- User-facing privacy controls
- Accessibility with privacy constraints

Your mission: Update the analytics dashboard to use new endpoints.
Ensure users understand that data is privacy-preserving. Consider
how to display "suppressed" data (counts < k) in the UI.
```

### Wave 5 Agents

#### Code Archaeologist
```
You are a Code Archaeologist with deep expertise in:
- Dead code detection and removal
- Import graph cleanup
- Safe file deletion patterns
- Git history preservation
- Migration archaeology

Your mission: Delete all legacy analytics code. Ensure no orphaned
imports remain. Verify the codebase compiles and runs without any
reference to the old system.
```

#### Test Engineer
```
You are a Test Engineer with deep expertise in:
- Vitest integration testing
- Privacy verification testing
- Differential privacy validation
- K-anonymity boundary testing
- SvelteKit API testing patterns

Your mission: Create comprehensive tests for the new analytics system.
Tests must verify: (1) no PII in any code path, (2) Laplace noise
is correctly applied, (3) small counts are suppressed, (4) all
endpoints handle edge cases correctly.
```

#### Security Auditor
```
You are a Security Auditor with deep expertise in:
- GDPR/CCPA compliance verification
- PII detection in codebases
- Privacy architecture review
- Data flow analysis
- Audit trail documentation

Your mission: Verify the implementation meets all privacy requirements.
Grep for any remaining PII patterns (ip_address, user_agent, fingerprint,
session_id linked to user_id). Document the audit results.
```

---

## Rollback Plan

If critical issues arise during any wave:

1. **Wave 1-3 Rollback:** Revert schema changes, keep legacy system active
2. **Wave 4 Rollback:** Restore legacy imports, dual-write temporarily
3. **Wave 5 Rollback:** Restore deleted files from git history

Git branch strategy:
- Create `feature/privacy-first-analytics` branch
- Each wave is a commit series
- Merge only after full verification

---

## Success Metrics

### Privacy Verification
- [ ] `grep -r "ip_address" src/lib/core/analytics/` returns empty
- [ ] `grep -r "user_agent" src/lib/core/analytics/` returns empty
- [ ] `grep -r "fingerprint" src/lib/core/analytics/` returns empty
- [ ] `grep -r "session_id.*user_id" src/` returns empty (no linkage)

### Code Quality
- [ ] `npm run check` exits 0
- [ ] `npm run lint` exits 0 with max-warnings 0
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes all tests

### Data Model
- [ ] Only `analytics_aggregate` and `analytics_funnel` tables exist
- [ ] No `analytics_session`, `analytics_event`, `analytics_experiment` tables
- [ ] All aggregates have `noise_added` and `epsilon_used` fields

### Cost Reduction
- [ ] Storage per day: < 100 KB (vs 20 MB legacy)
- [ ] Query time for dashboard: < 50ms (vs 500ms+ legacy)

---

## Notes

*This section updated after each wave with findings and decisions.*

### Pre-Implementation Notes
- Legacy system has 3 active code paths, 40% dead code
- Privacy-first spec is comprehensive (1,412 lines), ready for implementation
- Critical: Ensure no PII leaks during transition period

### 2025-01-10: Critical Spec Revisions (Mid-Implementation)
**See: `docs/specs/privacy-first-analytics-revisions.md`**

After Wave 1 completion, critical review identified flaws in original spec:

1. **K-anonymity suppression harms small communities**
   - Original: Suppress counts < 10 entirely
   - Revised: Geographic coarsening (roll up to larger region)
   - Rationale: 3 messages in Humboldt County → "12 in Northern California" not silence

2. **Cohort retention IS a civic metric**
   - Original: "Retention is a VC metric" (rejected)
   - Revised: Privacy-preserving cohort tokens (random UUID, 30-day TTL)
   - Rationale: Movements need to know if they're growing or stalling

3. **Local Differential Privacy (client-side)**
   - Original: All noise server-side
   - Revised: Randomized response at client (ε=2.0, 88% truth rate)
   - Rationale: Plausible deniability even if traffic intercepted

4. **TEE Aggregation Path (Phase 2)**
   - Original: Server stores aggregates
   - Revised: Nitro Enclave aggregates in memory, only outputs aggregates
   - Rationale: Attestable proof we never store individual events

**Wave 2 adjustments:**
- Add CohortToken interface to analytics-privacy.ts
- Implement getOrCreateCohortToken() in privacy-first.ts
- Add cohort_token to increment dimensions (optional)

**Wave 3 adjustments:**
- Replace k-anonymity suppression with geographic coarsening
- Add LDP correction math
- Add /api/analytics/cohort endpoint

---

*Document maintained by implementation orchestrator. Update after each wave.*
