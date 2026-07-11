#!/usr/bin/env bun
/**
 * 初始模型种子（seed-models）
 * ---------------------------------------------------------------------------
 * 为新计费引擎播下一组「起步模型」：每个模型带上对应 preset 的 paramsSchema /
 * pricingSchema（来自 @autix/domain/pricing 的 MODEL_PRESETS），但**不写 apiKey，
 * 也不写 baseUrl**——密钥与网关地址由运营在 admin「模型配置」页手动补充。
 *
 * 幂等：以 (provider, model) 为逻辑主键。
 *   - 不存在  → 创建（apiKey / baseUrl 置空，等运营填）
 *   - 已存在  → 只更新 name / type / capabilities / 两个 schema / description，
 *              **绝不覆盖运营已经配过的 apiKey / baseUrl / isDefault / isActive / priority**
 *
 * 起步集合只含三档各一个默认模型（text / image / video），运营可在此基础上增删。
 * 这里的 model-id（amux/…）只是占位命名，运营应改成自己网关里的真实 model-id。
 *
 * 用法：
 *   dotenv -e .env -- bun run services/api/scripts/seed-models.ts
 *   之后再跑 seed-pricing 建任务定义与 task_model_bindings：
 *   dotenv -e .env -- bun run services/api/scripts/seed-pricing.ts
 */

import { Prisma } from '@autix/database';
import {
  MODEL_PRESETS,
  validateParamsSchema,
  validatePricingSchema,
  type ModelPresetKey,
} from '@autix/domain/pricing';
import { createPrismaClient } from './db';

const prisma = createPrismaClient();

/**
 * 领域类型（ParamsSchema / PricingSchema）没有索引签名，结构上不满足 Prisma 的
 * InputJsonValue。运行时形状就是普通 JSON，走一次 JSON round-trip 产出裸对象，
 * 避免 `as any`。与 seed-pricing.ts 的同名 helper 一致。
 */
function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

interface SeedModel {
  /** 展示名（admin 列表里看到的） */
  name: string;
  /** OpenAI 兼容协议一律 'openai'；其它自定义 provider 按实际填 */
  provider: string;
  /** 网关里的 model-id（占位，运营按真实网关改） */
  model: string;
  /** ModelType：general | code | intent | embedding | video */
  type: 'general' | 'video';
  /** 能力标签，决定 presetKeyFor 的归类（'text' | 'image' | 'video' | 'vision'） */
  capabilities: string[];
  /** 用哪一档 preset 的 schema */
  presetKey: ModelPresetKey;
  /** 是否设为该品类默认模型（仅首次创建时生效，之后不覆盖运营的选择） */
  isDefault: boolean;
  /** 多语言简介 */
  description: Record<string, string>;
}

/**
 * 起步模型集合——每档一个默认。model-id 用 amux/ 前缀只是占位命名，
 * 运营在 admin 里改成真实网关 model-id 并补 apiKey / baseUrl 即可上线。
 */
const SEED_MODELS: SeedModel[] = [
  {
    name: 'GPT-5.5',
    provider: 'openai',
    model: 'amux/gpt-5.5',
    type: 'general',
    capabilities: ['text', 'vision'],
    presetKey: 'text',
    isDefault: true,
    description: { en: 'General chat / text model', 'zh-CN': '通用对话 / 文本模型' },
  },
  {
    name: 'Gemini 3 Pro Image',
    provider: 'openai',
    model: 'amux/gemini-3-pro-image',
    type: 'general',
    capabilities: ['image'],
    presetKey: 'image',
    isDefault: true,
    description: { en: 'Image generation model', 'zh-CN': '图像生成模型' },
  },
  {
    name: 'Seedance Video',
    provider: 'openai',
    model: 'amux/seedance-1.0',
    type: 'video',
    capabilities: ['video'],
    presetKey: 'video',
    isDefault: true,
    description: { en: 'Video generation model', 'zh-CN': '视频生成模型' },
  },
];

/**
 * 写库前先校验每个 preset 的 schema 合法——preset 本身在第一期测试里锁过，
 * 这里是一道兜底，防止 presets.ts 将来被改坏后静默播下非法 schema。
 */
function assertPresetsValid() {
  for (const key of Object.keys(MODEL_PRESETS) as ModelPresetKey[]) {
    const preset = MODEL_PRESETS[key];
    // 传入 pricingSchema 一并做交叉校验（PRICING_REFERENCES_UNKNOWN_PARAM 等）。
    // 两个校验函数返回 SchemaViolation[]，空数组即合法。
    const paramViolations = validateParamsSchema(preset.paramsSchema, preset.pricingSchema);
    if (paramViolations.length > 0) {
      throw new Error(`preset ${key} 的 paramsSchema 非法：${JSON.stringify(paramViolations)}`);
    }
    const pricingViolations = validatePricingSchema(preset.pricingSchema);
    if (pricingViolations.length > 0) {
      throw new Error(`preset ${key} 的 pricingSchema 非法：${JSON.stringify(pricingViolations)}`);
    }
  }
}

async function seedModels() {
  let created = 0;
  let updated = 0;

  for (const m of SEED_MODELS) {
    const preset = MODEL_PRESETS[m.presetKey];
    const paramsSchema = toInputJson(preset.paramsSchema);
    const pricingSchema = toInputJson(preset.pricingSchema);
    const description = toInputJson(m.description);

    // 无 (provider, model) 唯一约束，用 findFirst 做逻辑主键
    const existing = await prisma.model_configs.findFirst({
      where: { provider: m.provider, model: m.model },
      select: { id: true },
    });

    if (existing) {
      // 已存在：只刷新可安全重播的字段，保留运营配过的 apiKey / baseUrl / isDefault / isActive / priority
      await prisma.model_configs.update({
        where: { id: existing.id },
        data: {
          name: m.name,
          type: m.type,
          capabilities: m.capabilities,
          paramsSchema,
          pricingSchema,
          description,
        },
      });
      updated += 1;
      console.log(`  ↻ 更新 ${m.name} (${m.provider}/${m.model}) — 未触碰 apiKey/baseUrl`);
    } else {
      // 首次创建：apiKey / baseUrl 留空，等运营在 admin 补
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
          paramsSchema,
          pricingSchema,
          description,
        },
      });
      created += 1;
      console.log(`  ＋ 创建 ${m.name} (${m.provider}/${m.model}) — apiKey/baseUrl 待运营补充`);
    }
  }

  return { created, updated };
}

async function main() {
  console.log('▶ seed-models：播下起步模型（不含 apiKey，运营手动补充）\n');
  assertPresetsValid();
  const { created, updated } = await seedModels();
  console.log(`\n✔ 完成：新建 ${created} 个，更新 ${updated} 个。`);
  console.log('  下一步：');
  console.log('   1) 运营在 admin「模型配置」页给每个模型补 apiKey / baseUrl（并按真实网关改 model-id）；');
  console.log('   2) 运行 seed-pricing 建任务定义与 task_model_bindings：');
  console.log('      dotenv -e .env -- bun run services/api/scripts/seed-pricing.ts');
}

main()
  .catch((err) => {
    console.error('✗ seed-models 失败：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
