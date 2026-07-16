-- 管理端 JSON 导入的作品来源。外链导入是站内来源守卫的唯一合法例外，
-- 由 mediaMigrated=false 标记待搬运，worker 搬完转 PUBLISHED。
ALTER TYPE "GallerySource" ADD VALUE IF NOT EXISTS 'ADMIN_CURATED';
