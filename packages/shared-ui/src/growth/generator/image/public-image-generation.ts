import type {
  GenerationPricingEstimateInput,
  ModelConfigItem,
  PublicImageGenerateResult,
} from '@autix/shared-store';
import { resolveImagePricingResolution } from '@autix/domain/image';

export interface PublicImageGenerationSettings extends Record<string, unknown> {
  size: string;
  quality?: string;
  count: number;
  guidanceScale: number;
  steps: number;
  promptTuning: string;
  stylePreset: string;
  negativePrompt?: string;
  skipPromptTuning: boolean;
}

export interface PublicImageGenerationPayload {
  prompt: string;
  referenceImages: string[];
  settings: PublicImageGenerationSettings;
  model: string;
}

export interface PublicImageHistoryImage {
  url: string;
  prompt?: string;
  generationId?: string;
  index: number;
}

export interface PublicImageHistoryItem {
  id: string;
  prompt: string;
  model: string;
  createdAt: string;
  images: PublicImageHistoryImage[];
  settings: PublicImageGenerationSettings;
}

export function buildPublicImageGenerationSettings(input: {
  size: string;
  quality?: string;
  count: number;
}): PublicImageGenerationSettings {
  return {
    size: input.size,
    quality: input.quality || undefined,
    count: input.count,
    guidanceScale: 7,
    steps: 30,
    promptTuning: 'auto',
    stylePreset: 'general',
    skipPromptTuning: true,
  };
}

function normalizeImageQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.max(1, Math.floor(quantity));
}

export function buildPublicImageEstimateInput({
  settings,
  model,
  selectedModelId,
  referenceImages,
}: {
  settings: PublicImageGenerationSettings;
  model?: ModelConfigItem | null;
  selectedModelId: string;
  referenceImages: number;
}): GenerationPricingEstimateInput {
  const pricingResolution = resolveImagePricingResolution(settings.size);
  return {
    taskType: 'image_generation',
    modelProvider: model?.provider ?? undefined,
    modelName: model?.model ?? selectedModelId,
    ...(settings.quality ? { quality: String(settings.quality) } : {}),
    ...(pricingResolution ? { resolution: pricingResolution } : {}),
    quantity: normalizeImageQuantity(settings.count),
    referenceImages,
  };
}

export function buildPublicImageHistoryItem({
  data,
  request,
  createdAt,
}: {
  data: PublicImageGenerateResult;
  request: PublicImageGenerationPayload;
  createdAt: string;
}): PublicImageHistoryItem {
  const fallbackId = `public-image-${Date.now()}`;
  const images = (data.images ?? []).map((image, index) => ({
    url: image.url,
    prompt: image.prompt ?? data.prompt ?? request.prompt,
    generationId: image.generationId ?? fallbackId,
    index: image.index ?? index,
  }));

  return {
    id: images[0]?.generationId ?? fallbackId,
    prompt: data.prompt ?? request.prompt,
    model: data.model ?? request.model,
    createdAt,
    images,
    settings: request.settings,
  };
}
