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
import { buildVideoParamsSchema } from './seed-pricing.schemas';
import { SEED_MODELS, DEFAULT_MULTIPLIER, IMAGE_MODEL_CONFIGS } from './seed-pricing.models';
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
function toInputJson(value: unknown): Prisma.InputJsonValue {
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

/**
 * 一次性强制刷新模型 schema（opt-in，默认关闭以保持非破坏性）。
 * 用于纠正「用旧的通用 paramsSchema 初始化过」的历史数据——那套 schema 把 quality 写死成
 * low/medium/high 且 required，导致 compatible(standard/hd)、gemini(无 quality) 模型在报价时
 * 被 ajv 拒、前端不显示积分。设 SEED_FORCE_MODEL_SCHEMAS=1 跑一次即可覆盖回 model 专属 schema。
 * ⚠ 会覆盖运营在 admin 手改过的 paramsSchema/pricingSchema，仅在明确需要纠正时用。
 */
const FORCE_MODEL_SCHEMAS = process.env.SEED_FORCE_MODEL_SCHEMAS === '1';

// SeedModelRow / SEED_MODELS / imageMetadataFor 已抽到 seed-pricing.models.ts（纯数据/纯函数，
// 可被 spec 单测直接 import；这个文件顶层会 createPrismaClient() 且末尾无条件跑 main()，
// 不能被测试 import）。

/**
 * 创建起步模型（不含 apiKey / baseUrl，运营手动补）。幂等：以 (provider, model) 为
 * 逻辑主键——库里还没有的才 create；已存在的行**严格只增不改**，唯一例外是补齐
 * **缺失的视频 metadata 键**（见下）。**绝不覆盖运营已配的 apiKey / baseUrl / isDefault /
 * isActive / priority / 及任何已有的 metadata 值**。
 * schema 不在这里写，交给紧随其后的 seedModelSchemas() 按 preset 统一填。
 */
async function seedModels() {
  let created = 0;
  const skipped: string[] = [];
  const backfilled: string[] = [];
  for (const m of SEED_MODELS) {
    // 以 model-id 去重（不限 provider）。
    const existing = await prisma.model_configs.findFirst({
      where: { model: m.model },
      select: { id: true, type: true, capabilities: true, metadata: true },
    });
    if (existing) {
      // 既存行默认整行不动。唯一例外：**视频模型补齐缺失的 metadata 键**。
      // 早于「模型声明 protocolKey」建的视频行 metadata 可能是 null / 缺 protocolKey /
      // 缺 videoModelKind —— 缺 protocolKey 会让 resolveVideoPreset 直接抛错、根本没法生成
      // （线上就这么漏过 doubao-seedance-2.0-fast）。这里只补 SEED_MODELS 声明里、既存行
      // **确实缺失**的键；已有键一律保留（{ ...seed, ...existing } → existing 覆盖 seed），
      // 绝不改运营手改过的值。仅限视频：image/text 各有独立路由，不在本次修复范围。
      const isVideo =
        existing.type === 'video' ||
        m.type === 'video' ||
        (existing.capabilities as string[]).includes('video') ||
        m.capabilities.includes('video');
      const seedMeta = (m.metadata ?? {}) as Record<string, unknown>;
      const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
      const missingKeys = isVideo
        ? Object.keys(seedMeta).filter((k) => existingMeta[k] === undefined)
        : [];
      if (missingKeys.length > 0) {
        await prisma.model_configs.update({
          where: { id: existing.id },
          data: { metadata: toInputJson({ ...seedMeta, ...existingMeta }) },
        });
        backfilled.push(`${m.model} (+${missingKeys.join('/')})`);
      } else {
        skipped.push(m.model);
      }
      continue;
    }
    await prisma.model_configs.create({
      data: {
        name: m.name,
        provider: m.provider,
        model: m.model,
        type: m.type,
        capabilities: m.capabilities,
        apiKey: null,
        baseUrl: null,
        isActive: true,
        isDefault: m.isDefault,
        visibility: 'public',
        metadata: toInputJson(m.metadata),
        description: toInputJson(m.description),
      },
    });
    created += 1;
  }
  console.log(`models: created ${created} new, skipped ${skipped.length} existing (untouched): ${skipped.join(', ')}`);
  if (backfilled.length > 0) {
    console.log(`  backfilled missing video metadata on ${backfilled.length}: ${backfilled.join(', ')}`);
  }
}

async function seedTasks() {
  for (const [index, task] of TASK_PRESETS.entries()) {
    const fixedCostSchema = task.fixedCostSchema ? toInputJson(task.fixedCostSchema) : Prisma.JsonNull;
    await prisma.task_definitions.upsert({
      where: { taskType: task.taskType },
      // 幂等且非破坏性：已存在的任务定义一律不覆盖——运营可能在 admin 调过
      // fixedCostSchema / isActive，seed 在每次启动都跑，绝不能把这些改动回退成 preset。
      // 只为「库里还没有的」任务补默认值(走 create)。
      update: {},
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

/**
 * 各图像/视频模型按官方定价折算的 pricingSchema（1 美元 = 500 积分，向上取整，2026-07 官网核对）。
 * 图像：**单张**积分(quality 或 resolution 查表)——生成张数(quantity)已从图像计价里移除，
 * 由业务逻辑在下单时按张数自行乘算，schema 只算一张的价；视频：每秒积分(resolution 查表) × duration。
 * 未列出的模型沿用 MODEL_PRESETS 的通用 pricingSchema。
 */
const MODEL_PRICING: Record<string, PricingSchema> = {
  // 图片模型的 pricingSchema **不在这里**——它和 paramsSchema / metadata 一样，
  // 由运营在 admin 模型配置页填、存 DB。每个模型的计价参数都不同（有的按分辨率档位
  // 查表、有的按质量、有的按张固定价），seed 写死一份只会覆盖运营配好的价。
  // —— 视频：每秒积分 × duration（原生化后计时参数即火山原生名 duration，非 seconds；
  //    若仍写 seconds，perUnit 取不到值 → 每秒费静默归零 → 整条视频少收费）——
  'doubao-seedance-2.0': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '480p': 46, '720p': 100, '1080p': 255, '4k': 510 } } },
      { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
    ],
  },
  'doubao-seedance-2.0-fast': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '480p': 37, '720p': 81, '1080p': 205, '4k': 410 } } },
      { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
    ],
  },
};


