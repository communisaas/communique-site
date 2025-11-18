# Location Filtering Patterns

**UX patterns for location-based template filtering and data inference**

---

## Core Principle: Location as Filter, Not Category

**Location names stand alone. No prefixes. No category labels.**

### ✅ CORRECT

```
Texas
47 coordinating
```

### ❌ WRONG

```
Campaigns in Texas
Issues in Texas
Bills in Texas
```

---

## Why This Matters

### Category Words Carry Baggage

**"Campaigns"**: Politically loaded, implies fundraising/elections
**"Issues"**: Heavy problem-focused, negative framing
**"Bills"**: Only works for Congress, too narrow

### Templates Speak for Themselves

Template titles already say what they are:
- "Tell Spotify: Fair artist pay"
- "Austin City Council: Affordable housing"
- "Rep. McCaul: Vote yes on H.R. 1234"

**No category label needed.**

### Location = Filter, Not Container

**Bad**: "Issues IN Texas" (location contains issues)
**Good**: "Texas [filter applied]" (location is a lens)

### Coordination Count = Signal

```
Texas
47 coordinating
```

The number shows activity. The location shows scope. That's it.

---

## Inferrable Defaults with Explicit Overrides

### The Pattern

**Principle**: When data can be **deterministically inferred** from available context, treat inference as truth until explicitly overridden.

```typescript
const derivedValue = $derived.by(() => {
    // Strategy 1: Explicit value (highest confidence - from source metadata)
    if (data?.explicitField) {
        return transformExplicit(data.explicitField);
    }

    // Strategy 2: Inferred value (deterministic - 1:1 mapping from related field)
    if (data?.relatedField) {
        const inferred = inferFromRelated(data.relatedField);
        if (inferred) return inferred;
    }

    // Strategy 3: No value determinable
    return null;
});
```

### Key Characteristics

1. **Deterministic inference only** - 1:1 mapping, not probabilistic
2. **Progressive enhancement** - Explicit data overrides inference
3. **Graceful degradation** - Works with partial data
4. **Layout stability** - Derived value present whenever ANY source can provide it

### Implementation: Country from State Code

State codes have **unambiguous country mapping**:
- `CA` (California) → ONLY United States
- `AB` (Alberta) → ONLY Canada
- `NSW` (New South Wales) → ONLY Australia

```typescript
const breadcrumbCountry = $derived.by(() => {
    const countryNames: Record<string, string> = {
        US: 'United States',
        CA: 'Canada',
        GB: 'United Kingdom',
        AU: 'Australia',
        NZ: 'New Zealand',
        IE: 'Ireland'
    };

    // Strategy 1: Explicit country code (from signal metadata)
    if (inferredLocation?.country_code) {
        return countryNames[inferredLocation.country_code] || inferredLocation.country_code;
    }

    // Strategy 2: Inferred country from state code (deterministic)
    if (inferredLocation?.state_code) {
        const stateCode = inferredLocation.state_code;

        // US states and territories
        const usStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
            'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
            'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
            'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR', 'GU', 'VI', 'AS', 'MP'
        ];
        if (usStates.includes(stateCode)) return 'United States';

        // Canadian provinces and territories
        const caProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NT', 'NS', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
        if (caProvinces.includes(stateCode)) return 'Canada';

        // Australian states and territories
        const auStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
        if (auStates.includes(stateCode)) return 'Australia';
    }

    return null;
});
```

### Before/After Behavior

**Before** (explicit-only):
- IP signal with `country_code: 'US'`: "United States > California"
- GPS signal without `country_code`: "California" (no country)
- **Inconsistent layout based on signal source**

**After** (inferrable defaults):
- IP signal with `country_code: 'US'`: "United States > California" (explicit)
- GPS signal with `state_code: 'CA'`: "United States > California" (inferred)
- **Consistent layout regardless of signal source**

### When NOT to Use

**Do NOT use for probabilistic inference:**

❌ **City from IP** - IP → City is probabilistic (30-50% accuracy)
❌ **Income from ZIP** - Demographics are statistical, not individual truth

✅ **Only use for 1:1 mappings where inference is guaranteed correct**

---

## Implementation Patterns

### Header Component

```svelte
<header>
  <h1 class="text-3xl font-bold">
    {#if district}
      {district}
    {:else if county}
      {county}
    {:else if state}
      {state}
    {:else}
      Nationwide
    {/if}
  </h1>

  <p class="text-sm text-slate-600">
    {coordinationCount} coordinating
  </p>
</header>
```

**NO "in". NO "campaigns". NO "issues".**

Just the place. Just the count.

### Progressive Refinement Affordances

```svelte
{#if !county && state}
  <button>
    See what's happening in your county →
  </button>
{:else if !district && county}
  <button>
    Find who represents you →
  </button>
{/if}
```

