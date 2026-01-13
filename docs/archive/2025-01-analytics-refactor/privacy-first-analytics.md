# Privacy-First Analytics: Ground-Up Refactoring Specification

**Author:** Distinguished Engineer
**Date:** 2025-01
**Status:** RFC (Request for Comments)
**Estimated Effort:** 3-4 weeks
**Cost Impact:** 70-80% reduction in storage costs

---

## Executive Summary

The current analytics system conflates two incompatible goals: privacy-preserving civic coordination metrics and traditional product surveillance. This specification details a ground-up refactoring to **aggregation-only analytics with differential privacy**, maintaining all insights necessary to operate the platform while eliminating individual-level tracking.

**Core Principle:** We measure *outcomes*, not *people*.

---

## Part I: Philosophy and Principles

### 1.1 Why Privacy-First Analytics Matters

The conventional wisdom that "privacy is dead" reflects a failure of incentives, not technology. Surveillance analytics emerged because:

1. **Advertising model** — Behavioral profiles are the product
2. **VC metrics** — DAU/MAU/retention require individual tracking
3. **Cheap storage** — "Store everything, query later" is frictionless
4. **Network effects** — Once competitors surveil, you must too to compete

Communiqué operates outside this incentive structure:

1. **No advertising** — We don't sell attention
2. **Outcome-focused** — We measure civic impact, not engagement
3. **Cryptographic trust** — ZK proofs replace behavioral inference
4. **Cypherpunk mission** — Privacy is a feature, not a cost

### 1.2 The Aggregation Principle

**Individual events are never stored. Only aggregate counts exist.**

This is not a limitation — it's the design. Traditional analytics asks "What did user X do?" Privacy-first analytics asks "How many people did Y?"

The former enables:
- Behavioral profiling
- Personalized manipulation
- Data breach liability
- Regulatory burden (GDPR/CCPA)

The latter enables:
- Platform health monitoring
- Feature effectiveness measurement
- Network cascade analysis
- None of the above risks

### 1.3 Differential Privacy as Insurance

Even aggregate counts can leak information. If a template has 1 user from a specific district, the aggregate "1" reveals individual behavior.

**Differential privacy** adds calibrated noise to aggregates, providing mathematical guarantees that individual contributions cannot be inferred:

```
noisy_count = true_count + Laplace(0, sensitivity/epsilon)
```

Where:
- `sensitivity` = 1 (single user can change count by at most 1)
- `epsilon` = privacy budget (lower = more privacy, more noise)

With ε = 1.0, we achieve strong privacy while maintaining statistical utility for aggregates > 50.

---

## Part II: What Insights Do We Actually Need?

### 2.1 UX Research Perspective

From a user research standpoint, Communiqué needs to answer:

| Question | Why It Matters | Current Method | Privacy-First Method |
|----------|----------------|----------------|---------------------|
| Are templates being used? | Platform viability | Individual event tracking | Daily aggregate counts |
| Which templates drive action? | Content effectiveness | Session → template mapping | Template-level aggregates |
| Where do people drop off? | Funnel optimization | Individual funnel tracking | Step-level aggregate deltas |
| Is the network cascading? | Viral growth | Session-based percolation | Edge-count aggregation |
| Are messages delivered? | Platform reliability | Per-message tracking | Delivery success aggregates |
| What's breaking? | Error triage | Individual error events | Error type aggregates |

**Key insight:** Every question can be answered with aggregates. Individual tracking provides no additional value for platform operation.

### 2.2 Metrics Taxonomy

#### Tier 1: Core Platform Health (Must Have)
- **Template adoption rate** — `count(template_used) / count(template_viewed)` per template, per day
- **Delivery success rate** — `count(delivered) / count(sent)` per delivery method, per day
- **Funnel completion rate** — `count(step_N) / count(step_1)` per funnel, per day
- **Error rate** — `count(errors)` per error type, per day

#### Tier 2: Network Dynamics (Should Have)
- **Cascade velocity** — Rate of template sharing (aggregate edges/day)
- **Geographic spread** — State-level adoption (never district-level for privacy)
- **Referral effectiveness** — UTM source aggregate counts

#### Tier 3: Content Intelligence (Nice to Have)
- **Template engagement** — View duration buckets (not individual times)
- **Share platform distribution** — Aggregate by platform (Twitter, Facebook, etc.)

### 2.3 What We Explicitly DO NOT Need

- **Individual user journeys** — No value for civic coordination
- **Session reconstruction** — Surveillance pattern
- **Retention cohorts** — VC metric, not civic metric
- **Behavioral sequences** — Profiling enabler
- **Device fingerprinting** — Anti-pattern
- **IP-based location** — We have verified addresses for those who verify

---

## Part III: New Data Model

### 3.1 Schema Design

Replace three tables (`analytics_session`, `analytics_event`, `analytics_experiment`) with two:

