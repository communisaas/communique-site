# Location Signal Accuracy Limits

**Purpose**: Define the reliable granularity for each location signal type to prevent false precision.

## Core Principle

**Never pretend to know more than you actually know.** Each location signal has inherent accuracy limits based on how the data is collected. Attempting to derive higher precision than the signal supports creates false confidence and breaks user trust.

## Signal Type Accuracy Matrix

| Signal Type | Reliable Granularity | Why | Confidence |
|------------|---------------------|-----|-----------|
| **IP Geolocation** | **State only** | IP addresses route through ISPs, VPNs, and mobile networks. Coordinates are approximate (city-center). City might be correct, but **congressional district is impossible**. | 0.3 |
| **Timezone** | **State (US only)** | Multiple timezones per state. Can only infer state for single-timezone states. | 0.2 |
| **Browser Geolocation** | **Congressional District** | GPS/WiFi triangulation provides precise lat/lng. Requires user permission. | 0.6 |
| **OAuth Profile** | **State (sometimes city)** | User-provided location string (e.g., "Austin, TX"). City name is display-only, not for filtering. | 0.8 |
| **Behavioral Patterns** | **Congressional District** | Revealed preference from repeated template interactions. High confidence when patterns are consistent. | 0.9 |
| **Identity Verification** | **Congressional District** | Cryptographic proof of address (passport scan, government ID). Highest confidence. | 1.0 |

## What NOT to Do

### ❌ WRONG: Derive Congressional District from IP

```typescript
// DON'T DO THIS
const ipData = await fetch('https://ipapi.co/json');
const { latitude, longitude } = ipData;

// IP coordinates are APPROXIMATE (city-center, ISP routing)
// This lookup will be WRONG for most users
const district = await censusAPI.geocodeCoordinates(latitude, longitude); // ❌
```

**Why this fails:**
- IP geolocation returns city-center coordinates
- Cities span multiple congressional districts
- VPNs, mobile networks, and ISPs shift the apparent location
- False precision breaks user trust

### ❌ WRONG: Filter Templates by IP-Based City

```typescript
// DON'T DO THIS
const templates = await db.template.findMany({
  where: {
    city: ipData.city // ❌ IP city is unreliable
  }
});
```

**Why this fails:**
- IP geolocation often gets the wrong city
- Even when city is correct, it's not useful for filtering
- Users see irrelevant templates

## What TO Do

### ✅ CORRECT: Use IP for State-Level Filtering

```typescript
// DO THIS
const ipData = await fetch('/api/location/ip-lookup');
const { state_code } = ipData;

// IP can reliably determine STATE
const templates = await db.template.findMany({
  where: {
    state: state_code // ✅ State-level is reliable
  }
});
```

### ✅ CORRECT: Display City Name, Don't Filter By It

```typescript
// DO THIS
const ipData = await fetch('/api/location/ip-lookup');

// Display city for UX (helps user understand where they are)
console.log(`Showing templates for ${ipData.city}, ${ipData.state_code}`);

// But filter by STATE only
const templates = await filterByState(ipData.state_code); // ✅
```

### ✅ CORRECT: Congressional District Requires User Permission

```typescript
// DO THIS
async function getCongressionalDistrict() {
  // Request browser geolocation (requires user permission)
  const signal = await addBrowserGeolocationSignal();

  if (!signal?.congressional_district) {
    // Fallback: Collect address via form
    return await showAddressCollectionModal();
  }

  return signal.congressional_district; // ✅ Precise location with user consent
}
```

## Location Filtering UX Guidelines

### Template Browser Location Filter

**Default (No User Action):**
- Use IP geolocation to get state
- Filter templates by state
- Display: "Showing templates for California" (not city)

**User Clicks "Update Location":**
- Request browser geolocation permission
- If granted: Get precise district, filter by district
- If denied: Show address collection form

**Display vs Filter:**
- **Display**: Show city name from IP (helps user orient)
- **Filter**: Use state code only (reliable granularity)

