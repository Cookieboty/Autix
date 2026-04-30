-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('MARKDOWN', 'CODE', 'DOCUMENT', 'TABLE', 'CHART');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('general', 'code', 'intent', 'embedding');

-- CreateEnum
CREATE TYPE "ModelVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PointsRecordType" AS ENUM ('EARN', 'CONSUME');

-- CreateEnum
CREATE TYPE "PointsSource" AS ENUM ('MEMBERSHIP', 'PACKAGE', 'TASK', 'INVITATION', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MEMBERSHIP', 'POINTS_PACKAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "artifact_versions" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changelog" TEXT,
    "sourcetags" TEXT[],
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL DEFAULT 'MARKDOWN',
    "language" TEXT,
    "content" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "chunkIndex" INTEGER NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT,
    "size" INTEGER NOT NULL,
    "storageBucket" TEXT,
    "storageKey" TEXT,
    "storageRegion" TEXT,
    "storageType" TEXT NOT NULL DEFAULT 'local',
    "storageUrl" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(100) NOT NULL,
    "type" "ModelType" NOT NULL DEFAULT 'general',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "baseUrl" VARCHAR(200),
    "apiKey" VARCHAR(200),
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ModelVisibility" NOT NULL DEFAULT 'public',
    "createdBy" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY['text']::TEXT[],

    CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id")
);

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
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对比',
    "selectedModelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_responses" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "modelConfigId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "prompt" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "coverImage" TEXT,
    "exampleImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelHint" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "authorId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_generations" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelUsed" VARCHAR(100) NOT NULL,
    "resolvedPrompt" TEXT NOT NULL,
    "variables" JSONB,
    "referenceImage" TEXT,
    "generatedImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_turns" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "pointsPerMonth" INTEGER NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "months" INTEGER NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "firstTimePrice" DECIMAL(10,2),
    "discountLabel" TEXT,
    "firstTimeLabel" TEXT,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "planId" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_points" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PointsRecordType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "PointsSource" NOT NULL,
    "sourceId" TEXT,
    "balance" INTEGER NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isFirstTime" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_records" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_point_costs" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_point_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artifact_versions_artifactId_createdAt_idx" ON "artifact_versions"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "artifact_versions_artifactId_sourcetags_idx" ON "artifact_versions"("artifactId", "sourcetags");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_versions_artifactId_version_key" ON "artifact_versions"("artifactId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_conversationId_key" ON "artifacts"("conversationId");

-- CreateIndex
CREATE INDEX "artifacts_userId_idx" ON "artifacts"("userId");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "model_configs_createdBy_idx" ON "model_configs"("createdBy");

-- CreateIndex
CREATE INDEX "model_configs_isActive_idx" ON "model_configs"("isActive");

-- CreateIndex
CREATE INDEX "model_configs_isDefault_idx" ON "model_configs"("isDefault");

-- CreateIndex
CREATE INDEX "model_configs_type_idx" ON "model_configs"("type");

-- CreateIndex
CREATE INDEX "model_configs_visibility_idx" ON "model_configs"("visibility");

-- CreateIndex
CREATE INDEX "task_events_taskType_idx" ON "task_events"("taskType");

-- CreateIndex
CREATE INDEX "task_events_userId_createdAt_idx" ON "task_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "arena_sessions_userId_idx" ON "arena_sessions"("userId");

-- CreateIndex
CREATE INDEX "arena_turns_sessionId_idx" ON "arena_turns"("sessionId");

-- CreateIndex
CREATE INDEX "arena_responses_turnId_idx" ON "arena_responses"("turnId");

-- CreateIndex
CREATE INDEX "prompt_templates_authorId_idx" ON "prompt_templates"("authorId");

-- CreateIndex
CREATE INDEX "prompt_templates_status_idx" ON "prompt_templates"("status");

-- CreateIndex
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");

-- CreateIndex
CREATE INDEX "prompt_templates_useCount_idx" ON "prompt_templates"("useCount");

-- CreateIndex
CREATE INDEX "prompt_templates_publishedAt_idx" ON "prompt_templates"("publishedAt");

-- CreateIndex
CREATE INDEX "template_generations_templateId_idx" ON "template_generations"("templateId");

-- CreateIndex
CREATE INDEX "template_generations_userId_idx" ON "template_generations"("userId");

-- CreateIndex
CREATE INDEX "generation_turns_generationId_idx" ON "generation_turns"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_levels_level_key" ON "membership_levels"("level");

-- CreateIndex
CREATE INDEX "membership_levels_isActive_sort_idx" ON "membership_levels"("isActive", "sort");

-- CreateIndex
CREATE INDEX "membership_plans_isActive_sort_idx" ON "membership_plans"("isActive", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_levelId_billingCycle_autoRenew_key" ON "membership_plans"("levelId", "billingCycle", "autoRenew");

-- CreateIndex
CREATE UNIQUE INDEX "user_memberships_userId_key" ON "user_memberships"("userId");

-- CreateIndex
CREATE INDEX "user_memberships_userId_idx" ON "user_memberships"("userId");

-- CreateIndex
CREATE INDEX "user_memberships_expiresAt_idx" ON "user_memberships"("expiresAt");

-- CreateIndex
CREATE INDEX "points_packages_isActive_sort_idx" ON "points_packages"("isActive", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "user_points_userId_key" ON "user_points"("userId");

-- CreateIndex
CREATE INDEX "points_records_userId_createdAt_idx" ON "points_records"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "points_records_source_idx" ON "points_records"("source");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_orderNo_idx" ON "orders"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_userId_key" ON "invite_codes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_code_idx" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_records_inviterUserId_idx" ON "invite_records"("inviterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_records_inviteeUserId_key" ON "invite_records"("inviteeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "task_point_costs_taskType_key" ON "task_point_costs"("taskType");

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_turns" ADD CONSTRAINT "arena_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_responses" ADD CONSTRAINT "arena_responses_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "arena_turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_generations" ADD CONSTRAINT "template_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_turns" ADD CONSTRAINT "generation_turns_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "template_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

