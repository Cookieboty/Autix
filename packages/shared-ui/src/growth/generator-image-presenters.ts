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

export function getImageCountControl(
  capability: Pick<ImageModelCapability, 'maxCount' | 'defaults'>,
): { visible: boolean; max: number; default: number } {
  return {
    // 生成张数(count)已从图像模型配置里移除，不再作为用户可调项暴露——张数由业务逻辑
    // 在下单时决定并计价（计价 schema 只算单张）。故永远隐藏该控件；max/default 仍返回
    // 供调用方把 count 归一到合法单张默认值。
    visible: false,
    max: capability.maxCount,
    default: capability.defaults.count,
  };
}

export function getImageReferenceUploadLimit(
  capability: Pick<ImageModelCapability, 'supportsReferenceImage'>,
) {
  return capability.supportsReferenceImage ? 8 : 0;
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
