/**
 * 逐模型的图片参数表 —— **唯一真相**。
 *
 * 这里描述的是「前端看得见、发得出的统一参数」，**不是**上游收的字段名。
 * 上游的原生字段（`aspect_ratio` / `image_size` / `size` / `resolution`…）
 * 只活在各自 protocol preset 的绑定表里（`packages/ai-adapters/src/image/protocol/presets/`）。
 *
 * 统一词汇（前端只认识这些名字，逐模型取子集）：
 *   aspectRatio   比例         → doubao/gemini/minimax 直接落 aspect_ratio；gpt-image 由 (比例 × 档位) 查表成 size
 *   resolution    分辨率档位   → doubao 落 resolution；gemini 落 image_size；gpt-image 参与 size 查表
 *   quality       质量         → 仅 gpt-image 有这个轴
 *   seed          随机种子     → 仅 minimax / gpt-image
 *   watermark / promptOptimizer / safetyChecker / thinkingLevel / background / outputFormat …
 *                              → 谁有谁出现，模型不支持的参数它的 schema 里就没有
 *
 * **不进 schema 的三样：**
 *   - `n`（生成张数）：业务层吃掉，preset 用 count 策略发给上游
 *   - `image[]` / `mask`（参考图、蒙版）：不是计价参数，走 referenceImages 计数 + multipart 上传。
 *     厂商的 `maxItems` 落在这里的 `uploadMax`（逐模型上传上限）
 *   - 厂商自定义关键字（`x-content-role` / `maxSize` / `enumLabels` / `format` / `items`）：
 *     ajv 是 strict 且只认 `x-ui` 一个自定义关键字，留着会让 ajv.compile **抛异常**
 *     （保存 400、下单 500）。`enumLabels` 转成 `x-ui.optionLabels`，`title` 转成 label
 */
import type { JsonSchemaProperty, ParamsSchema } from '@autix/domain/pricing';

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

export interface ImageModelParamsSpec {
  /** 路由到 protocol preset。决定统一参数怎么翻译成上游原生字段 */
  protocolKey: string;
  /** 仅展示（口径 1）。代码里不得出现 switch (modelFamily) */
  modelFamily: string;
  operations: Array<'generate' | 'edit'>;
  /** 单次最多出几张。**不是请求参数** —— 上游要的是 n，不是 n 的上限 */
  maxCount: number;
  /** 参考图上传上限（来自厂商的 image.maxItems）。0 = 该模型不吃参考图 */
  uploadMax: number;
  /** 该模型的统一参数（子集）。谁没有就不写 */
  properties: Record<string, JsonSchemaProperty>;
  /** 必填的参数名 */
  required: string[];
}

const ASPECT_8 = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'];
const ASPECT_GEMINI = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const ASPECT_GEMINI_31 = [...ASPECT_GEMINI, '1:4', '4:1', '1:8', '8:1'];

/** 比例：所有厂商都收，取值就是 `W:H` 字面量（语言无关，走 optionLabels 不走 i18n） */
function aspectRatio(values: string[], fallback: string): JsonSchemaProperty {
  return {
    type: 'string',
    enum: values,
    default: fallback,
    'x-ui': {
      role: 'wire',
      control: 'select',
      labelKey: 'pricing.params.aspectRatio',
      optionLabels: Object.fromEntries(values.map((value) => [value, value])),
      order: 10,
    },
  };
}

/** 分辨率档位：**计价参数**（价格按档位分级），同时也发给上游 */
function resolution(values: string[], fallback: string): JsonSchemaProperty {
  return {
    type: 'string',
    enum: values,
    default: fallback,
    'x-ui': {
      role: 'both',
      control: 'select',
      labelKey: 'pricing.params.resolution',
      optionLabels: Object.fromEntries(values.map((value) => [value, value])),
      order: 20,
    },
  };
}

function boolSetting(labelKey: string, fallback: boolean, order: number): JsonSchemaProperty {
  return {
    type: 'boolean',
    default: fallback,
    'x-ui': { role: 'wire', control: 'switch', labelKey, order },
  };
}

