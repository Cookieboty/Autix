CREATE TYPE "GenerationKind" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "GenerationTaskStatus" AS ENUM ('PENDING', 'QUEUED', 'SUCCEEDED', 'FAILED', 'EXPIRED');
CREATE TYPE "GenerationErrorStage" AS ENUM ('SUBMIT', 'POLL', 'CALLBACK', 'PERSIST', 'BILLING');
CREATE TYPE "GenerationBillingStatus" AS ENUM ('HELD', 'CONFIRMED', 'REFUNDED', 'REFUND_FAILED');

CREATE TABLE "generation_tasks" (
    "id" TEXT NOT NULL,
    "kind" "GenerationKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GenerationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "modelConfigId" TEXT,
    "provider" TEXT,
    "model" TEXT NOT NULL,
    "protocolKey" TEXT,
    "providerTaskId" TEXT,
    "prompt" TEXT,
    "promptLength" INTEGER NOT NULL DEFAULT 0,
    "paramsSnapshot" JSONB,
    "materialCount" INTEGER NOT NULL DEFAULT 0,
    "errorStage" "GenerationErrorStage",
    "errorClass" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "upstreamStatus" INTEGER,
    "upstreamBody" TEXT,
    "upstreamRequestId" TEXT,
    "holdId" TEXT,
    "pointsCost" INTEGER,
    "billingStatus" "GenerationBillingStatus",
    "billingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "lateCallbackAt" TIMESTAMP(3),
    "lateOutcome" TEXT,
    "videoGenerationId" TEXT,
    "imageGenerationId" TEXT,
    CONSTRAINT "generation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generation_tasks_videoGenerationId_key" ON "generation_tasks"("videoGenerationId");
CREATE UNIQUE INDEX "generation_tasks_imageGenerationId_key" ON "generation_tasks"("imageGenerationId");
CREATE INDEX "generation_tasks_userId_createdAt_idx" ON "generation_tasks"("userId", "createdAt");
CREATE INDEX "generation_tasks_status_createdAt_idx" ON "generation_tasks"("status", "createdAt");
CREATE INDEX "generation_tasks_kind_status_createdAt_idx" ON "generation_tasks"("kind", "status", "createdAt");
CREATE INDEX "generation_tasks_model_createdAt_idx" ON "generation_tasks"("model", "createdAt");
CREATE INDEX "generation_tasks_holdId_idx" ON "generation_tasks"("holdId");
CREATE INDEX "generation_tasks_providerTaskId_idx" ON "generation_tasks"("providerTaskId");
