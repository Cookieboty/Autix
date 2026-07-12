-- CreateEnum
CREATE TYPE "ImageTemplateSource" AS ENUM ('ADMIN_CREATED', 'GALLERY_CONVERSION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VideoTemplateSource" AS ENUM ('ADMIN_CREATED', 'SYSTEM');

-- AlterTable
ALTER TABLE "image_templates" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sourceGalleryPostId" TEXT,
ADD COLUMN     "sourceType" "ImageTemplateSource" NOT NULL DEFAULT 'ADMIN_CREATED',
ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "video_templates" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sourceType" "VideoTemplateSource" NOT NULL DEFAULT 'ADMIN_CREATED',
ADD COLUMN     "systemKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "image_templates_sourceGalleryPostId_key" ON "image_templates"("sourceGalleryPostId");

-- CreateIndex
CREATE INDEX "image_templates_sourceType_idx" ON "image_templates"("sourceType");

-- CreateIndex
CREATE INDEX "image_templates_createdById_idx" ON "image_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "image_templates_authorId_systemKey_key" ON "image_templates"("authorId", "systemKey");

-- CreateIndex
CREATE INDEX "video_templates_sourceType_idx" ON "video_templates"("sourceType");

-- CreateIndex
CREATE INDEX "video_templates_createdById_idx" ON "video_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "video_templates_authorId_systemKey_key" ON "video_templates"("authorId", "systemKey");

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_sourceGalleryPostId_fkey" FOREIGN KEY ("sourceGalleryPostId") REFERENCES "gallery_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_templates" ADD CONSTRAINT "video_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_templates" ADD CONSTRAINT "video_templates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