/** 参考图张数：**只计价、不发给上游**（上游要的是图本身，不是"几张"这个数） */
const REFERENCE_IMAGES: JsonSchemaProperty = {
  type: 'integer',
  minimum: 0,
  default: 0,
  'x-ui': { role: 'pricing', control: 'hidden' },
};

/**
 * 逐模型参数表。key 是 `model_configs.model`（上游真实 model id），不是展示名。
 */
export const IMAGE_MODEL_PARAMS: Record<string, ImageModelParamsSpec> = {
  // ── 火山 Seedream ────────────────────────────────────────────────
  'doubao-seedream-4-5': {
    protocolKey: 'doubao-images@v1',
    modelFamily: 'seedream',
    operations: ['generate', 'edit'],
    maxCount: 15,
    uploadMax: 10,
    properties: {
      aspectRatio: aspectRatio(ASPECT_8, '1:1'),
      resolution: resolution(['2K', '4K'], '2K'),
      safetyChecker: boolSetting('pricing.params.safetyChecker', true, 90),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio', 'resolution'],
  },
  'doubao-seedream-5-0-lite': {
    protocolKey: 'doubao-images@v1',
    modelFamily: 'seedream',
    operations: ['generate', 'edit'],
    maxCount: 15,
    uploadMax: 10,
    properties: {
      aspectRatio: aspectRatio(ASPECT_8, '1:1'),
      resolution: resolution(['2K', '3K'], '2K'),
      safetyChecker: boolSetting('pricing.params.safetyChecker', true, 90),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio', 'resolution'],
  },

  // ── Gemini（Nano Banana 系）──────────────────────────────────────
  'gemini-2.5-flash-image': {
    protocolKey: 'gemini-images@v1',
    modelFamily: 'gemini-image',
    operations: ['generate', 'edit'],
    maxCount: 1,
    uploadMax: 3,
    properties: {
      aspectRatio: aspectRatio(ASPECT_GEMINI, '1:1'),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio'],
  },
  'gemini-3-pro-image-preview': {
    protocolKey: 'gemini-images@v1',
    modelFamily: 'gemini-image',
    operations: ['generate', 'edit'],
    maxCount: 1,
    uploadMax: 14,
    properties: {
      aspectRatio: aspectRatio(ASPECT_GEMINI, '1:1'),
      resolution: resolution(['1K', '2K', '4K'], '1K'),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio', 'resolution'],
  },
  'gemini-3.1-flash-image-preview': {
    protocolKey: 'gemini-images@v1',
    modelFamily: 'gemini-image',
    operations: ['generate', 'edit'],
    maxCount: 1,
    uploadMax: 14,
    properties: {
      aspectRatio: aspectRatio(ASPECT_GEMINI_31, '1:1'),
      resolution: resolution(['1K', '2K', '4K'], '1K'),
      thinkingLevel: {
        type: 'string',
        enum: ['minimal', 'high'],
        default: 'minimal',
        'x-ui': {
          role: 'wire',
          control: 'select',
          labelKey: 'pricing.params.thinkingLevel',
          optionLabelKeys: {
            minimal: 'pricing.options.minimal',
            high: 'pricing.options.high',
          },
          order: 30,
        },
      },
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio', 'resolution'],
  },
  'gemini-3.1-flash-lite-image': {
    protocolKey: 'gemini-images@v1',
    modelFamily: 'gemini-image',
    operations: ['generate', 'edit'],
    maxCount: 1,
    uploadMax: 14,
    properties: {
      aspectRatio: aspectRatio(ASPECT_GEMINI, '1:1'),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio'],
  },

  // ── OpenAI GPT Image ────────────────────────────────────────────
  // 它是唯一收「像素尺寸」而不是「比例」的：size 由 preset 从 (aspectRatio × resolution)
  // 查表得出（valueMap），前端仍然只选比例和档位。
  'gpt-image-2-official': {
    protocolKey: 'openai-images@v1',
    modelFamily: 'gpt-image',
    operations: ['generate', 'edit'],
    maxCount: 10,
    uploadMax: 16,
    properties: {
      aspectRatio: aspectRatio(['1:1', '3:2', '2:3', '16:9', '9:16'], '1:1'),
      resolution: resolution(['1K', '2K', '4K'], '1K'),
      quality: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        'x-ui': {
          role: 'both',
          control: 'select',
          labelKey: 'pricing.params.quality',
          optionLabelKeys: {
            low: 'pricing.options.low',
            medium: 'pricing.options.medium',
            high: 'pricing.options.high',
          },
          order: 30,
        },
      },
      background: {
        type: 'string',
        enum: ['auto', 'opaque'],
        default: 'auto',
        'x-ui': { role: 'wire', control: 'select', labelKey: 'pricing.params.background', order: 80 },
      },
      outputFormat: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png',
        'x-ui': { role: 'wire', control: 'select', labelKey: 'pricing.params.outputFormat', order: 81 },
      },
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio', 'resolution', 'quality'],
  },

  // ── MiniMax ─────────────────────────────────────────────────────
  // 没有分辨率档位 → 它的 schema 里就没有 resolution（计价因此只能按张，不分档）
  'MiniMax-Image-01': {
    protocolKey: 'minimax-images@v1',
    modelFamily: 'minimax-image',
    operations: ['generate', 'edit'],
    maxCount: 9,
    uploadMax: 1,
    properties: {
      aspectRatio: aspectRatio(ASPECT_8, '1:1'),
      promptOptimizer: boolSetting('pricing.params.promptOptimizer', false, 85),
      watermark: boolSetting('pricing.params.watermark', false, 86),
      referenceImages: REFERENCE_IMAGES,
    },
    required: ['aspectRatio'],
  },
};

/**
 * 逐模型生成 paramsSchema。**不再读静态能力表**（口径 4：getImageCapability 不读
 * modelFamily；schema 的唯一真相是上面那张表）。
 *
 * 未登记的 model id → 抛错，**不做静默兜底**。老代码正是靠静默 fallback 把所有
 * 未知模型悄悄按 Gemini 3 Pro 的尺寸表渲染，让用户能选到该模型不支持的 4K。
 */
export function buildImageParamsSchema(model: { model: string }): ParamsSchema {
  const spec = IMAGE_MODEL_PARAMS[model.model];
  if (!spec) {
    throw new Error(
      `No image params spec registered for model "${model.model}" — add it to IMAGE_MODEL_PARAMS (services/api/scripts/seed-image-params.ts)`,
    );
  }
  // uploadMax 落在 referenceImages 的 x-ui 上（**不是** JSON-Schema 的 maximum）：
  // referenceImages 的值是「实际附了几张图」且被 ajv strict 校验，而 image_generation
  // 的 schema 是 chat/canvas/公开生成器共享的，canvas 的参考图数量上游无限制 —— 设成
  // maximum 会让多图的画布操作在扣费前 400。x-ui 内部 ajv 零校验，放这里只喂 UI。
  const properties: ParamsSchema['properties'] = { ...spec.properties };
  const refs = properties.referenceImages;
  if (refs) {
    properties.referenceImages = {
      ...refs,
      'x-ui': { ...refs['x-ui']!, uploadMax: spec.uploadMax },
    };
  }

  return {
    $schema: JSON_SCHEMA_DRAFT,
    type: 'object',
    required: [...spec.required],
    properties,
  };
}

/** 该模型的 metadata（协议路由 + 能力区）。uploadMax 落在 referenceImages 的 x-ui 上，不在这里 */
export function buildImageMetadata(model: { model: string }): Record<string, unknown> {
  const spec = IMAGE_MODEL_PARAMS[model.model];
  if (!spec) {
    throw new Error(`No image params spec registered for model "${model.model}"`);
  }
  return {
    modelFamily: spec.modelFamily,
    protocolKey: spec.protocolKey,
    operations: [...spec.operations],
    limits: { maxCount: spec.maxCount },
  };
}
