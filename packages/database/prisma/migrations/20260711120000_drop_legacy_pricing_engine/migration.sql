-- 第四期清理：删除旧计费引擎（generation_pricing_rules）的全部数据结构。
--
-- 背景：新引擎（task_definitions + task_model_bindings + model_configs.paramsSchema/pricingSchema
-- + pricing_discounts + @autix/domain/pricing 纯函数求值器）自第二期起已是唯一扣费源；旧引擎的
-- 全部代码（domain 映射、API 估价器/仓储、admin Excel 导入、前端旧规则 UI、SDK/shared-store 方法）
-- 已在本期前序提交中删除。此迁移删除它们对应的数据库对象。
--
-- 惯例：与本仓已有的删除迁移（20260628010000_drop_legacy_pricing_columns 等）一致，
-- 采用幂等正向 SQL（DROP ... IF EXISTS），不提供回滚脚本。

-- 1) 先删子表（generation_pricing_rule_components 上有指向 rules 的外键），再删父表
DROP TABLE IF EXISTS "generation_pricing_rule_components";
DROP TABLE IF EXISTS "generation_pricing_rules";

-- 2) 删除仅被上述两表使用的两个枚举类型（表删除后才能删类型）
DROP TYPE IF EXISTS "PricingComponentType";
DROP TYPE IF EXISTS "PricingBaseUnit";

-- 3) 删除 model_configs 上不再被任何代码读取的旧兜底权重列
--    （新引擎的定价完全由 paramsSchema/pricingSchema + task_model_bindings.multiplier 决定）
ALTER TABLE "model_configs" DROP COLUMN IF EXISTS "pointCostWeight";
