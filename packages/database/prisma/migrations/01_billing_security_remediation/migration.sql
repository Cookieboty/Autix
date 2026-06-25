-- Billing security remediation migrations.
--
-- ⚠️ 应用前提（务必先在迁移窗口执行去重预演）：
--   下面的唯一约束在存量数据存在重复时会创建失败。请先运行去重核查，
--   确认 (userId, sourceEvent, sourceId) 无重复后再 deploy 本迁移。
--   去重核查（只读）示例：
--     SELECT "userId", "sourceEvent", "sourceId", COUNT(*)
--     FROM "point_grants"
--     WHERE "sourceId" IS NOT NULL
--     GROUP BY 1,2,3 HAVING COUNT(*) > 1;

-- FIX-8: 订阅周期/订单/活动等积分发放的 DB 级幂等兜底（按用户维度）。
-- 说明：sourceId 为 NULL 的行（如无来源的人工授予）在 Postgres 唯一索引中互不相等，不受影响。
CREATE UNIQUE INDEX IF NOT EXISTS "point_grants_userId_sourceEvent_sourceId_key"
  ON "point_grants" ("userId", "sourceEvent", "sourceId");

-- ============================================================
-- 风控与用户管理 R1：数据模型
-- ============================================================

-- 风控安全等级
DO $$ BEGIN
  CREATE TYPE "RiskLevel" AS ENUM ('L0', 'L1', 'L2', 'L3');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 注册采集：IP / 设备指纹
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signupIp" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signupDeviceId" TEXT;

-- 用户风控档案（每用户一条）
CREATE TABLE IF NOT EXISTS "user_risk_profiles" (
  "userId"         TEXT NOT NULL,
  "level"          "RiskLevel" NOT NULL DEFAULT 'L0',
  "score"          INTEGER NOT NULL DEFAULT 0,
  "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "topSignals"     JSONB,
  "evaluatedAt"    TIMESTAMP(3),
  "blockedAt"      TIMESTAMP(3),
  "blockedReason"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_risk_profiles_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX IF NOT EXISTS "user_risk_profiles_level_score_idx" ON "user_risk_profiles" ("level", "score");
DO $$ BEGIN
  ALTER TABLE "user_risk_profiles" ADD CONSTRAINT "user_risk_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 风控信号 / 处置流水（追加式）
CREATE TABLE IF NOT EXISTS "user_risk_events" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "severity"  INTEGER NOT NULL DEFAULT 0,
  "detail"    JSONB,
  "actorId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_risk_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_risk_events_userId_createdAt_idx" ON "user_risk_events" ("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "user_risk_events" ADD CONSTRAINT "user_risk_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
