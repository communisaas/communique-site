# Rate Limiting Architecture

Multi-instance rate limiting design for Communique, optimized for single-maintainer operations.

---

## TL;DR

- **Current**: In-memory rate limiting (works for single instance)
- **Upgrade path**: Postgres-based (works across Cloudflare Pages instances)
- **No Redis**: Operational overhead not worth it for one person
- **Privacy note**: For differential privacy, exact rate limiting is NOT required

---

## Why Exact Rate Limiting Doesn't Matter for DP

The analytics system uses differential privacy (DP) to protect user privacy. Rate limiting exists to **bound sensitivity** - the maximum impact any single user can have on aggregate statistics.

**Key insight**: The privacy guarantee comes from the Laplace noise added to query results, not from exact rate limit enforcement.

If someone sends 150 contributions instead of 100 due to multi-instance race conditions:
- The DP noise parameters are calibrated for sensitivity=1
- Each individual contribution still has sensitivity=1
- The privacy guarantee (epsilon) remains intact
- The only impact is slightly more "true signal" in the data (acceptable)

**Bottom line**: Approximate rate limiting is acceptable for privacy. The limit exists to prevent unbounded influence, not exact enforcement.

---

## Option 1: In-Memory (Current)

**Status**: Active in production

**Implementation**: `src/lib/core/analytics/aggregate.ts` and `src/lib/server/rate-limiter.ts`

```typescript
const rateLimits = new Map<string, { count: number; windowStart: number }>();
```

**Pros**:
- Zero latency (no network round-trip)
- Zero cost (no external service)
- Zero configuration
- Simple debugging

**Cons**:
- State lost on deploy
- Per-instance only (no cross-instance coordination)
- Memory growth with unique IPs (mitigated by cleanup)

**When to use**: MVP, single-instance Cloudflare Pages deployment

---

## Option 2: Postgres-Based (Recommended Upgrade)

**Status**: Implemented, behind feature flag

**Implementation**: `src/lib/core/analytics/rate-limit-db.ts`

```typescript
// Enable with environment variable
RATE_LIMIT_USE_DB=true

// Usage
const result = await checkContributionLimitDB(hashedIP, 'template_view');
if (result.allowed) {
  await incrementAggregate('template_view', dimensions);
}
```

### How It Works

1. **Atomic upsert** with conditional increment:

```sql
INSERT INTO rate_limits (key, window_start, count)
VALUES ($key, $today, 1)
ON CONFLICT (key, window_start)
DO UPDATE SET count = CASE
  WHEN rate_limits.count < $limit THEN rate_limits.count + 1
  ELSE rate_limits.count
END
RETURNING count, (count <= $limit) as allowed
```

2. **Single round-trip** per check (no read-then-write race)

3. **Day granularity** for windows (efficient storage, matches DP daily budget)

### Schema

```prisma
model RateLimit {
  id            String   @id @default(cuid())
  key           String   // "sha256(ip):metric_name"
  window_start  DateTime @db.Date
  count         Int      @default(1)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([key, window_start])
  @@index([window_start])
  @@map("rate_limits")
}
```

### Cleanup

Daily cron job deletes entries older than 2 days:

```typescript
// In cron handler
await cleanupOldRateLimits(2);
```

**Pros**:
- Works across multiple instances
- Uses existing infrastructure (Neon Postgres)
- Atomic operations prevent race conditions
- Survives deploys

**Cons**:
- Database round-trip per check (~5-10ms to Neon)
- Connection pool usage
- Requires cleanup cron job

**When to use**: Multi-instance Cloudflare Pages deployment, or when exact cross-instance coordination matters

---

## Option 3: Hybrid Approach

**Status**: Implemented in `rate-limit-db.ts`

Combines in-memory fast-path with Postgres source of truth:

```typescript
const result = await checkContributionLimitHybrid(hashedIP, metric);
```

### How It Works

1. **Fast path**: Check local cache for known exceeded limits
   - If exceeded today, skip DB query entirely
   - Reduces DB load for repeat offenders

2. **Slow path**: Query Postgres for authoritative check
   - Update local cache when limit exceeded
   - Cache entries expire when window changes

```typescript
// Fast path
const cached = localCache.get(key);
if (cached && cached.windowStart === todayStart) {
  return { allowed: false, ... }; // Skip DB
}

// Slow path
const result = await checkContributionLimitDB(...);
if (!result.allowed) {
  localCache.set(key, { exceededAt: now, windowStart: todayStart });
}
```

