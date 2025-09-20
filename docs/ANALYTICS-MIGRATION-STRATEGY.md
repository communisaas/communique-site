# Analytics Consolidation Migration Strategy

## Overview

This document outlines the migration strategy for consolidating the analytics models from **8 models → 3 models** as part of our aggressive database normalization initiative.

## Migration Summary

### Models Being Removed (5)
1. `analytics_event_property` → Merged into `analytics_event.properties` (JSONB)
2. `analytics_funnel` → Merged into `analytics_experiment` (type='funnel')
3. `analytics_funnel_step` → Merged into `analytics_experiment.config` (JSONB)
4. `analytics_campaign` → Merged into `analytics_experiment` (type='campaign')
5. `analytics_variation` → Merged into `analytics_experiment` (type='ab_test')

### Models Being Enhanced (2)
1. `user_session` → Renamed to `analytics_session` with JSONB consolidation
2. `analytics_event` → Enhanced with JSONB properties and unified experiment relations

### Models Being Added (1)
1. `analytics_experiment` → New unified model for campaigns, funnels, and A/B tests

## Detailed Migration Steps

### Step 1: Data Migration for `analytics_session`

```sql
-- Migrate user_session to analytics_session
INSERT INTO analytics_session (
  session_id,
  user_id,
  created_at,
  updated_at,
  utm_source,
  utm_medium,
  utm_campaign,
  landing_page,
  referrer,
  device_data,
  session_metrics,
  funnel_progress
)
SELECT 
  session_id,
  user_id,
  created_at,
  updated_at,
  utm_source,
  utm_medium,
  utm_campaign,
  landing_page,
  referrer,
  -- Consolidate device data into JSONB
  json_build_object(
    'ip_address', ip_address,
    'user_agent', user_agent,
    'fingerprint', fingerprint
  ) as device_data,
  -- Consolidate session metrics into JSONB
  json_build_object(
    'events_count', events_count,
    'page_views', page_views
  ) as session_metrics,
  '{}' as funnel_progress -- Empty JSONB for new field
FROM user_session;
```

### Step 2: Migrate Analytics Experiments

```sql
-- 2a. Migrate analytics_funnel to analytics_experiment
INSERT INTO analytics_experiment (
  id,
  name,
  type,
  status,
  config,
  start_date,
  end_date,
  metrics_cache,
  created_at,
  updated_at
)
SELECT 
  f.id,
  f.name,
  'funnel' as type,
  'active' as status,
  -- Build funnel config from steps
  json_build_object(
    'description', f.description,
    'steps', (
      SELECT json_agg(
        json_build_object(
          'name', fs.name,
          'order', fs.step_order
        ) ORDER BY fs.step_order
      )
      FROM analytics_funnel_step fs 
      WHERE fs.funnel_id = f.id
    )
  ) as config,
  NULL as start_date,
  NULL as end_date,
  '{}' as metrics_cache,
  f.created_at,
  f.created_at as updated_at
FROM analytics_funnel f;

-- 2b. Migrate analytics_campaign to analytics_experiment
INSERT INTO analytics_experiment (
  id,
  name,
  type,
  status,
  config,
  start_date,
  end_date,
  metrics_cache,
  created_at,
  updated_at
)
SELECT 
  id,
  name,
  'campaign' as type,
  CASE 
    WHEN end_date IS NULL OR end_date > NOW() THEN 'active'
    ELSE 'completed'
  END as status,
  json_build_object(
    'description', description,
    'budget', budget
  ) as config,
  start_date,
  end_date,
  '{}' as metrics_cache,
  start_date as created_at,
  start_date as updated_at
FROM analytics_campaign;

-- 2c. Migrate analytics_variation to analytics_experiment
INSERT INTO analytics_experiment (
  id,
  name,
  type,
  status,
  config,
  start_date,
  end_date,
  metrics_cache,
  created_at,
  updated_at
)
SELECT 
  id,
  name,
  'ab_test' as type,
  'active' as status,
  json_build_object(
    'description', description
  ) as config,
  NULL as start_date,
  NULL as end_date,
  '{}' as metrics_cache,
  NOW() as created_at,
  NOW() as updated_at
FROM analytics_variation;
```

### Step 3: Migrate Analytics Events

```sql
-- Update analytics_event with new structure
UPDATE analytics_event SET
  event_type = CASE 
    WHEN funnel_id IS NOT NULL THEN 'funnel'
    WHEN campaign_id IS NOT NULL THEN 'campaign'
    WHEN variation_id IS NOT NULL THEN 'conversion'
    ELSE 'interaction'
  END,
  experiment_id = COALESCE(funnel_id, campaign_id, variation_id),
  -- Migrate event properties to JSONB
  properties = (
    SELECT json_object_agg(aep.name, aep.value)
    FROM analytics_event_property aep
    WHERE aep.event_id = analytics_event.id
  ),
  computed_metrics = '{}',
  created_at = timestamp;

-- Clean up old foreign key columns
ALTER TABLE analytics_event 
DROP COLUMN funnel_id,
DROP COLUMN campaign_id,
DROP COLUMN variation_id;
```

