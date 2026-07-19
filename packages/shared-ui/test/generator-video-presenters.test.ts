import {
  computeTaskEstimate,
  MODEL_PRESETS,
  type ParamsSchema,
  type PricingSchema,
} from '@autix/domain/pricing';
import {
  buildPublicVideoEstimateInput,
  findVideoModelByHint,
  resolveVideoCapabilityFromModelConfig,
  resolveVideoCapabilityFromModelParam,
} from '../src/growth/generator-video-presenters';
import type { ModelConfigItem } from '@autix/shared-store';

describe('resolveVideoCapabilityFromModelParam', () => {
  test('无模型时归到通用 compatible 能力，不做任何硬编码兜底', () => {
    // 删掉 DEFAULT_PUBLIC_VIDEO_MODEL 后：DB 没配模型 → 不再默认 seedance-2.0，
    // 而是走 detectVideoModelKind 的通用 'compatible' 分支。
    const cap = resolveVideoCapabilityFromModelParam(null);
    expect(cap.kind).toBe('compatible');
    expect(cap.displayName).toBe('Compatible video model');
    expect(cap.resolutions.length).toBeGreaterThan(0);
    expect(cap.resolutions).toContain(cap.defaultResolution);
    expect(cap.resolutions).not.toContain('4k');
  });

  test('a fast variant exposes the narrower resolution set', () => {
    const cap = resolveVideoCapabilityFromModelParam('seedance-2.0-fast');
    expect(cap.resolutions).not.toContain('4k');
  });
});

describe('resolveVideoCapabilityFromModelConfig', () => {
  test('uses model config metadata for dynamic video capability', () => {
    const model = {
      id: 'seedance-fast-id',
      name: 'Seedance Fast',
      model: 'doubao-seedance-2.0-fast',
      provider: 'bytedance',
      type: 'video',
      priority: 1,
      isDefault: false,
      capabilities: ['video'],
      visibility: 'public',
      metadata: {
        videoModelKind: 'seedance-2.0-fast',
      },
    } satisfies ModelConfigItem;

    const cap = resolveVideoCapabilityFromModelConfig(model);

    expect(cap.displayName).toBe('Seedance 2.0 Fast');
    // fast 档按上游文档只有 720p（此前表里多给的 480p 上游并不支持，选中即失败）
    expect(cap.resolutions).toEqual(['720p']);
  });
});

describe('findVideoModelByHint', () => {
  test('matches by id, name, model, or provider/model text', () => {
    const models = [
      {
        id: 'model-a',
        name: 'Seedance Fast',
        model: 'doubao-seedance-2.0-fast',
        provider: 'bytedance',
        type: 'video',
        priority: 1,
        isDefault: false,
        capabilities: ['video'],
        visibility: 'public',
      },
    ] satisfies ModelConfigItem[];

    expect(findVideoModelByHint(models, 'seedance fast')?.id).toBe('model-a');
    expect(findVideoModelByHint(models, 'bytedance seedance')?.id).toBe('model-a');
  });
});

describe('buildPublicVideoEstimateInput', () => {
  test('builds video pricing input for the public generator CTA', () => {
    expect(
      buildPublicVideoEstimateInput({
        model: 'seedance-2.0',
        duration: 5,
        resolution: '1080p',
        generateAudio: true,
      }),
    ).toEqual({
      taskType: 'video_generation',
      modelConfigId: undefined,
      params: {
        resolution: '1080p',
        duration: 5,
        referenceImages: 0,
        hasVideoInput: false,
        hasAudioInput: true,
        // PoYo VEO 计价读 generate_audio；本地预估随之带上（seedance 不读，无害）。
        generate_audio: true,
      },
    });
  });

  test('normalizes unsupported resolution and invalid duration', () => {
    expect(
      buildPublicVideoEstimateInput({
        model: 'seedance-2.0-fast',
        duration: 0,
        resolution: '4k',
        generateAudio: false,
      }),
    ).toMatchObject({
      params: {
        resolution: '720p',
        duration: 1,
        hasAudioInput: false,
      },
    });
  });

  test('prefers selected public model config for pricing rules', () => {
    const modelConfig = {
      id: 'seedance-lite-id',
      name: 'Seedance Lite',
      model: 'doubao-seedance-2.0-fast',
      provider: 'bytedance',
      type: 'video',
      priority: 1,
      isDefault: false,
      capabilities: ['video'],
      visibility: 'public',
      metadata: {
        videoModelKind: 'seedance-2.0-fast',
      },
    } satisfies ModelConfigItem;

    expect(
      buildPublicVideoEstimateInput({
        model: modelConfig.id,
        modelConfig,
        duration: 4,
        resolution: '4k',
        generateAudio: true,
      }),
    ).toMatchObject({
      modelConfigId: 'seedance-lite-id',
      params: {
        resolution: '720p',
        duration: 4,
        hasAudioInput: true,
      },
    });
  });

  test('never puts a token key in params, and never sets a usage field', () => {
    const input = buildPublicVideoEstimateInput({
      model: 'seedance-2.0',
      duration: 5,
      resolution: '720p',
      generateAudio: false,
    });
    expect(Object.keys(input.params)).not.toContain('inputTokens');
    expect(Object.keys(input.params)).not.toContain('outputTokens');
    expect(input).not.toHaveProperty('usage');
  });
});

/**
 * 视频计价迁到前端本地计算（不再打 /points/estimate）。承重点是「展示 == 扣费」：
 * VideoSidebar 用 buildPublicVideoEstimateInput 造参 + computeTaskEstimate 本地算价，
 * 与服务端 TaskPricingEstimatorService.estimateCost 调**同一个** computeTaskEstimate。
 * video_generation 的 fixedCostSchema 为 null（presets.ts），所以本地必须传
 * taskFixedSchema: null —— 传错（比如误用某个 fixedFee）会让展示价与实际扣费分裂。
 */
describe('本地视频计价：display == charge', () => {
  const videoPreset = MODEL_PRESETS.video;
  const pricingSchema = videoPreset.pricingSchema as unknown as PricingSchema;
  const paramsSchema = videoPreset.paramsSchema as unknown as ParamsSchema;

  test('presenter 造参 + computeTaskEstimate 本地算出整数点数，无 violations', () => {
    // 1080p × 5s，用 video 预设：base(add 1) → resolution(mul 800) → duration(mul ×5) = 4000。
    const { params } = buildPublicVideoEstimateInput({
      model: 'seedance-2.0',
      duration: 5,
      resolution: '1080p',
      generateAudio: true,
    });
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params,
    });
    expect(result.violations).toEqual([]);
    expect(Number.isInteger(result.total)).toBe(true);
    expect(result.total).toBe(4000);
  });

  test('倍率与折扣参与计价，仍取整（ceil）', () => {
    const { params } = buildPublicVideoEstimateInput({
      model: 'seedance-2.0',
      duration: 4,
      resolution: '720p',
      generateAudio: false,
    });
    // base 1 → ×320(720p) → ×4s = 1280；×1.5 倍率 ×0.6 折扣 = 1152。
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 1.5,
      discountFactor: 0.6,
      taskFixedSchema: null,
      params,
    });
    expect(result.violations).toEqual([]);
    expect(result.total).toBe(1152);
  });
});
