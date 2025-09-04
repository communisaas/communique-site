-- Add comprehensive blockchain fields for VOTER Protocol integration

-- Add blockchain address fields to users table
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "derived_address" TEXT,
ADD COLUMN IF NOT EXISTS "connected_address" TEXT,
ADD COLUMN IF NOT EXISTS "address_type" TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "address_generated_at" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "wallet_connected_at" TIMESTAMP WITH TIME ZONE;

-- Add VOTER Protocol token fields
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "voter_balance" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "staked_balance" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "voting_power" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "pending_rewards" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "total_earned" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_reward_claim" TIMESTAMP WITH TIME ZONE;

-- Add reputation score fields (Carroll Mechanisms)
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "challenge_score" INTEGER DEFAULT 0 CHECK ("challenge_score" >= 0 AND "challenge_score" <= 100),
ADD COLUMN IF NOT EXISTS "civic_score" INTEGER DEFAULT 0 CHECK ("civic_score" >= 0 AND "civic_score" <= 100),
ADD COLUMN IF NOT EXISTS "discourse_score" INTEGER DEFAULT 0 CHECK ("discourse_score" >= 0 AND "discourse_score" <= 100),
ADD COLUMN IF NOT EXISTS "total_reputation" INTEGER DEFAULT 0 CHECK ("total_reputation" >= 0 AND "total_reputation" <= 100),
ADD COLUMN IF NOT EXISTS "reputation_tier" TEXT DEFAULT 'novice',
ADD COLUMN IF NOT EXISTS "last_certification" TIMESTAMP WITH TIME ZONE;

-- Create civic_certifications table for tracking verified actions
CREATE TABLE IF NOT EXISTS "civic_certifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_address" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_hash" TEXT NOT NULL,
    "certification_hash" TEXT NOT NULL UNIQUE,
    
    -- Verification details
    "verified" BOOLEAN DEFAULT false,
    "verification_method" TEXT,
    "verification_agents" TEXT[],
    "consensus_score" DECIMAL(3,2),
    
    -- Rewards
    "reward_amount" BIGINT DEFAULT 0,
    "reward_tx_hash" TEXT,
    "reward_status" TEXT DEFAULT 'pending',
    
    -- Reputation impact
    "reputation_change_challenge" INTEGER DEFAULT 0,
    "reputation_change_civic" INTEGER DEFAULT 0,
    "reputation_change_discourse" INTEGER DEFAULT 0,
    "reputation_change_total" INTEGER DEFAULT 0,
    
    -- Metadata
    "template_id" TEXT,
    "recipients" TEXT[],
    "ipfs_hash" TEXT,
    "block_number" BIGINT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "civic_certifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "civic_certifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create challenge_participations table (Carroll Mechanisms)
CREATE TABLE IF NOT EXISTS "challenge_participations" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_address" TEXT NOT NULL,
    
    -- Challenge details
    "claim_hash" TEXT NOT NULL,
    "stance" TEXT NOT NULL CHECK ("stance" IN ('support', 'oppose')),
    "stake_amount" BIGINT DEFAULT 0,
    
    -- Quality assessment
    "sources_provided" TEXT[],
    "sources_quality" INTEGER DEFAULT 0 CHECK ("sources_quality" >= 0 AND "sources_quality" <= 100),
    "argument_quality" INTEGER DEFAULT 0 CHECK ("argument_quality" >= 0 AND "argument_quality" <= 100),
    "good_faith_score" INTEGER DEFAULT 0 CHECK ("good_faith_score" >= 0 AND "good_faith_score" <= 100),
    
    -- Outcome
    "resolution" TEXT DEFAULT 'pending' CHECK ("resolution" IN ('won', 'lost', 'pending')),
    "reward_earned" BIGINT DEFAULT 0,
    "reputation_impact" INTEGER DEFAULT 0,
    
    -- Timestamps
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP WITH TIME ZONE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "challenge_participations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_participations_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create virtual_rewards table for off-chain reward tracking
CREATE TABLE IF NOT EXISTS "virtual_rewards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_address" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    
    -- Source
    "source_type" TEXT NOT NULL CHECK ("source_type" IN ('certification', 'challenge', 'governance')),
    "source_id" TEXT NOT NULL,
    
    -- Status
    "status" TEXT DEFAULT 'pending' CHECK ("status" IN ('pending', 'available', 'claiming', 'claimed')),
    "claimable" BOOLEAN DEFAULT false,
    "claim_requirements" TEXT[],
    "claim_tx_hash" TEXT,
    
    -- Timestamps
    "earned_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMP WITH TIME ZONE,
    "claimed_at" TIMESTAMP WITH TIME ZONE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "virtual_rewards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "virtual_rewards_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create governance_activities table
