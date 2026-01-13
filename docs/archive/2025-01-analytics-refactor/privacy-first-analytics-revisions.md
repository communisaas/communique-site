# Privacy-First Analytics: Surgical Revisions

**Date:** 2025-01-10
**Status:** PROPOSED AMENDMENT to privacy-first-analytics.md
**Rationale:** Original spec's k-anonymity suppression and cohort rejection harms small communities

---

## The Problem With Our Original Approach

The original spec made two problematic assumptions:

1. **K-anonymity suppression (k=10)** — Counts below 10 are hidden entirely
2. **"Retention is a VC metric"** — Cohort analysis was rejected wholesale

Both harm exactly the communities we're building for:
- Rural districts with 3 coordinating voices get silenced
- We can't measure if movements sustain or fizzle
- Small-scale but impactful coordination becomes invisible

**Three messages in a small community can change a school board vote.** Our analytics would say nothing happened.

---

## Revision 1: Geographic Coarsening Instead of Suppression

### Original (Section 5.2, line 699-703)
```typescript
const K_ANONYMITY = 10;

// K-anonymity: suppress small counts
if (count < K_ANONYMITY) {
  return null; // Hidden
}
```

### Revised
```typescript
const K_THRESHOLD = 5;

interface JurisdictionHierarchy {
  district: string;      // CA-02
  county: string;        // Humboldt County
  region: string;        // Northern California
  state: string;         // CA
  national: string;      // US
}

/**
 * Coarsen jurisdiction until count threshold is met
 * NEVER suppress entirely — roll up to larger region
 */
function coarsenToThreshold(
  count: number,
  jurisdiction: JurisdictionHierarchy
): { level: keyof JurisdictionHierarchy; value: string; aggregateCount: number } {
  // Start at finest granularity, roll up until threshold met
  const levels: (keyof JurisdictionHierarchy)[] = ['district', 'county', 'region', 'state', 'national'];

  for (const level of levels) {
    const aggregateCount = getAggregateAtLevel(level, jurisdiction[level]);
    if (aggregateCount >= K_THRESHOLD) {
      return { level, value: jurisdiction[level], aggregateCount };
    }
  }

  // National level always meets threshold
  return { level: 'national', value: 'US', aggregateCount: getNationalCount() };
}
```

### What This Changes

| Scenario | Original | Revised |
|----------|----------|---------|
| 3 actions in CA-02 | Suppressed (invisible) | "12 in Northern California" |
| 1 action in rural Wyoming | Suppressed | "847 in the West" |
| 50 actions in NYC | "50 in NY-10" | "50 in NY-10" (unchanged) |

**Small communities are contextualized, not silenced.**

---

## Revision 2: Privacy-Preserving Cohort Analysis

### Original (Section 2.3, line 111)
```markdown
What We Explicitly DO NOT Need:
- **Retention cohorts** — VC metric, not civic metric
```

### Revised

```markdown
### 2.4 Privacy-Preserving Cohort Analysis (NEW SECTION)

Retention metrics matter for civic coordination when they measure:
- Do movements sustain or fizzle after initial action?
- Are templates driving one-time use or ongoing engagement?
- Is coordinated action building or stalling?

#### Mechanism: Random Cohort Tokens

**How it works:**

1. **First action**: Client generates cryptographically random `cohort_token`
   ```typescript
   const cohortToken = crypto.randomUUID();
   // Not derived from user identity, device, or any PII
   ```

2. **Storage**: Token stored in localStorage with 30-day TTL
   ```typescript
   localStorage.setItem('cohort', JSON.stringify({
     token: cohortToken,
     firstSeen: Date.now(),
     expires: Date.now() + 30 * 24 * 60 * 60 * 1000
   }));
   ```

3. **Subsequent actions**: Token included in increments
   ```typescript
   analytics.increment('template_used', {
     template_id: 'xxx',
     cohort_token: getCohortToken() // Random UUID, not user ID
   });
   ```

4. **Server aggregation**: Cohort-level retention, never individual
   ```sql
   -- "Of cohort tokens first seen in Week 1, what % appeared in Week 2?"
   SELECT
     DATE_TRUNC('week', first_seen) as cohort_week,
     COUNT(DISTINCT token) as week_1_tokens,
     COUNT(DISTINCT CASE WHEN had_week_2_action THEN token END) as retained
   FROM cohort_actions
   GROUP BY cohort_week;
   ```

#### Privacy Properties

| Property | Guarantee |
|----------|-----------|
| Token derivation | Random UUID, not from identity |
| User linkage | Impossible — no user_id connection |
| Cross-device | Different token per device |
| Opt-out | Clear localStorage = new cohort |
| Subpoena | Tokens don't map to humans |
| Behavioral profile | Only aggregate retention curves |

#### What We Get

- **Cohort retention curves**: Week 1 → Week 2 → Week 3 retention
- **Template stickiness**: Which templates drive repeat engagement
- **Movement health**: Is coordination growing or stalling

#### What We Don't Get (and don't want)

- Individual user return patterns
- Cross-session behavioral sequences
- User-level engagement profiles
- Any way to ask "what did user X do over time"
```

