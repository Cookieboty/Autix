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
 * 起步模型目录。型号取自 domain 的能力表（image/video capabilities.ts 里真实登记的
 * kind）与 seed-prod 的首页任务（Nano Banana Pro / Seedance 2.0）。**不写 apiKey /
 * baseUrl**——密钥与网关地址由运营在 admin「模型配置」页手动补充。model-id 的 amux/
 * 前缀只是占位命名，运营按真实网关改。
 *
 * type + capabilities 决定 presetKeyFor 的归类（→ text / image / video preset）；
 * metadata.imageModelKind / videoModelKind 给能力面板（尺寸/分辨率）做确定性识别，
 * 避免 model-id 变了之后识别不出档位。
 */
interface SeedModelRow {
  name: string;
  provider: string;
  model: string;
  type: 'general' | 'video';
  capabilities: string[];
  isDefault: boolean;
  metadata: Record<string, unknown>;
  description: Record<string, string>;
}

/** 任务-模型绑定的默认加价倍率（2 = 原始成本上加 100% 毛利）。运营可逐条调整。 */
const DEFAULT_MULTIPLIER = 2;

const SEED_MODELS: SeedModelRow[] = [
  // —— 对话 / 文本（text preset）——
  // 各家主流对话模型系列。model-id 按 2026-07 官网核对的当前版本给出（见提交说明的来源），
  // 但 amux 网关的实际 id 命名可能不同（前缀/日期后缀），运营需按 amux 的 /models 清单最终核对。
  // 全部走 text preset（token 计价）。
  // OpenAI GPT-5.6（Sol/Terra/Luna 三档）+ 5.5
  { name: 'GPT-5.6 Sol', provider: 'amux', model: 'gpt-5.6-sol', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: true, metadata: {}, description: { en: 'OpenAI flagship model', 'zh-CN': 'OpenAI 旗舰模型' } },
  { name: 'GPT-5.6 Terra', provider: 'amux', model: 'gpt-5.6-terra', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI balanced model', 'zh-CN': 'OpenAI 均衡模型' } },
  { name: 'GPT-5.6 Luna', provider: 'amux', model: 'gpt-5.6-luna', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI fast / low-cost model', 'zh-CN': 'OpenAI 快速经济模型' } },
  { name: 'GPT-5.5', provider: 'amux', model: 'gpt-5.5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI previous-gen chat model', 'zh-CN': 'OpenAI 上一代对话模型' } },
  // Anthropic Claude（Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5，id 用连字符）
  { name: 'Claude Fable 5', provider: 'amux', model: 'claude-fable-5', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Anthropic top-tier model', 'zh-CN': 'Anthropic 顶级模型' } },
  { name: 'Claude Opus 4.8', provider: 'amux', model: 'claude-opus-4-8', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Anthropic flagship model', 'zh-CN': 'Anthropic 旗舰模型' } },
  { name: 'Claude Sonnet 5', provider: 'amux', model: 'claude-sonnet-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic balanced model', 'zh-CN': 'Anthropic 均衡模型' } },
  { name: 'Claude Haiku 4.5', provider: 'amux', model: 'claude-haiku-4-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic fast model', 'zh-CN': 'Anthropic 快速模型' } },
  // DeepSeek V4（chat/reasoner 于 2026-07-24 弃用，改用 v4-pro/flash）
  { name: 'DeepSeek V4 Pro', provider: 'amux', model: 'deepseek-v4-pro', type: 'general', capabilities: ['text', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'DeepSeek high-quality model', 'zh-CN': 'DeepSeek 高质量模型' } },
  { name: 'DeepSeek V4 Flash', provider: 'amux', model: 'deepseek-v4-flash', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'DeepSeek fast model', 'zh-CN': 'DeepSeek 快速模型' } },
  // 智谱 GLM 5.2 / 5.1
  { name: 'GLM-5.2', provider: 'amux', model: 'glm-5.2', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM flagship model', 'zh-CN': '智谱 GLM 旗舰模型' } },
  { name: 'GLM-5.1', provider: 'amux', model: 'glm-5.1', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM model', 'zh-CN': '智谱 GLM 模型' } },
  // Google Gemini 3.5
  { name: 'Gemini 3.5 Pro', provider: 'amux', model: 'gemini-3.5-pro', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Google Gemini flagship model', 'zh-CN': 'Google Gemini 旗舰模型' } },
  { name: 'Gemini 3.5 Flash', provider: 'amux', model: 'gemini-3.5-flash', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Google Gemini fast model', 'zh-CN': 'Google Gemini 快速模型' } },
  // 阿里 Qwen 3.7
  { name: 'Qwen3.7 Max', provider: 'amux', model: 'qwen3.7-max', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen flagship model', 'zh-CN': '阿里通义千问旗舰模型' } },
  { name: 'Qwen3.7 Plus', provider: 'amux', model: 'qwen3.7-plus', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen multimodal model', 'zh-CN': '阿里通义千问多模态模型' } },
  // Moonshot Kimi K2.6 / xAI Grok 4.3
  { name: 'Kimi K2.6', provider: 'amux', model: 'kimi-k2.6', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Moonshot Kimi model', 'zh-CN': '月之暗面 Kimi 模型' } },
  { name: 'Grok 4.3', provider: 'amux', model: 'grok-4.3', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'xAI Grok model', 'zh-CN': 'xAI Grok 模型' } },

  // —— 图像（image preset）—— 主流图像模型，model-id 按 2026-07 官网核对（见提交说明来源），
  // amux 网关实际 id 以其 /models 清单为准。metadata.imageModelKind 给能力面板确定性识别。
  { name: 'GPT Image 2', provider: 'amux', model: 'gpt-image-2', type: 'general', capabilities: ['image'], isDefault: true, metadata: { imageModelKind: 'gpt-image' }, description: { en: 'OpenAI image model', 'zh-CN': 'OpenAI 图像模型' } },
  { name: 'Nano Banana Fast', provider: 'amux', model: 'gemini-3.1-flash-image-preview', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'gemini-3-flash-image' }, description: { en: 'Nano Banana Fast', 'zh-CN': 'Nano Banana Fast' } },
  { name: 'Nano Banana 2 Lite', provider: 'amux', model: 'gemini-3.1-flash-lite-image', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'gemini-3-flash-image' }, description: { en: 'Nano Banana 2 Lite', 'zh-CN': 'Nano Banana 2 Lite' } },
  { name: 'Seedream 5.0 Pro', provider: 'amux', model: 'doubao-seedream-5-0-260128', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'compatible' }, description: { en: 'ByteDance Seedream image model', 'zh-CN': '字节 Seedream 图像模型' } },
  { name: 'Qwen-Image 2.0', provider: 'amux', model: 'qwen-image-2.0', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'compatible' }, description: { en: 'Alibaba Qwen image model', 'zh-CN': '阿里通义万相图像模型' } },

  // —— 视频（video preset）—— 只保留 Seedance 2.0 系列（线上真实 id）；metadata.videoModelKind 定档
  { name: 'Seedance 2.0', provider: 'amux', model: 'doubao-seedance-2.0', type: 'video', capabilities: ['video'], isDefault: true, metadata: { videoModelKind: 'seedance-2.0' }, description: { en: 'Seedance video model', 'zh-CN': 'Seedance 视频模型' } },
  { name: 'Seedance 2.0 Fast', provider: 'amux', model: 'doubao-seedance-2.0-fast', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-2.0-fast' }, description: { en: 'Seedance fast video model', 'zh-CN': 'Seedance 快速视频模型' } },
];

/**
 * 创建起步模型（不含 apiKey / baseUrl，运营手动补）。幂等：以 (provider, model) 为
 * 逻辑主键——已存在只刷新可安全重播的字段（name/type/capabilities/metadata/description），
 * **绝不覆盖运营已配的 apiKey / baseUrl / isDefault / isActive / priority**。
 * schema 不在这里写，交给紧随其后的 seedModelSchemas() 按 preset 统一填。
 */
async function seedModels() {
  let created = 0;
  const skipped: string[] = [];
  for (const m of SEED_MODELS) {
    // 严格「只增不改」：以 model-id 去重（不限 provider）。已存在同 model-id 的行一律**跳过**，
    // 绝不覆盖运营配过的 name/capabilities/apiKey/baseUrl/metadata/description/isDefault。
    // 起步模型只负责补齐「库里还没有的」，让运营已有配置完全不受影响。
    const existing = await prisma.model_configs.findFirst({
      where: { model: m.model },
      select: { id: true },
    });
    if (existing) {
      skipped.push(m.model);
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

/**
 * 各图像/视频模型按官方定价折算的 pricingSchema（1 美元 = 500 积分，向上取整，2026-07 官网核对）。
 * 图像：单张积分(quality 或 resolution 查表) × quantity；视频：每秒积分(resolution 查表) × seconds。
 * 未列出的模型沿用 MODEL_PRESETS 的通用 pricingSchema。
 */
const MODEL_PRICING: Record<string, PricingSchema> = {
  // —— 图像：单张积分 × quantity ——
  'gpt-image-2': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'quality', op: 'add', table: { param: 'quality', values: { low: 3, medium: 27, high: 106 } } },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  'gemini-3.1-flash-image-preview': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '512px': 23, '1K': 34, '2K': 51, '4K': 75 } } },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  'gemini-3.1-flash-lite-image': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '512px': 12, '1K': 17, '2K': 26, '4K': 38 } } },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  'doubao-seedream-5-0-260128': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '512px': 23, '1K': 23, '2K': 23, '4K': 45 } } },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  'qwen-image-2.0': {
    terms: [
      { id: 'perImage', op: 'add', const: 20 },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  'MiniMax-Image-01': {
    terms: [
      { id: 'perImage', op: 'add', const: 15 },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
    ],
  },
  // —— 视频：每秒积分 × seconds ——
  'doubao-seedance-2.0': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '480p': 46, '720p': 100, '1080p': 255, '4k': 510 } } },
      { id: 'seconds', op: 'mul', perUnit: { param: 'seconds', unitCost: 1 } },
    ],
  },
  'doubao-seedance-2.0-fast': {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '480p': 37, '720p': 81, '1080p': 205, '4k': 410 } } },
      { id: 'seconds', op: 'mul', perUnit: { param: 'seconds', unitCost: 1 } },
    ],
  },
};

