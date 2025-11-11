# Progressive Location Discovery: Stepwise Precision Without Interruption

**Status**: SPECIFICATION
**Created**: 2025-11-10
**Problem**: First-time modal breaks momentum, templates not scoped to neighborhood advocacy

---

## The Problem

**Current flow (BROKEN):**
```
1. User lands on homepage
2. 🚫 MODAL POPUP: "Location inferred from IP - Showing legislation relevant to your district"
3. User must click "Got it" before seeing templates
4. Templates shown at state-level only (IP can't determine district)
5. No incentive to grant GPS or enter address
6. User never discovers neighborhood campaigns
```

**Drop-off**: Modal interruption + lack of neighborhood discovery = poor engagement

---

## Design Principles (From `voice.md`)

✅ **Primary**: State what is ("Bills in Texas")
✅ **Popover**: Technical details for those who ask
❌ **No pre-defending**: Don't explain what we're not
❌ **No interruptions**: From link to action in seconds

---

## The Fix: Progressive Precision Funnel

### 3-Step Geographic Scoping

**Step 1: State (IP-based, 89% accurate)**
- Header: "Campaigns in Texas"
- Templates: All statewide + national
- Coordination: "47 Texans sent this"
- Affordance: "See what's happening in your county →"

**Step 2: County/City (GPS-based, 95% accurate)**
- Header: "Campaigns in Travis County"
- Templates: County-level + city-level + state + national
- Coordination: "12 neighbors in Travis County"
- Affordance: "Find who represents you →"

**Step 3: District (Address-verified, 100% accurate)**
- Header: "Campaigns in TX-25"
- Templates: District-specific + county + state + national
- Coordination: "You + 8 others in TX-25"
- No further refinement needed

---

## Template Hierarchy by Precision

```
National (always shown)
  └─ "Tell Spotify: Fair artist pay"
  └─ "Amazon: Stop union busting"

State-level (shown with IP)
  └─ "Texas school board: Ban book bans" (47 Texans sent this)
  └─ "Austin City Council: Affordable housing" (visible but greyed: "Enable location to act")

County-level (shown with GPS)
  └─ "Travis County Sheriff: End ICE cooperation" (12 neighbors sent this)
  └─ "Round Rock ISD: Teacher pay raise" (visible but greyed: "Enter address to act")

District-level (shown with address)
  └─ "Rep. McCaul: Vote yes on H.R. 1234" (You + 8 others)
  └─ "Cedar Park HOA: Stop excessive fines" (3 neighbors on your block)
```

---

## UI Pattern: Integrated Filter Header

### State-Level (IP Only)

```
┌─────────────────────────────────────────────┐
│ 📍 Campaigns in Texas                       │
│                                             │
│ [See what's happening in your county →]    │
└─────────────────────────────────────────────┘

Templates below:
- National campaigns (all)
- Texas statewide (47 Texans sent this)
- Travis County campaigns (greyed, "Enable location")
```

### County-Level (GPS Enabled)

```
┌─────────────────────────────────────────────┐
│ 📍 Campaigns in Travis County               │
│ GPS • 95% precision                         │
│                                             │
│ [Find who represents you →]                │
└─────────────────────────────────────────────┘

Templates below:
- National campaigns
- Texas statewide
- Travis County campaigns (12 neighbors)
- Austin city campaigns (5 nearby)
- TX-25 campaigns (greyed, "Enter address")
```

### District-Level (Address Verified)

```
┌─────────────────────────────────────────────┐
│ 📍 Campaigns in TX-25 (Rep. Michael McCaul) │
│ Address verified • 100% precision           │
│                                             │
│ Showing 23 campaigns in your district      │
└─────────────────────────────────────────────┘

Templates below:
- All templates at all levels
- Sorted by: District → County → State → National
- Coordination: "You + 8 others in TX-25"
```

---

## Affordances: Progressive Prompts

### 1. State → County (GPS Prompt)

**Trigger**: User clicks "See what's happening in your county"

**Browser prompt**: "Allow location access to see county-level advocacy"

**Result**: Header updates to "Bills in Travis County", county templates appear

### 2. County → District (Address Form)

**Trigger**: User clicks "Find your representative"

**Modal**: Address form (Census API geocoding → district lookup)

**Result**: Header updates to "Bills in TX-25", district templates appear

---

## Coordination Signals

### State-Level
```
"Texas school vouchers"
47 Texans sent this
Active in 12 counties
```

### County-Level
```
"Travis County property tax relief"
12 neighbors sent this
3 in your zip code
```

### District-Level
```
"TX-25 constituent services"
You + 8 others
2 on your block (if same zip+4)
```

---

## Voice & Copy

### Header States

**IP (State):**
- Primary: "Campaigns in Texas"
- Popover: "State from IP. GPS for county precision."

**GPS (County):**
- Primary: "Campaigns in Travis County"
- Popover: "County from GPS. Enter address for district."

