import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import type { ModelConfigItem } from '@autix/shared-store';
import type {
  ImageStudioModelSettings,
  ImageStudioReference,
} from '../ImageStudioWorkspace';

export function buildDefaultImageWorkbenchSettings(
  model?: ModelConfigItem | null,
): ImageStudioModelSettings {
  const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
  return {
    size: cap.defaults.size,
    quality: cap.defaults.quality,
    count: 1,
    guidanceScale: 7,
    steps: 30,
    seed: '',
    promptTuning: 'auto',
    stylePreset: 'general',
    negativePrompt: '',
  };
}

export function buildImageWorkbenchRequestSettings(
  settings: ImageStudioModelSettings,
  options: { skipPromptTuning?: boolean } = {},
) {
  return {
    size: settings.size,
    quality: settings.quality,
    guidanceScale: settings.guidanceScale,
    steps: settings.steps,
    seed: settings.seed || undefined,
    promptTuning: settings.promptTuning,
    stylePreset: settings.stylePreset,
    negativePrompt: settings.negativePrompt || undefined,
    ...(options.skipPromptTuning ? { skipPromptTuning: true } : {}),
  };
}

export type ImageWorkbenchRequestSettings = ReturnType<
  typeof buildImageWorkbenchRequestSettings
>;

export function toUploadableImageReferences(urls: string[]): ImageStudioReference[] {
  return urls.map((url, index) => ({ url, index }));
}
