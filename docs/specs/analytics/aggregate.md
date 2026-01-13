# Aggregation Model

**Module:** `src/lib/core/analytics/aggregate.ts`
**Types:** `src/lib/types/analytics/aggregate.ts`

---

## Core Concept

We store **counts**, not events. The database holds "how many times X happened on day Y with dimensions Z" — never "user A did X at time T".

```sql
-- This is ALL we store
SELECT date, metric, template_id, jurisdiction, count
FROM analytics_aggregate
WHERE metric = 'template_use' AND date >= '2025-01-01';

-- Returns:
-- 2025-01-01 | template_use | tmpl_abc | CA | 47
-- 2025-01-01 | template_use | tmpl_abc | NY | 23
-- 2025-01-02 | template_use | tmpl_abc | CA | 52
```

No session. No user. No timestamp beyond the day.

---

## Schema

```prisma
model analytics_aggregate {
  id              String    @id @default(cuid())

  // Temporal bucket (day granularity only)
  date            DateTime  @db.Date

  // Metric identifier
  metric          String    // 'template_use', 'delivery_success', etc.

  // Dimensions (all optional, creates sparse matrix)
  template_id     String?
  jurisdiction    String?   // State code only: 'CA', 'NY'
  delivery_method String?   // 'cwc', 'email', 'certified'
  utm_source      String?   // Sanitized referrer
  error_type      String?   // Categorized, never raw message

  // The count (only value we store)
  count           Int       @default(0)

  // Noise metadata (for audit trail)
  noise_applied   Float     @default(0)
  epsilon         Float     @default(1.0)

  // Composite unique prevents duplicates
  @@unique([date, metric, template_id, jurisdiction, delivery_method, utm_source, error_type])

  // Query indexes
  @@index([date])
  @@index([metric, date])
  @@index([template_id, date])

  @@map("analytics_aggregate")
}
```

---

## Operations

### Increment

The only write operation. Atomic upsert:

```typescript
// aggregate.ts
export async function increment(
  metric: Metric,
  dimensions: Dimensions
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await db.analytics_aggregate.upsert({
    where: {
      date_metric_template_id_jurisdiction_delivery_method_utm_source_error_type: {
        date: new Date(today),
        metric,
        template_id: dimensions.template_id ?? null,
        jurisdiction: dimensions.jurisdiction ?? null,
        delivery_method: dimensions.delivery_method ?? null,
        utm_source: dimensions.utm_source ?? null,
        error_type: dimensions.error_type ?? null,
      }
    },
    update: {
      count: { increment: 1 }
    },
    create: {
      date: new Date(today),
      metric,
      template_id: dimensions.template_id ?? null,
      jurisdiction: dimensions.jurisdiction ?? null,
      delivery_method: dimensions.delivery_method ?? null,
      utm_source: dimensions.utm_source ?? null,
      error_type: dimensions.error_type ?? null,
      count: 1
    }
  });
}
```

### Query

Read with noise applied:

```typescript
// aggregate.ts
export async function query(params: QueryParams): Promise<QueryResult[]> {
  const { metric, start, end, groupBy } = params;

  // Validate date range
  const daysDiff = differenceInDays(end, start);
  if (daysDiff > PRIVACY.MAX_QUERY_DAYS) {
    throw new QueryRangeError(`Max ${PRIVACY.MAX_QUERY_DAYS} days`);
  }

  // Fetch raw aggregates
  const raw = await db.analytics_aggregate.findMany({
    where: {
      metric,
      date: { gte: start, lte: end }
    }
  });

  // Group by requested dimensions
  const grouped = groupByDimensions(raw, groupBy);

  // Apply coarsening for small cohorts
  const coarsened = coarsen(grouped);

  // Apply Laplace noise
  const noisy = applyNoise(coarsened, PRIVACY.SERVER_EPSILON);

  return noisy;
}
```

---

## Type Definitions

```typescript
// src/lib/types/analytics/aggregate.ts

export interface AggregateRecord {
  date: Date;
  metric: Metric;
  template_id: string | null;
  jurisdiction: string | null;
  delivery_method: DeliveryMethod | null;
  utm_source: string | null;
  error_type: ErrorType | null;
  count: number;
}

export interface QueryParams {
  metric: Metric;
  start: Date;
  end: Date;
  groupBy?: DimensionKey[];
  filters?: {
    template_id?: string;
    jurisdiction?: string;
    delivery_method?: DeliveryMethod;
  };
}

export interface QueryResult {
  dimensions: Record<DimensionKey, string | null>;
  count: number;           // Always noisy
  coarsened: boolean;      // True if rolled up from finer granularity
  coarsen_level?: string;  // e.g., 'state' if rolled up from district
}
```

---

## Storage Analysis

### Per-Day Overhead

With 1,000 daily active users, assuming:
- 15 metrics
- 50 templates
- 50 states
- 3 delivery methods
- 5 UTM sources

Worst case (full cross-product): 15 × 50 × 50 × 3 × 5 = 562,500 rows

Reality (sparse): ~500-2,000 rows (only combinations that occur)

**Row size:** ~200 bytes
**Daily storage:** ~100-400 KB (vs. 20+ MB for event-based)

### 30-Day Retention

- Aggregate data: ~3-12 MB
- Legacy equivalent: ~600 MB

**99%+ reduction.**

---

## Constraints

1. **Day granularity** — Cannot query hourly patterns
2. **No individual events** — Cannot ask "what happened at 3pm"
3. **No sequences** — Cannot reconstruct user journeys
4. **Dimension cardinality** — High-cardinality dimensions bloat storage

These are features, not bugs. They prevent surveillance by design.

---

*Aggregation Model Specification | 2025-01*
