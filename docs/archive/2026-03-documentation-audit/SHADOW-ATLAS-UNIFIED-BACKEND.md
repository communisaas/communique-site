# Shadow Atlas Unified Backend: District + Representative Resolution

**Status:** Implementation in progress
**Last updated:** 2026-02-22
**Owner:** Phase 3 of shadow-atlas integration

---

## Problem Statement

Communique's address verification pipeline has four structural defects:

1. **Double Census API hit.** `api/address/verify/+server.ts` calls Census Bureau directly (line 49), then `addressLookupService.lookupRepsByAddress()` calls Census *again* internally via `addressToDistrict()` (line 342 of `address-lookup.ts`). Every address verification triggers two identical geocoding requests.

2. **Uncached 535-member Congress roster fetch.** `fetchAllMembers()` (line 616 of `address-lookup.ts`) paginates through ALL current Congress members on every single representative lookup. No caching. Three paginated requests (250+250+35) to Congress.gov API per address verification.

3. **Congress.gov API unreliable.** The API entered an infinite redirect loop August 22-25, 2025. No public ETA for stability guarantees. ProPublica Congress API shut down July 2024. Google Civic Representatives API shut down April 2025. Runtime dependency on any government API is a liability.

4. **Client-side government API calls.** `census-api.ts` calls Census Bureau via JSONP from the browser. The user's coordinates flow to a federal API from their device. Goal: zero government API calls from the client.

## Architecture Decision

Shadow Atlas becomes the unified backend for district resolution AND representative data. No runtime calls to Congress.gov. No client-side calls to Census Bureau. Shadow Atlas serves pre-ingested, periodically refreshed data from its own Postgres.

### Data Sources (Research Findings)

| Source | Level | License | Bulk? | Quality | Status |
|--------|-------|---------|-------|---------|--------|
| `unitedstates/congress-legislators` (GitHub) | Federal (541) | CC0 | YAML/JSON | Excellent | Primary federal source |
| Open States (openstates.org) | State (~7,386) | CC0 | Postgres dump + nightly CSV | Good | Primary state source |
| Census TIGER/Line shapefiles | Boundaries | Public domain | Shapefiles | Authoritative | District geometry |
| Municipal GIS Portals (716 cities) | Local | Public domain | GeoJSON | Varies | City council wards |
| Regional COGs (7 metros, ~1,314 cities) | Local | Public domain | ArcGIS REST | Good | Municipal boundaries |
| Special District Providers (state GIS) | Local | Public domain | GeoJSON | Good | Fire, water, school, etc. |

**Dead sources (do not use):**
- ProPublica Congress API: shut down July 2024
- Google Civic Representatives API: shut down April 2025
- Congress.gov API v3: unreliable, redirect loops since Aug 2025
- GovTrack bulk data: discontinued 2017

**CWC office codes** are deterministically constructible from district data:
```
House: "H" + state_code + lpad(district, 2, '0')  →  "HCA13"
Senate: use bioguide_id + contact_form_url from congress-legislators
```

### Privacy Model

**Recommended: Option A (browser-direct geocoding, no new trust surface).**

The privacy boundary is clean. Shadow Atlas currently sees: leaf hashes (Tree 1), cell_ids (Tree 2 queries), identity commitments (Tree 3). Adding representative metadata does not change this boundary — cell_id is already sent to shadow-atlas for `/v1/cell-proof`, and representative names are a UI enrichment layer that never enters the ZK circuit.

- 24 district hex IDs are BN254 field elements baked into Tree 2 (public inputs [2-25])
- Representative metadata (names, parties, phones, CWC codes) maps hex IDs to human-readable data
- No circuit modifications needed
- CWC delivery address encryption unchanged (browser → TEE path)
- Cell_id granularity (600-3000 people) is accepted Phase 1 tradeoff

**What goes where:**
```
Browser:     Full address (encrypted IndexedDB) → Census geocoding → coordinates + cell_id
Communique:  cell_id → Shadow Atlas for reps + district proof
Shadow Atlas: cell_id → officials from Postgres + Tree 2 SMT proof
```

### Target Data Flow

```
Browser                     Communique Server               Shadow Atlas
───────                     ─────────────────               ────────────
User enters address ──→  POST /api/address/verify
                               │
                               ├─→ Census Bureau geocoder (ONE call)
                               │   Returns: lat/lng, cell_id, CD
                               │
                               └─→ Shadow Atlas GET /v1/officials?cell_id=XXX
                                      │
                                      ├─→ Federal + state reps (from Postgres)
                                      ├─→ 24 district hex IDs
                                      └─→ Human-readable district names

                     ←── { district, cell_id, representatives[], zk_eligible }
```

