# Seed Data Privacy Violations - CRITICAL

**Date:** 2025-11-09
**Severity:** CRITICAL - Database seeding violates EVERY privacy principle
**Status:** MUST RESEED FROM SCRATCH before launch

---

## TL;DR: Seeding Data DIRECTLY VIOLATES Architecture

**CYPHERPUNK-ARCHITECTURE.md (lines 91-108) explicitly FORBIDS:**

```typescript
### What's Private:
- Your address (verified once, cached as session credential)
- Your real identity (employer can't link pseudonymous ID to you)
- PII linkage (congressional office can't Google your name)

### Forbidden:
city, state, zip  // De-anonymization
latitude, longitude  // Geographic tracking
congressional_district  // Plaintext (use hash only)
political_embedding  // Behavioral profiling
community_sheaves  // Behavioral profiling
```

**Seed data (lines 1336-1886) stores ALL OF THIS:**
- ✅ Templates: PERFECT (keep 100%)
- ❌ Users: CATASTROPHIC privacy violations (DELETE ALL)

---

## Critical Violations in User Seed Data

### Violation #1: PII Storage (Lines 1342-1350)

```typescript
// ❌ FORBIDDEN by DATABASE-PRIVACY-MIGRATION.md
city: 'San Francisco',
state: 'CA',
zip: '94115',
congressional_district: 'CA-11',

// ❌ FORBIDDEN - Geographic tracking
latitude: 37.7749,
longitude: -122.4194,
```

**Why this is catastrophic:**
- Database privacy migration REMOVED these fields (lines 47-56 of DATABASE-PRIVACY-MIGRATION.md)
- We executed `npx prisma db push --accept-data-loss` to DELETE this data
- **Seed script RE-ADDS THE EXACT DATA WE DELETED**

**Impact:** Every user in the database has PII we promised to never store

---

### Violation #2: Behavioral Profiling (Lines 1350-1357)

```typescript
// ❌ FORBIDDEN - Behavioral profiling
political_embedding: [0.8, -0.2, 0.6, 0.1, -0.3],
community_sheaves: {
  education: 0.9,
  housing: 0.8,
  environment: 0.7
},
embedding_version: 'v1',
coordinates_updated_at: new Date('2024-01-15T10:30:00Z'),
```

**Why this is catastrophic:**
- Creates political profiles of users
- Enables surveillance capitalism
- **EXACTLY what CYPHERPUNK-ARCHITECTURE.md says we don't do**

**This is literally what we're fighting against.**

---

### Violation #3: Plaintext Districts (Line 1345)

```typescript
// ❌ FORBIDDEN - Should be SHA-256 hash only
congressional_district: 'CA-11',
```

**Correct approach (DATABASE-PRIVACY-MIGRATION.md line 32):**
```typescript
district_hash: 'SHA-256(CA-11)'  // Hash only, never plaintext
```

---

### Violation #4: Fake Verification Data (Lines 1362-1366)

```typescript
is_verified: true,
verification_method: 'didit_zk',
verification_data: {
  proof_hash: 'zk_proof_abc123',  // ← Fake proof hash
  timestamp: '2024-01-10T14:22:33Z'
},
verified_at: new Date('2024-01-10T14:22:33Z'),
```

**Why this is bad:**
- Fake ZK proof hashes
- No actual identity verification
- Creates false security theater

**Impact:** Can't distinguish real users from seed data in analytics

---

### Violation #5: Wallet Addresses Without Derivation (Line 1369)

```typescript
// ❌ Hard-coded wallet addresses
wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
```

**Correct approach (CLAUDE.md lines 40-46):**
```typescript
// Deterministic derivation from passkey (NEAR Chain Signatures)
scroll_address: DERIVE_FROM_PASSKEY(user_passkey, "scroll-sepolia,1")
```

**Impact:** Fake addresses don't match passkey-derived addresses in production

---

## What Should User Seed Data Look Like?

### Compliant User Seed Data (Privacy-Preserving)

