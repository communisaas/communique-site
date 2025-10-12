# Feature Flags

**Status**: ✅ IMPLEMENTED | Enum-Based Feature Management System

---

**Centralized feature flag system for controlling feature availability across development, beta, and production environments.**

## Overview

Communique uses a type-safe feature flag system to manage feature rollout from research to production. Features progress through defined stages, with environment variables controlling access.

**Feature Lifecycle**:
```
RESEARCH → ROADMAP → BETA → ON
```

**Location**: `src/lib/features/config.ts`

## Feature Status Enum

```typescript
enum FeatureStatus {
  OFF = 'off',              // Not available (disabled)
  BETA = 'beta',            // Available for testing (requires ENABLE_BETA=true)
  ON = 'on',                // Production ready (always enabled)
  RESEARCH = 'research',    // Experimental code (requires ENABLE_RESEARCH=true)
  ROADMAP = 'roadmap'       // Planned but not implemented
}
```

## Current Feature Registry

### Core Features (Always ON)

```typescript
TEMPLATE_CREATION: FeatureStatus.ON,
CONGRESSIONAL_ROUTING: FeatureStatus.ON,
OAUTH_LOGIN: FeatureStatus.ON,
EMAIL_DELIVERY: FeatureStatus.ON,
```

These features are production-stable and always available.

### Beta Features (Requires `ENABLE_BETA=true`)

```typescript
CASCADE_ANALYTICS: FeatureStatus.BETA,
LEGISLATIVE_CHANNELS: FeatureStatus.BETA,
VIRAL_PATTERN_GENERATOR: FeatureStatus.BETA,
```

**Enable in development**:
```bash
ENABLE_BETA=true npm run dev
```

**Enable in production** (use caution):
```bash
ENABLE_BETA=true npm run build && npm run preview
```

### Roadmap Features (Planned, Not Implemented)

```typescript
AI_SUGGESTIONS: FeatureStatus.ROADMAP,
VARIABLE_RESOLUTION: FeatureStatus.ROADMAP,
TEMPLATE_PERSONALIZATION: FeatureStatus.ROADMAP,
USER_WRITING_STYLE: FeatureStatus.ROADMAP,
```

These features are documented in `docs/roadmap.md` but not yet built. Checking these flags will always return `false`.

### Research Features (Experimental, Requires `ENABLE_RESEARCH=true`)

```typescript
POLITICAL_FIELD_MODELING: FeatureStatus.RESEARCH,
SHEAF_FUSION: FeatureStatus.RESEARCH,
PERCOLATION_ENGINE: FeatureStatus.RESEARCH,
COMMUNITY_INTERSECTION: FeatureStatus.RESEARCH,
```

**Enable in development only**:
```bash
ENABLE_RESEARCH=true npm run dev
```

**DO NOT enable in production**. These are experimental mathematical models for research purposes.

## Usage

### TypeScript/JavaScript

```typescript
import { isFeatureEnabled, FEATURES } from '$lib/features/config';

// Check if feature is enabled
if (isFeatureEnabled('CASCADE_ANALYTICS')) {
  // Render cascade analytics dashboard
  loadCascadeAnalytics();
}

// Get feature status
import { getFeatureStatus, FeatureStatus } from '$lib/features/config';

const status = getFeatureStatus('AI_SUGGESTIONS');
if (status === FeatureStatus.ROADMAP) {
  console.log('This feature is planned but not yet implemented');
}
```

### Svelte Components

```svelte
<script lang="ts">
  import { useFeature } from '$lib/features/config';

  const showBetaFeatures = useFeature('CASCADE_ANALYTICS');
</script>

{#if showBetaFeatures}
  <CascadeAnalyticsDashboard />
{/if}
```

### Server-Side (API Routes)

```typescript
// src/routes/api/analytics/cascade/+server.ts
import { isFeatureEnabled } from '$lib/features/config';

export async function GET() {
  if (!isFeatureEnabled('CASCADE_ANALYTICS')) {
    return new Response('Feature not enabled', { status: 403 });
  }

  // Process cascade analytics request
  const data = await getCascadeData();
  return new Response(JSON.stringify(data));
}
```

## Environment Variables

### Development (`.env`)

```bash
# Enable beta features for testing
ENABLE_BETA=true

# Enable research features (experimental)
ENABLE_RESEARCH=true

# Node environment
NODE_ENV=development
```

