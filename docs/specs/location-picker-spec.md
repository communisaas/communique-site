# Location Picker: Perceptual Engineering Specification

**Status**: In Progress
**Author**: Distinguished Engineering
**Date**: 2026-01-28

---

## Executive Summary

Replace ISO code entry with natural language location search. Users think in places; system stores codes. The abstraction bridges human cognition to structured data.

---

## 1. Perceptual Engineering Principles

### 1.1 Core Tension
- **User mental model**: "San Francisco, California" — a place with meaning
- **System requirement**: `{ country: 'US', subdivision: 'US-CA', locality: 'San Francisco' }` — structured codes

### 1.2 Design Invariants

| Principle | Application |
|-----------|-------------|
| **Recognition over recall** | Autocomplete suggestions, never raw code entry |
| **Progressive disclosure** | Scope type inferred from selection depth |
| **Preserve the original** | Store `displayName` alongside codes |
| **Single input, rich output** | One search resolves all hierarchy levels |
| **Immediate feedback** | Selection instantly shows what will be stored |

### 1.3 Cognitive Load Analysis

**Current UX** (high cognitive load):
```
[Dropdown: Scope type    ] → User must understand "subnational"
[Input: Country code: US ] → User must know ISO 3166-1
[Input: Subdivision: US-CA] → User must know ISO 3166-2 format
[Input: City name        ] → Finally something human
```

**Target UX** (minimal cognitive load):
```
[Search: "san fran..."]
  → San Francisco, California, United States
  → San Francisco del Rincón, Guanajuato, Mexico
  → San Francisco de Macorís, Dominican Republic
```

Selection resolves everything. No codes visible. Structure inferred.

---

## 2. Technical Architecture

### 2.1 Extended GeoScope Type

```typescript
// src/lib/core/agents/types.ts

export type GeoScope =
  | { type: 'international' }
  | { type: 'nationwide'; country: string; displayName?: string }
  | {
      type: 'subnational';
      country: string;
      subdivision?: string;
      locality?: string;
      displayName?: string;  // ← NEW: preserves human-readable text
    };
```

**Rationale**: `displayName` prevents lossy reconstruction. "San Francisco, CA" stored verbatim, never derived from codes.

### 2.2 Location Resolver Utility

```typescript
// src/lib/core/location/location-resolver.ts

import type { LocationHierarchy } from './geocoding-api';
import type { GeoScope } from '../agents/types';

/**
 * Convert Nominatim result to GeoScope with display preservation
 *
 * The resolver infers scope type from hierarchy depth:
 * - Country only → nationwide
 * - Country + state → subnational (state-level)
 * - Country + state + city → subnational (city-level)
 */
export function resolveToGeoScope(location: LocationHierarchy): GeoScope {
  const { country, state, city, display_name } = location;

  // City-level (most specific)
  if (city) {
    return {
      type: 'subnational',
      country: country.code,
      subdivision: state ? `${country.code}-${state.code}` : undefined,
      locality: city.name,
      displayName: formatDisplayName(location)
    };
  }

  // State-level
  if (state) {
    return {
      type: 'subnational',
      country: country.code,
      subdivision: `${country.code}-${state.code}`,
      displayName: formatDisplayName(location)
    };
  }

  // Country-level
  return {
    type: 'nationwide',
    country: country.code,
    displayName: country.name
  };
}

/**
 * Format hierarchy into clean display string
 * Nominatim returns verbose: "San Francisco, San Francisco County, California, United States"
 * We want concise: "San Francisco, California, United States"
 */
function formatDisplayName(location: LocationHierarchy): string {
  const parts: string[] = [];

  if (location.city) parts.push(location.city.name);
  if (location.state) parts.push(location.state.name);
  if (location.country) parts.push(location.country.name);

  return parts.join(', ');
}

/**
 * Display a GeoScope as human-readable text
 * Uses displayName if available, otherwise reconstructs from codes
 */
export function displayGeoScope(scope: GeoScope): string {
  if (scope.type === 'international') return 'Worldwide';

  // Prefer stored display name
  if ('displayName' in scope && scope.displayName) {
    return scope.displayName;
  }

  // Fallback: reconstruct from codes (lossy but functional)
  if (scope.type === 'nationwide') {
    return countryCodeToName(scope.country) || scope.country;
  }

  // Subnational fallback
  const parts: string[] = [];
  if (scope.locality) parts.push(scope.locality);
  if (scope.subdivision) {
    // Extract state from "US-CA" → "CA" → "California"
    const stateCode = scope.subdivision.split('-')[1];
    parts.push(stateCodeToName(stateCode, scope.country) || stateCode);
  }
  parts.push(countryCodeToName(scope.country) || scope.country);

  return parts.join(', ');
}
```

