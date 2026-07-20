-- 恢复（并补齐）「一次生成至多一条活着的广场帖」的 DB 侧约束。
--
-- gallery_posts_image_generation_active_uniq 原本存在，在迁移压平时丢失，于是
-- GalleryService.createSubmission 的「先查活帖再写入」退化成了纯读后写：两个并发
-- 投稿请求都查不到活帖，双双写入，同一次生成在广场里出现两条一模一样的帖子。
-- 视频侧此前没有这条索引 —— 因为 videoGenerationId 指向的是永不产出的第一代表，
-- 投稿根本落不了库；现在它已改指 video_clip_generations，同样需要这层兜底。
--
-- 谓词必须与 gallery.repository.ts 的 findActivePostBy{Image,Video}GenerationId
-- 逐字一致（status NOT IN ('REMOVED','DRAFT')），否则服务层放行的写入会被索引拒绝。

CREATE UNIQUE INDEX IF NOT EXISTS "gallery_posts_image_generation_active_uniq"
  ON "gallery_posts" ("imageGenerationId", "authorId")
  WHERE "imageGenerationId" IS NOT NULL
    AND "status" NOT IN ('REMOVED', 'DRAFT');

CREATE UNIQUE INDEX IF NOT EXISTS "gallery_posts_video_generation_active_uniq"
  ON "gallery_posts" ("videoGenerationId", "authorId")
  WHERE "videoGenerationId" IS NOT NULL
    AND "status" NOT IN ('REMOVED', 'DRAFT');
