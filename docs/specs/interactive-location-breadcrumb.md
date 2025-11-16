# Interactive Location Breadcrumb Navigation - Implementation Spec

**Status:** Planning
**Created:** 2025-11-15
**Owner:** Frontend Team

## Problem Statement

Current breadcrumb navigation (lines 1119-1228 in LocationFilter.svelte) is **passive** - it only filters templates by geographic scope. Users can't:

1. **Edit location** - No way to change country/state/city without entering full address
2. **Navigate hierarchically** - Can't explore templates in different locations
3. **Discover coordination** - Limited affordance showing what's available elsewhere

This creates friction when users want to:
- Browse templates in a different city (e.g., "What's happening in Austin?")
- Compare coordination across states (e.g., "California vs. Texas initiatives")
- Explore templates without committing to location change (ephemeral exploration)

## Design Philosophy

**Dual-mode interaction:**

1. **Filter mode** (current): Click breadcrumb → filter templates to that scope
2. **Edit mode** (new): Hover → pencil appears → click → autocomplete dropdown → change location

**Mobile consideration:**
- Single pencil icon at end of breadcrumb trail
- Tap pencil → modal with cascading dropdowns (country → state → city)
- No hover states on mobile (use explicit edit affordance)

## UX Patterns Reference

**Desktop:**
- **Google Calendar timezone selector**: Click location → autocomplete search
- **Airbnb location picker**: Click "Where to?" → autocomplete with suggestions
- **Notion page location**: Click breadcrumb → dropdown with hierarchy + search

**Mobile:**
- **Uber destination picker**: Tap location → full-screen search with recent/favorites
- **Google Maps search**: Tap search bar → autocomplete with map preview
- **Instagram location tag**: Tap edit → search with recent locations

## Technical Requirements

### 1. Free Autocomplete API (CRITICAL)

**Option A: Nominatim (OpenStreetMap) - RECOMMENDED**

- **Cost:** FREE (self-hosted or public instance)
- **API:** https://nominatim.openstreetmap.org/
- **Rate limit:** 1 req/sec on public instance (acceptable for user typing debounce)
- **Coverage:** Worldwide, city-level granularity
- **Example query:** `https://nominatim.openstreetmap.org/search?q=San+Francisco&format=json&addressdetails=1&limit=5`
- **Response includes:** country, state, city, lat/lon, bounding box

**Why Nominatim:**
- Open source, no API key required
- Can self-host for unlimited requests (Docker image available)
- Supports hierarchical queries (country → state → city)
- Includes administrative boundaries (needed for state/province mapping)

**Option B: GeoNames (fallback)**

- **Cost:** FREE for <30K daily credits
- **API:** http://api.geonames.org/
- **Coverage:** Worldwide, comprehensive city/municipality database
- **Downside:** Requires free API key registration

**Rejected:**
- Google Places Autocomplete: $2.83 per 1000 requests (too expensive)
- Mapbox Geocoding: $0.50 per 1000 requests (paid tier required)
- HERE Geocoding: Freemium but requires credit card

### 2. Hierarchical Location Data Structure

```typescript
interface LocationHierarchy {
  country: {
    code: string; // 'US', 'CA', 'GB'
    name: string; // 'United States', 'Canada', 'United Kingdom'
  };
  state: {
    code: string; // 'CA', 'ON', 'QLD'
    name: string; // 'California', 'Ontario', 'Queensland'
    country_code: string; // Parent country
  };
  city: {
    name: string; // 'San Francisco'
    state_code: string; // Parent state
    country_code: string; // Parent country
    lat: number;
    lon: number;
  };
  congressional_district?: {
    code: string; // 'CA-16'
    name: string; // "California's 16th Congressional District"
    city_name?: string; // Optional city association
    state_code: string;
  };
}
```

### 3. Autocomplete Component Architecture

**Component:** `LocationAutocomplete.svelte`

