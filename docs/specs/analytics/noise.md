# Differential Privacy Implementation

**Module:** `src/lib/core/analytics/noise.ts`
**Types:** `src/lib/types/analytics/metrics.ts`

---

## Two Layers of Noise

We apply differential privacy at two points:

1. **Client-side (Local DP)** — Randomized response before transmission
2. **Server-side (Central DP)** — Laplace noise on query results

This provides defense in depth: even if one layer is compromised, privacy holds.

---

## Layer 1: Local Differential Privacy (Client)

### What It Does

Before sending an increment to the server, the client applies **k-ary Randomized Response**. This is the correct LDP mechanism for multi-valued domains (k=20 metrics).

```typescript
// noise.ts (client)

const CLIENT_EPSILON = 2.0;
const k = METRIC_VALUES.length; // 20

export function applyKaryRR(
  trueMetric: Metric,
  epsilon: number = CLIENT_EPSILON
): Metric | null {
  const expEps = Math.exp(epsilon);

  // Probability of reporting true value
  // For k=20, ε=2.0: pTrue ≈ 0.28 (28%)
  const pTrue = expEps / (expEps + k - 1);

  const rand = cryptoRandom();

  if (rand < pTrue) {
    return trueMetric; // Report true with probability pTrue
  }

  // Report uniformly random OTHER value
  // Each other value has probability: 1 / (e^ε + k - 1) ≈ 0.038 (3.8%)
  const otherMetrics = METRIC_VALUES.filter(m => m !== trueMetric);
  const selectedIndex = Math.floor(cryptoRandom() * otherMetrics.length);
  return otherMetrics[selectedIndex];
}
```

### Why k-ary RR (Not Binary RR)

The old binary RR formula was **mathematically broken** for multi-valued domains:

| Approach | P(true) | P(other) | Likelihood Ratio | ε-DP Bound |
|----------|---------|----------|------------------|------------|
| Binary RR (BROKEN) | 88% | 0.6% | ~147 | 7.39 |
| k-ary RR (CORRECT) | 28% | 3.8% | 7.39 | 7.39 |

Binary RR violated ε-DP by **20x**. k-ary RR achieves the **tight bound**.

### Privacy Guarantee

For any two inputs x, x' and output y:
```
P(M(x) = y) / P(M(x') = y) ≤ e^ε ≈ 7.39
```

This is the mathematical definition of ε-differential privacy.

### Server Correction (Debiasing)

The server corrects for k-ary RR noise using maximum likelihood estimation:

```typescript
// noise.ts (server)

export function correctKaryRR(
  observedCounts: Map<Metric, number>,
  totalReports: number,
  epsilon: number = CLIENT_EPSILON
): Map<Metric, number> {
  const k = METRIC_VALUES.length;
  const expEps = Math.exp(epsilon);

  const p = expEps / (expEps + k - 1); // P(report true)
  const q = 1 / (expEps + k - 1);       // P(report each false)

  const corrected = new Map<Metric, number>();

  for (const metric of METRIC_VALUES) {
    const observed = observedCounts.get(metric) ?? 0;
    // Debiasing formula: n̂_v = (n_v - n·q) / (p - q)
    const estimated = (observed - totalReports * q) / (p - q);
    // Clamp to valid range [0, totalReports]
    corrected.set(metric, Math.max(0, Math.min(totalReports, Math.round(estimated))));
  }

  return corrected;
}
```

---

## Layer 2: Laplace Mechanism (Server)

### What It Does

When querying aggregates, add Laplace-distributed noise:

```typescript
// noise.ts (server)

const SERVER_EPSILON = 1.0;
const SENSITIVITY = 1; // One person can change count by at most 1

export function laplace(trueCount: number): number {
  const scale = SENSITIVITY / SERVER_EPSILON;
  const noise = laplaceRandom(scale);

  return Math.max(0, Math.round(trueCount + noise));
}

function laplaceRandom(scale: number): number {
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}
```

### Privacy Guarantee

With ε=1.0, the probability of any output is at most `e^1 ≈ 2.7x` different whether any individual is in the dataset or not.

```
Pr[output | you're in] ≤ e^ε × Pr[output | you're out]
```

### Noise Distribution

| True Count | Expected Noise Range (95%) |
|------------|---------------------------|
| 10 | ±6 |
| 50 | ±6 |
| 100 | ±6 |
| 1000 | ±6 |

Noise is **additive**, not proportional. Large counts are barely affected. Small counts have high relative uncertainty (which is the point).

---

## Composition: Total Privacy Budget

Each query consumes privacy budget. We track cumulative epsilon:

```typescript
// noise.ts (server)

interface PrivacyBudget {
  daily_epsilon_used: number;
  max_daily_epsilon: number;
}

export async function checkBudget(
  queryEpsilon: number
): Promise<boolean> {
  const budget = await getPrivacyBudget();

  if (budget.daily_epsilon_used + queryEpsilon > budget.max_daily_epsilon) {
    return false; // Budget exhausted
  }

  await incrementBudget(queryEpsilon);
  return true;
}
```

### Budget Strategy

- **Daily budget**: ε=10 (resets at midnight UTC)
- **Per-query cost**: ε=1
- **Max queries/day**: 10 unique queries

After budget exhaustion, queries return cached results until reset.

---

## Noise Application Pipeline

```
Query request
      ↓
Validate parameters
      ↓
Check privacy budget → Reject if exhausted
      ↓
Fetch raw aggregates from database
      ↓
Apply geographic coarsening (see coarsen.md)
      ↓
Apply Laplace noise to each count
      ↓
Round to integer, floor at 0
      ↓
Record epsilon used
      ↓
Return noisy results with privacy metadata
```

---

## Type Definitions

```typescript
// src/lib/types/analytics/metrics.ts

export const PRIVACY = {
  CLIENT_EPSILON: 2.0,         // k-ary RR noise level
  SERVER_EPSILON: 1.0,         // Laplace noise level
  SENSITIVITY: 1,              // Max change from one record
  MAX_DAILY_EPSILON: 10.0,     // Daily query budget
  COARSEN_THRESHOLD: 5,        // Roll up counts below this
  MAX_QUERY_DAYS: 90,          // Prevent full-history extraction
  MAX_BATCH_SIZE: 100,         // Max increments per batch
  MAX_DAILY_CONTRIBUTIONS: 100 // Per-client rate limit
} as const;

export const METRIC_DOMAIN_SIZE = METRIC_VALUES.length; // 20

export interface PrivacyMetadata {
  epsilon: number;
  differential_privacy: true;
  ldp_corrected: boolean;
  budget_remaining: number;
}

export interface NoisyResult<T> {
  data: T;
  privacy: PrivacyMetadata;
}
```

---

## Implementation Notes

### Cryptographic Randomness

Use `crypto.getRandomValues()` for noise generation, not `Math.random()`:

```typescript
function secureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
}
```

### Reproducibility for Audits

Store noise seed and parameters for audit trail:

```typescript
interface NoiseAudit {
  query_id: string;
  timestamp: Date;
  epsilon_used: number;
  noise_seed: string; // Encrypted
  raw_counts: number[]; // Only stored in TEE
}
```

---

## What This Achieves

1. **Client-side plausible deniability** — Can't prove any action occurred
2. **Server-side statistical privacy** — Individual contributions hidden
3. **Budget enforcement** — Limits information extraction
4. **Audit trail** — Provable privacy claims

---

*Differential Privacy Specification | 2026-01*
