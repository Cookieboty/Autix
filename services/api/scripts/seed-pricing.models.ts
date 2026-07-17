/**
 * 起步模型目录（SEED_MODELS）——从 seed-pricing.ts 抽出来的**纯数据/纯函数**模块。
 *
 * 那个文件在模块顶层就 `createPrismaClient()`，并在文件末尾无条件调用 `main()`
 * （没有 `require.main === module` 之类的守卫）——一 import 就会真的连数据库、跑一遍
 * seed 流程。SEED_MODELS 因此永远测不到，除非把它和纯函数一起搬出来（同
 * seed-pricing.schemas.ts 的拆分理由，AGENTS.md 拆分优先级第 1 条）。
 */

import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';

/**
 * type + capabilities 决定 presetKeyFor 的归类（→ text / image / video preset）；
 * metadata.imageModelKind / videoModelKind 给能力面板（尺寸/分辨率）做确定性识别，
 * 避免 model-id 变了之后识别不出档位。
 */
export interface SeedModelRow {
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
export const DEFAULT_MULTIPLIER = 2;

/**
 * 起步模型目录。型号取自 domain 的能力表（image/video capabilities.ts 里真实登记的
 * kind）与 seed-prod 的首页任务（Nano Banana Pro / Seedance 2.0）。**不写 apiKey /
 * baseUrl**——密钥与网关地址由运营在 admin「模型配置」页手动补充。model-id 的 amux/
 * 前缀只是占位命名，运营按真实网关改。
 */
export const SEED_MODELS: SeedModelRow[] = [
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
  // Google Gemini 3.5
  { name: 'Gemini 3.5 Pro', provider: 'amux', model: 'gemini-3.5-pro', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Google Gemini flagship model', 'zh-CN': 'Google Gemini 旗舰模型' } },
  { name: 'Gemini 3.5 Flash', provider: 'amux', model: 'gemini-3.5-flash', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Google Gemini fast model', 'zh-CN': 'Google Gemini 快速模型' } },
  // 阿里 Qwen 3.7
  { name: 'Qwen3.7 Max', provider: 'amux', model: 'qwen3.7-max', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen flagship model', 'zh-CN': '阿里通义千问旗舰模型' } },
  { name: 'Qwen3.7 Plus', provider: 'amux', model: 'qwen3.7-plus', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen multimodal model', 'zh-CN': '阿里通义千问多模态模型' } },
  // Moonshot Kimi K2.6 / xAI Grok 4.3
  { name: 'Kimi K2.6', provider: 'amux', model: 'kimi-k2.6', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Moonshot Kimi model', 'zh-CN': '月之暗面 Kimi 模型' } },
  { name: 'Grok 4.3', provider: 'amux', model: 'grok-4.3', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'xAI Grok model', 'zh-CN': 'xAI Grok 模型' } },

  // —— 图像 ——
  // metadata（protocolKey / operations / limits / modelFamily / imageModelKind）与
  // paramsSchema / pricingSchema **按 DB 现状写全量**（见 IMAGE_MODEL_CONFIGS）——
  // 让 fresh 安装的本地库与线上 DB 一致。schema 由 seedModelSchemas() 按 model-id 填。
  // **不写 apiKey / baseUrl**：密钥/网关地址仍由运营在 admin 补，绝不进 git。
  { name: 'GPT Image 2', provider: 'amux', model: 'gpt-image-2-official', type: 'general', capabilities: ['image'], isDefault: true, metadata: { limits: { maxCount: 10 }, operations: ['generate', 'edit'], modelFamily: 'gpt-image', protocolKey: 'openai-images@v1' }, description: { en: 'OpenAI image model', 'zh-CN': 'OpenAI 图像模型' } },
  { name: 'Nano Banana Pro', provider: 'amux', model: 'gemini-3-pro-image-preview-official', type: 'general', capabilities: ['image'], isDefault: false, metadata: { limits: { maxCount: 1 }, operations: ['generate', 'edit'], modelFamily: 'gemini-image', protocolKey: 'gemini-generate-content@v1' }, description: { en: 'Nano Banana Pro', 'zh-CN': 'Nano Banana Pro' } },
  { name: 'Nano Banana 2', provider: 'amux', model: 'gemini-3.1-flash-image-preview-official', type: 'general', capabilities: ['image'], isDefault: false, metadata: { limits: { maxCount: 1 }, operations: ['generate', 'edit'], modelFamily: 'gemini-image', protocolKey: 'gemini-generate-content@v1', imageModelKind: 'gemini-3-flash-image' }, description: { en: 'Nano Banana 2', 'zh-CN': 'Nano Banana 2' } },
  { name: 'Nano Banana 2 Lite', provider: 'amux', model: 'gemini-3.1-flash-lite-image-official', type: 'general', capabilities: ['image'], isDefault: false, metadata: { limits: { maxCount: 1 }, operations: ['generate', 'edit'], modelFamily: 'gemini-image', protocolKey: 'gemini-generate-content@v1', imageModelKind: 'gemini-3-flash-image' }, description: { en: 'Nano Banana 2 Lite', 'zh-CN': 'Nano Banana 2 Lite' } },
  // Seedream operations 只含 generate：火山 Seedream 统一端点，图生图/编辑都走
  // /v1/images/generations 的 image 字段，无独立 /v1/images/edits（官方文档核实）。
  { name: 'Seedream 4.5', provider: 'amux', model: 'doubao-seedream-4-5', type: 'general', capabilities: ['image'], isDefault: false, metadata: { limits: { maxCount: 15 }, operations: ['generate'], modelFamily: 'seedream', protocolKey: 'doubao-images@v1' }, description: { en: 'ByteDance Seedream image model', 'zh-CN': '字节 Seedream 图像模型' } },
  { name: 'Seedream 5.0 Lite', provider: 'amux', model: 'doubao-seedream-5-0-lite', type: 'general', capabilities: ['image'], isDefault: false, metadata: { limits: { maxCount: 15 }, operations: ['generate'], modelFamily: 'seedream', protocolKey: 'doubao-images@v1' }, description: { en: 'ByteDance Seedream lite model', 'zh-CN': '字节 Seedream 轻量模型' } },

  // —— 视频（video preset）—— metadata.videoModelKind 定档
  // doubao-seedance-2.0 恢复：与 Fast 变体一并提供。Fast 仍是 video 默认（isDefault:true），
  // 2.0 为非默认可选项。两者 paramsSchema 由 buildVideoParamsSchema 按各自能力表生成
  // （2.0 含 1080p/4k、Fast 到 720p），pricingSchema 走 MODEL_PRICING 的逐模型档位。
  { name: 'Seedance 2.0', provider: 'amux', model: 'doubao-seedance-2.0', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-2.0', protocolKey: 'ark-video@v3' }, description: { en: 'Seedance video model', 'zh-CN': 'Seedance 视频模型' } },
  { name: 'Seedance 2.0 Fast', provider: 'amux', model: 'doubao-seedance-2.0-fast', type: 'video', capabilities: ['video'], isDefault: true, metadata: { videoModelKind: 'seedance-2.0-fast', protocolKey: 'ark-video@v3' }, description: { en: 'Seedance fast video model', 'zh-CN': 'Seedance 快速视频模型' } },
];

/**
 * 图片模型的 per-model paramsSchema + pricingSchema（按 model-id 索引）——**按 DB 现状写全量**，
 * 由 seedModelSchemas() 在建行后填入。每个模型支持的参数轴（quality/resolution/aspectRatio…）、
 * 参考图上传上限（referenceImages.x-ui.uploadMax）、计价（按 quality 或 resolution 查表 / 按张固定价）
 * 逐模型都不同，故不能共用一份通用 image preset。referenceImages 恒为 role='pricing'（上游要的是图
 * 本身、不是「几张」这个数）。
 */
export const IMAGE_MODEL_CONFIGS: Record<
  string,
  { paramsSchema: ParamsSchema; pricingSchema: PricingSchema }
> = {
  'gpt-image-2-official': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio', 'resolution', 'quality'],
      properties: {
        quality: {
          enum: ['low', 'medium', 'high'],
          type: 'string',
          'x-ui': { role: 'both', order: 30, control: 'select', labelKey: 'pricing.params.quality', optionLabelKeys: { low: 'pricing.options.low', high: 'pricing.options.high', medium: 'pricing.options.medium' } },
          default: 'medium',
        },
        resolution: {
          enum: ['1K', '2K', '4K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '1K': '1K', '2K': '2K', '4K': '4K' } },
          default: '1K',
        },
        aspectRatio: {
          enum: ['1:1', '3:2', '2:3', '16:9', '9:16'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '2:3': '2:3', '3:2': '3:2', '16:9': '16:9', '9:16': '9:16' } },
          default: '1:1',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 16 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'quality', op: 'add', table: { param: 'quality', values: { low: 3, high: 106, medium: 27 } } },
      ],
    } as PricingSchema,
  },
  'gemini-3.1-flash-image-preview-official': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio', 'resolution'],
      properties: {
        resolution: {
          enum: ['1K', '2K', '4K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '1K': '1K', '2K': '2K', '4K': '4K' } },
          default: '1K',
        },
        aspectRatio: {
          enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '1:4': '1:4', '1:8': '1:8', '2:3': '2:3', '3:2': '3:2', '3:4': '3:4', '4:1': '4:1', '4:3': '4:3', '4:5': '4:5', '5:4': '5:4', '8:1': '8:1', '16:9': '16:9', '21:9': '21:9', '9:16': '9:16' } },
          default: '1:1',
        },
        thinkingLevel: {
          enum: ['minimal', 'high'],
          type: 'string',
          'x-ui': { role: 'wire', order: 30, control: 'select', labelKey: 'pricing.params.thinkingLevel', optionLabelKeys: { high: 'pricing.options.high', minimal: 'pricing.options.minimal' } },
          default: 'minimal',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 14 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '1K': 34, '2K': 51, '4K': 75 } } },
      ],
    } as PricingSchema,
  },
  'gemini-3.1-flash-lite-image-official': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio'],
      properties: {
        aspectRatio: {
          enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '2:3': '2:3', '3:2': '3:2', '3:4': '3:4', '4:3': '4:3', '4:5': '4:5', '5:4': '5:4', '16:9': '16:9', '21:9': '21:9', '9:16': '9:16' } },
          default: '1:1',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 14 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [{ id: 'perImage', op: 'add', const: 17 }],
    } as PricingSchema,
  },
  'gemini-3-pro-image-preview-official': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio', 'resolution'],
      properties: {
        resolution: {
          enum: ['1K', '2K', '4K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '1K': '1K', '2K': '2K', '4K': '4K' } },
          default: '1K',
        },
        aspectRatio: {
          enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '2:3': '2:3', '3:2': '3:2', '3:4': '3:4', '4:3': '4:3', '4:5': '4:5', '5:4': '5:4', '16:9': '16:9', '21:9': '21:9', '9:16': '9:16' } },
          default: '1:1',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 14 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '1K': 34, '2K': 51, '4K': 75 } } },
      ],
    } as PricingSchema,
  },
  'doubao-seedream-4-5': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio', 'resolution'],
      properties: {
        resolution: {
          enum: ['2K', '4K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '2K': '2K', '4K': '4K' } },
          default: '2K',
        },
        aspectRatio: {
          enum: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '2:3': '2:3', '3:2': '3:2', '3:4': '3:4', '4:3': '4:3', '16:9': '16:9', '21:9': '21:9', '9:16': '9:16' } },
          default: '1:1',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 10 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '2K': 23, '4K': 45 } } },
      ],
    } as PricingSchema,
  },
  'doubao-seedream-5-0-lite': {
    paramsSchema: {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['aspectRatio', 'resolution'],
      properties: {
        resolution: {
          enum: ['2K', '3K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '2K': '2K', '3K': '3K' } },
          default: '2K',
        },
        aspectRatio: {
          enum: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
          type: 'string',
          'x-ui': { role: 'wire', order: 10, control: 'select', labelKey: 'pricing.params.aspectRatio', optionLabels: { '1:1': '1:1', '2:3': '2:3', '3:2': '3:2', '3:4': '3:4', '4:3': '4:3', '16:9': '16:9', '21:9': '21:9', '9:16': '9:16' } },
          default: '1:1',
        },
        referenceImages: {
          type: 'integer',
          'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 10 },
          default: 0,
          minimum: 0,
        },
      },
    } as ParamsSchema,
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '2K': 23, '3K': 34 } } },
      ],
    } as PricingSchema,
  },
};