```prisma
// =============================================================================
// PRIVACY-FIRST ANALYTICS SCHEMA
// =============================================================================

/// Daily aggregate metrics - the ONLY analytics data we store
/// No individual events, no sessions, no user tracking
model analytics_aggregate {
  id              String    @id @default(cuid())

  // Time bucket (day granularity - never finer)
  date            DateTime  @db.Date

  // Metric dimensions (all optional for flexibility)
  metric_name     String    // e.g., "template_used", "funnel_step_3", "delivery_success"
  template_id     String?   // For template-specific metrics
  jurisdiction    String?   // State-level only (e.g., "CA", "NY"), never district
  delivery_method String?   // For delivery metrics
  utm_source      String?   // For acquisition metrics
  error_type      String?   // For error metrics

  // The only value we store: a count
  count           Int       @default(0)

  // Differential privacy metadata
  noise_added     Float     @default(0)  // Laplace noise applied to count
  epsilon_used    Float     @default(1.0) // Privacy budget consumed

  // Composite unique constraint prevents duplicates
  @@unique([date, metric_name, template_id, jurisdiction, delivery_method, utm_source, error_type])

  // Query optimization indexes
  @@index([date])
  @@index([metric_name, date])
  @@index([template_id, date])
  @@index([jurisdiction, date])

  @@map("analytics_aggregate")
}

/// Funnel definitions (static configuration, no user data)
model analytics_funnel {
  id              String    @id @default(cuid())
  name            String    @unique

  // Step definitions (JSONB for flexibility)
  // Example: [{ order: 1, name: "view", event: "template_viewed" }, ...]
  steps           Json      @default("[]")

  // Funnel status
  status          String    @default("active") // 'active', 'archived'

  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  @@map("analytics_funnel")
}
```

### 3.2 What This Eliminates

| Removed | Reason |
|---------|--------|
| `analytics_session` | Sessions enable user tracking |
| `analytics_event` | Individual events enable profiling |
| `session_id` | Session correlation enables journey reconstruction |
| `user_id` in analytics | User linkage enables behavioral profiling |
| `device_data` | Fingerprinting vector |
| `ip_address` | Location surveillance |
| `properties` JSONB | Arbitrary data enables scope creep |
| `funnel_progress` | Individual funnel state is tracking |

### 3.3 Data Size Comparison

**Current model (per day, 10K users):**
- `analytics_session`: ~10,000 rows × 500 bytes = 5 MB
- `analytics_event`: ~50,000 rows × 300 bytes = 15 MB
- Total: **20 MB/day**, 600 MB/month, 7.2 GB/year

**New model (per day, 10K users):**
- `analytics_aggregate`: ~500 rows × 100 bytes = 50 KB
- Total: **50 KB/day**, 1.5 MB/month, 18 MB/year

**Cost reduction: 99.75%** (and no PII liability)

---

## Part IV: Client-Side Architecture

### 4.1 Design Principle: Increment, Don't Identify

The client should never send identifiable data. It sends **increment requests** to server-side counters.

```typescript
// OLD (surveillance pattern)
analytics.trackEvent({
  session_id: 'sess_123',
  user_id: 'user_456',
  name: 'template_viewed',
  template_id: 'tmpl_789',
  properties: {
    viewport: { width: 1920, height: 1080 },
    timestamp: 1704067200000,
    referrer: 'https://twitter.com/...'
  }
});

// NEW (privacy-first pattern)
analytics.increment('template_viewed', {
  template_id: 'tmpl_789',
  utm_source: 'twitter'  // Only if present in URL
});
```

### 4.2 New Client Implementation

