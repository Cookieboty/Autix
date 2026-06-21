import type {
  GenerationPricingEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import type { ImageStudioModelSettings } from '../ImageStudioWorkspace';

export function normalizeImagePricingQuality(
  settings: ImageStudioModelSettings,
): 'low' | 'medium' | 'high' {
  const quality = String(settings.quality ?? '').toLowerCase();
  if (quality.includes('low')) return 'low';
  if (quality.includes('high') || quality.includes('hd')) return 'high';
  return 'medium';
}

export function resolveImagePricingTaskType(settings: ImageStudioModelSettings): string {
  const quality = normalizeImagePricingQuality(settings);
  if (quality.includes('low')) return 'gpt_image_2_low';
  if (quality.includes('high')) return 'gpt_image_2_high';
  return 'gpt_image_2_medium';
}

export function resolveEstimateQuality(
  settings: ImageStudioModelSettings,
  normalizePricingQuality: boolean,
): string {
  return normalizePricingQuality
    ? normalizeImagePricingQuality(settings)
    : String(settings.quality ?? 'medium');
}

export function buildImageWorkbenchEstimateInput({
  settings,
  model,
  selectedModelId,
  normalizePricingQuality,
  referenceImages,
}: {
  settings: ImageStudioModelSettings;
  model?: ModelConfigItem | null;
  selectedModelId: string;
  normalizePricingQuality: boolean;
  referenceImages: number;
}): GenerationPricingEstimateInput {
  return {
    taskType: resolveImagePricingTaskType(settings),
    modelProvider: model?.provider ?? undefined,
    modelName: model?.model ?? selectedModelId,
    quality: resolveEstimateQuality(settings, normalizePricingQuality),
    resolution: String(settings.size ?? ''),
    quantity: settings.count,
    referenceImages,
  };
}
