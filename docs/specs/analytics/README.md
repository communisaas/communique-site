# Analytics Architecture

**Status:** Active Implementation
**Supersedes:** `privacy-first-analytics.md`, `privacy-first-analytics-revisions.md`

---

## Design Principles

1. **Aggregation, not events** — Individual actions are never stored
2. **Noise at every layer** — Client-side k-ary RR + server-side Laplace
3. **Coarsen, don't suppress** — Small cohorts roll up, never disappear
4. **No client-side tracking** — Cohort tokens removed (created linkability for zero benefit)
5. **Attestable architecture** — TEE aggregation proves what we claim
6. **Contribution bounding** — Rate limits bound sensitivity assumptions

---

## Module Structure

```
src/lib/core/analytics/
├── client.ts       # Browser: increment(), ContributionTracker
├── aggregate.ts    # Server: upsert, rate limiting, UTC time
├── snapshot.ts     # Daily noisy snapshot materialization
├── noise.ts        # k-ary RR, Laplace, debiasing
├── coarsen.ts      # Post-noise geographic rollup
└── sanitize.ts     # Dimension validation

[REMOVED: cohort.ts - cohort tokens eliminated]

src/lib/types/analytics/
├── metrics.ts      # ALLOWED_METRICS, dimension whitelists, PRIVACY config
├── aggregate.ts    # AggregateRecord, AggregateQuery
├── cohort.ts       # Types preserved for potential server-side use
├── percolation.ts  # Specialized analytics types
└── jurisdiction.ts # JurisdictionHierarchy, CoarsenResult

src/routes/api/analytics/
├── increment/      # POST: receive batched increments
├── aggregate/      # GET: query with noise
├── health/         # GET: platform dashboard

src/routes/api/cron/
└── analytics-snapshot/ # Daily snapshot materialization
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ BROWSER                                                              │
│                                                                      │
│  User Action                                                         │
│       ↓                                                              │
│  client.increment(metric, dimensions)                                │
│       ↓                                                              │
│  sanitize.dimensions(dimensions)     # Validate, strip PII          │
│       ↓                                                              │
│  noise.localDP(increment)            # Randomized response (ε=2.0)  │
│       ↓                                                              │
│  Batch queue (500ms debounce, max 100)                               │
│       ↓                                                              │
│  Fire-and-forget POST /api/analytics/increment                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER                                                               │
│                                                                      │
│  POST /api/analytics/increment                                       │
│       ↓                                                              │
│  Validate batch (Zod schema)                                         │
│       ↓                                                              │
│  aggregate.upsert(metric, dimensions, count=1)                       │
│       ↓                                                              │
│  Database: INCREMENT analytics_aggregate.count                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ QUERY                                                                │
│                                                                      │
│  GET /api/analytics/aggregate?metric=...&start=...&end=...          │
│       ↓                                                              │
│  aggregate.query(params)                                             │
│       ↓                                                              │
│  coarsen.apply(results)              # Roll up small cohorts        │
│       ↓                                                              │
│  noise.laplace(counts, ε=1.0)        # Add calibrated noise         │
│       ↓                                                              │
│  Return noisy aggregates                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Specifications

| Document | Purpose |
|----------|---------|
| [aggregate.md](./aggregate.md) | Aggregation model, schema, upsert logic |
| [cohort.md](./cohort.md) | **DEPRECATED** - Cohort tokens removed |
| [noise.md](./noise.md) | Differential privacy math, k-ary RR |
| [coarsen.md](./coarsen.md) | Geographic hierarchy rollup |
| [migration.md](./migration.md) | Legacy system deprecation |
| [dp-hardening-guide.md](./dp-hardening-guide.md) | Expert implementation guidance |

---

## Quick Reference

### Allowed Metrics
```typescript
const METRICS = [
  'template_view', 'template_use', 'template_share',
  'delivery_attempt', 'delivery_success', 'delivery_fail',
  'auth_start', 'auth_complete',
  'error_network', 'error_validation', 'error_auth',
  'funnel_1', 'funnel_2', 'funnel_3', 'funnel_4', 'funnel_5'
] as const;
```

### Allowed Dimensions
```typescript
interface Dimensions {
  template_id?: string;        // Public template identifier
  jurisdiction?: string;       // State code only (2 chars)
  delivery_method?: 'cwc' | 'email' | 'certified';
  utm_source?: string;         // Sanitized, alphanumeric only
  cohort_token?: string;       // Random UUID (optional)
}
```

### Privacy Parameters
```typescript
const PRIVACY = {
  CLIENT_EPSILON: 2.0,         // k-ary RR (pTrue ≈ 28%, NOT 88%)
  SERVER_EPSILON: 1.0,         // Laplace noise level
  COARSEN_THRESHOLD: 5,        // Roll up counts below this
  MAX_QUERY_DAYS: 90,          // Prevent full-history extraction
  MAX_DAILY_CONTRIBUTIONS: 100 // Per-client rate limit (bounds sensitivity)
};

// k-ary RR math (domain size k=20):
// P(report true) = e^ε / (e^ε + k - 1) ≈ 0.28
// P(report other) = 1 / (e^ε + k - 1) ≈ 0.038
// Maximum likelihood ratio = e^ε ≈ 7.39 (tight ε-DP bound)
```

---

## What This Replaces

| Legacy | New |
|--------|-----|
| `analytics_session` table | Nothing (sessions don't exist) |
| `analytics_event` table | `analytics_aggregate` (counts only) |
| `DatabaseAnalytics` class | `client.ts` (increment only) |
| `FunnelAnalytics` class | `cohort.ts` + funnel metrics |
| `src/lib/types/analytics.ts` | `src/lib/types/analytics/*.ts` |

---

*Communique Analytics Architecture | 2026-01*