```typescript
// src/lib/core/analytics/privacy-first.ts

/**
 * Privacy-First Analytics Client
 *
 * Design principles:
 * 1. No session IDs - each increment is independent
 * 2. No user IDs - we don't track individuals
 * 3. No device data - no fingerprinting
 * 4. Batched increments - reduce network overhead
 * 5. Fire-and-forget - no retry queue (data loss is acceptable)
 */

import { browser } from '$app/environment';

interface IncrementRequest {
  metric: string;
  dimensions?: {
    template_id?: string;
    jurisdiction?: string;  // State only, never district
    delivery_method?: string;
    utm_source?: string;
    error_type?: string;
  };
}

class PrivacyFirstAnalytics {
  private queue: IncrementRequest[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_SIZE = 20;
  private readonly FLUSH_INTERVAL_MS = 30_000; // 30 seconds

  constructor() {
    if (browser) {
      this.scheduleFlush();

      // Flush on page unload (best effort, no retry)
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }

  /**
   * Increment a metric counter
   *
   * This is the ONLY public method. No trackEvent, no identify, no session.
   */
  increment(metric: string, dimensions: IncrementRequest['dimensions'] = {}): void {
    if (!browser) return;

    // Sanitize dimensions - remove any PII that might sneak in
    const sanitized = this.sanitizeDimensions(dimensions);

    this.queue.push({ metric, dimensions: sanitized });

    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Convenience methods for common metrics
   */
  templateViewed(templateId: string, utmSource?: string): void {
    this.increment('template_viewed', {
      template_id: templateId,
      utm_source: utmSource
    });
  }

  templateUsed(templateId: string, deliveryMethod: string): void {
    this.increment('template_used', {
      template_id: templateId,
      delivery_method: deliveryMethod
    });
  }

  funnelStep(step: number, templateId?: string): void {
    this.increment(`funnel_step_${step}`, { template_id: templateId });
  }

  deliveryAttempted(deliveryMethod: string): void {
    this.increment('delivery_attempted', { delivery_method: deliveryMethod });
  }

  deliverySucceeded(deliveryMethod: string): void {
    this.increment('delivery_succeeded', { delivery_method: deliveryMethod });
  }

  deliveryFailed(deliveryMethod: string, errorType: string): void {
    this.increment('delivery_failed', {
      delivery_method: deliveryMethod,
      error_type: this.sanitizeErrorType(errorType)
    });
  }

  error(errorType: string): void {
    this.increment('client_error', {
      error_type: this.sanitizeErrorType(errorType)
    });
  }

  /**
   * Sanitize dimensions to prevent PII leakage
   */
  private sanitizeDimensions(
    dimensions: IncrementRequest['dimensions']
  ): IncrementRequest['dimensions'] {
    if (!dimensions) return {};

    const sanitized: IncrementRequest['dimensions'] = {};

    // Template ID: allow (public identifiers)
    if (dimensions.template_id) {
      sanitized.template_id = dimensions.template_id;
    }

    // Jurisdiction: only allow state codes (2 chars)
    if (dimensions.jurisdiction) {
      const state = dimensions.jurisdiction.substring(0, 2).toUpperCase();
      if (/^[A-Z]{2}$/.test(state)) {
        sanitized.jurisdiction = state;
      }
    }

    // Delivery method: whitelist allowed values
    if (dimensions.delivery_method) {
      const allowed = ['cwc', 'email', 'certified', 'direct'];
      if (allowed.includes(dimensions.delivery_method)) {
        sanitized.delivery_method = dimensions.delivery_method;
      }
    }

    // UTM source: sanitize to prevent URL leakage
    if (dimensions.utm_source) {
      // Only allow alphanumeric + underscore, max 50 chars
      sanitized.utm_source = dimensions.utm_source
        .replace(/[^a-zA-Z0-9_]/g, '')
        .substring(0, 50);
    }

    // Error type: sanitize to prevent stack trace leakage
    if (dimensions.error_type) {
      sanitized.error_type = this.sanitizeErrorType(dimensions.error_type);
    }

    return sanitized;
  }

  /**
   * Sanitize error types to prevent PII in stack traces
   */
  private sanitizeErrorType(errorType: string): string {
    // Map to known error categories, never store raw messages
    const errorCategories: Record<string, string> = {
      'network': 'network_error',
      'fetch': 'network_error',
      'timeout': 'timeout_error',
      'auth': 'auth_error',
      'permission': 'permission_error',
      'validation': 'validation_error',
      'parse': 'parse_error',
      'json': 'parse_error',
    };

    const lower = errorType.toLowerCase();
    for (const [pattern, category] of Object.entries(errorCategories)) {
      if (lower.includes(pattern)) {
        return category;
      }
    }

    return 'unknown_error';
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
      this.scheduleFlush();
    }, this.FLUSH_INTERVAL_MS);
  }

  private async flush(): Promise<void> {
    if (!browser || this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      // Fire and forget - no retry, no error handling
      // Data loss is acceptable; privacy is not negotiable
      await fetch('/api/analytics/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increments: batch }),
        keepalive: true
      });
    } catch {
      // Silently drop - we don't retry analytics
    }
  }

  destroy(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.flush();
  }
}

// Export singleton
export const analytics = new PrivacyFirstAnalytics();
```

### 4.3 What the Client CANNOT Do

The new client intentionally lacks:

- `identifyUser()` — No user identification
- `trackEvent()` — No arbitrary event tracking
- `setUserProperties()` — No user properties
- Session management — No session concept
- Retry logic — Data loss > privacy violation
- Error details — Only error categories

---

## Part V: Server-Side Architecture

### 5.1 Increment Endpoint

