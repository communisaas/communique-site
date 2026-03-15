-- Strategic Realignment: Tier Renumber
-- Tier 0 is now "Guest" (conceptual, no user object). All authenticated users are Tier 1+.
-- Safe: hooks.server.ts derives trust_tier live via deriveTrustTier(), not from the stored column.
-- No code checks trust_tier = 0 from DB — all tier gates use >= 2, >= 3, >= 4.

UPDATE users SET trust_tier = 1 WHERE trust_tier = 0;
ALTER TABLE users ALTER COLUMN trust_tier SET DEFAULT 1;
