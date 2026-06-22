import { Client } from 'pg';
import { randomUUID } from 'crypto';

type PricingRuleSeed = {
  taskType: string;
  name: string;
  baseUnit: string;
  priority?: number;
  conditions?: Record<string, unknown> | null;
  refundPolicy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  components: PricingRuleComponentSeed[];
};

type PricingRuleComponentSeed = {
  componentType: string;
  unitCost?: number;
  multiplier?: number;
  config?: Record<string, unknown>;
  sort: number;
};

const pricingRules: PricingRuleSeed[] = [
  {
    taskType: 'chat_message_fast',
    name: '快速对话',
    baseUnit: 'message',
    conditions: { modelTier: 'fast' },
    components: [
      { componentType: 'base', unitCost: 1, sort: 10 },
      { componentType: 'input_token_per_1k', unitCost: 0.5, sort: 30 },
      { componentType: 'output_token_per_1k', unitCost: 2, sort: 40 },
    ],
  },
  {
    taskType: 'chat_message_standard',
    name: '普通对话',
    baseUnit: 'message',
    conditions: { modelTier: 'standard' },
    components: [
      { componentType: 'base', unitCost: 3, sort: 10 },
      { componentType: 'input_token_per_1k', unitCost: 1, sort: 30 },
      { componentType: 'output_token_per_1k', unitCost: 5, sort: 40 },
    ],
  },
  {
    taskType: 'chat_message_reasoning',
    name: '深度思考对话',
    baseUnit: 'message',
    conditions: { modelTier: 'pro_reasoning' },
    components: [
      { componentType: 'base', unitCost: 10, sort: 10 },
      { componentType: 'input_token_per_1k', unitCost: 3, sort: 30 },
      { componentType: 'output_token_per_1k', unitCost: 15, sort: 40 },
      { componentType: 'reasoning_multiplier', multiplier: 1.2, sort: 100 },
    ],
  },
  {
    taskType: 'gpt_image_2_low',
    name: '图片工作台 Low',
    baseUnit: 'image',
    conditions: { quality: 'low' },
    components: [{ componentType: 'per_image', unitCost: 15, sort: 10 }],
  },
  {
    taskType: 'gpt_image_2_medium',
    name: '图片工作台 Medium',
    baseUnit: 'image',
    conditions: { quality: 'medium' },
    components: [{ componentType: 'per_image', unitCost: 90, sort: 10 }],
  },
  {
    taskType: 'gpt_image_2_high',
    name: '图片工作台 High',
    baseUnit: 'image',
    conditions: { quality: 'high' },
    components: [{ componentType: 'per_image', unitCost: 350, sort: 10 }],
  },
  {
    taskType: 'image_generation',
    name: '图片模板生成',
    baseUnit: 'image',
    components: [{ componentType: 'per_image', unitCost: 90, sort: 10 }],
  },
  {
    taskType: 'seedance_fast_720p',
    name: 'Seedance Fast 720p',
    baseUnit: 'second',
    conditions: { resolution: '720p' },
    components: [{ componentType: 'per_second', unitCost: 260, sort: 10 }],
  },
  {
    taskType: 'seedance_480p',
    name: 'Seedance 480p',
    baseUnit: 'second',
    conditions: { resolution: '480p' },
    components: [{ componentType: 'per_second', unitCost: 160, sort: 10 }],
  },
  {
    taskType: 'seedance_720p',
    name: 'Seedance 720p',
    baseUnit: 'second',
    conditions: { resolution: '720p' },
    components: [{ componentType: 'per_second', unitCost: 320, sort: 10 }],
  },
  {
    taskType: 'seedance_1080p',
    name: 'Seedance 1080p',
    baseUnit: 'second',
    conditions: { resolution: '1080p' },
    components: [{ componentType: 'per_second', unitCost: 800, sort: 10 }],
  },
  {
    taskType: 'video_generation',
    name: '视频模板生成',
    baseUnit: 'second',
    components: [{ componentType: 'per_second', unitCost: 320, sort: 10 }],
  },
  {
    taskType: 'prompt_optimize_generation',
    name: '图片工作台 Prompt 优化',
    baseUnit: 'task',
    components: [
      { componentType: 'base', unitCost: 1, sort: 10 },
      { componentType: 'input_token_per_1k', unitCost: 0.5, sort: 30 },
      { componentType: 'output_token_per_1k', unitCost: 2, sort: 40 },
    ],
  },
  {
    taskType: 'prompt_optimize_pro',
    name: 'Artifact 文档 AI 优化',
    baseUnit: 'task',
    components: [
      { componentType: 'base', unitCost: 1, sort: 10 },
      { componentType: 'input_token_per_1k', unitCost: 0.5, sort: 30 },
      { componentType: 'output_token_per_1k', unitCost: 2, sort: 40 },
    ],
  },
];

const obsoletePricingTaskTypes = [
  'long_context_chat',
  'tool_call',
  'prompt_optimize_quick',
  'prompt_template_generation',
  'prompt_optimize_batch',
];

const obsoletePricingRuleNames = [
  { taskType: 'chat_message_fast', name: '普通快速对话' },
  { taskType: 'chat_message_standard', name: '高质量对话' },
  { taskType: 'chat_message_reasoning', name: '深度思考' },
  { taskType: 'prompt_optimize_pro', name: '专业优化 Prompt' },
  { taskType: 'prompt_optimize_generation', name: '图片/视频 Prompt 增强' },
  { taskType: 'gpt_image_2_low', name: 'GPT Image 2 Low' },
  { taskType: 'gpt_image_2_medium', name: 'GPT Image 2 Medium' },
  { taskType: 'gpt_image_2_high', name: 'GPT Image 2 High' },
];

