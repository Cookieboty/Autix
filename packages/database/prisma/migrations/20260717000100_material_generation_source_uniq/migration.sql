-- GENERATION 素材的去重保证。
--
-- material_assets 已有 @@unique([userId, librarySource, sourceResourceType, sourceId])，
-- 但它对生成素材是**失效**的：收藏素材的 sourceResourceType 恒为具体 ResourceType（非空），
-- 而生成素材没有对应的 ResourceType（sourceId 指向的是生成流水行、不是市场资源），只能留 NULL；
-- Postgres 的唯一约束视 NULL 互不相等，于是同一张生成图重复写入不会被拦住
-- —— 生成流程重试、回填脚本重跑都会造出重复素材。
--
-- 故为 GENERATION 单独建 partial unique index（Prisma schema 表达不了，手写 SQL，
-- 与 gallery_posts_image_generation_active_uniq 同一套路）。
--
-- 键是 (userId, sourceId)，其中 sourceId = '<generationId>::<图片下标>'
-- —— 一次生成产出多张图（image_generations.generatedImages 是数组），每张图一条素材。
--
-- 刻意**不**带 "deletedAt IS NULL" 条件：用户删掉某张生成素材后，
-- 回填脚本重跑不应把它复活；留着软删行 + skipDuplicates 正好挡住。
CREATE UNIQUE INDEX "material_assets_generation_source_uniq"
  ON material_assets ("userId", "sourceId")
  WHERE "librarySource" = 'GENERATION';