## Code Enforcement

### Location Inference Engine Rules

1. **IP signals MUST NOT include `congressional_district`**
   - Set to `null` in IP signal creation
   - Remove any Census API calls using IP coordinates

2. **Browser geolocation signals CAN include `congressional_district`**
   - Only when user explicitly grants permission
   - Use Census API with precise GPS coordinates

3. **Verified signals MUST include `congressional_district`**
   - Identity verification always provides district
   - Required for congressional message delivery

### Type System Enforcement

```typescript
interface IPLocationSignal {
  signal_type: 'ip';
  country_code: string;        // ✅ Reliable
  state_code: string | null;   // ✅ Moderately reliable
  city_name: string | null;    // ⚠️ Display only, don't filter
  congressional_district: null; // ❌ ALWAYS null for IP
  confidence: 0.3;              // IP is low confidence
}

interface BrowserLocationSignal {
  signal_type: 'browser';
  congressional_district: string | null; // ✅ Can be resolved from GPS
  confidence: 0.6;                       // Higher confidence
}

interface VerifiedLocationSignal {
  signal_type: 'verified';
  congressional_district: string;  // ✅ REQUIRED for verified
  confidence: 1.0;                 // Cryptographic proof
}
```

## Migration Path

### Existing Code Audit

Search for these anti-patterns:

```bash
# Find IP-based district lookups
rg "censusAPI.*latitude.*longitude" --type ts

# Find city-based filtering
rg "city.*filter" --type ts
rg "where.*city" --type ts

# Find district assumptions without signal check
rg "congressional_district" --type ts
```

### Fix Pattern

**Before (Wrong):**
```typescript
if (data.latitude && data.longitude) {
  const censusSignal = await censusAPI.geocodeCoordinates(
    data.latitude,
    data.longitude
  );
  return censusSignal; // ❌ False precision
}
```

**After (Correct):**
```typescript
// IP geolocation provides approximate coordinates
// This is NOT accurate enough for congressional district
console.log('[IP Lookup] Returning state-level location');

return {
  signal_type: 'ip',
  country_code: data.country_code,
  state_code: data.state_code,
  city_name: data.city,           // Display only
  congressional_district: null,    // ✅ Honest about limits
  confidence: 0.3
};
```

## Testing Requirements

### Unit Tests

```typescript
describe('IP Location Signal', () => {
  it('MUST NOT include congressional district', async () => {
    const signal = await getIPLocationSignal();
    expect(signal.congressional_district).toBeNull();
  });

  it('MUST have state-level granularity', async () => {
    const signal = await getIPLocationSignal();
    expect(signal.state_code).toBeTruthy();
    expect(signal.congressional_district).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('Location Filtering', () => {
  it('filters by state for IP-based location', async () => {
    const templates = await getTemplatesForLocation({
      signal_type: 'ip',
      state_code: 'CA'
    });

    // Should return CA templates
    expect(templates.every(t => t.state === 'CA')).toBe(true);
  });

  it('does NOT filter by city for IP-based location', async () => {
    // This should fail if implemented
    const templates = await getTemplatesForLocation({
      signal_type: 'ip',
      city_name: 'San Francisco'
    });

    // Should return ALL state templates, not just SF
    expect(templates.length).toBeGreaterThan(100);
  });
});
```

## Documentation References

- [Progressive Location Discovery](../archive/2025-11-location-progressive-discovery/PROGRESSIVE-LOCATION-DISCOVERY-SPEC.md)
- [Location as Filter Principle](../design/LOCATION-AS-FILTER-PRINCIPLE.md)
- [Census API Integration](../features/identity-verification.md)

## Related Commits

- `9574d2f` - Remove false precision from IP-based district lookup
- Original issue: Attempting to resolve congressional district from IP coordinates

---

**Remember**: It's better to say "I don't know your exact district yet" than to confidently display the wrong one. Users understand limitations when you're honest about them.
