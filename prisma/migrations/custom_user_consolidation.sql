-- User Identity Consolidation Migration
-- This migration consolidates 4 user models into 1 enhanced model
-- WARNING: This migration includes breaking changes

BEGIN;

-- Step 1: Add new coordinate fields to User table
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "political_embedding" JSONB,
ADD COLUMN IF NOT EXISTS "community_sheaves" JSONB,
ADD COLUMN IF NOT EXISTS "embedding_version" TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS "coordinates_updated_at" TIMESTAMP(3);

-- Step 2: Migrate data from user_coordinates to User table
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

-- Step 3: Consolidate wallet addresses (if voter_address and wallet_address exist)
DO $$
BEGIN
  -- Check if voter_address column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user' AND column_name = 'voter_address'
  ) THEN
    -- Consolidate voter_address into wallet_address where null
    UPDATE "user" 
    SET "wallet_address" = COALESCE("wallet_address", "voter_address")
    WHERE "wallet_address" IS NULL AND "voter_address" IS NOT NULL;
  END IF;

  -- Check if voter_reputation column exists  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user' AND column_name = 'voter_reputation'
  ) THEN
    -- Migrate voter_reputation to trust_score where trust_score is 0 (default)
    UPDATE "user" 
    SET "trust_score" = "voter_reputation"
    WHERE "trust_score" = 0 AND "voter_reputation" IS NOT NULL AND "voter_reputation" != 0;
  END IF;
END $$;

-- Step 4: Remove isPrimary from UserEmail (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_emails' AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE "user_emails" DROP COLUMN "is_primary";
  END IF;
END $$;

-- Step 5: Drop user_coordinates table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_coordinates'
  ) THEN
    -- Remove foreign key constraint first
    ALTER TABLE "user_coordinates" DROP CONSTRAINT IF EXISTS "user_coordinates_user_id_fkey";
    -- Drop the table
    DROP TABLE "user_coordinates";
  END IF;
END $$;

-- Step 6: Create indexes for new coordinate fields
CREATE INDEX IF NOT EXISTS "user_coordinates_idx" ON "user" ("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "user_embedding_idx" ON "user" ("embedding_version");

-- Step 7: Data integrity verification
DO $$
DECLARE
  total_users INTEGER;
  users_with_coords INTEGER;
  users_with_embeddings INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT("latitude"),
    COUNT("political_embedding")
  INTO total_users, users_with_coords, users_with_embeddings
  FROM "user";
  
  RAISE NOTICE 'Migration completed. Total users: %, Users with coordinates: %, Users with embeddings: %', 
    total_users, users_with_coords, users_with_embeddings;
END $$;

COMMIT;