CREATE TABLE IF NOT EXISTS "governance_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_address" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    
    -- Action details
    "action_type" TEXT NOT NULL CHECK ("action_type" IN ('propose', 'vote', 'delegate')),
    "vote_choice" TEXT CHECK ("vote_choice" IN ('for', 'against', 'abstain')),
    "voting_power" BIGINT DEFAULT 0,
    
    -- Delegation
    "delegated_to" TEXT,
    "delegated_from" TEXT[],
    
    -- Metadata
    "block_number" BIGINT,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "governance_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "governance_activities_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create address_migrations table for tracking address changes
CREATE TABLE IF NOT EXISTS "address_migrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_address" TEXT,
    "new_address" TEXT NOT NULL,
    "migration_type" TEXT NOT NULL CHECK ("migration_type" IN ('generation', 'wallet_connection', 'wallet_change')),
    
    -- Migration details
    "rewards_transferred" BIGINT DEFAULT 0,
    "reputation_transferred" BOOLEAN DEFAULT false,
    "history_migrated" BOOLEAN DEFAULT false,
    
    -- Status
    "status" TEXT DEFAULT 'pending' CHECK ("status" IN ('pending', 'in_progress', 'completed', 'failed')),
    "error" TEXT,
    
    -- Timestamps
    "initiated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT "address_migrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "address_migrations_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_users_derived_address" ON "users"("derived_address");
CREATE INDEX IF NOT EXISTS "idx_users_connected_address" ON "users"("connected_address");
CREATE INDEX IF NOT EXISTS "idx_users_reputation_tier" ON "users"("reputation_tier");
CREATE INDEX IF NOT EXISTS "idx_users_voter_balance" ON "users"("voter_balance");

CREATE INDEX IF NOT EXISTS "idx_civic_certifications_user_id" ON "civic_certifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_civic_certifications_user_address" ON "civic_certifications"("user_address");
CREATE INDEX IF NOT EXISTS "idx_civic_certifications_created_at" ON "civic_certifications"("created_at");
CREATE INDEX IF NOT EXISTS "idx_civic_certifications_reward_status" ON "civic_certifications"("reward_status");

CREATE INDEX IF NOT EXISTS "idx_challenge_participations_user_id" ON "challenge_participations"("user_id");
CREATE INDEX IF NOT EXISTS "idx_challenge_participations_challenge_id" ON "challenge_participations"("challenge_id");
CREATE INDEX IF NOT EXISTS "idx_challenge_participations_resolution" ON "challenge_participations"("resolution");

CREATE INDEX IF NOT EXISTS "idx_virtual_rewards_user_id" ON "virtual_rewards"("user_id");
CREATE INDEX IF NOT EXISTS "idx_virtual_rewards_status" ON "virtual_rewards"("status");
CREATE INDEX IF NOT EXISTS "idx_virtual_rewards_claimable" ON "virtual_rewards"("claimable");

CREATE INDEX IF NOT EXISTS "idx_governance_activities_user_id" ON "governance_activities"("user_id");
CREATE INDEX IF NOT EXISTS "idx_governance_activities_proposal_id" ON "governance_activities"("proposal_id");

CREATE INDEX IF NOT EXISTS "idx_address_migrations_user_id" ON "address_migrations"("user_id");
CREATE INDEX IF NOT EXISTS "idx_address_migrations_status" ON "address_migrations"("status");

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_civic_certifications_updated_at BEFORE UPDATE ON "civic_certifications"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenge_participations_updated_at BEFORE UPDATE ON "challenge_participations"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_virtual_rewards_updated_at BEFORE UPDATE ON "virtual_rewards"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