### 2.3 LocationPicker Component

```svelte
<!-- src/lib/components/ui/LocationPicker.svelte -->

<script lang="ts">
  import { searchLocations, type LocationHierarchy } from '$lib/core/location/geocoding-api';
  import { resolveToGeoScope, displayGeoScope } from '$lib/core/location/location-resolver';
  import type { GeoScope } from '$lib/core/agents/types';
  import { MapPin, X, Globe, Search } from '@lucide/svelte';

  interface Props {
    value: GeoScope | null;
    onSelect: (scope: GeoScope) => void;
    placeholder?: string;
  }

  let { value, onSelect, placeholder = "Search for a location..." }: Props = $props();

  let query = $state('');
  let results = $state<LocationHierarchy[]>([]);
  let isSearching = $state(false);
  let isFocused = $state(false);
  let debounceTimer: number;

  // Debounced search (300ms)
  function handleInput() {
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      results = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      isSearching = true;
      results = await searchLocations(query);
      isSearching = false;
    }, 300);
  }

  function handleSelect(location: LocationHierarchy) {
    const scope = resolveToGeoScope(location);
    onSelect(scope);
    query = '';
    results = [];
    isFocused = false;
  }

  function handleClear() {
    onSelect({ type: 'international' });
  }

  function handleWorldwide() {
    onSelect({ type: 'international' });
    query = '';
    results = [];
    isFocused = false;
  }
</script>
```

**Component behavior:**
- Debounced search (300ms) to avoid API spam
- Results dropdown with hierarchy display
- Selection triggers `onSelect` with resolved GeoScope
- "Worldwide" option always available
- Clear button to reset

### 2.4 Refactored GeographicScopeEditor

Replace current code-input form with LocationPicker:

```svelte
<!-- src/lib/components/template/creator/GeographicScopeEditor.svelte -->

<script lang="ts">
  import type { GeoScope } from '$lib/core/agents/types';
  import { displayGeoScope } from '$lib/core/location/location-resolver';
  import LocationPicker from '$lib/components/ui/LocationPicker.svelte';
  import { ChevronDown } from '@lucide/svelte';

  interface Props {
    scope: GeoScope | null;
    onScopeChanged?: (scope: GeoScope) => void;
  }

  let { scope, onScopeChanged }: Props = $props();
  let isEditing = $state(false);

  function handleSelect(newScope: GeoScope) {
    onScopeChanged?.(newScope);
    isEditing = false;
  }
</script>

{#if scope}
  <div class="inline-flex items-baseline gap-1">
    <span class="text-slate-600">in</span>

    {#if !isEditing}
      <span class="font-medium text-slate-900">{displayGeoScope(scope)}</span>
      <button onclick={() => isEditing = true} class="...">
        <span class="underline decoration-dotted">Edit</span>
        <ChevronDown class="h-3 w-3" />
      </button>
    {:else}
      <LocationPicker
        value={scope}
        onSelect={handleSelect}
        placeholder="Search location..."
      />
      <button onclick={() => isEditing = false}>Cancel</button>
    {/if}
  </div>
{/if}
```

---

## 3. Data Flow

