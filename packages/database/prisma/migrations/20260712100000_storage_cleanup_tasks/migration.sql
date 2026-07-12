-- T10: storage_cleanup_tasks 建表（spec §3.2 A' 完整形态）
-- 用于事务后 enqueue R2 对象删除，worker 通过 lease + attempts 补偿删除。

CREATE TYPE "StorageCleanupTaskStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'SKIPPED_STILL_REFERENCED',
  'DEAD'
);

CREATE TYPE "StorageCleanupReason" AS ENUM (
  'UPLOAD_EXPIRED',
  'AVATAR_REPLACED',
  'AVATAR_CLEARED',
  'USER_DELETED',
  'ACCOUNT_DELETED',
  'ADMIN_AVATAR_REPLACED',
  'PENDING_UPLOAD_EXPIRED',
  'MANUAL'
);

CREATE TABLE "storage_cleanup_tasks" (
  "id"             TEXT NOT NULL,
  "storageKey"     VARCHAR(500) NOT NULL,
  "storageBucket"  TEXT,
  "ownerUserId"    TEXT,
  "reason"         "StorageCleanupReason" NOT NULL,
  "status"         "StorageCleanupTaskStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"    INTEGER NOT NULL DEFAULT 6,
  "lastError"      TEXT,
  "scheduledAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextRetryAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt"       TIMESTAMP(3),
  "lockedBy"       TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "storage_cleanup_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "storage_cleanup_tasks_status_nextRetryAt_idx"
  ON "storage_cleanup_tasks" ("status", "nextRetryAt");
CREATE INDEX "storage_cleanup_tasks_status_leaseExpiresAt_idx"
  ON "storage_cleanup_tasks" ("status", "leaseExpiresAt");
CREATE INDEX "storage_cleanup_tasks_storageKey_idx"
  ON "storage_cleanup_tasks" ("storageKey");
CREATE INDEX "storage_cleanup_tasks_ownerUserId_idx"
  ON "storage_cleanup_tasks" ("ownerUserId");
