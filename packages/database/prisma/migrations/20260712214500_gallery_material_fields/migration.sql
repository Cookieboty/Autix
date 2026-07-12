-- CreateEnum
CREATE TYPE "MaterialLibrarySource" AS ENUM ('UPLOAD', 'FAVORITE', 'HISTORY');

-- AlterEnum
BEGIN;
CREATE TYPE "GallerySource_new" AS ENUM ('USER_UPLOAD', 'FROM_GENERATION', 'FROM_TEMPLATE');
ALTER TABLE "public"."gallery_posts" ALTER COLUMN "sourceType" DROP DEFAULT;
ALTER TABLE "gallery_posts" ALTER COLUMN "sourceType" TYPE "GallerySource_new" USING ("sourceType"::text::"GallerySource_new");
ALTER TYPE "GallerySource" RENAME TO "GallerySource_old";
ALTER TYPE "GallerySource_new" RENAME TO "GallerySource";
DROP TYPE "public"."GallerySource_old";
ALTER TABLE "gallery_posts" ALTER COLUMN "sourceType" SET DEFAULT 'USER_UPLOAD';
COMMIT;

-- DropIndex
DROP INDEX "gallery_posts_mediaMigrated_mediaMigrationAttempts_idx";

-- AlterTable
ALTER TABLE "gallery_posts" DROP COLUMN "authorSnapshot",
DROP COLUMN "mediaMigrated",
DROP COLUMN "mediaMigrationAttempts",
ADD COLUMN     "referenceImage" TEXT,
ALTER COLUMN "authorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "image_generations" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "material_assets" ADD COLUMN     "librarySource" "MaterialLibrarySource" NOT NULL,
ADD COLUMN     "sourceResourceType" "ResourceType",
ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "resource_metrics" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "resource_download_events" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_download_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_download_events_resourceType_resourceId_createdAt_idx" ON "resource_download_events"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_download_events_userId_createdAt_idx" ON "resource_download_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "material_assets_userId_librarySource_deletedAt_createdAt_idx" ON "material_assets"("userId", "librarySource", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "material_assets_userId_librarySource_sourceResourceType_sou_key" ON "material_assets"("userId", "librarySource", "sourceResourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "gallery_posts" ADD CONSTRAINT "gallery_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
