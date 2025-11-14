# Location as Context: LocationFilter Refactor

**Status:** Design → Implementation
**Date:** 2025-01-12
**Context:** LocationFilter currently assumes geography gates access. It should provide local context enhancement instead.

---

## The Fundamental Problem

**Current model (WRONG):**
```
User precision level → Filter templates → Hide non-matching → Show remainder
```

**New model (CORRECT):**
```
User precision level → Show ALL templates → Boost local relevance → Add local breakdown
```

### Why This Matters

**Use case 1: Amazon warehouse conditions**
- Scope: International (any Amazon worker/customer can join)
- Current behavior: Hidden if you're at district precision (only shows district templates)
- Correct behavior: ALWAYS visible, with local context ("12K global, 500 in CA, 20 in your area")

**Use case 2: US Senate campaign**
- Scope: State-level (need state verification)
- Current behavior: Shows at state level, hidden at district level (?)
- Correct behavior: Visible at state+ precision, shows "2K in California"

**Use case 3: US House campaign**
- Scope: District-level (need district verification)
- Current behavior: Only shows at district precision
- Correct behavior: Only shows if you have district precision (correct!)

---

## Template Geographic Properties

Every template has TWO independent properties:

### 1. Geographic Scope (Target Breadth)

How geographically broad the target/issue is:

```typescript
type GeographicScope =
  | 'international'  // UN, WHO, global corps (Amazon, Google, Meta)
  | 'national'       // US Congress (House as body), federal agencies, national corps
  | 'state'          // US Senate, state legislature, statewide ballot measures
  | 'metro'          // Regional issues (Bay Area housing, transit authorities)
  | 'district'       // US House member, state house district
  | 'local'          // City council, school board, local business
```

### 2. Minimum Precision Required (Verification Gate)

What location verification is needed to participate:

```typescript
type MinimumPrecision =
  | 'none'      // Anyone globally can join
  | 'country'   // Need to be in US (for federal issues)
  | 'state'     // Need state verification (Senate, state legislature)
  | 'county'    // Need county verification (regional coordination)
  | 'district'  // Need district verification (US House, state house)
```

**Examples:**

| Template | Scope | Min Precision | Reasoning |
|----------|-------|---------------|-----------|
| Climate change petition | `international` | `none` | Global issue, anyone can sign |
| Amazon working conditions | `international` | `none` | Global corp, any worker/customer |
| US Senate campaign (CA) | `state` | `state` | State-level race, need CA verification |
| US House campaign (CA-16) | `district` | `district` | District race, need CA-16 verification |
| Starbucks unionization | `national` | `none` | National corp, any worker |
| Bay Area rent control | `metro` | `county` | Regional issue, need Bay Area verification |
| SF school board | `local` | `district` | Local issue, need SF verification |

---

## New Filtering Logic

### Current (BROKEN):

```typescript
// Progressively NARROWS templates as precision increases
if (precision === 'state') {
  return templates.filter(t => t.state === userState);
}
if (precision === 'district') {
  return templates.filter(t => t.district === userDistrict);
}
// Result: District precision HIDES national/international templates ❌
```

### New (CORRECT):

```typescript
function filterTemplates(templates, userPrecision, userLocation) {
  return templates.filter(template => {
    // Check if user meets minimum precision requirement
    const meetsRequirement = checkPrecisionRequirement(
      template.minimum_precision_required,
      userPrecision,
      userLocation
    );

    // If template requires precision user doesn't have, hide it
    if (!meetsRequirement) return false;

    // Otherwise, ALWAYS show (broader scopes remain visible)
    return true;
  });
}

function checkPrecisionRequirement(required, userHas, userLocation) {
  if (required === 'none') return true;
  if (required === 'country') return userHas !== 'none';
  if (required === 'state') return ['state', 'county', 'district'].includes(userHas)
    && userLocation.state_code;
  if (required === 'county') return ['county', 'district'].includes(userHas)
    && userLocation.county_fips;
  if (required === 'district') return userHas === 'district'
    && userLocation.congressional_district;
  return false;
}
```

