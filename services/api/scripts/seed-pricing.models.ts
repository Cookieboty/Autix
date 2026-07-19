/**
 * 起步模型目录（SEED_MODELS）——从 seed-pricing.ts 抽出来的**纯数据/纯函数**模块。
 *
 * 那个文件在模块顶层就 `createPrismaClient()`，并在文件末尾无条件调用 `main()`
 * （没有 `require.main === module` 之类的守卫）——一 import 就会真的连数据库、跑一遍
 * seed 流程。SEED_MODELS 因此永远测不到，除非把它和纯函数一起搬出来（同
 * seed-pricing.schemas.ts 的拆分理由，AGENTS.md 拆分优先级第 1 条）。
 */

import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { VIDEO_INPUT_MEDIA_KEY, type VideoInputMediaCapability } from '@autix/domain/video';

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

  // —— VEO 3.1（第二家视频渠道，protocolKey=poyo-veo@v1）——
  // baseUrl(https://api.poyo.ai)/apiKey 由运营在 admin 补；schema/pricing 从 VIDEO_MODEL_CONFIGS 写全量。
  { name: 'VEO 3.1 Fast', provider: 'poyo', model: 'veo3.1-fast-official', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', videoModelKind: 'veo3.1-fast', protocolKey: 'poyo-veo@v1' }, description: { en: 'VEO 3.1 fast official', 'zh-CN': 'VEO 3.1 快速官方版' } },
  { name: 'VEO 3.1 Lite', provider: 'poyo', model: 'veo3.1-lite-official', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', videoModelKind: 'veo3.1-lite', protocolKey: 'poyo-veo@v1' }, description: { en: 'VEO 3.1 lite official', 'zh-CN': 'VEO 3.1 轻量官方版' } },
  { name: 'VEO 3.1 Quality', provider: 'poyo', model: 'veo3.1-quality-official', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', videoModelKind: 'veo3.1-quality', protocolKey: 'poyo-veo@v1' }, description: { en: 'VEO 3.1 quality official', 'zh-CN': 'VEO 3.1 高质量官方版' } },

  // —— Wan 2.7（第三家视频渠道）—— 四个模型各一个 protocolKey（请求体不同）。
  // 不设 videoModelKind（detectVideoModelKind 回落 compatible，仅用于分辨率兜底）；表单从 paramsSchema 渲染。
  // Wan 2.7 是**一个**模型 —— 上游按素材角色分派到 t2v/i2v/ref 三个 model ID（见
  // ai-adapters 的 resolveWanMode）。故只留一行，`metadata.videoDispatch='wan'` 触发运行时派发
  // （用专用键而非 modelFamily：后者按约定仅展示、不得 switch）；`model`/`protocolKey` 只是文生
  // （t2v）基线，实际由 routing 按素材覆盖。edit 暂不纳入自动推断（其源视频与 ref 同角色）。
  { name: 'Wan 2.7', provider: 'poyo', model: 'wan2.7-video', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', videoDispatch: 'wan', protocolKey: 'poyo-wan-t2v@v1' }, description: { en: 'Wan 2.7 video (text/image/reference to video)', 'zh-CN': 'Wan 2.7 视频（文/图/参考生视频）' } },

  // —— Grok Imagine（第四家）——
  { name: 'Grok Imagine', provider: 'poyo', model: 'grok-imagine', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', protocolKey: 'poyo-grok-imagine@v1' }, description: { en: 'Grok Imagine (text/image-to-video)', 'zh-CN': 'Grok Imagine 文/图生视频' } },
  { name: 'Grok Imagine Video 1.5', provider: 'poyo', model: 'grok-imagine-video-1.5', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', protocolKey: 'poyo-grok-v15@v1' }, description: { en: 'Grok Imagine Video 1.5 (image-to-video)', 'zh-CN': 'Grok Imagine Video 1.5 图生视频' } },

  // —— Happy Horse（阿里）—— v1 只做 t2v/i2v/ref（edit 暂不接）。
  { name: 'Happy Horse', provider: 'poyo', model: 'happy-horse', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', protocolKey: 'poyo-happyhorse@v1' }, description: { en: 'Happy Horse (t2v/i2v/ref)', 'zh-CN': 'Happy Horse 文/图/参考生视频' } },
  { name: 'Happy Horse 1.1', provider: 'poyo', model: 'happy-horse-1.1', type: 'video', capabilities: ['video'], isDefault: false, metadata: { gateway: 'poyo', protocolKey: 'poyo-happyhorse-11@v1' }, description: { en: 'Happy Horse 1.1 (t2v/i2v/ref)', 'zh-CN': 'Happy Horse 1.1 文/图/参考生视频' } },
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
          enum: ['2K', '3K', '4K'],
          type: 'string',
          'x-ui': { role: 'both', order: 20, control: 'select', labelKey: 'pricing.params.resolution', optionLabels: { '2K': '2K', '3K': '3K', '4K': '4K' } },
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
        { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '2K': 23, '3K': 34, '4K': 45 } } },
      ],
    } as PricingSchema,
  },
};

const JSON_SCHEMA_DRAFT_VIDEO = 'https://json-schema.org/draft/2020-12/schema';

/**
 * 各视频模型的**输入媒体能力**（写进 paramsSchema['x-media']，见 @autix/domain 的
 * input-media.ts）。取值逐条对照上游文档，凡是文档没有明确写支持的，一律按不支持处理
 * —— 保守方向是把入口关掉，而不是让用户传上去再失败。
 *
 * 关键事实（2026-07 文档）：10 个模型里只有 Seedance 两档和 Wan 2.7 接视频/音频输入，
 * VEO 全系、Grok 两款、Happy Horse 两款都只接图片。
 */

/** Seedance 2.0 / Fast：图 1-9、视频≤3 段、音频≤3 段；三种图片用法互斥。 */
const seedanceInputMedia: VideoInputMediaCapability = {
  image: { max: 9, roles: ['first_frame', 'last_frame', 'reference_image'] },
  // 文档：每段 [2,15] 秒且总时长 ≤15 秒；mp4/mov，单文件 ≤50MB
  video: { max: 3, maxSeconds: 15, totalSeconds: 15 },
  // 文档：每段 [2,15] 秒且总时长 ≤15 秒；wav/mp3，单文件 ≤15MB
  audio: { max: 3, maxSeconds: 15, totalSeconds: 15 },
  // 「含图像的 3 种场景互斥，不能在同一任务中混用」
  imageModes: [['first_frame'], ['first_frame', 'last_frame'], ['reference_image']],
};

/** VEO 3.1 fast/quality：最多 3 图（首尾帧 2 图 或 参考 3 图），不接视频/音频输入。 */
const veoInputMedia: VideoInputMediaCapability = {
  image: { max: 3, roles: ['first_frame', 'last_frame', 'reference_image'] },
  imageModes: [['first_frame'], ['first_frame', 'last_frame'], ['reference_image']],
};

/** VEO 3.1 lite：最多 2 图，且**没有参考模式**（只支持单图 / 首尾帧）。 */
const veoLiteInputMedia: VideoInputMediaCapability = {
  image: { max: 2, roles: ['first_frame', 'last_frame'] },
  imageModes: [['first_frame'], ['first_frame', 'last_frame']],
};

/** Wan 2.7：image_urls 1-2（[0] 起始、[1] 结束）+ 参考图；接参考视频与音频。 */
const wanInputMedia: VideoInputMediaCapability = {
  image: { max: 2, roles: ['first_frame', 'last_frame', 'reference_image'] },
  video: { max: 1 },
  audio: { max: 1 },
};

/** Grok Imagine：最多 1 张图（image-to-video 时必填），无视频/音频输入。 */
const grokImagineInputMedia: VideoInputMediaCapability = {
  image: { max: 1, roles: ['first_frame'] },
};

/** Grok Imagine Video 1.5：**恰好 1 张**图（minItems=maxItems=1），无视频/音频。 */
const grokV15InputMedia: VideoInputMediaCapability = {
  image: { max: 1, exact: 1, roles: ['first_frame'] },
};

/** Happy Horse / 1.1：单首帧 或 参考图 1-9，二者互斥；不接视频/音频（video-edit v1 未接）。 */
const happyHorseInputMedia: VideoInputMediaCapability = {
  image: { max: 9, roles: ['first_frame', 'reference_image'] },
  imageModes: [['first_frame'], ['reference_image']],
};

/** 把输入媒体能力挂到 paramsSchema 上（键名走 domain 常量，避免两边各写一遍字符串）。 */
export function withInputMedia(
  schema: ParamsSchema,
  media: VideoInputMediaCapability,
): ParamsSchema {
  return { ...schema, [VIDEO_INPUT_MEDIA_KEY]: media } as ParamsSchema;
}

export const VIDEO_INPUT_MEDIA_BY_MODEL: Record<string, VideoInputMediaCapability> = {
  'doubao-seedance-2.0': seedanceInputMedia,
  'doubao-seedance-2.0-fast': seedanceInputMedia,
  'veo3.1-fast-official': veoInputMedia,
  'veo3.1-quality-official': veoInputMedia,
  'veo3.1-lite-official': veoLiteInputMedia,
  'wan2.7-video': wanInputMedia,
  'grok-imagine': grokImagineInputMedia,
  'grok-imagine-video-1.5': grokV15InputMedia,
  'happy-horse': happyHorseInputMedia,
  'happy-horse-1.1': happyHorseInputMedia,
};

/**
 * VEO 的 per-model paramsSchema。**每个模型按自己的 schema 渲染**（不复用
 * buildVideoParamsSchema / 全局 VIDEO_ASPECT_RATIO_VALUES）：aspect_ratio 只有
 * 16:9/9:16/auto，duration 只有 4/6/8，sound(generate_audio) 作计价+wire 参数。
 * resolution 逐模型不同（lite 无 4K）。
 */
function veoParamsSchema(resolutions: string[]): ParamsSchema {
  return {
    $schema: JSON_SCHEMA_DRAFT_VIDEO,
    type: 'object',
    required: ['resolution', 'duration'],
    properties: {
      resolution: { type: 'string', enum: resolutions, default: '720p', 'x-ui': { role: 'both', control: 'chips', order: 10, labelKey: 'pricing.params.resolution' } },
      ratio: { type: 'string', enum: ['16:9', '9:16', 'auto'], default: '16:9', 'x-ui': { role: 'wire', control: 'chips', order: 20, labelKey: 'pricing.params.ratio' } },
      duration: { type: 'integer', enum: [4, 6, 8], default: 8, 'x-ui': { role: 'both', control: 'chips', order: 30, labelKey: 'pricing.params.duration' } },
      generate_audio: { type: 'boolean', default: true, 'x-ui': { role: 'both', control: 'switch', order: 40, labelKey: 'pricing.params.generateAudio' } },
    },
  } as ParamsSchema;
}

/**
 * VEO 每秒积分（1 美元 = 500 积分，官方每秒价 × 500）。计价维度是「分辨率 × 是否出声」——
 * 用**互斥的 when 谓词**切换每秒单价，只有一条命中 → unitCost × duration。
 * 无声用 `generate_audio ne true`（false / 未设都算无声），有声用 `eq true`。
 */
function veoGroupedPricing(sdNoAudio: number, sdAudio: number, k4NoAudio: number, k4Audio: number): PricingSchema {
  return {
    terms: [
      // 首项必须是 const（校验器 FIRST_TERM_MUST_BE_CONST）：所有条件项跳过时兜底 0。
      { id: 'base', op: 'add', const: 0 },
      { id: 'sd-noaudio', op: 'add', perUnit: { param: 'duration', unitCost: sdNoAudio }, when: { all: [{ param: 'resolution', op: 'in', value: ['720p', '1080p'] }, { param: 'generate_audio', op: 'ne', value: true }] } },
      { id: 'sd-audio', op: 'add', perUnit: { param: 'duration', unitCost: sdAudio }, when: { all: [{ param: 'resolution', op: 'in', value: ['720p', '1080p'] }, { param: 'generate_audio', op: 'eq', value: true }] } },
      { id: 'k4-noaudio', op: 'add', perUnit: { param: 'duration', unitCost: k4NoAudio }, when: { all: [{ param: 'resolution', op: 'eq', value: '4k' }, { param: 'generate_audio', op: 'ne', value: true }] } },
      { id: 'k4-audio', op: 'add', perUnit: { param: 'duration', unitCost: k4Audio }, when: { all: [{ param: 'resolution', op: 'eq', value: '4k' }, { param: 'generate_audio', op: 'eq', value: true }] } },
    ],
  } as PricingSchema;
}

// lite 无 4K，且 720p 与 1080p 单价不同，故逐档写。
const veoLitePricing: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 0 },
    { id: 'r720-noaudio', op: 'add', perUnit: { param: 'duration', unitCost: 9 }, when: { all: [{ param: 'resolution', op: 'eq', value: '720p' }, { param: 'generate_audio', op: 'ne', value: true }] } },
    { id: 'r720-audio', op: 'add', perUnit: { param: 'duration', unitCost: 15 }, when: { all: [{ param: 'resolution', op: 'eq', value: '720p' }, { param: 'generate_audio', op: 'eq', value: true }] } },
    { id: 'r1080-noaudio', op: 'add', perUnit: { param: 'duration', unitCost: 15 }, when: { all: [{ param: 'resolution', op: 'eq', value: '1080p' }, { param: 'generate_audio', op: 'ne', value: true }] } },
    { id: 'r1080-audio', op: 'add', perUnit: { param: 'duration', unitCost: 24 }, when: { all: [{ param: 'resolution', op: 'eq', value: '1080p' }, { param: 'generate_audio', op: 'eq', value: true }] } },
  ],
} as PricingSchema;

