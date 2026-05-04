-- Agent Workflow Engine: enums, new tables, column additions

-- New enums
CREATE TYPE "AgentExecutionMode" AS ENUM ('single', 'workflow');
CREATE TYPE "ExecutorType" AS ENUM ('deepagent', 'llm_chain');
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'paused_user_confirm', 'paused_user_stop', 'paused_failure', 'completed', 'cancelled', 'archived');
CREATE TYPE "AgentRunStepStatus" AS ENUM ('pending', 'running', 'validating', 'critiquing', 'refining', 'completed', 'failed', 'cancelled');
CREATE TYPE "AgentRunDepthMode" AS ENUM ('standard', 'deep');
CREATE TYPE "PointsRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED');

-- Extend existing enums
ALTER TYPE "PointsSource" ADD VALUE 'AGENT_CALL';

-- agents: add isSystem + executionMode
ALTER TABLE "agents"
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "executionMode" "AgentExecutionMode" NOT NULL DEFAULT 'single';

-- artifacts: add workflow source tracking
ALTER TABLE "artifacts"
  ADD COLUMN "sourceWorkflowRunId" TEXT,
  ADD COLUMN "sourceStepKey" TEXT;

-- model_configs: add pointCostWeight
ALTER TABLE "model_configs"
  ADD COLUMN "pointCostWeight" DECIMAL(6,2) NOT NULL DEFAULT 1.0;

-- points_records: add two-phase billing fields
ALTER TABLE "points_records"
  ADD COLUMN "status" "PointsRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "holdId" TEXT;

CREATE INDEX "points_records_status_idx" ON "points_records"("status");
CREATE INDEX "points_records_holdId_idx" ON "points_records"("holdId");

-- agent_workflows
CREATE TABLE "agent_workflows" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_workflows_agentId_key" ON "agent_workflows"("agentId");
CREATE INDEX "agent_workflows_agentId_idx" ON "agent_workflows"("agentId");

ALTER TABLE "agent_workflows"
  ADD CONSTRAINT "agent_workflows_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- agent_workflow_steps
CREATE TABLE "agent_workflow_steps" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL,
  "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "inputArtifactKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "executorType" "ExecutorType" NOT NULL DEFAULT 'deepagent',
  "artifactType" "ArtifactType" NOT NULL,
  "promptTemplate" TEXT NOT NULL,
  "toolBindings" JSONB,
  "validationSchema" JSONB,
  "criticEnabled" BOOLEAN NOT NULL DEFAULT false,
  "criticPromptTemplate" TEXT,
  "criticModelConfigId" TEXT,
  "criticPassThreshold" DECIMAL(4,2),
  "maxRefineAttempts" INTEGER NOT NULL DEFAULT 2,
  CONSTRAINT "agent_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_workflow_steps_workflowId_stepKey_key" ON "agent_workflow_steps"("workflowId", "stepKey");
CREATE INDEX "agent_workflow_steps_workflowId_sortOrder_idx" ON "agent_workflow_steps"("workflowId", "sortOrder");

ALTER TABLE "agent_workflow_steps"
  ADD CONSTRAINT "agent_workflow_steps_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "agent_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- agent_runs
CREATE TABLE "agent_runs" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'pending',
  "targetStepKey" TEXT,
  "currentStepKey" TEXT,
  "modelConfigId" TEXT NOT NULL,
  "deepagentThreadId" TEXT,
  "depthMode" "AgentRunDepthMode" NOT NULL DEFAULT 'standard',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_runs_conversationId_status_idx" ON "agent_runs"("conversationId", "status");
CREATE INDEX "agent_runs_conversationId_createdAt_idx" ON "agent_runs"("conversationId", "createdAt");

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "agent_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- agent_run_steps
CREATE TABLE "agent_run_steps" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" "AgentRunStepStatus" NOT NULL DEFAULT 'pending',
  "artifactStepId" TEXT,
  "proposedNextStep" TEXT,
  "proposalReasoning" TEXT,
  "validationAttempts" INTEGER NOT NULL DEFAULT 0,
  "criticAttempts" INTEGER NOT NULL DEFAULT 0,
  "lastCriticScore" DECIMAL(4,2),
  "lastCriticFeedback" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_run_steps_runId_stepKey_attempt_key" ON "agent_run_steps"("runId", "stepKey", "attempt");
CREATE INDEX "agent_run_steps_runId_idx" ON "agent_run_steps"("runId");

ALTER TABLE "agent_run_steps"
  ADD CONSTRAINT "agent_run_steps_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- workflow_step_artifacts
CREATE TABLE "workflow_step_artifacts" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentType" "ArtifactType" NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_step_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_step_artifacts_runId_stepKey_version_key" ON "workflow_step_artifacts"("runId", "stepKey", "version");
CREATE INDEX "workflow_step_artifacts_runId_stepKey_idx" ON "workflow_step_artifacts"("runId", "stepKey");

ALTER TABLE "workflow_step_artifacts"
  ADD CONSTRAINT "workflow_step_artifacts_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
