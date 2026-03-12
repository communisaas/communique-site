-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "supporter_id" TEXT,
    "trigger_event" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_org_id_idx" ON "workflows"("org_id");
CREATE INDEX "workflows_enabled_idx" ON "workflows"("enabled");

CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");
CREATE INDEX "workflow_executions_supporter_id_idx" ON "workflow_executions"("supporter_id");
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");
CREATE INDEX "workflow_executions_next_run_at_idx" ON "workflow_executions"("next_run_at");

CREATE INDEX "workflow_action_logs_execution_id_idx" ON "workflow_action_logs"("execution_id");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "supporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_action_logs" ADD CONSTRAINT "workflow_action_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