/**
 * 视频模型的 per-model paramsSchema + pricingSchema（按 model-id 索引，同 IMAGE_MODEL_CONFIGS）。
 * seedModelSchemas() 里视频模型优先查这里；命中就写全量，不命中的（seedance）仍走
 * buildVideoParamsSchema + MODEL_PRICING 的既有路径。
 */
/**
 * Wan 2.7 的 per-model paramsSchema。resolution 只 720p/1080p，比例 16:9/9:16/1:1/4:3/3:4
 * （i2v 无比例，由图片决定）。duration 逐模型不同（t2v 5/10/15、ref/edit 2-10 取 5/10）。
 * Wan 无 generate_audio 布尔（音频经 audio_url），故不含 sound 参数。
 */
function wanParamsSchema(durations: number[], hasRatio: boolean): ParamsSchema {
  const properties: Record<string, unknown> = {
    resolution: { type: 'string', enum: ['720p', '1080p'], default: '720p', 'x-ui': { role: 'both', control: 'chips', order: 10, labelKey: 'pricing.params.resolution' } },
    duration: { type: 'integer', enum: durations, default: durations[0], 'x-ui': { role: 'both', control: 'chips', order: 30, labelKey: 'pricing.params.duration' } },
  };
  if (hasRatio) {
    properties.ratio = { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9', 'x-ui': { role: 'wire', control: 'chips', order: 20, labelKey: 'pricing.params.ratio' } };
  }
  return { $schema: JSON_SCHEMA_DRAFT_VIDEO, type: 'object', required: ['resolution', 'duration'], properties } as ParamsSchema;
}

// Wan 计价：所有模型同价，仅按 分辨率×时长。720p $0.06/s=30、1080p $0.09/s=45（×500）。
const wanPricing: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 0 },
    { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '720p': 30, '1080p': 45 } } },
    { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
  ],
} as PricingSchema;