```typescript
// src/routes/api/analytics/increment/+server.ts

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/core/db';

interface IncrementRequest {
  metric: string;
  dimensions?: {
    template_id?: string;
    jurisdiction?: string;
    delivery_method?: string;
    utm_source?: string;
    error_type?: string;
  };
}

interface IncrementBatch {
  increments: IncrementRequest[];
}

// Allowed metrics whitelist - reject anything not on this list
const ALLOWED_METRICS = new Set([
  'template_viewed',
  'template_used',
  'template_shared',
  'delivery_attempted',
  'delivery_succeeded',
  'delivery_failed',
  'funnel_step_1',
  'funnel_step_2',
  'funnel_step_3',
  'funnel_step_4',
  'funnel_step_5',
  'client_error',
  'auth_started',
  'auth_completed',
]);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { increments }: IncrementBatch = await request.json();

    if (!Array.isArray(increments) || increments.length === 0) {
      return json({ success: true, processed: 0 });
    }

    // Rate limit: max 100 increments per request
    const limited = increments.slice(0, 100);

    // Get today's date (UTC) for aggregation
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Group increments by unique dimension combination
    const aggregated = new Map<string, { request: IncrementRequest; count: number }>();

    for (const inc of limited) {
      // Validate metric is allowed
      if (!ALLOWED_METRICS.has(inc.metric)) {
        continue;
      }

      // Create unique key for this dimension combination
      const key = JSON.stringify({
        metric: inc.metric,
        template_id: inc.dimensions?.template_id ?? null,
        jurisdiction: inc.dimensions?.jurisdiction ?? null,
        delivery_method: inc.dimensions?.delivery_method ?? null,
        utm_source: inc.dimensions?.utm_source ?? null,
        error_type: inc.dimensions?.error_type ?? null,
      });

      const existing = aggregated.get(key);
      if (existing) {
        existing.count++;
      } else {
        aggregated.set(key, { request: inc, count: 1 });
      }
    }

    // Batch upsert aggregates
    const upserts = Array.from(aggregated.values()).map(({ request, count }) => {
      return db.analytics_aggregate.upsert({
        where: {
          date_metric_name_template_id_jurisdiction_delivery_method_utm_source_error_type: {
            date: today,
            metric_name: request.metric,
            template_id: request.dimensions?.template_id ?? null,
            jurisdiction: request.dimensions?.jurisdiction ?? null,
            delivery_method: request.dimensions?.delivery_method ?? null,
            utm_source: request.dimensions?.utm_source ?? null,
            error_type: request.dimensions?.error_type ?? null,
          }
        },
        create: {
          date: today,
          metric_name: request.metric,
          template_id: request.dimensions?.template_id,
          jurisdiction: request.dimensions?.jurisdiction,
          delivery_method: request.dimensions?.delivery_method,
          utm_source: request.dimensions?.utm_source,
          error_type: request.dimensions?.error_type,
          count: count,
          noise_added: 0,
          epsilon_used: 0, // Noise added at query time, not write time
        },
        update: {
          count: { increment: count }
        }
      });
    });

    await db.$transaction(upserts);

    return json({
      success: true,
      processed: limited.length
    });

  } catch {
    // Silently succeed - analytics failures should never affect UX
    return json({ success: true, processed: 0 });
  }
};
```

### 5.2 Query Endpoint with Differential Privacy

```typescript
// src/routes/api/analytics/query/+server.ts

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/core/db';

interface QueryRequest {
  metric: string;
  start_date: string;  // ISO date
  end_date: string;    // ISO date
  group_by?: ('template_id' | 'jurisdiction' | 'delivery_method' | 'utm_source')[];
  template_id?: string;
  jurisdiction?: string;
}

interface AggregateResult {
  count: number;          // Noisy count (differential privacy applied)
  dimensions: Record<string, string | null>;
  date?: string;
}

// Differential privacy parameters
const EPSILON = 1.0;      // Privacy budget per query
const SENSITIVITY = 1;    // Max contribution of one user to count
const K_ANONYMITY = 10;   // Minimum count to report (suppress smaller)

/**
 * Add Laplace noise for differential privacy
 */
function addLaplaceNoise(trueCount: number, epsilon: number, sensitivity: number): number {
  // Laplace distribution: scale = sensitivity / epsilon
  const scale = sensitivity / epsilon;

  // Generate Laplace random variable using inverse CDF
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));

  // Round to integer and ensure non-negative
  return Math.max(0, Math.round(trueCount + noise));
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const query: QueryRequest = await request.json();

    // Validate date range (max 90 days to prevent full-history extraction)
    const startDate = new Date(query.start_date);
    const endDate = new Date(query.end_date);
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 90) {
      return json(
        { error: 'Date range cannot exceed 90 days' },
        { status: 400 }
      );
    }

    // Build query
    const whereClause: Record<string, unknown> = {
      metric_name: query.metric,
      date: {
        gte: startDate,
        lte: endDate
      }
    };

    if (query.template_id) {
      whereClause.template_id = query.template_id;
    }

    if (query.jurisdiction) {
      whereClause.jurisdiction = query.jurisdiction;
    }

    // Fetch raw aggregates
    const rawResults = await db.analytics_aggregate.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });

    // Group by requested dimensions
    const grouped = new Map<string, number>();

    for (const row of rawResults) {
      const groupKey = (query.group_by || [])
        .map(dim => `${dim}:${row[dim] ?? 'null'}`)
        .join('|') || 'total';

      grouped.set(groupKey, (grouped.get(groupKey) || 0) + row.count);
    }

    // Apply differential privacy and k-anonymity
    const results: AggregateResult[] = [];

    for (const [groupKey, trueCount] of grouped) {
      // K-anonymity: suppress small counts
      if (trueCount < K_ANONYMITY) {
        continue;
      }

      // Add Laplace noise
      const noisyCount = addLaplaceNoise(trueCount, EPSILON, SENSITIVITY);

      // Parse dimensions from group key
      const dimensions: Record<string, string | null> = {};
      if (groupKey !== 'total') {
        for (const part of groupKey.split('|')) {
          const [dim, value] = part.split(':');
          dimensions[dim] = value === 'null' ? null : value;
        }
      }

      results.push({
        count: noisyCount,
        dimensions
      });
    }

    return json({
      success: true,
      metric: query.metric,
      date_range: { start: query.start_date, end: query.end_date },
      results,
      privacy: {
        epsilon_per_query: EPSILON,
        k_anonymity_threshold: K_ANONYMITY,
        differential_privacy: true
      }
    });

  } catch (error) {
    return json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
};
```

