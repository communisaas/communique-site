# Legacy Migration

**Status:** In Progress
**Target:** Complete removal of surveillance-pattern analytics

---

## What We're Removing

### Database Tables

| Table | Rows (est.) | Reason for Removal |
|-------|-------------|-------------------|
| `analytics_session` | ~50K | Sessions enable user tracking |
| `analytics_event` | ~500K | Individual events enable profiling |
| `analytics_experiment` | ~1K | Tied to session-based A/B testing |

### Code Modules

| Module | Lines | Replacement |
|--------|-------|-------------|
| `src/lib/core/analytics/database.ts` | 376 | `client.ts` |
| `src/lib/core/analytics/funnel.ts` | 246 | `cohort.ts` |
| `src/lib/types/analytics.ts` | 200+ | `src/lib/types/analytics/*.ts` |
| `src/routes/api/analytics/events/+server.ts` | 350 | `increment/+server.ts` |

### Data Patterns Eliminated

- `session_id` — No sessions
- `user_id` in analytics — No user tracking
- `ip_address` — No network identification
- `fingerprint` — No device identification
- `device_data` JSONB — No device profiling
- `properties` JSONB — No arbitrary data collection
- Individual timestamps — Day granularity only

---

## Migration Phases

### Phase 1: Schema Addition (Complete)

Add new tables without removing old:

```prisma
model analytics_aggregate { ... }
model analytics_funnel { ... }
model analytics_cohort { ... }  // New
```

**Status:** ✅ `analytics_aggregate` and `analytics_funnel` added

### Phase 2: Dual-Write Implementation (Current)

New client writes to both systems:

```typescript
// Temporary dual-write during migration
export async function increment(metric: Metric, dimensions: Dimensions) {
  // New system (aggregate)
  await aggregate.increment(metric, dimensions);

  // Legacy system (for validation)
  if (DUAL_WRITE_ENABLED) {
    await legacyAnalytics.track(metric, dimensions);
  }
}
```

### Phase 3: Validation

Compare aggregate totals between systems:

```typescript
// Daily validation job
async function validateParity() {
  const newCounts = await db.analytics_aggregate.aggregate({
    where: { date: today },
    _sum: { count: true }
  });

  const legacyCounts = await db.analytics_event.count({
    where: { timestamp: { gte: startOfDay(today) } }
  });

  // Allow 5% variance due to timing differences
  const variance = Math.abs(newCounts - legacyCounts) / legacyCounts;
  if (variance > 0.05) {
    alertOperations('Analytics parity check failed');
  }
}
```

### Phase 4: Legacy Read Deprecation

Update all read paths to use new endpoints:

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `GET /api/analytics/events` | `GET /api/analytics/aggregate` |
| `GET /api/analytics/sessions` | Removed (no sessions) |
| `GET /api/analytics/funnel` | `GET /api/analytics/cohort` |
| `GET /api/analytics/percolation` | Updated to use aggregates |

### Phase 5: Legacy Removal

```bash
# Remove legacy tables
npx prisma migrate dev --name remove_legacy_analytics

# Remove legacy code
rm src/lib/core/analytics/database.ts
rm src/lib/core/analytics/funnel.ts
rm src/lib/types/analytics.ts
rm src/routes/api/analytics/events/+server.ts
```

---

## Component Updates Required

### High Priority

| Component | Current Usage | New Usage |
|-----------|--------------|-----------|
| `+layout.js` | `analytics.pageView()` | `client.increment('page_view')` |
| `s/[slug]/+page.svelte` | `funnelAnalytics.trackTemplateView()` | `client.increment('template_view', { template_id })` |
| `AnalyticsDashboard.svelte` | Queries `analytics_event` | Queries `analytics_aggregate` |

### Medium Priority

| Component | Action |
|-----------|--------|
| `percolation-engine.ts` | Switch from event-based to aggregate-based cascade analysis |
| `AdminAnalytics.svelte` | Use new `/api/analytics/health` endpoint |

### Low Priority

| Component | Action |
|-----------|--------|
| Test files | Update mocks to new schema |
| Storybook | Update analytics props |

---

## Rollback Plan

If critical issues arise:

### Phase 1-2 Rollback
```bash
# Revert schema changes
npx prisma migrate dev --name revert_analytics

# Re-enable legacy-only writes
ANALYTICS_MODE=legacy npm run dev
```

### Phase 3-4 Rollback
```bash
# Switch reads back to legacy
ANALYTICS_READS=legacy npm run dev

# Dual-write continues, legacy becomes primary
```

### Phase 5 Rollback
```bash
# Restore from git
git checkout HEAD~1 -- src/lib/core/analytics/database.ts
git checkout HEAD~1 -- src/lib/core/analytics/funnel.ts

# Restore tables from backup
pg_restore --table=analytics_session --table=analytics_event backup.dump
```

---

## Verification Checklist

### Before Legacy Removal

- [ ] New system handles 100% of writes for 7 days
- [ ] Dashboard shows correct metrics from new system
- [ ] Percolation analysis produces valid results
- [ ] No imports from `database.ts` or `funnel.ts` remain
- [ ] `grep -r "analytics_session\|analytics_event" src/` returns nothing
- [ ] All tests pass with new system only

### After Legacy Removal

- [ ] `npm run build` succeeds
- [ ] `npm run check` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] Production deployment succeeds
- [ ] Monitoring shows no errors for 24h

---

## Data Preservation

We are **not** migrating historical event data to aggregates because:

1. Individual events contain PII we don't want
2. Retroactive aggregation would be inaccurate (noise parameters differ)
3. Clean break is philosophically correct

Historical data will be:

1. Exported to secure archive (30 days)
2. Verified export integrity
3. Dropped from production database
4. Archive deleted after 90 days

---

*Migration Specification | 2025-01*
