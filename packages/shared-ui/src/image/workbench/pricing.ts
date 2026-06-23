import type {
  GenerationPricingEstimateInput,
  ModelConfigItem,
} from '@autix/shared-store';
import type { ImageStudioModelSettings } from '../ImageStudioWorkspace';

export function resolveImagePricingTaskType(settings: ImageStudioModelSettings): string {
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
}): GenerationPricingEstimateInput {
  return {
    taskType: resolveImagePricingTaskType(settings),
    modelProvider: model?.provider ?? undefined,
    modelName: model?.model ?? selectedModelId,
    ...(settings.quality ? { quality: String(settings.quality) } : {}),
    resolution: String(settings.size ?? ''),
    quantity: 1,
    referenceImages,
    usesTemplate: false,
  };
}
