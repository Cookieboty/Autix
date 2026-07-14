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

export { buildImageParamsSchema } from './seed-image-params';

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