// Grok Imagine：文/图生视频，aspect_ratio(5 档，含 2:3/3:2) + duration(6/10)，无 resolution。
// 计价按整段视频（非每秒）：6s=$0.15=75、10s=$0.20=100（×500）。mode(fun/normal/spicy) v1 不下发。
const grokImagineParamsSchema: ParamsSchema = {
  $schema: JSON_SCHEMA_DRAFT_VIDEO,
  type: 'object',
  required: ['duration'],
  properties: {
    ratio: { type: 'string', enum: ['1:1', '2:3', '3:2', '16:9', '9:16'], default: '16:9', 'x-ui': { role: 'wire', control: 'chips', order: 20, labelKey: 'pricing.params.ratio' } },
    duration: { type: 'integer', enum: [6, 10], default: 6, 'x-ui': { role: 'both', control: 'chips', order: 30, labelKey: 'pricing.params.duration' } },
  },
} as ParamsSchema;
const grokImaginePricing: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 0 },
    { id: 'video', op: 'add', table: { param: 'duration', values: { '6': 75, '10': 100 } } },
  ],
} as PricingSchema;

// Grok Imagine Video 1.5：图生视频，resolution(480p/720p) + duration，无 aspect_ratio。
// 计价：分辨率每秒 × 时长 + 输入图 $0.01=5（1.5 必带一张源图）。480p $0.072/s=36、720p $0.125/s=62.5。
const grokV15ParamsSchema: ParamsSchema = {
  $schema: JSON_SCHEMA_DRAFT_VIDEO,
  type: 'object',
  required: ['resolution', 'duration'],
  properties: {
    resolution: { type: 'string', enum: ['480p', '720p'], default: '720p', 'x-ui': { role: 'both', control: 'chips', order: 10, labelKey: 'pricing.params.resolution' } },
    // 文档：1-15 秒整数，默认 6。原先写死 enum [6,10]，白白砍掉了 13 档。
    // 计价是 perUnit × duration，任意整数都算得出来，放开无风险。
    duration: { type: 'integer', minimum: 1, maximum: 15, default: 6, 'x-ui': { role: 'both', control: 'stepper', order: 30, labelKey: 'pricing.params.duration' } },
  },
} as ParamsSchema;
const grokV15Pricing: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 0 },
    { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '480p': 36, '720p': 62.5 } } },
    { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
    { id: 'input-image', op: 'add', const: 5 }, // 输入源图固定 +5（在 ×duration 之后，不随时长放大）
  ],
} as PricingSchema;