```typescript
const compliantSeedUserData = [
  {
    email: 'sarah.teacher@gmail.com',  // ✅ OK (used for auth, not PII)
    name: 'Sarah Martinez',            // ✅ OK (profile field, user choice)
    avatar: 'https://...',             // ✅ OK (profile field)

    // === VERIFICATION (no PII) ===
    is_verified: false,  // ✅ Start unverified (verify via UI flow)
    verification_method: null,
    verification_data: null,
    verified_at: null,

    // === BLOCKCHAIN (deterministic from passkey) ===
    scroll_address: null,  // ✅ Derived on first passkey creation
    scroll_derivation_path: 'scroll-sepolia,1',

    // === PRIVACY-PRESERVING FIELDS ===
    district_hash: null,  // ✅ Set after verification (SHA-256 only)
    trust_score: 0,  // ✅ Starts at 0
    reputation_tier: 'novice',  // ✅ Initial tier

    // === VOTER PROTOCOL (on-chain only) ===
    pending_rewards: '0',
    total_earned: '0',
    last_certification: null,

    // === PROFILE (user choice) ===
    role: null,
    organization: null,
    location: null,  // ✅ "San Francisco" OK (city-level, not address)
    connection: null,
    profile_visibility: 'private',

    // ❌ FORBIDDEN - NEVER include these:
    // city: null,  // DELETED from schema
    // state: null,  // DELETED from schema
    // zip: null,  // DELETED from schema
    // congressional_district: null,  // Use district_hash instead
    // latitude: null,  // DELETED from schema
    // longitude: null,  // DELETED from schema
    // political_embedding: null,  // DELETED from schema
    // community_sheaves: null,  // DELETED from schema
    // embedding_version: null,  // DELETED from schema
    // coordinates_updated_at: null,  // DELETED from schema
  }
];
```

---

## Template Seed Data: PERFECT (Keep 100%)

**Templates (lines 81-1332): ✅ NO PRIVACY VIOLATIONS**

Templates contain:
- ✅ PUBLIC message content (congressional offices READ this)
- ✅ Aggregate metrics (`sent: 8234` - total sends, no individual tracking)
- ✅ Policy areas, urgency levels
- ✅ Agent consensus data (moderation results)
- ✅ NO user PII
- ✅ NO individual user tracking

**KEEP ALL TEMPLATE DATA EXACTLY AS-IS**

---

## Impact Assessment

### If We Launch With Current Seed Data:

**Legal Risk:**
- ❌ Privacy policy says we don't store addresses
- ❌ Database contains addresses, coordinates, districts
- ❌ Potential GDPR/CCPA violations (if EU/CA users)

**Security Risk:**
- ❌ Database breach exposes user addresses
- ❌ Political profiling data (`political_embedding`, `community_sheaves`)
- ❌ Surveillance targets (activists, organizers in seed data)

**Credibility Risk:**
- ❌ "We protect privacy" → Database full of PII
- ❌ Cypherpunk architecture → Centralized surveillance data
- ❌ INSTANT loss of trust if discovered

---

## Reseed Action Plan

### Step 1: Delete All User Seed Data

```bash
# Clear all users (cascades to relationships)
npx prisma studio
# OR via script:
await db.user.deleteMany({});
```

### Step 2: Create Privacy-Compliant Seed Users

**File:** `scripts/seed-users-privacy-compliant.ts`

```typescript
const privacyCompliantUsers = [
  {
    email: 'demo.user@example.com',
    name: 'Demo User',
    avatar: 'https://images.unsplash.com/photo-...',

    // NO PII - everything starts null/false
    is_verified: false,
    verification_method: null,
    district_hash: null,
    trust_score: 0,
    reputation_tier: 'novice',

    // Profile (user choice, not PII)
    role: null,
    organization: null,
    location: 'San Francisco, CA',  // City-level OK
    connection: null,
    profile_visibility: 'private',

    // Blockchain (derived on passkey creation)
    scroll_address: null,
    pending_rewards: '0',
    total_earned: '0',
  },
  // Repeat for 5-10 demo users
];
```

**Verification happens through UI flow:**
1. User clicks "Verify Identity"
2. self.xyz NFC scan OR Didit.me flow
3. Address encrypted to TEE (never stored plaintext)
4. `district_hash` set (SHA-256 only)
5. `is_verified` = true

### Step 3: Keep Templates 100% As-Is

Templates are PERFECT. No changes needed.

