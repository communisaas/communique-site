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
| Cicero (Melissa Data) | Local | Commercial | Negotiated | Variable | Future: county/city/school |

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

New endpoints and Postgres tables in shadow-atlas.

#### B1. Postgres schema: officials tables
- [ ] `federal_members` table (bioguide_id PK, name, party, chamber, state, district, phone, office, contact_form_url, cwc_code, updated_at)
- [ ] `state_legislators` table (openstates_id PK, name, party, chamber, state, district, phone, email, office_address, updated_at)
- [ ] `cell_officials` join table (cell_id + official_id + official_table + district_hex)
- [ ] `geocode_cache` table (address_hash PK, lat, lng, cell_id, congressional_district, cached_at, TTL 30d)

#### B2. Ingestion pipeline
- [ ] Federal: cron script to pull `congress-legislators` YAML from GitHub → upsert `federal_members`
- [ ] State: cron script to pull Open States nightly CSVs → upsert `state_legislators`
- [ ] Build `cell_officials` join from TIGER geometries + official tables
- [ ] CWC code as computed column: `'H' || state || lpad(district, 2, '0')`

#### B3. New API endpoints
- [ ] `GET /v1/officials?cell_id=X` — returns federal + state reps for a cell
- [ ] `GET /v1/officials?district=CA-12` — returns reps by district code
- [ ] `GET /v1/districts/:hexId` — hex ID → human-readable name
- [ ] `GET /v1/cell-proof?include_names=true` — existing + district names (additive, backwards-compatible)

### Phase C: Communique Switchover

Replace Congress.gov integration with shadow-atlas calls.

#### C1. New shadow-atlas client methods
- [ ] Add `getOfficials(cellId: string)` to `shadow-atlas/client.ts`
- [ ] Add response types: `Official`, `OfficialsResponse`
- [ ] BN254 validation on district_hex fields (consistent with BR5-009)

#### C2. Rewire verify endpoint
- [ ] Replace `addressLookupService.lookupRepsByAddress()` with shadow-atlas `getOfficials()`
- [ ] Map response to existing `Representative` interface shape (backwards-compatible)
- [ ] Maintain fallback to Congress.gov during transition (feature flag)

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
packages/shadow-atlas/src/db/schema.sql          ← new tables
packages/shadow-atlas/src/ingestion/             ← cron scripts
packages/shadow-atlas/src/serving/api.ts         ← new endpoints
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


---

## Open Questions

1. **Cicero bulk license pricing** — needed for local officials (county, city, school board). Not blocking soft launch.
2. **Open States Postgres dump schema** — need to validate column names match our `state_legislators` table design before first ingest.
3. **TIGER/Line → cell_officials join** — PostGIS spatial query to build the join table. Need to confirm 15-digit GEOID from Census Blocks maps cleanly to TIGER block-level geometries.
4. **Shadow-atlas deployment cadence** — how quickly can we ship Phase B endpoints after Phase A lands?
