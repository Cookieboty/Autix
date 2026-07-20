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

  // ratio 也必须按能力表出，且与前端下拉同源（VIDEO_ASPECT_RATIO_VALUES）。否则前端能选
  // adaptive/4:3/3:4/21:9，而 schema 只允许 1:1/16:9/9:16 → 创建 clip 时 ajv 直接拒
  // 「/ratio must be equal to one of the allowed values」，链路根本进不到生成。
  const ratios = [...cap.ratios];
  const defaultRatio = ratios.includes(cap.defaultRatio) ? cap.defaultRatio : ratios[0];

  const schema: ParamsSchema = {
    $schema: base.$schema,
    type: 'object',
    required: [...(base.required ?? [])],
    properties: {
      ...base.properties,
      resolution: { ...base.properties.resolution, enum: resolutions, default: defaultResolution },
      ratio: { ...base.properties.ratio, enum: ratios, default: defaultRatio },
      // 出声开关。Seedance 的协议 preset 一直就把 generate_audio 发上游
      // （vendors.ts 的 paramBindings），但 schema 从没声明过这个属性 ——
      // 前端按 schema 渲染参数，于是 Seedance 的音频开关从来没出现过，
      // 用户无法控制出不出声。cap.audio 为真的模型才给。
      ...(cap.audio
        ? {
            generate_audio: {
              type: 'boolean',
              default: true,
              'x-ui': { role: 'both', control: 'switch', order: 40, labelKey: 'pricing.params.generateAudio' },
            },
          }
        : {}),
    },
  };
  if (has4k && base.allOf) schema.allOf = base.allOf;
  return schema;
}
