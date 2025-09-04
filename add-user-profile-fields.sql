-- Add proper profile fields to User table
ALTER TABLE "user" 
ADD COLUMN "role" TEXT,
ADD COLUMN "organization" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "connection" TEXT,
ADD COLUMN "connection_details" TEXT,
ADD COLUMN "profile_completed_at" TIMESTAMP(3),
ADD COLUMN "profile_visibility" TEXT NOT NULL DEFAULT 'private';

-- Migrate existing profile data from phone field JSON hack
-- This is a data migration script - run manually after deploying schema changes
UPDATE "user" 
SET 
  "role" = (phone_json->>'role')::TEXT,
  "organization" = (phone_json->>'organization')::TEXT,
  "location" = (phone_json->>'location')::TEXT,
  "connection" = (phone_json->>'connection')::TEXT,
  "connection_details" = (phone_json->>'connectionDetails')::TEXT,
  "profile_completed_at" = (phone_json->>'completedAt')::TIMESTAMP(3)
FROM (
  SELECT 
    id,
    CASE 
      WHEN phone ~ '^{.*}$' THEN phone::JSON
      ELSE NULL 
    END as phone_json
  FROM "user"
  WHERE phone IS NOT NULL
) AS parsed
WHERE "user".id = parsed.id 
  AND parsed.phone_json IS NOT NULL;

-- Clean up phone field (optional - only if you're sure no real phone numbers exist)
-- UPDATE "user" SET phone = NULL WHERE phone ~ '^{.*}$';