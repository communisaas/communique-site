# Analytics Consolidation - Breaking Changes

## Overview

This document outlines the breaking changes introduced by the analytics consolidation (8→3 models) and provides migration guidance for application code.

## Database Schema Changes

### ✅ Completed Changes

#### 1. Models Removed (5)
- `analytics_event_property` → Merged into `analytics_event.properties` (JSONB)
- `analytics_funnel` → Merged into `analytics_experiment` (type='funnel')
- `analytics_funnel_step` → Merged into `analytics_experiment.config` (JSONB)
- `analytics_campaign` → Merged into `analytics_experiment` (type='campaign') 
- `analytics_variation` → Merged into `analytics_experiment` (type='ab_test')

#### 2. Models Enhanced (2)
- `user_session` → **Renamed** to `analytics_session` with JSONB consolidation
- `analytics_event` → Enhanced with JSONB properties and unified experiment relations

#### 3. Models Added (1)
- `analytics_experiment` → New unified model for campaigns, funnels, and A/B tests

## API Breaking Changes

### 1. Session Data Access

#### ❌ Before (Direct Column Access):
```typescript
// OLD: Direct database columns
interface UserSession {
  id: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
  fingerprint?: string;
  events_count: number;
  page_views: number;
}
```

#### ✅ After (JSONB Structure):
```typescript
// NEW: Consolidated JSONB structure
interface AnalyticsSession {
  session_id: string; // Now primary key
  user_id?: string;
  device_data: {
    ip_address?: string;
    user_agent?: string;
    fingerprint?: string;
  };
  session_metrics: {
    events_count: number;
    page_views: number;
    conversion_data?: any;
  };
  funnel_progress: Record<string, any>;
}
```

### 2. Event Properties Access

#### ❌ Before (Separate Table Join):
```typescript
// OLD: Separate property records
interface AnalyticsEvent {
  id: string;
  name: string;
  properties: Array<{
    name: string;
    value: string;
  }>;
}

// Query required JOIN
const eventWithProperties = await prisma.analytics_event.findUnique({
  where: { id },
  include: { properties: true }
});
```

#### ✅ After (JSONB Properties):
```typescript
// NEW: Direct JSONB access
interface AnalyticsEvent {
  id: string;
  name: string;
  event_type: 'pageview' | 'interaction' | 'conversion' | 'funnel' | 'campaign';
  template_id?: string;
  funnel_step?: number;
  experiment_id?: string;
  properties: Record<string, any>; // JSONB
  computed_metrics: Record<string, any>; // JSONB
}

// No JOIN required
const event = await prisma.analytics_event.findUnique({
  where: { id }
});
```

### 3. Experiment Data Consolidation

#### ❌ Before (Multiple Tables):
```typescript
// OLD: Separate models
interface AnalyticsFunnel {
  id: string;
  name: string;
  steps: AnalyticsFunnelStep[];
}

interface AnalyticsCampaign {
  id: string;
  name: string;
  budget?: number;
}

interface AnalyticsVariation {
  id: string;
  name: string;
}
```

#### ✅ After (Unified Model):
```typescript
// NEW: Single experiment model
interface AnalyticsExperiment {
  id: string;
  name: string;
  type: 'funnel' | 'campaign' | 'ab_test';
  status: 'active' | 'paused' | 'completed';
  config: {
    // For funnels
    steps?: Array<{ name: string; order: number }>;
    // For campaigns  
    budget?: number;
    // For A/B tests
    variations?: Array<{ name: string; weight: number }>;
  };
  start_date?: Date;
  end_date?: Date;
  metrics_cache: Record<string, any>;
}
```

## Code Migration Examples

### 1. Session Data Access

#### ❌ Before:
```typescript
// Get session with metrics
const session = await prisma.user_session.findUnique({
  where: { session_id: sessionId }
});

const ipAddress = session?.ip_address;
const eventCount = session?.events_count;
```

#### ✅ After:
```typescript
// Get session with JSONB access
const session = await prisma.analytics_session.findUnique({
  where: { session_id: sessionId }
});

const ipAddress = session?.device_data?.ip_address;
const eventCount = session?.session_metrics?.events_count;
```

### 2. Event Property Queries

#### ❌ Before:
```typescript
// Complex JOIN query for properties
const eventsWithProps = await prisma.analytics_event.findMany({
  where: { session_id: sessionId },
  include: {
    properties: {
      where: { name: 'button_id' }
    }
  }
});

const buttonClicks = eventsWithProps.filter(e => 
  e.properties.some(p => p.name === 'button_id')
);
```

#### ✅ After:
```typescript
// Direct JSONB query
const buttonClicks = await prisma.analytics_event.findMany({
  where: {
    session_id: sessionId,
    properties: {
      path: ['button_id'],
      not: null
    }
  }
});

// Or with JSONB operators
const buttonClicks = await prisma.$queryRaw`
  SELECT * FROM analytics_event 
  WHERE session_id = ${sessionId}
    AND properties ? 'button_id'
`;
```

### 3. Funnel Analysis

#### ❌ Before:
```typescript
// Multiple table queries
const funnel = await prisma.analytics_funnel.findUnique({
  where: { id: funnelId },
  include: { steps: { orderBy: { step_order: 'asc' } } }
});

const funnelEvents = await prisma.analytics_event.findMany({
  where: { funnel_id: funnelId }
});
```

