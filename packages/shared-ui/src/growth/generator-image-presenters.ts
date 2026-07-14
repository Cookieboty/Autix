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
 * .maximum（spec §12）。paramsSchema 缺失（尚未拉到 / 模型不识别）时返回 0：不再
 * fallback 到静态能力表的 supportsReferenceImage，那条路径正是 DEFAULT_IMAGE_KIND
 * 洞的来源之一——未识别模型会被静默当成 gemini-3-pro-image 的能力表。
 */
export function getImageReferenceUploadLimit(
  paramsSchema: { properties?: Record<string, { maximum?: number }> } | undefined,
): number {
  return paramsSchema?.properties?.referenceImages?.maximum ?? 0;
}

function normalizeModelHint(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function findImageModelByHint(models: ModelConfigItem[], hint: string | null | undefined) {
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedHint) return null;
  return models.find((model) =>
    [
      model.id,
      model.name,
      model.model,
      `${model.provider ?? ''} ${model.model ?? ''}`,
    ].some((candidate) => normalizeModelHint(candidate).includes(normalizedHint)),
  ) ?? null;
}
