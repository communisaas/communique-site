# Architecture Separation: Cicero vs Hunter.io

**Date**: 2025-01-08
**Critical Clarification**: Two completely separate systems with different purposes

---

## The Confusion (And Correction)

### WRONG Understanding:
"Cicero is for template creators to find government officials' emails"

### CORRECT Understanding:
**Cicero**: User onboarding - Map user address → congressional district for ZKP verification
**Hunter.io**: Template creation - Find corporate decision-maker emails for templates

**These are completely separate flows.**

---

## System 1: User Onboarding (Cicero API)

### Purpose:
**Map user's address to most granular political districts for zero-knowledge proof verification.**

### When Used:
- **Once per user** during account creation
- **After** identity verification (self.xyz NFC passport or Didit.me)
- **Before** user can send templates (need district verification)

### User Flow:

```
User creates account
    ↓
Identity verification (self.xyz 70% / Didit.me 30%)
    ↓
User enters address (OR we already have it from verification)
    ↓
Confirm address: "Is 123 Main St, Austin TX 78701 correct?"
    ↓
[YES] → Cicero API lookup (address → districts)
    ↓
Store district mapping in database:
  - Congressional district: TX-25
  - State house district: HD-47
  - State senate district: SD-14
  - County: Travis County
  - City council district: District 9
    ↓
Generate ZK proof (district membership without revealing address)
    ↓
User onboarding complete
```

### What User Sees:

```
┌─────────────────────────────────────────┐
│ Verify Your Address                     │
│                                         │
│ We use your address to:                │
│ ✓ Verify you live in this district     │
│ ✓ Route messages to your officials     │
│                                         │
│ Your address is encrypted and never     │
│ stored. We only save your district.    │
│                                         │
│ 123 Main St                             │
│ Austin, TX 78701                        │
│                                         │
│ [Confirm] [Edit Address]                │
└─────────────────────────────────────────┘
```

**User mental model**: "They need my address to know which politicians represent me, but they don't store it (privacy)."

**Technical reality**: ZK proof verifies district membership without revealing address. Cicero maps address → districts, then address discarded.

### Data Stored:

```typescript
// User table (after Cicero lookup)
{
  congressional_district: "TX-25",
  state: "TX",
  city: "Austin",
  zip: "78701",

  // From Cicero (most granular):
  state_house_district: "HD-47",
  state_senate_district: "SD-14",
  county_name: "Travis County",
  city_council_district: "District 9",

  // NOT stored:
  street_address: null, // Discarded after Cicero lookup
  latitude: null,       // NOT stored (privacy)
  longitude: null       // NOT stored (privacy)
}
```

### Cicero API Usage:

**Frequency**: Once per user (during onboarding)
**Cost**: $0.04 per lookup
**Budget**: $100/month = 2,500 users/month onboarded

**Caching strategy**:
- Cache district mappings by zip code (not exact address)
- If user in same zip as previous user → use cached districts
- Only call Cicero API if zip code cache miss

---

## System 2: Template Creation (Hunter.io)

### Purpose:
**Find corporate decision-maker emails for template creators.**

### When Used:
- **During template creation** by authenticated template creators
- **3 times per day max** per creator (rate limit)
- **NOT during user onboarding** (completely separate)

### User Flow:

```
Template creator authenticated
    ↓
Create new template → "Target Decision-Makers" step
    ↓
Search: "Sundar Pichai, Google"
    ↓
Hunter.io API lookup (company/person → email)
    ↓
Return: sundar@google.com (95% confidence)
    ↓
Creator adds to template recipients
    ↓
Template published
```

### What Template Creator Sees:

```
┌─────────────────────────────────────────┐
│ Find Decision-Maker Emails              │
│                                         │
│ Daily quota: 2 of 3 lookups remaining  │
│                                         │
│ Search: [Sundar Pichai, Google_____]   │
│ [Find Email]                            │
│                                         │
│ Result:                                 │
│ ✓ sundar@google.com (95% verified)     │
│   CEO, Google                           │
│   Source: Hunter.io                     │
│                                         │
│ [Add to Recipients]                     │
└─────────────────────────────────────────┘
```

