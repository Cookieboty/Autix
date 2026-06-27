import {
  normalizeVideoResolutionForModel,
  resolveVideoModelCapability,
  type VideoModelCapability,
} from '@autix/domain/video';
import type { GenerationPricingEstimateInput } from '@autix/shared-store';

export const DEFAULT_PUBLIC_VIDEO_MODEL = 'seedance-2.0';

// PHASE 2: replace with public model list from /api/public/models.
export function resolveVideoCapabilityFromModelParam(
  model?: string | null,
): VideoModelCapability {
  return resolveVideoModelCapability({ model: model || DEFAULT_PUBLIC_VIDEO_MODEL });
}

export function buildPublicVideoEstimateInput({
  model,
  duration,
  resolution,
  generateAudio,
}: {
  model?: string | null;
  duration: number;
  resolution: string;
  generateAudio: boolean;
}): GenerationPricingEstimateInput {
  return {
    taskType: 'video_generation',
    modelName: model || DEFAULT_PUBLIC_VIDEO_MODEL,
    resolution: normalizeVideoResolutionForModel(resolution, { model: model || DEFAULT_PUBLIC_VIDEO_MODEL }),
    seconds: Math.max(1, Math.ceil(Number(duration) || 1)),
    referenceImages: 0,
    hasVideoInput: false,
    hasAudioInput: generateAudio,
  };
}
