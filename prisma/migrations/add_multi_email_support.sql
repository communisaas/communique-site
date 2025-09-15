-- Add UserEmail table for secondary email support
CREATE TABLE "user_emails" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_emails_pkey" PRIMARY KEY ("id")
);

-- Add DeliveryLog table for tracking message delivery
CREATE TABLE "delivery_logs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delivery_method" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "submission_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_logs_pkey" PRIMARY KEY ("id")
);

-- Add AuditLog table for tracking user actions
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "user_emails_email_key" ON "user_emails"("email");
CREATE INDEX "user_emails_user_id_idx" ON "user_emails"("user_id");
CREATE INDEX "user_emails_email_idx" ON "user_emails"("email");

CREATE INDEX "delivery_logs_template_id_idx" ON "delivery_logs"("template_id");
CREATE INDEX "delivery_logs_user_id_idx" ON "delivery_logs"("user_id");
CREATE INDEX "delivery_logs_delivery_method_idx" ON "delivery_logs"("delivery_method");

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Add foreign key constraints
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: DeliveryLog and AuditLog don't have foreign keys to allow for historical data
-- even if users or templates are deleted