**Key insight:** Templates are hidden only if you DON'T meet their minimum precision requirement. Otherwise, they're always visible with added local context.

---

## Multi-Scope Coordination Counts

**Current (single-level):**
```
"500 coordinating" (at your current precision level)
```

**New (multi-level breakdown):**
```
International scope: "12,000 coordinating globally"
  → State precision: "12,000 coordinating globally (500 in California)"
  → District precision: "12,000 coordinating globally (500 in CA, 20 in CA-16)"

State scope: "2,000 coordinating in California"
  → District precision: "2,000 coordinating in California (80 in CA-16)"

District scope: "150 coordinating in CA-16"
```

**Implementation:**
```typescript
interface CoordinationCount {
  total: number;
  breakdown?: {
    state?: { code: string; count: number };
    county?: { name: string; count: number };
    district?: { code: string; count: number };
  };
}

function getCoordinationCount(template, userLocation): CoordinationCount {
  const total = template.verified_sends || 0;

  if (template.geographic_scope === 'international' ||
      template.geographic_scope === 'national') {
    return {
      total,
      breakdown: {
        state: getStateCount(template, userLocation.state_code),
        district: getDistrictCount(template, userLocation.congressional_district)
      }
    };
  }

  // State/district scopes just return total (no broader context)
  return { total };
}
```

---

## Power-Agnostic Copy Framework

### Current (Government-Centric):

```svelte
<h2>California's 16th Congressional District</h2>
<p>198,766 coordinating</p>
<button>Find who represents you</button>
```

### New (Power-Agnostic):

```svelte
<!-- Location header -->
<h2>{locationName}</h2>
<p class="text-sm text-slate-600">
  {#if hasDistrict}
    Congressional District {districtCode}
  {:else}
    Location verified
  {/if}
</p>

<!-- Template-specific language -->
{#if template.target_type === 'government'}
  <p>{count} messages to your representatives</p>
{:else if template.target_type === 'corporate'}
  <p>{count} messages to {companyName} decision-makers</p>
{:else if template.target_type === 'labor'}
  <p>{count} workers organizing at {companyName}</p>
{:else}
  <p>{count} people coordinating on this issue</p>
{/if}

<!-- Action button -->
{#if template.target_type === 'government'}
  <button>Find your representatives</button>
{:else}
  <button>See who's coordinating</button>
{/if}
```

---

## Template Grouping by Scope

Instead of ONE filtered list, show SECTIONS based on user's precision:

### User at State Precision:

```
┌─────────────────────────────────────────┐
│ 📍 In Your State (California)           │
│ ├─ US Senate Campaign (CA)              │
│ └─ CA State Legislature Campaign        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔒 Get More Specific (requires address) │
│ ├─ US House Campaign (CA-16) [LOCKED]   │
│ └─ SF Rent Control [LOCKED]             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🌍 Anyone Can Join                      │
│ ├─ Climate Change Petition (12K global) │
│ ├─ Amazon Conditions (8K global)        │
│ └─ Tech Worker Organizing (2K global)   │
└─────────────────────────────────────────┘
```

### User at District Precision:

```
┌─────────────────────────────────────────┐
│ 📍 In Your District (CA-16)             │
│ ├─ US House Campaign (150 local)        │
│ └─ SF Rent Control (80 local)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📍 In Your State (California)           │
│ ├─ US Senate (2K statewide, 80 local)   │
│ └─ CA Legislature (1.5K statewide)      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🌍 Anyone Can Join                      │
│ ├─ Climate (12K global, 500 in CA)      │
│ ├─ Amazon (8K global, 200 in CA)        │
│ └─ Tech Workers (2K global, 400 in CA)  │
└─────────────────────────────────────────┘
```

---

## Motivation Patterns by Target Type

### Government Targets:
- Priority: "Verified constituents get priority"
- Social proof: "500 verified constituents sent this"
- Trust: "Zero-knowledge proof · Staff can't see your address"

### Corporate Targets:
- Protection: "Organize without retaliation risk"
- Social proof: "2,000 workers coordinating anonymously"
- Trust: "Zero-knowledge proof · Company can't identify you"

