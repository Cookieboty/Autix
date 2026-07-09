-- 1. model_configs：只加 schema 字段。
--    pointCostWeight 保留 —— 它服务于 llm-call-tracker.ts 那条独立计费路径，
--    删除推迟到第四期，前置条件是该路径先迁到 task_model_bindings.multiplier。
ALTER TABLE "model_configs"
  ADD COLUMN "paramsSchema" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "pricingSchema" JSONB NOT NULL DEFAULT '{"terms":[]}',
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "description" JSONB NOT NULL DEFAULT '{}';

-- 2. 任务定义
CREATE TABLE "task_definitions" (
  "id"              TEXT PRIMARY KEY,
  "taskType"        VARCHAR(64) NOT NULL,
  "name"            VARCHAR(100) NOT NULL,
  "category"        VARCHAR(20) NOT NULL,
  "fixedCostSchema" JSONB,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "sort"            INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "task_definitions_taskType_key" ON "task_definitions"("taskType");
CREATE INDEX "task_definitions_isActive_idx" ON "task_definitions"("isActive");

-- 3. (任务 × 模型) 绑定：既是白名单，也是倍率
CREATE TABLE "task_model_bindings" (
  "taskType"      VARCHAR(64) NOT NULL,
  "modelConfigId" TEXT NOT NULL,
  "multiplier"    DECIMAL(6,3) NOT NULL DEFAULT 1.0,
  "isDefault"     BOOLEAN NOT NULL DEFAULT false,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "sort"          INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_model_bindings_pkey" PRIMARY KEY ("taskType", "modelConfigId")
);
CREATE INDEX "task_model_bindings_modelConfigId_idx" ON "task_model_bindings"("modelConfigId");
CREATE INDEX "task_model_bindings_taskType_isActive_idx" ON "task_model_bindings"("taskType", "isActive");

-- 每个任务至多一个默认模型。partial index，Prisma schema 不支持，只能写在这里。
-- 用 DB 约束而非服务层校验：约束不可绕过，而服务层校验会被 seed 脚本、
-- admin 批量导入、直连 SQL 绕过。
CREATE UNIQUE INDEX "task_model_bindings_one_default_per_task"
  ON "task_model_bindings"("taskType") WHERE "isDefault" = true;

ALTER TABLE "task_model_bindings"
  ADD CONSTRAINT "task_model_bindings_taskType_fkey"
  FOREIGN KEY ("taskType") REFERENCES "task_definitions"("taskType") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_model_bindings"
  ADD CONSTRAINT "task_model_bindings_modelConfigId_fkey"
  FOREIGN KEY ("modelConfigId") REFERENCES "model_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. 折扣层
CREATE TABLE "pricing_discounts" (
  "id"            TEXT PRIMARY KEY,
  "code"          VARCHAR(64) NOT NULL,
  "name"          VARCHAR(100) NOT NULL,
  "factor"        DECIMAL(6,3) NOT NULL,
  "scope"         JSONB NOT NULL DEFAULT '{}',
  "stackable"     BOOLEAN NOT NULL DEFAULT false,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo"   TIMESTAMP(3),
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "pricing_discounts_code_key" ON "pricing_discounts"("code");
CREATE INDEX "pricing_discounts_isActive_effectiveFrom_effectiveTo_idx"
  ON "pricing_discounts"("isActive", "effectiveFrom", "effectiveTo");

-- 本迁移不 DROP 任何东西。旧的 generation_pricing_rules /
-- generation_pricing_rule_components / PricingComponentType / PricingBaseUnit /
-- model_configs.pointCostWeight 全部保留，第四期再清理。
