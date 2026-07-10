import { describe, expect, test } from 'bun:test';
import { buildImageWorkbenchEstimateInput } from '../src/image/workbench/pricing';
import { buildImageWorkbenchRequestSettings } from '../src/image/workbench/settings';
import type { ImageStudioModelSettings } from '../src/image/ImageStudioWorkspace';

const settings: ImageStudioModelSettings = {
  size: '1024x1024',
  quality: 'standard',
  count: 3,
  guidanceScale: 7,
  steps: 30,
  seed: '',
  promptTuning: 'auto',
  stylePreset: 'general',
  negativePrompt: '',
};

describe('image workbench count', () => {
  test('uses settings count for pricing quantity', () => {
    expect(
      buildImageWorkbenchEstimateInput({
        settings,
        selectedModelId: 'compatible-image',
        referenceImages: 0,
      }).params.quantity,
    ).toBe(3);
  });

  test('sends count in generation settings', () => {
    expect(buildImageWorkbenchRequestSettings(settings).count).toBe(3);
  });
});