async function ensureEnum(client: Client, name: string, values: string[]) {
  const existing = await client.query('SELECT 1 FROM pg_type WHERE typname = $1', [name]);
  if (existing.rowCount) return;

  const labels = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  await client.query(`CREATE TYPE "${name}" AS ENUM (${labels})`);
}

function jsonParam(value: Record<string, unknown> | null | undefined) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');
    await ensureEnum(client, 'PricingBaseUnit', ['image', 'second', 'task', 'message', 'token', 'tool_call']);
    await ensureEnum(client, 'PricingComponentType', [
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
      'priority_multiplier',
    ]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "generation_pricing_rules" (
        "id" TEXT PRIMARY KEY,
        "taskType" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "baseUnit" "PricingBaseUnit" NOT NULL DEFAULT 'task',
        "priority" INTEGER NOT NULL DEFAULT 0,
        "conditions" JSONB,
        "refundPolicy" JSONB,
        "metadata" JSONB,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "effectiveFrom" TIMESTAMP(3),
        "effectiveTo" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "baseUnit" "PricingBaseUnit" NOT NULL DEFAULT \'task\'');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "conditions" JSONB');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "refundPolicy" JSONB');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "metadata" JSONB');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3)');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3)');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
    await client.query('ALTER TABLE "generation_pricing_rules" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "generation_pricing_rule_components" (
        "id" TEXT PRIMARY KEY,
        "ruleId" TEXT NOT NULL REFERENCES "generation_pricing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "componentType" "PricingComponentType" NOT NULL,
        "unitCost" DECIMAL(10,2),
        "multiplier" DECIMAL(6,2),
        "config" JSONB,
        "sort" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('DROP INDEX IF EXISTS "generation_pricing_rules_modelProvider_modelName_idx"');
    await client.query('DROP INDEX IF EXISTS "generation_pricing_rules_modelTier_idx"');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "generation_pricing_rules_taskType_name_key" ON "generation_pricing_rules"("taskType", "name")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_taskType_isActive_idx" ON "generation_pricing_rules"("taskType", "isActive")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_priority_idx" ON "generation_pricing_rules"("priority")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_effectiveFrom_effectiveTo_idx" ON "generation_pricing_rules"("effectiveFrom", "effectiveTo")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rule_components_ruleId_isActive_idx" ON "generation_pricing_rule_components"("ruleId", "isActive")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rule_components_componentType_idx" ON "generation_pricing_rule_components"("componentType")');
    await client.query(`
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
        DROP COLUMN IF EXISTS "disallowedGrantTypes"
    `);
    await client.query('DROP TYPE IF EXISTS "PricingModelTier"');

    for (const rule of pricingRules) {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO "generation_pricing_rules" (
          "id", "taskType", "name", "baseUnit", "priority", "conditions",
          "refundPolicy", "metadata", "isActive", "updatedAt"
        )
        VALUES ($1, $2, $3, $4::"PricingBaseUnit", $5, $6::jsonb, $7::jsonb, $8::jsonb, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("taskType", "name") DO UPDATE SET
          "baseUnit" = EXCLUDED."baseUnit",
          "priority" = EXCLUDED."priority",
          "conditions" = EXCLUDED."conditions",
          "refundPolicy" = EXCLUDED."refundPolicy",
          "metadata" = EXCLUDED."metadata",
          "isActive" = true,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "id"
        `,
        [
          `pricing_${randomUUID()}`,
          rule.taskType,
          rule.name,
          rule.baseUnit,
          rule.priority ?? 0,
          jsonParam(rule.conditions),
          jsonParam(rule.refundPolicy),
          jsonParam(rule.metadata),
        ],
      );
      const ruleId = result.rows[0]?.id;
      if (ruleId) {
        await client.query('DELETE FROM "generation_pricing_rule_components" WHERE "ruleId" = $1', [ruleId]);
        for (const component of rule.components) {
          await client.query(
            `
            INSERT INTO "generation_pricing_rule_components" (
              "id", "ruleId", "componentType", "unitCost", "multiplier", "config", "sort", "updatedAt"
            )
            VALUES ($1, $2, $3::"PricingComponentType", $4, $5, $6::jsonb, $7, CURRENT_TIMESTAMP)
            `,
            [
              `${ruleId}_${component.componentType}_${component.sort}`,
              ruleId,
              component.componentType,
              component.unitCost ?? null,
              component.multiplier ?? null,
              jsonParam(component.config),
              component.sort,
            ],
          );
        }
      }
    }

    await client.query(
      'DELETE FROM "generation_pricing_rules" WHERE "taskType" = ANY($1::text[])',
      [obsoletePricingTaskTypes],
    );
    for (const rule of obsoletePricingRuleNames) {
      await client.query(
        'DELETE FROM "generation_pricing_rules" WHERE "taskType" = $1 AND "name" = $2',
        [rule.taskType, rule.name],
      );
    }

    await client.query('DROP TABLE IF EXISTS "task_point_costs"');
    await client.query('COMMIT');
    console.log(`Ensured generation_pricing_rules with ${pricingRules.length} active default rules.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
