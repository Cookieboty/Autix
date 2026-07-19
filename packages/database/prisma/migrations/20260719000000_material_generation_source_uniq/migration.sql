-- 生成素材去重的 partial unique index。
--
-- 背景：schema.prisma 上的 @@unique([userId, librarySource, sourceResourceType, sourceId])
-- 对生成素材不生效 —— 这类行的 sourceResourceType 恒为 NULL，而 Postgres 视 NULL 互不相等，
-- 同一 sourceId 可以无限重复插入。schema 注释与 backfill 脚本都声称由
-- material_assets_generation_source_uniq 兜底，但该索引在迁移扁平化时丢失，
-- 导致 createMany({ skipDuplicates: true }) 长期形同虚设：
--   - 回填脚本每重跑一次就整份复制一遍
--   - 生成完成回调重投也会重复落库
--
-- 建索引前先清理存量重复（每组保留最早的一行），否则建不起来。

DELETE FROM "material_assets" a
USING (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "userId", "sourceId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
    FROM "material_assets"
    WHERE "librarySource" = 'GENERATION' AND "sourceId" IS NOT NULL
  ) t WHERE rn > 1
) dup
WHERE a.id = dup.id;

-- 刻意不含 deletedAt 条件：用户删掉的生成素材不应被回填脚本"复活"。
CREATE UNIQUE INDEX "material_assets_generation_source_uniq"
  ON "material_assets" ("userId", "sourceId")
  WHERE "librarySource" = 'GENERATION' AND "sourceId" IS NOT NULL;
