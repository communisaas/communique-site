# Inferrable Defaults with Explicit Overrides Pattern

**Status**: Implemented (Country from State Code)
**Author**: Design pattern extracted from location breadcrumb inconsistency fix
**Date**: 2025-01-13

## Problem Statement

UI components often receive partial data from multiple sources with varying quality. Displaying only explicitly-provided fields creates inconsistent layouts and breaks user trust when the same view shows different structure based on metadata completeness rather than actual information availability.

## Example: Country Breadcrumb Inconsistency

**Observed behavior**:
- User with IP-based location: `United States > California` (country from IP metadata)
- User with GPS-based location: `California` (no country in GPS signal)
- **Same actual location, different UI structure**

**Why this breaks UX**:
- Layout instability (breadcrumb structure shifts)
- Cognitive load (users learn inconsistent navigation patterns)
- False signal of data quality (GPS is more accurate than IP, but shows "less" information)

## The Pattern: Inferrable Defaults with Explicit Overrides

**Principle**: When data can be **deterministically inferred** from available context, treat inference as truth until explicitly overridden.

### Pattern Structure

```typescript
const derivedValue = $derived.by(() => {
    // Strategy 1: Explicit value (highest confidence - from source metadata)
    if (data?.explicitField) {
        return transformExplicit(data.explicitField);
    }

    // Strategy 2: Inferred value (deterministic - 1:1 mapping from related field)
    if (data?.relatedField) {
        const inferred = inferFromRelated(data.relatedField);
        if (inferred) {
            return inferred;
        }
    }

    // Strategy 3: No value determinable
    return null;
});
```

### Key Characteristics

1. **Deterministic inference only** - Inference must have 1:1 mapping, not probabilistic
2. **Progressive enhancement** - Explicit data overrides inference when available
3. **Graceful degradation** - Works with partial data (related field but not explicit field)
4. **Layout stability** - Derived value present whenever ANY source can provide it
5. **Honest UI** - Inferred data shown with same visual weight as explicit data

## Implementation: Country from State Code

### Data Model

