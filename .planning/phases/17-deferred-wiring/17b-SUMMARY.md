---
phase: "17"
plan: "17b"
subsystem: "error-handling"
tags: ["observability", "error-logging", "debugging"]
dependency-graph:
  requires: []
  provides: ["structured-error-context"]
  affects: ["all-server-modules", "all-client-modules"]
tech-stack:
  added: []
  patterns: ["module-prefixed-errors", "instanceof-error-guard"]
key-files:
  modified:
    - src/lib/core/congress/cwc-client.ts
    - src/lib/core/congress/address-lookup.ts
    - src/hooks.server.ts
    - src/routes/+layout.server.ts
    - src/routes/profile/+page.server.ts
    - src/lib/utils/timerCoordinator.ts
    - src/lib/core/legislative/resolution/variables.ts
    - src/lib/core/legislative/adapters/us-congress.ts
    - src/lib/core/legislative/adapters/uk-parliament.ts
    - src/routes/api/(dev)/test-cwc/+server.ts
    - src/lib/utils/browserUtils.ts
    - src/lib/utils/formatters.ts
    - src/lib/core/location/autocomplete-cache.ts
    - src/lib/components/analytics/CampaignDashboard.svelte
    - src/lib/components/analytics/DeliveryTracker.svelte
    - src/lib/components/template-browser/TemplatePreview.svelte
    - src/lib/components/auth/parts/SignInContent.svelte
    - src/lib/components/ui/ShareButton.svelte
    - src/lib/components/onboarding/AddressCollectionForm.svelte
decisions:
  - "Used consistent `error instanceof Error ? error.message : String(error)` pattern for type-safe error extraction"
  - "Module prefixes follow [ModuleName] convention for grep-ability"
  - "Silent catch blocks (getActiveOffices, testConnection, getSenators) now log errors before returning fallback values"
metrics:
  duration: "10m 46s"
  completed: "2026-02-19T07:51:17Z"
---

# Phase 17 Plan B: Fix Error Swallowing with Structured Logging Summary

Replaced 40+ generic `console.error('Error occurred')` catch blocks across 19 files with structured error logging that includes module prefix, error context, and actual error messages.

## Changes by Priority

### High Priority (Server-side)

**cwc-client.ts (5 sites):**
- `submitToSenate` catch: Now logs `[CWC] submitToSenate failed:` with office name and error message, returns actual error instead of 'Unknown error'
- `submitToAllRepresentatives` catch: Same pattern, returns actual error message
- `parseResponse` catch: Logs `[CWC] parseResponse failed:` with office context, appends error to return message
- `getActiveOffices` catch: Was completely silent, now logs `[CWC] getActiveOffices failed:`
- `testConnection` catch: Was completely silent, now logs `[CWC] testConnection failed:`

**address-lookup.ts (4 sites):**
- `zipToDistrict` catch: Logs `[AddressLookup] zipToDistrict failed:` with zip and state context
- `getSenators` catch: Was silent, now logs `[AddressLookup] getSenators failed:` with state context
- `validateReps` catch: Error string now includes actual error message instead of generic 'API error'
- `addressLookup` catch: Logs `[AddressLookup] addressLookup failed:` with zip context

**hooks.server.ts:** Changed `catch {` to `catch (error) {`, logs `[Hooks] Authentication failed:` with path context

**+layout.server.ts:** Changed `catch {` to `catch (error) {`, logs `[Layout] Failed to load representatives:`

**profile/+page.server.ts (3 sites):** Changed `_error` to `error`, added `[Profile]` prefix with specific context (Activity/Templates/Representatives)

### Medium Priority

**timerCoordinator.ts (3 sites):** setTimeout callback, setInterval callback, and clearTimer all now log `[TimerCoordinator]` with timer ID and type

**variables.ts:** Resolver failures now log `[Variables] Resolver failed:` with variable name

**us-congress.ts:** `lookupRepresentativesByAddress` catch logs `[USCongress] getRepresentatives failed:`

**uk-parliament.ts:** `lookupRepresentativesByAddress` catch logs `[UKParliament] getRepresentatives failed:`

**test-cwc/+server.ts:** POST handler catch logs `[TestCWC] Integration test failed:`

### Low Priority (Client-side)

**browserUtils.ts (9 sites):** All catch blocks now use `[BrowserUtils]` prefix with function name context

**formatters.ts (4 sites):** All catch blocks now use `[Formatters]` prefix with function name context

**autocomplete-cache.ts:** getCached catch now logs `[AutocompleteCache] getCached failed:` before returning null

**Components (6 sites):**
- CampaignDashboard.svelte: `[CampaignDashboard]` prefix for loadOverview/loadUserTemplates/loadActiveExperiments
- DeliveryTracker.svelte: `[DeliveryTracker]` prefix for retryDelivery
- TemplatePreview.svelte: `[TemplatePreview]` prefix for personalization restore
- SignInContent.svelte: `[SignIn]` prefix for auth preparation
- ShareButton.svelte: `[ShareButton]` prefix for clipboard
- AddressCollectionForm.svelte: `[AddressCollectionForm]` prefix, fixed `_error` -> `error` variable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed _error.message reference in AddressCollectionForm**
- **Found during:** Component fixes
- **Issue:** After renaming `_error` to `error` in catch, line 101 still referenced `_error.message`
- **Fix:** Updated to `error.message` to match the new catch binding
- **Files modified:** AddressCollectionForm.svelte
- **Commit:** 01827710

## Pattern Applied

All catch blocks now follow this consistent pattern:

```typescript
} catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ModuleName] operationName failed:', { context, error: msg });
}
```

For simpler cases (no additional context needed):

```typescript
} catch (error) {
    console.error('[ModuleName] operationName failed:', error instanceof Error ? error.message : String(error));
}
```

## Commits

| Hash | Message |
|------|---------|
| 01827710 | fix(17b): replace generic error swallowing with structured error logging |