### Production (`.env.production`)

```bash
# Only enable thoroughly tested beta features
ENABLE_BETA=false  # Default: disable beta in production

# NEVER enable research in production
ENABLE_RESEARCH=false

# Node environment
NODE_ENV=production
```

### Testing (`.env.test`)

```bash
# Enable all features for comprehensive testing
ENABLE_BETA=true
ENABLE_RESEARCH=true

NODE_ENV=test
```

## Helper Functions

### `isFeatureEnabled(feature: FeatureName): boolean`

Check if a feature is currently enabled based on its status and environment variables.

```typescript
const enabled = isFeatureEnabled('CASCADE_ANALYTICS');
// Returns true if:
// - Status is ON, OR
// - Status is BETA and ENABLE_BETA=true, OR
// - Status is RESEARCH and ENABLE_RESEARCH=true
```

### `getFeatureStatus(feature: FeatureName): FeatureStatus`

Get the current status of a feature.

```typescript
const status = getFeatureStatus('AI_SUGGESTIONS');
// Returns: FeatureStatus.ROADMAP
```

### `isFeatureInDevelopment(feature: FeatureName): boolean`

Check if a feature is in active development (BETA or RESEARCH).

```typescript
const inDev = isFeatureInDevelopment('CASCADE_ANALYTICS');
// Returns: true (BETA status)
```

### `getFeaturesByStatus(status: FeatureStatus): FeatureName[]`

Get all features with a specific status.

```typescript
const betaFeatures = getFeaturesByStatus(FeatureStatus.BETA);
// Returns: ['CASCADE_ANALYTICS', 'LEGISLATIVE_CHANNELS', 'VIRAL_PATTERN_GENERATOR']

const coreFeatures = getFeaturesByStatus(FeatureStatus.ON);
// Returns: ['TEMPLATE_CREATION', 'CONGRESSIONAL_ROUTING', 'OAUTH_LOGIN', 'EMAIL_DELIVERY']
```

## Feature Promotion Path

### Research → Roadmap
1. Complete experimental validation
2. Document findings
3. Update status: `RESEARCH` → `ROADMAP`
4. Add to `docs/roadmap.md` with implementation plan

### Roadmap → Beta
1. Implement core functionality
2. Write tests (unit + integration)
3. Update status: `ROADMAP` → `BETA`
4. Document in appropriate doc (e.g., `docs/features/`)

### Beta → Production (ON)
1. Complete all tests (unit, integration, E2E)
2. User testing with beta flag enabled
3. Performance validation
4. Security review
5. Update status: `BETA` → `ON`
6. Announce in changelog

### Example Promotion

```typescript
// Initial: Research phase
SHEAF_FUSION: FeatureStatus.RESEARCH,

// After validation: Move to roadmap
SHEAF_FUSION: FeatureStatus.ROADMAP,

// After implementation: Move to beta
SHEAF_FUSION: FeatureStatus.BETA,

// After production validation: Enable for all
SHEAF_FUSION: FeatureStatus.ON,
```

## Testing

### Test Feature Flags

```typescript
// tests/unit/feature-flags.test.ts
import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, FeatureStatus, FEATURES } from '$lib/features/config';

describe('Feature Flags', () => {
  it('should enable ON features', () => {
    expect(isFeatureEnabled('TEMPLATE_CREATION')).toBe(true);
  });

  it('should respect ENABLE_BETA flag', () => {
    process.env.ENABLE_BETA = 'true';
    expect(isFeatureEnabled('CASCADE_ANALYTICS')).toBe(true);

    process.env.ENABLE_BETA = 'false';
    expect(isFeatureEnabled('CASCADE_ANALYTICS')).toBe(false);
  });

  it('should disable ROADMAP features', () => {
    expect(isFeatureEnabled('AI_SUGGESTIONS')).toBe(false);
  });
});
```

### Integration Tests with Feature Flags

```typescript
// Run tests with beta features enabled
ENABLE_BETA=true npm run test:integration

// Run tests with research features enabled
ENABLE_RESEARCH=true npm run test:unit
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
jobs:
  test-core:
    name: Test Core Features
    env:
      ENABLE_BETA: false
      ENABLE_RESEARCH: false
    steps:
      - run: npm test

  test-beta:
    name: Test Beta Features
    env:
      ENABLE_BETA: true
      ENABLE_RESEARCH: false
    steps:
      - run: npm test

  test-research:
    name: Test Research Features (Optional)
    env:
      ENABLE_BETA: true
      ENABLE_RESEARCH: true
    continue-on-error: true
    steps:
      - run: npm test
```

