import type {
  GenerationPricingEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import { DEFAULT_VIDEO_FRAME_DURATION } from '../video/video-input-utils';

export function normalizeImagePricingQuality(value: unknown): 'low' | 'medium' | 'high' {
  const quality = String(value ?? '').toLowerCase();
  if (quality.includes('low')) return 'low';
  if (quality.includes('high') || quality.includes('hd')) return 'high';
  return 'medium';
}

function resolveImagePricingTaskType(quality: unknown): string {
  const normalized = normalizeImagePricingQuality(quality);
  if (normalized === 'low') return 'gpt_image_2_low';
  if (normalized === 'high') return 'gpt_image_2_high';
  return 'gpt_image_2_medium';
}

export function normalizeVideoResolution(value: unknown): string {
  const resolution = String(value ?? '720p').toLowerCase();
  if (resolution.includes('1080')) return '1080p';
  if (resolution.includes('480')) return '480p';
  return '720p';
}

function resolveSeedancePricingTaskType(
  model: ModelConfigItem | null | undefined,
  resolutionValue: unknown,
): string {
  const resolution = normalizeVideoResolution(resolutionValue);
  const modelName = `${model?.model ?? ''} ${model?.name ?? ''}`.toLowerCase();
  if (resolution === '1080p') return 'seedance_1080p';
  if (resolution === '480p') return 'seedance_480p';
  if (modelName.includes('fast')) return 'seedance_fast_720p';
  return 'seedance_720p';
}

export function buildImageEstimateInput(params: {
  model: ModelConfigItem;
  quality: string;
  size: string;
  count: number;
  referenceImageCount: number;
}): GenerationPricingEstimateInput {
  return {
    taskType: resolveImagePricingTaskType(params.quality),
    modelProvider: params.model.provider ?? undefined,
    modelName: params.model.model ?? params.model.id,
    quality: normalizeImagePricingQuality(params.quality),
    resolution: params.size,
    quantity: params.count,
    referenceImages: params.referenceImageCount,
  };
}

export function buildVideoEstimateInput(params: {
  model: ModelConfigItem | null | undefined;
  resolutionValue: unknown;
  duration: number;
  mode: 'reference' | 'first_last_frame' | 'smart_multiframe';
  materials: VideoMaterial[];
  frames: FrameSlot[];
}): GenerationPricingEstimateInput {
  const isReferenceMode = params.mode === 'reference';
  return {
    taskType: resolveSeedancePricingTaskType(params.model, params.resolutionValue),
    modelProvider: params.model?.provider ?? undefined,
    modelName: params.model?.model,
    resolution: normalizeVideoResolution(params.resolutionValue),
    seconds: Math.max(1, Number(params.duration) || DEFAULT_VIDEO_FRAME_DURATION),
    referenceImages: isReferenceMode
      ? params.materials.filter((material) => material.type === 'image').length
      : params.frames.filter((frame) => frame.material?.type === 'image').length,
    hasVideoInput: isReferenceMode
      ? params.materials.some((material) => material.type === 'video')
      : params.frames.some((frame) => frame.material?.type === 'video'),
    hasAudioInput: params.materials.some((material) => material.type === 'audio'),
  };
}
