# Agent Interaction Surface Audit

**Created:** 2026-02-05
**Status:** COMPLETE
**Last Updated:** 2026-02-05 (All 4 waves complete)

---

## Purpose

Exhaustive audit of every surface where user input flows to an AI agent.
Tracks moderation coverage, test coverage, and remediation progress.

---

## Surface Inventory

### Surface 1: Subject Line Generation

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST /api/agents/stream-subject` |
| File | `src/routes/api/agents/stream-subject/+server.ts` |
| User Input | `message` (raw text describing user's issue) |
| AI Service | Gemini 3 Flash Preview (streaming, with thoughts) |
| Moderation | **PROMPT INJECTION DETECTION** (Llama Prompt Guard 2, line 57) |
| Rate Limiting | Guest: 5/hr, Auth: 15/hr, Verified: 30/hr |
| Auth Required | No (guests allowed at reduced rate) |
| Endpoint Tests | `stream-subject-endpoint.test.ts` (16 tests) |
| Module Tests | `clarification.test.ts` (22 tests) - type guards only |
| Client Component | `SubjectLineGenerator.svelte` |
| Client 403 Handling | Fixed in Wave 2 - reads JSON body, shows server error message |

**Remediated:** Prompt injection check added before Gemini call. Returns 403 with `PROMPT_INJECTION_DETECTED` code.

---

### Surface 2: Decision-Maker Resolution

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST /api/agents/stream-decision-makers` |
| File | `src/routes/api/agents/stream-decision-makers/+server.ts` |
| User Input | `subject_line`, `core_message`, `topics[]`, `voice_sample`, `target_type`, `target_entity` |
| AI Service | Gemini 3 Flash + Exa Search |
| Moderation | **PROMPT INJECTION DETECTION** (Llama Prompt Guard 2, line 81) |
| Rate Limiting | Guest: BLOCKED (0), Auth: 3/hr, Verified: 10/hr |
| Auth Required | Effectively yes (guests blocked by rate limit) |
| Endpoint Tests | `stream-endpoints.test.ts` (7 tests for this surface) |
| Module Tests | `provider-architecture.test.ts` (12), `exa-search.test.ts` (15) |
| Client Component | `DecisionMakerResolver.svelte` |
| Client 403 Handling | Already handled - reads JSON body for non-401/429 errors |

**Remediated:** Combined content check (`subject_line + core_message + topics`) before agent invocation.

---

### Surface 3: Message Generation

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST /api/agents/stream-message` |
| File | `src/routes/api/agents/stream-message/+server.ts` |
| User Input | `subject_line`, `core_message`, `topics[]`, `voice_sample`, `raw_input`, `geographic_scope` |
| AI Service | Gemini 3 Flash + Google Search grounding (two-phase) |
| Moderation | **PROMPT INJECTION DETECTION** (Llama Prompt Guard 2, line 95) |
| Rate Limiting | Guest: BLOCKED, Auth: 10/hr, Verified: 30/hr |
| Auth Required | Yes (explicit session check at line 60) |
| Endpoint Tests | `stream-endpoints.test.ts` (7 tests for this surface) |
| Module Tests | `content-verification.test.ts` (9) |
| Client Component | `MessageGenerationResolver.svelte` |
| Client 403 Handling | Already handled - reads JSON body for non-401/429 errors |

**Remediated:** All user-controlled fields (`subject_line`, `core_message`, `topics`, `voice_sample`, `raw_input`) checked before two-phase pipeline.

---

### Surface 4: Template Creation (with full moderation)

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST /api/templates` |
| File | `src/routes/api/templates/+server.ts` |
| User Input | `title`, `message_body`, `category` |
| AI Service | GROQ (Prompt Guard + Llama Guard) + Gemini (quality) |
| Moderation | **3-LAYER PIPELINE** (prompt guard, safety, quality) at line 424 |
| Endpoint Tests | `core-routes.test.ts` line 362 (mocks moderation to always pass) |
| Module Tests | `moderation-pipeline.test.ts` (35 tests) |

**Gap:** Integration test mocks `moderateTemplate` to always return `approved: true`. No negative-path test verifies 400/CONTENT_FLAGGED.

---

