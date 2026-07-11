import { describe, expect, it } from 'vitest';
import { applyParamDefaults } from './apply-param-defaults';
import { validateParams } from './validate-params';
import { MODEL_PRESETS } from './presets';
import type { ParamsSchema } from './types';

const SCHEMA: ParamsSchema = {
  type: 'object',
  properties: {
    quality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
    quantity: { type: 'integer', default: 1 },
    flag: { type: 'boolean', default: false },
    label: { type: 'string', default: '' },
    // no default at all — must never be invented
    referenceImages: { type: 'integer' },
  },
};

describe('applyParamDefaults', () => {
  it('fills an absent property that has a default', () => {
    const result = applyParamDefaults(SCHEMA, {});
    expect(result.quality).toBe('medium');
    expect(result.quantity).toBe(1);
  });

  it('leaves a present value alone even when falsy (0)', () => {
    const result = applyParamDefaults(SCHEMA, { quantity: 0 });
    expect(result.quantity).toBe(0);
  });

  it('leaves a present value alone even when falsy (empty string)', () => {
    const result = applyParamDefaults(SCHEMA, { label: 'x' });
    expect(result.label).toBe('x');
    const untouched = applyParamDefaults(SCHEMA, { label: '' });
    expect(untouched.label).toBe('');
  });

  it('leaves a present value alone even when falsy (false)', () => {
    const result = applyParamDefaults(SCHEMA, { flag: true });
    expect(result.flag).toBe(true);
    const untouched = applyParamDefaults(SCHEMA, { flag: false });
    expect(untouched.flag).toBe(false);
  });

  it('treats a property present with value undefined as absent and fills the default', () => {
    const result = applyParamDefaults(SCHEMA, { quality: undefined });
    expect(result.quality).toBe('medium');
  });

  it('treats a property present with value null as present — does not overwrite it', () => {
    const result = applyParamDefaults(SCHEMA, { quality: null });
    expect(result.quality).toBeNull();
  });

  it('does not invent a value for a property with no default', () => {
    const result = applyParamDefaults(SCHEMA, {});
    expect('referenceImages' in result).toBe(false);
  });

  it('does not mutate the input object', () => {
    const input: Record<string, unknown> = { quantity: 5 };
    const inputSnapshot = { ...input };
    applyParamDefaults(SCHEMA, input);
    expect(input).toEqual(inputSnapshot);
  });

  it('returns a new object, not the same reference as the input', () => {
    const input: Record<string, unknown> = {};
    const result = applyParamDefaults(SCHEMA, input);
    expect(result).not.toBe(input);
  });

  it('leaves properties untouched that are absent from the schema entirely', () => {
    const result = applyParamDefaults(SCHEMA, { extra: 'unrelated' });
    expect(result.extra).toBe('unrelated');
  });

  describe('against the real image preset — the reproduction of the production bug', () => {
    it('fills the required quality/resolution that canvas never sends, and the result passes validation', () => {
      const filled = applyParamDefaults(MODEL_PRESETS.image.paramsSchema, { referenceImages: 0 });
      expect(filled.quality).toBe('medium');
      expect(filled.resolution).toBe('1K');
      expect(validateParams(MODEL_PRESETS.image.paramsSchema, filled)).toEqual([]);
    });

    it('fills the required quality/resolution that a template never sends, and the result passes validation', () => {
      const filled = applyParamDefaults(MODEL_PRESETS.image.paramsSchema, { referenceImages: 0 });
      expect(filled.quality).toBe('medium');
      expect(filled.resolution).toBe('1K');
      expect(filled.referenceImages).toBe(0);
      expect(validateParams(MODEL_PRESETS.image.paramsSchema, filled)).toEqual([]);
    });
  });

  describe('against the real text preset — valueSource: usage must never be filled', () => {
    it('does not add inputTokens/outputTokens even though they declare a default of 0', () => {
      const filled = applyParamDefaults(MODEL_PRESETS.text.paramsSchema, {});
      expect('inputTokens' in filled).toBe(false);
      expect('outputTokens' in filled).toBe(false);
      // params-source properties on the same schema still get filled normally.
      expect(filled.temperature).toBe(0.7);
      expect(filled.maxTokens).toBe(4096);
    });

    it('does not overwrite a caller-supplied token value either (defense in depth: it never even looks)', () => {
      const filled = applyParamDefaults(MODEL_PRESETS.text.paramsSchema, { inputTokens: 42 });
      expect(filled.inputTokens).toBe(42);
    });
  });

  describe('against the real video preset', () => {
    it('fills the required resolution/seconds, and the base default seconds (5) satisfies the 4k-narrowed maximum (8)', () => {
      const filled = applyParamDefaults(MODEL_PRESETS.video.paramsSchema, {});
      expect(filled.resolution).toBe('720p');
      expect(filled.seconds).toBe(5);
      expect(validateParams(MODEL_PRESETS.video.paramsSchema, filled)).toEqual([]);

      // Even when the caller pins the narrowing branch (resolution: '4k') and lets
      // seconds default, the base default (5) still satisfies the narrowed
      // maximum (8) for every preset in this repo today — verified here rather
      // than assumed.
      const filled4k = applyParamDefaults(MODEL_PRESETS.video.paramsSchema, { resolution: '4k' });
      expect(filled4k.seconds).toBe(5);
      expect(validateParams(MODEL_PRESETS.video.paramsSchema, filled4k)).toEqual([]);
    });
  });
});
