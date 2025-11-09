# Data Model Complexity Analysis & Simplification

**Date**: 2025-01-08
**Purpose**: Audit current schema, identify deprecated/unused tables, simplify for Hunter.io-only architecture

---

## Executive Summary

**Current state**: 42 models in schema (including deprecated tables still in schema but not in production)
**Complexity drivers**:
1. Experimental research tables (8 removed in Phase 0.1, but schema still references them)
2. Multi-provider lookup infrastructure (Cicero, Apollo, Snov - not needed for Hunter.io-only)
3. VOTER Protocol Phase 2 features (challenges, stakes, rewards - not active in Phase 1)
4. Over-engineered analytics (8 models consolidated to 3, but still complex)
5. Template geo-location complexity (embeddings, jurisdictions, deprecated fields)

**Recommendation**: Remove 15+ models, simplify 8 models, reduce to ~25 core models

---

## Current Schema Audit (42 Models)

### Core User & Auth (4 models) - KEEP
- ✅ `User` - Core user table
- ✅ `Session` - Auth sessions
- ✅ `UserEmail` - Secondary email management
- ✅ `account` - OAuth provider accounts

### Templates & Content (5 models) - SIMPLIFY
- ✅ `Template` - Core template table (BLOATED - 80+ fields)
- ⚠️ `TemplateJurisdiction` - Structured geo data (NEW, not in production yet)
- ⚠️ `template_campaign` - Delivery tracking (overlaps with DeliveryLog)
- ⚠️ `template_personalization` - User customizations
- ⚠️ `ai_suggestions` - AI-powered variable suggestions

**Issues**:
- `Template` table has 80+ fields (verification, agents, blockchain, analytics, embeddings)
- Deprecated fields still in schema: `applicable_countries`, `jurisdiction_level`, `specific_locations`
- `TemplateJurisdiction` exists in schema but not deployed (migration incomplete)

### Government Officials Lookup (2 models) - REMOVE FOR HUNTER.IO-ONLY
- ❌ `representative` - Congressional representatives (not needed if corporate-only)
- ❌ `user_representatives` - User-representative relationships

**Decision**: If pivoting to corporate-only (Hunter.io), remove these entirely

---

### Decision-Maker Lookup Infrastructure (2 models) - KEEP BUT CLARIFY PURPOSE

#### CRITICAL CORRECTION: Cicero vs Hunter.io Separation

**Cicero (User Onboarding - KEEP)**:
- ✅ `LocationCache` - **REQUIRED** for user onboarding (address → districts for ZKP)
- ⚠️ `CiceroBudget` - Optional cost tracking (can use APIUsageTracking instead)

**Hunter.io (Template Creation - ADD)**:
- ✅ `UserLookupQuota` - Rate limiting (3/day per template creator)
- ✅ `APIUsageTracking` - Platform quota monitoring (50/month)

**Key insight**: These are **two completely separate systems**:
1. **Cicero**: User onboarding (address → congressional district for ZKP) - 1x per user
2. **Hunter.io**: Template creation (find corporate emails) - 3x/day per creator

**LocationCache is NOT for template creation, it's for user onboarding district verification.**

---

### Analytics (3 models) - KEEP BUT SIMPLIFY
- ✅ `analytics_session` - Session tracking (good)
- ✅ `analytics_event` - Event tracking (good)
- ✅ `analytics_experiment` - Funnel/campaign tracking (good)

**Already consolidated** from 8→3 models in Phase 0.1 cleanup

---

### Legislative Channels (3 models) - DEPRECATED (REMOVE)
- ❌ `legislative_channel` - International legislative access
- ❌ `legislative_body` - Legislature metadata
- ❌ `template_adaptation` - Template localization

**Status**: Built for international expansion (Phase 3+), unused in Phase 1
**Action**: Remove entirely (YAGNI)

---

### Template Relationships (5 models) - EVALUATE
- ⚠️ `template_morphism` - Template transformation tracking
- ⚠️ `template_analytics` - Template usage metrics (overlaps with analytics_event)
- ⚠️ `user_activation` - Viral cascade tracking
- ⚠️ `user_writing_style` - Writing style learning
- ⚠️ `DeliveryLog` - Delivery status tracking

