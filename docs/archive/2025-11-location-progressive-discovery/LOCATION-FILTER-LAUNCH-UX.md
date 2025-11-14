# Location Filter Launch UX: Privacy-First Progressive Discovery

**Status**: SPECIFICATION (Phase 1 Launch)
**Created**: 2025-01-12
**Replaces**: Progressive location discovery patterns with seeded-template reality

---

## Core Problem

**Brutalist critique validity**: Progressive discovery without network density = trust destruction

**Privacy architecture advantage**: Client-side filtering + encrypted storage = no surveillance

**Launch reality**: Seeded templates exist, coordination counts don't

**Solution**: Show content density, defer social proof, make privacy visible

---

## Design Philosophy

### 1. Honest Value Exchange

**What users GET from location precision:**
- More relevant template sorting (state → city → district)
- Better geographic matching (templates scoped to their area)
- Future coordination visibility (when network forms)

**What users DON'T get (at launch):**
- ❌ Hyperlocal social proof ("3 neighbors on your block")
- ❌ Neighborhood coordination counts (network too sparse)
- ❌ Unlocking hidden templates (all templates visible)

**The honesty requirement:**
- Show template DENSITY ("12 templates in San Francisco")
- Defer coordination COUNTS until real (>50 per template minimum)
- CTA communicates content precision, not social discovery

### 2. Privacy-First as Differentiator

**Architectural reality:**
```
Client-side:
- IP → State inference (MaxMind, in-browser)
- GPS → City/County (Nominatim, in-browser)
- Address → District (Census API, encrypted before storage)
- Template filtering (scored in IndexedDB, never server)

Server-side:
- Receives encrypted address blobs (XChaCha20-Poly1305)
- Cannot decrypt (no key access)
- Serves all templates (no location tracking)
```

**Make this VISIBLE:**
- Privacy badge in location header (not buried in popover)
- Clear copy: "Templates filtered in your browser"
- Info icon: Full crypto explanation for those who care

### 3. Progressive Sections Based on Content Availability

**Section visibility rules:**
```typescript
// Show section ONLY IF templates exist at that level
if (templatesAtLevel.length > 0) {
  showSection({
    title: "In San Francisco",
    count: templatesAtLevel.length,  // Content count
    metric: "templates"              // NOT "coordinating"
  });
}
```

**Empty states:**
- ❌ Never show "0 coordinating" (trust killer)
- ❌ Never show empty sections (ghost town exposure)
- ✅ Hide sections until content exists
- ✅ Show template count when available

### 4. Voice Compliance

