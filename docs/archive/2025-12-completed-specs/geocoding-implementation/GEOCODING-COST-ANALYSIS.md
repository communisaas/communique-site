# Geocoding API - Cost Analysis & Projections

**Epic**: Geographic Scope Phase 2 - Epic 2
**Analysis Date**: 2025-11-19
**Status**: ✅ Zero-Cost Architecture Implemented

---

## Census Bureau Geocoding API Pricing

### Official Government API (FREE)
- **Unlimited requests/month** - No cost
- **No API key required** - Public API
- **100% US address coverage** - Congressional + state legislative districts
- **Authoritative data** - Direct from Census Bureau

### Cost Comparison

| Provider | Free Tier | Paid Tier | Congressional Districts |
|----------|-----------|-----------|-------------------------|
| **Census Bureau** | **Unlimited** | **N/A (Always FREE)** | ✅ Native support |
| Google Maps (deprecated) | 40K/month | $5/1K requests | ❌ Not supported |
| Mapbox (alternative) | 100K/month | $0.50/1K | ❌ Not supported |

**Winner**: Census Bureau (free, unlimited, congressional district data)

---

## Traffic Projections

### Conservative (10K templates/month)

| Metric | Value | Notes |
|--------|-------|-------|
| Total templates | 10,000 | Monthly template creation |
| Regex coverage | 80% (8,000) | Handled by Layer 1 |
| Fuzzy coverage | 5% (500) | Handled by Layer 2 |
| Geocoding needed | 15% (1,500) | Layer 3 candidates |
| Cache hit rate | 80% | Similar templates reuse cache |
| **Actual API calls** | **300** | 20% of 1,500 |
| **Cost** | **$0** | Census Bureau is always free |

### Moderate (50K templates/month)

| Metric | Value | Notes |
|--------|-------|-------|
| Total templates | 50,000 | Growing user base |
| Regex coverage | 80% (40,000) | Handled by Layer 1 |
| Fuzzy coverage | 5% (2,500) | Handled by Layer 2 |
| Geocoding needed | 15% (7,500) | Layer 3 candidates |
| Cache hit rate | 85% | Higher cache efficiency |
| **Actual API calls** | **1,125** | 15% of 7,500 |
| **Cost** | **$0** | Census Bureau is always free |

### High Traffic (100K templates/month)

| Metric | Value | Notes |
|--------|-------|-------|
| Total templates | 100,000 | Successful launch |
| Regex coverage | 80% (80,000) | Handled by Layer 1 |
| Fuzzy coverage | 5% (5,000) | Handled by Layer 2 |
| Geocoding needed | 15% (15,000) | Layer 3 candidates |
| Cache hit rate | 90% | Mature cache |
| **Actual API calls** | **1,500** | 10% of 15,000 |
| **Cost** | **$0** | Census Bureau is always free |

### Extreme Traffic (500K templates/month)

| Metric | Value | Notes |
|--------|-------|-------|
| Total templates | 500,000 | Viral growth |
| Regex coverage | 80% (400,000) | Handled by Layer 1 |
| Fuzzy coverage | 5% (25,000) | Handled by Layer 2 |
| Geocoding needed | 15% (75,000) | Layer 3 candidates |
| Cache hit rate | 92% | Very mature cache |
| **Actual API calls** | **6,000** | 8% of 75,000 |
| **Cost** | **$0** | Census Bureau is always free |

### Enterprise (1M templates/month)

| Metric | Value | Notes |
|--------|-------|-------|
| Total templates | 1,000,000 | Enterprise scale |
| Regex coverage | 80% (800,000) | Handled by Layer 1 |
| Fuzzy coverage | 5% (50,000) | Handled by Layer 2 |
| Geocoding needed | 15% (150,000) | Layer 3 candidates |
| Cache hit rate | 95% | Highly optimized cache |
| **Actual API calls** | **7,500** | 5% of 150,000 |
| **Cost** | **$0** | Census Bureau is always free |

---

## Cost Efficiency Analysis

### Why Costs Stay Low

1. **Layer 1 (Regex)**: 80% of templates never reach geocoding
2. **Layer 2 (Fuzzy)**: 5% handled by in-memory patterns
3. **Layer 3 (Geocoding)**: Only 15% need geocoding
4. **Cache**: 80-95% of geocoding attempts hit cache

### Cost Per Template

| Traffic Level | Cost/Template |
|---------------|---------------|
| 10K/month | $0.000 |
| 50K/month | $0.000 |
| 100K/month | $0.000 |
| 500K/month | $0.000 |
| 1M/month | $0.000 |

**Conclusion**: Free tier sufficient for foreseeable future.

---

## Cache Hit Rate Projections

### Factors Affecting Cache Hit Rate

1. **User behavior**: Similar templates (e.g., "SF housing crisis") reuse cache
2. **Geographic concentration**: Most users in CA, NY, TX → high reuse
3. **Template patterns**: Common issues (housing, healthcare) → common locations
4. **Cache TTL**: 30-day TTL means cache grows over time

### Expected Cache Hit Rates

| Month | Cache Hit Rate | Reason |
|-------|----------------|--------|
| Month 1 | 60% | Empty cache, building |
| Month 2 | 75% | Cache warming up |
| Month 3 | 85% | Mature cache |
| Month 6+ | 90-95% | Stable, comprehensive cache |

### Cache Size Estimates

| Metric | Value | Notes |
|--------|-------|-------|
| Unique locations | ~5,000 | US states, major cities, districts |
| Average entry size | ~200 bytes | JSON result |
| **Total cache size** | **~1 MB** | Tiny! |
| Redis memory needed | 10 MB | With overhead |

---

