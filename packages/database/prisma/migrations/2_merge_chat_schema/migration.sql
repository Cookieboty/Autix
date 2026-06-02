-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('MARKDOWN', 'CODE', 'DOCUMENT', 'TABLE', 'CHART');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('general', 'code', 'intent', 'embedding', 'video');

-- CreateEnum
CREATE TYPE "ModelVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('SKILL', 'MCP', 'AGENT', 'IMAGE_TEMPLATE', 'VIDEO_TEMPLATE');

-- CreateEnum
CREATE TYPE "RuntimeReq" AS ENUM ('CLOUD', 'DESKTOP_ONLY', 'EITHER');

-- CreateEnum
CREATE TYPE "DetectionSrc" AS ENUM ('AUTO', 'AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "McpTransport" AS ENUM ('stdio', 'sse', 'http');

-- CreateEnum
CREATE TYPE "PointsRecordType" AS ENUM ('EARN', 'CONSUME');

-- CreateEnum
CREATE TYPE "PointsSource" AS ENUM ('MEMBERSHIP', 'PACKAGE', 'TASK', 'INVITATION', 'ADMIN_GRANT', 'AGENT_CALL', 'CONTRIBUTION');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MEMBERSHIP', 'POINTS_PACKAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentKind" AS ENUM ('chat', 'image', 'video', 'avatar');

-- CreateEnum
CREATE TYPE "AgentExecutionMode" AS ENUM ('single', 'workflow');

-- CreateEnum
CREATE TYPE "ExecutorType" AS ENUM ('deepagent', 'llm_chain');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'paused_user_confirm', 'paused_user_stop', 'paused_failure', 'completed', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "AgentRunStepStatus" AS ENUM ('pending', 'running', 'validating', 'critiquing', 'refining', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentRunDepthMode" AS ENUM ('standard', 'deep');

-- CreateEnum
CREATE TYPE "PointsRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VideoProjectStatus" AS ENUM ('draft', 'generating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "VideoClipStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "VideoMaterialRole" AS ENUM ('first_frame', 'last_frame', 'reference_image', 'reference_video', 'reference_audio');

-- CreateEnum
CREATE TYPE "VideoMaterialSourceType" AS ENUM ('upload', 'image_generation', 'video_generation', 'platform_asset');

-- CreateEnum
CREATE TYPE "VideoGenStatus" AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'expired');

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
    "sourceWorkflowRunId" TEXT,
    "sourceStepKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "kind" "AgentKind" NOT NULL DEFAULT 'chat',
    "agentId" TEXT,
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
    "pointCostWeight" DECIMAL(6,2) NOT NULL DEFAULT 1.0,

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
CREATE TABLE "image_templates" (
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
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq" NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy" "DetectionSrc" NOT NULL DEFAULT 'AUTO',
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

    CONSTRAINT "image_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "defaultParams" JSONB,
    "materialSlots" JSONB,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq" NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy" "DetectionSrc" NOT NULL DEFAULT 'AUTO',
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

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "rawMarkdown" TEXT,
    "sourceFormat" VARCHAR(50) NOT NULL DEFAULT 'skill_md',
    "parsedFrontmatter" JSONB,
    "instructions" TEXT NOT NULL,
    "frontmatter" JSONB NOT NULL,
    "variables" JSONB NOT NULL,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelHint" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq" NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy" "DetectionSrc" NOT NULL DEFAULT 'AUTO',
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

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "rawConfig" JSONB,
    "configFormat" VARCHAR(50) NOT NULL DEFAULT 'mcp_json',
    "serverName" VARCHAR(100) NOT NULL,
    "transport" "McpTransport" NOT NULL,
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "envSchema" JSONB,
    "headersSchema" JSONB,
    "authSchema" JSONB,
    "tools" JSONB,
    "capabilities" JSONB,
    "installNotes" TEXT,
    "securityNotes" TEXT,
    "url" TEXT,
    "coverImage" TEXT,
    "exampleMedia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq" NOT NULL DEFAULT 'DESKTOP_ONLY',
    "runtimeDetectedBy" "DetectionSrc" NOT NULL DEFAULT 'AUTO',
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

-- CreateTable
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
    "kind" "AgentKind" NOT NULL DEFAULT 'chat',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "executionMode" "AgentExecutionMode" NOT NULL DEFAULT 'single',
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "runtimeRequirement" "RuntimeReq" NOT NULL DEFAULT 'CLOUD',
    "runtimeDetectedBy" "DetectionSrc" NOT NULL DEFAULT 'AUTO',
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

-- CreateTable
CREATE TABLE "image_generations" (
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

    CONSTRAINT "image_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "generation_turns" (
    "id" TEXT NOT NULL,
    "generationType" "ResourceType" NOT NULL,
    "generationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_resource_acquisitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "pointsPaid" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_resource_acquisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_resources" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedBy" TEXT NOT NULL,

    CONSTRAINT "conversation_resources_pkey" PRIMARY KEY ("id")
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
    "status" "PointsRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "holdId" TEXT,
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

-- CreateTable
CREATE TABLE "amux_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" VARCHAR(500) NOT NULL,
    "oat" VARCHAR(500) NOT NULL,
    "amuxUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amux_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_workflows" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
CREATE INDEX "conversations_userId_kind_idx" ON "conversations"("userId", "kind");

-- CreateIndex
CREATE INDEX "conversations_userId_updatedAt_idx" ON "conversations"("userId", "updatedAt");

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
CREATE INDEX "image_templates_authorId_idx" ON "image_templates"("authorId");

-- CreateIndex
CREATE INDEX "image_templates_status_idx" ON "image_templates"("status");

-- CreateIndex
CREATE INDEX "image_templates_category_idx" ON "image_templates"("category");

-- CreateIndex
CREATE INDEX "image_templates_useCount_idx" ON "image_templates"("useCount");

-- CreateIndex
CREATE INDEX "image_templates_publishedAt_idx" ON "image_templates"("publishedAt");

-- CreateIndex
CREATE INDEX "video_templates_authorId_idx" ON "video_templates"("authorId");

-- CreateIndex
CREATE INDEX "video_templates_status_idx" ON "video_templates"("status");

-- CreateIndex
CREATE INDEX "video_templates_category_idx" ON "video_templates"("category");

-- CreateIndex
CREATE INDEX "video_templates_useCount_idx" ON "video_templates"("useCount");

-- CreateIndex
CREATE INDEX "video_templates_publishedAt_idx" ON "video_templates"("publishedAt");

-- CreateIndex
CREATE INDEX "skills_authorId_idx" ON "skills"("authorId");

-- CreateIndex
CREATE INDEX "skills_status_idx" ON "skills"("status");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE INDEX "skills_useCount_idx" ON "skills"("useCount");

-- CreateIndex
CREATE INDEX "skills_publishedAt_idx" ON "skills"("publishedAt");

-- CreateIndex
CREATE INDEX "mcp_servers_authorId_idx" ON "mcp_servers"("authorId");

-- CreateIndex
CREATE INDEX "mcp_servers_status_idx" ON "mcp_servers"("status");

-- CreateIndex
CREATE INDEX "mcp_servers_category_idx" ON "mcp_servers"("category");

-- CreateIndex
CREATE INDEX "mcp_servers_useCount_idx" ON "mcp_servers"("useCount");

-- CreateIndex
CREATE INDEX "mcp_servers_publishedAt_idx" ON "mcp_servers"("publishedAt");

-- CreateIndex
CREATE INDEX "agents_authorId_idx" ON "agents"("authorId");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_category_idx" ON "agents"("category");

-- CreateIndex
CREATE INDEX "agents_useCount_idx" ON "agents"("useCount");

-- CreateIndex
CREATE INDEX "agents_publishedAt_idx" ON "agents"("publishedAt");

-- CreateIndex
CREATE INDEX "image_generations_templateId_idx" ON "image_generations"("templateId");

-- CreateIndex
CREATE INDEX "image_generations_userId_idx" ON "image_generations"("userId");

-- CreateIndex
CREATE INDEX "video_generations_templateId_idx" ON "video_generations"("templateId");

-- CreateIndex
CREATE INDEX "video_generations_userId_idx" ON "video_generations"("userId");

-- CreateIndex
CREATE INDEX "generation_turns_generationType_generationId_idx" ON "generation_turns"("generationType", "generationId");

-- CreateIndex
CREATE INDEX "user_resource_acquisitions_userId_resourceType_idx" ON "user_resource_acquisitions"("userId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "user_resource_acquisitions_userId_resourceType_resourceId_key" ON "user_resource_acquisitions"("userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "resource_favorites_userId_createdAt_idx" ON "resource_favorites"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resource_favorites_userId_resourceType_resourceId_key" ON "resource_favorites"("userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "resource_views_userId_viewedAt_idx" ON "resource_views"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "resource_views_resourceType_resourceId_idx" ON "resource_views"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "conversation_resources_conversationId_idx" ON "conversation_resources"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_resources_conversationId_resourceType_resource_key" ON "conversation_resources"("conversationId", "resourceType", "resourceId");

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
CREATE INDEX "points_records_status_idx" ON "points_records"("status");

-- CreateIndex
CREATE INDEX "points_records_holdId_idx" ON "points_records"("holdId");

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

-- CreateIndex
CREATE UNIQUE INDEX "amux_credentials_userId_key" ON "amux_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_workflows_agentId_key" ON "agent_workflows"("agentId");

-- CreateIndex
CREATE INDEX "agent_workflows_agentId_idx" ON "agent_workflows"("agentId");

-- CreateIndex
CREATE INDEX "agent_workflow_steps_workflowId_sortOrder_idx" ON "agent_workflow_steps"("workflowId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "agent_workflow_steps_workflowId_stepKey_key" ON "agent_workflow_steps"("workflowId", "stepKey");

-- CreateIndex
CREATE INDEX "agent_runs_conversationId_status_idx" ON "agent_runs"("conversationId", "status");

-- CreateIndex
CREATE INDEX "agent_runs_conversationId_createdAt_idx" ON "agent_runs"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_run_steps_runId_idx" ON "agent_run_steps"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_run_steps_runId_stepKey_attempt_key" ON "agent_run_steps"("runId", "stepKey", "attempt");

-- CreateIndex
CREATE INDEX "workflow_step_artifacts_runId_stepKey_idx" ON "workflow_step_artifacts"("runId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_artifacts_runId_stepKey_version_key" ON "workflow_step_artifacts"("runId", "stepKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "video_projects_conversationId_key" ON "video_projects"("conversationId");

-- CreateIndex
CREATE INDEX "video_projects_userId_updatedAt_idx" ON "video_projects"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "video_clips_projectId_idx" ON "video_clips"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "video_clips_projectId_order_key" ON "video_clips"("projectId", "order");

-- CreateIndex
CREATE INDEX "video_clip_materials_clipId_idx" ON "video_clip_materials"("clipId");

-- CreateIndex
CREATE INDEX "video_clip_generations_clipId_idx" ON "video_clip_generations"("clipId");

-- CreateIndex
CREATE INDEX "video_clip_generations_projectId_idx" ON "video_clip_generations"("projectId");

-- CreateIndex
CREATE INDEX "video_clip_generations_userId_createdAt_idx" ON "video_clip_generations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "video_clip_generations_seedanceTaskId_idx" ON "video_clip_generations"("seedanceTaskId");

-- CreateIndex
CREATE INDEX "video_workflow_templates_authorId_idx" ON "video_workflow_templates"("authorId");

-- CreateIndex
CREATE INDEX "video_workflow_templates_status_idx" ON "video_workflow_templates"("status");

-- CreateIndex
CREATE INDEX "video_workflow_templates_category_idx" ON "video_workflow_templates"("category");

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_sessions" ADD CONSTRAINT "arena_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_turns" ADD CONSTRAINT "arena_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_responses" ADD CONSTRAINT "arena_responses_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "arena_turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_templates" ADD CONSTRAINT "video_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "image_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "video_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_resource_acquisitions" ADD CONSTRAINT "user_resource_acquisitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_favorites" ADD CONSTRAINT "resource_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_resources" ADD CONSTRAINT "conversation_resources_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_resources" ADD CONSTRAINT "conversation_resources_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_records" ADD CONSTRAINT "points_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amux_credentials" ADD CONSTRAINT "amux_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_workflow_steps" ADD CONSTRAINT "agent_workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "agent_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "agent_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_artifacts" ADD CONSTRAINT "workflow_step_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_materials" ADD CONSTRAINT "video_clip_materials_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_generations" ADD CONSTRAINT "video_clip_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_generations" ADD CONSTRAINT "video_clip_generations_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_workflow_templates" ADD CONSTRAINT "video_workflow_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