**Desktop behavior:**
```svelte
<div class="relative">
  <!-- Trigger: Pencil icon on hover -->
  <button
    class="group relative inline-flex items-center gap-1.5"
    onmouseenter={() => showEditIcon = true}
    onmouseleave={() => showEditIcon = false}
  >
    <span>{breadcrumbState}</span>
    {#if showEditIcon}
      <svg class="h-3 w-3 text-slate-400 transition-opacity">
        <!-- Pencil icon -->
      </svg>
    {/if}
  </button>

  <!-- Autocomplete dropdown (shown on click) -->
  {#if isOpen}
    <div class="absolute top-full left-0 mt-2 z-50">
      <input
        type="text"
        placeholder="Search locations..."
        bind:value={searchQuery}
        oninput={debounce(handleSearch, 300)}
      />

      <!-- Results -->
      <ul>
        {#each results as result}
          <li onclick={() => handleSelect(result)}>
            {result.display_name}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
```

**Mobile behavior:**
```svelte
<!-- Single pencil at end of breadcrumb -->
<button onclick={() => showLocationModal = true}>
  <svg><!-- Pencil icon --></svg>
</button>

<!-- Full-screen modal with cascading selects -->
<Modal bind:isOpen={showLocationModal}>
  <select bind:value={selectedCountry} onchange={handleCountryChange}>
    <option value="US">United States</option>
    <option value="CA">Canada</option>
    <!-- ... -->
  </select>

  {#if selectedCountry}
    <select bind:value={selectedState} onchange={handleStateChange}>
      {#each states[selectedCountry] as state}
        <option value={state.code}>{state.name}</option>
      {/each}
    </select>
  {/if}

  {#if selectedState}
    <input
      type="text"
      placeholder="Search cities in {selectedState}..."
      bind:value={citySearch}
      oninput={debounce(handleCitySearch, 300)}
    />
    <ul>
      {#each cityResults as city}
        <li onclick={() => handleCitySelect(city)}>
          {city.name}
        </li>
      {/each}
    </ul>
  {/if}
</Modal>
```

### 4. API Integration Layer

**File:** `src/lib/core/location/geocoding-api.ts`

```typescript
/**
 * Nominatim-based location autocomplete
 *
 * Free, open-source, worldwide coverage
 * Rate limit: 1 req/sec (public instance)
 */

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    country: string;
    country_code: string;
    state?: string;
    city?: string;
    town?: string;
    county?: string;
  };
  boundingbox: [string, string, string, string];
}

export async function searchLocations(
  query: string,
  scope: 'country' | 'state' | 'city' = 'city',
  countryCode?: string,
  stateCode?: string
): Promise<LocationHierarchy[]> {
  // Debounced to respect 1 req/sec limit
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '10',
  });

  // Scope filtering
  if (countryCode) {
    params.append('countrycodes', countryCode.toLowerCase());
  }

  if (scope === 'city' && stateCode) {
    // Add state to query for better filtering
    params.set('q', `${query}, ${stateCode}`);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': 'Communique/1.0' // Required by Nominatim usage policy
      }
    }
  );

  const results: NominatimResult[] = await response.json();

  return results.map(r => ({
    country: {
      code: r.address.country_code.toUpperCase(),
      name: r.address.country
    },
    state: r.address.state ? {
      code: getStateCode(r.address.state, r.address.country_code),
      name: r.address.state,
      country_code: r.address.country_code.toUpperCase()
    } : null,
    city: r.address.city || r.address.town ? {
      name: r.address.city || r.address.town,
      state_code: getStateCode(r.address.state, r.address.country_code),
      country_code: r.address.country_code.toUpperCase(),
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    } : null
  }));
}

/**
 * Map state names to ISO codes
 * (Nominatim returns full state names, we need abbreviations)
 */
function getStateCode(stateName: string, countryCode: string): string {
  // US states mapping
  const US_STATES: Record<string, string> = {
    'Alabama': 'AL',
    'Alaska': 'AK',
    'Arizona': 'AZ',
    // ... all 50 states + territories
  };

  // Canadian provinces mapping
  const CA_PROVINCES: Record<string, string> = {
    'Alberta': 'AB',
    'British Columbia': 'BC',
    'Manitoba': 'MB',
    // ... all provinces
  };

  if (countryCode.toUpperCase() === 'US') {
    return US_STATES[stateName] || stateName;
  } else if (countryCode.toUpperCase() === 'CA') {
    return CA_PROVINCES[stateName] || stateName;
  }

  return stateName; // Fallback to full name
}
```

