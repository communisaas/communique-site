# The Bubble: Geographic Identity as a Living Object

**Status:** Design Spec — Active (Rev 2)
**Author:** Architecture / Perceptual Engineering
**Created:** 2026-03-01
**Revised:** 2026-03-01 — Rev 2: From disambiguation widget to identity object
**Depends on:** Shadow Atlas R-tree (94,166 districts), Nominatim (self-hosted), `GeocodeService.detectCountry()`
**Supersedes:** Address verification paradigm in `location-picker-spec.md`
**Companion specs:** `SPATIAL-BROWSE-SPEC.md`, `GEOGRAPHIC-IDENTITY-ROUTING.md`, `TWO-TREE-ARCHITECTURE-SPEC.md`

---

## The Fundamental Error

The previous revision treated the bubble as a **disambiguation widget** — a transient form that appears when the system can't resolve the user's district, asks them to tap a segment, then vanishes. Per-layer `resolved: true/false`. Candidate arrays. The system owned the interaction; the user serviced it.

That's address verification wearing a costume.

---

## What the Bubble Actually Is

The bubble is the **user's geographic self**. One object. Theirs. Persistent. It represents the totality of what they've chosen to disclose about where they are — as a soft, spatial region with edges they control.

The bubble is not created by ambiguity. It is created by the user. It exists from the moment they provide any location signal — a postal code, a city name, a GPS ping, a country selection. Its initial size is the extent of what they gave. Its ongoing size is the extent of what they're willing to reveal.

**The person has agency over the bubble.** They can:
- **Pinch it smaller** — reveal more precision, shed district ambiguity
- **Let it breathe** — keep it large, accept the ambiguity, access only what the bubble qualifies them for
- **Drag it** — relocate
- **Feed it more postal characters** — ZIP → ZIP+4, FSA → full code — and watch it tighten

**The bubble is bound to the user's externalities and extremities:**
- **Externalities**: The district boundaries from the shadow-atlas. These are fences that exist in the world, not in the interface. The bubble passes through them. Where a fence crosses the bubble's interior, there is ambiguity. Where the bubble is entirely within a fence, there is resolution.
- **Extremities**: The bubble's perimeter. This is the limit of disclosure. Beyond it, the system has no information. The perimeter is the user's choice — they control where it falls.

**The bubble does not pop.** It does not vanish when districts resolve. It persists as the user's geographic identity. It can be very small (a block, all districts resolved) or very large (a country, only country-level templates accessible). Both are valid states. The system works with whatever the user provides.

### The Dual Relationship

Every template has a `minimum_precision_required`: `'none' | 'country' | 'state' | 'county' | 'district'`.

The bubble has a **precision level** — derived from how many district layers it resolves:
- Bubble spans multiple countries → precision = none
- Bubble within one country but multiple states → precision = country
- Bubble within one state but multiple counties → precision = state
- Bubble within one county but multiple CDs → precision = county
- Bubble within one CD (and all finer layers) → precision = district

**Template access = bubble precision >= template requirement.** A bubble at state precision can access state-level and national templates but not district-level ones. The system doesn't gate — it shows what the bubble qualifies for and gently indicates what would become available with more precision.

This is not progressive disclosure as a dark pattern ("give us more to unlock more"). It is honest geometry: "your bubble is larger than this template's jurisdiction, so we can't confirm you're in the right place."

---

## Why Postal Codes Seed the Bubble

Postal codes are the natural entry point because they're what people know, they're non-invasive, and they resolve surprisingly well:

| Country | Format | % That Resolve All Layers | Bubble Size When Seeded |
|---------|--------|---------------------------|-------------------------|
| UK | SW1A 1AA | **99.76%** | ~15 addresses. Tiny. Almost always fully resolved. |
| Canada | A1A 1A1 | **98.8%** | ~1 city block. Very small. Usually resolved. |
| US | 12345 | **85%** (CD), **~70%** (state leg) | ~6 km² avg. Medium. Often has 1-2 fences through it. |
| US | 12345-6789 | **>99%** | ~1 block face. Tiny. Resolved. |
| Australia | 2000 | **77%** | Varies wildly. Rural = huge, urban = medium. |
| Canada | A1A (FSA only) | **25%** | City-sized. Too large. Always ask for full code. |

But the bubble doesn't require a postal code. It can be seeded by:
- A city name (bubble = city boundary)
- GPS (bubble = accuracy circle, typically 10-50m radius)
- IP geolocation (bubble = city-level, ~10km radius)
- Country selection (bubble = entire country)
- Any combination — the smallest signal wins

The postal code is just the most common seed. The bubble is format-agnostic.

---

## 1. GROUND: The Felt Situation

### Who holds the bubble

A person arriving at this platform is deciding how much of themselves to bring. Location is intimate — not in the way an address is intimate (surveillance), but in the way commitment is intimate. "I live *here*, and I care about *this*." The bubble is the spatial dimension of that commitment.

They are:

- **Declaring standing.** "I'm in this postal code. This issue touches me." The bubble is their planted flag — soft-edged, but planted.
- **Calibrating trust.** The bubble's size IS the trust level. Large bubble = "I'll tell you my country, not more." Small bubble = "I trust you with my block." The system must never demand a smaller bubble than the user offers. It must work gracefully at every size.
- **In stolen time.** Bus ride. Waiting room. The 90 seconds after reading a headline. A postal code is 5-7 characters of muscle memory. The bubble should appear in the time it takes to look up from the keyboard.
- **On a phone.** One hand. Thumb range. The bubble lives under the thumb — pinchable, draggable, a physical thing in a physical hand.

### Somatic ground-tone

When the system asks to "verify your address": **contraction.** The body pulls back. "Should I give this to them?"

When the system says "enter your postal code": **neutral.** Automatic. The same gesture as ordering pizza.

When the bubble appears — **their** bubble, soft and round, showing them the territory they just claimed: **expansion.** A quiet "oh." Not a form to fill. A map of their own standing. They see the district boundaries running through their postal code and they *recognize the landscape* — "that's my side of the freeway."

And then: **agency.** The bubble is under their finger. They can pinch it. They can leave it. The choice is theirs. Nothing is demanded. The system adapts to whatever they give.

---

## 2. MAP: Experiential Qualities

### Atmosphere

**Alive and owned.** The bubble is not a system dialog. It's a soft, breathing shape on the screen that belongs to the user. It responds to their touch with physical conviction — spring dynamics, momentum, friction. It sits in their profile, not in a modal. It is theirs the way an avatar is theirs.

The atmosphere around the bubble is **cartographic calm** — muted geography, subtle district boundary lines, the quiet authority of a well-drawn map. The bubble itself is the only warm element: a soft glow, a gentle pulse of life, the single living thing on an otherwise still terrain.

### Affordance

**The bubble affords shaping.** Not tapping segments. Not selecting from a list. The bubble is a continuous, deformable region and its primary affordance is **pinch** — two fingers drawing closer to tighten the circle, narrowing the user's disclosed area.

On mobile: literal pinch gesture. The bubble shrinks toward the midpoint of the two fingers. District fences that were inside the bubble cross to the outside and dim — those districts are shed. The bubble tightens.

