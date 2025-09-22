# Template Verification Consolidation Migration Guide

## Overview

This document outlines the migration strategy for consolidating the TemplateVerification model into the Template model, eliminating duplication and simplifying the database schema from 2 models to 1 enhanced model.

## Schema Changes Summary

### Before: 2 Models

1. **Template** - Basic template content and metadata
2. **TemplateVerification** - Separate verification status and AI decisions

### After: 1 Enhanced Model

1. **Template** - Unified model with all verification fields integrated

## Migration Strategy

### Phase 1: Data Migration

#### 1.1 Pre-Migration Backup

```sql
-- Create backup tables
CREATE TABLE template_backup AS SELECT * FROM template;
CREATE TABLE template_verification_backup AS SELECT * FROM template_verification;
```

#### 1.2 Consolidate Verification Data

```sql
-- Update template table with verification data
UPDATE template
SET
  verification_status = tv.moderation_status,
  country_code = tv.country_code,
  severity_level = tv.severity_level,
  correction_log = tv.correction_log,
  original_content = tv.original_content,
  corrected_subject = tv.corrected_subject,
  corrected_body = tv.corrected_body,
  agent_votes = tv.agent_votes,
  consensus_score = tv.consensus_score,
  quality_score = tv.quality_score,
  grammar_score = tv.grammar_score,
  clarity_score = tv.clarity_score,
  completeness_score = tv.completeness_score,
  reputation_delta = tv.reputation_delta,
  reputation_applied = tv.reputation_applied,
  submitted_at = tv.submitted_at,
  corrected_at = tv.corrected_at,
  reviewed_at = tv.reviewed_at
FROM template_verification tv
WHERE template.id = tv.template_id;
```

#### 1.3 Handle Templates Without Verification

```sql
-- Set default values for templates without verification records
UPDATE template
SET
  verification_status = 'pending',
  country_code = 'US',
  quality_score = 50,
  reputation_delta = 0.0,
  reputation_applied = false
WHERE verification_status IS NULL;
```

### Phase 2: N8N Workflow Updates

#### 2.1 Template Creation API (`/api/templates/+server.ts`)

**Before:**

```typescript
// Separate creation of template and verification
const template = await prisma.template.create({...});
const verification = await prisma.templateVerification.create({
  template_id: template.id,
  user_id: userId,
  country_code: 'US'
});
```

**After:**

```typescript
// Single unified creation
const template = await prisma.template.create({
	data: {
		// ... existing template fields
		verification_status: 'pending',
		country_code: 'US',
		quality_score: 50,
		reputation_delta: 0.0,
		reputation_applied: false,
		submitted_at: new Date()
	}
});
```

#### 2.2 N8N Processing API (`/api/n8n/process-template/+server.ts`)

**Before:**

```typescript
// Update separate verification record
await prisma.templateVerification.update({
	where: { template_id: templateId },
	data: {
		moderation_status: 'approved',
		agent_votes: agentDecisions,
		consensus_score: consensusScore,
		quality_score: qualityScore
	}
});
```

**After:**

```typescript
// Update unified template record
await prisma.template.update({
	where: { id: templateId },
	data: {
		verification_status: 'approved',
		agent_votes: agentDecisions,
		consensus_score: consensusScore,
		quality_score: qualityScore,
		reviewed_at: new Date()
	}
});
```

#### 2.3 Quality API (`/api/templates/[id]/quality/+server.ts`)

**Before:**

```typescript
// Join query required
const template = await prisma.template.findUnique({
	where: { id: templateId },
	include: {
		verification: true
	}
});

return {
	quality_score: template.verification?.quality_score,
	verification_status: template.verification?.moderation_status
};
```

**After:**

```typescript
// Direct access, no JOIN required
const template = await prisma.template.findUnique({
	where: { id: templateId },
	select: {
		quality_score: true,
		verification_status: true,
		consensus_score: true,
		agent_votes: true
	}
});

return {
	quality_score: template.quality_score,
	verification_status: template.verification_status
};
```

### Phase 3: Application Code Updates

#### 3.1 Database Queries

**Replace all instances of:**

```typescript
// OLD: Separate verification queries
const verification = await prisma.templateVerification.findUnique({
	where: { template_id: templateId }
});

// OLD: Join queries
const template = await prisma.template.findUnique({
	where: { id },
	include: { verification: true }
});
```

**With:**

```typescript
// NEW: Direct template queries
const template = await prisma.template.findUnique({
	where: { id: templateId },
	select: {
		// ... template fields
		verification_status: true,
		quality_score: true,
		agent_votes: true
		// ... other verification fields
	}
});
```

#### 3.2 Type Definitions

**Update TypeScript types:**

