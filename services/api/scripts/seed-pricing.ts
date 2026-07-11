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

const SEED_MODELS: SeedModelRow[] = [
  // —— 对话 / 文本（text preset）——
  // 覆盖各家主流对话模型系列。model-id 按当前主流命名给出，运营需按 amux 网关真实
  // model-id 核对/调整（网关命名可能带日期或厂商前缀）。全部走 text preset（token 计价）。
  // OpenAI GPT 系列
  { name: 'GPT-5.6', provider: 'amux', model: 'gpt-5.6', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI flagship chat model', 'zh-CN': 'OpenAI 旗舰对话模型' } },
  { name: 'GPT-5.5', provider: 'amux', model: 'gpt-5.5', type: 'general', capabilities: ['text', 'vision'], isDefault: true, metadata: {}, description: { en: 'OpenAI chat model', 'zh-CN': 'OpenAI 对话模型' } },
  { name: 'GPT-5', provider: 'amux', model: 'gpt-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI chat model', 'zh-CN': 'OpenAI 对话模型' } },
  { name: 'GPT-4o', provider: 'amux', model: 'gpt-4o', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI multimodal chat model', 'zh-CN': 'OpenAI 多模态对话模型' } },
  { name: 'GPT-4o mini', provider: 'amux', model: 'gpt-4o-mini', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI lightweight chat model', 'zh-CN': 'OpenAI 轻量对话模型' } },
  // Anthropic Claude 系列
  { name: 'Claude Opus 4.8', provider: 'amux', model: 'claude-opus-4.8', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Anthropic flagship model', 'zh-CN': 'Anthropic 旗舰模型' } },
  { name: 'Claude Sonnet 5', provider: 'amux', model: 'claude-sonnet-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic balanced model', 'zh-CN': 'Anthropic 均衡模型' } },
  { name: 'Claude Haiku 4.5', provider: 'amux', model: 'claude-haiku-4.5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic fast model', 'zh-CN': 'Anthropic 快速模型' } },
  // DeepSeek 系列
  { name: 'DeepSeek V3', provider: 'amux', model: 'deepseek-chat', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'DeepSeek chat model', 'zh-CN': 'DeepSeek 对话模型' } },
  { name: 'DeepSeek R1', provider: 'amux', model: 'deepseek-reasoner', type: 'general', capabilities: ['text', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'DeepSeek reasoning model', 'zh-CN': 'DeepSeek 推理模型' } },
  // 智谱 GLM 系列
  { name: 'GLM-4.6', provider: 'amux', model: 'glm-4.6', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM model', 'zh-CN': '智谱 GLM 模型' } },
  { name: 'GLM-4.5 Air', provider: 'amux', model: 'glm-4.5-air', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM lightweight model', 'zh-CN': '智谱 GLM 轻量模型' } },
  // 其它主流系列
  { name: 'Gemini 3 Pro', provider: 'amux', model: 'gemini-3-pro', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Google Gemini model', 'zh-CN': 'Google Gemini 模型' } },
  { name: 'Qwen3 Max', provider: 'amux', model: 'qwen3-max', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen model', 'zh-CN': '阿里通义千问模型' } },
  { name: 'Grok 4', provider: 'amux', model: 'grok-4', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'xAI Grok model', 'zh-CN': 'xAI Grok 模型' } },
  { name: 'Kimi K2', provider: 'amux', model: 'kimi-k2', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Moonshot Kimi model', 'zh-CN': '月之暗面 Kimi 模型' } },

  // —— 图像（image preset）—— model-id 与线上一致；metadata.imageModelKind 给能力面板确定性识别
  { name: 'GPT Image 2', provider: 'amux', model: 'gpt-image-2', type: 'general', capabilities: ['image'], isDefault: true, metadata: { imageModelKind: 'gpt-image' }, description: { en: 'GPT image model', 'zh-CN': 'GPT 图像模型' } },
  { name: 'GPT Image 1', provider: 'amux', model: 'gpt-image-1', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'gpt-image' }, description: { en: 'GPT image model', 'zh-CN': 'GPT 图像模型' } },
  { name: 'Nano Banana', provider: 'amux', model: 'gemini-3.1-flash-image-preview', type: 'general', capabilities: ['image'], isDefault: false, metadata: { imageModelKind: 'gemini-3-flash-image' }, description: { en: 'Gemini flash image model', 'zh-CN': 'Gemini 快速图像模型' } },

  // —— 视频（video preset）—— 线上 model-id 前缀 doubao-seedance-*；metadata.videoModelKind 定档
  { name: 'Seedance 2.0', provider: 'amux', model: 'doubao-seedance-2.0-pro', type: 'video', capabilities: ['video'], isDefault: true, metadata: { videoModelKind: 'seedance-2.0' }, description: { en: 'Flagship video model', 'zh-CN': '旗舰视频模型' } },
  { name: 'Seedance 2.0 Fast', provider: 'amux', model: 'doubao-seedance-2.0-fast', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-2.0-fast' }, description: { en: 'Fast video model', 'zh-CN': '快速视频模型' } },
  { name: 'Seedance 2.0 Mini', provider: 'amux', model: 'doubao-seedance-2.0-mini', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-2.0-mini' }, description: { en: 'Lightweight video model', 'zh-CN': '轻量视频模型' } },
  { name: 'Seedance 1.5 Pro', provider: 'amux', model: 'doubao-seedance-1.5-pro', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-1.5-pro' }, description: { en: 'Video model', 'zh-CN': '视频模型' } },
  { name: 'Seedance 1.0 Pro', provider: 'amux', model: 'doubao-seedance-1.0-pro', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-1.0-pro' }, description: { en: 'Video model', 'zh-CN': '视频模型' } },
];

/**
 * 创建起步模型（不含 apiKey / baseUrl，运营手动补）。幂等：以 (provider, model) 为
 * 逻辑主键——已存在只刷新可安全重播的字段（name/type/capabilities/metadata/description），
 * **绝不覆盖运营已配的 apiKey / baseUrl / isDefault / isActive / priority**。
 * schema 不在这里写，交给紧随其后的 seedModelSchemas() 按 preset 统一填。
 */
async function seedModels() {
  let created = 0;
  let updated = 0;
  for (const m of SEED_MODELS) {
    const existing = await prisma.model_configs.findFirst({
      where: { provider: m.provider, model: m.model },
      select: { id: true },
    });
    if (existing) {
      await prisma.model_configs.update({
        where: { id: existing.id },
        data: {
          name: m.name,
          type: m.type,
          capabilities: m.capabilities,
          metadata: toInputJson(m.metadata),
          description: toInputJson(m.description),
        },
      });
      updated += 1;
    } else {
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
  }
  console.log(`models: created ${created}, updated ${updated} (apiKey/baseUrl left for ops)`);
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
