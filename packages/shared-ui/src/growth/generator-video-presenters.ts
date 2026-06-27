import {
  resolveVideoModelCapability,
  type VideoModelCapability,
} from '@autix/domain/video';

export const DEFAULT_PUBLIC_VIDEO_MODEL = 'seedance-2.0';

// PHASE 2: replace with public model list from /api/public/models.
export function resolveVideoCapabilityFromModelParam(
  model?: string | null,
): VideoModelCapability {
  return resolveVideoModelCapability({ model: model || DEFAULT_PUBLIC_VIDEO_MODEL });
}