// Happy Horse：resolution 720p/1080p（默认 1080p）、duration 3-15（UI 取 5/10/15）、aspect 逐版本不同。
// 计价按 分辨率×时长（1.0: 720p 40/1080p 80；1.1: 720p 55/1080p 70）。v1 不含 edit（2× 档）。
function happyHorseParamsSchema(ratios: string[]): ParamsSchema {
  return {
    $schema: JSON_SCHEMA_DRAFT_VIDEO,
    type: 'object',
    required: ['resolution', 'duration'],
    properties: {
      resolution: { type: 'string', enum: ['720p', '1080p'], default: '1080p', 'x-ui': { role: 'both', control: 'chips', order: 10, labelKey: 'pricing.params.resolution' } },
      ratio: { type: 'string', enum: ratios, default: '16:9', 'x-ui': { role: 'wire', control: 'chips', order: 20, labelKey: 'pricing.params.ratio' } },
      // 文档：3-15 秒整数，默认 5。原先写死 [5,10,15]，砍掉了中间所有档位。
      // 计价 = 分辨率单价 × duration，连续值同样算得出来。
      duration: { type: 'integer', minimum: 3, maximum: 15, default: 5, 'x-ui': { role: 'both', control: 'stepper', order: 30, labelKey: 'pricing.params.duration' } },
    },
  } as ParamsSchema;
}
function happyHorsePricing(r720: number, r1080: number): PricingSchema {
  return {
    terms: [
      { id: 'base', op: 'add', const: 0 },
      { id: 'resolution', op: 'add', table: { param: 'resolution', values: { '720p': r720, '1080p': r1080 } } },
      { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
    ],
  } as PricingSchema;
}

export const VIDEO_MODEL_CONFIGS: Record<
  string,
  { paramsSchema: ParamsSchema; pricingSchema: PricingSchema }
> = {
  'veo3.1-fast-official': { paramsSchema: withInputMedia(veoParamsSchema(['720p', '1080p', '4k']), VIDEO_INPUT_MEDIA_BY_MODEL['veo3.1-fast-official']!), pricingSchema: veoGroupedPricing(25, 37.5, 75, 87.5) },
  'veo3.1-lite-official': { paramsSchema: withInputMedia(veoParamsSchema(['720p', '1080p']), VIDEO_INPUT_MEDIA_BY_MODEL['veo3.1-lite-official']!), pricingSchema: veoLitePricing },
  'veo3.1-quality-official': { paramsSchema: withInputMedia(veoParamsSchema(['720p', '1080p', '4k']), VIDEO_INPUT_MEDIA_BY_MODEL['veo3.1-quality-official']!), pricingSchema: veoGroupedPricing(60, 120, 120, 180) },
  // Wan 2.7：t2v 5/10/15 有比例；i2v 无比例；ref/edit 5/10 有比例。
  // 合成为一个模型：paramsSchema 取各模式的**并集**（aspect_ratio + duration 全档 5/10/15）。
  // aspect_ratio 在 i2v 模式由 preset 忽略（图定比例）；duration 15 仅 t2v/i2v 合法，ref 上限 10
  // 由 resolveVideoRouting 在打上游前按推断模式拦截，避免上游偶发 400。
  'wan2.7-video': { paramsSchema: withInputMedia(wanParamsSchema([5, 10, 15], true), VIDEO_INPUT_MEDIA_BY_MODEL['wan2.7-video']!), pricingSchema: wanPricing },
  // Grok Imagine（整段计价）+ Grok Imagine Video 1.5（每秒×分辨率 + 输入图）。
  'grok-imagine': { paramsSchema: withInputMedia(grokImagineParamsSchema, VIDEO_INPUT_MEDIA_BY_MODEL['grok-imagine']!), pricingSchema: grokImaginePricing },
  'grok-imagine-video-1.5': { paramsSchema: withInputMedia(grokV15ParamsSchema, VIDEO_INPUT_MEDIA_BY_MODEL['grok-imagine-video-1.5']!), pricingSchema: grokV15Pricing },
  // Happy Horse（1.0 aspect 5 档；1.1 aspect 9 档）。
  'happy-horse': { paramsSchema: withInputMedia(happyHorseParamsSchema(['16:9', '9:16', '1:1', '4:3', '3:4']), VIDEO_INPUT_MEDIA_BY_MODEL['happy-horse']!), pricingSchema: happyHorsePricing(40, 80) },
  'happy-horse-1.1': { paramsSchema: withInputMedia(happyHorseParamsSchema(['21:9', '16:9', '4:3', '1:1', '3:4', '4:5', '5:4', '9:16', '9:21']), VIDEO_INPUT_MEDIA_BY_MODEL['happy-horse-1.1']!), pricingSchema: happyHorsePricing(55, 70) },
};