On desktop: scroll-wheel zooms the bubble (centered on cursor position). Click-drag repositions.

On any device: **typing more postal characters tightens the bubble too.** ZIP → ZIP+4 in the US. FSA → full code in Canada. The postal input field and the spatial gesture are two ways to do the same thing — make the bubble smaller. They can be interleaved: type a postal code, see the bubble, pinch it a little, type the +4, watch it snap tight.

### The bubble never pops

Resolution is not a terminal state. It's a quality of the bubble's current size. At any moment, the bubble has:
- **Resolved layers**: District boundaries that are entirely outside the bubble — the user is definitively in one district for that layer.
- **Ambiguous layers**: Fences still inside the bubble — the user *could* be in any of the districts that the fence separates.

As the bubble shrinks, resolved layers accumulate. As it grows, they shed. This is continuous, not binary. There is no "popping" — the bubble is always there, always alive, always the user's.

### Tension and resolution (revised)

The tension is not "which side of this line am I on?" — that's the system's question.

The tension is: **"how much do I want to reveal?"** The bubble's size is a disclosure decision. The fences visible inside it show the user exactly what precision they'd need to reach full resolution. The tension is between privacy and access — and it's the user's tension to hold, not the system's to resolve.

Resolution arrives gradually: each fence that crosses from inside-the-bubble to outside is a small satisfying event. The fence dims, the resolved district label brightens. The bubble doesn't pop — it *clarifies*.

### Invitation to imprecision

The bubble at full postal-code size is a valid state. If the user never pinches — that's fine. They access everything their bubble qualifies them for. Templates with `minimum_precision_required: 'state'` or `'country'` work immediately. District-level templates are visible but marked as "needs more location precision" — an invitation, not a gate.

This is structurally different from "please complete your profile." The bubble makes the geometry visible: "here's what you can access at this bubble size, and here's what you'd unlock by pinching a little tighter." The user sees the exact boundary that stands between them and the template. One pinch past that boundary, and it's theirs.

---

## 3. ARCHITECTURE: Cross-Codebase Design

### Data Flow

```
ANY LOCATION SIGNAL (postal code, GPS, city name, country)
    │
    ▼
communique: Bubble is born
    │  center = signal centroid
    │  radius = signal extent
    │
    ├──────── POST /v1/bubble-query ───────────────┐
    │         { center, radius }                    │
    │                                               ▼
    │                                    shadow-atlas (backend)
    │                                    ┌──────────┤
    │                                    │          │
    │                              Nominatim    R-tree
    │                              (centroid    (all districts
    │                               + bbox)     intersecting bbox)
    │                                    │          │
    │                                    └────┬─────┘
    │                                         │
    │◄───── BubbleGeometry ───────────────────┘
    │       (all fences + district clips within bubble extent)
    │
    ▼
Bubble renders: soft circle on terrain, fences visible inside
    │
    │  ── user pinches ──► bubble shrinks (CLIENT-SIDE ONLY)
    │  │                   fences cross perimeter → dim → districts resolve
    │  │                   no API call until bubble moves outside cached extent
    │  │
    │  ── user types +4 ──► bubble radius snaps smaller
    │  │                    same client-side fence shedding
    │  │
    │  ── user drags ──► bubble moves → re-query shadow-atlas
    │                    (new center outside cached bbox)
    │
    ▼
Bubble persists in user profile
    │  stores: center + radius + resolved districts
    │  never: raw postal code or address
    │
    ▼
Template access: bubble.precision >= template.minimum_precision_required
ZK proofs: resolved district_id → Merkle proof → circuit (unchanged)
```

**Critical architecture choice**: The shadow-atlas returns ALL district geometry within the bubble's initial extent in a single call. Pinching is entirely client-side — no round-trips. The client does simple point-in-polygon / circle-intersects-polygon math against the cached geometry as the bubble shrinks. Only when the user *moves* the bubble outside the cached extent does a new API call fire.

---

## 4. SHADOW-ATLAS: `POST /v1/bubble-query`

### Design Principle

The endpoint doesn't resolve anything. It doesn't decide what's ambiguous. It returns **raw geometry** — all district fences and district clip regions within a bounding box — and lets the client compute resolution based on the bubble's current state.

This is the right separation: the shadow-atlas is an oracle of district geography. The bubble is a client-side object that reads the geography. The oracle doesn't need to know about the bubble.

### Request

```typescript
interface BubbleQueryRequest {
  /**
   * Center point of the query region.
   * Can come from: postal code centroid, GPS, city centroid, manual placement.
   */
  center: { lat: number; lng: number };

  /**
   * Radius in meters. Defines the extent to query.
   * The server returns all geometry within this circle + a 20% buffer
   * (so the client has headroom for the user to grow the bubble slightly
   * without needing a re-query).
   */
  radius: number;

  /**
   * Optional: which district layers to include.
   * Default: all available layers for the country at this point.
   */
  layers?: string[];

  /**
   * Optional: postal code string for display purposes.
   * If provided, the response includes the postal code's own extent
   * (for setting the initial bubble size).
   */
  postal_code?: string;
}
```

### Response

```typescript
interface BubbleQueryResponse {
  /** Echo back the query center */
  center: { lat: number; lng: number };

  /** The actual query extent (center + radius + 20% buffer) */
  queryBbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };

  /** If postal_code was provided: its geographic extent for initial bubble sizing */
  postalExtent?: {
    centroid: { lat: number; lng: number };
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    /** Approximate radius in meters */
    radius: number;
    /** Detected country */
    country: 'US' | 'CA' | 'GB' | 'AU';
  };

  /**
   * All district fences within the query extent.
   *
   * A fence is the boundary line between two adjacent districts
   * in the same layer. This is what the bubble renders as dashed lines.
   * The client tests each fence against the bubble circle to determine
   * which are "inside" (causing ambiguity) vs "outside" (irrelevant).
   */
  fences: Fence[];

  /**
   * All districts that intersect the query extent, with their
   * clipped geometries. The client tests each against the bubble
   * circle to determine which districts the user could be in.
   */
  districts: BubbleDistrict[];

  /**
   * Officials for the center point (best-guess representatives).
   * Updated client-side as the bubble resolves specific districts.
   */
  officials?: Official[];
}

interface Fence {
  /** Unique fence ID (hash of the two district IDs it separates) */
  id: string;

  /** Which district layer: "congressional", "state_senate", "state_house", etc. */
  layer: string;

  /**
   * The boundary line, clipped to query extent.
   * Simplified to <30 vertices for wire efficiency.
   */
  geometry: GeoJSON.LineString;

  /** The two districts this fence separates */
  sides: [
    { districtId: string; name: string },
    { districtId: string; name: string }
  ];

  /**
   * Human-readable landmark along the fence.
   * Derived from reverse-geocoding the fence midpoint.
   * e.g., "Market Street", "I-80", "Columbia River"
   */
  landmark?: string;

  /** How the landmark was derived */
  landmarkSource?: 'road' | 'river' | 'railway' | 'boundary_name' | 'address_range';
}

interface BubbleDistrict {
  /** District ID: "cd-0611", "sldu-06001", etc. */
  id: string;

  /** Short name: "CA-11", "SD-1" */
  name: string;

  /** Display name: "California's 11th Congressional District" */
  display: string;

  /** Layer: "congressional", "state_senate", "state_house", "county", etc. */
  layer: string;

  /**
   * District geometry clipped to query extent.
   * Simplified to <50 vertices. Used by the client for
   * circle-polygon intersection testing during pinch.
   */
  clipGeometry: GeoJSON.Polygon;
}

interface Official {
  name: string;
  title: string;
  party?: string;
  districtId: string;
  photoUrl?: string;
}
```

