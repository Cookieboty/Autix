import { describe, expect, it } from 'vitest';
import { MODEL_PRESETS, TASK_PRESETS } from './presets';
import { quoteTask } from './quote';
import { validateParamsSchema, validatePricingSchema } from './validate-schema';
import { validateParams } from './validate-params';

const quote = (key: keyof typeof MODEL_PRESETS, params: Record<string, unknown>) =>
  quoteTask({
    modelSchema: MODEL_PRESETS[key].pricingSchema,
    multiplier: 1,
    discountFactor: 1,
    params,
  }).total;

describe('presets — structural validity', () => {
  it('every model preset passes save-time validation', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      expect(validatePricingSchema(preset.pricingSchema), key).toEqual([]);
    }
  });

  it('every model preset passes params-schema and cross-schema validation', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      // 第二个参数触发跨 schema 引用完整性校验：pricingSchema 引用的每个参数
      // 必须存在于 paramsSchema.properties。这是 preset 里最容易出的错——
      // 写了 table: { param: 'style' } 却忘了在 paramsSchema 里声明 style，
      // 该 term 会被静默跳过，价格不变，没有任何报错。
      expect(validateParamsSchema(preset.paramsSchema, preset.pricingSchema), key).toEqual([]);
    }
  });

  it('every task fixedCostSchema passes save-time validation', () => {
    for (const task of TASK_PRESETS) {
      if (!task.fixedCostSchema) continue;
      expect(validatePricingSchema(task.fixedCostSchema), task.taskType).toEqual([]);
    }
  });

  it('every model preset default params satisfy its own paramsSchema', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      const defaults = Object.fromEntries(
        Object.entries(preset.paramsSchema.properties)
          .filter(([, p]) => p.default !== undefined)
          .map(([name, p]) => [name, p.default]),
      );
      expect(validateParams(preset.paramsSchema, defaults), key).toEqual([]);
    }
  });

  it('declares exactly the nine known task types', () => {
    expect(TASK_PRESETS.map((t) => t.taskType).sort()).toEqual([
      'chat_message_fast',
      'chat_message_reasoning',
      'chat_message_standard',
      'image_generation',
      'prompt_optimize_generation',
      'prompt_optimize_pro',
      'video_generation',
      'video_storyboard_optimize',
      'video_template_optimize',
    ]);
  });

  it('binds every task to at least one model preset', () => {
    for (const task of TASK_PRESETS) {
      expect(task.modelPresets.length, task.taskType).toBeGreaterThan(0);
      for (const key of task.modelPresets) {
        expect(MODEL_PRESETS[key], `${task.taskType} -> ${key}`).toBeDefined();
      }
    }
  });
});

describe('presets — golden prices (chat)', () => {
  it('prices a fast message with no tokens at the base rate', () => {
    expect(quote('chat_fast', { inputTokens: 0, outputTokens: 0 })).toBe(1);
  });

  it('prices fast tokens at 0.5 in / 2 out per 1k', () => {
    // 1 + 2000/1000*0.5 + 1000/1000*2 = 1 + 1 + 2 = 4
    expect(quote('chat_fast', { inputTokens: 2000, outputTokens: 1000 })).toBe(4);
  });

  it('prices standard at base 3, 1 in / 5 out per 1k', () => {
    // 3 + 2 + 10 = 15
    expect(quote('chat_standard', { inputTokens: 2000, outputTokens: 2000 })).toBe(15);
  });

  it('prices reasoning at base 10, 3 in / 15 out per 1k, x1.2 when reasoning', () => {
    // (10 + 3 + 15) * 1.2 = 33.6 -> ceil 34
    expect(quote('chat_reasoning', { inputTokens: 1000, outputTokens: 1000, reasoning: true })).toBe(34);
  });

  it('skips the reasoning multiplier when reasoning is false', () => {
    expect(quote('chat_reasoning', { inputTokens: 1000, outputTokens: 1000, reasoning: false })).toBe(28);
  });
});

describe('presets — golden prices (image)', () => {
  it('prices quality tiers at 1K with one image and no references', () => {
    const at = (quality: string) => quote('image', { quality, resolution: '1K', quantity: 1, referenceImages: 0 });
    expect(at('low')).toBe(15);
    expect(at('medium')).toBe(90);
    expect(at('high')).toBe(350);
  });

  it('scales by resolution multiplier', () => {
    const at = (resolution: string) =>
      quote('image', { quality: 'medium', resolution, quantity: 1, referenceImages: 0 });
    expect(at('512px')).toBe(45);
    expect(at('1K')).toBe(90);
    expect(at('2K')).toBe(180);
    expect(at('4K')).toBe(360);
  });

  it('rounds a fractional subtotal up exactly once', () => {
    // low(15) * 512px(0.5) = 7.5 -> ceil 8
    expect(quote('image', { quality: 'low', resolution: '512px', quantity: 1, referenceImages: 0 })).toBe(8);
  });

  it('multiplies by quantity before adding reference images', () => {
    // 90 * 2 = 180, + 5*1 = 185
    expect(quote('image', { quality: 'medium', resolution: '1K', quantity: 2, referenceImages: 1 })).toBe(185);
  });

  it('charges 5 per reference image, unscaled by resolution', () => {
    // (1 * 90 * 4) * 1 = 360, + 5*3 = 375
    expect(quote('image', { quality: 'medium', resolution: '4K', quantity: 1, referenceImages: 3 })).toBe(375);
  });
});

describe('presets — golden prices (video)', () => {
  it('prices per second by resolution', () => {
    const at = (resolution: string, seconds: number) => quote('video', { resolution, seconds });
    expect(at('480p', 5)).toBe(800);
    expect(at('720p', 5)).toBe(1600);
    expect(at('1080p', 5)).toBe(4000);
    expect(at('4k', 5)).toBe(8000);
  });

  it('scales linearly with duration', () => {
    expect(quote('video', { resolution: '720p', seconds: 10 })).toBe(3200);
  });
});
