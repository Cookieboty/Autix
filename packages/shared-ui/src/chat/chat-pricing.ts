import type {
  TaskEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import { resolveImagePricingResolution } from '@autix/domain/image';
import { normalizeVideoResolutionForModel } from '@autix/domain/video';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import { DEFAULT_VIDEO_FRAME_DURATION } from '../video/video-input-utils';

function resolveImagePricingTaskType(_quality: unknown): string {
  return 'image_generation';
}

export function normalizeVideoResolution(value: unknown): string {
  return normalizeVideoResolutionForModel(value);
}

function resolveVideoPricingTaskType(
  _model: ModelConfigItem | null | undefined,
  _resolutionValue: unknown,
): string {
  return 'video_generation';
}

export function buildImageEstimateInput(params: {
  model: ModelConfigItem;
  quality: string;
  size: string;
  referenceImageCount: number;
}): TaskEstimateInput {
  const pricingResolution = resolveImagePricingResolution(params.size);
  return {
    taskType: resolveImagePricingTaskType(params.quality),
    modelConfigId: params.model.id,
    params: {
      ...(params.quality ? { quality: params.quality } : {}),
      ...(pricingResolution ? { resolution: pricingResolution } : {}),
      referenceImages: params.referenceImageCount,
    },
  };
}

export function buildVideoEstimateInput(params: {
  model: ModelConfigItem | null | undefined;
  resolutionValue: unknown;
  duration: number;
  mode: 'reference' | 'first_last_frame' | 'smart_multiframe';
  materials: VideoMaterial[];
  frames: FrameSlot[];
}): TaskEstimateInput {
  const isReferenceMode = params.mode === 'reference';
  return {
    taskType: resolveVideoPricingTaskType(params.model, params.resolutionValue),
    modelConfigId: params.model?.id,
    params: {
      resolution: normalizeVideoResolutionForModel(params.resolutionValue, params.model),
      // 原生化后计价参数即火山原生名 duration；pricingSchema perUnit duration。
      duration: Math.max(1, Number(params.duration) || DEFAULT_VIDEO_FRAME_DURATION),
      referenceImages: isReferenceMode
        ? params.materials.filter((material) => material.type === 'image').length
        : params.frames.filter((frame) => frame.material?.type === 'image').length,
      hasVideoInput: isReferenceMode
        ? params.materials.some((material) => material.type === 'video')
        : params.frames.some((frame) => frame.material?.type === 'video'),
      hasAudioInput: params.materials.some((material) => material.type === 'audio'),
    },
  };
}