**Issues**:
- `template_morphism` - Category theory abstraction, zero usage
- `template_analytics` - Redundant with `analytics_event`
- `user_activation` - Viral metrics, premature optimization

**Recommendation**: Remove morphism + template_analytics, keep activation + writing_style + DeliveryLog

---

### Audit & Blockchain (4 models) - KEEP (PHASE 1 ACTIVE)
- ✅ `AuditLog` - Unified audit trail (good consolidation)
- ✅ `CivicAction` - Blockchain-only actions
- ⚠️ `Challenge` - VOTER Protocol challenges (Phase 2, not active)
- ⚠️ `ChallengeStake` - Challenge stakes (Phase 2, not active)

**Recommendation**: Keep AuditLog + CivicAction, remove Challenge + ChallengeStake (Phase 2)

---

### VOTER Protocol (1 model) - REMOVE (PHASE 2)
- ❌ `RewardCalculation` - Multi-agent reward calc (Phase 2 only)

**Status**: Phase 2 feature, not active in Phase 1 (reputation-only)

---

### Multi-Agent Consensus (3 models) - KEEP (PHASE 1 ACTIVE)
- ✅ `AgentDissent` - Track agent disagreements
- ✅ `AgentPerformance` - Agent accuracy tracking
- ✅ `CostTracking` - Daily cost monitoring

**Status**: Active in Phase 1 for template moderation

---

### Async Job Processing (1 model) - KEEP
- ✅ `CWCJob` - Congressional delivery job tracking

**Status**: Active for CWC message submissions

---

## Deprecated Fields Still in Schema

### Template Model (10 deprecated fields):

```prisma
// DEPRECATED (still in schema, should remove):
applicable_countries      String[]   @default([])
jurisdiction_level        String?
specific_locations        String[]   @default([])

// PHASE 2 ONLY (remove for Phase 1 simplification):
user_deposit             Decimal?
deposit_refunded         Boolean    @default(false)
deposit_refund_amount    Decimal?
budget_allocated          Decimal?
cost_breakdown            Json?
optimization_metrics      Json?
pipeline_efficiency       Decimal?
```

### User Model (8 deprecated/premature fields):

```prisma
// MERGED FROM user_coordinates (already consolidated, good)
latitude                  Float?
longitude                 Float?
political_embedding       Json?
community_sheaves         Json?

// PHASE 2 ONLY (remove for Phase 1):
pending_rewards           String?  // BigInt
total_earned              String?  // BigInt
challenge_score           Int?
civic_score               Int?
discourse_score           Int?
```

---

## Complexity Metrics

### Current Complexity:
- **42 models** in Prisma schema
- **15 models** not actively used in Phase 1
- **80+ fields** in Template model
- **60+ fields** in User model
- **Complex joins** across 3-5 tables for template display
- **Premature optimization** (viral metrics, challenge markets, international expansion)

### Query Complexity Examples:

#### Current: Get template with all metadata
```typescript
const template = await prisma.template.findUnique({
  where: { slug },
  include: {
    user: true,
    jurisdictions: true,  // New table (not in prod)
    ai_suggestions: true,
    template_analytics: true,  // Redundant with analytics_event
    template_campaign: true,  // Overlaps with DeliveryLog
    civic_actions: true,
    analytics_events: true
  }
});
// Result: 7-table join, 200+ fields returned
```

#### Simplified: Get template (proposed)
```typescript
const template = await prisma.template.findUnique({
  where: { slug },
  include: {
    user: { select: { id: true, name: true, avatar: true } }
  }
});
// Result: 2-table join, ~30 core fields
```

---

## Proposed Simplification

### Phase 1: Remove Unused Models (15 models → DELETE)

```prisma
// REMOVE: Government lookup (not needed for Hunter.io-only)
model representative {} // DELETE
model user_representatives {} // DELETE
model LocationCache {} // DELETE
model CiceroBudget {} // DELETE

// REMOVE: International expansion (Phase 3+)
model legislative_channel {} // DELETE
model legislative_body {} // DELETE
model template_adaptation {} // DELETE

// REMOVE: Category theory abstraction (unused)
model template_morphism {} // DELETE

// REMOVE: Redundant analytics
model template_analytics {} // DELETE (use analytics_event instead)

// REMOVE: Phase 2 features
model Challenge {} // DELETE
model ChallengeStake {} // DELETE
model RewardCalculation {} // DELETE

// REMOVE: Duplicate delivery tracking
model template_campaign {} // DELETE (use DeliveryLog instead)
```