### Schema Addition

```prisma
/// Cohort-level retention tracking (privacy-preserving)
/// Stores only aggregate cohort metrics, never individual tokens
model analytics_cohort {
  id              String    @id @default(cuid())

  // Cohort identification (weekly cohorts)
  cohort_week     DateTime  @db.Date  // Week the cohort first appeared

  // Retention metrics (aggregates only)
  initial_size    Int       // Tokens first seen in this week
  week_1_retained Int       // Tokens seen in week 1 after
  week_2_retained Int       // Tokens seen in week 2 after
  week_3_retained Int       // Tokens seen in week 3 after
  week_4_retained Int       // Tokens seen in week 4 after

  // Differential privacy metadata
  noise_added     Float     @default(0)
  epsilon_used    Float     @default(1.0)

  @@unique([cohort_week])
  @@map("analytics_cohort")
}
```

---

## Revision 3: Local Differential Privacy (Client-Side)

### Original
All differential privacy applied server-side after aggregation.

### Revised

Add **randomized response** at the client for plausible deniability:

```typescript
/**
 * Local Differential Privacy: Randomized Response
 *
 * Even if traffic is intercepted, the observer cannot be certain
 * the action actually happened. Provides plausible deniability.
 *
 * With epsilon=2.0:
 * - True action reported truthfully: 88% of the time
 * - Random noise: 12% of the time
 *
 * Server-side math compensates for known noise rate.
 */
function localDifferentialPrivacy(
  action: IncrementRequest,
  epsilon: number = 2.0
): IncrementRequest | null {
  // Probability of reporting truthfully
  const p = Math.exp(epsilon) / (1 + Math.exp(epsilon)); // ~0.88 for epsilon=2

  if (Math.random() < p) {
    return action; // Report truthfully
  }

  // Randomize: either report a random action or nothing
  if (Math.random() < 0.5) {
    return null; // Don't report this action
  }

  // Report a random allowed metric
  return {
    metric: ALLOWED_METRICS[Math.floor(Math.random() * ALLOWED_METRICS.length)],
    dimensions: {}
  };
}
```

### Server-Side Compensation

```typescript
/**
 * Correct for known LDP noise rate when computing true aggregates
 */
function correctForLDPNoise(reportedCount: number, epsilon: number): number {
  const p = Math.exp(epsilon) / (1 + Math.exp(epsilon));
  const q = (1 - p) / 2; // Probability of random report

  // Inverse estimation
  return (reportedCount - q * totalReports) / (p - q);
}
```

### Why This Matters

**Before**: Server knows with certainty what action you took
**After**: Server can only estimate action with known uncertainty

Even under subpoena, we can truthfully say: "Any individual increment request has only 88% probability of representing an actual action."

---

## Revision 4: TEE-Mediated Aggregation Path (Architecture)

### Original
```
Browser → API → Database (stores aggregates)
```

### Revised
```
Browser (LDP noise) → Nitro Enclave → Database (only aggregates)
                           ↓
                    [individual events exist
                     only in enclave memory,
                     never written to disk]
```

Since we already have AWS Nitro Enclaves for ZK proofs, extend their use:

```typescript
/**
 * Analytics aggregation within Nitro Enclave
 *
 * Properties:
 * - Individual events exist only in enclave memory
 * - Enclave is attestable (provably running this code)
 * - No disk writes for individual events
 * - Only daily aggregates exit the enclave
 */
class EnclaveAnalyticsAggregator {
  private pendingIncrements: Map<string, number> = new Map();
  private flushInterval: NodeJS.Timer;

  constructor() {
    // Flush aggregates to database every hour
    this.flushInterval = setInterval(() => this.flush(), 60 * 60 * 1000);
  }

  /**
   * Receive increment (runs inside enclave)
   * Individual events never leave enclave memory
   */
  increment(request: IncrementRequest): void {
    const key = this.dimensionKey(request);
    this.pendingIncrements.set(key, (this.pendingIncrements.get(key) || 0) + 1);
  }

  /**
   * Flush aggregates to database (only operation that exits enclave)
   */
  private async flush(): Promise<void> {
    const aggregates = Array.from(this.pendingIncrements.entries()).map(([key, count]) => ({
      ...this.parseKey(key),
      count,
      date: new Date().toISOString().split('T')[0]
    }));

    // This is the ONLY data that leaves the enclave
    await this.writeAggregatesToDatabase(aggregates);

    this.pendingIncrements.clear();
  }
}
```

