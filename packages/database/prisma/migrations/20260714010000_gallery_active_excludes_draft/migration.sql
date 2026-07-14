-- 修正「一次生成至多一条活帖」的活帖定义：DRAFT 不算活帖。
-- 上一条迁移（20260714000000_gallery_generation_active_uniq）把活帖定义成
-- status <> 'REMOVED'，DRAFT 也满足这个条件——但 DRAFT 是私人草稿，本就不是"广场里活着的
-- 作品"，不该占这个坑。且 createDraft 不做归属校验，imageGenerationId 是 DTO 里任意字符串，
-- 冒名建一条 DRAFT 就能把别人那次生成的投稿坑焊死，导致真正的作者 createSubmission 被
-- 短路甚至撞库 500。与 GalleryRepository.findActivePostByImageGenerationId 的守卫同一条规则，
-- 两处必须逐字一致。
--
-- 无需数据清理：旧索引本就保证同一 imageGenerationId 下 status <> 'REMOVED' 的行至多一条，
-- 新谓词只是从"活帖"集合里再排除 DRAFT，约束只会变宽松，不会有既有数据违反新索引。
DROP INDEX "gallery_posts_image_generation_active_uniq";

CREATE UNIQUE INDEX "gallery_posts_image_generation_active_uniq"
  ON gallery_posts ("imageGenerationId")
  WHERE "imageGenerationId" IS NOT NULL AND status NOT IN ('REMOVED', 'DRAFT');
