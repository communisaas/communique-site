# Analytics & Audit Seeding Scripts

Two comprehensive seeding scripts for the consolidated analytics and audit systems.

## Scripts Created

### 1. `seed-analytics.ts` - Analytics System (Phase 1)

Seeds the consolidated analytics tables (8→3 models consolidation):

**Tables:**

- `analytics_session`: UTM tracking, device data, session metrics, funnel progress
- `analytics_event`: Page views, interactions, conversions, funnel steps
- `analytics_experiment`: A/B tests, funnels, campaigns with configurations

**Data Patterns:**

- **Realistic User Journeys**: Discovery → signup → template usage → sharing
- **UTM Campaign Tracking**: Google Ads, social media, direct traffic
- **Device Analytics**: Desktop/mobile patterns with fingerprinting
- **Funnel Analysis**: Onboarding optimization, template discovery A/B tests
- **Event Distribution**: 40% pageviews, 30% interactions, 20% conversions, 10% funnel/campaign

**Key Features:**

- JSONB fields with well-structured data (device_data, session_metrics, funnel_progress)
- Realistic conversion funnels and A/B test configurations
- Performance metrics cache for dashboard optimization
- Cross-linked events and experiments

### 2. `seed-audit.ts` - Audit System (Phase 3)

Seeds the consolidated audit tables (4→2 models consolidation):

**Tables:**

- `AuditLog`: Unified audit trail for all user actions with agent decisions
- `CivicAction`: Blockchain-specific actions with VOTER Protocol integration
- `Challenge`: VOTER Protocol challenges with community voting
- `ChallengeStake`: Quadratic voting stakes in challenges

**Data Patterns:**

- **Complete Action Trails**: Authentication, verification, template actions, reputation changes
- **Agent Provenance**: Multi-model consensus decisions (OpenAI, Anthropic, Google)
- **Blockchain Integration**: Transaction hashes, reward calculations, consensus data
- **VOTER Protocol**: Challenges, stakes, quadratic voting

**Key Features:**

- Comprehensive audit classification (action_type, action_subtype)
- Agent decision trails with confidence scores and reasoning
- Blockchain correlation with civic actions
- Reputation tracking with before/after scores
- Multi-agent consensus for reward calculations

## Usage

### Individual Scripts

```bash
# Analytics system only
npx tsx scripts/seed-analytics.ts

# Audit system only
npx tsx scripts/seed-audit.ts
```

### Via Orchestrator

```bash
# All seeding including analytics & audit
npm run db:seed

# Or specific steps
npm run db:seed -- --steps=core-data,analytics-system,audit-system
```

## Dependencies

Both scripts require:

- Core data seeded first (users, templates, representatives)
- PostgreSQL with JSONB support
- Prisma client configured

## Data Volume

**Analytics:**

- 50 sessions with realistic UTM and device data
- 200+ events across pageviews, interactions, conversions
- 3 experiments (funnel, A/B test, campaign)

**Audit:**

- 200 comprehensive audit log entries
- 75 blockchain civic actions with consensus data
- 10 VOTER Protocol challenges
- 30+ challenge stakes with quadratic voting

## Schema Compatibility

Both scripts are designed for the consolidated schema:

- Analytics: Phase 1 consolidation (8→3 models)
- Audit: Phase 3 consolidation (4→2 models)
- Full JSONB utilization for flexible data storage
- Proper indexing for performance

## Next Steps

After seeding:

1. **Analytics Dashboard**: View `/analytics` for session and conversion data
2. **Audit Dashboard**: View `/admin/audit` for action trails
3. **VOTER Protocol**: View `/voter/dashboard` for challenges and consensus
4. **Performance**: Monitor JSONB query performance and optimize indexes as needed
