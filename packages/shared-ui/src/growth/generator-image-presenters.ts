import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  type ImageModelCapability,
} from '@autix/domain/image';
import type { ModelConfigItem } from '@autix/shared-store';

// PHASE 2: replace this default with the public model list from /api/public/models.
const DEFAULT_IMAGE_KIND = 'gemini-3-pro-image' as const;

export function resolveImageCapabilityFromModelParam(
  model?: string | null,
): ImageModelCapability {
  if (!model) return IMAGE_MODEL_CAPABILITIES[DEFAULT_IMAGE_KIND];
  const kind = detectImageModelKind({ model });
  if (kind === 'compatible' && !/compatible|sdxl|flux/i.test(model)) {
    return IMAGE_MODEL_CAPABILITIES[DEFAULT_IMAGE_KIND];
  }
  return IMAGE_MODEL_CAPABILITIES[kind];
}

/**
 * 公开生成器的参考图上传上限 —— 唯一来自模型 paramsSchema.properties.referenceImages
 * ['x-ui'].uploadMax（不是 JSON-Schema 的 maximum：那会被 ajv 校验，而这份 schema
 * 是 chat / canvas / 公开生成器共享的同一份 image_generation 任务 schema，canvas 的
 * 参考图选择没有上游数量上限，maximum 会把 canvas 里合法的多图请求在 hold 时 400
 * 掉）。paramsSchema 缺失（尚未拉到 / 模型不识别）或 uploadMax 缺失（模型不支持
 * 参考图，或该行是本次改动之前 seed 的旧数据）时返回 0：不再 fallback 到静态能力表
 * 的 supportsReferenceImage，那条路径正是 DEFAULT_IMAGE_KIND 洞的来源之一——未识别
 * 模型会被静默当成 gemini-3-pro-image 的能力表。
 */
export function getImageReferenceUploadLimit(
  paramsSchema:
    | { properties?: Record<string, { 'x-ui'?: { uploadMax?: number } }> }
    | undefined,
): number {
  return paramsSchema?.properties?.referenceImages?.['x-ui']?.uploadMax ?? 0;
}

function normalizeModelHint(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function findImageModelByHint(models: ModelConfigItem[], hint: string | null | undefined) {
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedHint) return null;
  const fields = (model: ModelConfigItem) => [
    model.id,
    model.name,
    model.model,
    `${model.provider ?? ''} ${model.model ?? ''}`,
  ];
  // 先精确匹配：避免 "Nano Banana 2" 的归一化 "nanobanana2" 作为子串命中
  // "Nano Banana 2 Lite"（"nanobanana2lite"）这类歧义——精确名/id 应稳定选中自身，
  // 与数组顺序无关。这也让「点模型名跳转」可以安全用可读的模型名。
  const exact = models.find((model) =>
    fields(model).some((candidate) => normalizeModelHint(candidate) === normalizedHint),
  );
  if (exact) return exact;
  // 回退：子串模糊匹配（兼容广场 recreate 等历史带入的部分 hint，如 "Nano Banana"）
  return models.find((model) =>
    fields(model).some((candidate) => normalizeModelHint(candidate).includes(normalizedHint)),
  ) ?? null;
}
