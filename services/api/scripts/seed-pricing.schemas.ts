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

  // size：上游真正要的参数。此前根本不在 schema 里（spec §3）—— paramsSchema 一直只
  // 描述「计价用到的那些参数」，而 size 不计价，于是它就漏了。
  //
  // ⚠ 第 1 期它是 wire + hidden + **无 default + 不进 required**，也就是「存在但惰性」：
  //   - hidden → SchemaForm 跳过它 → 表单外观不变
  //   - 无 default → applyParamDefaults 不会填它
  //   - 不进 required → 今天只发 resolution、不发 size 的调用方不会 400
  //
  // 第 2 期才由 size-grid 控件让用户直接选 size，届时 resolution 翻转成 derived+hidden
  // （spec §11 第 2 期第 8 条）。**方向不能在第 1 期翻**：今天 resolution 才是用户在点的
  // 那个控件（SchemaForm 渲染它），size 是从它反推出来的。
  if (cap.sizes.length > 0) {
    properties.size = {
      type: 'string',
      enum: cap.sizes.map((size) => size.value),
      'x-ui': {
        role: 'wire',
        control: 'hidden',
        labelKey: 'pricing.params.size',
        // 选项 label 是语言无关标记（'1:1' / '16:9'），走字面量而非 i18n key。
        optionLabels: Object.fromEntries(cap.sizes.map((size) => [size.value, size.label])),
        groupBy: 'tier',
        order: 10,
      },
    };
  }

  // quality：仅当模型确有质量档位时给（gemini flash/pro 无质量轴 → 不给该属性，
  // 运行时发来的空 quality 会被 normalizeImageQuality 归一成 undefined 而丢弃）。
  // role: both —— 它既计价，也要发给上游。
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
  }

  // resolution：模型真实可达的档位（对每个 size 求 resolveImagePricingResolution 去重）。
  // compatible 的所有尺寸都落在 1K，所以只有 1K 一档。
  //
  // role: pricing —— 它只计价，**不发给上游**（上游要的是 size）。
  // 它是用户在工作台上点的那个「分辨率」控件（SchemaForm 按 control:'chips' 渲染），
  // 所以第 1 期保持可见、保持 required。
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
        role: 'pricing',
        control: 'chips',
        labelKey: 'pricing.params.resolution',
        order: 20,
      },
    };
    required.push('resolution');
  }

  // 生成张数(quantity)不进图像 schema：按业务要求，张数由业务逻辑在下单时吃掉，
  // schema 只描述「一张」的参数与价格。故这里不再生成 quantity 属性/控件。

  // 隐藏计价参数：按真实上传张数收费。刻意不设 maximum —— 张数来自服务端计数而非
  // 用户任填，设上限只会在参考图偏多时 ajv 400；hold 本就按真实数量扣费。
  properties.referenceImages = {
    type: 'integer',
    minimum: 0,
    default: 0,
    'x-ui': { role: 'pricing', control: 'hidden' },
  };

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