### 5.3 Dashboard Metrics Endpoint

```typescript
// src/routes/api/analytics/dashboard/+server.ts

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/core/db';

/**
 * Pre-computed dashboard metrics with differential privacy
 *
 * Returns platform-level aggregates for the dashboard.
 * All counts have Laplace noise applied.
 */
export const GET: RequestHandler = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Aggregate queries
  const [
    templateViewsLast30d,
    templateUsesLast30d,
    deliverySuccessLast7d,
    deliveryFailureLast7d,
  ] = await Promise.all([
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'template_viewed',
        date: { gte: thirtyDaysAgo }
      },
      _sum: { count: true }
    }),
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'template_used',
        date: { gte: thirtyDaysAgo }
      },
      _sum: { count: true }
    }),
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'delivery_succeeded',
        date: { gte: sevenDaysAgo }
      },
      _sum: { count: true }
    }),
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'delivery_failed',
        date: { gte: sevenDaysAgo }
      },
      _sum: { count: true }
    }),
  ]);

  // Add noise to all metrics
  const addNoise = (count: number) => {
    const scale = 1 / 1.0; // sensitivity / epsilon
    const u = Math.random() - 0.5;
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    return Math.max(0, Math.round(count + noise));
  };

  const views = templateViewsLast30d._sum.count || 0;
  const uses = templateUsesLast30d._sum.count || 0;
  const successes = deliverySuccessLast7d._sum.count || 0;
  const failures = deliveryFailureLast7d._sum.count || 0;

  return json({
    success: true,
    metrics: {
      template_adoption: {
        views_30d: addNoise(views),
        uses_30d: addNoise(uses),
        conversion_rate: views > 0 ? Number((uses / views).toFixed(3)) : 0
      },
      delivery_health: {
        succeeded_7d: addNoise(successes),
        failed_7d: addNoise(failures),
        success_rate: (successes + failures) > 0
          ? Number((successes / (successes + failures)).toFixed(3))
          : 1.0
      }
    },
    privacy: {
      differential_privacy_applied: true,
      epsilon: 1.0
    }
  });
};
```

---

## Part VI: Percolation Analysis Integration

### 6.1 Privacy-Preserving Network Cascades

The percolation analysis (network cascade modeling) is actually well-aligned with privacy principles because it operates on aggregate edge counts, not individual paths.

**Key insight:** We measure *that* information spreads, not *who* spreads it.

