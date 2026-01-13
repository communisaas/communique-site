# Analytics System

**Status**: ✅ Privacy-Preserving Aggregation-Only

---

## Architecture

Communique uses differential privacy for analytics. No events, no sessions, no user tracking.

```
User Action → increment(metric, dims) → k-ary RR (ε=2.0) → Server → Aggregate DB
                                                                        ↓
                                                              Cron (daily) → Noisy Snapshot
                                                                        ↓
                                                              Query → Cached Noisy Data
```

## Privacy Guarantees

| Layer | Mechanism | Parameter |
|-------|-----------|-----------|
| Client | k-ary Randomized Response | ε = 2.0 |
| Server | Laplace noise | ε = 1.0 |
| Coarsening | Post-noise thresholding | k = 5 |
| Rate limit | 100/metric/day/client | - |

## Usage

```typescript
import { analytics, trackTemplateView } from '$lib/core/analytics/client';

// Track a template view
trackTemplateView(templateId, jurisdiction);

// Or use increment directly
analytics.increment('delivery_success', {
  template_id: templateId,
  delivery_method: 'cwc'
});
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/increment` | POST | Receive batched increments |
| `/api/analytics/aggregate` | GET | Query with DP noise |
| `/api/analytics/health` | GET | Platform metrics |
| `/api/cron/analytics-snapshot` | GET | Daily snapshot materialization |

## What We Track

- Aggregate counts (template_view, delivery_success, etc.)
- Coarse geographic data (state-level only)
- Delivery method distribution

## What We DON'T Track

- Individual user actions (only aggregates)
- Session IDs or user IDs
- Device fingerprints
- Precise location (only state)
- Cross-device linking
- Cohort tokens (removed)

## Code Location

- `src/lib/core/analytics/` - Core modules
- `src/lib/types/analytics/` - Type definitions
- `src/routes/api/analytics/` - API endpoints
- `tests/unit/analytics-*.test.ts` - Unit tests
- `tests/integration/analytics-*.test.ts` - Integration tests

## Testing

```bash
npm run test:run -- analytics-  # Run analytics tests
```

## References

- [DP Hardening Guide](../specs/analytics/dp-hardening-guide.md)
- [k-ary RR Implementation](../implementation/k-ary-randomized-response.md)

---

*Communique Analytics | Privacy-Preserving Aggregation-Only | 2026-01*
