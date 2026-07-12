-- T18: 扩展 StorageCleanupReason enum，新增 AVATAR_ORIGINAL_REPLACED
-- 场景：AvatarImageProcessor 处理原图后写新 processed key，原 key 需要单独清理，
-- 与 AVATAR_REPLACED（旧头像替换）语义并列但独立，便于运维观测两类源。
--
-- 兼容性：新 enum value 追加在末尾，旧代码/旧数据不受影响。

ALTER TYPE "StorageCleanupReason" ADD VALUE IF NOT EXISTS 'AVATAR_ORIGINAL_REPLACED';
