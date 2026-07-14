-- 一次生成至多一条「活着的」广场帖（活帖 = status <> 'REMOVED'）。
-- 与 GalleryRepository.findActivePostByImageGenerationId / GalleryService.createSubmission
-- 的守卫同一条规则；服务层守拦大多数情况，此索引是并发抢跑下的最终保证。
-- Prisma schema 无法表达 partial unique index，故手写 SQL。
--
-- 前置清理：历史数据里可能已存在同一 imageGenerationId 的多条活帖（正是本次修复的 bug
-- 所产生的重复帖）。建索引前先把每组里除最早一条外的其余活帖标记为 REMOVED，否则建索引失败。
UPDATE gallery_posts p
SET status = 'REMOVED'
WHERE p."imageGenerationId" IS NOT NULL
  AND p.status <> 'REMOVED'
  AND p.id <> (
    SELECT q.id
    FROM gallery_posts q
    WHERE q."imageGenerationId" = p."imageGenerationId"
      AND q.status <> 'REMOVED'
    ORDER BY q."createdAt" ASC, q.id ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX "gallery_posts_image_generation_active_uniq"
  ON gallery_posts ("imageGenerationId")
  WHERE "imageGenerationId" IS NOT NULL AND status <> 'REMOVED';
