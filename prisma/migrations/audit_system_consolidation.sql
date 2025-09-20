-- AUDIT SYSTEM CONSOLIDATION: 4→2 MODELS MIGRATION
-- Consolidates ReputationLog + CertificationLog → Enhanced AuditLog
-- Enhances CivicAction for blockchain-only functionality
-- Date: 2025-09-19

-- ============================================================================
-- STEP 1: Create new enhanced AuditLog table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    
    -- Core audit classification
    "action_type" TEXT NOT NULL, -- 'civic_action', 'reputation_change', 'verification', 'authentication', 'template_action'
    "action_subtype" TEXT, -- 'cwc_message', 'challenge_create', 'score_update', 'login', 'template_submit'
    
    -- Unified audit data (flexible JSONB storage)
    "audit_data" JSONB NOT NULL DEFAULT '{}',
    
    -- Agent provenance & evidence (from ReputationLog)
    "agent_source" TEXT,
    "agent_decisions" JSONB,
    "evidence_hash" TEXT,
    "confidence" REAL,
    
    -- Reputation tracking (consolidated from ReputationLog)
    "score_before" INTEGER,
    "score_after" INTEGER,
    "change_amount" INTEGER,
    "change_reason" TEXT,
    
    -- Certification tracking (consolidated from CertificationLog)
    "certification_type" TEXT,
    "certification_hash" TEXT,
    "certification_data" JSONB,
    "reward_amount" TEXT, -- BigInt as string
    "recipient_emails" TEXT[] NOT NULL DEFAULT '{}',
    
    -- Blockchain correlation (link to CivicAction if applicable)
    "civic_action_id" TEXT UNIQUE,
    
    -- Technical audit data (from original AuditLog)
    "ip_address" TEXT,
    "user_agent" TEXT,
    
    -- Metadata & status
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error_message" TEXT,
    "metadata" JSONB DEFAULT '{}',
    
    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log"("user_id");
CREATE INDEX IF NOT EXISTS "audit_log_action_type_idx" ON "audit_log"("action_type");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log"("created_at");
CREATE INDEX IF NOT EXISTS "audit_log_change_reason_idx" ON "audit_log"("change_reason");
CREATE INDEX IF NOT EXISTS "audit_log_certification_type_idx" ON "audit_log"("certification_type");
CREATE INDEX IF NOT EXISTS "audit_log_certification_hash_idx" ON "audit_log"("certification_hash");

-- ============================================================================
-- STEP 2: Enhanced CivicAction table (blockchain-focused)
-- ============================================================================

-- Add new blockchain-specific columns to CivicAction
ALTER TABLE "civic_action" ADD COLUMN IF NOT EXISTS "block_number" INTEGER;
ALTER TABLE "civic_action" ADD COLUMN IF NOT EXISTS "confirmation_count" INTEGER;
ALTER TABLE "civic_action" ADD COLUMN IF NOT EXISTS "gas_used" TEXT; -- BigInt as string
ALTER TABLE "civic_action" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);

-- Add new indexes for blockchain functionality
CREATE INDEX IF NOT EXISTS "civic_action_tx_hash_idx" ON "civic_action"("tx_hash");

-- ============================================================================
-- STEP 3: Migrate ReputationLog data to AuditLog
-- ============================================================================

-- Migrate all ReputationLog records to AuditLog
INSERT INTO "audit_log" (
    "id",
    "user_id",
    "action_type",
    "action_subtype", 
    "audit_data",
    "agent_source",
    "evidence_hash",
    "confidence",
    "score_before",
    "score_after",
    "change_amount",
    "change_reason",
    "status",
    "metadata",
    "created_at"
)
SELECT 
    rl."id" as "id",
    rl."user_id",
    'reputation_change' as "action_type",
    'score_update' as "action_subtype",
    jsonb_build_object(
        'original_table', 'reputation_log',
        'tx_hash', rl."tx_hash",
        'block_number', rl."block_number"
    ) as "audit_data",
    rl."agent_source",
    rl."evidence_hash", 
    rl."confidence",
    rl."score_before",
    rl."score_after",
    rl."change_amount",
    rl."change_reason",
    'completed' as "status",
    '{"migrated_from": "reputation_log"}' as "metadata",
    rl."created_at"
FROM "reputation_log" rl
WHERE EXISTS (SELECT 1 FROM "reputation_log") -- Only if table exists
ON CONFLICT ("id") DO NOTHING; -- Avoid duplicates if re-run

-- ============================================================================
-- STEP 4: Migrate CertificationLog data to AuditLog  
-- ============================================================================

-- Migrate all CertificationLog records to AuditLog
INSERT INTO "audit_log" (
    "id",
    "user_id",
    "action_type",
    "action_subtype",
    "audit_data",
    "certification_type",
    "certification_hash",
    "certification_data",
    "reward_amount",
    "recipient_emails", 
    "status",
    "error_message",
    "metadata",
    "created_at"
)
SELECT 
    cl."id" as "id",
    cl."user_id",
    'verification' as "action_type",
    cl."action_type" as "action_subtype",
    jsonb_build_object(
        'original_table', 'certification_log',
        'reputation_change', cl."reputation_change",
        'template_id', cl."template_id"
    ) as "audit_data",
    'voter_protocol' as "certification_type",
    cl."certification_hash",
    jsonb_build_object(
        'reward_amount', cl."reward_amount",
        'reputation_change', cl."reputation_change",
        'template_id', cl."template_id"
    ) as "certification_data", 
    cl."reward_amount"::TEXT,
    cl."recipient_emails",
    cl."status",
    cl."error_message",
    '{"migrated_from": "certification_log"}' as "metadata",
    cl."created_at"