```
User types "san fran"
        ↓
LocationPicker (debounce 300ms)
        ↓
searchLocations() → Nominatim API
        ↓
LocationHierarchy[] (structured results)
        ↓
User selects "San Francisco, California, United States"
        ↓
resolveToGeoScope() → GeoScope with displayName
        ↓
{
  type: 'subnational',
  country: 'US',
  subdivision: 'US-CA',
  locality: 'San Francisco',
  displayName: 'San Francisco, California, United States'
}
        ↓
onScopeChanged() → formData.content.geographicScope
        ↓
Template save → TemplateScope record in database
```

---

## 4. Implementation Tasks

### Task 1: Extend GeoScope Type
- [ ] Add `displayName?: string` to nationwide and subnational variants
- [ ] Update Zod schema in message-writer.ts to accept displayName
- [ ] Ensure backward compatibility (displayName optional)

**Assigned to**: Agent 1 (Type System)
**Status**: Pending

### Task 2: Create Location Resolver Utility
- [ ] Implement `resolveToGeoScope()`
- [ ] Implement `displayGeoScope()`
- [ ] Add country/state code-to-name mappings
- [ ] Export from location module index

**Assigned to**: Agent 2 (Core Utilities)
**Status**: Pending

### Task 3: Build LocationPicker Component
- [ ] Debounced search input
- [ ] Results dropdown with hierarchy display
- [ ] Keyboard navigation (up/down/enter/escape)
- [ ] Loading state indicator
- [ ] "Worldwide" option
- [ ] Proper focus management

**Assigned to**: Agent 3 (UI Component)
**Status**: Pending

### Task 4: Refactor GeographicScopeEditor
- [ ] Replace code inputs with LocationPicker
- [ ] Use displayGeoScope for read-only display
- [ ] Preserve inline edit toggle behavior
- [ ] Test with existing message flow

**Assigned to**: Agent 4 (Integration)
**Status**: Pending

---

## 5. Edge Cases

| Scenario | Handling |
|----------|----------|
| No results found | Show "No locations found. Try a different search." |
| API rate limit | Graceful degradation, show cached results if available |
| Ambiguous location | Show all results, let user choose |
| International selection | Special "Worldwide" option at top of dropdown |
| Existing scope without displayName | Use `displayGeoScope()` fallback reconstruction |

---

## 6. Success Criteria

1. **Zero ISO codes visible** to users at any point
2. **< 500ms** perceived latency for search (debounce + API)
3. **Full hierarchy resolution** from single input
4. **Backward compatible** with existing GeoScope data
5. **Accessible** keyboard navigation throughout

---

## 7. Review Checklist

- [ ] Types compile without errors
- [ ] Resolver correctly infers scope type from hierarchy depth
- [ ] LocationPicker handles all edge cases
- [ ] GeographicScopeEditor works in message results flow
- [ ] Existing templates with old GeoScope format still display correctly
- [ ] Nominatim rate limiting respected (1 req/sec)

---

## Appendix: Completion Tracking

| Task | Agent | Started | Completed | Notes |
|------|-------|---------|-----------|-------|
| Extend GeoScope Type | Agent 1 | 2026-01-28 | 2026-01-28 | Added `displayName?: string` to nationwide/subnational |
| Location Resolver | Agent 1 | 2026-01-28 | 2026-01-28 | Created `location-resolver.ts` with full code-to-name mappings |
| LocationPicker | Agent 2 | 2026-01-28 | 2026-01-28 | Fixed Svelte 5 directive issue on components |
| GeographicScopeEditor Refactor | Agent 3 | 2026-01-28 | 2026-01-28 | Reduced from 148 to ~55 lines |

---

## Implementation Summary

### Files Created
- `src/lib/core/location/location-resolver.ts` - Resolver utility with code-to-name mappings
- `src/lib/components/ui/LocationPicker.svelte` - Autocomplete component

### Files Modified
- `src/lib/core/agents/types.ts` - Extended GeoScope with displayName
- `src/lib/core/agents/agents/message-writer.ts` - Updated Zod schema
- `src/lib/core/location/index.ts` - Exported resolver functions
- `src/lib/components/template/creator/GeographicScopeEditor.svelte` - Refactored to use LocationPicker

### Build Status
- **Build**: PASSING (32.63s)
- **All tasks**: COMPLETE

---

*Implementation complete. Ready for QA testing.*
