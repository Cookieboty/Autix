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
  test('does NOT send count into pricing params — quantity 是死参数', () => {
    // pricingSchema 只描述「一张」的参数与价格，schema 里根本没有 quantity 属性、
    // 也没有任何计价 term 引用它。张数由业务逻辑在下单时吃掉（hold = 单张价 × 张数）。
    // 变异测试：若有人把 quantity 加回去，这条会红。
    expect(
      buildImageWorkbenchEstimateInput({
        settings,
        selectedModelId: 'compatible-image',
        referenceImages: 0,
      }).params,
    ).not.toHaveProperty('quantity');
  });

  test('sends count in generation settings', () => {
    expect(buildImageWorkbenchRequestSettings(settings).count).toBe(3);
  });
});