**Tradeoffs**:
- Slightly more requests may get through (cache miss before DB limit hit)
- Per-instance cache, so blocked on one instance may not block on another
- For DP purposes, this approximation is acceptable

**When to use**: High-traffic scenarios where DB round-trips are a concern

---

## Option 4: Accept Approximate (Simplest)

**Status**: Always an option

For privacy purposes, approximate rate limiting is actually fine. Document that the limit is advisory and move on.

```typescript
// Document the approximation
// The 100/day limit is approximate in multi-instance deployments
// Privacy guarantee comes from DP noise, not rate limits
```

**When to use**: When simplicity matters more than exact enforcement

---

## Migration Path

### MVP (Now)
1. Use in-memory rate limiting
2. Single Cloudflare Pages instance
3. Circuit breaker ($5/day) as ultimate protection

### Growth (When Needed)
1. Add `RATE_LIMIT_USE_DB=true` to environment
2. Run Prisma migration for `rate_limits` table
3. Add cleanup to daily cron job
4. Monitor DB connection usage

### Scale (10+ instances, 50K+ MAU)
1. Consider Redis if Postgres becomes bottleneck
2. One day of work when you have money and team

---

## Configuration

### Environment Variables

```bash
# Enable Postgres-based rate limiting
RATE_LIMIT_USE_DB=true

# (Optional) Custom limits per metric - future enhancement
# RATE_LIMIT_TEMPLATE_VIEW=100
# RATE_LIMIT_DELIVERY_ATTEMPT=10
```

### Constants

From `src/lib/types/analytics/metrics.ts`:

```typescript
export const PRIVACY = {
  // ...
  MAX_DAILY_CONTRIBUTIONS: 100  // Default limit per identifier per metric
};
```

---

## Monitoring

### Stats Endpoint

```typescript
import { getRateLimitStats } from '$lib/core/analytics/rate-limit-db';

const stats = await getRateLimitStats();
// { activeEntries: 1234, todayEntries: 567, implementation: 'postgres' }
```

### Logs

Rate limiting logs to console:
- `[RateLimitDB] Cleanup: deleted N entries older than 2 days`
- `[RateLimitDB] Error checking rate limit: ...`
- `[RateLimitDB] Local cache cleanup: removed N stale entries`

---

## Error Handling

### Graceful Degradation

On any database error, rate limiting falls back to **permissive** (allowing the request):

```typescript
try {
  // Check rate limit
} catch (error) {
  console.error('[RateLimitDB] Error:', error);
  return { allowed: true, source: 'fallback' };
}
```

**Rationale**: Privacy > availability. We'd rather let through a few extra contributions than block legitimate users due to a transient DB issue.

### Result Source

Every rate limit result includes `source` field:
- `'db'`: Result from Postgres (authoritative)
- `'fallback'`: Database error or feature flag disabled

---

## Security Considerations

### IP Hashing

Client IPs are hashed before use as rate limit keys:

```typescript
function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}
```

This prevents:
- IP addresses appearing in database
- Correlation attacks via rate limit keys
- PII leakage in logs

### Rate Limit Keys

Format: `{hashed_ip}:{metric_name}`

Example: `a7f9b2c3d4e5f6...1234:template_view`

---

## Performance Characteristics

### Postgres-Based

| Operation | Latency (Neon Serverless) |
|-----------|---------------------------|
| Single check | 5-15ms |
| Batch check (N keys) | 5-20ms |
| Cleanup (1000 entries) | 50-100ms |

### Connection Pool Impact

Each rate limit check uses one connection briefly. With Neon's connection pooling:
- Serverless scales automatically
- No connection exhaustion under normal load
- Consider hybrid approach for very high traffic

---

## Future Enhancements

### Per-Metric Limits

```typescript
const METRIC_LIMITS: Record<Metric, number> = {
  template_view: 100,
  delivery_attempt: 10,  // Lower limit for expensive operations
  // ...
};
```

### Sliding Windows

Current: Fixed daily windows (midnight UTC to midnight UTC)
Future: True sliding windows (past 24 hours) for smoother rate limiting

### Distributed Caching

If Postgres becomes a bottleneck:
1. Add Upstash Redis ($0.20/100K commands)
2. Use Redis for hot path, Postgres for durability
3. Still simpler than self-hosted Redis

---

## Related Documents

- `docs/specs/privacy-first-analytics.md` - DP implementation details
- `src/lib/types/analytics/metrics.ts` - PRIVACY constants
- `src/lib/core/analytics/aggregate.ts` - In-memory rate limiting
- `src/lib/server/rate-limiter.ts` - Generic rate limiter class