/** 按 preset 归类为对应 model 生成 paramsSchema（text 无能力差异，沿用通用 preset）。 */
function paramsSchemaFor(
  key: ModelPresetKey,
  model: { provider?: string | null; model: string; metadata: unknown },
): ParamsSchema {
  if (key === 'video') return buildVideoParamsSchema(model);
  return MODEL_PRESETS[key].paramsSchema;
}

async function seedModelSchemas() {
  const models = await prisma.model_configs.findMany({
    select: {
      id: true,
      name: true,
      provider: true,
      model: true,
      type: true,
      capabilities: true,
      metadata: true,
      paramsSchema: true,
      pricingSchema: true,
    },
  });

  /** 不参与计费的模型（embedding 等）。显式登记，不靠「恰好没人给它估价」来保证安全。 */
  const skipped = new Set<string>();

  for (const model of models) {
    const key = presetKeyFor(model);
    if (!key) {
      skipped.add(model.id);
      console.log(`skip ${model.name} (no pricing preset)`);
      continue;
    }

    // 非破坏性：只为「schema 尚未配置(任一为 null)」的模型补默认值。已有 schema
    // (运营在 admin 改过价 / 上一次 seed 填过)一律不覆盖——seed 每次启动都跑，绝不能
    // 把后台改价回退成 preset、把 schemaVersion 重置成 1。
    // 例外：SEED_FORCE_MODEL_SCHEMAS=1 时强制刷新（纠正历史通用 schema，见常量注释），
    // 但**只作用于 image/video**：受历史通用 schema bug 影响的就是这两类(quality 档位/
    // 分辨率不匹配)；text 模型走统一 text preset、无 per-model 差异，且更可能被运营调过
    // token 计价，故即使 force 也不动它们，避免误伤。
    // 图片模型：paramsSchema / pricingSchema 按 model-id 从 IMAGE_MODEL_CONFIGS 写全量
    // （metadata 已在 seedModels() 建行时写入）。逐模型 schema 不同，故不共用通用 image preset。
    // 非破坏性：已配置过的行（运营在 admin 改过价）默认不覆盖；SEED_FORCE_MODEL_SCHEMAS=1 才强刷。
    // model-id 不在 IMAGE_MODEL_CONFIGS 里的图片模型（运营自建、seed 未收录）跳过，交给 admin 配置。
    if (key === 'image') {
      const cfg = IMAGE_MODEL_CONFIGS[model.model];
      if (!cfg) {
        skipped.add(model.id);
        console.log(`skip ${model.name} (image: no seed schema for model-id ${model.model})`);
        continue;
      }
      const alreadyConfigured = model.paramsSchema !== null && model.pricingSchema !== null;
      if (alreadyConfigured && !FORCE_MODEL_SCHEMAS) continue;
      await prisma.model_configs.update({
        where: { id: model.id },
        data: {
          paramsSchema: toInputJson(cfg.paramsSchema),
          pricingSchema: toInputJson(cfg.pricingSchema),
        },
      });
      console.log(`${model.name} -> image [${alreadyConfigured ? 'force-refreshed schema' : 'filled empty schema'}]`);
      continue;
    }

    const alreadyConfigured = model.paramsSchema !== null && model.pricingSchema !== null;
    const forceThis = FORCE_MODEL_SCHEMAS && key !== 'text';
    if (alreadyConfigured && !forceThis) {
      continue;
    }
    const preset = MODEL_PRESETS[key];
    const pricingOverride = MODEL_PRICING[model.model];
    // paramsSchema 按模型真实能力生成（quality 轴/分辨率档位/单张上限各不相同），
    // 不再对所有 image/video 模型写同一套通用 schema。
    const paramsSchema = paramsSchemaFor(key, model);
    await prisma.model_configs.update({
      where: { id: model.id },
      data: {
        paramsSchema: toInputJson(paramsSchema),
        pricingSchema: pricingOverride ? toInputJson(pricingOverride) : (preset.pricingSchema as object),
      },
    });
    const action = alreadyConfigured ? 'force-refreshed schema' : 'filled empty schema';
    console.log(`${model.name} -> ${key}${pricingOverride ? ' [per-model pricing]' : ''} [${action}]`);
  }

  return { skipped };
}

