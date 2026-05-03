-- ── 1) New enums ──────────────────────────────────────────────────────────
CREATE TYPE "ResourceType" AS ENUM ('SKILL', 'MCP', 'AGENT', 'IMAGE_TEMPLATE', 'VIDEO_TEMPLATE');
CREATE TYPE "RuntimeReq"   AS ENUM ('CLOUD', 'DESKTOP_ONLY', 'EITHER');
CREATE TYPE "DetectionSrc" AS ENUM ('AUTO', 'AUTHOR', 'ADMIN');
CREATE TYPE "McpTransport" AS ENUM ('stdio', 'sse', 'http');

-- ── 2) Rename prompt_templates → image_templates (preserve data) ─────────
ALTER TABLE "prompt_templates" RENAME TO "image_templates";

ALTER INDEX "prompt_templates_pkey"           RENAME TO "image_templates_pkey";
ALTER INDEX "prompt_templates_authorId_idx"   RENAME TO "image_templates_authorId_idx";
ALTER INDEX "prompt_templates_status_idx"     RENAME TO "image_templates_status_idx";
ALTER INDEX "prompt_templates_category_idx"   RENAME TO "image_templates_category_idx";
ALTER INDEX "prompt_templates_useCount_idx"   RENAME TO "image_templates_useCount_idx";
ALTER INDEX "prompt_templates_publishedAt_idx" RENAME TO "image_templates_publishedAt_idx";

-- 新增 runtime / pointsCost / favoriteCount 字段(image_templates 保留 exampleImages 不动)
ALTER TABLE "image_templates"
  ADD COLUMN "pointsCost"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "runtimeRequirement"  "RuntimeReq"   NOT NULL DEFAULT 'CLOUD',
  ADD COLUMN "runtimeDetectedBy"   "DetectionSrc" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "runtimeReason"       TEXT,
  ADD COLUMN "favoriteCount"       INTEGER NOT NULL DEFAULT 0;

-- ── 3) Rename template_generations → image_generations ───────────────────
ALTER TABLE "template_generations" RENAME TO "image_generations";

ALTER INDEX "template_generations_pkey"           RENAME TO "image_generations_pkey";
ALTER INDEX "template_generations_templateId_idx" RENAME TO "image_generations_templateId_idx";
ALTER INDEX "template_generations_userId_idx"     RENAME TO "image_generations_userId_idx";

-- The FK template_generations_templateId_fkey points to prompt_templates,
-- which was already renamed to image_templates. Rename the constraint for
-- consistency.
ALTER TABLE "image_generations"
  RENAME CONSTRAINT "template_generations_templateId_fkey" TO "image_generations_templateId_fkey";

-- ── 4) generation_turns: 加 generationType,去掉对原 template_generations 的 FK ─
ALTER TABLE "generation_turns"
  DROP CONSTRAINT IF EXISTS "generation_turns_generationId_fkey";

ALTER TABLE "generation_turns"
  ADD COLUMN "generationType" "ResourceType" NOT NULL DEFAULT 'IMAGE_TEMPLATE';

-- 历史数据全部为图片生成,Default 已经填入 IMAGE_TEMPLATE,清除 default 让新写入显式指定
ALTER TABLE "generation_turns" ALTER COLUMN "generationType" DROP DEFAULT;

DROP INDEX IF EXISTS "generation_turns_generationId_idx";
CREATE INDEX "generation_turns_generationType_generationId_idx"
  ON "generation_turns"("generationType", "generationId");

-- ── 5) New: video_templates ──────────────────────────────────────────────
CREATE TABLE "video_templates" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "prompt" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelHint" VARCHAR(100),
    "durationSec" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq"   NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy"  "DetectionSrc" NOT NULL DEFAULT 'AUTO',
    "runtimeReason" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "authorId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "video_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "video_templates_authorId_idx"    ON "video_templates"("authorId");
CREATE INDEX "video_templates_status_idx"      ON "video_templates"("status");
CREATE INDEX "video_templates_category_idx"    ON "video_templates"("category");
CREATE INDEX "video_templates_useCount_idx"    ON "video_templates"("useCount");
CREATE INDEX "video_templates_publishedAt_idx" ON "video_templates"("publishedAt");

-- ── 6) New: video_generations ────────────────────────────────────────────
CREATE TABLE "video_generations" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelUsed" VARCHAR(100) NOT NULL,
    "resolvedPrompt" TEXT NOT NULL,
    "variables" JSONB,
    "referenceImage" TEXT,
    "generatedVideos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "video_generations_templateId_idx" ON "video_generations"("templateId");
