-- AlterTable: Add nullifier_hash to debate_argument for per-argument dedup
ALTER TABLE "debate_argument" ADD COLUMN "nullifier_hash" TEXT;

-- CreateIndex: unique constraint on (debate_id, nullifier_hash) for argument-level dedup
-- PostgreSQL treats NULL != NULL, so existing rows with NULL nullifier_hash won't conflict.
CREATE UNIQUE INDEX "debate_argument_debate_id_nullifier_hash_key" ON "debate_argument"("debate_id", "nullifier_hash");

-- CreateTable: debate_nullifier — unified nullifier tracking across arguments + co-signs
CREATE TABLE "debate_nullifier" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "nullifier_hash" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_nullifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on (debate_id, nullifier_hash) for cross-action dedup
CREATE UNIQUE INDEX "debate_nullifier_debate_id_nullifier_hash_key" ON "debate_nullifier"("debate_id", "nullifier_hash");

-- CreateIndex: lookup index on debate_id
CREATE INDEX "debate_nullifier_debate_id_idx" ON "debate_nullifier"("debate_id");

-- AddForeignKey
ALTER TABLE "debate_nullifier" ADD CONSTRAINT "debate_nullifier_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