State codes have **unambiguous country mapping**:
- `CA` (California) → ONLY United States (never Canada's CA province code)
- `AB` (Alberta) → ONLY Canada
- `NSW` (New South Wales) → ONLY Australia

This 1:1 mapping makes inference **deterministic**, not probabilistic.

### Code Implementation

**File**: `src/lib/components/landing/template/LocationFilter.svelte`
**Lines**: 86-133

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

    // Strategy 1: Explicit country code (highest confidence - from signal metadata)
    if (inferredLocation?.country_code) {
        return countryNames[inferredLocation.country_code] || inferredLocation.country_code;
    }

    // Strategy 2: Inferred country from state code (deterministic - state codes are unambiguous)
    if (inferredLocation?.state_code) {
        const stateCode = inferredLocation.state_code;

        // US states and territories (unambiguous mapping)
        const usStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
            'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
            'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
            'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR', 'GU', 'VI', 'AS', 'MP'
        ];
        if (usStates.includes(stateCode)) {
            return 'United States';
        }

        // Canadian provinces and territories (unambiguous mapping)
        const caProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NT', 'NS', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
        if (caProvinces.includes(stateCode)) {
            return 'Canada';
        }

        // Australian states and territories (unambiguous mapping)
        const auStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
        if (auStates.includes(stateCode)) {
            return 'Australia';
        }
    }

    // No country determinable (no explicit country_code, no inferrable state)
    return null;
});
```

### Before/After Behavior

**Before** (explicit-only):
- IP signal with `country_code: 'US'`: Shows "United States > California"
- GPS signal without `country_code`: Shows "California" (no country)
- **Inconsistent layout based on signal source**

**After** (inferrable defaults):
- IP signal with `country_code: 'US'`: Shows "United States > California" (explicit)
- GPS signal with `state_code: 'CA'`: Shows "United States > California" (inferred)
- **Consistent layout regardless of signal source**

## Broader Applications

This pattern applies to **any field with deterministic inference**:

### 1. County from Congressional District
```typescript
// CA-12 → San Francisco County (1:1 mapping)
const breadcrumbCounty = $derived.by(() => {
    if (inferredLocation?.county_name) return inferredLocation.county_name;
    if (inferredLocation?.congressional_district) {
        return inferCountyFromDistrict(inferredLocation.congressional_district);
    }
    return null;
});
```

### 2. Timezone from Coordinates
```typescript
// (37.7749, -122.4194) → America/Los_Angeles (deterministic via tz database)
const timezone = $derived.by(() => {
    if (inferredLocation?.timezone) return inferredLocation.timezone;
    if (inferredLocation?.latitude && inferredLocation?.longitude) {
        return inferTimezoneFromCoordinates(
            inferredLocation.latitude,
            inferredLocation.longitude
        );
    }
    return null;
});
```

### 3. Locale from Country + Language
```typescript
// country: 'CA' + browser language: 'fr' → 'fr-CA' (deterministic)
const locale = $derived.by(() => {
    if (userSettings?.locale) return userSettings.locale;
    if (inferredLocation?.country_code) {
        const lang = navigator.language.split('-')[0];
        return `${lang}-${inferredLocation.country_code}`;
    }
    return 'en-US'; // Default fallback
});
```

## When NOT to Use This Pattern

**Do NOT use for probabilistic inference**:

❌ **City from IP** - IP → City is probabilistic, not deterministic
```typescript
// WRONG: IP-based city is unreliable (VPNs, mobile networks, ISP routing)
if (ipLocation?.city) {
    return ipLocation.city; // 30-50% accuracy, not deterministic
}
```

❌ **Income from ZIP code** - Demographics are statistical, not individual truth
```typescript
// WRONG: ZIP code median income doesn't determine individual income
if (address?.zipCode) {
    return inferIncomeFromZip(address.zipCode); // Statistical, not deterministic
}
```

✅ **Only use for 1:1 mappings where inference is guaranteed correct**

## Testing Requirements

When implementing this pattern, verify:

1. **Layout stability**: Component renders same structure with explicit vs. inferred data
2. **Visual parity**: Inferred data shown with same styling as explicit data
3. **Override behavior**: Explicit data overrides inference when both present
4. **Graceful degradation**: Component handles missing inference source gracefully

### Test Cases for Country Inference

```typescript
describe('breadcrumbCountry with inferrable defaults', () => {
    it('shows explicit country when available', () => {
        const location = { country_code: 'US', state_code: 'CA' };
        expect(breadcrumbCountry(location)).toBe('United States');
    });

    it('infers country from US state code when country missing', () => {
        const location = { state_code: 'CA' }; // No country_code
        expect(breadcrumbCountry(location)).toBe('United States');
    });

    it('infers country from Canadian province code', () => {
        const location = { state_code: 'BC' };
        expect(breadcrumbCountry(location)).toBe('Canada');
    });

    it('returns null when neither country nor state available', () => {
        const location = {};
        expect(breadcrumbCountry(location)).toBeNull();
    });

    it('explicit country overrides inference from state', () => {
        // Edge case: Explicit country takes precedence
        const location = { country_code: 'CA', state_code: 'TX' };
        expect(breadcrumbCountry(location)).toBe('Canada'); // Explicit wins
    });
});
```

## Design Rationale

### Why Inference is Better Than Prompting

**Alternative**: Prompt user to fill in missing country
- ❌ Adds friction (asks for data we can deterministically infer)
- ❌ Breaks flow (interrupts user to confirm obvious facts)
- ❌ Signals incompetence ("You don't know California is in the USA?")

**This pattern**: Infer country from state code
- ✅ Zero friction (no prompt needed)
- ✅ Maintains flow (breadcrumb just works)
- ✅ Signals competence (system knows geographical relationships)

### Why Inference is Better Than Hiding

**Alternative**: Hide country breadcrumb when not explicit
- ❌ Layout instability (breadcrumb structure varies)
- ❌ Lost navigation (can't drill up to country level)
- ❌ Inconsistent mental model (same data, different UI)

**This pattern**: Show inferred country
- ✅ Layout stability (breadcrumb always has country when state exists)
- ✅ Complete navigation (can always drill up)
- ✅ Consistent mental model (location always has country > state > city)

## Real-World Precedents

This pattern is used by major platforms:

1. **Google Maps**: Infers country from coordinates (doesn't require explicit country in API)
2. **Stripe**: Infers currency from country (USD for US addresses, not user-specified)
3. **Airbnb**: Infers timezone from listing coordinates (not separate field)
4. **Amazon**: Infers locale from shipping address (en-US for US, fr-CA for Quebec)

## Future Extensions

### Phase 2: Inference Engine Enhancement

Move state→country mapping into `inference-engine.ts` so `inferredLocation.country_code` is ALWAYS populated when state exists:

```typescript
// In extractLocationFromSignals()
const location: InferredLocation = {
    country_code: primarySignal.country_code || inferCountryFromState(primarySignal.state_code),
    state_code: primarySignal.state_code,
    // ...
};
```

**Benefits**:
- Single source of truth (inference logic in one place)
- All consumers get inferred country automatically
- Breadcrumb logic simplifies back to "just show country_code"

**Trade-off**: Inference engine becomes more opinionated about data completeness

### Phase 3: Metadata Quality Indicators

For transparency, show inference source in tooltip:

```svelte
<button title="Country inferred from state code">
    United States
</button>
```

**Benefits**:
- Transparency (users can see what's inferred vs. explicit)
- Trust (shows system reasoning)
- Debugging (developers can verify inference logic)

## Related Patterns

- **Progressive Enhancement**: This pattern is a data-layer implementation of progressive enhancement
- **Graceful Degradation**: Handles missing explicit data without breaking UX
- **Zero-UI**: Inference removes the need for explicit user input
- **Smart Defaults**: Provides sensible defaults based on available context

## Conclusion

**Inferrable Defaults with Explicit Overrides** is a robust pattern for handling partial data from multiple sources. It prioritizes:

1. **Layout stability** over metadata completeness
2. **Deterministic inference** over probabilistic guessing
3. **User experience** over data purity
4. **Progressive enhancement** over all-or-nothing display

Use this pattern when you have **1:1 mappings** between fields and want **consistent UI** regardless of data source quality.