#### ✅ After:
```typescript
// Single experiment query
const funnelExperiment = await prisma.analytics_experiment.findUnique({
  where: { id: experimentId, type: 'funnel' },
  include: { events: true }
});

const steps = funnelExperiment?.config?.steps;
const events = funnelExperiment?.events;
```

## Component Migration Checklist

### 1. Search for Usage Patterns

```bash
# Find files using old analytics models
grep -r "user_session" src/
grep -r "analytics_event_property" src/
grep -r "analytics_funnel" src/
grep -r "analytics_campaign" src/
grep -r "analytics_variation" src/

# Find specific field access patterns
grep -r "\.ip_address" src/
grep -r "\.user_agent" src/
grep -r "\.events_count" src/
grep -r "\.page_views" src/
```

### 2. Common Migration Patterns

#### Session Components:
```typescript
// Update session access patterns
// OLD: session.ip_address
// NEW: session.device_data.ip_address

// OLD: session.events_count  
// NEW: session.session_metrics.events_count
```

#### Event Tracking Components:
```typescript
// Update event property handling
// OLD: event.properties.find(p => p.name === 'key')?.value
// NEW: event.properties.key
```

#### Analytics Dashboard Components:
```typescript
// Update experiment queries
// OLD: separate funnel, campaign, variation queries
// NEW: unified analytics_experiment queries with type filtering
```

### 3. TypeScript Type Updates

Update your TypeScript types to match the new schema structure. Consider using Prisma's generated types:

```typescript
import type { 
  analytics_session,
  analytics_event, 
  analytics_experiment 
} from '@prisma/client';

// Or create custom interfaces that match your usage
interface SessionWithMetrics extends analytics_session {
  deviceInfo: {
    ipAddress?: string;
    userAgent?: string;
  };
  metrics: {
    eventCount: number;
    pageViews: number;
  };
}
```

## Performance Considerations

### 1. JSONB Query Optimization

#### Enable JSONB Indexes:
```sql
-- Add GIN indexes for JSONB fields
CREATE INDEX idx_analytics_event_properties ON analytics_event USING GIN (properties);
CREATE INDEX idx_analytics_session_device_data ON analytics_session USING GIN (device_data);
CREATE INDEX idx_analytics_experiment_config ON analytics_experiment USING GIN (config);
```

#### Efficient JSONB Queries:
```typescript
// Use JSONB operators for better performance
const events = await prisma.$queryRaw`
  SELECT * FROM analytics_event 
  WHERE properties @> '{"page": "dashboard"}'::jsonb
`;

// Use JSON path queries
const sessions = await prisma.analytics_session.findMany({
  where: {
    device_data: {
      path: ['user_agent'],
      string_contains: 'Chrome'
    }
  }
});
```

### 2. Query Pattern Changes

#### Before (Multiple JOINs):
```sql
-- OLD: 4-table JOIN for event with properties
SELECT e.*, p.name, p.value, f.name as funnel_name
FROM analytics_event e
LEFT JOIN analytics_event_property p ON e.id = p.event_id  
LEFT JOIN analytics_funnel f ON e.funnel_id = f.id
WHERE e.session_id = ?
```

#### After (Single Table):
```sql
-- NEW: Single table with JSONB
SELECT e.*, exp.name as experiment_name, exp.type
FROM analytics_event e
LEFT JOIN analytics_experiment exp ON e.experiment_id = exp.id
WHERE e.session_id = ?
```

## Testing Migration

### 1. Data Integrity Tests
```typescript
// Verify property migration
test('event properties migrated correctly', async () => {
  const event = await prisma.analytics_event.findFirst();
  expect(event.properties).toBeDefined();
  expect(typeof event.properties).toBe('object');
});

// Verify session consolidation
test('session data consolidated', async () => {
  const session = await prisma.analytics_session.findFirst();
  expect(session.device_data).toBeDefined();
  expect(session.session_metrics).toBeDefined();
});
```

### 2. Performance Tests
```typescript
// Compare query performance
test('JSONB queries perform well', async () => {
  const start = Date.now();
  
  const events = await prisma.analytics_event.findMany({
    where: {
      properties: {
        path: ['button_id'], 
        equals: 'submit'
      }
    }
  });
  
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(100); // Should be fast
});
```

## Rollback Procedures

### 1. Emergency Rollback
If critical issues are discovered:

1. **Database**: Restore from pre-migration backup
2. **Application**: Deploy previous version from git
3. **Cache**: Clear any cached analytics data
4. **Monitoring**: Verify all analytics functions restored

### 2. Partial Rollback
For specific component issues:

1. **Feature Flag**: Disable new analytics features
2. **Gradual Migration**: Roll back specific components
3. **Hybrid Approach**: Use both old and new patterns temporarily

## Support Resources

### 1. Documentation
- [Prisma JSONB Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields)
- [PostgreSQL JSONB Operators](https://www.postgresql.org/docs/current/functions-json.html)

### 2. Migration Scripts
- Full migration script: `/docs/ANALYTICS-MIGRATION-STRATEGY.md`
- Rollback script: Available in project backup procedures

### 3. Monitoring
- Query performance metrics
- Error rate monitoring for analytics endpoints
- Data consistency validation

---

## Summary

The analytics consolidation provides significant benefits:
- **Performance**: 8→3 models reduces JOIN complexity
- **Flexibility**: JSONB fields allow dynamic properties
- **Maintenance**: Unified experiment model simplifies tracking

However, it requires careful migration of existing code to use the new JSONB-based structure and unified experiment model.