### Surface 5: Moderation Check (test endpoint)

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST /api/moderation/check` |
| File | `src/routes/api/moderation/check/+server.ts` |
| User Input | `title`, `message_body`, `category` |
| AI Service | Same 3-layer pipeline as Surface 4 |
| Moderation | **3-LAYER PIPELINE** |
| Endpoint Tests | `moderation-check-endpoint.test.ts` (25 tests) |
| Module Tests | `moderation-pipeline.test.ts` (35 tests) covers underlying function |

**Gap:** HTTP layer (request parsing, status codes, error format) untested.

---

## Remediation Log

### Wave 1: Implementation (COMPLETE)

Wired `moderatePromptOnly()` into all three streaming agent endpoints.

| File | Change | Status |
|------|--------|--------|
| `src/routes/api/agents/stream-subject/+server.ts` | Added prompt injection check (lines 56-70) | DONE |
| `src/routes/api/agents/stream-decision-makers/+server.ts` | Added prompt injection check (lines 79-99) | DONE |
| `src/routes/api/agents/stream-message/+server.ts` | Added prompt injection check (lines 86-113) | DONE |

**Pattern:** All three return HTTP 403 with `{ error: 'Content flagged by safety filter', code: 'PROMPT_INJECTION_DETECTED' }` as JSON (not SSE) before the stream is created.

### Wave 2: Review + Audit (COMPLETE)

| Check | Finding | Resolution |
|-------|---------|------------|
| Endpoint error consistency | All 3 use identical 403 response format | PASS |
| Client 403 handling | SubjectLineGenerator.svelte used generic error | Fixed: reads JSON body |
| DecisionMakerResolver 403 handling | Already reads JSON body for non-401/429 | PASS (no change needed) |
| MessageGenerationResolver 403 handling | Already reads JSON body for non-401/429 | PASS (no change needed) |
| Docs referencing endpoints | INTEGRATION_GUIDE.md lacks 403 docs | Minor gap, deferred |

**Files modified in Wave 2:**
- `src/lib/components/template/creator/SubjectLineGenerator.svelte` (line 75-77: read JSON body on error)

### Wave 3: Tests (COMPLETE)

| Test File | Target | Tests | Status |
|-----------|--------|-------|--------|
| `tests/unit/agents/stream-subject-endpoint.test.ts` | Surface 1 endpoint | 16 | DONE |
| `tests/unit/agents/stream-endpoints.test.ts` | Surface 2 + 3 endpoints | 14 | DONE |
| `tests/unit/moderation/moderation-check-endpoint.test.ts` | Surface 5 endpoint | 25 | DONE |

**Total new tests:** 55 (all passing)

**Note:** Surface 4 (`POST /api/templates`) already has endpoint tests in `core-routes.test.ts`. The integration tests mock `moderateTemplate` to always approve, so the negative moderation path (content rejected → 400) is not tested at the integration level. The underlying moderation pipeline is thoroughly tested in `moderation-pipeline.test.ts` (35 tests) and `moderation-check-endpoint.test.ts` (25 tests, including rejection paths).

### Wave 4: Final Review (COMPLETE)

- [x] All 55 new endpoint tests pass
- [x] Full unit test suite: **362 tests pass, 0 failures, 23 test files**
- [x] No regressions introduced
- [x] Import resolution fixed (`$routes` → relative paths in `stream-endpoints.test.ts` and `moderation-check-endpoint.test.ts`)
- [x] Session null mock fixed in `stream-endpoints.test.ts` (`??` → `'session' in options` check)
- [x] This document updated to reflect final state

---

## Completion Criteria

All items below must be true:

1. [x] Every surface that sends user input to an AI agent has prompt injection detection
2. [x] Every API endpoint has at least one endpoint-level test
3. [x] Moderation paths tested: positive (approved content → 200), negative (injection → 403, safety → 400, quality → 400), and error (service failure → 500)
4. [x] This document is updated to reflect final state

---

## Remaining Observations (Non-Blocking)

- **Integration-level negative moderation test for templates:** The `core-routes.test.ts` integration test mocks `moderateTemplate` to always approve. A future integration test could verify the actual rejection flow end-to-end. Low priority since the moderation pipeline and endpoint handler are both independently tested.
- **INTEGRATION_GUIDE.md lacks 403 documentation:** The docs don't document the `PROMPT_INJECTION_DETECTED` response. Minor gap, deferred.
