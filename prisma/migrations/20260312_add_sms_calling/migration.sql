-- CreateTable
CREATE TABLE "sms_blasts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "body" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "recipient_filter" JSONB,
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sms_blasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "blast_id" TEXT NOT NULL,
    "supporter_id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "twilio_sid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patch_through_calls" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "supporter_id" TEXT NOT NULL,
    "caller_phone" TEXT NOT NULL,
    "target_phone" TEXT NOT NULL,
    "target_name" TEXT,
    "target_title" TEXT,
    "twilio_call_sid" TEXT,
    "district_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "patch_through_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_blasts_org_id_idx" ON "sms_blasts"("org_id");
CREATE INDEX "sms_blasts_status_idx" ON "sms_blasts"("status");

CREATE INDEX "sms_messages_blast_id_idx" ON "sms_messages"("blast_id");
CREATE INDEX "sms_messages_supporter_id_idx" ON "sms_messages"("supporter_id");
CREATE INDEX "sms_messages_twilio_sid_idx" ON "sms_messages"("twilio_sid");

CREATE INDEX "patch_through_calls_org_id_idx" ON "patch_through_calls"("org_id");
CREATE INDEX "patch_through_calls_campaign_id_idx" ON "patch_through_calls"("campaign_id");
CREATE INDEX "patch_through_calls_supporter_id_idx" ON "patch_through_calls"("supporter_id");
CREATE INDEX "patch_through_calls_status_idx" ON "patch_through_calls"("status");

CREATE UNIQUE INDEX "patch_through_calls_twilio_call_sid_key" ON "patch_through_calls"("twilio_call_sid");

-- AddForeignKey
ALTER TABLE "sms_blasts" ADD CONSTRAINT "sms_blasts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_blasts" ADD CONSTRAINT "sms_blasts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_blast_id_fkey" FOREIGN KEY ("blast_id") REFERENCES "sms_blasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "supporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patch_through_calls" ADD CONSTRAINT "patch_through_calls_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patch_through_calls" ADD CONSTRAINT "patch_through_calls_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patch_through_calls" ADD CONSTRAINT "patch_through_calls_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "supporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