**Result**: 42 models → 27 models (-15 models, -36% complexity)

---

### Phase 2: Simplify Template Model

**Current**: 80+ fields across 10 categories
**Proposed**: 35 core fields across 4 categories

```prisma
model Template {
  id                  String   @id @default(cuid())
  slug                String   @unique

  // === CORE CONTENT (10 fields) ===
  title               String
  description         String
  category            String
  type                String
  message_body        String
  preview             String
  status              String   @default("draft")
  is_public           Boolean  @default(false)
  userId              String?
  user                User?    @relation(fields: [userId], references: [id])

  // === DELIVERY CONFIG (3 fields) ===
  deliveryMethod      String
  delivery_config     Json
  recipient_config    Json

  // === USAGE METRICS (3 fields) ===
  send_count          Int      @default(0)
  last_sent_at        DateTime?
  metrics             Json     // Lightweight aggregated metrics

  // === VERIFICATION (5 fields) ===
  verification_status String   @default("pending")
  quality_score       Int      @default(50)
  reviewed_at         DateTime?
  agent_votes         Json?    // Multi-agent consensus
  consensus_score     Float?

  // === SEARCH (3 fields - SIMPLIFIED) ===
  country_code        String   @default("US")
  location_context    Json?    // Simplified from TemplateJurisdiction table
  search_embedding    Json?    // Single embedding (not topic + location)

  // === TIMESTAMPS (3 fields) ===
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  submitted_at        DateTime?

  // === RELATIONS (minimal) ===
  ai_suggestions      ai_suggestions[]
  civic_actions       CivicAction[]
  analytics_events    analytics_event[]

  @@index([verification_status])
  @@index([country_code])
  @@index([userId])
  @@map("template")
}
```

**Removed from Template** (45+ fields):
- ❌ Deprecated geo fields (applicable_countries, jurisdiction_level, specific_locations)
- ❌ Phase 2 deposit/budget fields (user_deposit, budget_allocated, optimization_metrics)
- ❌ Over-engineered agent tracking (processing_pipeline, agent_assignments, consensus_weights)
- ❌ Unused verification fields (severity_level, original_content, correction_log)
- ❌ Premature optimization (cache_efficiency, total_processing_time, intent_preservation)
- ❌ Separate embeddings (topic_embedding, location_embedding → single search_embedding)

---

### Phase 3: Simplify User Model

**Current**: 60+ fields
**Proposed**: 30 core fields

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  avatar              String?

  // === ADDRESS DISPLAY (5 fields - non-PII) ===
  city                String?
  state               String?
  zip                 String?
  congressional_district String?

  // === COORDINATES (4 fields - consolidated from user_coordinates) ===
  latitude            Float?
  longitude           Float?
  coordinates_updated_at DateTime?

  // === VERIFICATION (4 fields) ===
  is_verified         Boolean   @default(false)
  verification_method String?
  verified_at         DateTime?
  district_verified   Boolean   @default(false)

  // === BLOCKCHAIN (3 fields - Phase 1 only) ===
  scroll_address      String?   @unique
  wallet_address      String?   @unique
  trust_score         Int       @default(0)

  // === PROFILE (3 fields) ===
  role                String?
  organization        String?
  profile_visibility  String    @default("private")

  // === TIMESTAMPS (2 fields) ===
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // === RELATIONS (minimal) ===
  account             account[]
  sessions            Session[]
  templates           Template[]
  secondary_emails    UserEmail[]
  audit_logs          AuditLog[]
  civic_actions       CivicAction[]

  @@map("user")
}
```

**Removed from User** (30+ fields):
- ❌ Phase 2 rewards (pending_rewards, total_earned, civic_score, challenge_score)
- ❌ Experimental political embeddings (political_embedding, community_sheaves)
- ❌ External wallet linking (connected_wallet_address, connected_wallet_type)
- ❌ VOTER Protocol fields (reputation_tier, last_certification)
- ❌ Unused profile fields (connection, location description)
- ❌ Over-engineered relations (representatives, campaigns, morphisms, activations, writing_style)

---

## Hunter.io-Only Decision-Maker Lookup

### NEW: Simplified Lookup Tracking (2 models)

```prisma
// Track per-user daily lookup quotas (3/day limit)
model UserLookupQuota {
  id            String   @id @default(cuid())
  user_id       String
  date          DateTime @default(now())
  lookups_used  Int      @default(0)
  lookups_limit Int      @default(3)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  user          User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, date])
  @@index([user_id, date])
  @@map("user_lookup_quota")
}

