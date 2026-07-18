-- `/@username` 公开个人页顶部 banner（封面图）持久化。
-- 与头像同一套 reservation-then-consume：bannerImage 存 CDN publicUrl，
-- bannerStorageKey 存内部对象 key（仅服务端用于替换/清理，不下发前端）。可空，老用户默认无 banner。
ALTER TABLE "users"
  ADD COLUMN "bannerImage" TEXT,
  ADD COLUMN "bannerStorageKey" TEXT;

-- banner 走 pending_uploads reservation，purpose 需要新增 BANNER。
-- （追加在末尾，不在本事务内被引用，兼容 Postgres ADD VALUE 约束。）
ALTER TYPE "PendingUploadPurpose" ADD VALUE IF NOT EXISTS 'BANNER';

-- banner 替换/清空的 storage 清理来源，与头像的 AVATAR_REPLACED/AVATAR_CLEARED 语义并列。
ALTER TYPE "StorageCleanupReason" ADD VALUE IF NOT EXISTS 'BANNER_REPLACED';
ALTER TYPE "StorageCleanupReason" ADD VALUE IF NOT EXISTS 'BANNER_CLEARED';