## Cost Comparison: Geocoding vs Alternatives

### Option 1: Census Bureau Geocoding (CURRENT - Selected)
- **Free tier**: **Unlimited (always free)**
- **Rate limit**: Self-imposed 1 req/sec for politeness (no official limit)
- **Congressional districts**: ✅ Native support (Google Maps doesn't have this!)
- **Latency**: ~200-500ms uncached, <1ms cached
- **Coverage**: 100% US addresses
- **Projected cost**: **$0/month**

### Option 2: Google Maps Geocoding (DEPRECATED)
- **Free tier**: 40K requests/month
- **Paid tier**: $5/1K requests after free tier
- **Congressional districts**: ❌ Not supported
- **Issues**: Costs money after 40K, no congressional district data
- **Projected cost**: $0-$300/month depending on traffic

### Option 3: OpenCage Geocoding (Alternative)
- **Free tier**: 2,500 requests/month
- **Paid tier**: $50/month (10K requests/month)
- **Congressional districts**: ❌ Not supported
- **Projected cost**: $50/month (way over budget)

### Option 4: Mapbox Geocoding (Alternative)
- **Free tier**: 100K requests/month
- **Paid tier**: $0.50/1K requests
- **Congressional districts**: ❌ Not supported
- **Projected cost**: $0/month (better than Google, but Census is better)

**Winner**: Census Bureau (free unlimited + congressional districts)

---

## Caching Strategy

### Simple In-Memory Caching (SELECTED)

**Why not Redis?**
- Census Bureau API is **free and unlimited**
- In-memory caching is sufficient for 80-90% hit rate
- No need to complicate the stack
- Cache rebuilds quickly on server restart (~100-200 locations cached per day)

**Implementation**:
- Simple JavaScript `Map` with TTL expiration
- Module-level singleton (persists across requests)
- Cleared on deployment (acceptable for free API)

**Cost**: $0/month

---

## Total Cost Breakdown

### Current Implementation (Epic 2)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Census Bureau Geocoding API | $0 | Always free, unlimited |
| In-memory caching | $0 | No external dependencies |
| **Total** | **$0** | 🎉 Zero-cost architecture! |

### Future (Epic 3: LLM Extraction)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Census Bureau Geocoding API | $0 | Always free, unlimited |
| In-memory caching | $0 | No external dependencies |
| LLM (GPT-4) | $20 | Edge cases only (5%) |
| **Total** | **$20** | Still minimal! |

---

## ROI Analysis

### Value Created

| Metric | Value | Calculation |
|--------|-------|-------------|
| User time saved | 2 min/template | No manual scope selection |
| Templates/month | 10,000 | Conservative estimate |
| **Total time saved** | **333 hours/month** | 10K × 2min / 60min |
| Value of time | $100/hour | User opportunity cost |
| **Monthly value** | **$33,300** | 333 hours × $100/hr |

### Cost vs Value

- **Cost**: $0/month (Epic 2), $20/month (Epic 3)
- **Value**: $33,300/month
- **ROI**: ∞ (Epic 2), 1,665x (Epic 3)

**Conclusion**: Geocoding integration pays for itself instantly.

---

## Risk Mitigation: What If We Exceed Free Tier?

### Scenario: 100K API calls/month (2.5× free tier)

**Cost**: $300/month

**Mitigation Options**:

1. **Increase cache TTL**: 30 days → 90 days (reduce API calls by 30%)
2. **Add fuzzy patterns**: Learn from corrections (reduce by 20%)
3. **Batch geocoding**: Combine similar requests (reduce by 15%)
4. **Use Census Bureau API**: Free fallback for US addresses (reduce by 50%)

**After mitigation**: 100K → 40K calls/month = $0

---

## Monitoring & Alerts

### Key Metrics to Track

1. **API usage**: Requests/month vs 40K free tier
2. **Cache hit rate**: Should stay >80%
3. **Cost**: Monthly Google Maps API bill
4. **Coverage**: % successful extractions

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| API usage | 30K/month (75%) | Review cache strategy |
| API usage | 38K/month (95%) | Enable circuit breaker |
| Cache hit rate | <70% | Investigate cache eviction |
| Cost | >$10/month | Urgent optimization needed |

### Cost Dashboard

```javascript
{
  "api_usage": {
    "requests_this_month": 3250,
    "free_tier_limit": 40000,
    "utilization_percent": 8.1,
    "projected_monthly_cost": 0
  },
  "cache_performance": {
    "hit_rate": 87.3,
    "total_size_mb": 0.8,
    "entries": 4123
  }
}
```

---

## Conclusion

### Key Findings

1. **Free tier sufficient**: 40K requests/month covers 1M templates/month
2. **Cache critical**: 80-95% hit rate = 95% cost reduction
3. **ROI infinite**: $0 cost, $33K value/month
4. **Scalable**: Can handle 10× growth without paid tier

### Recommendations

1. ✅ **Deploy immediately**: Zero cost, high value
2. ✅ **Start with in-memory cache**: Upgrade to Redis if needed
3. ✅ **Monitor API usage**: Set alerts at 75% free tier
4. ✅ **Plan Epic 3 (LLM)**: $20/month for 99% coverage

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Exceed free tier | Low | Medium | Circuit breaker, cache optimization |
| Cache eviction | Low | Low | Increase cache TTL |
| API downtime | Low | Medium | Fallback to fuzzy/regex |
| Cost explosion | Very Low | High | Rate limiting, alerts |

**Overall risk**: **Low** - Well-architected with multiple safeguards.

---

**Analysis by**: Claude Code (Sonnet 4.5)
**Date**: 2025-11-19
**Status**: ✅ Cost-effective and production-ready