**Affordances can use descriptive language.**
**Headers stay minimal** (location name only).

---

## Progressive Precision Funnel

**Location isn't just a filter—it's a funnel.**

Each refinement step reveals MORE RELEVANT templates, creating natural incentive to share location.

### The 3-Step Funnel

**STEP 1: IP → State** ("California" + 47 coordinating)
- Show: Federal + State templates
- Affordance: "Find who represents you →"
- User sees statewide advocacy, wants county-level

**STEP 2: GPS → County** ("San Francisco County" + 12 coordinating)
- Show: Federal + State + County templates
- Affordance: "Find who represents you →"
- User sees county advocacy, wants district-specific

**STEP 3: Address → District** ("California's 16th Congressional District" + 8 coordinating)
- Show: ALL templates (Federal + State + County + District)
- Affordance: Filter toggle ("See 8 coordinating")
- User sees neighborhood coordination: "You + 8 others"

### Why This Works

**Progressive disclosure creates pull:**
- State templates → "What's happening in my county?"
- County templates → "What's happening in my district?"
- District templates → "Who's coordinating near me?"

**Each step is an upgrade:**
- More precise location = More relevant templates
- More relevant templates = Higher engagement
- Higher engagement = More coordination

**Natural funnel, not forced:**
- IP detection is automatic (89% accurate state)
- GPS is optional but valuable (95% accurate county)
- Address is highest value (100% accurate district)

---

## Voice Guidance

### When Writing Headers

**ASK**: "Does this need a category label?"
**ANSWER**: No. Location name only.

**ASK**: "Should I say 'Issues in California'?"
**ANSWER**: No. Just "California".

**ASK**: "What about explaining what the page shows?"
**ANSWER**: Coordination count does that. "47 coordinating" tells you there's activity.

### When Writing Template Cards

**EXAMPLE**:
```
Tell Spotify: Fair artist pay
1,247 sent this
Active in 12 states

[Send Now] [Share]
```

No category label needed. Title says what it is.

### When Writing Empty States

**WRONG**:
```
No campaigns in TX-25 yet
```

**CORRECT**:
```
Nothing coordinating in TX-25 yet
Create the first template for your district
```

Focus on **coordination** (the action), not categories.

---

## Testing Requirements

When implementing location filtering patterns, verify:

1. **Layout stability**: Component renders same structure with explicit vs. inferred data
2. **Visual parity**: Inferred data shown with same styling as explicit data
3. **Override behavior**: Explicit data overrides inference when both present
4. **Graceful degradation**: Component handles missing inference source gracefully

### Test Cases

```typescript
describe('breadcrumbCountry with inferrable defaults', () => {
    it('shows explicit country when available', () => {
        const location = { country_code: 'US', state_code: 'CA' };
        expect(breadcrumbCountry(location)).toBe('United States');
    });

    it('infers country from US state code when country missing', () => {
        const location = { state_code: 'CA' };
        expect(breadcrumbCountry(location)).toBe('United States');
    });

    it('returns null when neither country nor state available', () => {
        const location = {};
        expect(breadcrumbCountry(location)).toBeNull();
    });

    it('explicit country overrides inference from state', () => {
        const location = { country_code: 'CA', state_code: 'TX' };
        expect(breadcrumbCountry(location)).toBe('Canada');
    });
});
```

---

## Examples Across Levels

### State-Level (IP)

```
Texas
47 coordinating

Templates:
- Austin City Council: Affordable housing (12 sent this)
- Texas school board: Ban book bans (23 sent this)
- Tell Amazon: Stop union busting (5,247 sent this)
```

### County-Level (GPS)

```
Travis County
12 coordinating

Templates:
- Travis County Sheriff: End ICE cooperation (8 sent this)
- Austin City Council: Affordable housing (12 sent this)
- Round Rock ISD: Teacher pay raise (4 sent this)
```

### District-Level (Address)

```
TX-25
You + 8 others

Templates:
- Rep. McCaul: Vote yes on H.R. 1234 (9 sent this)
- Cedar Park HOA: Stop excessive fines (3 sent this)
- Round Rock ISD: Teacher pay raise (4 sent this)
```

**No "in". No "campaigns". No "issues".**

**Just place, count, action.**

---

## Bottom Line

**If you're about to write "campaigns in" or "issues in", STOP.**

**Just use the location name.**

This isn't about being terse. It's about:
- Avoiding politically loaded language
- Letting templates speak for themselves
- Making location a filter, not a container
- Keeping coordination (the count) as the primary signal
- Creating a progressive funnel where precision = value

**Minimal ≠ Unclear**

"Texas" + "47 coordinating" + template list = crystal clear.

**No category labels needed. Ever.**

---

*Pattern established: 2025-11-10 | Consolidated: 2025-11-18*
