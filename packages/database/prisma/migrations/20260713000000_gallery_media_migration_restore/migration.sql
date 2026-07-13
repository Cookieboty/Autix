-- 恢复媒体外链 → R2 迁移标记位：上游迁移(8f2a17c8)随 gallery import 一并删除了这两列，
-- 但外链搬运 worker 仍需保留(上传/导入的外链要转存到自有存储)。schema.prisma 已声明,此处补齐表结构。
-- 两列均带 DEFAULT:存量行视为无需搬运(新投稿由站内来源守卫保证已是站内 URL)。

-- AlterTable
ALTER TABLE "gallery_posts" ADD COLUMN     "mediaMigrated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mediaMigrationAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "gallery_posts_mediaMigrated_mediaMigrationAttempts_idx" ON "gallery_posts"("mediaMigrated", "mediaMigrationAttempts");
