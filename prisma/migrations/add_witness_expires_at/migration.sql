-- Add witness_expires_at for data minimization (Phase 4D)
-- Encrypted witness data auto-expires after 30 days.
-- Cleanup cron NULLs out encrypted_witness, witness_nonce, ephemeral_public_key.

ALTER TABLE submission ADD COLUMN witness_expires_at TIMESTAMP;

-- Set expiry for existing submissions (30 days from creation)
UPDATE submission SET witness_expires_at = created_at + INTERVAL '30 days'
WHERE witness_expires_at IS NULL AND encrypted_witness IS NOT NULL AND encrypted_witness != '';

-- Index for cleanup cron efficiency
CREATE INDEX idx_submission_witness_expires_at ON submission (witness_expires_at);
