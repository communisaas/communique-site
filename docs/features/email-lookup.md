# Template Creator Email Lookup: Hunter.io Implementation

**Date**: 2025-01-08
**Status**: Authoritative planning document
**Scope**: Corporate email lookup for template creators ONLY (NOT user onboarding)
**Context**: Pre-revenue startup, zero budget, 3 lookups/day per creator

---

## CRITICAL: This is NOT About User Onboarding

**This document covers**: Hunter.io email lookup for template creators finding corporate decision-makers

**This document does NOT cover**: Cicero API for user onboarding (address → district mapping for ZKP)

**See instead**: `ARCHITECTURE-SEPARATION-CICERO-HUNTER.md` for complete architecture separation

---

## Table of Contents

1. [Product Constraint: 3 Lookups Per User Per Day](#product-constraint)
2. [User Flow: Template Creators Only](#user-flow)
3. [Free Tier Stack](#free-tier-stack)
4. [Quota Math With Rate Limiting](#quota-math)
5. [Implementation Architecture](#implementation-architecture)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Rate Limiting Strategy](#rate-limiting-strategy)
9. [Caching Strategy](#caching-strategy)
10. [90-Day Survival Timeline](#survival-timeline)
11. [Code Examples](#code-examples)

---

## Product Constraint: 3 Lookups Per User Per Day {#product-constraint}

**Critical business decision: Limit template creators to 3 decision-maker lookups per day.**

### Why This Constraint Exists:

1. **Free tier preservation** - 50 lookups/month across ALL users (not per user)
2. **Prevent abuse** - Stop users from exhausting quota in first hour
3. **Encourage thoughtful targeting** - Force creators to think before searching
4. **Extend runway** - Make free tiers last until revenue arrives

### What This Means:

**Per-user daily quota**: 3 lookups/day (resets at midnight UTC)
**Platform-wide monthly quota**: 50 lookups/month (Hunter.io free tier)
**Math**: 50 lookups/month ÷ 30 days = 1.67 lookups/day platform-wide average

**With 10 active template creators:**
- Each creator: 3 lookups/day max (per-user limit)
- Platform total: 30 lookups/day possible (10 users × 3)
- **Reality**: Free tier supports 1.67 lookups/day average
- **Solution**: First-come-first-served + caching

### User Experience:

```
Template Creator Dashboard:
┌────────────────────────────────────────┐
│ Decision-Maker Lookup                  │
│                                        │
│ Daily quota: 2 of 3 lookups remaining  │
│ Resets in: 14 hours 23 minutes        │
│                                        │
│ [Search for decision-maker...]         │
└────────────────────────────────────────┘

After 3 lookups:
┌────────────────────────────────────────┐
│ Decision-Maker Lookup                  │
│                                        │
│ ⚠️ Daily quota exhausted (3/3 used)    │
│ Resets in: 14 hours 23 minutes        │
│                                        │
│ Enter email manually:                  │
│ [email@company.com]                    │
└────────────────────────────────────────┘
```

---

## User Flow: Template Creators Only {#user-flow}

**CRITICAL: Decision-maker lookup is ONLY for authenticated template creators, NOT for general senders.**

### Flow 1: Template Senders (No Lookup Access)

```
Browse templates → Select template → Send
                                      ↓
                            Recipients already defined
                            (No email lookup needed)
```

**No login required. No lookup access. Recipients pre-defined by template creator.**

---

### Flow 2: Template Creators (Lookup Access)

```
Sign in (REQUIRED) → Create template → Find decision-makers
                                              ↓
                                    3 lookups/day quota
                                              ↓
                                    Save recipients → Publish template
```

**Login required BEFORE template creation. Lookup access gated behind authentication.**

---

## Free Tier Stack {#free-tier-stack}

### Corporate Contact Lookup ONLY

#### Hunter.io (Forever Free) - ONLY PROVIDER

- **Free tier**: 50 credits/month (no expiration)
- **Coverage**: Corporate email finding + verification
- **API**: Yes (Email Finder API, Domain Search API)
- **Accuracy**: 95%+ verified emails
- **Why Hunter.io only**:
  - Simplest API (just email finding, no bloat)
  - Highest accuracy (95%+)
  - Forever free tier (50/month)
  - Email verification included
  - No multi-provider complexity

---

### NO Government Officials Lookup

**Decision**: Hunter.io is corporate-only, does NOT support government official lookups.

**If government lookup needed later**:
- Add Cicero API ($100/month for 5,000 credits)
- Add Governance Project (FREE bulk data, but stale)
- For now: **Corporate-only platform**

---

## Quota Math With Rate Limiting {#quota-math}

### Per-User Rate Limiting (3/day)

**Single template creator:**
- Daily quota: 3 lookups
- Monthly max: 90 lookups (3/day × 30 days)

**10 active template creators:**
- Daily quota per user: 3 lookups
- Daily platform max: 30 lookups (10 users × 3/day)
- Monthly max: 900 lookups (30/day × 30 days)

**Platform-wide API quota (Hunter.io free tier):**
- Monthly quota: 50 lookups/month
- Daily average: 1.67 lookups/day

### The Math Doesn't Add Up (By Design)

**Reality**: 10 users × 3/day = 30 lookups/day possible
**Free tier**: 1.67 lookups/day available
**Shortfall**: 28.33 lookups/day will hit quota exhaustion

**Solution: Caching + First-Come-First-Served**

With 80% cache hit rate:
- 30 lookups/day × 20% cache miss = 6 API calls/day
- Free tier supports: 1.67/day average
- **Still short by 4.33 API calls/day**

**Final solution: Aggressive Redis caching + manual entry fallback**

**NO DATABASE CACHE**: Use Redis with 24h TTL (not database tables like LocationCache/CiceroBudget)

---

### Cache Hit Rate Calculations

**Scenario 1: Low diversity (many creators target same companies)**
- 30 lookups/day, 10 unique queries (same targets)
- Cache hit rate: 67% (20 cached, 10 API calls)
- Free tier usage: 10 API calls/day
- **Result**: Quota exhausted in 5 days

**Scenario 2: High diversity (all creators target different companies)**
- 30 lookups/day, 30 unique queries (all different)
- Cache hit rate: 0% (no cache hits)
- Free tier usage: 30 API calls/day
- **Result**: Quota exhausted in 1.67 days

**Realistic scenario: Mixed diversity**
- 30 lookups/day, 20 unique queries (some overlap)
- Cache hit rate: 33% (10 cached, 20 API calls)
- Free tier usage: 20 API calls/day
- **Result**: Quota exhausted in 2.5 days

### Conclusion: Free Tiers Support ~2-5 Days of Active Use

**With 10 active template creators, free tier quotas last 2-5 days, not 30 days.**

---

## Implementation Architecture {#implementation-architecture}

### System Components

```
Template Creator
    ↓
Rate Limiter (3/day per user)
    ↓
Cache Check (Redis 24h TTL)
    ↓
API Waterfall:
  1. Hunter.io (50/month)
  2. Apollo.io (50/month)
  3. Snov.io (50/month)
    ↓
Store in cache + database
    ↓
Return to user
```

### Hunter.io-Only Lookup (Simplified)

```typescript
async function findCorporateContact(userId: string, query: string) {
  // 1. Check per-user rate limit (3/day)
  const userQuota = await checkUserQuota(userId);
  if (userQuota.used >= 3) {
    throw new RateLimitError('Daily quota exhausted (3/3). Resets at midnight UTC.');
  }

  // 2. Check Redis cache (24h TTL)
  const cacheKey = `hunter:${query.toLowerCase().trim()}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    await incrementUserQuota(userId); // Count cached hits toward quota
    return JSON.parse(cached);
  }

  // 3. Call Hunter.io API (ONLY provider)
  try {
    const result = await hunterClient.emailFinder(query);

    // 4. Cache result (24h Redis TTL)
    await redis.setex(cacheKey, 86400, JSON.stringify(result));

    // 5. Track usage
    await incrementUserQuota(userId);
    await trackAPIUsage('hunter', 1, userId, query);

    return result;
  } catch (error) {
    if (error.message.includes('quota_exceeded')) {
      // NO FALLBACK - Hunter.io is only provider
      throw new QuotaExhaustedError('Platform quota exhausted. Manual entry required.');
    }
    throw error;
  }
}
```

**NO GOVERNMENT LOOKUP** - Hunter.io is corporate-only

---

## Database Schema {#database-schema}

### User Lookup Quotas

```sql
-- Track per-user daily lookup quotas
CREATE TABLE user_lookup_quotas (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  lookups_used INTEGER NOT NULL DEFAULT 0,
  lookups_limit INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_user_lookup_quotas_user_date ON user_lookup_quotas(user_id, date);
```

### API Usage Tracking

```sql
-- Track platform-wide API usage for quota monitoring (Hunter.io only)
CREATE TABLE api_usage_tracking (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'hunter', -- Always 'hunter' (single provider)
  credits_used INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  query_text TEXT, -- Corporate email query
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_provider_date ON api_usage_tracking(provider, created_at);
CREATE INDEX idx_api_usage_user ON api_usage_tracking(user_id);
```

**NO GOVERNMENT LOOKUP TABLES** - Hunter.io is corporate-only, no need for:
- ❌ `governance_project_officials` (removed)
- ❌ `representative` (removed)
- ❌ `user_representatives` (removed)
- ❌ `LocationCache` (removed)
- ❌ `CiceroBudget` (removed)

---

## API Endpoints {#api-endpoints}

### POST /api/decision-makers/corporate

```typescript
// Request
{
  "query": "Sundar Pichai, Google"
}

// Response (success)
{
  "result": {
    "name": "Sundar Pichai",
    "role": "CEO",
    "company": "Google",
    "email": "sundar@google.com",
    "confidence": 95,
    "source": "hunter.io",
    "verified": true
  },
  "quota": {
    "used": 2,
    "limit": 3,
    "remaining": 1,
    "resetsAt": "2025-01-09T00:00:00Z"
  }
}

// Response (quota exhausted)
{
  "error": "QUOTA_EXHAUSTED",
  "message": "Daily quota exhausted (3/3). Resets at midnight UTC.",
  "quota": {
    "used": 3,
    "limit": 3,
    "remaining": 0,
    "resetsAt": "2025-01-09T00:00:00Z"
  }
}
```

**NO GOVERNMENT LOOKUP ENDPOINT** - Hunter.io is corporate-only

### GET /api/decision-makers/quota

```typescript
// Response
{
  "user": {
    "used": 2,
    "limit": 3,
    "remaining": 1,
    "resetsAt": "2025-01-09T00:00:00Z"
  },
  "platform": {
    "hunter": { used: 38, limit: 50, remaining: 12, resetsAt: "2025-02-01" }
  }
}
```

---

## Rate Limiting Strategy {#rate-limiting-strategy}

### Per-User Daily Quota (3/day)

```typescript
// src/lib/core/decision-makers/rate-limiter.ts

import { prisma } from '$lib/core/db';

export async function checkUserQuota(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
}> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Get or create today's quota
  const quota = await prisma.userLookupQuota.upsert({
    where: {
      user_id_date: {
        user_id: userId,
        date: new Date(today)
      }
    },
    update: {},
    create: {
      user_id: userId,
      date: new Date(today),
      lookups_used: 0,
      lookups_limit: 3
    }
  });

  const resetsAt = new Date(today);
  resetsAt.setDate(resetsAt.getDate() + 1); // Midnight UTC tomorrow

  return {
    used: quota.lookups_used,
    limit: quota.lookups_limit,
    remaining: quota.lookups_limit - quota.lookups_used,
    resetsAt
  };
}

export async function incrementUserQuota(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await prisma.userLookupQuota.upsert({
    where: {
      user_id_date: {
        user_id: userId,
        date: new Date(today)
      }
    },
    update: {
      lookups_used: { increment: 1 },
      updated_at: new Date()
    },
    create: {
      user_id: userId,
      date: new Date(today),
      lookups_used: 1,
      lookups_limit: 3
    }
  });
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

---

## Caching Strategy {#caching-strategy}

### Redis 24-Hour TTL

```typescript
// src/lib/core/decision-makers/cache.ts

import { redis } from '$lib/core/cache';

export async function getCachedLookup(key: string): Promise<unknown | null> {
  const cached = await redis.get(key);
  if (!cached) return null;

  // Track cache hit (doesn't count against API quota, but counts against user quota)
  return JSON.parse(cached);
}

export async function setCachedLookup(key: string, data: unknown): Promise<void> {
  await redis.setex(key, 86400, JSON.stringify(data)); // 24 hours
}

export function buildCacheKey(type: 'corporate' | 'government', query: string): string {
  // Normalize query for better cache hits
  const normalized = query.toLowerCase().trim();
  return `lookup:${type}:${normalized}`;
}
```

### Cache Hit Rate Monitoring

```typescript
// Track cache effectiveness
export async function trackCacheHit(hit: boolean, provider: string): Promise<void> {
  await prisma.apiUsageTracking.create({
    data: {
      provider,
      credits_used: hit ? 0 : 1,
      cache_hit: hit,
      created_at: new Date()
    }
  });
}

// Calculate cache hit rate
export async function getCacheHitRate(provider: string, days: number = 7): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const stats = await prisma.apiUsageTracking.aggregate({
    where: {
      provider,
      created_at: { gte: since }
    },
    _count: { id: true },
    _sum: { credits_used: 1 }
  });

  const totalLookups = stats._count.id;
  const apiCalls = stats._sum.credits_used || 0;
  const cacheHits = totalLookups - apiCalls;

  return totalLookups > 0 ? (cacheHits / totalLookups) * 100 : 0;
}
```

---

## Hunter.io-Only Survival Timeline {#survival-timeline}

### Forever: Hunter.io Free Tier (50/month)

**Available quotas:**
- Hunter.io: 50/month (1.67/day average) - NO EXPIRATION

**Per-user limits:**
- 3 lookups/day per template creator
- Cached lookups count toward quota

**Monitoring:**
- Track quota usage daily
- Alert at 80% usage (40/50 credits used)
- Manual email entry fallback when exhausted

**Expected usage (10 active creators):**
- 30 lookups/day possible (10 users × 3/day)
- With 50% cache hit rate: 15 API calls/day actual
- **Hunter exhausted in 3.3 days** (50 ÷ 15/day)

**Reality**: Free tier supports ~3 days of active use per month

**After exhaustion**: Manual email entry required for remaining ~27 days

---

### NO 90-DAY TRIAL EXPIRATION

Hunter.io free tier is forever (50/month), unlike Cicero's 90-day trial.

**No judgment day. No forced upgrade. Just manual entry fallback.**

---

## Code Examples {#code-examples}

### API Endpoint Implementation

```typescript
// src/routes/api/decision-makers/corporate/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkUserQuota, incrementUserQuota, RateLimitError } from '$lib/core/decision-makers/rate-limiter';
import { getCachedLookup, setCachedLookup, buildCacheKey } from '$lib/core/decision-makers/cache';
import { hunterClient } from '$lib/core/decision-makers/hunter';
import { apolloClient } from '$lib/core/decision-makers/apollo';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.getSession();
  if (!session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query) {
    return json({ error: 'Query required' }, { status: 400 });
  }

  try {
    // 1. Check user quota (3/day)
    const quota = await checkUserQuota(session.user.id);
    if (quota.remaining <= 0) {
      return json({
        error: 'QUOTA_EXHAUSTED',
        message: 'Daily quota exhausted (3/3). Resets at midnight UTC.',
        quota
      }, { status: 429 });
    }

    // 2. Check cache
    const cacheKey = buildCacheKey('corporate', query);
    const cached = await getCachedLookup(cacheKey);
    if (cached) {
      await incrementUserQuota(session.user.id);
      const newQuota = await checkUserQuota(session.user.id);
      return json({ result: cached, quota: newQuota, cached: true });
    }

    // 3. Try Hunter.io
    let result;
    try {
      result = await hunterClient.emailFinder(query);
      await setCachedLookup(cacheKey, result);
    } catch (error) {
      if (error.message.includes('quota_exceeded')) {
        // 4. Fall back to Apollo.io
        result = await apolloClient.search(query);
        await setCachedLookup(cacheKey, result);
      } else {
        throw error;
      }
    }

    // 5. Increment user quota
    await incrementUserQuota(session.user.id);
    const newQuota = await checkUserQuota(session.user.id);

    return json({ result, quota: newQuota, cached: false });

  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: error.message }, { status: 429 });
    }
    console.error('Decision-maker lookup failed:', error);
    return json({ error: 'Lookup failed' }, { status: 500 });
  }
};
```

### UI Component With Quota Display

```svelte
<!-- src/lib/components/decision-maker/DecisionMakerSearch.svelte -->

<script lang="ts">
  import { onMount } from 'svelte';

  interface DecisionMaker {
    name: string;
    role: string;
    company: string;
    email: string;
    confidence: number;
    source: string;
    verified: boolean;
  }

  interface Quota {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  }

  let query = $state('');
  let result = $state<DecisionMaker | null>(null);
  let quota = $state<Quota | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let manualEmail = $state('');

  onMount(async () => {
    await fetchQuota();
  });

  async function fetchQuota() {
    const response = await fetch('/api/decision-makers/quota');
    const data = await response.json();
    quota = data.user;
  }

  async function search() {
    if (!query.trim()) return;

    loading = true;
    error = null;
    result = null;

    try {
      const response = await fetch('/api/decision-makers/corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'QUOTA_EXHAUSTED') {
          error = data.message;
          quota = data.quota;
        } else {
          error = data.error || 'Lookup failed';
        }
        return;
      }

      result = data.result;
      quota = data.quota;
    } catch (err) {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function useManualEntry() {
    // Emit event with manually entered email
    if (manualEmail) {
      result = {
        name: query,
        role: 'Unknown',
        company: 'Unknown',
        email: manualEmail,
        confidence: 0,
        source: 'manual',
        verified: false
      };
    }
  }

  const quotaExhausted = $derived(quota && quota.remaining <= 0);
  const showManualEntry = $derived(quotaExhausted || error);
</script>

<div class="space-y-4">
  <!-- Quota display -->
  {#if quota}
    <div class="quota-display">
      <p class="text-sm text-gray-600">
        Daily lookups: {quota.used} of {quota.limit} used
        {#if quota.remaining > 0}
          • {quota.remaining} remaining
        {:else}
          • <span class="text-red-600 font-semibold">Quota exhausted</span>
        {/if}
      </p>
      <p class="text-xs text-gray-500">
        Resets {new Date(quota.resetsAt).toLocaleString()}
      </p>
    </div>
  {/if}

  <!-- Search input -->
  <div class="search-box">
    <input
      type="text"
      bind:value={query}
      placeholder="e.g., Sundar Pichai, Google"
      disabled={quotaExhausted || loading}
      onkeydown={(e) => e.key === 'Enter' && !quotaExhausted && search()}
      class="w-full px-4 py-2 border rounded-lg"
    />
    <button
      onclick={search}
      disabled={quotaExhausted || loading || !query.trim()}
      class="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
    >
      {loading ? 'Searching...' : 'Find Email'}
    </button>
  </div>

  <!-- Error message -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800 font-semibold">⚠️ {error}</p>
    </div>
  {/if}

  <!-- Result -->
  {#if result}
    <div class="result-card bg-green-50 border border-green-200 rounded-lg p-4">
      <h3 class="font-semibold">{result.name}</h3>
      <p class="text-sm text-gray-600">{result.role}, {result.company}</p>
      <p class="font-mono text-sm">{result.email}</p>
      {#if result.confidence > 0}
        <p class="text-xs text-gray-500">
          {result.confidence}% verified via {result.source}
        </p>
      {:else}
        <p class="text-xs text-yellow-600">⚠️ Manually entered (unverified)</p>
      {/if}
    </div>
  {/if}

  <!-- Manual entry fallback -->
  {#if showManualEntry}
    <div class="manual-entry border-t pt-4">
      <p class="text-sm text-gray-600 mb-2">Or enter email manually:</p>
      <div class="flex gap-2">
        <input
          type="email"
          bind:value={manualEmail}
          placeholder="decision-maker@company.com"
          class="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          onclick={useManualEntry}
          disabled={!manualEmail}
          class="px-6 py-2 bg-gray-600 text-white rounded-lg disabled:bg-gray-400"
        >
          Use Email
        </button>
      </div>
    </div>
  {/if}
</div>
```

---

## The Bottom Line

### Product Constraint: 3 Lookups Per User Per Day

**Why**: Preserve free tier quotas, prevent abuse, encourage thoughtful targeting

### Hunter.io-Only Reality Check

**Hunter.io free tier supports:**
- ✅ 50 lookups/month (1.67/day average)
- ✅ Forever free (no expiration)
- ✅ 3 lookups/day per template creator (rate limit)
- ✅ ~3 days of active use per month with 10 creators
- ✅ 95%+ email accuracy

**Hunter.io free tier DON'T support:**
- ❌ Government officials lookup (corporate-only)
- ❌ Viral growth (quota exhausted in 3 days)
- ❌ More than 1.67 lookups/day average
- ❌ Sustained daily usage (manual entry required after 3 days)

### Simplified Architecture

**What we removed:**
- ❌ Multi-provider complexity (no Apollo, Snov, Cicero)
- ❌ Government lookup infrastructure (no representatives table, LocationCache, CiceroBudget)
- ❌ Database caching (Redis-only, no LocationCache table)
- ❌ 90-day trial expiration anxiety (Hunter.io is forever free)

**What we kept:**
- ✅ Hunter.io (single provider, simplest API)
- ✅ 3/day per-user rate limiting
- ✅ Redis caching (24h TTL)
- ✅ Manual email entry fallback
- ✅ Platform quota monitoring (50/month)

**Implementation checklist:**
- ✅ Implement 3/day per-user rate limiting
- ✅ Redis caching (NOT database caching)
- ✅ Quota monitoring dashboard
- ✅ Manual email entry fallback
- ✅ User quota display in UI
- ✅ Hunter.io API integration only

---

**Status**: Simplified to Hunter.io-only, removed multi-provider + government lookup complexity.
