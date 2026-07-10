import { Prisma } from '@autix/database';
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
 * PricingSchema 是 @autix/domain 里自定义的领域类型，没有索引签名，所以结构上
 * 不满足 Prisma 的 InputJsonObject（要求 `[key: string]: InputJsonValue`）。
 * 运行时形状完全就是普通可枚举 JSON，两者没有真实分歧——差异纯粹是 TS 记名
 * 边界。不用 `as any`/`as unknown as` 抹掉这个不匹配，而是走一次显式的
 * JSON round-trip：序列化再反解析，产出一个结构上必然满足 InputJsonValue
 * 的裸对象，再声明它就是 InputJsonValue。
 */
function toInputJson(value: PricingSchema): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * 按模型行的 type / capabilities 判定它该用哪个 preset（spec §3.1.1.6）。
 * metadata.tier 概念已废弃——线上 13 个模型没有一个设置过它，分档从未生效。
 */
function presetKeyFor(model: {
  type: string;
  capabilities: string[];
}): ModelPresetKey | null {
  if (model.type === 'video' || model.capabilities.includes('video')) return 'video';
  if (model.capabilities.includes('image') && !model.capabilities.includes('text')) return 'image';
  if (model.type === 'embedding') return null;
  return 'text';
}

async function seedTasks() {
  for (const [index, task] of TASK_PRESETS.entries()) {
    const fixedCostSchema = task.fixedCostSchema ? toInputJson(task.fixedCostSchema) : Prisma.JsonNull;
    await prisma.task_definitions.upsert({
      where: { taskType: task.taskType },
      update: {
        name: task.name,
        category: task.category,
        fixedCostSchema,
        isActive: task.isActive,
        sort: index * 10,
      },
      create: {
        taskType: task.taskType,
        name: task.name,
        category: task.category,
        fixedCostSchema,
        isActive: task.isActive,
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
    // 非活跃任务（无可用模型档位，如 chat_message_fast / chat_message_reasoning）
    // 不建绑定——spec §3.1.1.7：它们本就没有模型可绑。
    if (!task.isActive) continue;

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

/**
 * spec §3.1.1.7：每个 isActive=true 的任务必须至少有 1 个绑定，且恰好 1 个
 * isDefault=true 的绑定。缺了这条断言，"活跃任务零绑定" 会一路拖到第二期
 * 上线——那时查不到绑定就 400，用户对该任务的每次调用都会报错，而 seed
 * 时本可以炸得清清楚楚。chat_message_fast / chat_message_reasoning 是
 * isActive=false，天然没有模型可绑，被排除在断言之外。
 */
async function assertActiveTasksHaveDefaultBinding() {
  const tasks = await prisma.task_definitions.findMany({
    where: { isActive: true },
    select: {
      taskType: true,
      bindings: { where: { isActive: true }, select: { isDefault: true } },
    },
  });

  const offenders: string[] = [];
  for (const task of tasks) {
    const activeBindings = task.bindings;
    const defaultCount = activeBindings.filter((b) => b.isDefault).length;
    if (activeBindings.length === 0) {
      offenders.push(`${task.taskType}: 0 个活跃绑定`);
    } else if (defaultCount !== 1) {
      offenders.push(`${task.taskType}: ${activeBindings.length} 个活跃绑定，但 ${defaultCount} 个 isDefault（应为 1）`);
    }
  }

  if (offenders.length > 0) {
    console.error('以下活跃任务的绑定不满足「至少 1 个绑定 + 恰好 1 个默认」：');
    for (const line of offenders) console.error(`  - ${line}`);
    throw new Error(`${offenders.length} 个活跃任务的绑定不合法，拒绝完成 seed`);
  }
  console.log(`validated ${tasks.length} active tasks each have exactly one default binding`);
}

async function main() {
  await seedTasks();
  const { assigned, skipped } = await seedModelSchemas();
  await seedBindings(assigned);
  await assertAllActiveModelsValid(skipped);
  await assertActiveTasksHaveDefaultBinding();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