```typescript
// Remove separate TemplateVerification type
// Extend Template type with verification fields

type Template = {
	id: string;
	title: string;
	// ... existing fields

	// Merged verification fields
	verification_status?: string;
	country_code?: string;
	quality_score: number;
	agent_votes?: any;
	consensus_score?: number;
	// ... other verification fields
};
```

### Phase 4: Testing Strategy

#### 4.1 Integration Tests

```typescript
describe('Template Verification Consolidation', () => {
	test('template creation includes verification fields', async () => {
		const template = await createTemplate({
			title: 'Test Template',
			verification_status: 'pending'
		});

		expect(template.verification_status).toBe('pending');
		expect(template.quality_score).toBe(50);
	});

	test('N8N workflow updates verification status', async () => {
		const template = await updateTemplateVerification(templateId, {
			verification_status: 'approved',
			quality_score: 85
		});

		expect(template.verification_status).toBe('approved');
	});
});
```

#### 4.2 Migration Validation

```sql
-- Verify all verification data was migrated
SELECT
  t.id,
  t.verification_status,
  t.quality_score,
  t.country_code
FROM template t
WHERE t.verification_status IS NOT NULL;

-- Verify no orphaned verification records remain
SELECT COUNT(*) FROM template_verification; -- Should be 0 after cleanup
```

### Phase 5: Performance Optimizations

#### 5.1 New Indexes

```sql
-- Add indexes for consolidated verification fields
CREATE INDEX template_verification_status_idx ON template(verification_status);
CREATE INDEX template_quality_score_idx ON template(quality_score);
CREATE INDEX template_country_code_idx ON template(country_code);
```

#### 5.2 Query Performance Improvements

- **Elimination of JOINs**: All verification queries now access single table
- **Reduced complexity**: No need for separate verification record management
- **Better caching**: Single model reduces cache invalidation complexity

### Phase 6: N8N Workflow Configuration

#### 6.1 Agent Consensus Updates

```json
{
	"workflow": "template-verification",
	"updates_required": [
		{
			"node": "Update Template Verification",
			"change": "Direct template update instead of separate verification record"
		},
		{
			"node": "Quality Score Calculation",
			"change": "Update template.quality_score field directly"
		},
		{
			"node": "Agent Voting",
			"change": "Store agent_votes in template.agent_votes field"
		}
	]
}
```

#### 6.2 Webhook Endpoints

- Update all N8N webhooks to use unified template endpoints
- Ensure agent decision storage goes to Template model fields
- Maintain transparency in quality reporting API

### Phase 7: Cleanup and Validation

#### 7.1 Remove Old Model

```sql
-- After successful migration and validation
DROP TABLE template_verification;
```

#### 7.2 Update Prisma Schema

- Generate new Prisma client: `npx prisma generate`
- Push schema changes: `npx prisma db push`
- Update all imports removing TemplateVerification references

### Phase 8: Benefits Realized

#### 8.1 Simplified Schema

- **Before**: 2 separate models with artificial separation
- **After**: 1 unified model with all template data

#### 8.2 Performance Gains

- **Query Performance**: No JOIN required for verification status
- **Index Efficiency**: Better indexing on unified model
- **API Simplicity**: Single endpoint for all template operations

#### 8.3 Development Efficiency

- **Reduced Complexity**: No need to manage separate verification lifecycle
- **Better Type Safety**: Single TypeScript type for all template data
- **Easier Testing**: Single model to mock and test

## Risk Mitigation

### Data Loss Prevention

1. **Full Backup**: Complete database backup before migration
2. **Staged Rollout**: Test on development environment first
3. **Validation Scripts**: Comprehensive data validation post-migration
4. **Rollback Plan**: Ability to restore from backup if needed

### N8N Continuity

1. **Parallel Testing**: Test updated workflows in staging
2. **Gradual Cutover**: Switch endpoints one by one
3. **Monitoring**: Watch for errors in agent processing
4. **Fallback**: Keep old endpoints active during transition

## Timeline

1. **Week 1**: Schema updates and data migration scripts
2. **Week 2**: API endpoint updates and testing
3. **Week 3**: N8N workflow updates and validation
4. **Week 4**: Production deployment and monitoring

## Success Criteria

- [ ] All template verification data successfully migrated
- [ ] N8N workflows continue processing templates without errors
- [ ] Quality API maintains transparency and performance
- [ ] No data loss or corruption
- [ ] Performance improvements measurable in production
- [ ] All tests passing with new unified model

## Post-Migration Monitoring

- Monitor N8N workflow execution success rates
- Track API response times for verification endpoints
- Validate agent decision storage and retrieval
- Ensure quality transparency features remain functional
- Watch for any data inconsistencies or edge cases
