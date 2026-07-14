import { describe, it, expect } from 'vitest';
import { pickWireParams } from './project';
import type { ParamsSchema } from './types';

const SCHEMA: ParamsSchema = {
  type: 'object',
  properties: {
    size: { type: 'string', 'x-ui': { role: 'wire', control: 'size-grid' } },
    quality: { type: 'string', 'x-ui': { role: 'both', control: 'chips' } },
    resolution: {
      type: 'string',
      'x-ui': {
        role: 'derived',
        control: 'hidden',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
      },
    },
    referenceImages: { type: 'integer', 'x-ui': { role: 'pricing', control: 'hidden' } },
    legacy: { type: 'string', 'x-ui': { control: 'text' } }, // 无 role → 缺省 both
  },
};

describe('pickWireParams', () => {
  it('keeps wire and both', () => {
    const out = pickWireParams(SCHEMA, { size: '2048x2048@2K', quality: 'high' });
    expect(out).toEqual({ size: '2048x2048@2K', quality: 'high' });
  });

  it('drops derived — the upstream never sees a param the server computed for pricing', () => {
    expect(pickWireParams(SCHEMA, { resolution: '2K' })).toEqual({});
  });

  it('drops pricing-only params', () => {
    expect(pickWireParams(SCHEMA, { referenceImages: 3 })).toEqual({});
  });

  it('treats an absent role as both (backward compatible)', () => {
    expect(pickWireParams(SCHEMA, { legacy: 'x' })).toEqual({ legacy: 'x' });
  });

  it('drops a key the schema does not declare at all — whitelist, not blacklist', () => {
    expect(
      pickWireParams(SCHEMA, {
        rogue: 1,
        skipPromptTuning: true,
        promptTuning: '自动优化',
      }),
    ).toEqual({});
  });

  it('keeps only the wire slice of a mixed real-world settings bag', () => {
    expect(
      pickWireParams(SCHEMA, {
        size: '2048x2048@2K',
        quality: 'high',
        resolution: '1K', // 客户端伪造的派生值：绝不上线
        referenceImages: 2, // 计价专用
        stylePreset: 'cinematic', // schema 未声明
      }),
    ).toEqual({ size: '2048x2048@2K', quality: 'high' });
  });

  it('does not invent keys the caller never sent (absent stays absent)', () => {
    expect(pickWireParams(SCHEMA, {})).toEqual({});
  });

  it('preserves an explicitly-sent falsy/undefined wire value without inventing one', () => {
    const out = pickWireParams(SCHEMA, { quality: '' });
    expect(out).toEqual({ quality: '' });
    expect(Object.keys(out)).toEqual(['quality']);
  });

  it('tolerates a schema without properties', () => {
    expect(pickWireParams({ type: 'object' } as ParamsSchema, { size: 'x' })).toEqual({});
  });
});
