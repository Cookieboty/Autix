-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateTable
CREATE TABLE "task_events" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "taskType" VARCHAR(100) NOT NULL,
    "taskId" VARCHAR(255) NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_events_userId_createdAt_idx" ON "task_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "task_events_taskType_idx" ON "task_events"("taskType");