async function seedBindings() {
  // 绑定候选**只取 active + public 的模型**，且按确定性顺序排列：
  //  - 匿名公开接口会过滤 private/inactive 模型，但「无 model-id 的估价」会落到任务的
  //    默认绑定——若默认是隐藏模型，公开报价就会用一个用户根本选不到的模型算价。
  //  - findMany 不带 orderBy 时行序不稳定，"第一个即默认" 会让默认模型随机漂移。
  // isDefault desc 让运营标记的旗舰模型优先当默认，createdAt asc 兜底稳定复现。
  // 只保留 schema 已配好的模型（paramsSchema / pricingSchema 均非 null），避免把没法
  // 计价的模型绑上去。
  const candidates = await prisma.model_configs.findMany({
    where: { isActive: true, visibility: 'public' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      type: true,
      capabilities: true,
      paramsSchema: true,
      pricingSchema: true,
    },
  });

  const priced = candidates
    .filter((m) => m.paramsSchema !== null && m.pricingSchema !== null)
    .map((m) => ({ id: m.id, key: presetKeyFor(m) }))
    .filter((m): m is { id: string; key: ModelPresetKey } => m.key !== null);

  let count = 0;
  for (const task of TASK_PRESETS) {
    // 非活跃任务（无可用模型档位，如 chat_message_fast / chat_message_reasoning）
    // 不建绑定——spec §3.1.1.7：它们本就没有模型可绑。
    if (!task.isActive) continue;

    const eligible = priced.filter((m) => task.modelPresets.includes(m.key));

    // 该任务是否已经有默认绑定？有则本次不再设默认，避免与 one-default-per-task 的
    // 局部唯一索引冲突（P2002）——运营/上一次 seed 已选的默认模型保持不变。
    const existingDefault = await prisma.task_model_bindings.findFirst({
      where: { taskType: task.taskType, isDefault: true },
      select: { modelConfigId: true },
    });
    let defaultAssigned = existingDefault !== null;

    for (const [index, model] of eligible.entries()) {
      // eligible 已按 isDefault desc / createdAt asc 排好序，index === 0 即优先级最高者。
      const makeDefault = !defaultAssigned && index === 0;
      await prisma.task_model_bindings.upsert({
        where: { taskType_modelConfigId: { taskType: task.taskType, modelConfigId: model.id } },
        update: {}, // 幂等：已存在的绑定不覆盖运营调过的 multiplier / isDefault
        create: {
          taskType: task.taskType,
          modelConfigId: model.id,
          // 默认加价倍率：cost = ceil(modelPrice × multiplier × discountFactor) + taskFixedCost。
          // 2 = 在原始供应商成本上加 100% 毛利；运营可在 admin 按任务/模型逐条调整或后期打折。
          multiplier: DEFAULT_MULTIPLIER,
          isDefault: makeDefault,
          sort: index * 10,
        },
      });
      if (makeDefault) defaultAssigned = true;
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
  await seedModels();
  // 排在 seedModelSchemas() 之前：存量模型（seedModels() 因已存在而跳过创建的那些）
  // 也要拿到 protocolKey/operations/limits，否则 preset 路由（Task 9）在它们身上永远
  // 读不到 protocolKey，只能走「未注册」报错。
  await seedTasks();
  const { skipped } = await seedModelSchemas();
  // seedBindings 自行按 active/public + 确定性排序查候选，不再依赖 seedModelSchemas
  // 的（无序）assigned 集合来选默认模型。
  await seedBindings();
  await assertAllActiveModelsValid(skipped);
  await assertActiveTasksHaveDefaultBinding();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
