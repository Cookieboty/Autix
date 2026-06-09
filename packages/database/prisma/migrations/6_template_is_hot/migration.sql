-- AlterTable
ALTER TABLE "image_templates" ADD COLUMN "isHot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "video_templates" ADD COLUMN "isHot" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "image_templates_isHot_idx" ON "image_templates"("isHot");

-- CreateIndex
CREATE INDEX "video_templates_isHot_idx" ON "video_templates"("isHot");