### Implementation

```
packages/shadow-atlas/src/serving/
├── bubble-service.ts          ← NEW: Geometry query for bubble extent
├── api.ts                     ← Add route: POST /v1/bubble-query
├── district-service.ts        ← Existing: R-tree + PIP (reused)
├── geocode-service.ts         ← Existing: Nominatim (extended for postal extent)
└── fence-service.ts           ← NEW: Compute boundary lines between adjacent districts
```

#### Fence Computation

Fences are the boundary lines between adjacent districts in the same layer. They're computed once and cached:

1. For each pair of districts in the same layer whose bounding boxes overlap:
   - Compute the geometric intersection of their boundaries
   - If the intersection produces a LineString (shared boundary): that's a fence
2. Store fences in a `fences` table indexed by bounding box (R-tree)
3. At query time: R-tree lookup for fences within the query extent, clip to extent

**Pre-computation cost**: O(n²) per layer, but with R-tree spatial filtering this is ~O(n log n). For 435 CDs, ~500 fence segments. For 7,400 state house districts, ~15,000 fence segments. Run once during `build-district-db.ts`.

**New table:**
```sql
CREATE TABLE fences (
  id TEXT PRIMARY KEY,               -- hash of district_a_id + district_b_id
  layer TEXT NOT NULL,               -- "congressional", "state_house", etc.
  district_a_id TEXT NOT NULL,
  district_b_id TEXT NOT NULL,
  district_a_name TEXT NOT NULL,
  district_b_name TEXT NOT NULL,
  geometry TEXT NOT NULL,            -- GeoJSON LineString
  landmark TEXT,                     -- Reverse-geocoded name of the boundary feature
  landmark_source TEXT,              -- "road", "river", "railway", etc.
  min_lon REAL NOT NULL,
  max_lon REAL NOT NULL,
  min_lat REAL NOT NULL,
  max_lat REAL NOT NULL,
  FOREIGN KEY (district_a_id) REFERENCES districts(id),
  FOREIGN KEY (district_b_id) REFERENCES districts(id)
);

CREATE VIRTUAL TABLE fence_rtree USING rtree(
  id, min_lon, max_lon, min_lat, max_lat
);

CREATE INDEX idx_fence_layer ON fences(layer);
```

#### Landmark Generation (Build-Time)

For each fence, reverse-geocode the midpoint via Nominatim to extract the road/river/railway name that the boundary follows. Store as `landmark` on the fence row. This runs during the build step, not at query time.

Most district boundaries follow:
- Major roads (40%)
- Rivers and waterways (25%)
- Railways and transit corridors (10%)
- Administrative boundaries with named features (15%)
- Arbitrary survey lines (10%) — these get no landmark

#### Performance

| Operation | Budget | Approach |
|-----------|--------|----------|
| Fence R-tree query | <5ms | SQLite virtual table, spatial index |
| District clip query | <10ms | Existing R-tree + simplification |
| Postal code geocode | <50ms | Nominatim local instance |
| Landmark lookup | 0ms | Pre-computed, stored on fence row |
| Total response | <100ms | Well within 300ms target |
| Response size | <50KB | Simplified geometries, ~30 fences + ~20 districts typical |
```

### Postal Code Bounding Box Sources

The system needs to know the geographic extent of a postal code (not just its centroid) to set the bubble's initial radius. Three strategies:

**Strategy A (Preferred): Nominatim bounding box.**
Nominatim returns a `boundingbox` field for every result: `[south_lat, north_lat, west_lng, east_lng]`. For postal code searches, this is the extent of the postal area. Available for US (ZCTAs in TIGER), Canada (FSAs in OSM), UK (postcode sectors in OS Open Data), and Australia (4-digit areas in ABS data via OSM). The bubble's initial radius is derived from this bbox.

**Strategy B (Fallback): Buffer around centroid.**
If Nominatim returns no bounding box (rare), use a country-specific buffer radius:
- US ZIP: 3km radius (average ZIP covers ~6km²)
- CA full code: 500m radius (very granular)
- UK postcode: 100m radius (covers ~15 addresses)
- AU 4-digit: 10km radius (coarser)

**Strategy C (Future): Pre-computed postal geometry table.**
For pixel-perfect bubble seeding, ingest actual postal code boundary polygons:
- US: ZCTA shapefiles from Census Bureau (free, ~50MB)
- CA: FSA boundary file from StatCan (free, ~5MB)
- UK: Code-Point Open from Ordnance Survey (free)
- Store in a separate `postal_areas` table in shadow-atlas DB, indexed by postal code

Strategy A is sufficient for MVP. Strategy C provides exact bubble radii and should be added when the corpus grows beyond US/CA.

### Country Detection (Extended)

Extend the existing `GeocodeService.detectCountry()`:

```typescript
static detectCountry(postalCode: string): 'US' | 'CA' | 'GB' | 'AU' | null {
  const trimmed = postalCode.trim().toUpperCase();

  // US: 5-digit or 5+4
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) return 'US';

  // Canada: A1A 1A1 or A1A1A1
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(trimmed)) return 'CA';

  // UK: complex but distinctive
  // Outcode (1-2 letters + 1-2 digits) + space + incode (digit + 2 letters)
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(trimmed)) return 'GB';

  // Australia: exactly 4 digits
  if (/^\d{4}$/.test(trimmed)) return 'AU';

  return null;
}
```

Note: AU (4-digit) vs partial US ZIP (4-digit, happens with leading zero ZIPs like 0210): resolved by requiring 5 digits for US. The only collision is if a user enters "0210" — handle by asking country if ambiguous.

---

## 5. COMMUNIQUE: The Bubble Component

### Component Architecture

```
src/lib/components/bubble/
├── Bubble.svelte              ← THE bubble. SVG circle + terrain + fences. Pinchable.
├── BubbleInput.svelte         ← Postal code entry that seeds/tightens the bubble
├── BubbleStatus.svelte        ← What the bubble currently resolves (district badges)
├── BubbleTerrain.svelte       ← The geography under the bubble (muted, cartographic)
└── bubble-state.svelte.ts     ← Shared reactive state: center, radius, cached geometry
```

The bubble is not in a `/location/` folder. It's not a "location component." It's the bubble.

### Bubble State: The Single Source of Truth

```typescript
// bubble-state.svelte.ts — Svelte 5 runes