### 5. Interaction Flow

**Desktop - Edit State:**

1. User hovers over "California" breadcrumb
2. Pencil icon fades in (opacity: 0 → 1, 200ms transition)
3. User clicks → autocomplete dropdown opens below breadcrumb
4. User types "Te" → API debounced call (300ms)
5. Results show: "Texas", "Tennessee", "Territory..."
6. User clicks "Texas"
7. Location updates: `inferredLocation.state_code = 'TX'`
8. Templates re-filter to Texas scope
9. Breadcrumb updates: "California" → "Texas"
10. URL updates (optional): `?state=TX` query param

**Mobile - Edit Any Level:**

1. User taps pencil icon at end of breadcrumb
2. Full-screen modal slides up from bottom
3. Cascading selects show: Country → State → City
4. User selects "Country: Canada"
5. State dropdown populates with Canadian provinces
6. User types in city search: "Tor"
7. Results show: "Toronto", "Torbay"
8. User taps "Toronto"
9. Location updates, templates filter, modal closes

### 6. State Management

**File:** `LocationFilter.svelte`

```typescript
// New state for location editing
let isEditingLocation = $state(false);
let editLevel = $state<'country' | 'state' | 'city' | null>(null);
let autocompleteResults = $state<LocationHierarchy[]>([]);
let searchQuery = $state('');

// Handle location change from autocomplete
async function handleLocationChange(
  newLocation: Partial<InferredLocation>,
  level: 'country' | 'state' | 'city'
) {
  // Create new verified signal (confidence = 0.9, not 1.0 - user didn't verify address)
  const signal: LocationSignal = {
    signal_type: 'user_selected',
    confidence: 0.9,
    congressional_district: null, // Will lookup if needed
    state_code: newLocation.state_code || null,
    city_name: newLocation.city_name || null,
    country_code: newLocation.country_code || null,
    county_fips: null,
    latitude: null,
    longitude: null,
    source: `user.breadcrumb_${level}`,
    timestamp: new Date().toISOString(),
    metadata: {
      edit_level: level,
      previous_location: inferredLocation
    }
  };

  // Store signal
  await locationInferenceEngine.addSignal(signal);

  // Re-infer location
  const location = await getUserLocation(true);
  inferredLocation = location;

  // Re-filter templates
  // (handled by $effect watching inferredLocation)

  // Close autocomplete
  isEditingLocation = false;
  editLevel = null;
  searchQuery = '';
}
```

### 7. Performance Considerations

**API rate limiting (Nominatim):**
- Public instance: 1 req/sec
- Debounce user input: 300ms
- Cache results client-side (IndexedDB): 24 hours
- Fallback to static state list if API fails

**Example caching:**
```typescript
// Cache recent autocomplete results
const AUTOCOMPLETE_CACHE_KEY = 'location_autocomplete_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function searchLocationsCached(query: string): Promise<LocationHierarchy[]> {
  const cacheKey = `${AUTOCOMPLETE_CACHE_KEY}:${query}`;
  const cached = await locationStorage.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  const results = await searchLocations(query);
  await locationStorage.set(cacheKey, {
    results,
    timestamp: Date.now()
  });

  return results;
}
```

### 8. Accessibility

**Desktop keyboard navigation:**
- Tab to breadcrumb → Enter to open autocomplete
- Arrow keys to navigate results
- Enter to select, Escape to close
- Focus trap within autocomplete dropdown

