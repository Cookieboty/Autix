/**
 * 逐模型 paramsSchema 的生成函数。
 *
 * 从 seed-pricing.ts 抽出来的**纯函数**：那个文件在模块顶层就 `createPrismaClient()`，
 * 一 import 就要求 DATABASE_URL —— 这些函数因此永远测不到。它们不碰数据库，只是
 * 「能力表 → schema」的映射，抽出来即可单测（AGENTS.md 拆分优先级第 1 条）。
 */
import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  resolveImagePricingResolution,
  type ImageModelHint,
  type ImagePricingResolution,
} from '@autix/domain/image';
import { MODEL_PRESETS, type ParamsSchema } from '@autix/domain/pricing';
import {
  VIDEO_MODEL_CAPABILITIES,
  detectVideoModelKind,
  type VideoModelHint,
} from '@autix/domain/video';

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

const IMAGE_RESOLUTION_ORDER: ImagePricingResolution[] = ['512px', '1K', '2K', '4K'];

export interface ModelSchemaHint {
  provider?: string | null;
  model: string;
  metadata: unknown;
}

export function buildImageParamsSchema(model: ModelSchemaHint): ParamsSchema {
  const kind = detectImageModelKind({
    provider: model.provider,
    model: model.model,
    metadata: model.metadata as ImageModelHint['metadata'],
  });
  const cap = IMAGE_MODEL_CAPABILITIES[kind];
  const properties: ParamsSchema['properties'] = {};
  const required: string[] = [];

  // size：**用户直接选的控件**（第 2 期由 size-grid 呈现：分辨率分组 + 长宽比）。
  // role: 'wire' —— 它发给上游（preset 里剥掉 @tier 后缀），但不参与计价：
  // 计价看的是从它派生出来的 resolution。
  if (cap.sizes.length > 0) {
    properties.size = {
      type: 'string',
      enum: cap.sizes.map((size) => size.value),
      default: cap.defaults.size,
      'x-ui': {
        role: 'wire',
        control: 'size-grid',
        labelKey: 'pricing.params.size',
        // 选项 label 是语言无关标记（'1:1' / '2K'），走字面量不走 i18n（spec 墙 5）
        optionLabels: Object.fromEntries(cap.sizes.map((size) => [size.value, size.label])),
        groupBy: 'tier',
        order: 10,
      },
    };
    required.push('size');
  }

  // quality：preset.paramBindings.quality（omitWhen: 'empty'）对所有图片模型统一暴露，
  // 但只有模型确有质量档位时才真正可选（gemini flash/pro 无质量轴，运行时发来的空
  // quality 会被 normalizeImageQuality 归一成 undefined 而丢弃）。role: both —— 它既
  // 计价，也要发给上游。无质量轴的模型仍需要一个 stub 属性（role: wire / control:
  // hidden，无 enum、无 default、不进 required）——否则 preset 的 quality 绑定在这些
  // 模型上找不到对应属性，会被 spec §7.2 规则 1b 判成「绑定永远不会触发」。
  if (cap.qualities.length > 0) {
    const values = cap.qualities;
    const fallback = values.includes(cap.defaults.quality) ? cap.defaults.quality : values[0];
    properties.quality = {
      type: 'string',
      enum: values,
      default: fallback,
      'x-ui': {
        role: 'both',
        control: 'chips',
        labelKey: 'pricing.params.quality',
        // 每个档位的显示名走 i18n(pricing.options.<value>)，SchemaForm 才不会显示裸 value token。
        optionLabelKeys: Object.fromEntries(values.map((v) => [v, `pricing.options.${v}`])),
        order: 10,
      },
    };
    required.push('quality');
  } else {
    properties.quality = {
      type: 'string',
      'x-ui': { role: 'wire', control: 'hidden' },
    };
  }

  // resolution：**派生参数**（spec §6.2）。服务端按 size 算，前端传什么都被覆盖 ——
  // 这堵住了「传 size: 4K + resolution: 1K 就按 1K 收费」的洞（spec §6.3）。
  // 仍留在 required：derive 在 validate 之前跑，此时它已存在。
  const tiers = IMAGE_RESOLUTION_ORDER.filter((tier) =>
    cap.sizes.some((size) => resolveImagePricingResolution(size.value) === tier),
  );
  if (tiers.length > 0) {
    const defaultTier = resolveImagePricingResolution(cap.defaults.size);
    const resolutionDefault = defaultTier && tiers.includes(defaultTier) ? defaultTier : tiers[0];
    properties.resolution = {
      type: 'string',
      enum: [...tiers],
      default: resolutionDefault,
      'x-ui': {
        role: 'derived',
        control: 'hidden',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
        labelKey: 'pricing.params.resolution',
        order: 21,
      },
    };
    required.push('resolution');
  }

  // 生成张数(quantity)不进图像 schema：按业务要求，张数由业务逻辑在下单时吃掉，
  // schema 只描述「一张」的参数与价格。故这里不再生成 quantity 属性/控件。

  // 隐藏计价参数：按真实上传张数收费。刻意不设 maximum —— 张数来自服务端计数而非
  // 用户任填，设上限只会在参考图偏多时 ajv 400；hold 本就按真实数量扣费。
  //
  // 上传上限（公开生成器 UI 用，getImageReferenceUploadLimit 读）走 x-ui.uploadMax
  // 而不是 JSON-Schema 的 maximum：这份 paramsSchema 是 chat / canvas / 公开生成器
  // 共享的同一份 image_generation 任务 schema，canvas 的参考图选择没有上游数量上限，
  // ajv 的 maximum 会把 canvas 里合法的 9+ 张组合参考图在 hold 时 400 掉。x-ui 整个
  // 关键字对 ajv 是 valid: true（validate-params.ts），uploadMax 因此只影响 UI，不
  // 影响校验。
  properties.referenceImages = {
    type: 'integer',
    minimum: 0,
    default: 0,
    'x-ui': { role: 'pricing', control: 'hidden', uploadMax: cap.supportsReferenceImage ? 8 : 0 },
  };

  // seed：网关协议（gatewayOpenAIV1.paramBindings.seed）对所有图片模型统一暴露的透传参数
  // （omitWhen: 'empty' —— 不传就不发）。role: 'wire'，不计价、不在 required——可选。
  // 不进 CHOICE_CONTROLS 名单，'hidden' 控件因此不要求 enum（spec §7.2 规则 1a/1b：
  // 每个 preset.paramBindings 的 key 都必须在 paramsSchema 里能找到对应属性，否则
  // 该绑定永远不会触发——这条属性正是补上这个闭合）。
  properties.seed = {
    type: 'integer',
    'x-ui': { role: 'wire', control: 'hidden' },
  };

  // negativePrompt：preset 用 strategy: 'prompt-inject' 把它拼进 prompt（而非独立字段）。
  // 只在模型确实支持负向提示时暴露——'none' 的模型没有对应能力，硬塞这个属性只会让
  // 用户以为填了有效，实际被服务端忽略（cap.supportsNegativePrompt 消费点见
  // packages/domain/src/image/coerce.ts）。
  if (cap.supportsNegativePrompt !== 'none') {
    properties.negativePrompt = {
      type: 'string',
      'x-ui': { role: 'wire', control: 'hidden' },
    };
  }

  return { $schema: JSON_SCHEMA_DRAFT, type: 'object', required, properties };
}