// Track platform-wide API usage (Hunter.io 50/month quota)
model APIUsageTracking {
  id           String   @id @default(cuid())
  provider     String   @default("hunter")  // Always "hunter" (not multi-provider)
  credits_used Int      @default(1)
  user_id      String?
  query_text   String?  // Corporate lookup query
  cache_hit    Boolean  @default(false)
  created_at   DateTime @default(now())
  user         User?    @relation(fields: [user_id], references: [id])

  @@index([provider, created_at])
  @@index([user_id])
  @@map("api_usage_tracking")
}
```

**NO DATABASE CACHE** - Use Redis for 24h TTL corporate email caching
**NO GOVERNMENT LOOKUP** - Hunter.io is corporate-only

---

## Simplified Schema Summary

### Before: 42 models, 80+ fields in Template, 60+ fields in User
### After: 29 models, 35 fields in Template, 30 fields in User

### Models to DELETE (11):
1. `representative` (not needed - templates target corporations, not officials)
2. `user_representatives` (not needed)
3. `legislative_channel` (Phase 3+ international expansion)
4. `legislative_body` (Phase 3+)
5. `template_adaptation` (Phase 3+)
6. `template_morphism` (experimental category theory)
7. `template_analytics` (redundant with analytics_event)
8. `template_campaign` (redundant with DeliveryLog)
9. `Challenge` (Phase 2 only)
10. `ChallengeStake` (Phase 2 only)
11. `RewardCalculation` (Phase 2 only)

### Models to KEEP (Cicero for user onboarding):
- ✅ `LocationCache` - **CRITICAL** for address → district mapping (ZKP)
- ⚠️ `CiceroBudget` - Optional (can consolidate into APIUsageTracking)

### Models to ADD (2):
1. `UserLookupQuota` (3/day rate limiting)
2. `APIUsageTracking` (Hunter.io quota monitoring)

### Models to SIMPLIFY (3):
1. `Template`: 80 fields → 35 fields (-45 fields, -56%)
2. `User`: 60 fields → 30 fields (-30 fields, -50%)
3. `TemplateJurisdiction`: Remove (not deployed, use Json field instead)

### Models to KEEP AS-IS (14):
- Core: `User`, `Session`, `UserEmail`, `account`
- Templates: `Template`, `template_personalization`, `ai_suggestions`, `DeliveryLog`
- Analytics: `analytics_session`, `analytics_event`, `analytics_experiment`
- Agents: `AgentDissent`, `AgentPerformance`, `CostTracking`
- Blockchain: `AuditLog`, `CivicAction`
- Jobs: `CWCJob`
- Lookups: `UserLookupQuota`, `APIUsageTracking`
- Writing: `user_writing_style`, `user_activation`

---

## Migration Plan

### Step 1: Add New Lookup Models (Non-Breaking)
```sql
-- Add UserLookupQuota table
CREATE TABLE user_lookup_quota (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  lookups_used INTEGER NOT NULL DEFAULT 0,
  lookups_limit INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Add APIUsageTracking table
CREATE TABLE api_usage_tracking (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'hunter',
  credits_used INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES user(id),
  query_text TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_lookup_quota_user_date ON user_lookup_quota(user_id, date);
CREATE INDEX idx_api_usage_provider_date ON api_usage_tracking(provider, created_at);
```

### Step 2: Remove Deprecated Fields (Breaking)
```sql
-- Remove deprecated Template fields
ALTER TABLE template
  DROP COLUMN applicable_countries,
  DROP COLUMN jurisdiction_level,
  DROP COLUMN specific_locations,
  DROP COLUMN user_deposit,
  DROP COLUMN deposit_refunded,
  DROP COLUMN deposit_refund_amount,
  DROP COLUMN budget_allocated,
  DROP COLUMN cost_breakdown,
  DROP COLUMN optimization_metrics,
  DROP COLUMN pipeline_efficiency;

-- Remove deprecated User fields
ALTER TABLE user
  DROP COLUMN pending_rewards,
  DROP COLUMN total_earned,
  DROP COLUMN challenge_score,
  DROP COLUMN civic_score,
  DROP COLUMN discourse_score,
  DROP COLUMN political_embedding,
  DROP COLUMN community_sheaves,
  DROP COLUMN connected_wallet_address,
  DROP COLUMN connected_wallet_type,
  DROP COLUMN connected_wallet_chain;
```

### Step 3: Drop Unused Tables (Breaking)
```sql
-- Remove redundant/experimental/Phase 2+ tables
DROP TABLE IF EXISTS template_campaign CASCADE;
DROP TABLE IF EXISTS template_analytics CASCADE;
DROP TABLE IF EXISTS template_morphism CASCADE;
DROP TABLE IF EXISTS user_representatives CASCADE;
DROP TABLE IF EXISTS representative CASCADE;
DROP TABLE IF EXISTS legislative_body CASCADE;
DROP TABLE IF EXISTS template_adaptation CASCADE;
DROP TABLE IF EXISTS legislative_channel CASCADE;
DROP TABLE IF EXISTS challenge_stake CASCADE;
DROP TABLE IF EXISTS challenge CASCADE;
DROP TABLE IF EXISTS reward_calculation CASCADE;

-- KEEP LocationCache (critical for user onboarding ZKP)
-- KEEP CiceroBudget (or consolidate into APIUsageTracking)
```

### Step 4: Remove Unused Relations from Prisma Schema

Update `prisma/schema.prisma` to remove:
- All references to deleted models
- Deprecated Template fields
- Deprecated User fields
- TemplateJurisdiction model (use Json field instead)

---

## Benefits of Simplification

### Developer Experience:
- **Fewer models to understand**: 42 → 29 models (-31%)
- **Simpler queries**: 7-table joins → 2-table joins
- **Faster TypeScript compilation**: Fewer generated types
- **Easier onboarding**: Less cognitive overhead

### Performance:
- **Smaller payload sizes**: 200+ fields → 30 core fields
- **Faster queries**: Fewer joins, smaller result sets
- **Better caching**: Smaller objects fit in Redis
- **Lower bandwidth**: Less data over wire

### Maintenance:
- **No multi-provider complexity**: Hunter.io-only (not Cicero + Apollo + Snov)
- **No premature optimization**: Remove Phase 2/3 features
- **No experimental research**: Remove political embedding tables
- **Clear separation**: Phase 1 vs Phase 2 features

### Cost:
- **Lower Supabase bills**: Fewer tables, smaller database
- **Lower API costs**: Hunter.io-only (no Cicero budget drain)
- **Simpler caching**: Redis-only (no LocationCache table)

---

## Risks & Mitigation

### Risk 1: Data Loss
**Mitigation**: Backup database before migration, test on staging first

### Risk 2: Breaking Existing Features
**Mitigation**:
- Keep all Phase 1 active features (analytics, agents, blockchain)
- Only remove unused/Phase 2/Phase 3 features
- Gradual rollout (add new models first, remove old models last)

### Risk 3: Future Expansion Needs
**Mitigation**:
- Keep international expansion plan documented
- Can re-add legislative_channel tables in Phase 3+
- Can re-add Challenge models in Phase 2
- YAGNI principle: Add when actually needed, not before

---

## Next Steps

1. ✅ **Document current complexity** (this document)
2. ⬜ **Get approval** for simplification plan
3. ⬜ **Create migration scripts** (Step 1-4 above)
4. ⬜ **Test on staging database**
5. ⬜ **Update Prisma schema**
6. ⬜ **Run migrations on production**
7. ⬜ **Update DECISION-MAKER-LOOKUP.md** to reflect Hunter.io-only

---

**Status**: Analysis complete. Awaiting approval for 13 model deletions + Template/User simplification.