---

## Implementation Phases

### Phase A: Fix Communique Pipeline (this repo)

Eliminate the double Census hit and Congress.gov runtime dependency. Ship an in-process member cache so address verification works immediately, even before shadow-atlas endpoints exist.

#### A1. Add member cache to `address-lookup.ts` — DONE
- [x] Add LRU/TTL cache to `fetchAllMembers()` — 5-minute TTL, single in-memory instance
- [x] Prevent duplicate concurrent fetches (dedup promise)
- [x] Log cache hits for observability

**File:** `src/lib/core/congress/address-lookup.ts` (lines 63-66 cache vars, lines 621-643 cache-aware fetch)

#### A2. Eliminate double Census call in `api/address/verify` — DONE
- [x] Added `lookupRepsByDistrict(state, district)` method (lines 348-382 of address-lookup.ts)
- [x] Wired verify endpoint to parse extracted district and call `lookupRepsByDistrict` (line 88-94)
- [x] `lookupRepsByAddress()` preserved for other callers (us-congress.ts adapter, getRepresentativesForAddress)
- [x] Edge cases: normal (CA-12), at-large (VT-AL → 00), DC, territories (PR, VI, GU, AS, MP)

**Files:**
- `src/routes/api/address/verify/+server.ts` (lines 83-94)
- `src/lib/core/congress/address-lookup.ts` (lines 340-382)

#### A3. Fix minor issues in verify endpoint — DONE
- [x] Fixed 5 double-space typos in error messages
- [x] Fixed stale "Google Civic API" comment → "Census Bureau geocoding"
- [x] Removed cell_id prefix logging (2 occurrences) — zero GEOID data now logged

**File:** `src/routes/api/address/verify/+server.ts`

### Phase B: Shadow Atlas Officials Endpoint (voter-protocol repo)

New SQLite tables and API endpoints in shadow-atlas. (Adapted from original Postgres plan — shadow-atlas uses SQLite via better-sqlite3.)

#### B1. SQLite schema: officials tables — DONE
- [x] `federal_members` table (bioguide_id PK, name, party, chamber, state, district, phone, office_address, contact_form_url, cwc_code, cd_geoid, state_fips, is_voting, delegate_type, updated_at)
- [x] `state_legislators` table (openstates_id PK) — schema defined, ingestion deferred to Phase B+
- [x] `ingestion_log` table (source, status, records_upserted, records_deleted, duration_ms, error)
- [ ] `geocode_cache` table — deferred (Census geocoding stays in Communique verify endpoint for now)

**Files:**
- `packages/shadow-atlas/src/db/officials-schema.sql` (new)
- `packages/shadow-atlas/src/serving/officials-service.ts` (new — 380 lines)

#### B2. Ingestion pipeline — DONE (federal)
- [x] Federal: `ingest-legislators.ts` pulls `congress-legislators` YAML from GitHub → upserts `federal_members`
- [x] CWC code generation: `'H' + state + lpad(district, 2, '0')` → e.g., `HCA12`
- [x] FIPS ↔ state code bidirectional mapping (all 50 states + 6 territories)
- [x] Delegate/territory handling: DC delegate, PR resident commissioner, AS/GU/MP/VI delegates
- [x] Idempotent: safe to re-run (upsert + departed member deletion)
- [x] Dry-run validated: 538 members (432 voting House + 6 delegates + 100 Senate)
- [ ] State: Open States CSV ingestion — deferred to Phase B+

**File:** `packages/shadow-atlas/src/scripts/ingest-legislators.ts` (new — 280 lines)

#### B3. New API endpoints — DONE
- [x] `GET /v1/officials?cell_id=X` — resolves via Tree 2 district hex IDs → federal officials
- [x] `GET /v1/officials?district=CA-12` — direct district code lookup
- [x] Zod validation schema for query params
- [x] Rate limiting (same as lookup)
- [x] Cache-Control headers (1 hour — officials change infrequently)
- [x] Wired into `createShadowAtlasAPI` factory and `serve` command
- [x] Graceful degradation: returns 501 if officials DB not populated
- [ ] `GET /v1/districts/:hexId` enrichment — deferred (current handler returns Merkle proofs only)
- [ ] `GET /v1/cell-proof?include_names=true` — deferred (additive, backwards-compatible)

**Files modified:**
- `packages/shadow-atlas/src/serving/api.ts` (import, schema, route, handler, factory)
- `packages/shadow-atlas/src/serving/types.ts` (OFFICIALS_UNAVAILABLE error code)
- `packages/shadow-atlas/src/cli/commands/serve/index.ts` (officials service init + shutdown)
- `packages/shadow-atlas/package.json` (npm scripts)
- `packages/shadow-atlas/.env.example` (OFFICIALS_DB_PATH)