## Adding New Features

1. **Add to Feature Registry**:
```typescript
// src/lib/features/config.ts
export const FEATURES = {
  // ... existing features
  NEW_FEATURE_NAME: FeatureStatus.BETA,  // Start with BETA or RESEARCH
} as const;
```

2. **Use in Code**:
```typescript
import { isFeatureEnabled } from '$lib/features/config';

if (isFeatureEnabled('NEW_FEATURE_NAME')) {
  // Feature implementation
}
```

3. **Document**:
- Add to `docs/features/` directory
- Update this file with feature description
- Add to roadmap if status is ROADMAP

4. **Test**:
```typescript
// tests/integration/new-feature.test.ts
describe('New Feature', () => {
  it('should work when flag is enabled', () => {
    process.env.ENABLE_BETA = 'true';
    // Test implementation
  });
});
```

## Best Practices

### ✅ DO

- Start new features in `RESEARCH` or `BETA` status
- Use feature flags for gradual rollout
- Test features in isolation before enabling in production
- Document feature dependencies
- Remove flags after features are stable and `ON` for 2+ releases

### ❌ DON'T

- Don't check feature flags in hot paths (cache the result)
- Don't nest feature flags deeply (refactor into separate modules)
- Don't enable `RESEARCH` features in production
- Don't leave stale flags in codebase (clean up after promotion)
- Don't hardcode feature checks (always use `isFeatureEnabled()`)

## Security Considerations

- Feature flags are **not** for security (use proper authorization)
- Beta features should still be secure (not just "MVP quality")
- Research features may bypass security checks (development only)
- Always validate user permissions regardless of feature status

## Performance

### Flag Check Performance

Feature flag checks are O(1) lookups with no runtime overhead:

```typescript
// Cached at module load
const FEATURES = { ... };  // Static object

// Fast lookup
function isFeatureEnabled(feature) {
  const status = FEATURES[feature];  // O(1)
  // ... env check is also O(1)
}
```

### Optimization Tip

For frequently checked flags, cache the result:

```typescript
// ❌ Don't check on every render
{#if isFeatureEnabled('CASCADE_ANALYTICS')}
  <Component />
{/if}

// ✅ Cache the result
<script>
  const showAnalytics = isFeatureEnabled('CASCADE_ANALYTICS');
</script>

{#if showAnalytics}
  <Component />
{/if}
```

## Monitoring

### Track Feature Usage

```typescript
import { analytics } from '$lib/core/analytics';

if (isFeatureEnabled('CASCADE_ANALYTICS')) {
  analytics.trackEvent({
    name: 'feature_used',
    properties: {
      feature: 'CASCADE_ANALYTICS',
      status: 'beta'
    }
  });
}
```

### Feature Adoption Metrics

- % of users with beta flag enabled
- Feature usage frequency
- Error rates per feature
- Performance impact of beta features

## Related Environment Variables

```bash
# Feature-specific flags (from .env.example)
ENABLE_CERTIFICATION=true             # Blockchain certification
ENABLE_CHALLENGE_MARKETS=true         # VOTER Protocol challenge markets
ENABLE_SUPPLY_OPTIMIZATION=true       # Algorithmic supply management

# General feature flags
ENABLE_BETA=false                     # Beta features
ENABLE_RESEARCH=false                 # Research features

# Environment
NODE_ENV=production                   # Controls secure cookies, logging, etc.
```

## Roadmap

### Near Term
- Feature flag analytics dashboard
- Per-user feature flags (A/B testing)
- Gradual rollout percentages (10% → 50% → 100%)

### Medium Term
- Remote feature flag management (no redeploy needed)
- Feature flag audit log (who enabled what when)
- Automatic flag cleanup detection

### Long Term
- Machine learning for optimal rollout timing
- Cross-platform flag synchronization
- Feature flag marketplace (third-party integrations)

## References

- **Code**: `src/lib/features/config.ts`
- **Roadmap**: `docs/roadmap.md`
- **Environment Setup**: `docs/dev-quickstart.md`
- **Testing**: `tests/README.md`

---

This feature flag system enables safe, gradual rollout of new features while maintaining production stability and developer velocity.
