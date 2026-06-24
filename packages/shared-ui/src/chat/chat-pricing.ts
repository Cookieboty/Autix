import type {
  GenerationPricingEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import { resolveImagePricingResolution } from '@autix/domain/image';
import { normalizeVideoResolutionForModel } from '@autix/domain/video';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import { DEFAULT_VIDEO_FRAME_DURATION } from '../video/video-input-utils';

function resolveImagePricingTaskType(quality: unknown): string {
  return 'image_generation';
}

export function normalizeVideoResolution(value: unknown): string {
  return normalizeVideoResolutionForModel(value);
}

function resolveVideoPricingTaskType(
  model: ModelConfigItem | null | undefined,
  resolutionValue: unknown,
): string {
  return 'video_generation';
}

export function buildImageEstimateInput(params: {
  model: ModelConfigItem;
  quality: string;
  size: string;
  referenceImageCount: number;
}): GenerationPricingEstimateInput {
  const pricingResolution = resolveImagePricingResolution(params.size);
  return {
    taskType: resolveImagePricingTaskType(params.quality),
    modelProvider: params.model.provider ?? undefined,
    modelName: params.model.model ?? params.model.id,
    ...(params.quality ? { quality: params.quality } : {}),
    ...(pricingResolution ? { resolution: pricingResolution } : {}),
    quantity: 1,
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
    taskType: resolveVideoPricingTaskType(params.model, params.resolutionValue),
    modelProvider: params.model?.provider ?? undefined,
    modelName: params.model?.model,
    resolution: normalizeVideoResolutionForModel(params.resolutionValue, params.model),
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