export interface BubbleState {
  /** Center of the bubble in geographic coordinates */
  center: { lat: number; lng: number };

  /**
   * Radius in meters. This is the user's disclosed extent.
   * Seeded by the location signal, shaped by the user's gestures.
   *
   * Typical values:
   *   Country selection:  ~2,000,000m (continental)
   *   City name:          ~10,000m
   *   US ZIP:             ~3,000m (average ZIP extent)
   *   Canadian full code: ~500m
   *   UK postcode:        ~100m
   *   US ZIP+4:           ~50m (block face)
   *   GPS:                ~20m (accuracy circle)
   */
  radius: number;

  /** Cached district geometry within the bubble's initial query extent */
  cachedExtent: {
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    fences: Fence[];
    districts: CachedDistrict[];
  } | null;

  /** Derived: current precision level */
  precision: 'none' | 'country' | 'state' | 'county' | 'district';

  /** Derived: which layers are resolved at current radius */
  resolvedLayers: Record<string, { id: string; name: string; display: string }>;

  /** Derived: which layers still have fences inside the bubble */
  ambiguousLayers: Record<string, Array<{ id: string; name: string; coverage: number }>>;
}

interface Fence {
  /** The boundary line between two districts, clipped to query extent */
  geometry: GeoJSON.LineString;
  /** Which layer this fence belongs to */
  layer: string;
  /** District on each side */
  sides: [{ id: string; name: string }, { id: string; name: string }];
  /** Landmark label along the fence, if available */
  landmark?: string;
}

interface CachedDistrict {
  id: string;
  name: string;
  display: string;
  layer: string;
  /** Geometry clipped to query extent (for intersection testing) */
  clipGeometry: GeoJSON.Polygon;
}
```

**All derived state is computed client-side** from `center`, `radius`, and `cachedExtent`. When the user pinches, only `radius` changes. The derived state recomputes instantly by testing which fences are still inside the circle. Zero API calls during pinching.

### The Bubble: Visual Specification

The bubble is an SVG element that renders on top of a muted terrain layer.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│       muted terrain (slate-100 land, white roads)   │
│                                                     │
│              ┌─────────────┐                        │
│           ╱                   ╲                      │
│         ╱     · · · · · · · ·   ╲    ← bubble edge  │
│        │    ·                 ·   │     (soft glow)  │
│        │   · ╱ ╱ ╱ ╱ ╱ ╱ ╱   ·  │                  │
│        │  · ╱  Market St   ╱  ·  │    ← fence       │
│        │   ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱   ·  │     (dashed)     │
│        │    ·   CD-12        ·   │                  │
│         ╲    · · · · · · · ·   ╱                    │
│           ╲     CD-11        ╱                      │
│              └─────────────┘                        │
│                                                     │
│  94103 ▏▎▍▌▋▊                     pinch to tighten  │
│  ┌──────────────────┐                               │
│  │ 🏛 CA-11 resolved │  ⚪ State SD-11 resolved      │
│  │ ⚪ County: SF     │  ◐ State HD: 2 possible       │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

#### The Bubble Circle

- **Shape**: True circle (not ellipse, not rectangle). Circles are the most natural soft boundary — no corners, no orientation bias. The radius is uniform disclosure in all directions.
- **Fill**: Radial gradient from `transparent` at center to `blue-400/8` at edge. The center is fully clear — you see the terrain through it. The edge has a whisper of color — enough to perceive the boundary.
- **Edge**: Not a hard stroke. A soft glow: `filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.15))`. The edge feels atmospheric, not geometric.
- **Edge encoding**: Where the bubble edge crosses a district boundary, the glow intensifies to `blue-400/30` — a visual cue that "this is where your disclosure matters." Where the edge is in open terrain (no fences nearby), the glow is minimal.

#### Fences Inside the Bubble

District boundaries that pass through the bubble interior:

- **Line style**: `stroke-slate-400/50 stroke-width-1 stroke-dasharray-3-2`. Subtle dashed line. Not bold — fences are facts of geography, not UI elements.
- **Landmark label**: If a fence has a `landmark` field, the name is rendered along the line: `text-[10px] font-brand text-slate-400/60 fill-slate-400/60`. Italic. Oriented along the fence direction.
- **Fences dim as they approach the bubble edge**: `opacity` ramps from 1.0 at the center to 0.3 at the perimeter. Fences near the center are important (the user is clearly straddling them). Fences near the edge are marginal (a small pinch would shed them).

#### Fences Outside the Bubble

District boundaries in the terrain outside the bubble:

- **Line style**: `stroke-slate-200/30 stroke-width-0.5`. Barely visible. They exist in the world but not in the user's disclosure.
- **Purpose**: Provide geographic context. If the user sees a fence just barely outside their bubble, they understand: "one more pinch-out and I'd be ambiguous on that layer too."

#### Terrain Layer

Behind the bubble, a muted geographic base:

- **Roads**: `stroke-white/40 stroke-width-0.5` — white hairlines on `slate-50` ground.
- **Water**: `fill-slate-100/30` — barely distinguished from land.
- **No labels** except the landmark names on fences. The terrain is context, not content.
- **Source**: Pre-rendered tile from OSM at the appropriate zoom level, desaturated and lightened. Or: a simplified vector rendering from the same Nominatim/OSM data the shadow-atlas already uses.
- **Minimal**: at small bubble sizes (block-level), show roads only. At large bubble sizes (city-level), show major roads and water features. Never show buildings, parks, or POIs — the bubble is about districts, not about maps.

### The Pinch Interaction

**Mobile (primary surface):**

The bubble responds to standard multi-touch gestures:

1. **Pinch-to-zoom** (two fingers closing): Bubble radius decreases. The circle shrinks. Fences near the edge cross the perimeter and dim — the layer resolves. The shrink follows the gesture frame-by-frame with no latency (client-side math only).

2. **Reverse pinch** (two fingers opening): Bubble radius increases. The circle grows. Fences that were outside enter the bubble and activate — layers become ambiguous again. The user is choosing to disclose less. This must work as smoothly as shrinking. **The system never prevents the user from making the bubble larger.**

3. **Drag** (one finger on the bubble): Bubble center moves. The fences inside update (some enter, some leave). If the bubble moves outside the cached extent, a new API call fires (with loading indicator — the terrain beyond the cache is blank until the response arrives).

4. **Inertia and spring**: After a pinch release, the bubble settles with spring dynamics: slight overshoot (5%), then settle (200ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`). After a drag release, momentum carries the bubble for 300ms with friction decay.

**Desktop:**

1. **Scroll wheel on bubble**: Radius changes. Scroll up = shrink, scroll down = grow.
2. **Click and drag**: Moves the bubble center.
3. **Shift + scroll**: Fine-grained radius change (1/4 speed).

**Keyboard:**

1. **Focus on bubble** (Tab to reach it): `+`/`-` adjust radius in 10% steps.
2. **Arrow keys**: Move center by 1/10 of current radius per keystroke.
3. **Enter**: "Confirm current bubble" (saves current state, no further action needed unless the user returns to adjust).

**Typing postal characters:**

