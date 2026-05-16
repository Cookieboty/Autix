-- ── Video tables (were created via db push, now tracked) ──

CREATE TYPE "VideoProjectStatus" AS ENUM ('draft', 'generating', 'completed', 'failed');
CREATE TYPE "VideoClipStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');
CREATE TYPE "VideoMaterialRole" AS ENUM ('first_frame', 'last_frame', 'reference_image', 'reference_video', 'reference_audio');
CREATE TYPE "VideoMaterialSourceType" AS ENUM ('upload', 'image_generation', 'video_generation', 'platform_asset');
CREATE TYPE "VideoGenStatus" AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'expired');

CREATE TABLE "video_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "conversationId" TEXT,
    "coverImage" TEXT,
    "status" "VideoProjectStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_clips" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(100),
    "prompt" TEXT,
    "params" JSONB NOT NULL,
    "chainFromPrev" BOOLEAN NOT NULL DEFAULT false,
    "status" "VideoClipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_clips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_clip_materials" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "role" "VideoMaterialRole" NOT NULL,
    "sourceType" "VideoMaterialSourceType" NOT NULL,
    "sourceId" TEXT,
    "url" TEXT NOT NULL,
    "name" VARCHAR(200),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_clip_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_clip_generations" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variantLabel" VARCHAR(50),
    "model" VARCHAR(100) NOT NULL,
    "resolvedPrompt" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "seedanceTaskId" VARCHAR(200),
    "status" "VideoGenStatus" NOT NULL DEFAULT 'pending',
    "videoUrl" TEXT,
    "lastFrameUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationSec" DOUBLE PRECISION,
    "error" TEXT,
    "externalStatus" VARCHAR(50),
    "callbackReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "video_clip_generations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_workflow_templates" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "coverImage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clips" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_projects_conversationId_key" ON "video_projects"("conversationId");
CREATE INDEX "video_projects_userId_updatedAt_idx" ON "video_projects"("userId", "updatedAt");
CREATE UNIQUE INDEX "video_clips_projectId_order_key" ON "video_clips"("projectId", "order");
CREATE INDEX "video_clips_projectId_idx" ON "video_clips"("projectId");
CREATE INDEX "video_clip_materials_clipId_idx" ON "video_clip_materials"("clipId");
CREATE INDEX "video_clip_generations_clipId_idx" ON "video_clip_generations"("clipId");
CREATE INDEX "video_clip_generations_projectId_idx" ON "video_clip_generations"("projectId");
CREATE INDEX "video_clip_generations_userId_createdAt_idx" ON "video_clip_generations"("userId", "createdAt");
CREATE INDEX "video_clip_generations_seedanceTaskId_idx" ON "video_clip_generations"("seedanceTaskId");
CREATE INDEX "video_workflow_templates_authorId_idx" ON "video_workflow_templates"("authorId");
CREATE INDEX "video_workflow_templates_status_idx" ON "video_workflow_templates"("status");
CREATE INDEX "video_workflow_templates_category_idx" ON "video_workflow_templates"("category");

ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_clip_materials" ADD CONSTRAINT "video_clip_materials_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_clip_generations" ADD CONSTRAINT "video_clip_generations_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Conversation kind + agentId ──

-- 1. 加列（kind 默认 chat，老数据无痛升级；agentId 可空，FK 加 ON UPDATE CASCADE / ON DELETE SET NULL）
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "kind" "AgentKind" NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS "agentId" TEXT;

-- 2. 外键（与 schema.prisma 中 @relation("ConversationAgent") 对齐）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_agentId_fkey'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "agents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. 索引
CREATE INDEX IF NOT EXISTS "conversations_userId_kind_idx" ON "conversations" ("userId", "kind");

-- 4. 数据回填：已有 video_project 的会话回填 kind=video
UPDATE "conversations"
SET "kind" = 'video'
WHERE "id" IN (
  SELECT "conversationId" FROM "video_projects" WHERE "conversationId" IS NOT NULL
);

-- 5. 数据回填：取最近一条 agent_runs.agentId 作为 conversation.agentId（仅当当前为空）
UPDATE "conversations" c
SET "agentId" = sub."agentId"
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "agentId"
  FROM "agent_runs"
  ORDER BY "conversationId", "createdAt" DESC
) sub
WHERE c."id" = sub."conversationId" AND c."agentId" IS NULL;