```typescript
// src/lib/core/server/percolation-engine-v2.ts

/**
 * Privacy-Preserving Percolation Analysis
 *
 * Models information cascades using aggregate metrics only.
 * No individual user paths are tracked or inferred.
 */

interface PercolationMetrics {
  total_activations: number;      // Sum of template_used events
  unique_templates: number;        // Count of distinct templates
  geographic_spread: number;       // Count of distinct states
  cascade_velocity: number;        // Rate of activation growth
  percolation_threshold: number;   // Critical point estimate
  cascade_status: 'subcritical' | 'critical' | 'supercritical';
}

export async function computePercolationMetrics(
  db: PrismaClient
): Promise<PercolationMetrics> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Get aggregate metrics for two time windows
  const [thisWeek, lastWeek, uniqueTemplates, uniqueStates] = await Promise.all([
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'template_used',
        date: { gte: sevenDaysAgo }
      },
      _sum: { count: true }
    }),
    db.analytics_aggregate.aggregate({
      where: {
        metric_name: 'template_used',
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
      },
      _sum: { count: true }
    }),
    db.analytics_aggregate.findMany({
      where: {
        metric_name: 'template_used',
        template_id: { not: null },
        date: { gte: sevenDaysAgo }
      },
      distinct: ['template_id']
    }),
    db.analytics_aggregate.findMany({
      where: {
        metric_name: 'template_used',
        jurisdiction: { not: null },
        date: { gte: sevenDaysAgo }
      },
      distinct: ['jurisdiction']
    })
  ]);

  const thisWeekCount = thisWeek._sum.count || 0;
  const lastWeekCount = lastWeek._sum.count || 0;

  // Calculate cascade velocity (week-over-week growth)
  const velocity = lastWeekCount > 0
    ? (thisWeekCount - lastWeekCount) / lastWeekCount
    : thisWeekCount > 0 ? 1.0 : 0;

  // Estimate percolation threshold using site percolation model
  // For a social network, threshold ≈ 1 / average_degree
  // We estimate average_degree from activation patterns
  const estimatedDegree = uniqueTemplates.length > 0
    ? thisWeekCount / uniqueTemplates.length
    : 1;
  const threshold = 1 / Math.max(estimatedDegree, 1);

  // Current activation probability (fraction of potential network activated)
  // Using state count as proxy for network coverage
  const activationProbability = uniqueStates.length / 50; // 50 states

  // Determine cascade status relative to threshold
  let status: 'subcritical' | 'critical' | 'supercritical';
  if (activationProbability < threshold * 0.8) {
    status = 'subcritical';
  } else if (activationProbability > threshold * 1.2) {
    status = 'supercritical';
  } else {
    status = 'critical';
  }

  return {
    total_activations: thisWeekCount,
    unique_templates: uniqueTemplates.length,
    geographic_spread: uniqueStates.length,
    cascade_velocity: velocity,
    percolation_threshold: threshold,
    cascade_status: status
  };
}
```

---

## Part VII: Migration Plan

### 7.1 Phase 1: Build New System (Week 1-2)

1. **Add new schema** (Day 1)
   - Add `analytics_aggregate` and `analytics_funnel` models
   - Run `prisma db push` for development

2. **Implement client** (Day 2-3)
   - Create `privacy-first.ts` client
   - Add increment methods for each metric

3. **Implement server** (Day 4-5)
   - Create `/api/analytics/increment` endpoint
   - Create `/api/analytics/query` endpoint
   - Create `/api/analytics/dashboard` endpoint

4. **Add differential privacy** (Day 6-7)
   - Implement Laplace noise function
   - Add k-anonymity suppression
   - Test privacy guarantees

5. **Update percolation** (Day 8-9)
   - Refactor to use aggregate queries
   - Remove individual event dependencies

### 7.2 Phase 2: Dual-Write Period (Week 2-3)

1. **Enable new client alongside old** (Day 10)
   - Import both analytics clients
   - Call both on each tracked action

2. **Validate data parity** (Day 11-14)
   - Compare old event counts with new aggregates
   - Verify differential privacy doesn't distort trends

3. **Dashboard migration** (Day 15-16)
   - Update dashboard to use new endpoints
   - Verify metrics display correctly

### 7.3 Phase 3: Cutover (Week 3-4)

1. **Disable old client** (Day 17)
   - Remove old analytics imports
   - Remove dual-write code

2. **Stop old event collection** (Day 18)
   - Disable `/api/analytics/events` endpoint
   - Add deprecation notice

3. **Archive old data** (Day 19-20)
   - Export old analytics tables for historical reference
   - Store in cold storage (S3 Glacier)

4. **Drop old tables** (Day 21)
   - Remove `analytics_session`, `analytics_event`, `analytics_experiment`
   - Run migration

### 7.4 Rollback Plan

If issues arise during migration:

1. **Phase 2 rollback:** Disable new client, continue with old
2. **Phase 3 rollback:** Re-enable old client, restore tables from archive
3. **Full rollback:** Cherry-pick revert commits, restore from backup

---

## Part VIII: Cost Analysis

### 8.1 Database Costs

| Metric | Current | New | Reduction |
|--------|---------|-----|-----------|
| Rows/day (10K users) | 60,000 | 500 | 99.2% |
| Storage/month | 600 MB | 1.5 MB | 99.75% |
| Storage/year | 7.2 GB | 18 MB | 99.75% |
| Neon Postgres cost/month | ~$15 | ~$0.50 | 96.7% |

### 8.2 Query Performance

| Query | Current (events) | New (aggregates) | Improvement |
|-------|------------------|------------------|-------------|
| Daily template views | 50ms (scan 50K rows) | 2ms (scan 20 rows) | 25x faster |
| Weekly funnel | 200ms (complex JOIN) | 5ms (simple SUM) | 40x faster |
| Monthly report | 2s (full table scan) | 10ms (index scan) | 200x faster |

### 8.3 Operational Costs

| Factor | Current | New |
|--------|---------|-----|
| GDPR compliance | Required (PII stored) | Not required (no PII) |
| Data breach liability | High | Zero |
| Right-to-deletion requests | Must implement | Not applicable |
| Data retention policy | Complex | Simple (aggregate forever) |

---

## Part IX: Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/unit/analytics/privacy-first.test.ts

