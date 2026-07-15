import { describe, it, expect } from 'vitest';
import { DEFAULT_FEATURES, serializeFeatures, toFeatureConfig } from './levels-view.features';

describe('levels-view features image.concurrency', () => {
  it('round-trips image.concurrency through serialize → deserialize', () => {
    const config = { ...DEFAULT_FEATURES, image: { concurrency: 4 } };
    const restored = toFeatureConfig(serializeFeatures(config));
    expect(restored.image.concurrency).toBe(4);
  });

  it('defaults image.concurrency to 1 for legacy features without an image key', () => {
    const restored = toFeatureConfig({ seedance: { enabled: false } });
    expect(restored.image.concurrency).toBe(1);
  });

  it('DEFAULT_FEATURES.image.concurrency is 1', () => {
    expect(DEFAULT_FEATURES.image.concurrency).toBe(1);
  });
});
