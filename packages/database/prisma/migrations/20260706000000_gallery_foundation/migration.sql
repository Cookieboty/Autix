-- CreateEnum
CREATE TYPE "GalleryKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "GallerySource" AS ENUM ('USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE', 'ADMIN_CURATED');

-- CreateEnum
CREATE TYPE "FeaturedSlotKind" AS ENUM ('RESOURCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BoostReason" AS ENUM ('MANUAL', 'CAMPAIGN', 'EDITORIAL_PICK', 'CORRECTION');

-- CreateEnum
CREATE TYPE "GalleryReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'GALLERY_POST';


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
    "authorId" TEXT,
    "authorSnapshot" JSONB,
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

