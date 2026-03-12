-- Add fundraising fields to campaign
ALTER TABLE "campaign" ADD COLUMN "goal_amount_cents" INTEGER;
ALTER TABLE "campaign" ADD COLUMN "raised_amount_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaign" ADD COLUMN "donor_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaign" ADD COLUMN "donation_currency" VARCHAR(3) DEFAULT 'usd';

-- Create donations table
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "supporter_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_interval" TEXT,
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "district_hash" TEXT,
    "engagement_tier" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "donations_stripe_session_id_key" ON "donations"("stripe_session_id");
CREATE UNIQUE INDEX "donations_stripe_payment_intent_id_key" ON "donations"("stripe_payment_intent_id");
CREATE INDEX "donations_org_id_idx" ON "donations"("org_id");
CREATE INDEX "donations_campaign_id_idx" ON "donations"("campaign_id");
CREATE INDEX "donations_supporter_id_idx" ON "donations"("supporter_id");
CREATE INDEX "donations_status_idx" ON "donations"("status");

-- Foreign keys
ALTER TABLE "donations" ADD CONSTRAINT "donations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "supporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