#### B4. Tests — DONE
- [x] 26 unit tests covering: schema init, state+district lookup, Tree 2 hex ID resolution, DC/territory special status, CWC codes, cache behavior, static helpers, API response formatting

**File:** `packages/shadow-atlas/src/__tests__/unit/serving/officials-service.test.ts` (new)

### Phase C: Communique Switchover

Replace Congress.gov integration with shadow-atlas calls.

#### C1. New shadow-atlas client methods — DONE
- [x] Add `getOfficials(districtCode: string)` to `shadow-atlas/client.ts`
- [x] Add response types: `Official`, `OfficialsResponse`, `OfficialsSpecialStatus`
- [x] No BN254 validation needed — officials data is metadata (names, parties), not field elements

#### C2. Rewire verify endpoint — DONE
- [x] Replace `addressLookupService.lookupRepsByDistrict()` with shadow-atlas `getOfficials()`
- [x] Map response to existing representative shape (backwards-compatible)
- [x] Maintain fallback to Congress.gov during transition (nested try/catch, not feature flag)
- [x] Build passes (19.98s, no errors)

#### C3. Delete dead code
- [ ] Remove `CONGRESS_API_KEY` from env (after shadow-atlas is stable)
- [ ] Remove `fetchAllMembers()` and Congress.gov pagination logic
- [ ] Remove `addressToDistrict()` (geocoding now in verify endpoint only)
- [ ] Keep `DELEGATE_FALLBACK_DATA` as emergency fallback

#### C4. Remove browser-side Census JSONP
- [ ] Remove JSONP callback injection from `census-api.ts`
- [ ] Route all geocoding through server-side verify endpoint
- [ ] Keep `getTimezoneLocation()` as weak signal fallback

---

## Files Affected

### Phase A (this repo — immediate)
```
src/lib/core/congress/address-lookup.ts          ← cache + new method
src/routes/api/address/verify/+server.ts         ← eliminate double hit
```

### Phase B (voter-protocol repo)
```
packages/shadow-atlas/src/db/officials-schema.sql            ← NEW: officials tables
packages/shadow-atlas/src/serving/officials-service.ts       ← NEW: query layer + LRU cache
packages/shadow-atlas/src/scripts/ingest-legislators.ts      ← NEW: GitHub YAML → SQLite
packages/shadow-atlas/src/serving/api.ts                     ← route + handler + factory
packages/shadow-atlas/src/serving/types.ts                   ← OFFICIALS_UNAVAILABLE error code
packages/shadow-atlas/src/cli/commands/serve/index.ts        ← service init + shutdown
packages/shadow-atlas/package.json                           ← npm scripts
packages/shadow-atlas/.env.example                           ← OFFICIALS_DB_PATH
packages/shadow-atlas/src/__tests__/unit/serving/officials-service.test.ts  ← NEW: 26 tests
```

### Phase C (this repo — after Phase B ships)
```
src/lib/core/shadow-atlas/client.ts              ← new getOfficials()
src/routes/api/address/verify/+server.ts         ← rewire to shadow-atlas
src/lib/core/congress/address-lookup.ts          ← delete most of file
src/lib/core/location/census-api.ts              ← remove JSONP
```

---

## Implementation Log

### Cycle 1: Phase A — Fix Communique Pipeline
**Started:** 2026-02-22
**Status:** Complete

#### Findings

1. **6 pre-existing tsc errors** in unrelated files (not introduced by our changes). Build succeeds — these are non-blocking type issues in other modules.
2. **`lookupRepsByAddress` still called by 3 other callers**: `getRepresentativesForAddress()` (2 call sites in address-lookup.ts) and `us-congress.ts` adapter. These still go through Census geocoding internally. Will be eliminated in Phase C when shadow-atlas serves officials directly.
3. **`fetchAllMembersFromAPI()` still paginates all 535 members** even when the caller only needs one district. This is mitigated by the 5-minute cache but is structurally wasteful. Phase B eliminates this entirely by serving reps from Postgres.

#### Completion

- [x] A1: Member cache — 5-min TTL with concurrent request deduplication
- [x] A2: Double Census call eliminated — verify endpoint uses `lookupRepsByDistrict()`
- [x] A3: Privacy fixes — zero GEOID logging, typos fixed, stale comments corrected
- [x] Build passes (`npm run build` — 3997 modules, 19.32s)
- [x] Grep verification: 0 double-space typos, 0 geoid.slice leaks, 0 lookupRepsByAddress in verify endpoint


