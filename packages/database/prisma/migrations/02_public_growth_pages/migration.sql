-- CreateEnum
CREATE TYPE "GrowthPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HomeSectionType" AS ENUM ('MEDIA_RAIL', 'FEATURE_MATRIX', 'PRODUCT_BANNER', 'MASONRY', 'TAG_RAIL', 'CTA_BAND');

-- CreateEnum
CREATE TYPE "PublicCreationSourceType" AS ENUM ('IMAGE_GENERATION', 'VIDEO_GENERATION', 'VIDEO_PROJECT', 'MANUAL');

-- CreateEnum
CREATE TYPE "PublicCreationMediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "PublicPromptVisibility" AS ENUM ('hidden', 'public');

-- CreateEnum
CREATE TYPE "PublicCreationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPROVED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "PublicCollectionKind" AS ENUM ('COMMUNITY', 'PRESET', 'VIRAL_PRESET', 'FEATURE');

-- CreateEnum
CREATE TYPE "PublicCollectionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "growth_pages" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "heroMedia" TEXT,
    "status" "GrowthPageStatus" NOT NULL DEFAULT 'DRAFT',
    "seo" JSONB,
    "config" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_sections" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "type" "HomeSectionType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "layout" VARCHAR(80),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_section_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" TEXT,
    "mediaUrl" TEXT,
    "posterUrl" TEXT,
    "href" TEXT,
    "badge" VARCHAR(80),
    "resourceType" "ResourceType",
    "resourceId" TEXT,
    "creationId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_creations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "PublicCreationSourceType" NOT NULL,
    "sourceId" VARCHAR(200) NOT NULL,
    "mediaType" "PublicCreationMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "promptVisibility" "PublicPromptVisibility" NOT NULL DEFAULT 'hidden',
    "promptSnapshot" TEXT,
    "modelUsed" VARCHAR(120),
    "templateId" TEXT,
    "status" "PublicCreationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collectionSlug" VARCHAR(120),
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_creations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_creation_likes" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_creation_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "externalLinks" JSONB,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_collections" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "kind" "PublicCollectionKind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "heroMedia" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortConfig" JSONB,
    "status" "PublicCollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_events" (
    "id" TEXT NOT NULL,
    "eventName" VARCHAR(120) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "userId" TEXT,
    "anonymousId" VARCHAR(120),
    "source" VARCHAR(120),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_pages_slug_key" ON "growth_pages"("slug");

-- CreateIndex
CREATE INDEX "growth_pages_status_publishedAt_idx" ON "growth_pages"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "home_sections_key_key" ON "home_sections"("key");

-- CreateIndex
CREATE INDEX "home_sections_isActive_sort_idx" ON "home_sections"("isActive", "sort");

-- CreateIndex
CREATE INDEX "home_section_items_sectionId_sort_idx" ON "home_section_items"("sectionId", "sort");

-- CreateIndex
CREATE INDEX "home_section_items_resourceType_resourceId_idx" ON "home_section_items"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "home_section_items_creationId_idx" ON "home_section_items"("creationId");

-- CreateIndex
CREATE UNIQUE INDEX "public_creations_sourceType_sourceId_key" ON "public_creations"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "public_creations_userId_publishedAt_idx" ON "public_creations"("userId", "publishedAt");

-- CreateIndex
CREATE INDEX "public_creations_status_publishedAt_idx" ON "public_creations"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "public_creations_mediaType_publishedAt_idx" ON "public_creations"("mediaType", "publishedAt");

-- CreateIndex
CREATE INDEX "public_creations_collectionSlug_publishedAt_idx" ON "public_creations"("collectionSlug", "publishedAt");

-- CreateIndex
CREATE INDEX "public_creations_templateId_idx" ON "public_creations"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "public_creation_likes_creationId_userId_key" ON "public_creation_likes"("creationId", "userId");

-- CreateIndex
CREATE INDEX "public_creation_likes_userId_createdAt_idx" ON "public_creation_likes"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_userId_key" ON "creator_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_handle_key" ON "creator_profiles"("handle");

-- CreateIndex
CREATE INDEX "creator_profiles_displayName_idx" ON "creator_profiles"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "creator_follows_followerId_creatorUserId_key" ON "creator_follows"("followerId", "creatorUserId");

-- CreateIndex
CREATE INDEX "creator_follows_creatorUserId_createdAt_idx" ON "creator_follows"("creatorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "public_collections_slug_key" ON "public_collections"("slug");

-- CreateIndex
CREATE INDEX "public_collections_kind_status_idx" ON "public_collections"("kind", "status");

-- CreateIndex
CREATE INDEX "public_collections_status_createdAt_idx" ON "public_collections"("status", "createdAt");

-- CreateIndex
CREATE INDEX "growth_events_eventName_createdAt_idx" ON "growth_events"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "growth_events_path_createdAt_idx" ON "growth_events"("path", "createdAt");

-- CreateIndex
CREATE INDEX "growth_events_userId_createdAt_idx" ON "growth_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "growth_events_anonymousId_createdAt_idx" ON "growth_events"("anonymousId", "createdAt");

-- AddForeignKey
ALTER TABLE "home_section_items" ADD CONSTRAINT "home_section_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "home_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_section_items" ADD CONSTRAINT "home_section_items_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "public_creations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_creations" ADD CONSTRAINT "public_creations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_creation_likes" ADD CONSTRAINT "public_creation_likes_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "public_creations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_creation_likes" ADD CONSTRAINT "public_creation_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_events" ADD CONSTRAINT "growth_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