### Hunter.io API Usage:

**Frequency**: 3 times per day per creator (with 80% cache hit rate)
**Cost**: $0 (50 lookups/month free tier)
**Budget**: FREE (with manual entry fallback after quota)

---

## Critical Differences

| Aspect | Cicero (User Onboarding) | Hunter.io (Template Creation) |
|--------|-------------------------|-------------------------------|
| **Purpose** | Map address → districts for ZKP | Find corporate emails |
| **When** | Once during account setup | During template creation |
| **Who** | ALL users (before first send) | Template creators only |
| **Frequency** | 1x per user lifetime | 3x per day per creator |
| **Data stored** | Congressional district, state house/senate, county, city council | Email addresses in templates |
| **Privacy** | Address encrypted, only district stored | No PII (corporate emails only) |
| **Cost** | $0.04/lookup ($100/month budget) | FREE (50/month quota) |
| **Caching** | By zip code (LocationCache table) | By query (Redis 24h TTL) |
| **Fallback** | Manual district selection | Manual email entry |

---

## Architecture Diagram

```
USER ONBOARDING FLOW (Cicero):
┌─────────────┐
│ New User    │
└──────┬──────┘
       │
       ├─ Identity Verification (self.xyz / Didit.me)
       │
       ├─ Address Confirmation
       │      ↓
       │  Cicero API (address → districts)
       │      ↓
       │  Store: congressional_district, state_house_district, etc.
       │      ↓
       │  ZK Proof Generation (district membership)
       │      ↓
       ├─ User can now send templates
       │

TEMPLATE CREATION FLOW (Hunter.io):
┌─────────────┐
│ Creator     │
└──────┬──────┘
       │
       ├─ Authenticated (already onboarded)
       │
       ├─ Create Template
       │
       ├─ "Find Decision-Makers" step
       │      ↓
       │  Check rate limit (3/day)
       │      ↓
       │  Check Redis cache
       │      ↓
       │  Hunter.io API (query → email)
       │      ↓
       │  Cache result (24h Redis)
       │      ↓
       ├─ Add emails to template
       │
       ├─ Publish template
```

---

## Database Schema (Corrected)

### User Onboarding (Cicero):

```sql
-- User table: Store district mappings (from Cicero)
ALTER TABLE user ADD COLUMN state_house_district TEXT;
ALTER TABLE user ADD COLUMN state_senate_district TEXT;
ALTER TABLE user ADD COLUMN county_name TEXT;
ALTER TABLE user ADD COLUMN city_council_district TEXT;

-- LocationCache: Zip code → district mappings (not exact addresses)
CREATE TABLE location_cache (
  id TEXT PRIMARY KEY,
  zip_code TEXT UNIQUE NOT NULL, -- Cache by zip, not exact address

  -- Cicero API response
  congressional_district TEXT,
  state_house_district TEXT,
  state_senate_district TEXT,
  county_name TEXT,
  city_council_district TEXT,

  -- Cache metadata
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- 2-year election cycle
  hit_count INTEGER DEFAULT 0,

  -- Cost tracking
  api_cost_cents INTEGER DEFAULT 4 -- $0.04
);

CREATE INDEX idx_location_cache_zip ON location_cache(zip_code);
CREATE INDEX idx_location_cache_expires ON location_cache(expires_at);
```

### Template Creation (Hunter.io):

```sql
-- UserLookupQuota: Rate limiting (3/day per creator)
CREATE TABLE user_lookup_quota (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  lookups_used INTEGER DEFAULT 0,
  lookups_limit INTEGER DEFAULT 3,
  UNIQUE(user_id, date)
);

-- APIUsageTracking: Platform quota monitoring (50/month Hunter.io)
CREATE TABLE api_usage_tracking (
  id TEXT PRIMARY KEY,
  provider TEXT DEFAULT 'hunter', -- Always 'hunter'
  credits_used INTEGER DEFAULT 1,
  user_id TEXT REFERENCES user(id),
  query_text TEXT, -- Corporate email query
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NO database cache for Hunter.io (use Redis with 24h TTL)
```