/**
 * 按视频模型的真实能力（VIDEO_MODEL_CAPABILITIES）生成 model 专属 paramsSchema。
 * 只覆盖 resolution 的可选集合与默认值（如 Seedance 2.0 Fast 只有 480p/720p，通用
 * schema 却显示 1080p/4K，导致前端报价与后端钳制后的实际价格不一致），seconds/ratio
 * 沿用通用 preset。allOf（4k 时最长秒数约束）只在支持 4k 的模型上保留。
 *
 * ⚠ 视频链路不在本次重构范围（spec §16）—— 原样搬过来，一个字没改。
 */
export function buildVideoParamsSchema(model: ModelSchemaHint): ParamsSchema {
  const kind = detectVideoModelKind({
    provider: model.provider,
    model: model.model,
    metadata: model.metadata as VideoModelHint['metadata'],
  });
  const cap = VIDEO_MODEL_CAPABILITIES[kind];
  const base = MODEL_PRESETS.video.paramsSchema;
  const resolutions = [...cap.resolutions];
  const defaultResolution = resolutions.includes(cap.defaultResolution)
    ? cap.defaultResolution
    : resolutions[0];
  const has4k = resolutions.includes('4k');

  const schema: ParamsSchema = {
    $schema: base.$schema,
    type: 'object',
    required: [...(base.required ?? [])],
    properties: {
      ...base.properties,
      resolution: { ...base.properties.resolution, enum: resolutions, default: defaultResolution },
    },
  };
  if (has4k && base.allOf) schema.allOf = base.allOf;
  return schema;
}
