-- Add VOTER Protocol fields to User table
ALTER TABLE "user" 
ADD COLUMN "voter_address" TEXT,
ADD COLUMN "voter_reputation" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint for voter_address
CREATE UNIQUE INDEX "user_voter_address_key" ON "user"("voter_address");

-- Create CertificationLog table
CREATE TABLE "certification_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification_hash" TEXT,
    "action_type" TEXT NOT NULL,
    "reward_amount" BIGINT,
    "reputation_change" INTEGER,
    "template_id" TEXT,
    "recipient_emails" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certification_log_pkey" PRIMARY KEY ("id")
);

-- Create indexes for CertificationLog
CREATE INDEX "certification_log_user_id_idx" ON "certification_log"("user_id");
CREATE INDEX "certification_log_certification_hash_idx" ON "certification_log"("certification_hash");
CREATE INDEX "certification_log_created_at_idx" ON "certification_log"("created_at");

-- Add foreign key constraint
ALTER TABLE "certification_log" ADD CONSTRAINT "certification_log_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;