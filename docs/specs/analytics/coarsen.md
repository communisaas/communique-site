# Geographic Coarsening

**Module:** `src/lib/core/analytics/coarsen.ts`
**Types:** `src/lib/types/analytics/jurisdiction.ts`

---

## Problem Statement

K-anonymity suppression (hiding counts < k) harms small communities:

- 3 coordinated actions in Humboldt County → **invisible**
- 1 person in rural Wyoming → **doesn't exist**
- Emerging movements → **silenced until they're already large**

This is backwards. Small communities need visibility to grow.

---

## Solution: Geographic Hierarchy Rollup

Instead of suppression, **coarsen to larger regions** until threshold is met:

```
3 actions in CA-02 district
  → Too small (< 5)
  → Roll up to "Northern California" (47 total)
  → Report: "47 in Northern California"

1 action in WY-AL (Wyoming at-large)
  → Too small
  → Roll up to "Mountain West" (156 total)
  → Report: "156 in Mountain West"
```

The data isn't hidden—it's **contextualized**.

---

## Jurisdiction Hierarchy

```typescript
// src/lib/types/analytics/jurisdiction.ts

export interface JurisdictionHierarchy {
  district?: string;     // 'CA-02', 'NY-14'
  metro?: string;        // 'SF Bay Area', 'NYC Metro'
  state: string;         // 'CA', 'NY'
  region: string;        // 'West', 'Northeast'
  national: string;      // 'US'
}

export const REGIONS: Record<string, string[]> = {
  'Northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'Southeast': ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV', 'DC'],
  'Midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'Southwest': ['AZ', 'NM', 'OK', 'TX'],
  'West': ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
};

export type CoarsenLevel = keyof JurisdictionHierarchy;
```

---

## Coarsening Algorithm

```typescript
// coarsen.ts

const THRESHOLD = 5; // Minimum count before coarsening

export interface CoarsenResult {
  level: CoarsenLevel;
  value: string;
  count: number;
  coarsened: boolean;
}

export function coarsen(
  results: AggregateResult[],
  jurisdictionKey: string = 'jurisdiction'
): CoarsenResult[] {
  const output: CoarsenResult[] = [];

  for (const result of results) {
    const jurisdiction = result.dimensions[jurisdictionKey];

    if (result.count >= THRESHOLD) {
      // No coarsening needed
      output.push({
        level: detectLevel(jurisdiction),
        value: jurisdiction,
        count: result.count,
        coarsened: false
      });
      continue;
    }

    // Need to coarsen - find parent level with sufficient count
    const coarsened = findSufficientLevel(jurisdiction, result.metric, result.date);
    output.push(coarsened);
  }

  return mergeCoarsenedResults(output);
}

function findSufficientLevel(
  jurisdiction: string,
  metric: string,
  date: Date
): CoarsenResult {
  const hierarchy = buildHierarchy(jurisdiction);
  const levels: CoarsenLevel[] = ['district', 'metro', 'state', 'region', 'national'];

  for (const level of levels) {
    const value = hierarchy[level];
    if (!value) continue;

    const count = getAggregateCount(metric, level, value, date);

    if (count >= THRESHOLD) {
      return {
        level,
        value,
        count,
        coarsened: level !== detectLevel(jurisdiction)
      };
    }
  }

  // National always meets threshold
  return {
    level: 'national',
    value: 'US',
    count: getNationalCount(metric, date),
    coarsened: true
  };
}

function buildHierarchy(jurisdiction: string): JurisdictionHierarchy {
  // Parse jurisdiction string (e.g., 'CA-02' or 'CA')
  const state = jurisdiction.substring(0, 2);
  const district = jurisdiction.length > 2 ? jurisdiction : undefined;

  return {
    district,
    metro: getMetroArea(state, district),
    state,
    region: getRegion(state),
    national: 'US'
  };
}
```

---

## Merge Logic

When multiple fine-grained results coarsen to the same parent, merge them:

```typescript
function mergeCoarsenedResults(results: CoarsenResult[]): CoarsenResult[] {
  const merged = new Map<string, CoarsenResult>();

  for (const result of results) {
    const key = `${result.level}:${result.value}`;

    if (merged.has(key)) {
      // Already have this coarsened bucket - skip
      // (count was computed at coarsen time)
      continue;
    }

    merged.set(key, result);
  }

  return Array.from(merged.values());
}
```

---

## Example Scenarios

### Scenario 1: Small Rural District

```
Query: template_use by district, 2025-01-01

Raw data:
  CA-02: 3 (below threshold)
  CA-05: 2 (below threshold)
  CA-12: 47

Coarsened result:
  "Northern California": 52 (CA-02 + CA-05 + others)
  CA-12: 47 (no coarsening)
```

### Scenario 2: Emerging Movement

```
Query: template_use by state, 2025-01-01

Raw data:
  WY: 2 (below threshold)
  MT: 3 (below threshold)
  CO: 89

Coarsened result:
  "West": 94 (WY + MT rolled up)
  CO: 89 (no coarsening)
```

### Scenario 3: All States Active

```
Query: template_use by state, 2025-01-01

Raw data:
  CA: 1247
  NY: 892
  TX: 634
  ... all above threshold

Coarsened result:
  (no coarsening needed, return as-is)
```

---

## API Response

```typescript
// Response includes coarsening metadata
{
  "results": [
    {
      "dimensions": { "jurisdiction": "CA-12" },
      "count": 47,
      "coarsened": false
    },
    {
      "dimensions": { "jurisdiction": "Northern California" },
      "count": 52,
      "coarsened": true,
      "coarsen_level": "metro",
      "original_level": "district"
    }
  ],
  "privacy": {
    "epsilon": 1.0,
    "differential_privacy": true,
    "coarsening_applied": true,
    "coarsen_threshold": 5
  }
}
```

---

## Type Definitions

```typescript
// src/lib/types/analytics/jurisdiction.ts

export interface JurisdictionHierarchy {
  district?: string;
  metro?: string;
  state: string;
  region: string;
  national: string;
}

export type CoarsenLevel = keyof JurisdictionHierarchy;

export interface CoarsenResult {
  level: CoarsenLevel;
  value: string;
  count: number;
  coarsened: boolean;
  original_level?: CoarsenLevel;
}

export interface CoarsenConfig {
  threshold: number;
  hierarchy: CoarsenLevel[];
}
```

---

## Why This Matters

| Approach | 3 people in rural district | Movement visibility |
|----------|---------------------------|---------------------|
| K-anonymity suppression | Invisible | Hidden until large |
| Geographic coarsening | "47 in Northern California" | Visible in context |

Small communities are **contextualized, not silenced**.

---

*Geographic Coarsening Specification | 2025-01*