**From voice.md:**
- ✅ Imperative voice ("See city templates" not "You can see")
- ✅ Direct statements ("12 templates in SF" not "We think there are...")
- ✅ No pre-defending ("Private filtering" without explaining what we're not)
- ✅ Technical details in popovers (progressive disclosure)
- ✅ Geographic scope clear ("San Francisco" not "your area")

**Copy patterns:**
```
Primary: Location + content count
  "San Francisco • 12 templates"

CTA: Benefit + precision level
  "See city templates →"  (when at state)
  "See district templates →"  (when at city)

Correction: Question format
  "Not from California?"
```

---

## Technical Implementation

### Component: LocationFilter.svelte

**State management:**
```typescript
// Current precision tier
let currentPrecision: 'none' | 'state' | 'city' | 'district';

// Template counts per tier (from scoring)
let templateCounts = $derived({
  district: districtTemplates.length,
  city: cityTemplates.length,
  state: stateTemplates.length,
  nationwide: nationwideTemplates.length
});

// Next precision unlock
let nextPrecision = $derived(
  !currentPrecision ? 'state' :
  currentPrecision === 'state' ? 'city' :
  currentPrecision === 'city' ? 'district' : null
);
```

**Section rendering logic:**
```typescript
function createTemplateGroups(): TemplateGroup[] {
  const groups: TemplateGroup[] = [];

  // RULE: Only show section if templates exist
  if (hasDistrict && districtTemplates.length > 0) {
    groups.push({
      title: 'In Your District',
      templates: districtTemplates,
      // CHANGE: Show template count, not coordination
      templateCount: districtTemplates.length,
      coordinationCount: 0,  // Hidden until real
      showCoordination: false
    });
  }

  if (hasCity && cityTemplates.length > 0) {
    const cityName = inferredLocation.city_name;
    groups.push({
      title: cityName ? `In ${toTitleCase(cityName)}` : 'In Your Area',
      templates: cityTemplates,
      templateCount: cityTemplates.length,
      coordinationCount: 0,
      showCoordination: false
    });
  }

  // ... state, nationwide same pattern

  return groups;
}
```

**CTA logic:**
```typescript
// Determine what next precision unlocks
const nextUnlock = $derived.by(() => {
  if (!inferredLocation) {
    return { level: 'state', count: stateTemplates.length };
  }

  if (!inferredLocation.city_name) {
    return { level: 'city', count: cityTemplates.length };
  }

  if (!inferredLocation.congressional_district) {
    return { level: 'district', count: districtTemplates.length };
  }

  return null; // Max precision reached
});
```

### Component: TemplateList.svelte

**Section headers:**
```svelte
<div class="space-y-6">
  {#each groups as group}
    <section>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {group.title}
        </h3>

        <!-- CHANGE: Show template count, not coordination -->
        <span class="text-xs text-slate-500">
          {group.templateCount} {group.templateCount === 1 ? 'template' : 'templates'}
        </span>
      </div>

      <!-- Template cards -->
      {#each group.templates as template}
        <TemplateCard {template} />
      {/each}
    </section>
  {/each}
</div>
```

### Privacy Badge Component

**New: PrivacyBadge.svelte**
```svelte
<script lang="ts">
  let showDetails = $state(false);
</script>

<div class="flex items-center gap-2 text-xs text-slate-600">
  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
    <!-- Lock icon -->
  </svg>
  <span>Private filtering</span>
  <button
    onclick={() => showDetails = !showDetails}
    class="text-slate-400 hover:text-slate-600"
  >
    <InfoIcon />
  </button>

  {#if showDetails}
    <Popover>
      <p class="text-xs">
        Templates filtered in your browser. Your address is encrypted
        before storage—we can't read it.
      </p>
      <a href="/docs/privacy" class="text-blue-600 hover:underline">
        How it works →
      </a>
    </Popover>
  {/if}
</div>
```

---

## Copy Specifications

### Location Header

**Pattern:**
```
[Icon] {LocationName}
       {DistrictLabel if available}
       {PrivacyBadge}
```

**Examples:**
```svelte
<!-- State only (IP) -->
📍 California
   Private filtering

<!-- City (GPS) -->
📍 San Francisco
   Private filtering

<!-- District (Address) -->
📍 San Francisco
   California's 11th Congressional District
   Private filtering
```

### CTA Buttons

**Correction affordance:**
```svelte
<button class="text-slate-600 underline decoration-dotted">
  Not from {locationLabel}?
</button>
```

**Progressive precision CTA:**
```svelte
<button class="text-blue-600 font-medium">
  {#if nextUnlock}
    See {nextUnlock.level} templates →
  {:else}
    Change location
  {/if}
</button>
```

**Full pattern:**
```svelte
Not from California?  ·  See city templates →
Not from San Francisco?  ·  See district templates →
```

### Section Headers

**Pattern:**
```
{GeographicLevel}
{TemplateCount} templates
```

**Examples:**
```
In Your District
8 templates

In San Francisco
12 templates

In California
23 templates

Nationwide
47 templates
```

### Empty State (No Location)

**Pattern:**
```svelte
<div class="rounded-xl bg-white p-4 shadow-sm">
  <h4 class="text-sm font-semibold text-slate-900">
    Find templates near you
  </h4>
  <p class="text-xs text-slate-600">
    Set location for better matching
  </p>
  <button>Set location</button>
</div>
```

**No promise about "coordination" or "neighbors"—just better matching.**

---

## Implementation Checklist

### Phase 1: Core UX Fixes
- [ ] Update `createTemplateGroups()` to use `templateCount` instead of `coordinationCount`
- [ ] Hide sections when `templates.length === 0`
- [ ] Change section headers to show template count
- [ ] Update CTA to "See {level} templates →"
- [ ] Add privacy badge to location header

### Phase 2: Privacy Visibility
- [ ] Create `PrivacyBadge.svelte` component
- [ ] Add to location header (visible, not buried)
- [ ] Popover with full crypto explanation
- [ ] Link to privacy documentation

### Phase 3: Section Logic
- [ ] Section visibility based on content existence
- [ ] Progressive unlock messaging (template counts)
- [ ] Empty state refinement (no location detected)

### Phase 4: Copy Audit
- [ ] All CTAs use imperative voice
- [ ] All headers show template counts (not coordination)
- [ ] All copy avoids "campaigns", "issues", "activity"
- [ ] Geographic scope clear (city names, not "your area")

### Phase 5: Coordination Count Deferral
- [ ] Add feature flag: `SHOW_COORDINATION_COUNTS`
- [ ] Threshold check: Only show if `send_count > 50`
- [ ] Fallback to template count when below threshold
- [ ] Future: Enable when network dense enough

---

## Success Metrics

### Launch (Week 1-4)
- Template view rate: >60% (users browse templates)
- Address entry rate: >15% (precision upgrade)
- Bounce after address: <30% (content exists at new level)
- Return rate: >40% (trust maintained)

### Growth (Week 5-12)
- Template density: 50+ templates per major city
- Address precision: 25%+ users at district level
- Network formation: First coordination counts appear
- Enable `SHOW_COORDINATION_COUNTS` when threshold met

---

## Voice Compliance Checklist

From `voice.md`:

**Primary UI:**
- [x] No corporate buzzwords (campaigns → templates)
- [x] No hedging language (removed)
- [x] No marketing superlatives (removed)
- [x] No passive voice (imperative CTAs)
- [x] No emotional manipulation (honest benefits)
- [x] No over-explaining (privacy in popover)
- [x] No pre-defending (privacy badge is confident)
- [x] Imperative voice ("See city templates")
- [x] Geographic scope clear ("San Francisco")

**Popovers/Tooltips:**
- [x] Technical mechanism explained concisely
- [x] Trade-offs acknowledged (IP vs GPS vs Address precision)
- [x] No marketing fluff (just crypto facts)
- [x] Maximum 2 sentences primary + link

---

## Bottom Line

**Before:**
- Progressive discovery promised neighbors that don't exist
- Coordination counts showed zeros (trust destroyer)
- Privacy architecture hidden (differentiator invisible)
- CTA unclear about value ("Enter address" why?)

**After:**
- Progressive discovery shows template density (real content)
- Template counts visible, coordination deferred (honest)
- Privacy badge front and center (competitive advantage)
- CTA clear about benefit ("See city templates")

**Core principle:** Show what exists, defer what doesn't, make privacy obvious.
