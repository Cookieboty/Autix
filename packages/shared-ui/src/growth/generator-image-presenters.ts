import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  type ImageModelCapability,
} from '@autix/domain/image';

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
    visible: capability.maxCount > 1,
    max: capability.maxCount,
    default: capability.defaults.count,
  };
}
