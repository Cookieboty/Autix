CREATE TYPE "PricingComponentType" AS ENUM (
  'base',
  'fixed_extra',
  'per_image',
  'per_second',
  'input_token_per_1k',
  'output_token_per_1k',
  'context_token_per_1k',
  'per_tool_call',
  'per_mcp_call',
  'per_skill_call',
  'per_batch',
  'per_reference_image',
  'reasoning_multiplier',
  'reference_image_multiplier',
  'video_input_multiplier',
  'audio_input_multiplier',
  'priority_multiplier'
);

ALTER TABLE "generation_pricing_rules"
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "conditions" JSONB;

CREATE TABLE "generation_pricing_rule_components" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "componentType" "PricingComponentType" NOT NULL,
  "unitCost" DECIMAL(10,2),
  "multiplier" DECIMAL(6,2),
  "config" JSONB,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "generation_pricing_rule_components_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "generation_pricing_rule_components"
  ADD CONSTRAINT "generation_pricing_rule_components_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "generation_pricing_rules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "generation_pricing_rules_priority_idx"
  ON "generation_pricing_rules"("priority");

CREATE INDEX "generation_pricing_rule_components_ruleId_isActive_idx"
  ON "generation_pricing_rule_components"("ruleId", "isActive");

CREATE INDEX "generation_pricing_rule_components_componentType_idx"
  ON "generation_pricing_rule_components"("componentType");

DROP INDEX IF EXISTS "generation_pricing_rules_modelProvider_modelName_idx";
DROP INDEX IF EXISTS "generation_pricing_rules_modelTier_idx";

ALTER TABLE "generation_pricing_rules"
  DROP COLUMN IF EXISTS "modelProvider",
  DROP COLUMN IF EXISTS "modelName",
  DROP COLUMN IF EXISTS "quality",
  DROP COLUMN IF EXISTS "resolution",
  DROP COLUMN IF EXISTS "modelTier",
  DROP COLUMN IF EXISTS "baseCost",
  DROP COLUMN IF EXISTS "inputTokenCostPerK",
  DROP COLUMN IF EXISTS "outputTokenCostPerK",
  DROP COLUMN IF EXISTS "contextTokenCostPerK",
  DROP COLUMN IF EXISTS "reasoningMultiplier",
  DROP COLUMN IF EXISTS "toolCallCost",
  DROP COLUMN IF EXISTS "batchUnitCost",
  DROP COLUMN IF EXISTS "minDurationSeconds",
  DROP COLUMN IF EXISTS "maxDurationSeconds",
  DROP COLUMN IF EXISTS "referenceImageFixedCost",
  DROP COLUMN IF EXISTS "referenceImageMultiplier",
  DROP COLUMN IF EXISTS "videoInputMultiplier",
  DROP COLUMN IF EXISTS "audioInputMultiplier",
  DROP COLUMN IF EXISTS "priorityMultiplier",
  DROP COLUMN IF EXISTS "fixedExtraCost",
  DROP COLUMN IF EXISTS "allowedMembershipLevels",
  DROP COLUMN IF EXISTS "disallowedGrantTypes";

DROP TYPE IF EXISTS "PricingModelTier";