When the user types into the postal input field:
- The bubble center snaps to the new postal code's centroid (animated, 300ms)
- The bubble radius snaps to the new postal code's extent (animated, 300ms)
- If the new extent is outside the cached area, a new API call fires

This means: typing `94103` → bubble appears at ZIP extent. Then typing `-3114` → bubble smoothly tightens to ZIP+4 extent. The postal field and the gesture are two interfaces to the same object.

### BubbleStatus: What the Bubble Currently Resolves

Below the bubble visualization, a live readout of the bubble's resolution state:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ● Congressional: CA-11 (Pelosi)                    │  ← resolved (solid dot)
│  ● County: San Francisco                            │  ← resolved
│  ● State Senate: SD-11                              │  ← resolved
│  ◐ State House: HD-17 or HD-19                      │  ← ambiguous (half dot)
│    ↳ fence: Guerrero Street                         │     (the fence label)
│                                                     │
│  Bubble precision: county                           │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░  (visual precision bar)     │
│  country  state  county  district                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Resolved layers**: `●` solid dot + district name + representative name (if officials data available). `text-slate-800 font-brand font-medium`.

**Ambiguous layers**: `◐` half-filled dot + candidate list + the fence that separates them. `text-slate-500 font-brand`. The fence label is actionable — hovering/tapping it highlights that fence in the bubble visualization.

**Precision bar**: A 4-segment progress indicator showing the bubble's current precision level. Filled segments = achieved. Hollow = not yet. The bar doesn't demand progress — it shows position.

**Template access hint** (contextual, only when relevant): When the user is browsing a template that requires higher precision than the bubble provides:
```
This template is for your congressional district.
Tighten your bubble past the Guerrero Street line to access it.
```
This is not a gate. It's a map legend. "Here is the geometry; here is what it means."

### Persistence

The bubble persists across sessions. Stored in the user profile as:

```typescript
interface StoredBubble {
  center: { lat: number; lng: number };
  radius: number;
  /** ISO timestamp of last modification */
  updatedAt: string;
  /** How the bubble was seeded */
  seedSource: 'postal' | 'gps' | 'city' | 'country' | 'manual';
  /** Original postal code if seeded by postal entry */
  postalCode?: string;
}
```

**What is NOT stored**: The raw postal code is not used for anything after the bubble is seeded. The bubble's center and radius are the canonical representation. The postal code is a convenience hint for display ("94103") but the system uses the geometry, not the string.

**Stored WHERE**: In the communique database on the `User` model (new fields: `bubble_lat`, `bubble_lng`, `bubble_radius`, `bubble_updated_at`, `bubble_seed_source`). Client-side also cached in localStorage for instant render before the profile loads.

**Re-seeding**: The user can re-enter a postal code at any time. The bubble animates to the new location and size. The old bubble is gone — there is only one bubble, one geographic self.

---

## 6. ZIP+4: The Textual Pinch (US Only)

For US users, typing more postal characters is the textual equivalent of pinching the bubble smaller. The gesture and the keystroke do the same thing — tighten the disclosed region.

When the bubble is seeded from a 5-digit ZIP, the input field remains active with the cursor positioned after the ZIP. A subtle affordance:

> `94103-____` — type your +4 to tighten

ZIP+4 codes (e.g., 94103-3114) narrow to a **single block face** — one side of one block of one street. The bubble's radius snaps from ~3km (ZIP extent) to ~50m (block face). Every fence that was inside the bubble crosses the perimeter in a single satisfying contraction. All layers resolve.

The experience:
1. User types `94103` → bubble appears at ZIP extent (~3km radius)
2. User sees fences inside — Market Street bisecting the bubble
3. User types `-3114` → bubble smoothly contracts (300ms, ease-out) to block-face extent
4. All fences now outside the bubble → all layers resolve → status badges fill
5. The bubble is now very small, very precise — and still the user's

The shadow-atlas doesn't need a special ZIP+4 handler. The communique client:
1. Re-queries `/v1/bubble-query` with the ZIP+4 centroid and the tighter radius
2. The response confirms all districts are resolved (zero fences inside the tiny bubble)
3. Client-side geometry math confirms: bubble fits entirely within one district per layer

**Where do people know their ZIP+4?** From their mail — it's printed on every piece of USPS mail. Also available via USPS.com lookup (free, public).

**The bubble never disappears.** Even after ZIP+4 resolves everything, the tiny bubble persists in the user's profile. They can always zoom it back out. The textual pinch is a convenience, not an alternative to the bubble — it's a way to operate the bubble with the keyboard instead of the fingers.

---

## 7. PROGRESSIVE POSTAL SPECIFICITY (Per Country)

The system accepts whatever the user gives. The bubble is born at whatever size that signal produces. More characters = tighter bubble.

### United States
```
"94103"        → Bubble seeded at ZIP extent (~3km radius)
                  85% chance: all fences outside → all layers resolved
                  15% chance: 1-2 fences visible inside → user can pinch or type more
"94103-3114"   → Bubble tightens to block face (~50m radius)
                  >99% chance: all layers resolved
```

The user is never *asked* for the +4. The input field affords it. If they know it, the bubble tightens. If they don't, the bubble is fine at ZIP size — they pinch.

### Canada
```
"K1A"          → FSA only → Bubble seeded at FSA extent (~5-15km radius)
                  Too large: 75% of the time, fences visible inside
                  Input field prompts: "Enter full code (e.g., K1A 0A6)"
"K1A 0A6"     → Full code → Bubble tightens to ~500m radius
                  98.8% chance: all layers resolved
                  1.2%: one riding fence visible — user pinches past it
```

For Canada, detect partial FSA entry and expand the input: the 3-character FSA seeds the bubble at city scale (valid, but coarse), and the field hints at the full format. The bubble never prevents access — it just honestly shows the precision level.

### United Kingdom
```
"SW1A 1AA"     → Full postcode → Bubble seeded at ~100m radius
                  99.76%: all layers resolved (tiny bubble, everything outside)
                  0.24%: one constituency fence (~4,300 split postcodes)
                  Always binary: exactly 2 constituencies max → one pinch
```

UK is the easiest case. The postcode system is so granular that the bubble is born small enough to resolve almost everything immediately. The rare split postcode produces exactly one fence — the user sees it and either pinches past it or doesn't.

### Australia
```
"2000"         → 4-digit postcode → Bubble seeded at postcode extent
                  77%: all layers resolved
                  23%: electorates straddle — fences visible inside
                  Suburb name tightens further: "Surry Hills" + 2010 → ~1km bubble
```

For Australia, the input accepts suburb names as additional tightening signals. Australian users think in suburbs, not postcodes — "Surry Hills 2010" is more natural than just "2010". The suburb centroid + postcode produces a tighter bubble that usually resolves everything.

---

## 8. CROSS-CODEBASE DATA FLOW

### shadow-atlas (voter-protocol)

**New files:**
```
src/serving/bubble-service.ts   ← BubbleService: geometry query engine
src/serving/fence-service.ts    ← FenceService: boundary line computation + cache
src/transformation/fence-builder.ts ← Build-time: compute fences between adjacent districts
```