async function seedModelSchemas() {
  const models = await prisma.model_configs.findMany({
    select: { id: true, name: true, model: true, type: true, capabilities: true, metadata: true },
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
    const pricingOverride = MODEL_PRICING[model.model];
    await prisma.model_configs.update({
      where: { id: model.id },
      data: {
        paramsSchema: preset.paramsSchema as object,
        pricingSchema: pricingOverride ? toInputJson(pricingOverride) : (preset.pricingSchema as object),
        schemaVersion: 1,
      },
    });
    assigned.set(model.id, key);
    console.log(`${model.name} -> ${key}${pricingOverride ? ' [per-model pricing]' : ''}`);
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

    // 该任务是否已经有默认绑定？有则本次不再设默认，避免与 one-default-per-task 的
    // 局部唯一索引冲突（P2002）——运营/上一次 seed 已选的默认模型保持不变。
    const existingDefault = await prisma.task_model_bindings.findFirst({
      where: { taskType: task.taskType, isDefault: true },
      select: { modelConfigId: true },
    });
    let defaultAssigned = existingDefault !== null;

    for (const [index, [modelConfigId]] of eligible.entries()) {
      const makeDefault = !defaultAssigned && index === 0;
      await prisma.task_model_bindings.upsert({
        where: { taskType_modelConfigId: { taskType: task.taskType, modelConfigId } },
        update: {}, // 幂等：已存在的绑定不覆盖运营调过的 multiplier / isDefault
        create: {
          taskType: task.taskType,
          modelConfigId,
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
