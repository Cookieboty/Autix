import { clampOnChange, fillDefaults, migrateParams } from '../src/pricing/SchemaForm/schema-form-logic';
import { MODEL_PRESETS } from '@autix/domain/pricing';
import type { ParamsSchema } from '@autix/domain/pricing';

const videoSchema: ParamsSchema = {
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips', order: 10 } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper', order: 20 } },
    referenceImages: { type: 'integer', minimum: 0, maximum: 4, default: 0, 'x-ui': { control: 'hidden' } },
    // valueSource: 'usage' — 只在结算时由 usage 注入，下单时绝不能被填成 0
    // 冻进 params（spec §3.1.1.65，真实生产事故：见 fillDefaults/migrateParams
    // 下面 "usage-sourced" 相关用例）。
    inputTokens: { type: 'integer', minimum: 0, default: 0, 'x-ui': { control: 'hidden', valueSource: 'usage' } },
  },
  allOf: [
    {
      if: { properties: { resolution: { const: '4K' } } },
      then: { properties: { seconds: { type: 'integer', maximum: 8 } } },
    },
  ],
};

describe('fillDefaults', () => {
  test('uses each property default', () => {
    expect(fillDefaults(videoSchema)).toEqual({
      resolution: '1K',
      seconds: 5,
      referenceImages: 0,
    });
  });

  test('omits properties without a default', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { seed: { type: 'string', 'x-ui': { control: 'text' } } },
    };
    expect(fillDefaults(schema)).toEqual({});
  });

  // CRITICAL regression (spec §3.1.1.65): a prior implementation filled
  // `inputTokens: 0` / `outputTokens: 0` into params at order time. Because
  // model-side evaluation merges `params` with the real `usage` at
  // settlement, a frozen `0` made every token-priced settlement price at
  // zero — a real production bug, not hypothetical. This must never regress.
  test('never fills a valueSource:"usage" property, even though it declares a default', () => {
    const filled = fillDefaults(videoSchema);
    expect(filled).not.toHaveProperty('inputTokens');
  });

  test('against the real text preset — usage-sourced token params are never filled', () => {
    const filled = fillDefaults(MODEL_PRESETS.text.paramsSchema);
    expect(filled).toEqual({ temperature: 0.7, maxTokens: 4096 });
    expect(filled).not.toHaveProperty('inputTokens');
    expect(filled).not.toHaveProperty('outputTokens');
  });
});

describe('clampOnChange', () => {
  test('clamps a numeric value to the resolved maximum and reports a message', () => {
    const result = clampOnChange(
      videoSchema,
      { resolution: '4K', seconds: 5 },
      'seconds',
      12,
    );
    expect(result.params.seconds).toBe(8);
    expect(result.message).toEqual({ field: 'seconds', text: '4K 最长 8 秒' });
  });

  test('does not clamp when the new value is within bounds', () => {
    const result = clampOnChange(videoSchema, { resolution: '4K', seconds: 5 }, 'seconds', 7);
    expect(result.params.seconds).toBe(7);
    expect(result.message).toBeUndefined();
  });

  test('re-resolves constraints for every changed field, not just the changed one — ' +
      'switching resolution to 4K clamps an already-out-of-range seconds', () => {
    const result = clampOnChange(
      videoSchema,
      { resolution: '1K', seconds: 12 },
      'resolution',
      '4K',
    );
    expect(result.params).toEqual({ resolution: '4K', seconds: 8, referenceImages: undefined, inputTokens: undefined });
    expect(result.message).toEqual({ field: 'seconds', text: '4K 最长 8 秒' });
  });

  test('falls back an out-of-range enum to schema default', () => {
    const narrowingSchema: ParamsSchema = {
      type: 'object',
      properties: {
        resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
        style: { type: 'string', enum: ['anime', 'photo', 'sketch'], default: 'photo', 'x-ui': { control: 'select' } },
      },
      allOf: [
        {
          if: { properties: { resolution: { const: '4K' } } },
          then: { properties: { style: { type: 'string', enum: ['anime'] } } },
        },
      ],
    };
    const result = clampOnChange(narrowingSchema, { resolution: '1K', style: 'sketch' }, 'resolution', '4K');
    // style='sketch' 不在收窄后的 ['anime'] 里；default 'photo' 也不在里面 -> 取候选集第一个
    expect(result.params.style).toBe('anime');
  });

  test('falls back an out-of-range enum to default when default is still valid', () => {
    const narrowingSchema: ParamsSchema = {
      type: 'object',
      properties: {
        resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
        style: { type: 'string', enum: ['anime', 'photo'], default: 'photo', 'x-ui': { control: 'select' } },
      },
      allOf: [
        {
          if: { properties: { resolution: { const: '4K' } } },
          then: { properties: { style: { type: 'string', enum: ['photo'] } } },
        },
      ],
    };
    const result = clampOnChange(narrowingSchema, { resolution: '1K', style: 'anime' }, 'resolution', '4K');
    expect(result.params.style).toBe('photo');
  });

  test('is a no-op when no constraint narrows', () => {
    const result = clampOnChange(videoSchema, { resolution: '1K', seconds: 10 }, 'seconds', 12);
    expect(result.params.seconds).toBe(12);
    expect(result.message).toBeUndefined();
  });

  // Must agree with resolveConstraints' "later allOf entry overrides earlier"
  // semantics (constraints.ts). Two entries narrow the same field ('seconds')
  // and both match simultaneously; the actually-applied bound (6, from the
  // second/'ultra' entry) must be the one clamped to AND the one cited in the
  // message — not the first-matching ('4K') entry, which was never applied.
  test('cites the last-matching allOf entry when two entries narrow the same field', () => {
    const doubleNarrowSchema: ParamsSchema = {
      type: 'object',
      properties: {
        resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
        quality: { type: 'string', enum: ['standard', 'ultra'], default: 'standard', 'x-ui': { control: 'chips' } },
        seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
      },
      allOf: [
        { if: { properties: { resolution: { const: '4K' } } }, then: { properties: { seconds: { type: 'integer', maximum: 8 } } } },
        { if: { properties: { quality: { const: 'ultra' } } }, then: { properties: { seconds: { type: 'integer', maximum: 6 } } } },
      ],
    };
    const result = clampOnChange(
      doubleNarrowSchema,
      { resolution: '4K', quality: 'ultra', seconds: 5 },
      'seconds',
      10,
    );
    expect(result.params.seconds).toBe(6); // 6, not 8 — the later entry (quality) wins per resolveConstraints
    expect(result.message).toEqual({ field: 'seconds', text: 'ultra 最长 6 秒' });
  });
});

