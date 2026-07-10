import {
  MODEL_PRESETS,
  TASK_PRESETS,
  validateParamsSchema,
  validatePricingSchema,
  type ModelPresetKey,
  type ParamsSchema,
  type PricingSchema,
} from '@autix/domain/pricing';
import { createPrismaClient } from './db';

// Prisma 7 要求显式传 driver adapter。项目已有的 createPrismaClient()
// 封装了 PrismaPg + getDatabaseUrl()，裸 new PrismaClient() 跑不起来。
const prisma = createPrismaClient();

/**
 * 按模型行的 type / capabilities 判定它该用哪个 preset。
 * chat 层级取自 metadata.tier，缺省视为 standard。
 */
function presetKeyFor(model: {
  type: string;
  capabilities: string[];
  metadata: unknown;
}): ModelPresetKey | null {
  if (model.type === 'video' || model.capabilities.includes('video')) return 'video';
  if (model.capabilities.includes('image') && !model.capabilities.includes('text')) return 'image';
  if (model.type === 'embedding') return null;

  const tier = (model.metadata as { tier?: string } | null)?.tier;
  if (tier === 'fast') return 'chat_fast';
  if (tier === 'pro_reasoning') return 'chat_reasoning';
  return 'chat_standard';
}

async function seedTasks() {
  for (const [index, task] of TASK_PRESETS.entries()) {
    await prisma.task_definitions.upsert({
      where: { taskType: task.taskType },
      update: {
        name: task.name,
        category: task.category,
        fixedCostSchema: task.fixedCostSchema ?? undefined,
        sort: index * 10,
      },
      create: {
        taskType: task.taskType,
        name: task.name,
        category: task.category,
        fixedCostSchema: task.fixedCostSchema ?? undefined,
        sort: index * 10,
      },
    });
  }
  console.log(`seeded ${TASK_PRESETS.length} task definitions`);
}

async function seedModelSchemas() {
  const models = await prisma.model_configs.findMany({
    select: { id: true, name: true, type: true, capabilities: true, metadata: true },
  });

  const assigned = new Map<string, ModelPresetKey>();
  /** 不参与计费的模型（embedding 等）。显式登记，不靠「恰好没人给它估价」来保证安全。 */
  const skipped = new Set<string>();

  for (const model of models) {
    const key = presetKeyFor(model);
    if (!key) {
      skipped.add(model.id);
      console.log(`skip ${model.name} (no pricing preset)`);
      continue;
    }
    const preset = MODEL_PRESETS[key];
    await prisma.model_configs.update({
      where: { id: model.id },
      data: {
        paramsSchema: preset.paramsSchema as object,
        pricingSchema: preset.pricingSchema as object,
        schemaVersion: 1,
      },
    });
    assigned.set(model.id, key);
    console.log(`${model.name} -> ${key}`);
  }

  return { assigned, skipped };
}

async function seedBindings(assigned: Map<string, ModelPresetKey>) {
  let count = 0;
  for (const task of TASK_PRESETS) {
    const eligible = [...assigned.entries()].filter(([, key]) => task.modelPresets.includes(key));

    for (const [index, [modelConfigId]] of eligible.entries()) {
      await prisma.task_model_bindings.upsert({
        where: { taskType_modelConfigId: { taskType: task.taskType, modelConfigId } },
        update: {}, // 幂等：已存在的绑定不覆盖运营调过的 multiplier
        create: {
          taskType: task.taskType,
          modelConfigId,
          multiplier: 1.0,
          isDefault: index === 0,
          sort: index * 10,
        },
      });
      count += 1;
    }
  }
  console.log(`seeded ${count} task-model bindings`);
}

/**
 * 迁移给 paramsSchema / pricingSchema 填的默认值是 '{}' 与 '{"terms":[]}' ——
 * 合法 JSON，但 validatePricingSchema() 会以 EMPTY_TERMS 拒绝。
 *
 * 一个带 {"terms":[]} 的模型会让 evaluatePricing 返回 total: 0 —— 用户免费生成。
 * 这比报错严重得多，且不会有人来报 bug。所以 seed 完必须断言全量有效。
 */
async function assertAllActiveModelsValid(skipped: Set<string>) {
  const models = await prisma.model_configs.findMany({
    where: { isActive: true },
    select: { id: true, name: true, paramsSchema: true, pricingSchema: true },
  });

  const broken: string[] = [];
  for (const model of models) {
    if (skipped.has(model.id)) continue; // embedding 等不参与计费的模型

    const params = model.paramsSchema as unknown as ParamsSchema;
    const pricing = model.pricingSchema as unknown as PricingSchema;
    const violations = [
      ...validatePricingSchema(pricing),
      ...validateParamsSchema(params, pricing),
    ];
    if (violations.length > 0) {
      broken.push(`${model.name}: ${violations.map((v) => v.code).join(', ')}`);
    }
  }

  if (broken.length > 0) {
    console.error('以下活跃模型的 schema 无效：');
    for (const line of broken) console.error(`  - ${line}`);
    throw new Error(`${broken.length} 个活跃模型带着无效 schema，拒绝完成 seed`);
  }
  console.log(`validated ${models.length - skipped.size} active model schemas`);
}

async function main() {
  await seedTasks();
  const { assigned, skipped } = await seedModelSchemas();
  await seedBindings(assigned);
  await assertAllActiveModelsValid(skipped);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
