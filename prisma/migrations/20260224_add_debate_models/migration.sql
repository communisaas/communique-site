-- CreateTable: debate
CREATE TABLE IF NOT EXISTS "debate" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "debate_id_onchain" TEXT NOT NULL,
    "action_domain" TEXT NOT NULL,
    "proposition_hash" TEXT NOT NULL,
    "proposition_text" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "jurisdiction_size" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "argument_count" INTEGER NOT NULL DEFAULT 0,
    "unique_participants" INTEGER NOT NULL DEFAULT 0,
    "total_stake" BIGINT NOT NULL DEFAULT 0,
    "winning_argument_index" INTEGER,
    "winning_stance" TEXT,
    "resolved_at" TIMESTAMP(3),
    "proposer_address" TEXT NOT NULL,
    "proposer_bond" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: debate_argument
CREATE TABLE IF NOT EXISTS "debate_argument" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "argument_index" INTEGER NOT NULL,
    "stance" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "amendment_text" TEXT,
    "amendment_hash" TEXT,
    "stake_amount" BIGINT NOT NULL,
    "engagement_tier" INTEGER NOT NULL,
    "weighted_score" BIGINT NOT NULL,
    "total_stake" BIGINT NOT NULL DEFAULT 0,
    "co_sign_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_argument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debate_debate_id_onchain_key" ON "debate"("debate_id_onchain");
CREATE INDEX IF NOT EXISTS "debate_template_id_idx" ON "debate"("template_id");
CREATE INDEX IF NOT EXISTS "debate_status_idx" ON "debate"("status");
CREATE INDEX IF NOT EXISTS "debate_debate_id_onchain_idx" ON "debate"("debate_id_onchain");

CREATE INDEX IF NOT EXISTS "debate_argument_debate_id_idx" ON "debate_argument"("debate_id");
CREATE INDEX IF NOT EXISTS "debate_argument_weighted_score_idx" ON "debate_argument"("weighted_score");
CREATE UNIQUE INDEX IF NOT EXISTS "debate_argument_debate_id_argument_index_key" ON "debate_argument"("debate_id", "argument_index");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "debate" ADD CONSTRAINT "debate_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "debate_argument" ADD CONSTRAINT "debate_argument_debate_id_fkey"
        FOREIGN KEY ("debate_id") REFERENCES "debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