CREATE INDEX "video_generations_userId_idx"     ON "video_generations"("userId");
ALTER TABLE "video_generations"
  ADD CONSTRAINT "video_generations_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "video_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 7) New: skills ───────────────────────────────────────────────────────
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "instructions" TEXT NOT NULL,
    "frontmatter" JSONB NOT NULL,
    "variables" JSONB NOT NULL,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelHint" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq"   NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy"  "DetectionSrc" NOT NULL DEFAULT 'AUTO',
    "runtimeReason" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "authorId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "skills_authorId_idx"    ON "skills"("authorId");
CREATE INDEX "skills_status_idx"      ON "skills"("status");
CREATE INDEX "skills_category_idx"    ON "skills"("category");
CREATE INDEX "skills_useCount_idx"    ON "skills"("useCount");
CREATE INDEX "skills_publishedAt_idx" ON "skills"("publishedAt");

-- ── 8) New: mcp_servers ──────────────────────────────────────────────────
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "serverName" VARCHAR(100) NOT NULL,
    "transport" "McpTransport" NOT NULL,
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "envSchema" JSONB,
    "url" TEXT,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq"   NOT NULL DEFAULT 'DESKTOP_ONLY',
    "runtimeDetectedBy"  "DetectionSrc" NOT NULL DEFAULT 'AUTO',
    "runtimeReason" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "authorId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mcp_servers_authorId_idx"    ON "mcp_servers"("authorId");
CREATE INDEX "mcp_servers_status_idx"      ON "mcp_servers"("status");
CREATE INDEX "mcp_servers_category_idx"    ON "mcp_servers"("category");
CREATE INDEX "mcp_servers_useCount_idx"    ON "mcp_servers"("useCount");
CREATE INDEX "mcp_servers_publishedAt_idx" ON "mcp_servers"("publishedAt");

-- ── 9) New: agents ───────────────────────────────────────────────────────
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "toolBindings" JSONB NOT NULL,
    "defaultModel" VARCHAR(100),
    "variables" JSONB NOT NULL,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq"   NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy"  "DetectionSrc" NOT NULL DEFAULT 'AUTO',
    "runtimeReason" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "authorId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agents_authorId_idx"    ON "agents"("authorId");
CREATE INDEX "agents_status_idx"      ON "agents"("status");
CREATE INDEX "agents_category_idx"    ON "agents"("category");
CREATE INDEX "agents_useCount_idx"    ON "agents"("useCount");
CREATE INDEX "agents_publishedAt_idx" ON "agents"("publishedAt");

-- ── 10) New: user_resource_acquisitions ──────────────────────────────────
CREATE TABLE "user_resource_acquisitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "pointsPaid" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_resource_acquisitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_resource_acquisitions_userId_resourceType_resourceId_key"
  ON "user_resource_acquisitions"("userId", "resourceType", "resourceId");
CREATE INDEX "user_resource_acquisitions_userId_resourceType_idx"
  ON "user_resource_acquisitions"("userId", "resourceType");

-- ── 11) New: resource_favorites ──────────────────────────────────────────
CREATE TABLE "resource_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_favorites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "resource_favorites_userId_resourceType_resourceId_key"
  ON "resource_favorites"("userId", "resourceType", "resourceId");
CREATE INDEX "resource_favorites_userId_createdAt_idx"
  ON "resource_favorites"("userId", "createdAt");

-- ── 12) New: resource_views ──────────────────────────────────────────────
CREATE TABLE "resource_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_views_userId_viewedAt_idx"
  ON "resource_views"("userId", "viewedAt");
CREATE INDEX "resource_views_resourceType_resourceId_idx"
  ON "resource_views"("resourceType", "resourceId");

-- ── 13) New: conversation_resources ──────────────────────────────────────
CREATE TABLE "conversation_resources" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedBy" TEXT NOT NULL,

    CONSTRAINT "conversation_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conversation_resources_conversationId_resourceType_resourceId_key"
  ON "conversation_resources"("conversationId", "resourceType", "resourceId");
CREATE INDEX "conversation_resources_conversationId_idx"
  ON "conversation_resources"("conversationId");
ALTER TABLE "conversation_resources"
  ADD CONSTRAINT "conversation_resources_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
