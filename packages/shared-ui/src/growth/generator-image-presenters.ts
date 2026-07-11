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
