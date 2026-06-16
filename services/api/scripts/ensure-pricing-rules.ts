import { Client } from 'pg';
import { randomUUID } from 'crypto';

type PricingRuleSeed = {
  taskType: string;
  name: string;
  baseUnit: string;
  baseCost: number;
  quality?: string;
  resolution?: string;
  modelTier?: string;
  inputTokenCostPerK?: number;
  outputTokenCostPerK?: number;
  contextTokenCostPerK?: number;
  reasoningMultiplier?: number;
  toolCallCost?: number;
  batchUnitCost?: number;
  referenceImageFixedCost?: number;
  referenceImageMultiplier?: number;
  videoInputMultiplier?: number;
  audioInputMultiplier?: number;
  fixedExtraCost?: number;
};

const pricingRules: PricingRuleSeed[] = [
  { taskType: 'chat_message_fast', name: '快速对话', baseUnit: 'message', baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2, modelTier: 'fast' },
  { taskType: 'chat_message_standard', name: '普通对话', baseUnit: 'message', baseCost: 3, inputTokenCostPerK: 1, outputTokenCostPerK: 5, modelTier: 'standard' },
  { taskType: 'chat_message_reasoning', name: '深度思考对话', baseUnit: 'message', baseCost: 10, inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2, modelTier: 'pro_reasoning' },
  { taskType: 'gpt_image_2_low', name: '图片工作台 Low', baseUnit: 'image', baseCost: 15, quality: 'low' },
  { taskType: 'gpt_image_2_medium', name: '图片工作台 Medium', baseUnit: 'image', baseCost: 90, quality: 'medium' },
  { taskType: 'gpt_image_2_high', name: '图片工作台 High', baseUnit: 'image', baseCost: 350, quality: 'high' },
  { taskType: 'image_generation', name: '图片模板生成', baseUnit: 'image', baseCost: 90 },
  { taskType: 'seedance_fast_720p', name: 'Seedance Fast 720p', baseUnit: 'second', baseCost: 260, resolution: '720p' },
  { taskType: 'seedance_480p', name: 'Seedance 480p', baseUnit: 'second', baseCost: 160, resolution: '480p' },
  { taskType: 'seedance_720p', name: 'Seedance 720p', baseUnit: 'second', baseCost: 320, resolution: '720p' },
  { taskType: 'seedance_1080p', name: 'Seedance 1080p', baseUnit: 'second', baseCost: 800, resolution: '1080p' },
  { taskType: 'video_generation', name: '视频模板生成', baseUnit: 'second', baseCost: 320 },
  { taskType: 'prompt_optimize_generation', name: '图片工作台 Prompt 优化', baseUnit: 'task', baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
  { taskType: 'prompt_optimize_pro', name: 'Artifact 文档 AI 优化', baseUnit: 'task', baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');
    await ensureEnum(client, 'PricingBaseUnit', ['image', 'second', 'task', 'message', 'token', 'tool_call']);
    await ensureEnum(client, 'PricingModelTier', ['fast', 'standard', 'pro_reasoning']);
    await ensureEnum(client, 'PointGrantType', ['SUBSCRIPTION', 'PURCHASED', 'GIFT', 'COMPENSATION']);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "generation_pricing_rules" (
        "id" TEXT PRIMARY KEY,
        "taskType" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "modelProvider" TEXT,
        "modelName" TEXT,
        "quality" TEXT,
        "resolution" TEXT,
        "modelTier" "PricingModelTier",
        "baseUnit" "PricingBaseUnit" NOT NULL DEFAULT 'task',
        "baseCost" INTEGER NOT NULL DEFAULT 0,
        "inputTokenCostPerK" DECIMAL(10,2),
        "outputTokenCostPerK" DECIMAL(10,2),
        "contextTokenCostPerK" DECIMAL(10,2),
        "reasoningMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
        "toolCallCost" INTEGER,
        "batchUnitCost" INTEGER,
        "minDurationSeconds" INTEGER,
        "maxDurationSeconds" INTEGER,
        "referenceImageFixedCost" INTEGER,
        "referenceImageMultiplier" DECIMAL(6,2),
        "videoInputMultiplier" DECIMAL(6,2),
        "audioInputMultiplier" DECIMAL(6,2),
        "priorityMultiplier" DECIMAL(6,2),
        "fixedExtraCost" INTEGER NOT NULL DEFAULT 0,
        "allowedMembershipLevels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
        "disallowedGrantTypes" "PointGrantType"[] DEFAULT ARRAY[]::"PointGrantType"[],
        "refundPolicy" JSONB,
        "metadata" JSONB,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "effectiveFrom" TIMESTAMP(3),
        "effectiveTo" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "generation_pricing_rules_taskType_name_key" ON "generation_pricing_rules"("taskType", "name")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_taskType_isActive_idx" ON "generation_pricing_rules"("taskType", "isActive")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_modelProvider_modelName_idx" ON "generation_pricing_rules"("modelProvider", "modelName")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_modelTier_idx" ON "generation_pricing_rules"("modelTier")');
    await client.query('CREATE INDEX IF NOT EXISTS "generation_pricing_rules_effectiveFrom_effectiveTo_idx" ON "generation_pricing_rules"("effectiveFrom", "effectiveTo")');

    for (const rule of pricingRules) {
      await client.query(
        `
        INSERT INTO "generation_pricing_rules" (
          "id", "taskType", "name", "baseUnit", "baseCost", "quality", "resolution",
          "modelTier", "inputTokenCostPerK", "outputTokenCostPerK", "contextTokenCostPerK",
          "reasoningMultiplier", "toolCallCost", "batchUnitCost", "referenceImageFixedCost",
          "referenceImageMultiplier", "videoInputMultiplier", "audioInputMultiplier",
          "fixedExtraCost", "updatedAt"
        )
        VALUES ($1, $2, $3, $4::"PricingBaseUnit", $5, $6, $7, $8::"PricingModelTier", $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
        ON CONFLICT ("taskType", "name") DO UPDATE SET
          "baseUnit" = EXCLUDED."baseUnit",
          "baseCost" = EXCLUDED."baseCost",
          "quality" = EXCLUDED."quality",
          "resolution" = EXCLUDED."resolution",
          "modelTier" = EXCLUDED."modelTier",
          "inputTokenCostPerK" = EXCLUDED."inputTokenCostPerK",
          "outputTokenCostPerK" = EXCLUDED."outputTokenCostPerK",
          "contextTokenCostPerK" = EXCLUDED."contextTokenCostPerK",
          "reasoningMultiplier" = EXCLUDED."reasoningMultiplier",
          "toolCallCost" = EXCLUDED."toolCallCost",
          "batchUnitCost" = EXCLUDED."batchUnitCost",
          "referenceImageFixedCost" = EXCLUDED."referenceImageFixedCost",
          "referenceImageMultiplier" = EXCLUDED."referenceImageMultiplier",
          "videoInputMultiplier" = EXCLUDED."videoInputMultiplier",
          "audioInputMultiplier" = EXCLUDED."audioInputMultiplier",
          "fixedExtraCost" = EXCLUDED."fixedExtraCost",
          "isActive" = true,
          "updatedAt" = CURRENT_TIMESTAMP
        `,
        [
          `pricing_${randomUUID()}`,
          rule.taskType,
          rule.name,
          rule.baseUnit,
          rule.baseCost,
          rule.quality ?? null,
          rule.resolution ?? null,
          rule.modelTier ?? null,
          rule.inputTokenCostPerK ?? null,
          rule.outputTokenCostPerK ?? null,
          rule.contextTokenCostPerK ?? null,
          rule.reasoningMultiplier ?? 1,
          rule.toolCallCost ?? null,
          rule.batchUnitCost ?? null,
          rule.referenceImageFixedCost ?? null,
          rule.referenceImageMultiplier ?? null,
          rule.videoInputMultiplier ?? null,
          rule.audioInputMultiplier ?? null,
          rule.fixedExtraCost ?? 0,
        ],
      );
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
