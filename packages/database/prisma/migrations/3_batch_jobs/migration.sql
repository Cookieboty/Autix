-- CreateEnum
CREATE TYPE "BatchJobType" AS ENUM ('IMPORT', 'APPROVE', 'REJECT', 'REVISE', 'DELETE');

-- CreateTable
CREATE TABLE "batch_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BatchJobType" NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_jobs_userId_createdAt_idx" ON "batch_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "batch_jobs_status_idx" ON "batch_jobs"("status");

-- AlterTable
ALTER TABLE "image_templates" ADD COLUMN     "originalUrl" TEXT,
ADD COLUMN     "authorName" VARCHAR(200),
ADD COLUMN     "authorUrl" TEXT,
ADD COLUMN     "sourcePlatform" VARCHAR(100),
ADD COLUMN     "externalId" VARCHAR(100),
ADD COLUMN     "externalSlug" TEXT,
ADD COLUMN     "externalMetadata" JSONB;

-- AlterTable
ALTER TABLE "video_templates" ADD COLUMN     "originalUrl" TEXT,
ADD COLUMN     "authorName" VARCHAR(200),
ADD COLUMN     "authorUrl" TEXT,
ADD COLUMN     "sourcePlatform" VARCHAR(100),
ADD COLUMN     "externalId" VARCHAR(100),
ADD COLUMN     "externalSlug" TEXT,
ADD COLUMN     "externalMetadata" JSONB;
