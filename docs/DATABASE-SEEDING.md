# Database Seeding Guide

**Last Updated**: August 30, 2025

This guide covers the updated database seeding system that aligns with our reorganized codebase structure and feature flag system.

## Quick Start

```bash
# Seed everything (recommended)
npm run db:seed

# Seed specific components
npm run db:seed:core      # Templates, representatives, core data
npm run db:seed:channels  # Legislative channels (requires ENABLE_BETA=true)
npm run db:seed:features  # Feature-flagged data (requires flags)
```

## Overview

The seeding system was completely rewritten to:

✅ **Match Current Schema**: All scripts work with our current database models  
✅ **Respect Feature Flags**: Only seed data for enabled features  
✅ **Handle Dependencies**: Seed in correct order (users before activations, etc.)  
✅ **Support Development**: Different data for different stages  
✅ **Be Production-Safe**: Clear separation of test vs production data

## Seeding Scripts

### 1. Core Data (`seed-db-updated.ts`)

**Purpose**: Essential production data  
**Models**: Templates, Users, Representatives, Congressional Offices  
**Always runs**: Yes

```bash
npm run db:seed:core
```

**Seeds**:

- 5 high-impact advocacy templates
- Sample congressional representatives
- Congressional office records
- Proper geographic scoping (US federal, municipal)

### 2. Legislative Channels (`seed-legislative-channels-updated.ts`)

**Purpose**: Global legislative delivery system  
**Models**: `legislative_channel`, `legislative_body`  
**Requires**: `ENABLE_BETA=true`

```bash
ENABLE_BETA=true npm run db:seed:channels
```

**Seeds**:

- Email channels: Canada, UK, France, US states
- Form channels: Germany, some US states
- API channels: US Congress (CWC)
- Legislative body definitions

### 3. Feature Data (`seed-features.ts`)

**Purpose**: Data for feature-flagged models  
**Models**: Various feature-flagged models  
**Requires**: Specific feature flags

```bash
# Enable beta features first
ENABLE_BETA=true npm run db:seed:features

# For AI features (when implemented)
ENABLE_AI_FEATURES=true npm run db:seed:features
```

**Seeds**:

- User activation cascades (CASCADE_ANALYTICS)
- AI suggestions (AI_SUGGESTIONS)
- Template personalizations (TEMPLATE_PERSONALIZATION)
- Template analytics (CASCADE_ANALYTICS)

### 4. Orchestrator (`seed-all.ts`)

**Purpose**: Run all scripts in correct order  
**Intelligence**: Checks flags, handles dependencies

```bash
npm run db:seed
```

**Features**:

- Pre-flight database connectivity check
- Feature flag status report
- Dependency resolution
- Comprehensive error handling
- Final database state summary

## Environment Variables

Control which features get seeded:

```bash
# Core features (always enabled)
# No environment variables needed

# Beta features
ENABLE_BETA=true
PUBLIC_ENABLE_BETA=true  # For client-side checks

# Research features (development only)
ENABLE_RESEARCH=true

# Database connection
SUPABASE_DATABASE_URL=postgresql://...
# OR
DATABASE_URL=postgresql://...
```

## Data Categories

### Production Data ✅

Data that's safe for production environments:

- **Templates**: Real advocacy templates with proven effectiveness
- **Representatives**: Actual congressional representative data
- **Legislative Channels**: Real government email patterns and APIs
- **Geographic Data**: Real countries, states, jurisdictions

### Development Data 🛠️

Data for development and testing:

- **User Activations**: Synthetic cascade data for analytics testing
- **Personalization**: Sample user customizations
- **AI Suggestions**: Mock AI-generated suggestions

### Research Data 🔬

Experimental data for research features:

- **Political Field States**: Mathematical model data
- **Community Intersections**: Network analysis data
- **Template Morphisms**: Category theory mappings

## Database Schema Compatibility

### Current Schema Support ✅

All new seed scripts support the current schema:

```prisma
// Core models (always supported)
model Template { ... }
model User { ... }
model representative { ... }
model congressional_office { ... }

// Beta feature models (when enabled)
model legislative_channel { ... }
model legislative_body { ... }
model user_activation { ... }

// Feature-flagged models (when enabled)
model ai_suggestions { ... }
model template_personalization { ... }
model template_analytics { ... }
```

### Legacy Schema Issues ❌

Old seed scripts reference non-existent models:

- `template_scope` (not in current schema)
- `jurisdiction` (not in current schema)
- `office` (renamed to `congressional_office`)

**Solution**: Use new scripts (`*-updated.ts`) or `npm run db:seed`

## Seeding Workflow

### Development Setup

1. **Fresh Database**:

   ```bash
   npm run db:push  # Sync schema
   npm run db:seed  # Seed all compatible data
   ```

2. **Enable Beta Features**:

   ```bash
   ENABLE_BETA=true npm run db:seed
   ```

3. **Feature-Specific Testing**:
   ```bash
   npm run db:seed:core      # Just core data
   npm run db:seed:features  # Just feature data
   ```

### Production Setup

