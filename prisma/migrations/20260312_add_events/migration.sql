-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING', 'WAITLISTED');

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "EventType" NOT NULL DEFAULT 'IN_PERSON',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "venue" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "virtual_url" TEXT,
    "capacity" INTEGER,
    "waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rsvp_count" INTEGER NOT NULL DEFAULT 0,
    "attendee_count" INTEGER NOT NULL DEFAULT 0,
    "verified_attendees" INTEGER NOT NULL DEFAULT 0,
    "checkin_code" TEXT,
    "require_verification" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvp" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "supporter_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "guest_count" INTEGER NOT NULL DEFAULT 0,
    "district_hash" TEXT,
    "engagement_tier" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendance" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "rsvp_id" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_method" TEXT,
    "identity_commitment" TEXT,
    "district_hash" TEXT,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_org_id_idx" ON "event"("org_id");

-- CreateIndex
CREATE INDEX "event_org_id_status_idx" ON "event"("org_id", "status");

-- CreateIndex
CREATE INDEX "event_start_at_idx" ON "event"("start_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_checkin_code_key" ON "event"("checkin_code");

-- CreateIndex
CREATE INDEX "event_rsvp_event_id_idx" ON "event_rsvp"("event_id");

-- CreateIndex
CREATE INDEX "event_rsvp_event_id_status_idx" ON "event_rsvp"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvp_event_id_email_key" ON "event_rsvp"("event_id", "email");

-- CreateIndex
CREATE INDEX "event_attendance_event_id_idx" ON "event_attendance"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendance_rsvp_id_key" ON "event_attendance"("rsvp_id");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "supporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_rsvp_id_fkey" FOREIGN KEY ("rsvp_id") REFERENCES "event_rsvp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