**Modified files:**
```
src/serving/api.ts              ← Register POST /v1/bubble-query
src/serving/geocode-service.ts  ← Extend detectCountry() for UK/AU, add geocodePostal()
src/serving/district-service.ts ← Add queryBbox() and clipToExtent() public methods
src/transformation/rtree-builder.ts ← Add fence table + fence_rtree creation
src/db/schema.sql               ← Add fences table DDL
```

**New database table:** `fences` + `fence_rtree` (see Section 4). Pre-computed during `build-district-db.ts`. Adds ~2MB to the database for US + CA fences.

### communique (frontend)

**New files:**
```
src/lib/components/bubble/Bubble.svelte
src/lib/components/bubble/BubbleInput.svelte
src/lib/components/bubble/BubbleStatus.svelte
src/lib/components/bubble/BubbleTerrain.svelte
src/lib/components/bubble/bubble-state.svelte.ts
src/lib/components/bubble/bubble-geometry.ts    ← Client-side circle/polygon intersection
src/lib/core/shadow-atlas/bubble-client.ts      ← API client for /v1/bubble-query
src/routes/api/shadow-atlas/bubble/+server.ts   ← Server proxy
```

**Modified files:**
```
src/lib/components/template-browser/LocationFilter.svelte ← Replace with Bubble
src/lib/core/shadow-atlas/client.ts                        ← Add bubbleQuery()
prisma/schema.prisma                                       ← Add bubble fields to User
```

**New User model fields:**
```prisma
model User {
  // ... existing fields ...

  // Geographic bubble (persistent identity)
  bubble_lat       Float?    // Bubble center latitude
  bubble_lng       Float?    // Bubble center longitude
  bubble_radius    Float?    // Bubble radius in meters
  bubble_updated   DateTime? // Last bubble modification
  bubble_seed      String?   // How seeded: "postal", "gps", "city", "country"
}
```

**Integration with LocationFilter:** The existing 5-signal inference (GPS, IP, OAuth, timezone, verified address) becomes a **bubble seeder**. Each signal seeds the bubble at a different radius:
- GPS: seeds at accuracy-circle radius (~20m) → usually district-resolved immediately
- IP: seeds at ~10km → city-level, needs pinching for district
- Verified address: seeds at ~50m → resolved
- Postal code: seeds at postal-extent radius (varies by country)

The LocationFilter doesn't infer a district anymore. It infers a bubble seed. The bubble handles everything from there.

### voter-protocol (ZK layer)

**No changes.** The ZK circuits take `district_id` → Merkle proof → nullifier → ZK proof. The bubble is a UX concept that produces a `district_id`. The circuit is agnostic to how it was produced.