---

## Cost Projections (Corrected)

### Cicero (User Onboarding):

**Scenario 1: 100 users/month onboard**
- 100 Cicero API calls × $0.04 = $4/month
- With 50% zip code cache hit rate: $2/month actual

**Scenario 2: 1,000 users/month onboard**
- 1,000 Cicero API calls × $0.04 = $40/month
- With 60% zip code cache hit rate: $16/month actual

**Scenario 3: 10,000 users/month onboard (viral)**
- 10,000 Cicero API calls × $0.04 = $400/month
- With 70% zip code cache hit rate: $120/month actual

**Budget**: $100/month covers ~2,500 new users/month (with caching)

---

### Hunter.io (Template Creation):

**Scenario 1: 10 active template creators**
- 30 lookups/day × 30 days = 900 lookups/month possible
- Free tier: 50 lookups/month
- With 80% cache hit rate: 180 API calls/month needed
- **Shortfall**: 130 lookups/month (manual entry required)

**Scenario 2: 50 active template creators**
- 150 lookups/day × 30 days = 4,500 lookups/month possible
- With 90% cache hit rate: 450 API calls/month needed
- **Requires paid plan**: $49/month for 1,000 searches

**Budget**: FREE for low volume, $49/month for 50+ creators

---

## User-Facing Messaging (Privacy First)

### During Onboarding (Cicero):

```
Why do we need your address?

✓ Route your messages to the right officials
  (Your rep is different from your neighbor's)

✓ Verify you live in this district
  (Prevents spam from out-of-district residents)

Your privacy is protected:
• Your address is encrypted end-to-end
• We only store your district (not your street address)
• Zero-knowledge proofs verify membership without revealing location

[Learn more about our privacy technology]
```

**User mental model**: "They need to know my district, but not my exact address. Makes sense."

**Technical reality**: Address encrypted in browser (XChaCha20-Poly1305), sent to TEE for Cicero lookup, districts extracted, address discarded. ZK proof generated from district membership only.

---

### During Template Creation (Hunter.io):

```
Find Decision-Maker Emails

Daily quota: 2 of 3 lookups remaining

Search for corporate contacts:
• CEOs, CMOs, CTOs, etc.
• Company domain required (e.g., "google.com")
• 95%+ email verification accuracy

[Search: Sundar Pichai, Google]

Out of lookups? Enter emails manually below.
```

**User mental model**: "I get 3 free email lookups per day. After that, I type emails myself."

**No privacy concerns** - corporate emails are public information.

---

## Implementation Priority (Corrected)

### Phase 1: User Onboarding (CRITICAL PATH - MUST HAVE)

1. ✅ Cicero API integration
2. ✅ LocationCache table (zip code caching)
3. ✅ Address confirmation UI
4. ✅ District storage in User table
5. ✅ ZK proof generation (district membership)

**Why critical**: Users can't send templates without district verification.

---

### Phase 2: Template Creation (NICE TO HAVE)

1. ⬜ Hunter.io API integration
2. ⬜ UserLookupQuota table (3/day rate limit)
3. ⬜ Redis caching (24h TTL)
4. ⬜ Decision-maker search UI
5. ⬜ Manual email entry fallback

**Why nice-to-have**: Template creators can manually enter emails (slower, but works).

---

## The Bottom Line

**Cicero (User Onboarding)**:
- Purpose: Address → districts for ZKP
- Frequency: 1x per user lifetime
- Cost: $0.04/user ($100/month = 2,500 users)
- Caching: By zip code (LocationCache table)
- Critical: YES (users can't send without district verification)

**Hunter.io (Template Creation)**:
- Purpose: Find corporate decision-maker emails
- Frequency: 3x/day per template creator
- Cost: FREE (50/month quota)
- Caching: Redis 24h TTL (not database)
- Critical: NO (manual entry fallback works)

**No overlap. Completely separate systems.**

---

**Status**: Architecture clarified. Cicero for onboarding, Hunter.io for template creation.
