import { describe, expect, it } from 'vitest';
import { deriveParams } from './derive';
import type { ParamsSchema } from './types';

const SCHEMA: ParamsSchema = {
  type: 'object',
  required: ['quality', 'resolution'],
  properties: {
    size: {
      type: 'string',
      enum: ['1024x1024@1K', '2048x2048@2K', '4096x4096@4K'],
      'x-ui': { control: 'hidden', role: 'wire' },
    },
    quality: {
      type: 'string',
      enum: ['low', 'high'],
      'x-ui': { control: 'chips', role: 'both' },
    },
    resolution: {
      type: 'string',
      enum: ['1K', '2K', '4K'],
      'x-ui': {
        control: 'hidden',
        role: 'derived',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
      },
    },
  },
};

describe('deriveParams', () => {
  it('computes a derived param from its source', () => {
    expect(deriveParams(SCHEMA, { size: '2048x2048@2K', quality: 'high' })).toEqual({
      size: '2048x2048@2K',
      quality: 'high',
      resolution: '2K',
    });
  });

  it('OVERWRITES whatever the client sent for a derived param', () => {
    // 这是 derive 存在的全部理由（spec §6.3）：今天前端直接把 resolution 传给
    // quote 接口，后端不校验它与 size 是否自洽 —— 传 4K 的 size + 1K 的
    // resolution 就按 1K 收费。派生后前端传什么都被覆盖。
    const derived = deriveParams(SCHEMA, {
      size: '4096x4096@4K',
      quality: 'high',
      resolution: '1K', // ← 便宜档位
    });
    expect(derived.resolution).toBe('4K');
  });

  it('omits the derived param when the source is missing', () => {
    // 不能凭空造一个值 —— 缺了源，resolution 就该缺席，由 validateParams 的
    // required 去报 400（这正是今天 size 缺失时的行为）。
    expect('resolution' in deriveParams(SCHEMA, { quality: 'high' })).toBe(false);
  });

  it('omits the derived param when the source is unparseable', () => {
    // resolveImagePricingResolution('auto') 返回 undefined。
    expect('resolution' in deriveParams(SCHEMA, { size: 'auto', quality: 'high' })).toBe(false);
    expect('resolution' in deriveParams(SCHEMA, { size: '', quality: 'high' })).toBe(false);
  });

  it('leaves non-derived params untouched and does not mutate the input', () => {
    const input = { size: '1024x1024@1K', quality: 'low' };
    const derived = deriveParams(SCHEMA, input);
    expect(derived.quality).toBe('low');
    expect(derived.size).toBe('1024x1024@1K');
    expect(input).toEqual({ size: '1024x1024@1K', quality: 'low' });
  });

  it('is a no-op for a schema with no derived params (backward compatible)', () => {
    const plain: ParamsSchema = {
      type: 'object',
      properties: { quality: { type: 'string', 'x-ui': { control: 'chips' } } },
    };
    expect(deriveParams(plain, { quality: 'high' })).toEqual({ quality: 'high' });
  });
});