**One subtlety:** If the bubble is ambiguous (user hasn't pinched past a CD fence), the system cannot generate a ZK proof for congressional district membership — because the district isn't known. The bubble makes this visible: "tighten your bubble to generate a verified position." The ZK layer doesn't need to handle ambiguity; the bubble prevents ambiguous inputs from reaching it.

---

## 9. EDGE CASES

### Postal code not found
Nominatim returns no results. The input field highlights softly in rose. No bubble appears — you can't birth a bubble from a nonexistent place. Message: "We couldn't find that postal code. Check the format and try again." The bubble state remains whatever it was before (null if first entry, or previous position if re-seeding).

### User enters a Canadian FSA (3 characters only)
Auto-detect as partial. The bubble **does** appear — seeded at FSA extent (city-scale, ~15km radius). This is a valid bubble; the user just has a large one. The input field hints: "Full code for a tighter bubble (e.g., K1A 0A6)" with cursor positioned after the FSA. The user can use the FSA-scale bubble (accessing country-level and state/province-level templates) or type more characters to tighten it.

### Multiple fences from different layers inside the bubble simultaneously
Common: a US ZIP could straddle both a CD boundary and a state house boundary (different lines). The bubble shows **all** fences simultaneously, color-coded by layer: `blue-400` for congressional, `emerald-400` for state senate, `amber-400` for state house. As the user pinches, fences from different layers cross the perimeter at different radii — the user resolves layers incrementally, most-outer-fence first. There is no "tap to resolve" — the pinch handles everything continuously.

### Postal code spans a state line
153 US ZIPs cross state lines. The shadow-atlas handles this naturally — the R-tree query returns districts from both states. The bubble shows the state boundary as a fence (a thick fence, since it separates multiple downstream layers simultaneously). Pinching past the state line fence resolves the state layer AND all sub-state layers on the shed side — a cascading resolution that feels deeply satisfying.

### User moves (re-seeding the bubble)
The user enters a new postal code. The bubble animates to the new location (300ms, ease-out transition of center and radius). The old bubble is gone — there is only one bubble. Previous ZK proofs are unaffected (they're committed on-chain). The new bubble produces new `district_id` values for future actions.

If the user has a persistent bubble and opens the bubble editor, the current bubble is shown with a "Re-seed" affordance: the postal input field pre-filled with the display hint of the original seed (e.g., "94103"). Clearing and typing a new code births the bubble at the new location.

### Pre-launch: no shadow-atlas available
If the shadow-atlas API is unreachable, the bubble degrades to **postal-code-only mode**: the bubble appears at the postal code centroid with an estimated radius (country-specific defaults from Section 7), but with no fences rendered. The bubble is featureless — a soft circle on blank terrain. Precision is inferred from the postal code format alone (ZIP = state-level, full Canadian code = district-level assumption). Template scoping works at reduced granularity. When the shadow-atlas comes back online, the next bubble interaction re-queries and fences appear.

### PO Box / non-geographic postal codes
Some postal codes (e.g., US PO Boxes, Canadian "H0H 0H0" for Santa Claus) map to a building, not a region. Nominatim returns a point with no extent. The bubble seeds at the point with a minimal radius (~100m) — which usually puts the user squarely in one district for all layers. Message: "This looks like a PO Box. The bubble is placed at its location — adjust if needed."

### Bubble at maximum extent (country selection only)
If the user's only signal is country selection (no postal code, no GPS), the bubble is the entire country. Radius ~2,000km for the US. This is valid. The bubble terrain shows only the country outline (no district fences at this zoom — too many to render). Precision = country. The user accesses national-scope templates. The prompt is gentle: "Enter a postal code to see local campaigns." No gate, no demand.

### Zero-signal state (brand new user, no location at all)
No bubble exists. The user sees templates with `minimum_precision_required: 'none'` (international/universal scope). The browse page shows: "Add your location to see campaigns near you." This is the only state where the bubble literally does not exist — it has not been born yet.

---

## 10. VALIDATE: Experiential & Analytical Criteria

### Phenomenological Validation

**Birth test.** Type a postal code on a phone. The bubble should appear within 1 second of the last keystroke — the terrain materializes, fences are visible, the bubble is alive. If it takes longer, the felt connection between keystroke and spatial consequence is lost.

**Trust test.** Show the postal input to someone who has never seen the platform. Ask: "Does this feel safe to enter?" Compare with showing them a full address form. The postal code should feel trivially safe. Then show them the bubble that appears. Ask: "What is this?" The answer should be spatial ("it's showing me my area") not procedural ("it's asking me to pick something").

**Ownership test.** After the bubble appears, does the user feel it's theirs? Signs: they immediately try to touch it (pinch, drag). They refer to it as "my bubble" or "my area," not "the map" or "the thing." They resist when you suggest removing it.

**Dwelling test.** Leave the bubble on screen for 30 seconds without interacting. Does it feel like a living thing resting, or a dialog waiting for input? The gentle glow, the muted terrain, the fence labels — these should create a space you could sit in. If it feels like it's nagging you to do something, the atmosphere is wrong.

**Pinch satisfaction test.** When a fence crosses the perimeter during a pinch — does that micro-moment feel like something? The fence should dim and slide outward with a tiny bit of visual weight, and the BubbleStatus badge for that layer should fill. The resolution of each layer should be a small, satisfying event — not a checkbox, but a felt shift in the bubble's character.

**Agency test.** Can the user make the bubble larger again after shrinking it? This must be trivially easy and the system must not resist. If the user feels punished for making the bubble larger (losing access to templates they could see a moment ago), the agency model is broken. Templates don't disappear — they dim, with a gentle "tighten to access."

### Analytical Validation

**Resolution rates (target — percentage of postal codes where ALL fences are outside the initial bubble):**
- US 5-digit ZIP: >85% fully resolved at seed
- US ZIP+4: >99% fully resolved at seed
- CA full code: >98% fully resolved at seed
- UK full postcode: >99% fully resolved at seed
- AU 4-digit: >77% fully resolved at seed

**Timing:**
- Postal code → bubble-query response: <300ms (p95)
- Bubble render (terrain + fences + circle): <50ms
- Pinch gesture → visual update: <16ms (single frame — client-side math only)
- Bubble tighten animation (ZIP → ZIP+4): 300ms, ease-out
- Bubble drag → cache miss → re-query: <500ms total
- Total first-bubble experience (type postal + bubble appears): <1000ms

**Accessibility:**
- `BubbleInput`: `role="textbox"`, `aria-label="Postal code"`, format hint as `aria-describedby`
- `Bubble` (the SVG circle): `role="application"`, `aria-label="Your geographic bubble showing {n} district boundaries"`, `aria-roledescription="interactive map"`
- Fences: `role="img"`, `aria-label="{layer} boundary at {landmark}: {district_a} / {district_b}"`
- `BubbleStatus` layer badges: `role="list"`, each badge is `role="listitem"` with `aria-label="{layer}: resolved to {district}" | "{layer}: could be {a} or {b}"`
- **Keyboard pinch**: `+`/`-` adjust radius in 10% steps, arrow keys move center
- **Text-based alternative**: Below the bubble, a collapsible "Adjust with text" panel shows the input field and current resolution status as text. Screen reader users get the full experience through status announcements.
- `prefers-reduced-motion`: Bubble transitions are instant (no animation), fences appear/disappear without fade
- Screen reader announcement on resolution change: "Congressional district resolved: CA-11" (aria-live region)

**Privacy:**
- **The raw postal code is not stored.** Only `bubble_lat`, `bubble_lng`, `bubble_radius` are persisted on the User model. The postal code is a seed — once the bubble is born, the string is discarded.
- Shadow-atlas logs queries for rate limiting only (TTL 1 hour, no PII association, keyed by IP hash not user ID)
- No geolocation API is called — the postal code is user-volunteered, not observed
- The bubble visualization is rendered entirely client-side from the shadow-atlas geometry response — no third-party map tile requests that could leak location
- When the user makes the bubble larger, previously resolved district_ids are erased from client state (not just hidden — gone). The bubble forgets what it no longer encompasses.

---

## 11. IMPLEMENTATION ORDER

### Phase 1: Shadow-atlas geometry engine
1. Add `fences` table + `fence_rtree` to `schema.sql`
2. Implement `FenceService` — compute boundary lines between adjacent districts per layer
3. Add fence computation to `build-district-db.ts` (build-time, ~5 min for US + CA)
4. Extend `GeocodeService.detectCountry()` for UK/AU formats
5. Add `geocodePostal()` method — Nominatim search with `postalcode` param, returns centroid + bbox
6. Implement `BubbleService` — R-tree query for fences + districts within bbox, clip to extent
7. Add `POST /v1/bubble-query` route
8. Test with US ZIPs and Canadian postal codes from seed data: verify response contains correct fences and clipped district geometries

### Phase 2: Communique bubble state + input
1. Create `bubble-state.svelte.ts` — reactive state with `center`, `radius`, `cachedExtent`, derived `precision` / `resolvedLayers` / `ambiguousLayers`
2. Implement `bubble-geometry.ts` — client-side circle-polygon intersection, fence-inside-circle testing
3. Build `BubbleInput.svelte` — postal code entry with country-specific formatting, progressive specificity (ZIP → ZIP+4 affordance)
4. Build `bubble-client.ts` — API client for `POST /v1/bubble-query` (through server proxy)
5. Add server proxy route: `src/routes/api/shadow-atlas/bubble/+server.ts`
6. Add bubble fields to User model in Prisma schema (`bubble_lat`, `bubble_lng`, `bubble_radius`, `bubble_updated`, `bubble_seed`)
7. Test: postal code entry → API call → state hydration → derived precision is correct

### Phase 3: The bubble (the living object)
1. Build `BubbleTerrain.svelte` — muted cartographic base layer (OSM tiles, desaturated)
2. Build `Bubble.svelte` — SVG circle with radial gradient, soft glow edge, fence rendering inside
3. Implement pinch interaction — touch events on mobile, scroll-wheel on desktop, keyboard +/-
4. Implement drag interaction — one-finger/click-drag repositions center
5. Wire pinch/drag to `bubble-state` — radius/center changes trigger derived recomputation, zero API calls
6. Implement cache-miss detection — when bubble moves outside `cachedExtent.bbox`, fire new API call
7. Build `BubbleStatus.svelte` — resolved/ambiguous layer readout with precision bar
8. Implement spring dynamics — inertia on drag release, slight overshoot on pinch release
9. Implement bubble persistence — save to User model on settle, restore from localStorage on load
10. Wire into `LocationFilter` replacement — bubble seeder from GPS/IP/OAuth signals

### Phase 4: Polish + international
1. Add landmark labels on fences (from pre-computed `landmark` field)
2. Implement layer color coding — blue (congressional), emerald (state senate), amber (state house), slate (county)
3. Add fence-edge intensity encoding — glow intensifies where bubble edge crosses a fence
4. Add UK postcode support (easiest — tiny bubbles, rare fences)
5. Add AU postcode support (suburb name as secondary tightening signal)
6. Implement `prefers-reduced-motion` — instant transitions, no spring dynamics
7. Implement screen reader announcements — aria-live region for resolution changes
8. Add text-based alternative panel (collapsible, below bubble)

---

## Appendix A: Bubble Scenarios From Seed Data

### 94103 (San Francisco, seed templates: 3 SF-scoped)

```
ZIP 94103 covers SoMa, parts of Mission, Hayes Valley.
Bubble seeded: center ≈ (37.773, -122.411), radius ≈ 3,000m

bubble-query response includes:
  fences: [
    { layer: "congressional", sides: ["CA-11", "CA-12"], landmark: "Market Street" }
  ]
  districts: [
    { id: "cd-0611", name: "CA-11", layer: "congressional" },
    { id: "cd-0612", name: "CA-12", layer: "congressional" },
    { id: "sldu-06011", name: "SD-11", layer: "state_senate" },
    { id: "sldl-06017", name: "HD-17", layer: "state_house" },
    { id: "county-06075", name: "SF County", layer: "county" }
  ]
```

**What the user sees:** A bubble at ZIP extent. One dashed line labeled "Market Street" runs through it (the congressional fence). State senate, state house, and county all have their districts entirely within the bubble — resolved. Congressional has two districts straddling the fence — ambiguous.

**BubbleStatus reads:** `● County: SF` `● State Senate: SD-11` `● State House: HD-17` `◐ Congressional: CA-11 or CA-12 (fence: Market St)`

**To resolve:** Pinch the bubble until Market Street is outside. Or type `94103-3114` — the bubble snaps to a block face, Market Street is now well outside, all layers resolve.

### K1A 0A6 (Ottawa, Parliament Hill)

```
Full Canadian postal code K1A 0A6 is Parliament Hill itself.
Bubble seeded: center ≈ (45.424, -75.700), radius ≈ 500m

bubble-query response includes:
  fences: []  (no fences within this tiny bubble)
  districts: [
    { id: "can-fed-35075", name: "Ottawa Centre", layer: "federal_riding" }
  ]
```

**What the user sees:** A tiny bubble on the Ottawa River. No fences. Everything is resolved at birth. The bubble is small and calm.

**BubbleStatus reads:** `● Federal riding: Ottawa Centre`

The bubble persists. The user sees their riding. They access all Ottawa-scoped and Canada-scoped templates. No further interaction needed.

### 97201 (Portland, OR — near seed template: Oregon healing)

```
ZIP 97201 covers downtown Portland, parts of SW Portland.
Bubble seeded: center ≈ (45.511, -122.683), radius ≈ 2,500m

bubble-query response includes:
  fences: [
    { layer: "state_house", sides: ["HD-33", "HD-36"], landmark: "Burnside Street" }
  ]
  districts: [
    { id: "cd-4101", name: "OR-01", layer: "congressional" },
    { id: "sldu-41017", name: "SD-17", layer: "state_senate" },
    { id: "sldl-41033", name: "HD-33", layer: "state_house" },
    { id: "sldl-41036", name: "HD-36", layer: "state_house" },
    { id: "county-41051", name: "Multnomah", layer: "county" }
  ]
```

**What the user sees:** A bubble at ZIP extent. Congressional, state senate, and county are all resolved (no fences for those layers). One amber fence labeled "Burnside Street" — the state house boundary.

**BubbleStatus reads:** `● Congressional: OR-01` `● State Senate: SD-17` `● County: Multnomah` `◐ State House: HD-33 or HD-36 (fence: Burnside St)`

**To resolve:** Pinch the bubble until Burnside Street is outside. One gentle tighten.

---

## Appendix B: API Wire Format Example

### Request — Bubble seeded from postal code
```json
POST /v1/bubble-query
Content-Type: application/json

{
  "center": { "lat": 37.7727, "lng": -122.4111 },
  "radius": 3000,
  "postal_code": "94103"
}
```

The `postal_code` field is optional metadata — it allows the response to include the postal code's own geographic extent (for setting the initial bubble radius). The endpoint works identically without it; `center` + `radius` are the only required fields.

### Response — Raw geometry for client-side resolution
```json
{
  "center": { "lat": 37.7727, "lng": -122.4111 },
  "queryBbox": {
    "minLat": 37.738,
    "maxLat": 37.807,
    "minLng": -122.448,
    "maxLng": -122.374
  },
  "postalExtent": {
    "centroid": { "lat": 37.7727, "lng": -122.4111 },
    "bbox": { "minLat": 37.765, "maxLat": 37.785, "minLng": -122.425, "maxLng": -122.400 },
    "radius": 2800,
    "country": "US"
  },
  "fences": [
    {
      "id": "f-cd0611-cd0612",
      "layer": "congressional",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-122.425, 37.775], [-122.415, 37.777], [-122.400, 37.778]]
      },
      "sides": [
        { "districtId": "cd-0611", "name": "CA-11" },
        { "districtId": "cd-0612", "name": "CA-12" }
      ],
      "landmark": "Market Street",
      "landmarkSource": "road"
    }
  ],
  "districts": [
    {
      "id": "cd-0611",
      "name": "CA-11",
      "display": "California's 11th Congressional District",
      "layer": "congressional",
      "clipGeometry": {
        "type": "Polygon",
        "coordinates": [[[...simplified polygon, <50 vertices...]]]
      }
    },
    {
      "id": "cd-0612",
      "name": "CA-12",
      "display": "California's 12th Congressional District",
      "layer": "congressional",
      "clipGeometry": {
        "type": "Polygon",
        "coordinates": [[[...simplified polygon, <50 vertices...]]]
      }
    },
    {
      "id": "sldu-06011",
      "name": "SD-11",
      "display": "California State Senate District 11",
      "layer": "state_senate",
      "clipGeometry": {
        "type": "Polygon",
        "coordinates": [[[...simplified polygon...]]]
      }
    },
    {
      "id": "sldl-06017",
      "name": "HD-17",
      "display": "California State Assembly District 17",
      "layer": "state_house",
      "clipGeometry": {
        "type": "Polygon",
        "coordinates": [[[...simplified polygon...]]]
      }
    },
    {
      "id": "county-06075",
      "name": "SF County",
      "display": "San Francisco County",
      "layer": "county",
      "clipGeometry": {
        "type": "Polygon",
        "coordinates": [[[...simplified polygon...]]]
      }
    }
  ],
  "officials": [
    {
      "name": "Nancy Pelosi",
      "title": "U.S. Representative",
      "party": "D",
      "districtId": "cd-0611"
    },
    {
      "name": "Scott Wiener",
      "title": "State Senator",
      "party": "D",
      "districtId": "sldu-06011"
    }
  ]
}
```

**Note what the response does NOT contain:**
- No `fully_resolved` field. Resolution is a client-side computation.
- No `resolved: true/false` per layer. The client determines which fences are inside the bubble.
- No `disambiguation_hints` with directional language ("North of..."). The fences + landmarks speak for themselves — the client renders the fence with its landmark label and the user sees the spatial relationship directly.
- No `pin` field. There is no "tap to resolve" interaction. The user pinches.

### Request — Bubble moved (cache miss)
```json
POST /v1/bubble-query
Content-Type: application/json

{
  "center": { "lat": 37.800, "lng": -122.430 },
  "radius": 2000
}
```

Same endpoint, same response shape. No postal code needed — the bubble has been dragged to a new location. The shadow-atlas doesn't care how the bubble got there.
```