**Address (District):**
- Primary: "Campaigns in TX-25"
- Popover: "District from verified address."

### Affordance Buttons

**State → County:**
- ✅ "See what's happening in your county"
- ❌ "Enable location for better results"

**County → District:**
- ✅ "Find who represents you"
- ❌ "Enter address for full access"

### Template Cards (Greyed Out)

**County bill (without GPS):**
```
"Travis County property tax relief"
12 neighbors sent this

[Enable location to see this] ←  Not "Unlock" or "Access"
```

**District bill (without address):**
```
"TX-25 housing affordability"
You + 8 others

[Enter address to act] ←  Direct, imperative
```

---

## Implementation Changes

### 1. Remove Modal (Lines 357-443)

**Delete**:
```svelte
{#if showPrivacyExplainer && hasLocation}
  <div class="fixed inset-0 z-50 ...">
    <!-- Modal content -->
  </div>
{/if}
```

**Reason**: Interrupts flow, violates "no interruptions" principle

### 2. Integrate Location into Header

**Replace modal with inline header**:
```svelte
<header class="mb-6">
  <h1 class="text-3xl font-bold">
    {#if district}
      Campaigns in {district}
    {:else if county}
      Campaigns in {county}
    {:else if state}
      Campaigns in {state}
    {:else}
      National campaigns
    {/if}
  </h1>

  <!-- Progressive affordance -->
  {#if !district && !county}
    <button onclick={requestGPS}>
      See what's happening in your county →
    </button>
  {:else if !district && county}
    <button onclick={openAddressForm}>
      Find who represents you →
    </button>
  {/if}
</header>
```

### 3. Template Sorting by Precision

**Order**:
1. District-specific (if address verified)
2. County-specific (if GPS enabled)
3. State-specific (if IP detected)
4. Federal (always)

**Visual treatment**:
- **Actionable**: Full color, "Send message" button
- **Requires GPS**: 60% opacity, "Enable location to act"
- **Requires address**: 60% opacity, "Enter address to act"

### 4. Coordination Counts

**API endpoint** (new):
```typescript
GET /api/templates/:id/coordination?level=state|county|district

Response:
{
  state: { count: 47, scope: "Texas" },
  county: { count: 12, scope: "Travis County" },
  district: { count: 9, scope: "TX-25" },
  block: { count: 2, scope: "78701" } // if zip+4 available
}
```

---

## Privacy Guarantees (Unchanged)

- ✅ IP → State mapping happens server-side (MaxMind)
- ✅ GPS → County/City mapping happens browser-side (Nominatim)
- ✅ Address → District mapping happens server-side (Census API), encrypted
- ✅ All signals stored in IndexedDB (never sent to our DB)
- ✅ Coordination counts are aggregate (no individual tracking)

---

## Migration Strategy

### Phase 1: Remove Modal ✅
- Delete lines 357-443 (modal)
- Delete localStorage check for `location_privacy_explainer_seen`
- User lands, sees "Bills in Texas" immediately

### Phase 2: Integrated Header
- Replace LocationFilter card with page header
- Move affordance buttons into header
- Templates auto-filter based on current precision

### Phase 3: Progressive Prompts
- "See county" → GPS prompt → Show county templates
- "Find rep" → Address modal → Show district templates
- Each step reveals MORE, not ALL

### Phase 4: Coordination Signals
- Add county/district coordination counts
- "12 neighbors in Travis County sent this"
- "You + 8 others in TX-25"

---

## Success Metrics

**Engagement:**
- GPS permission grant rate: Target 40%+ (vs. 10% with modal)
- Address entry rate: Target 20%+ (vs. 5% without incentive)
- Template interaction: Target 60%+ (vs. 30% state-only)

**Discovery:**
- County templates viewed: Target 40% of users
- District templates viewed: Target 20% of users
- Neighborhood coordination: Target 10% see "neighbors on this"

**Conversion:**
- State templates → Send: 15%
- County templates → Send: 30% (higher relevance)
- District templates → Send: 50% (highest relevance)

---

## Voice Compliance Checklist

From `voice.md`:

- ✅ No pre-defending ("Location inferred from IP" removed from primary)
- ✅ No over-explaining (modal deleted)
- ✅ Progressive disclosure (GPS/address prompts only when user asks)
- ✅ Imperative voice ("See county", not "You can see")
- ✅ Geographic scope clear ("Travis County", not "your area")
- ✅ No hedging ("Bills in Texas", not "We think you're in Texas")

---

## Bottom Line

**Before**: Modal interrupts → User sees state templates only → No incentive to refine → Poor engagement

**After**: Integrated header → Progressive affordance → County/district discovery → Neighborhood coordination visible → Higher conversion

**Core insight**: Each precision step reveals MORE RELEVANT templates (neighbors working on local issues), creating natural funnel to address verification.

---

**Next**: Implementation in `LocationFilter.svelte` + template browser header integration
