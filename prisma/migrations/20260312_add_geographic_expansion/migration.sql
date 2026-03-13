-- Phase 2 Wave 5: Geographic Expansion

-- Campaign geographic targeting
ALTER TABLE "campaign" ADD COLUMN "target_jurisdiction" TEXT;
ALTER TABLE "campaign" ADD COLUMN "target_country" TEXT NOT NULL DEFAULT 'US';

-- InternationalRepresentative
CREATE TABLE "international_representatives" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "constituency_id" TEXT NOT NULL,
    "constituency_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT,
    "chamber" TEXT,
    "office" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website_url" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "international_representatives_pkey" PRIMARY KEY ("id")
);

-- ScopeCorrection
CREATE TABLE "scope_corrections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "ai_extracted" JSONB NOT NULL,
    "ai_confidence" DOUBLE PRECISION NOT NULL,
    "ai_method" TEXT NOT NULL,
    "user_corrected" JSONB NOT NULL,
    "correction_type" TEXT NOT NULL,
    "message_snippet" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scope_corrections_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "international_representatives_country_code_constituency_id_name_key" ON "international_representatives"("country_code", "constituency_id", "name");
CREATE INDEX "international_representatives_country_code_idx" ON "international_representatives"("country_code");
CREATE INDEX "international_representatives_country_code_constituency_id_idx" ON "international_representatives"("country_code", "constituency_id");

CREATE INDEX "scope_corrections_ai_method_correction_type_idx" ON "scope_corrections"("ai_method", "correction_type");
CREATE INDEX "scope_corrections_created_at_idx" ON "scope_corrections"("created_at");
