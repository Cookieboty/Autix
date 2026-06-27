-- CreateTable
CREATE TABLE "material_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "material_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_folders_userId_deletedAt_sortOrder_idx" ON "material_folders"("userId", "deletedAt", "sortOrder");

-- AddForeignKey
ALTER TABLE "material_folders" ADD CONSTRAINT "material_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "material_assets" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "material_assets_userId_folderId_deletedAt_idx" ON "material_assets"("userId", "folderId", "deletedAt");

-- AddForeignKey
ALTER TABLE "material_assets" ADD CONSTRAINT "material_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "material_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 同用户、未删除文件夹内,文件夹名大小写不敏感唯一
CREATE UNIQUE INDEX "material_folders_user_name_active_uniq"
  ON "material_folders" ("userId", lower("name"))
  WHERE "deletedAt" IS NULL;