### Step 4: Remove Congressional Relationships

**Current seed (lines 2120-2171):**
```typescript
// ❌ VIOLATES PRIVACY - Links users to districts via plaintext matching
await db.user_representatives.create({
  data: {
    user_id: user.id,
    representative_id: rep.id,
    // This reveals user.congressional_district in plaintext
  }
});
```

**Correct approach:**
- Representatives seeded independently (✅ OK)
- Users DON'T link to representatives in seed data
- Linking happens AFTER verification (via district_hash matching)

---

## Files to Modify

### Delete These Fields from Seed Data:

**File:** `scripts/seed-database.ts`

**Lines to DELETE from seedUserData:**
```typescript
// DELETE lines 1342-1357 for EVERY user:
city: ...,
state: ...,
zip: ...,
congressional_district: ...,
latitude: ...,
longitude: ...,
political_embedding: ...,
community_sheaves: ...,
embedding_version: ...,
coordinates_updated_at: ...,
```

### Keep These Fields:

```typescript
// KEEP:
email: ...,
name: ...,
avatar: ...,
is_verified: false,  // Start unverified
district_hash: null,  // Set after verification
trust_score: 0,
reputation_tier: 'novice',
role: null,
organization: null,
location: 'San Francisco, CA',  // City-level OK
```

---

## Testing Strategy

### After Reseed:

**Verify Privacy Compliance:**
```sql
-- Should return 0 rows (no PII stored)
SELECT * FROM "user" WHERE city IS NOT NULL;
SELECT * FROM "user" WHERE state IS NOT NULL;
SELECT * FROM "user" WHERE zip IS NOT NULL;
SELECT * FROM "user" WHERE congressional_district IS NOT NULL;
SELECT * FROM "user" WHERE latitude IS NOT NULL;
SELECT * FROM "user" WHERE longitude IS NOT NULL;
```

**Verify Templates Intact:**
```sql
-- Should return all templates (16+)
SELECT COUNT(*) FROM "template" WHERE is_public = true;
```

**Verify User Cleanup:**
```sql
-- Should return users with NO PII
SELECT id, email, name, district_hash, is_verified FROM "user";
```

---

## Recommended Seed User Count

**Pre-Launch:**
- 5-10 demo users (privacy-compliant)
- NO PII, NO verification (verify through UI)
- Mix of roles (teacher, developer, organizer)
- Geographic diversity via `location` field only (city-level)

**Post-Launch:**
- Real users verify through self.xyz / Didit.me
- `district_hash` set automatically
- NO plaintext addresses EVER stored

---

## Summary: What Changed Since Database Migration?

**DATABASE-PRIVACY-MIGRATION.md execution:**
- ✅ Deleted 12 user records with PII
- ✅ Removed PII fields from schema
- ✅ Created Message model (pseudonymous)

**Seed script UNDOES this work:**
- ❌ Re-adds city, state, zip (deleted fields)
- ❌ Re-adds latitude, longitude (deleted fields)
- ❌ Re-adds congressional_district plaintext (should be hash)
- ❌ Re-adds political_embedding (deleted field)
- ❌ Re-adds community_sheaves (deleted field)

**FIX:** Reseed with privacy-compliant user data only

---

## Decision Required

**Option A: Reseed Now (RECOMMENDED)**
- Delete current user seed data
- Create privacy-compliant users
- Keep all template data
- Launch-ready in 1 hour

**Option B: Launch With Violations (CATASTROPHIC)**
- Risk legal liability
- Risk security breach
- Risk credibility loss
- Violate every principle in our docs

**Recommendation:** Option A. Reseed immediately. This is non-negotiable.

---

## Next Steps (Immediate)

1. **Stop dev server** (prevent accidental use of violating data)
2. **Delete user seed data** (lines 1336-1886 in seed-database.ts)
3. **Create privacy-compliant users** (5-10 minimal demo users)
4. **Keep templates 100%** (they're perfect)
5. **Reseed database** (`npm run db:seed`)
6. **Verify compliance** (SQL queries above)
7. **Resume development**

**Estimated time:** 30-60 minutes

---

**This is not a suggestion. This is a requirement for launch.**

The templates are excellent. The user data is a privacy catastrophe.