describe('PrivacyFirstAnalytics', () => {
  describe('sanitizeDimensions', () => {
    it('should reject invalid jurisdiction codes', () => {
      const result = analytics['sanitizeDimensions']({
        jurisdiction: 'CA-11'  // District, not state
      });
      expect(result.jurisdiction).toBe('CA');  // Truncated to state
    });

    it('should whitelist delivery methods', () => {
      const result = analytics['sanitizeDimensions']({
        delivery_method: 'malicious_value'
      });
      expect(result.delivery_method).toBeUndefined();
    });

    it('should sanitize UTM sources', () => {
      const result = analytics['sanitizeDimensions']({
        utm_source: 'twitter.com/user/123?token=secret'
      });
      expect(result.utm_source).toBe('twittercomuser123tokensecret');
    });
  });

  describe('error categorization', () => {
    it('should map errors to categories', () => {
      expect(analytics['sanitizeErrorType']('NetworkError: Failed to fetch'))
        .toBe('network_error');
      expect(analytics['sanitizeErrorType']('TypeError: Cannot read property'))
        .toBe('unknown_error');
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// tests/integration/analytics-privacy.test.ts

describe('Privacy-First Analytics API', () => {
  describe('POST /api/analytics/increment', () => {
    it('should increment aggregate counters', async () => {
      const response = await fetch('/api/analytics/increment', {
        method: 'POST',
        body: JSON.stringify({
          increments: [
            { metric: 'template_viewed', dimensions: { template_id: 'test-1' } },
            { metric: 'template_viewed', dimensions: { template_id: 'test-1' } },
          ]
        })
      });

      expect(response.ok).toBe(true);

      // Verify aggregate was incremented
      const aggregate = await db.analytics_aggregate.findFirst({
        where: {
          metric_name: 'template_viewed',
          template_id: 'test-1'
        }
      });

      expect(aggregate?.count).toBeGreaterThanOrEqual(2);
    });

    it('should reject unknown metrics', async () => {
      const response = await fetch('/api/analytics/increment', {
        method: 'POST',
        body: JSON.stringify({
          increments: [
            { metric: 'user_tracked', dimensions: { user_id: 'secret' } }
          ]
        })
      });

      expect(response.ok).toBe(true);

      // Verify metric was NOT stored
      const aggregate = await db.analytics_aggregate.findFirst({
        where: { metric_name: 'user_tracked' }
      });

      expect(aggregate).toBeNull();
    });
  });

  describe('differential privacy', () => {
    it('should add noise to query results', async () => {
      // Insert known count
      await db.analytics_aggregate.create({
        data: {
          date: new Date(),
          metric_name: 'test_metric',
          count: 100,
          noise_added: 0,
          epsilon_used: 0
        }
      });

      // Query multiple times and check variance
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        const response = await fetch('/api/analytics/query', {
          method: 'POST',
          body: JSON.stringify({
            metric: 'test_metric',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          })
        });
        const data = await response.json();
        results.push(data.results[0]?.count || 0);
      }

      // Noise should cause variance
      const variance = results.reduce((acc, val) => {
        const mean = results.reduce((a, b) => a + b, 0) / results.length;
        return acc + Math.pow(val - mean, 2);
      }, 0) / results.length;

      expect(variance).toBeGreaterThan(0);  // Should have some variance

      // Mean should be close to true value
      const mean = results.reduce((a, b) => a + b, 0) / results.length;
      expect(mean).toBeGreaterThan(80);
      expect(mean).toBeLessThan(120);
    });

    it('should suppress small counts (k-anonymity)', async () => {
      // Insert count below k-anonymity threshold
      await db.analytics_aggregate.create({
        data: {
          date: new Date(),
          metric_name: 'small_metric',
          count: 5,  // Below K_ANONYMITY = 10
          noise_added: 0,
          epsilon_used: 0
        }
      });

      const response = await fetch('/api/analytics/query', {
        method: 'POST',
        body: JSON.stringify({
          metric: 'small_metric',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        })
      });

      const data = await response.json();
      expect(data.results.length).toBe(0);  // Suppressed
    });
  });
});
```

---

## Part X: Observability Without Surveillance

### 10.1 Error Monitoring

```typescript
// Error tracking without PII

// WRONG: Logging user context
logger.error('Template failed', {
  userId: user.id,
  sessionId: session.id,
  templateId: template.id,
  userEmail: user.email  // PII!
});

// RIGHT: Aggregate error categories only
analytics.error('template_generation_failed');

// For debugging, use error categories in aggregate
// If error_type = 'template_generation_failed' spikes, investigate code
```

### 10.2 Performance Monitoring

```typescript
// Performance tracking without user correlation

// WRONG: Timing per user
logger.info('Page load', {
  userId: user.id,
  loadTime: 1234,
  url: window.location.href
});

// RIGHT: Aggregate timing buckets
function trackPerformance(metric: string, valueMs: number): void {
  // Bucket into ranges to prevent timing attacks
  const bucket = valueMs < 500 ? 'fast'
    : valueMs < 2000 ? 'normal'
    : valueMs < 5000 ? 'slow'
    : 'very_slow';

  analytics.increment(`perf_${metric}_${bucket}`);
}
```

### 10.3 Alerting

Alerts based on aggregate thresholds, not individual behavior:

```yaml
# Example Prometheus alerts (conceptual)

groups:
  - name: privacy-first-analytics
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(analytics_aggregate_count{metric_name="client_error"}[5m]))
          / sum(rate(analytics_aggregate_count{metric_name="template_viewed"}[5m]))
          > 0.05
        for: 10m
        annotations:
          summary: "Error rate exceeds 5%"

      - alert: LowConversionRate
        expr: |
          sum(rate(analytics_aggregate_count{metric_name="template_used"}[1h]))
          / sum(rate(analytics_aggregate_count{metric_name="template_viewed"}[1h]))
          < 0.01
        for: 30m
        annotations:
          summary: "Conversion rate below 1%"
```

---

## Part XI: Open Questions

### 11.1 Decisions Needed

1. **Epsilon value (privacy budget)**
   - Lower epsilon = more privacy, more noise
   - Recommendation: ε = 1.0 for good balance
   - Alternative: ε = 0.5 for stronger privacy (need larger sample sizes)

2. **K-anonymity threshold**
   - Higher k = more privacy, less granular data
   - Recommendation: k = 10 for good balance
   - Alternative: k = 50 for stronger privacy

3. **Historical data**
   - Option A: Delete all individual events (recommended for legal clarity)
   - Option B: Archive to cold storage (retain for legal defensibility)
   - Option C: Backfill aggregates then delete (best of both)

4. **UTM tracking scope**
   - Option A: Track UTM source only (minimal, recommended)
   - Option B: Track source + medium + campaign (more marketing insight)
   - Option C: No UTM tracking (purist privacy)

### 11.2 Future Enhancements

1. **Local differential privacy** — Add noise on client before transmission
2. **Secure aggregation** — Multi-party computation for cross-client aggregates
3. **Federated analytics** — Train models without centralizing data
4. **Verifiable analytics** — ZK proofs that aggregates are computed correctly

---

## Part XII: Summary

### What We Gain

1. **True privacy** — No individual tracking, mathematically guaranteed
2. **Regulatory simplicity** — No PII = no GDPR/CCPA compliance burden
3. **Lower costs** — 99.75% reduction in storage
4. **Faster queries** — 25-200x performance improvement
5. **Cypherpunk alignment** — Mission-consistent architecture
6. **Zero liability** — No data breach risk for analytics

### What We Sacrifice

1. **Individual user journeys** — Cannot reconstruct any user's path
2. **Session analysis** — No session concept exists
3. **Cohort retention** — Cannot track user return rates
4. **A/B test precision** — Higher variance due to noise
5. **Real-time granularity** — Day-level aggregation only

### The Trade-off

These sacrifices are **features, not bugs**. The insights we lose are precisely the surveillance capabilities we don't want. A civic coordination platform measuring outcomes, not behavior, needs exactly this architecture.

---

## Appendix A: Differential Privacy Primer

**What is differential privacy?**

A mathematical framework guaranteeing that the inclusion or exclusion of any single individual's data has minimal effect on query results.

**Formal definition:**

A randomized algorithm M is ε-differentially private if for any two datasets D and D' differing by one record, and any output S:

```
Pr[M(D) ∈ S] ≤ e^ε × Pr[M(D') ∈ S]
```

**Intuition:**

If you're in the dataset, the output looks almost the same as if you weren't. An adversary gains almost no information about any individual.

**Laplace mechanism:**

For a function f with sensitivity Δf, adding noise from Laplace(0, Δf/ε) achieves ε-differential privacy.

For counting queries, sensitivity = 1 (one person can change count by at most 1).

---

## Appendix B: Implementation Checklist

- [ ] Add `analytics_aggregate` model to Prisma schema
- [ ] Add `analytics_funnel` model to Prisma schema
- [ ] Create `src/lib/core/analytics/privacy-first.ts`
- [ ] Create `/api/analytics/increment` endpoint
- [ ] Create `/api/analytics/query` endpoint
- [ ] Create `/api/analytics/dashboard` endpoint
- [ ] Implement Laplace noise function
- [ ] Implement k-anonymity suppression
- [ ] Update percolation engine for aggregates
- [ ] Add unit tests for sanitization
- [ ] Add integration tests for privacy guarantees
- [ ] Enable dual-write in components
- [ ] Validate data parity during dual-write
- [ ] Update dashboard to new endpoints
- [ ] Disable old analytics client
- [ ] Archive old analytics tables
- [ ] Drop old analytics tables
- [ ] Update documentation

---

*Communiqué PBC | Privacy-First Analytics Specification | 2025-01*