### Labor Organizing:
- Protection: "Prove employment without exposing yourself to management"
- Social proof: "150 coworkers at your location organizing"
- Trust: "Anti-union retaliation protection · Complete anonymity"

### Advocacy/Petition:
- Collective power: "Join 12,000 globally demanding change"
- Social proof: "500 people in your area signed"
- Trust: "No email harvesting · Verified real people only"

---

## Implementation Checklist

### Phase 1: Schema Changes
- [ ] Add `geographic_scope` to Template type
- [ ] Add `minimum_precision_required` to Template type
- [ ] Add `target_type` to Template type
- [ ] Migration script for existing templates
- [ ] Update Prisma schema

### Phase 2: Filtering Logic Refactor
- [ ] Replace `coordinationByPrecision` with scope-based counts
- [ ] Implement `checkPrecisionRequirement()` function
- [ ] Update `filterTemplatesByPrecision()` to show all qualifying templates
- [ ] Add multi-level breakdown to coordination counts

### Phase 3: UI Components
- [ ] Refactor LocationFilter header (power-agnostic copy)
- [ ] Update TemplatePreviewCard for multi-target-type support
- [ ] Add template grouping by scope (sections)
- [ ] Update breadcrumb navigation logic

### Phase 4: Copy & Messaging
- [ ] Replace "congressional district" with location-agnostic copy
- [ ] Add target-type-specific motivation messages
- [ ] Update ProofGenerationModal educational messages
- [ ] Add retaliation-protection framing for corporate targets

### Phase 5: Testing
- [ ] Test with international scope templates
- [ ] Test with corporate target templates
- [ ] Test with labor organizing templates
- [ ] Test precision gating (only hide if requirement not met)
- [ ] Test multi-level coordination breakdowns

---

## Migration Strategy

### Existing Templates (Backward Compatibility)

All existing templates are government-focused, so migration is straightforward:

```typescript
function migrateTemplate(template: OldTemplate): NewTemplate {
  // Determine scope from jurisdictions
  const hasDistrict = template.jurisdictions.some(j => j.congressional_district);
  const hasState = template.jurisdictions.some(j => j.state_code);
  const isFederal = template.jurisdictions.some(j => j.jurisdiction_type === 'federal');

  let geographic_scope: GeographicScope;
  let minimum_precision_required: MinimumPrecision;

  if (hasDistrict) {
    geographic_scope = 'district';
    minimum_precision_required = 'district';
  } else if (hasState && !isFederal) {
    geographic_scope = 'state';
    minimum_precision_required = 'state';
  } else if (isFederal) {
    geographic_scope = 'national';
    minimum_precision_required = 'country'; // Need to be in US
  }

  return {
    ...template,
    geographic_scope,
    minimum_precision_required,
    target_type: 'government'
  };
}
```

### New Template Examples

**Amazon warehouse conditions:**
```typescript
{
  title: "Demand safe working conditions at Amazon",
  geographic_scope: 'international',
  minimum_precision_required: 'none',
  target_type: 'corporate',
  target_entity: 'Amazon',
  jurisdictions: [] // Not geography-based
}
```

**Starbucks unionization:**
```typescript
{
  title: "Support Starbucks Workers United",
  geographic_scope: 'national',
  minimum_precision_required: 'none',
  target_type: 'labor',
  target_entity: 'Starbucks',
  jurisdictions: [] // Not geography-based
}
```

**Climate petition:**
```typescript
{
  title: "Demand climate action from world leaders",
  geographic_scope: 'international',
  minimum_precision_required: 'none',
  target_type: 'advocacy',
  jurisdictions: [] // Not geography-based
}
```

---

## Success Metrics

**Before (current broken state):**
- User at district precision sees only ~10 district templates
- National campaigns invisible to most users
- Corporate/labor organizing impossible

**After (correct behavior):**
- User at district precision sees ALL qualifying templates (~100+)
- National campaigns always visible with local context
- Corporate/labor organizing fully supported with protection framing

**Key metric:** Template visibility should INCREASE as precision increases (more context), not decrease (hiding broader scopes).