describe('migrateParams', () => {
  const gptImageSchema: ParamsSchema = {
    type: 'object',
    properties: {
      resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
      style: { type: 'string', enum: ['vivid', 'natural'], default: 'vivid', 'x-ui': { control: 'select' } },
    },
  };
  const geminiImageSchema: ParamsSchema = {
    type: 'object',
    properties: {
      resolution: { type: 'string', enum: ['512px', '1K'], default: '1K', 'x-ui': { control: 'chips' } },
      seed: { type: 'string', default: '', 'x-ui': { control: 'text' } },
    },
  };

  test('keeps a same-named value that still validates against the new schema', () => {
    const result = migrateParams(gptImageSchema, geminiImageSchema, { resolution: '1K', style: 'vivid' });
    expect(result.resolution).toBe('1K');
  });

  test('drops a same-named value that no longer validates and uses the new default', () => {
    const result = migrateParams(gptImageSchema, geminiImageSchema, { resolution: '4K', style: 'vivid' });
    expect(result.resolution).toBe('1K'); // 4K not in geminiImageSchema's enum -> falls back to new default
  });

  test('drops keys the new schema does not have', () => {
    const result = migrateParams(gptImageSchema, geminiImageSchema, { resolution: '1K', style: 'vivid' });
    expect(result.style).toBeUndefined();
  });

  test('fills defaults for keys the old params did not have', () => {
    const result = migrateParams(gptImageSchema, geminiImageSchema, { resolution: '1K', style: 'vivid' });
    expect(result.seed).toBe('');
  });

  test('does not translate semantically across models — 1024x1024 style values are not remapped', () => {
    const withSizeStrings: ParamsSchema = {
      type: 'object',
      properties: { size: { type: 'string', enum: ['1024x1024', '1024x1792'], default: '1024x1024', 'x-ui': { control: 'select' } } },
    };
    const kSchema: ParamsSchema = {
      type: 'object',
      properties: { size: { type: 'string', enum: ['1K', '2K'], default: '1K', 'x-ui': { control: 'select' } } },
    };
    const result = migrateParams(withSizeStrings, kSchema, { size: '1024x1024' });
    expect(result.size).toBe('1K'); // falls back to default, NOT translated to '1K' semantically
  });

  // CRITICAL regression (spec §3.1.1.65): migrating between two models must
  // not carry over OR re-default a valueSource:"usage" field — either would
  // freeze a stale/zero token count into the new model's params, and that
  // frozen value survives into PricingSnapshot and zeroes settlement pricing.
  test('never carries over or re-defaults a valueSource:"usage" property when migrating', () => {
    const result = migrateParams(undefined, videoSchema, { inputTokens: 999, resolution: '1K', seconds: 5 });
    expect(result).not.toHaveProperty('inputTokens');
  });

  test('against the real text preset — migrating never re-introduces usage-sourced token params', () => {
    const result = migrateParams(undefined, MODEL_PRESETS.text.paramsSchema, { inputTokens: 999, outputTokens: 999 });
    expect(result).toEqual({ temperature: 0.7, maxTokens: 4096 });
    expect(result).not.toHaveProperty('inputTokens');
    expect(result).not.toHaveProperty('outputTokens');
  });

  test('treats an undefined old schema as "no prior model" and fills all defaults', () => {
    const result = migrateParams(undefined, geminiImageSchema, {});
    expect(result).toEqual({ resolution: '1K', seed: '' });
  });
});
