-- 生成内容进素材库：新增 librarySource='GENERATION'。
-- 在此之前生成的图/视频只存在于 image_generations / video_generations 流水表，
-- 素材库（material_assets）收不到它们，/asset 页面因此无法「聚合全部生成内容」。
--
-- 注意：ALTER TYPE ... ADD VALUE 加进来的枚举值在同一事务里不可被使用（PG 限制），
-- 而 Prisma 每个 migration 文件跑在各自事务中，故本文件只加值、不写数据；
-- 依赖该值的唯一索引放在下一个 migration，回填走独立脚本。
ALTER TYPE "MaterialLibrarySource" ADD VALUE 'GENERATION';
