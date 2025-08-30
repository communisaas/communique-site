# Database Schema Organization

This directory contains multiple Prisma schema files organized by feature maturity and purpose.

## Schema Files

### `schema.prisma` (Current Production)
The existing schema with all models. **This will be replaced** with `schema-production.prisma` in the next migration.

### `schema-production.prisma` (Recommended Production)
Clean schema containing only core production models:
- User authentication & sessions
- Template creation & delivery
- Congressional routing
- Legislative channels (beta)

**Models**: 9 core production models only

### `features.prisma` (Feature-Flagged Models)
Models for features that can be enabled/disabled:
- AI suggestions (ROADMAP)
- Template personalization (ROADMAP) 
- User activation tracking (BETA)
- Variable resolution (ROADMAP)
- Advanced analytics (BETA)

**Models**: 12 feature-flagged models

### `experimental.prisma` (Research Models)
Research and experimental models:
- Political field theory
- Community intersection analysis
- Sheaf fusion theory
- Template morphisms

**Models**: 12+ research models

### `core.prisma` (Alternative Core)
Alternative organization of core models (similar to schema-production.prisma).

## Migration Strategy

### Current State
```
schema.prisma (all models) → Prisma Client
```

### Target State
```
schema-production.prisma (core only) → Prisma Client
features.prisma (feature flags) → Feature Client (conditional)
experimental.prisma (research) → Research Client (dev only)
```

## Using Feature-Flagged Models

Feature-flagged models are conditionally included based on environment variables:

```typescript
import { isFeatureEnabled } from '$lib/features/config';

// Check if model is available
if (isFeatureEnabled('AI_SUGGESTIONS')) {
  // Use ai_suggestions model
  const suggestions = await db.ai_suggestions.findMany({...});
}
```

### Environment Variables

```bash
# Enable beta features
ENABLE_BETA=true

# Enable research features (dev only)
ENABLE_RESEARCH=true
```

## Model Categories

### Core Production (Always Available)
- `User` - User accounts and profiles
- `Session` - Authentication sessions  
- `account` - OAuth account linking
- `Template` - Template definitions
- `template_campaign` - Template usage tracking
- `representative` - Congressional representatives
- `user_representatives` - User-representative relationships
- `congressional_office` - Congressional office data
- `legislative_channel` - Multi-country delivery channels
- `legislative_body` - Legislative body definitions

### Beta Features (ENABLE_BETA=true)
- `user_activation` - Viral cascade tracking
- `user_coordinates` - User location data
- `cascade_event` - Cascade analytics events

### Roadmap Features (Planned Implementation)
- `ai_suggestions` - AI-powered template suggestions
- `user_writing_style` - User writing style analysis
- `template_analytics` - Template performance analytics
- `template_personalization` - User template customizations
- `template_adaptation` - Location-based adaptations
- `resolved_variable` - Variable resolution cache
- `data_source_config` - External data source configs

### Research Models (ENABLE_RESEARCH=true)
- `political_field_state` - Political field vector states
- `political_flow` - Information flow modeling
- `political_uncertainty` - Uncertainty quantification
- `political_dead_end` - Engagement dead ends
- `community_intersection` - Community overlap analysis
- `local_political_bubble` - Political bubble detection
- `community_lifecycle` - Community evolution tracking
- `template_morphism` - Template transformation mappings
- `user_context_stack` - Contextual information stacks
- `research_experiment` - Research experiment metadata

## Database Commands

```bash
# Generate client for current schema
npm run db:generate

# Push current schema to database  
npm run db:push

# Migrate to production schema (future)
npm run db:migrate-production

# View database
npm run db:studio
```

## Development Workflow

1. **Production features**: Add to `schema-production.prisma`
2. **Beta features**: Add to `features.prisma` with feature flag
3. **Research**: Add to `experimental.prisma` with ENABLE_RESEARCH guard
4. **Testing**: Use separate test database with all schemas enabled

## Schema Validation

Each schema file is validated independently:

```bash
# Validate production schema
npx prisma validate --schema=prisma/schema-production.prisma

# Validate features schema
npx prisma validate --schema=prisma/features.prisma

# Validate experimental schema  
npx prisma validate --schema=prisma/experimental.prisma
```

## Performance Considerations

### Production Benefits
- **Smaller client**: Only core models compiled
- **Faster queries**: Fewer indexes and relations
- **Better caching**: Focused on high-traffic queries
- **Cleaner migrations**: No experimental schema changes

### Development Benefits
- **Clear boundaries**: Know what's production vs research
- **Safe experimentation**: Research won't break production
- **Progressive rollout**: Beta → Production pathway
- **Academic preservation**: Research models preserved for papers

## Questions?

- **Schema questions**: See database documentation
- **Feature flags**: See `src/lib/features/config.ts`
- **Research models**: See `docs/architecture/mathematical-foundations-cid.md`