### Attestation Properties

1. **Provable code execution**: Nitro attestation proves this exact code runs
2. **Memory isolation**: Individual events inaccessible outside enclave
3. **No disk writes**: Events exist only in volatile memory
4. **Audit trail**: Attestation documents available for compliance

---

## Revised Type Definitions

### Add to analytics-privacy.ts

```typescript
// =============================================================================
// COHORT TOKEN TYPES (NEW)
// =============================================================================

/**
 * Cohort token for privacy-preserving retention tracking
 *
 * CRITICAL: This is NOT a user identifier. Properties:
 * - Randomly generated (not derived from identity)
 * - Browser-local (different per device)
 * - Time-limited (30-day TTL)
 * - User-clearable (opt-out by clearing localStorage)
 */
export interface CohortToken {
  /** Random UUID, not derived from any PII */
  token: string;
  /** When this cohort was first created */
  firstSeen: number;
  /** When this token expires (30 days) */
  expires: number;
}

/**
 * Cohort retention query result
 */
export interface CohortRetentionResult {
  /** Week cohort first appeared */
  cohort_week: string;
  /** Initial cohort size (noisy) */
  initial_size: number;
  /** Retention rates by week (all noisy) */
  retention: {
    week_1: number;
    week_2: number;
    week_3: number;
    week_4: number;
  };
  /** Privacy metadata */
  privacy: {
    epsilon: number;
    differential_privacy: true;
  };
}

// =============================================================================
// JURISDICTION HIERARCHY (NEW)
// =============================================================================

/**
 * Jurisdiction hierarchy for geographic coarsening
 *
 * Used when counts are below threshold to roll up
 * to larger regions instead of suppressing.
 */
export interface JurisdictionHierarchy {
  district?: string;     // CA-02
  county?: string;       // Humboldt County
  region?: string;       // Northern California
  state: string;         // CA (always present)
  national: string;      // US (always "US")
}

/**
 * Coarsened jurisdiction result
 */
export interface CoarsenedResult {
  /** The level at which threshold was met */
  level: keyof JurisdictionHierarchy;
  /** The value at that level */
  value: string;
  /** Aggregate count at that level (noisy) */
  count: number;
}

// =============================================================================
// LOCAL DIFFERENTIAL PRIVACY CONFIG (NEW)
// =============================================================================

export const LDP_CONFIG = {
  /** Epsilon for local differential privacy (client-side) */
  CLIENT_EPSILON: 2.0,
  /** Whether LDP is enabled */
  ENABLED: true,
  /** Probability of truthful reporting at epsilon=2.0 */
  TRUTH_PROBABILITY: 0.88, // exp(2)/(1+exp(2))
} as const;
```

---

## Updated Roadmap Tasks

### Wave 2 Additions
- [ ] Add `CohortToken` interface to analytics-privacy.ts
- [ ] Implement `getOrCreateCohortToken()` in privacy-first.ts
- [ ] Add cohort_token to increment dimensions

### Wave 3 Additions
- [ ] Add `/api/analytics/cohort` endpoint for retention queries
- [ ] Implement geographic coarsening logic
- [ ] Add LDP correction math to server

### New Wave (Wave 2.5): TEE Aggregation Path
- [ ] Extend Nitro Enclave infrastructure for analytics
- [ ] Implement in-enclave aggregation
- [ ] Add attestation documentation

---

## Decision Matrix

| Feature | Privacy Cost | Utility Gain | Recommendation |
|---------|--------------|--------------|----------------|
| Geographic coarsening | Low (still aggregate) | High (small communities visible) | **IMPLEMENT** |
| Cohort tokens | Low (random, time-limited) | High (retention curves) | **IMPLEMENT** |
| Local DP | None (adds privacy) | Medium (plausible deniability) | **IMPLEMENT** |
| TEE aggregation | None (adds privacy) | High (attestable architecture) | **IMPLEMENT (Phase 2)** |

---

## Migration Notes

These revisions are **additive** — they extend the original spec without invalidating work done in Wave 1 and Wave 2.

- Schema: Add `analytics_cohort` table (does not affect `analytics_aggregate`)
- Types: Add new interfaces (does not affect existing types)
- Client: Add cohort token handling (extends existing increment)
- Server: Add coarsening logic (replaces suppression)

---

*Amendment to privacy-first-analytics.md | 2025-01-10*