### Cycle 2: Phase B — Shadow Atlas Officials Endpoint
**Started:** 2026-02-22
**Status:** Complete (federal officials; state officials deferred)

#### Architecture Decision: SQLite over Postgres

The architecture doc originally specified Postgres tables. Shadow-atlas uses SQLite (better-sqlite3) throughout — municipal boundaries, event sourcing, district lookups. Adding a Postgres dependency would break the single-binary deployment model. **Decision: SQLite for officials, consistent with existing codebase.** The `cell_officials` join table from the original plan is unnecessary — officials are resolved at query time via FIPS code parsing from Tree 2 district hex IDs.

#### Findings

1. **538 current legislators** (not 535 as previously stated): 432 voting House + 6 non-voting delegates + 100 Senate.
2. **CWC codes deterministic for House only.** Senate CWC codes require `bioguide_id` + contact form URL mapping, not constructible from district data alone. The ingestion script captures `contact_form_url` from congress-legislators YAML for future CWC code derivation.
3. **Tree 2 district hex IDs → officials mapping** works via FIPS code parsing: `districts[0]` (CD GEOID as bigint, e.g., 612n → "0612" → state="06", cd="12") and `districts[1]` (state FIPS as bigint). No join table needed.
4. **At-large/delegate districts**: Census uses "98" for at-large districts in CD GEOID (e.g., VT CD GEOID = "5098"). Normalized to "00" in the service for consistent querying.
5. **Pre-existing build errors**: `bin/shadow-atlas.ts` has ~15 type errors (mismatched CLI option types), plus a pre-existing `CellMapState | null` type mismatch in `serve/index.ts`. None introduced by Phase B.

#### Completion

- [x] B1: Officials SQLite schema — `federal_members`, `state_legislators` (placeholder), `ingestion_log` tables
- [x] B2: Ingestion pipeline — `ingest-legislators.ts` fetches YAML from GitHub, parses, upserts (538 members, 688ms)
- [x] B3: API endpoint — `GET /v1/officials?cell_id=X` and `GET /v1/officials?district=CA-12`, wired into factory + serve command
- [x] B4: Tests — 26 unit tests all passing (officials service + API response formatting)
- [x] Dry-run validated: correct CWC codes, delegate types, FIPS mappings, special status for DC/territories

### Cycle 3: Phase C — Communique Switchover (C1 + C2)
**Started:** 2026-02-22
**Status:** Complete (C1 + C2 done; C3 dead code deletion and C4 JSONP removal deferred)

#### Architecture Decision: Nested Fallback over Feature Flag

The architecture doc originally specified a feature flag for the Congress.gov → shadow-atlas transition. Nested try/catch is cleaner: shadow-atlas is the primary path, Congress.gov is the catch fallback (existing code preserved in-place), and placeholder data is the final fallback. No env var to manage. When shadow-atlas is stable, delete the Congress.gov catch block.

#### Findings

1. **No BN254 validation needed for officials data.** Officials are metadata (names, parties, phone numbers) — not field elements entering the ZK circuit. BN254 validation is only needed for Merkle proofs and district hex IDs.
2. **Response shape is backwards-compatible.** Shadow Atlas `toOfficialsResponse()` formats `office` titles identically to the verify endpoint's manual formatting (`"House Representative, CA-12"`, `"Non-Voting Delegate, DC"`, `"Resident Commissioner, PR"`, `"Senator, CA"`). Field mapping: `cwc_code` → `office_code`, `is_voting` → `is_voting_member`.
3. **Build passes clean.** 19.98s, no new errors. Redis external dependency warning is pre-existing.

#### Completion

- [x] C1: `getOfficials(districtCode)` added to `src/lib/core/shadow-atlas/client.ts` with `Official`, `OfficialsResponse`, `OfficialsSpecialStatus` types
- [x] C2: `src/routes/api/address/verify/+server.ts` rewired — shadow-atlas primary, Congress.gov fallback, placeholder final fallback
- [x] Build passes (`npm run build` — 19.98s)
- [ ] C3: Dead code deletion — deferred until shadow-atlas is deployed and stable
- [ ] C4: Browser-side Census JSONP removal — deferred

---

## Open Questions

1. **Open States CSV column schema** — need to validate column names match our `state_legislators` table design before first ingest.
2. **Senate CWC code derivation** — `contact_form_url` from congress-legislators is captured but CWC code generation for Senate requires additional mapping. Not blocking CWC delivery (House CWC codes work).
3. **`/v1/districts/:hexId` enrichment** — current handler returns Merkle proofs only. Adding human-readable names is additive and backwards-compatible but deferred.