## Breaking Changes to Address

### 1. Database Schema Changes
- **Foreign Key Updates**: Any code referencing `user_session` must be updated to `analytics_session`
- **Column Removals**: Direct access to `ip_address`, `user_agent`, `fingerprint` must be updated to use `device_data` JSONB
- **Property Access**: Event properties now accessed via JSONB field instead of separate table

### 2. API Response Changes

#### Before (Event Properties):
```typescript
// Old structure
interface AnalyticsEvent {
  id: string;
  name: string;
  properties: Array<{
    name: string;
    value: string;
  }>;
}
```

#### After (JSONB Properties):
```typescript
// New structure
interface AnalyticsEvent {
  id: string;
  name: string;
  event_type: 'pageview' | 'interaction' | 'conversion' | 'funnel' | 'campaign';
  properties: Record<string, any>; // JSONB
  computed_metrics: Record<string, any>; // JSONB
}
```

### 3. Query Pattern Changes

#### Before (Join-based):
```sql
SELECT e.name, p.name as prop_name, p.value as prop_value
FROM analytics_event e
JOIN analytics_event_property p ON e.id = p.event_id
WHERE e.session_id = ?;
```

#### After (JSONB-based):
```sql
SELECT e.name, e.properties
FROM analytics_event e
WHERE e.session_id = ?;
```

### 4. Component Updates Required

#### Files Likely Affected:
- Any analytics dashboard components
- Event tracking utilities
- Session management code
- Funnel/campaign reporting components

#### Search Patterns:
```bash
# Find components using old analytics models
grep -r "analytics_event_property" src/
grep -r "user_session" src/
grep -r "analytics_funnel" src/
grep -r "analytics_campaign" src/
```

## Performance Benefits

### 1. Reduced Joins
- **Before**: 4-table joins for event data with properties
- **After**: Single table query with JSONB access

### 2. Improved Indexing
- JSONB GIN indexes for property searches
- Consolidated session data reduces lookup complexity
- Unified experiment tracking eliminates duplicate queries

### 3. Storage Efficiency
- **Before**: 8 separate tables with overhead
- **After**: 3 optimized tables with JSONB compression

## Testing Strategy

### 1. Data Integrity Verification
```sql
-- Verify event property migration
SELECT 
  COUNT(*) as old_properties,
  (SELECT COUNT(*) FROM analytics_event WHERE properties != '{}') as migrated_events
FROM analytics_event_property;

-- Verify experiment consolidation
SELECT 
  (SELECT COUNT(*) FROM analytics_funnel) + 
  (SELECT COUNT(*) FROM analytics_campaign) + 
  (SELECT COUNT(*) FROM analytics_variation) as old_experiments,
  (SELECT COUNT(*) FROM analytics_experiment) as new_experiments;
```

### 2. Performance Testing
- Compare query performance before/after migration
- Test JSONB query patterns for property searches
- Validate index effectiveness on new structure

### 3. Application Testing
- Test all analytics dashboards
- Verify event tracking still works
- Confirm session management functions
- Test funnel and campaign reporting

## Rollback Plan

### Emergency Rollback Steps
1. **Restore from backup**: Keep full database backup before migration
2. **Revert schema**: Use Prisma migration rollback
3. **Update application code**: Revert to pre-migration code branch

### Rollback Time Estimate
- **Database restore**: ~15 minutes (depends on data size)
- **Code deployment**: ~5 minutes
- **Verification**: ~10 minutes
- **Total**: ~30 minutes maximum downtime

## Migration Timeline

### Phase 1: Schema Migration (1 hour)
1. Create new consolidated models
2. Run data migration scripts
3. Verify data integrity

### Phase 2: Application Updates (2 hours)
1. Update Prisma client generation
2. Update analytics utilities
3. Update affected components
4. Test critical paths

### Phase 3: Cleanup (30 minutes)
1. Drop old tables
2. Remove unused indexes
3. Update documentation

### Total Estimated Time: 3.5 hours

## Post-Migration Validation

### Critical Checks
- [ ] All analytics events have properties migrated
- [ ] Session data is accessible via new structure
- [ ] Experiments are properly categorized
- [ ] Performance benchmarks meet expectations
- [ ] No application errors in analytics flows

### Monitoring
- Track query performance metrics
- Monitor JSONB field access patterns
- Watch for any data inconsistencies
- Verify analytics dashboard functionality

## Notes

- **Pre-launch**: This migration is acceptable since we're pre-launch
- **JSONB Performance**: PostgreSQL JSONB is optimized for this use case
- **Template Analytics**: Kept separate for Phase 4 optimization
- **Backup Strategy**: Full backup before migration start
- **Feature Flags**: Consider analytics feature flags during migration