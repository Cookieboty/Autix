-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('FRONTEND', 'BACKEND');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING_ACTIVATION', 'PENDING', 'APPROVED', 'REJECTED');

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
CREATE TYPE "BatchJobType" AS ENUM ('IMPORT', 'APPROVE', 'REJECT', 'REVISE', 'DELETE');

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
CREATE TYPE "PointsSource" AS ENUM ('MEMBERSHIP', 'PACKAGE', 'TASK', 'INVITATION', 'ADMIN_GRANT', 'AGENT_CALL', 'CONTRIBUTION', 'CAMPAIGN', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MEMBERSHIP', 'POINTS_PACKAGE');

-- CreateEnum
CREATE TYPE "OrderBusinessType" AS ENUM ('subscription_order', 'points_order', 'renewal_order', 'upgrade_order', 'refund_order');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointGrantType" AS ENUM ('SUBSCRIPTION', 'PURCHASED', 'GIFT', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "PointLedgerEventType" AS ENUM ('subscription_grant', 'points_purchase', 'generation_freeze', 'generation_cost', 'generation_refund', 'admin_adjustment', 'campaign_bonus', 'expiration', 'migration_legacy_balance');

-- CreateEnum
CREATE TYPE "PointHoldStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PricingBaseUnit" AS ENUM ('image', 'second', 'task', 'message', 'token', 'tool_call');

-- CreateEnum
CREATE TYPE "PricingComponentType" AS ENUM ('base', 'fixed_extra', 'per_image', 'per_second', 'input_token_per_1k', 'output_token_per_1k', 'context_token_per_1k', 'per_tool_call', 'per_mcp_call', 'per_skill_call', 'per_batch', 'per_reference_image', 'reasoning_multiplier', 'reference_image_multiplier', 'video_input_multiplier', 'audio_input_multiplier', 'priority_multiplier');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('CONTINUOUS_USE', 'INVITATION', 'FEEDBACK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

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
CREATE TABLE "systems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "SystemStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "realName" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "language" TEXT DEFAULT 'zh-CN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PermissionType" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "name_zh_tw" TEXT,
    "name_fr" TEXT,
    "name_ja" TEXT,
    "name_ru" TEXT,
    "name_vi" TEXT,
    "code" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_menus" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "clientId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentSystemId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "redirectUris" TEXT[],
    "grantTypes" TEXT[],
    "scopes" TEXT[],
    "systemId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_registrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,

    CONSTRAINT "system_registrations_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "model_config_membership_levels" (
    "modelConfigId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_config_membership_levels_pkey" PRIMARY KEY ("modelConfigId","levelId")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
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
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "originalUrl" TEXT,
    "authorName" VARCHAR(200),
    "authorUrl" TEXT,
    "sourcePlatform" VARCHAR(100),
    "externalId" VARCHAR(100),
    "externalSlug" TEXT,
    "externalMetadata" JSONB,
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
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "originalUrl" TEXT,
    "authorName" VARCHAR(200),
    "authorUrl" TEXT,
    "sourcePlatform" VARCHAR(100),
    "externalId" VARCHAR(100),
    "externalSlug" TEXT,
    "externalMetadata" JSONB,
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
CREATE TABLE "resource_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_likes_pkey" PRIMARY KEY ("id")
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
    "userId" TEXT,
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
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "pendingPlanId" TEXT,
    "pendingOrderId" TEXT,
    "pendingLevelId" TEXT,
    "pendingBillingCycle" "BillingCycle",
    "pendingAutoRenew" BOOLEAN,
    "pendingChangeEffectiveAt" TIMESTAMP(3),
    "pendingChangeRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_packages" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "points" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 180,
    "usageScope" JSONB,
    "showCommercialLicense" BOOLEAN NOT NULL DEFAULT false,
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
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "frozenBalance" INTEGER NOT NULL DEFAULT 0,
    "totalBalance" INTEGER NOT NULL DEFAULT 0,
    "subscriptionBalance" INTEGER NOT NULL DEFAULT 0,
    "purchasedBalance" INTEGER NOT NULL DEFAULT 0,
    "giftBalance" INTEGER NOT NULL DEFAULT 0,
    "compensationBalance" INTEGER NOT NULL DEFAULT 0,
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
    "businessType" "OrderBusinessType",
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isFirstTime" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" TEXT,
    "externalPaymentId" TEXT,
    "paymentEventId" TEXT,
    "paidAmount" DECIMAL(10,2),
    "currency" TEXT,
    "paymentMetadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "refundProvider" TEXT,
    "externalRefundId" TEXT,
    "refundAmount" DECIMAL(10,2),
    "refundReason" TEXT,
    "refundMetadata" JSONB,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "orderNo" TEXT,
    "externalPaymentId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "point_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantType" "PointGrantType" NOT NULL,
    "sourceEvent" "PointLedgerEventType" NOT NULL,
    "sourceId" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "availableAmount" INTEGER NOT NULL DEFAULT 0,
    "frozenAmount" INTEGER NOT NULL DEFAULT 0,
    "consumedAmount" INTEGER NOT NULL DEFAULT 0,
    "expiredAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "usageScope" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_holds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskId" TEXT,
    "estimatedAmount" INTEGER NOT NULL,
    "confirmedAmount" INTEGER,
    "status" "PointHoldStatus" NOT NULL DEFAULT 'PENDING',
    "pricingSnapshot" JSONB,
    "refundPolicySnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "point_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_hold_items" (
    "id" TEXT NOT NULL,
    "holdId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantType" "PointGrantType" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_hold_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_pricing_rules" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUnit" "PricingBaseUnit" NOT NULL DEFAULT 'task',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "refundPolicy" JSONB,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_pricing_rule_components" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "componentType" "PricingComponentType" NOT NULL,
    "unitCost" DECIMAL(10,2),
    "multiplier" DECIMAL(6,2),
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_pricing_rule_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "dailyBudget" INTEGER,
    "totalBudget" INTEGER,
    "usedBudget" INTEGER NOT NULL DEFAULT 0,
    "perUserDailyCap" INTEGER,
    "perUserTotalCap" INTEGER,
    "rewardGrantType" "PointGrantType" NOT NULL DEFAULT 'GIFT',
    "rewardSourceEvent" "PointLedgerEventType" NOT NULL DEFAULT 'campaign_bonus',
    "rewardPointsExpression" JSONB,
    "rewardExpiresInDays" INTEGER NOT NULL DEFAULT 7,
    "rewardUsageScope" JSONB,
    "eligibility" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_rewards" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "pointsGranted" INTEGER NOT NULL,
    "pointGrantId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "campaign_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streakType" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "rewardedAtCycle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_activity_streaks_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "video_project_shares" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_project_shares_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "material_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mimeType" VARCHAR(120),
    "size" INTEGER,
    "storageKey" VARCHAR(500),
    "sourceType" VARCHAR(40) NOT NULL,
    "sourceId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "material_assets_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "systems_code_key" ON "systems"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_systemId_code_key" ON "roles"("systemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "menus_systemId_code_key" ON "menus"("systemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "role_menus_roleId_menuId_key" ON "role_menus"("roleId", "menuId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_refreshToken_idx" ON "user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "user_accounts_userId_idx" ON "user_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_provider_providerAccountId_key" ON "user_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_clientId_key" ON "oauth_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_key" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth_authorization_codes_code_idx" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth_authorization_codes_clientId_idx" ON "oauth_authorization_codes"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "system_registrations_userId_systemId_key" ON "system_registrations"("userId", "systemId");

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
CREATE INDEX "model_config_membership_levels_levelId_idx" ON "model_config_membership_levels"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "task_events_taskType_idx" ON "task_events"("taskType");

-- CreateIndex
CREATE INDEX "task_events_userId_createdAt_idx" ON "task_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "batch_jobs_userId_createdAt_idx" ON "batch_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "batch_jobs_status_idx" ON "batch_jobs"("status");

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
CREATE INDEX "image_templates_isHot_idx" ON "image_templates"("isHot");

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
CREATE INDEX "video_templates_isHot_idx" ON "video_templates"("isHot");

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
CREATE INDEX "resource_likes_userId_createdAt_idx" ON "resource_likes"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resource_likes_userId_resourceType_resourceId_key" ON "resource_likes"("userId", "resourceType", "resourceId");

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
CREATE INDEX "user_memberships_pendingChangeEffectiveAt_idx" ON "user_memberships"("pendingChangeEffectiveAt");

-- CreateIndex
CREATE INDEX "user_memberships_stripeSubscriptionId_idx" ON "user_memberships"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "points_packages_code_key" ON "points_packages"("code");

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
CREATE INDEX "orders_businessType_idx" ON "orders"("businessType");

-- CreateIndex
CREATE INDEX "orders_fulfilledAt_idx" ON "orders"("fulfilledAt");

-- CreateIndex
CREATE INDEX "orders_paymentProvider_externalPaymentId_idx" ON "orders"("paymentProvider", "externalPaymentId");

-- CreateIndex
CREATE INDEX "orders_paymentEventId_idx" ON "orders"("paymentEventId");

-- CreateIndex
CREATE INDEX "orders_refundedAt_idx" ON "orders"("refundedAt");

-- CreateIndex
CREATE INDEX "payment_events_orderId_idx" ON "payment_events"("orderId");

-- CreateIndex
CREATE INDEX "payment_events_userId_idx" ON "payment_events"("userId");

-- CreateIndex
CREATE INDEX "payment_events_orderNo_idx" ON "payment_events"("orderNo");

-- CreateIndex
CREATE INDEX "payment_events_status_createdAt_idx" ON "payment_events"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_eventId_key" ON "payment_events"("provider", "eventId");

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
CREATE INDEX "point_grants_userId_expiresAt_idx" ON "point_grants"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "point_grants_userId_grantType_idx" ON "point_grants"("userId", "grantType");

-- CreateIndex
CREATE INDEX "point_grants_sourceEvent_sourceId_idx" ON "point_grants"("sourceEvent", "sourceId");

-- CreateIndex
CREATE INDEX "point_holds_userId_status_idx" ON "point_holds"("userId", "status");

-- CreateIndex
CREATE INDEX "point_holds_taskType_taskId_idx" ON "point_holds"("taskType", "taskId");

-- CreateIndex
CREATE INDEX "point_hold_items_holdId_idx" ON "point_hold_items"("holdId");

-- CreateIndex
CREATE INDEX "point_hold_items_grantId_idx" ON "point_hold_items"("grantId");

-- CreateIndex
CREATE INDEX "generation_pricing_rules_taskType_isActive_idx" ON "generation_pricing_rules"("taskType", "isActive");

-- CreateIndex
CREATE INDEX "generation_pricing_rules_priority_idx" ON "generation_pricing_rules"("priority");

-- CreateIndex
CREATE INDEX "generation_pricing_rules_effectiveFrom_effectiveTo_idx" ON "generation_pricing_rules"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "generation_pricing_rules_taskType_name_key" ON "generation_pricing_rules"("taskType", "name");

-- CreateIndex
CREATE INDEX "generation_pricing_rule_components_ruleId_isActive_idx" ON "generation_pricing_rule_components"("ruleId", "isActive");

-- CreateIndex
CREATE INDEX "generation_pricing_rule_components_componentType_idx" ON "generation_pricing_rule_components"("componentType");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_code_key" ON "campaigns"("code");

-- CreateIndex
CREATE INDEX "campaigns_status_startsAt_endsAt_idx" ON "campaigns"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "campaigns_type_status_idx" ON "campaigns"("type", "status");

-- CreateIndex
CREATE INDEX "campaign_rewards_userId_grantedAt_idx" ON "campaign_rewards"("userId", "grantedAt");

-- CreateIndex
CREATE INDEX "campaign_rewards_campaignId_grantedAt_idx" ON "campaign_rewards"("campaignId", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_rewards_campaignId_triggerKey_key" ON "campaign_rewards"("campaignId", "triggerKey");

-- CreateIndex
CREATE INDEX "user_activity_streaks_userId_updatedAt_idx" ON "user_activity_streaks"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_activity_streaks_userId_streakType_key" ON "user_activity_streaks"("userId", "streakType");

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
CREATE UNIQUE INDEX "video_project_shares_code_key" ON "video_project_shares"("code");

-- CreateIndex
CREATE INDEX "video_project_shares_userId_createdAt_idx" ON "video_project_shares"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_project_shares_projectId_userId_key" ON "video_project_shares"("projectId", "userId");

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
CREATE INDEX "material_assets_userId_createdAt_idx" ON "material_assets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "material_assets_userId_type_idx" ON "material_assets"("userId", "type");

-- CreateIndex
CREATE INDEX "material_assets_userId_deletedAt_idx" ON "material_assets"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "video_workflow_templates_authorId_idx" ON "video_workflow_templates"("authorId");

-- CreateIndex
CREATE INDEX "video_workflow_templates_status_idx" ON "video_workflow_templates"("status");

-- CreateIndex
CREATE INDEX "video_workflow_templates_category_idx" ON "video_workflow_templates"("category");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_registrations" ADD CONSTRAINT "system_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_registrations" ADD CONSTRAINT "system_registrations_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_registrations" ADD CONSTRAINT "system_registrations_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "model_config_membership_levels" ADD CONSTRAINT "model_config_membership_levels_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_config_membership_levels" ADD CONSTRAINT "model_config_membership_levels_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "model_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "resource_likes" ADD CONSTRAINT "resource_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_holds" ADD CONSTRAINT "point_holds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_hold_items" ADD CONSTRAINT "point_hold_items_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "point_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_hold_items" ADD CONSTRAINT "point_hold_items_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "point_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_pricing_rule_components" ADD CONSTRAINT "generation_pricing_rule_components_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "generation_pricing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_streaks" ADD CONSTRAINT "user_activity_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "video_project_shares" ADD CONSTRAINT "video_project_shares_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_project_shares" ADD CONSTRAINT "video_project_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_materials" ADD CONSTRAINT "video_clip_materials_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_generations" ADD CONSTRAINT "video_clip_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_clip_generations" ADD CONSTRAINT "video_clip_generations_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_assets" ADD CONSTRAINT "material_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_workflow_templates" ADD CONSTRAINT "video_workflow_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
