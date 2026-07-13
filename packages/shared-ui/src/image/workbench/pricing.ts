import type {
  TaskEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import { resolveImagePricingResolution } from '@autix/domain/image';
import type { ImageStudioModelSettings } from '../ImageStudioWorkspace';

export function resolveImagePricingTaskType(_settings: ImageStudioModelSettings): string {
  return 'image_generation';
}

export function buildImageWorkbenchEstimateInput({
  settings,
  model,
  selectedModelId,
  referenceImages,
}: {
  settings: ImageStudioModelSettings;
  model?: ModelConfigItem | null;
  selectedModelId: string;
  referenceImages: number;
}): TaskEstimateInput {
  const pricingResolution = resolveImagePricingResolution(settings.size);
  return {
    taskType: resolveImagePricingTaskType(settings),
    modelConfigId: model?.id ?? selectedModelId,
    params: {
      ...(settings.quality ? { quality: String(settings.quality) } : {}),
      ...(pricingResolution ? { resolution: pricingResolution } : {}),
      referenceImages,
    },
  };
}
