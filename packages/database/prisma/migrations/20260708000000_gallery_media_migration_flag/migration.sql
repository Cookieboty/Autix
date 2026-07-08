-- 广场作品媒体异步迁移：导入时先落原始外链（mediaMigrated=false 排队），后台 worker 再迁移到 R2。
-- 存量作品默认 true（媒体已归属自己，不进迁移队列）。
ALTER TABLE "gallery_posts" ADD COLUMN "mediaMigrated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gallery_posts" ADD COLUMN "mediaMigrationAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "gallery_posts_mediaMigrated_mediaMigrationAttempts_idx" ON "gallery_posts"("mediaMigrated", "mediaMigrationAttempts");