**Mobile touch targets:**
- Pencil icon: 44x44px minimum (Apple HIG)
- Autocomplete results: 48dp minimum (Material Design)
- Modal close: Swipe down gesture + X button

**Screen reader support:**
```svelte
<button
  aria-label="Edit location: {breadcrumbState}"
  aria-haspopup="listbox"
  aria-expanded={isEditingLocation}
>
  {breadcrumbState}
</button>

<ul
  role="listbox"
  aria-label="Location search results"
>
  {#each results as result, i}
    <li
      role="option"
      aria-selected={i === selectedIndex}
      tabindex={i === selectedIndex ? 0 : -1}
    >
      {result.display_name}
    </li>
  {/each}
</ul>
```

## Implementation Plan

### Phase 1: Desktop Hover-to-Edit (1 week)

**Files to create:**
- `src/lib/components/landing/template/LocationAutocomplete.svelte`
- `src/lib/core/location/geocoding-api.ts`
- `src/lib/core/location/autocomplete-cache.ts`

**Files to modify:**
- `src/lib/components/landing/template/LocationFilter.svelte` (add edit mode)

**Tasks:**
1. Integrate Nominatim API (2 days)
2. Build autocomplete component (2 days)
3. Add hover → pencil → dropdown interaction (1 day)
4. Client-side caching for performance (1 day)
5. Testing + refinement (1 day)

### Phase 2: Mobile Modal Edit (3 days)

**Files to create:**
- `src/lib/components/landing/template/LocationEditModal.svelte`

**Tasks:**
1. Build cascading country → state → city modal (1 day)
2. Mobile-optimized autocomplete (1 day)
3. Touch gesture refinement (1 day)

### Phase 3: Congressional District Lookup (2 days)

**Integration needed:**
- If user selects city without district, auto-lookup via Census API
- Update `handleLocationChange()` to call `/api/location/geocode` for district

## Open Questions

1. **URL persistence:** Should location changes update URL query params?
   - Pro: Shareable filtered views ("Show me Texas templates")
   - Con: May confuse users who think it's their actual location
   - **Decision:** Yes, but with `?filter=TX` (not `?state=TX`) to clarify it's a filter

2. **Ephemeral vs. persistent:** Should breadcrumb edits persist to IndexedDB?
   - Pro: User intent to explore other locations
   - Con: May override their actual inferred location
   - **Decision:** Ephemeral by default, with "Save as preferred location" checkbox

3. **Congressional district auto-lookup:** Should we auto-lookup district when user selects city?
   - Pro: Unlocks district templates immediately
   - Con: Extra API call, may be slow
   - **Decision:** Yes, but asynchronous (show city templates immediately, district templates load in background)

## Success Metrics

**Engagement:**
- 30% of users interact with breadcrumb edit within first session
- 15% of users explore templates in ≥2 different locations

**Performance:**
- Autocomplete latency <500ms (p95)
- Nominatim API success rate >95%
- Cache hit rate >60% for repeat queries

**UX Quality:**
- <5% users report location confusion
- Zero accessibility violations (axe-core audit)

## Risk Mitigation

**Nominatim rate limiting:**
- Self-host Nominatim if public instance proves unreliable
- Docker compose: `overpass/nominatim:latest`
- Estimated cost: $10/month for small Digital Ocean droplet

**API downtime:**
- Fallback to static state/province lists (no autocomplete)
- Cache aggressively to reduce API dependency
- Error UI: "Location search unavailable - try again later"

**User confusion (location vs. filter):**
- Clear visual distinction: "Filtering by: Texas" label
- Undo button: "Return to my location"
- Tooltip: "Exploring templates in Texas. Click to return to your location."

## References

- Nominatim API docs: https://nominatim.org/release-docs/latest/api/Overview/
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- GeoNames API docs: http://www.geonames.org/export/web-services.html
- Census Geocoding API: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