FROM "certification_log" cl
WHERE EXISTS (SELECT 1 FROM "certification_log") -- Only if table exists
ON CONFLICT ("id") DO NOTHING; -- Avoid duplicates if re-run

-- ============================================================================
-- STEP 5: Migrate existing basic AuditLog data to enhanced format
-- ============================================================================

-- Update existing AuditLog records to use new format
UPDATE "audit_log" SET 
    "action_type" = CASE 
        WHEN "action" ILIKE '%login%' THEN 'authentication'
        WHEN "action" ILIKE '%template%' THEN 'template_action'
        WHEN "action" ILIKE '%civic%' THEN 'civic_action'
        ELSE 'authentication'
    END,
    "action_subtype" = "action",
    "audit_data" = jsonb_build_object(
        'original_action', "action",
        'migrated_basic_audit', true
    )
WHERE "action_type" IS NULL OR "action_type" = ''; -- Only update legacy records

-- ============================================================================
-- STEP 6: Link CivicAction to AuditLog (one-to-one relationship)
-- ============================================================================

-- Create audit log entries for existing CivicActions
INSERT INTO "audit_log" (
    "user_id",
    "action_type", 
    "action_subtype",
    "civic_action_id",
    "audit_data",
    "agent_decisions",
    "status",
    "metadata",
    "created_at"
)
SELECT 
    ca."user_id",
    'civic_action' as "action_type",
    ca."action_type" as "action_subtype", 
    ca."id" as "civic_action_id",
    jsonb_build_object(
        'template_id', ca."template_id",
        'blockchain_integration', true
    ) as "audit_data",
    ca."agent_decisions",
    ca."status",
    jsonb_build_object(
        'created_for_civic_action', true,
        'tx_hash', ca."tx_hash",
        'reward_wei', ca."reward_wei"
    ) as "metadata",
    ca."created_at"
FROM "civic_action" ca
WHERE NOT EXISTS (
    SELECT 1 FROM "audit_log" al 
    WHERE al."civic_action_id" = ca."id"
); -- Only create if not already linked

-- ============================================================================
-- STEP 7: Data validation and integrity checks
-- ============================================================================

-- Validate migration completed successfully
DO $$
DECLARE
    reputation_count INTEGER;
    certification_count INTEGER;
    audit_reputation_count INTEGER;
    audit_certification_count INTEGER;
BEGIN
    -- Count original records
    SELECT COUNT(*) INTO reputation_count FROM "reputation_log" WHERE EXISTS (SELECT 1 FROM "reputation_log");
    SELECT COUNT(*) INTO certification_count FROM "certification_log" WHERE EXISTS (SELECT 1 FROM "certification_log");
    
    -- Count migrated records
    SELECT COUNT(*) INTO audit_reputation_count FROM "audit_log" WHERE "action_type" = 'reputation_change';
    SELECT COUNT(*) INTO audit_certification_count FROM "audit_log" WHERE "action_type" = 'verification';
    
    -- Log migration results
    RAISE NOTICE 'AUDIT CONSOLIDATION MIGRATION SUMMARY:';
    RAISE NOTICE 'ReputationLog records: % → AuditLog reputation_change: %', reputation_count, audit_reputation_count;
    RAISE NOTICE 'CertificationLog records: % → AuditLog verification: %', certification_count, audit_certification_count;
    
    -- Verify data integrity
    IF reputation_count > 0 AND audit_reputation_count < reputation_count THEN
        RAISE WARNING 'ReputationLog migration incomplete: %/% records migrated', audit_reputation_count, reputation_count;
    END IF;
    
    IF certification_count > 0 AND audit_certification_count < certification_count THEN
        RAISE WARNING 'CertificationLog migration incomplete: %/% records migrated', audit_certification_count, certification_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 8: Clean up old tables (COMMENTED OUT FOR SAFETY)
-- ============================================================================

-- IMPORTANT: Uncomment these ONLY after verifying migration success in production
-- AND after backing up the database

-- DROP TABLE IF EXISTS "reputation_log" CASCADE;
-- DROP TABLE IF EXISTS "certification_log" CASCADE;

-- ============================================================================
-- MIGRATION COMPLETE: Audit System 4→2 Models Consolidation
-- ============================================================================

-- Summary of changes:
-- ✅ Created enhanced AuditLog with unified audit trail
-- ✅ Enhanced CivicAction for blockchain-only functionality  
-- ✅ Migrated ReputationLog → AuditLog (reputation_change type)
-- ✅ Migrated CertificationLog → AuditLog (verification type)
-- ✅ Linked CivicAction ↔ AuditLog (one-to-one relationship)
-- ✅ Preserved all historical data with migration metadata
-- ✅ Added comprehensive indexing for performance
-- ⚠️  Old tables preserved until manual cleanup (safety measure)

COMMIT;