1. **Schema Migration**:

   ```bash
   npm run db:migrate
   ```

2. **Core Data Only**:

   ```bash
   npm run db:seed:core
   ```

3. **Incremental Features** (as they launch):
   ```bash
   ENABLE_BETA=true npm run db:seed:channels
   ```

## Customizing Seed Data

### Adding Templates

Edit `scripts/seed-db-updated.ts`:

```typescript
const seedTemplates = [
	// Add your template here
	{
		title: 'Your Template Title',
		description: 'Template description',
		category: 'Environment|Housing|Education|etc',
		type: 'advocacy',
		deliveryMethod: 'email|cwc|both',
		// ... rest of template data
		applicable_countries: ['US'],
		jurisdiction_level: 'federal|state|municipal',
		is_public: true
	}
];
```

### Adding Legislative Channels

Edit `scripts/seed-legislative-channels-updated.ts`:

```typescript
const legislativeChannelsData = [
	{
		channel_id: 'country-parliament',
		name: 'Parliament Name',
		type: 'email|form|cwc',
		jurisdiction_level: 'federal|state|municipal',
		country_code: 'ISO_CODE',
		delivery_config: {
			// Channel-specific configuration
		}
	}
];
```

### Adding Feature Data

Edit `scripts/seed-features.ts` and add data for your feature flag.

## Troubleshooting

### Common Issues

**❌ "template_scope does not exist"**

```
Error: Unknown argument `template_scope`. Available fields: ...
```

**Solution**: Use updated scripts: `npm run db:seed` instead of old scripts

**❌ "Feature not enabled"**

```
⚠️ CASCADE_ANALYTICS not enabled, skipping user activation seeding
```

**Solution**: Set appropriate environment variables: `ENABLE_BETA=true`

**❌ "Database connection failed"**

```
❌ Database connection failed: getaddrinfo ENOTFOUND ...
```

**Solution**: Check `SUPABASE_DATABASE_URL` or `DATABASE_URL`

**❌ "Schema out of sync"**

```
❌ Schema sync issue detected: Unknown argument `some_field`
```

**Solution**: Run `npm run db:push` to sync schema

### Debugging

1. **Check Feature Status**:

   ```bash
   npm run db:seed  # Shows feature flag status
   ```

2. **Run Individual Scripts**:

   ```bash
   npm run db:seed:core     # Test core data
   npm run db:seed:channels # Test legislative channels
   ```

3. **Database State**:
   ```bash
   npm run db:studio  # Visual database browser
   ```

### Clean Slate

To start over:

```bash
# Option 1: Drop all data (development only)
npx prisma db push --force-reset

# Option 2: Manual cleanup
npx prisma studio  # Delete records manually

# Then re-seed
npm run db:seed
```

## Migration from Legacy Seeds

### Old → New Script Mapping

| Old Script                     | New Script                             | Status            |
| ------------------------------ | -------------------------------------- | ----------------- |
| `seed-db.ts`                   | `seed-db-updated.ts`                   | ✅ Replaced       |
| `seed-legislative-channels.ts` | `seed-legislative-channels-updated.ts` | ✅ Replaced       |
| `seed-jurisdictions.ts`        | _Deprecated_                           | ❌ Models removed |
| `seed-test-templates.ts`       | _Merged into core_                     | ✅ Integrated     |

### Migration Steps

1. **Backup existing data** (if needed):

   ```bash
   npx prisma db pull
   ```

2. **Clear problematic data**:

   ```sql
   -- Remove references to deleted models
   -- Run via Prisma Studio or direct SQL
   ```

3. **Use new seeds**:
   ```bash
   npm run db:seed
   ```

## Best Practices

### For Development

- Always run `npm run db:seed` for comprehensive setup
- Use feature flags to test specific functionality
- Keep seed data representative but not overwhelming

### For Production

- Only seed core data initially
- Enable features incrementally with appropriate flags
- Monitor seeding performance and data integrity
- Use production-appropriate data volumes

### For Testing

- Create isolated test data sets
- Use feature flags to test specific scenarios
- Clean up test data between runs

## Future Improvements

### Planned Features

- **Incremental seeding**: Only seed changed data
- **Environment-specific data**: Different data per environment
- **Data versioning**: Track seed data changes
- **Performance optimization**: Batch operations for large datasets

### Contributing

- Add new seed data by editing appropriate scripts
- Ensure new data respects feature flags
- Test scripts in isolation before integration
- Update documentation for new data types

---

## Quick Reference

```bash
# Essential commands
npm run db:seed              # Seed everything
npm run db:seed:core         # Core data only
npm run db:seed:channels     # Legislative channels (beta)
npm run db:seed:features     # Feature-flagged data

# With feature flags
ENABLE_BETA=true npm run db:seed
ENABLE_RESEARCH=true npm run db:seed

# Database management
npm run db:push              # Sync schema
npm run db:studio            # Browse data
npm run db:generate          # Update Prisma client

# Legacy (use with caution)
npm run db:seed:legacy       # Old seed script
```

This seeding system now properly reflects our current data model and organizational structure, with clear separation between production, beta, and research data.
