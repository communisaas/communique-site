# User Identity Consolidation Migration Guide

## Overview

This migration consolidates 4 user models into 1 enhanced User model + 1 simplified UserEmail model + 1 unchanged relation table (user_representatives).

### Critical Changes

#### **BREAKING CHANGE: Wallet Address Consolidation**

The duplicate wallet address fields (`User.voter_address` + `User.wallet_address`) have been consolidated into a single `wallet_address` field.

#### **Data Migration Required: user_coordinates → User**

All coordinate and political embedding data from the `user_coordinates` table is being merged into the enhanced `User` model.

## Migration SQL Scripts

### Step 1: Add New Columns to User Table

```sql
-- Add merged coordinates fields to User table
ALTER TABLE "user"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "political_embedding" JSONB,
ADD COLUMN "community_sheaves" JSONB,
ADD COLUMN "embedding_version" TEXT DEFAULT 'v1',
ADD COLUMN "coordinates_updated_at" TIMESTAMP(3);

-- Create indexes for new coordinate fields
CREATE INDEX "user_coordinates_idx" ON "user" ("latitude", "longitude");
CREATE INDEX "user_embedding_idx" ON "user" ("embedding_version");
```

### Step 2: Migrate Data from user_coordinates

```sql
-- Migrate all user_coordinates data into User table
UPDATE "user"
SET
  "latitude" = uc."latitude",
  "longitude" = uc."longitude",
  "political_embedding" = uc."political_embedding",
  "community_sheaves" = uc."community_sheaves",
  "embedding_version" = uc."embedding_version",
  "coordinates_updated_at" = uc."last_calculated"
FROM "user_coordinates" uc
WHERE "user"."id" = uc."user_id";
```

### Step 3: Consolidate Wallet Addresses and Migrate Reputation

```sql
-- CRITICAL: Consolidate voter_address into wallet_address where null
-- Prioritize wallet_address, fallback to voter_address
UPDATE "user"
SET "wallet_address" = COALESCE("wallet_address", "voter_address")
WHERE "wallet_address" IS NULL AND "voter_address" IS NOT NULL;

-- Migrate voter_reputation to trust_score where trust_score is 0 (default)
UPDATE "user"
SET "trust_score" = "voter_reputation"
WHERE "trust_score" = 0 AND "voter_reputation" IS NOT NULL AND "voter_reputation" != 0;

-- Remove the deprecated columns (BREAKING CHANGE)
ALTER TABLE "user" DROP COLUMN "voter_address";
ALTER TABLE "user" DROP COLUMN "voter_reputation"; -- Replaced by trust_score
```

### Step 4: Simplify UserEmail Table

```sql
-- Remove isPrimary field from UserEmail (BREAKING CHANGE)
ALTER TABLE "user_emails" DROP COLUMN "is_primary";
```

### Step 5: Drop user_coordinates Table

```sql
-- Remove foreign key constraint first
ALTER TABLE "user_coordinates" DROP CONSTRAINT "user_coordinates_user_id_fkey";

-- Drop the entire table
DROP TABLE "user_coordinates";
```

### Step 6: Verify Data Integrity

```sql
-- Verify all coordinate data was migrated
SELECT
  COUNT(*) as total_users,
  COUNT("latitude") as users_with_coordinates,
  COUNT("political_embedding") as users_with_embeddings
FROM "user";

-- Check for any remaining voter_address references (should be 0)
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'user' AND column_name = 'voter_address';
```

## Application Code Changes Required

### 1. Authentication & Session Management

**File: `src/lib/core/auth/auth.server.ts`**

```typescript
// BEFORE: Separate coordinates lookup
const user = await prisma.user.findUnique({
	where: { id },
	include: { coordinates: true }
});

// AFTER: Direct coordinate access
const user = await prisma.user.findUnique({
	where: { id },
	select: {
		id: true,
		email: true,
		latitude: true,
		longitude: true,
		political_embedding: true
		// ... other fields
	}
});
```

### 2. Wallet Address References

**Update all voter_address references to wallet_address:**

```typescript
// BEFORE
user.voter_address;

// AFTER
user.wallet_address;
```

### 3. Coordinates Access

**File: User-related services**

```typescript
// BEFORE: Nested coordinates object
user.coordinates?.latitude;

// AFTER: Direct access
user.latitude;
```

### 4. UserEmail Primary Email Logic

**Since isPrimary field is removed, primary email is now the User.email field:**

```typescript
// BEFORE: Find primary email
const primaryEmail = user.secondary_emails.find((e) => e.isPrimary)?.email || user.email;

// AFTER: User.email is always primary
const primaryEmail = user.email;
```

## Breaking Changes Summary

| Field/Table              | Change      | Impact                       | Migration                          |
| ------------------------ | ----------- | ---------------------------- | ---------------------------------- |
| `User.voter_address`     | **REMOVED** | High - All wallet references | Consolidated into `wallet_address` |
| `User.voter_reputation`  | **REMOVED** | Medium - Reputation logic    | Use `trust_score` instead          |
| `user_coordinates` table | **REMOVED** | High - Coordinate queries    | Data merged into User model        |
| `UserEmail.isPrimary`    | **REMOVED** | Medium - Email logic         | Use `User.email` as primary        |
| User coordinate access   | **CHANGED** | Medium - Query patterns      | Direct field access vs relation    |

## Rollback Strategy

If rollback is needed before the migration is fully committed:

```sql
-- Recreate user_coordinates table
CREATE TABLE "user_coordinates" (
  "user_id" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "political_embedding" JSONB,
  "community_sheaves" JSONB,
  "embedding_version" TEXT NOT NULL DEFAULT 'v1',
  "last_calculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_coordinates_pkey" PRIMARY KEY ("user_id")
);

-- Migrate data back
INSERT INTO "user_coordinates" (
  "user_id", "latitude", "longitude", "political_embedding",
  "community_sheaves", "embedding_version", "last_calculated", "updated_at"
)
SELECT
  "id", "latitude", "longitude", "political_embedding",
  "community_sheaves", "embedding_version",
  COALESCE("coordinates_updated_at", "updated_at"),
  "updated_at"
FROM "user"
WHERE "latitude" IS NOT NULL OR "political_embedding" IS NOT NULL;
```

## Testing Checklist

- [ ] Verify all user authentication flows work with consolidated model
- [ ] Test wallet address resolution in VOTER Protocol integration
- [ ] Confirm coordinate-based features (political bubbles, etc.) work
- [ ] Validate email management without isPrimary field
- [ ] Check that all user_coordinates queries are updated
- [ ] Verify user registration/profile completion flows
- [ ] Test user export/import functionality

## Performance Impact

**Positive:**

- Eliminated 1 table join for coordinate data access
- Simplified user data queries
- Reduced database complexity

**Negative:**

- User table row size increased (acceptable for pre-launch)
- Some queries may need index optimization

## Post-Migration Verification

1. **Data Integrity**: All user coordinate data preserved
2. **Wallet Consolidation**: No duplicate wallet addresses
3. **Email Simplification**: Primary email logic updated
4. **Relationship Integrity**: user_representatives unchanged
5. **Performance**: Query performance maintained or improved
