-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "SocialLoginFlow" AS ENUM ('LOGIN', 'LINK', 'REAUTH');

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
CREATE TYPE "RiskLevel" AS ENUM ('L0', 'L1', 'L2', 'L3');

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
CREATE TYPE "ResourceType" AS ENUM ('SKILL', 'MCP', 'AGENT', 'IMAGE_TEMPLATE', 'VIDEO_TEMPLATE', 'GALLERY_POST');

-- CreateEnum
CREATE TYPE "RuntimeReq" AS ENUM ('CLOUD', 'DESKTOP_ONLY', 'EITHER');

-- CreateEnum
CREATE TYPE "DetectionSrc" AS ENUM ('AUTO', 'AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImageTemplateSource" AS ENUM ('ADMIN_CREATED', 'GALLERY_CONVERSION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VideoTemplateSource" AS ENUM ('ADMIN_CREATED', 'SYSTEM');

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
CREATE TYPE "CampaignType" AS ENUM ('CONTINUOUS_USE', 'INVITATION', 'FEEDBACK', 'REGISTRATION', 'QUEST', 'CUSTOM');

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

-- CreateEnum
CREATE TYPE "MaterialLibrarySource" AS ENUM ('UPLOAD', 'FAVORITE', 'HISTORY', 'GENERATION');

-- CreateEnum
CREATE TYPE "GalleryKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN', 'REMOVED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "GallerySource" AS ENUM ('USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE', 'ADMIN_CURATED');

-- CreateEnum
CREATE TYPE "FeaturedSlotKind" AS ENUM ('RESOURCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BoostReason" AS ENUM ('MANUAL', 'CAMPAIGN', 'EDITORIAL_PICK', 'CORRECTION');

-- CreateEnum
CREATE TYPE "GalleryReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmailOtpPurpose" AS ENUM ('STEP_UP_CHANGE_PASSWORD', 'STEP_UP_SET_PASSWORD', 'STEP_UP_CHANGE_EMAIL', 'STEP_UP_DELETE_ACCOUNT', 'STEP_UP_UNLINK_PROVIDER', 'EMAIL_CHANGE_CONFIRM');

-- CreateEnum
CREATE TYPE "PendingUploadPurpose" AS ENUM ('AVATAR', 'BANNER', 'GENERIC');

-- CreateEnum
CREATE TYPE "PendingUploadStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StorageCleanupTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'SKIPPED_STILL_REFERENCED', 'DEAD');

-- CreateEnum
CREATE TYPE "StorageCleanupReason" AS ENUM ('UPLOAD_EXPIRED', 'AVATAR_REPLACED', 'AVATAR_CLEARED', 'AVATAR_ORIGINAL_REPLACED', 'BANNER_REPLACED', 'BANNER_CLEARED', 'USER_DELETED', 'ACCOUNT_DELETED', 'ADMIN_AVATAR_REPLACED', 'PENDING_UPLOAD_EXPIRED', 'MANUAL');

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
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "pendingEmail" TEXT,
    "password" TEXT,
    "realName" TEXT,
    "nickname" VARCHAR(60),
    "description" VARCHAR(500),
    "headline" VARCHAR(80),
    "location" VARCHAR(80),
    "socialX" VARCHAR(200),
    "socialInstagram" VARCHAR(200),
    "socialYoutube" VARCHAR(200),
    "socialTiktok" VARCHAR(200),
    "avatar" TEXT,
    "avatarStorageKey" TEXT,
    "bannerImage" TEXT,
    "bannerStorageKey" TEXT,
    "phone" TEXT,
    "language" TEXT DEFAULT 'zh-CN',
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "signupIp" TEXT,
    "signupDeviceId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_risk_profiles" (
    "userId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL DEFAULT 'L0',
    "score" INTEGER NOT NULL DEFAULT 0,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "topSignals" JSONB,
    "evaluatedAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_risk_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_risk_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_risk_events_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "social_login_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT,
    "codeVerifier" TEXT,
    "provider" TEXT NOT NULL,
    "systemCode" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "inviteCode" TEXT,
    "deviceId" TEXT,
    "linkUserId" TEXT,
    "flow" "SocialLoginFlow" NOT NULL DEFAULT 'LOGIN',
    "purpose" "EmailOtpPurpose",
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_login_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_login_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_login_codes_pkey" PRIMARY KEY ("id")
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
    "paramsSchema" JSONB,
    "pricingSchema" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "description" JSONB NOT NULL DEFAULT '{}',

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
CREATE TABLE "task_definitions" (
    "id" TEXT NOT NULL,
    "taskType" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "fixedCostSchema" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_model_bindings" (
    "taskType" VARCHAR(64) NOT NULL,
    "modelConfigId" TEXT NOT NULL,
    "multiplier" DECIMAL(6,3) NOT NULL DEFAULT 1.0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_model_bindings_pkey" PRIMARY KEY ("taskType","modelConfigId")
);

-- CreateTable
CREATE TABLE "pricing_discounts" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "factor" DECIMAL(6,3) NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_discounts_pkey" PRIMARY KEY ("id")
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
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "sourceType" "ImageTemplateSource" NOT NULL DEFAULT 'ADMIN_CREATED',
    "sourceGalleryPostId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "systemKey" TEXT,

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
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "sourceType" "VideoTemplateSource" NOT NULL DEFAULT 'ADMIN_CREATED',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "systemKey" TEXT,

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
    "width" INTEGER,
    "height" INTEGER,
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
    "clipId" TEXT,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "variantLabel" VARCHAR(50),
    "model" VARCHAR(100) NOT NULL,
    "resolvedPrompt" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "providerTaskId" VARCHAR(200),
    "protocolKey" VARCHAR(64),
    "modelConfigId" TEXT,
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
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mimeType" VARCHAR(120),
    "size" INTEGER,
    "storageKey" VARCHAR(500),
    "sourceType" VARCHAR(40) NOT NULL,
    "librarySource" "MaterialLibrarySource" NOT NULL,
    "sourceResourceType" "ResourceType",
    "sourceId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "material_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(16),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "material_folders_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "canvas_boards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverStorageKey" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'active',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "latestStateUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_snapshots" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "thumbnailStorageKey" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_board_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_actions" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT,
    "inputNodeIds" JSONB,
    "outputNodeIds" JSONB,
    "placeholderNodeIds" JSONB,
    "request" JSONB,
    "result" JSONB,
    "error" TEXT,
    "estimatedCost" INTEGER,
    "relatedHoldId" TEXT,
    "relatedTaskId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_board_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_asset_refs" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_board_asset_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_posts" (
    "id" TEXT NOT NULL,
    "kind" "GalleryKind" NOT NULL,
    "title" VARCHAR(200),
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aspectRatio" VARCHAR(20),
    "durationSec" INTEGER,
    "prompt" TEXT,
    "model" VARCHAR(100),
    "width" INTEGER,
    "height" INTEGER,
    "referenceImage" TEXT,
    "sourceType" "GallerySource" NOT NULL DEFAULT 'USER_UPLOAD',
    "imageTemplateId" TEXT,
    "videoTemplateId" TEXT,
    "imageGenerationId" TEXT,
    "videoGenerationId" TEXT,
    "status" "GalleryStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" VARCHAR(500),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "mediaMigrated" BOOLEAN NOT NULL DEFAULT true,
    "mediaMigrationAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "gallery_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "parentId" TEXT,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_reports" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" VARCHAR(500) NOT NULL,
    "status" "GalleryReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_metrics" (
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "pvCount" INTEGER NOT NULL DEFAULT 0,
    "uvCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hotScoreVersion" TEXT,
    "boostScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boostExpiresAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_metrics_pkey" PRIMARY KEY ("resourceType","resourceId")
);

-- CreateTable
CREATE TABLE "resource_view_events" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "viewerKey" VARCHAR(80) NOT NULL,
    "userId" TEXT,
    "visitorId" VARCHAR(64),
    "sessionId" VARCHAR(64),
    "minuteBucket" INTEGER NOT NULL,
    "dayBucket" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_download_events" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_uv_days" (
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "viewerKey" VARCHAR(80) NOT NULL,
    "dayBucket" INTEGER NOT NULL,
    "firstScope" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_uv_days_pkey" PRIMARY KEY ("resourceType","resourceId","viewerKey","dayBucket")
);

-- CreateTable
CREATE TABLE "resource_metric_daily_stats" (
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dayBucket" INTEGER NOT NULL,
    "pvCount" INTEGER NOT NULL DEFAULT 0,
    "uvCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_metric_daily_stats_pkey" PRIMARY KEY ("resourceType","resourceId","dayBucket")
);

-- CreateTable
CREATE TABLE "resource_reference_events" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "refType" VARCHAR(30) NOT NULL,
    "refUserId" TEXT,
    "refPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_reference_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_boosts" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "boostScore" DOUBLE PRECISION NOT NULL,
    "reason" "BoostReason" NOT NULL DEFAULT 'MANUAL',
    "note" VARCHAR(500),
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_slots" (
    "id" TEXT NOT NULL,
    "placement" VARCHAR(40) NOT NULL,
    "kind" "FeaturedSlotKind" NOT NULL,
    "resourceType" "ResourceType",
    "resourceId" TEXT,
    "overrideTitle" VARCHAR(200),
    "overrideDescription" VARCHAR(500),
    "overrideCoverImage" TEXT,
    "overrideCoverVideo" TEXT,
    "overrideCtaText" VARCHAR(50),
    "overrideCtaHref" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailHash" VARCHAR(128) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "EmailOtpPurpose" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_up_proofs" (
    "jti" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" VARCHAR(128) NOT NULL,
    "purpose" "EmailOtpPurpose" NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_up_proofs_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "pending_uploads" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT,
    "contentType" VARCHAR(80),
    "sizeBytes" INTEGER,
    "purpose" "PendingUploadPurpose" NOT NULL DEFAULT 'AVATAR',
    "status" "PendingUploadStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_cleanup_tasks" (
    "id" TEXT NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "storageBucket" TEXT,
    "ownerUserId" TEXT,
    "reason" "StorageCleanupReason" NOT NULL,
    "status" "StorageCleanupTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_cleanup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "dimension" VARCHAR(200) NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("dimension","bucketStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "systems_code_key" ON "systems"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_risk_profiles_level_score_idx" ON "user_risk_profiles"("level", "score");

-- CreateIndex
CREATE INDEX "user_risk_events_userId_createdAt_idx" ON "user_risk_events"("userId", "createdAt");

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
CREATE UNIQUE INDEX "social_login_states_state_key" ON "social_login_states"("state");

-- CreateIndex
CREATE INDEX "social_login_states_expiresAt_idx" ON "social_login_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_login_codes_code_key" ON "social_login_codes"("code");

-- CreateIndex
CREATE INDEX "social_login_codes_expiresAt_idx" ON "social_login_codes"("expiresAt");

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
CREATE UNIQUE INDEX "task_definitions_taskType_key" ON "task_definitions"("taskType");

-- CreateIndex
CREATE INDEX "task_definitions_isActive_idx" ON "task_definitions"("isActive");

-- CreateIndex
CREATE INDEX "task_model_bindings_modelConfigId_idx" ON "task_model_bindings"("modelConfigId");

-- CreateIndex
CREATE INDEX "task_model_bindings_taskType_isActive_idx" ON "task_model_bindings"("taskType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_discounts_code_key" ON "pricing_discounts"("code");

-- CreateIndex
CREATE INDEX "pricing_discounts_isActive_effectiveFrom_effectiveTo_idx" ON "pricing_discounts"("isActive", "effectiveFrom", "effectiveTo");

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
CREATE UNIQUE INDEX "image_templates_sourceGalleryPostId_key" ON "image_templates"("sourceGalleryPostId");

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
CREATE INDEX "image_templates_sourceType_idx" ON "image_templates"("sourceType");

-- CreateIndex
CREATE INDEX "image_templates_createdById_idx" ON "image_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "image_templates_authorId_systemKey_key" ON "image_templates"("authorId", "systemKey");

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
CREATE INDEX "video_templates_sourceType_idx" ON "video_templates"("sourceType");

-- CreateIndex
CREATE INDEX "video_templates_createdById_idx" ON "video_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "video_templates_authorId_systemKey_key" ON "video_templates"("authorId", "systemKey");

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
CREATE UNIQUE INDEX "point_grants_userId_sourceEvent_sourceId_key" ON "point_grants"("userId", "sourceEvent", "sourceId");

-- CreateIndex
CREATE INDEX "point_holds_userId_status_idx" ON "point_holds"("userId", "status");

-- CreateIndex
CREATE INDEX "point_holds_taskType_taskId_idx" ON "point_holds"("taskType", "taskId");

-- CreateIndex
CREATE INDEX "point_hold_items_holdId_idx" ON "point_hold_items"("holdId");

-- CreateIndex
CREATE INDEX "point_hold_items_grantId_idx" ON "point_hold_items"("grantId");

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
CREATE INDEX "video_clip_generations_protocolKey_providerTaskId_idx" ON "video_clip_generations"("protocolKey", "providerTaskId");

-- CreateIndex
CREATE INDEX "material_assets_userId_createdAt_idx" ON "material_assets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "material_assets_userId_type_idx" ON "material_assets"("userId", "type");

-- CreateIndex
CREATE INDEX "material_assets_userId_deletedAt_idx" ON "material_assets"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "material_assets_userId_folderId_deletedAt_idx" ON "material_assets"("userId", "folderId", "deletedAt");

-- CreateIndex
CREATE INDEX "material_assets_userId_librarySource_deletedAt_createdAt_idx" ON "material_assets"("userId", "librarySource", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "material_assets_userId_librarySource_sourceResourceType_sou_key" ON "material_assets"("userId", "librarySource", "sourceResourceType", "sourceId");

-- CreateIndex
CREATE INDEX "material_folders_userId_deletedAt_sortOrder_idx" ON "material_folders"("userId", "deletedAt", "sortOrder");

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

-- CreateIndex
CREATE INDEX "canvas_boards_userId_updatedAt_idx" ON "canvas_boards"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "canvas_board_snapshots_boardId_createdAt_idx" ON "canvas_board_snapshots"("boardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_board_snapshots_boardId_version_key" ON "canvas_board_snapshots"("boardId", "version");

-- CreateIndex
CREATE INDEX "canvas_board_actions_boardId_createdAt_idx" ON "canvas_board_actions"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "canvas_board_actions_userId_status_idx" ON "canvas_board_actions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_board_actions_boardId_idempotencyKey_key" ON "canvas_board_actions"("boardId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "canvas_board_asset_refs_boardId_refType_idx" ON "canvas_board_asset_refs"("boardId", "refType");

-- CreateIndex
CREATE INDEX "canvas_board_asset_refs_refType_refId_idx" ON "canvas_board_asset_refs"("refType", "refId");

-- CreateIndex
CREATE INDEX "gallery_posts_status_publishedAt_id_idx" ON "gallery_posts"("status", "publishedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "gallery_posts_status_kind_publishedAt_id_idx" ON "gallery_posts"("status", "kind", "publishedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "gallery_posts_category_idx" ON "gallery_posts"("category");

-- CreateIndex
CREATE INDEX "gallery_posts_isFeatured_idx" ON "gallery_posts"("isFeatured");

-- CreateIndex
CREATE INDEX "gallery_posts_authorId_idx" ON "gallery_posts"("authorId");

-- CreateIndex
CREATE INDEX "gallery_posts_imageTemplateId_idx" ON "gallery_posts"("imageTemplateId");

-- CreateIndex
CREATE INDEX "gallery_posts_videoTemplateId_idx" ON "gallery_posts"("videoTemplateId");

-- CreateIndex
CREATE INDEX "gallery_posts_mediaMigrated_mediaMigrationAttempts_idx" ON "gallery_posts"("mediaMigrated", "mediaMigrationAttempts");

-- CreateIndex
CREATE INDEX "gallery_comments_postId_createdAt_idx" ON "gallery_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "gallery_comments_userId_idx" ON "gallery_comments"("userId");

-- CreateIndex
CREATE INDEX "gallery_reports_status_createdAt_idx" ON "gallery_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "gallery_reports_postId_idx" ON "gallery_reports"("postId");

-- CreateIndex
CREATE INDEX "resource_metrics_resourceType_hotScore_resourceId_idx" ON "resource_metrics"("resourceType", "hotScore" DESC, "resourceId" DESC);

-- CreateIndex
CREATE INDEX "resource_metrics_resourceType_pvCount_idx" ON "resource_metrics"("resourceType", "pvCount" DESC);

-- CreateIndex
CREATE INDEX "resource_metrics_resourceType_likeCount_idx" ON "resource_metrics"("resourceType", "likeCount" DESC);

-- CreateIndex
CREATE INDEX "resource_metrics_boostExpiresAt_idx" ON "resource_metrics"("boostExpiresAt");

-- CreateIndex
CREATE INDEX "resource_view_events_resourceType_resourceId_dayBucket_idx" ON "resource_view_events"("resourceType", "resourceId", "dayBucket");

-- CreateIndex
CREATE UNIQUE INDEX "resource_view_events_resourceType_resourceId_viewerKey_minu_key" ON "resource_view_events"("resourceType", "resourceId", "viewerKey", "minuteBucket", "scope");

-- CreateIndex
CREATE INDEX "resource_download_events_resourceType_resourceId_createdAt_idx" ON "resource_download_events"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_download_events_userId_createdAt_idx" ON "resource_download_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_uv_days_resourceType_resourceId_dayBucket_idx" ON "resource_uv_days"("resourceType", "resourceId", "dayBucket");

-- CreateIndex
CREATE INDEX "resource_metric_daily_stats_dayBucket_idx" ON "resource_metric_daily_stats"("dayBucket");

-- CreateIndex
CREATE INDEX "resource_reference_events_resourceType_resourceId_createdAt_idx" ON "resource_reference_events"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_boosts_resourceType_resourceId_isActive_idx" ON "resource_boosts"("resourceType", "resourceId", "isActive");

-- CreateIndex
CREATE INDEX "resource_boosts_endsAt_idx" ON "resource_boosts"("endsAt");

-- CreateIndex
CREATE INDEX "featured_slots_placement_isEnabled_position_idx" ON "featured_slots"("placement", "isEnabled", "position");

-- CreateIndex
CREATE INDEX "featured_slots_resourceType_resourceId_idx" ON "featured_slots"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "featured_slots_startsAt_endsAt_idx" ON "featured_slots"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "featured_slots_placement_position_key" ON "featured_slots"("placement", "position");

-- CreateIndex
CREATE INDEX "email_otps_userId_sessionId_purpose_idx" ON "email_otps"("userId", "sessionId", "purpose");

-- CreateIndex
CREATE INDEX "email_otps_emailHash_purpose_idx" ON "email_otps"("emailHash", "purpose");

-- CreateIndex
CREATE INDEX "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");

-- CreateIndex
CREATE INDEX "step_up_proofs_userId_sessionId_purpose_idx" ON "step_up_proofs"("userId", "sessionId", "purpose");

-- CreateIndex
CREATE INDEX "step_up_proofs_expiresAt_idx" ON "step_up_proofs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_uploads_storageKey_key" ON "pending_uploads"("storageKey");

-- CreateIndex
CREATE INDEX "pending_uploads_ownerUserId_status_idx" ON "pending_uploads"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "pending_uploads_expiresAt_status_idx" ON "pending_uploads"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "storage_cleanup_tasks_status_nextRetryAt_idx" ON "storage_cleanup_tasks"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "storage_cleanup_tasks_status_leaseExpiresAt_idx" ON "storage_cleanup_tasks"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "storage_cleanup_tasks_storageKey_idx" ON "storage_cleanup_tasks"("storageKey");

-- CreateIndex
CREATE INDEX "storage_cleanup_tasks_ownerUserId_idx" ON "storage_cleanup_tasks"("ownerUserId");

-- CreateIndex
CREATE INDEX "rate_limit_counters_bucketStart_idx" ON "rate_limit_counters"("bucketStart");

-- AddForeignKey
ALTER TABLE "user_risk_profiles" ADD CONSTRAINT "user_risk_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_risk_events" ADD CONSTRAINT "user_risk_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "task_model_bindings" ADD CONSTRAINT "task_model_bindings_taskType_fkey" FOREIGN KEY ("taskType") REFERENCES "task_definitions"("taskType") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_model_bindings" ADD CONSTRAINT "task_model_bindings_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "model_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_sourceGalleryPostId_fkey" FOREIGN KEY ("sourceGalleryPostId") REFERENCES "gallery_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_templates" ADD CONSTRAINT "video_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_templates" ADD CONSTRAINT "video_templates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_streaks" ADD CONSTRAINT "user_activity_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "material_assets" ADD CONSTRAINT "material_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "material_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_folders" ADD CONSTRAINT "material_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_workflow_templates" ADD CONSTRAINT "video_workflow_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_boards" ADD CONSTRAINT "canvas_boards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_snapshots" ADD CONSTRAINT "canvas_board_snapshots_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_actions" ADD CONSTRAINT "canvas_board_actions_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_asset_refs" ADD CONSTRAINT "canvas_board_asset_refs_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_posts" ADD CONSTRAINT "gallery_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_up_proofs" ADD CONSTRAINT "step_up_proofs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_uploads" ADD CONSTRAINT "pending_uploads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

