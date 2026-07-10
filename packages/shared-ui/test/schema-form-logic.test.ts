import { describe, expect, test } from 'bun:test';
import { clampOnChange, fillDefaults, migrateParams } from '../src/pricing/SchemaForm/schema-form-logic';
import type { ParamsSchema } from '@autix/domain/pricing';

const videoSchema: ParamsSchema = {
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips', order: 10 } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper', order: 20 } },
    referenceImages: { type: 'integer', minimum: 0, maximum: 4, default: 0, 'x-ui': { control: 'hidden' } },
    inputTokens: { type: 'integer', minimum: 0, default: 0, 'x-ui': { control: 'hidden' } },
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
      inputTokens: 0,
    });
  });

  test('omits properties without a default', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { seed: { type: 'string', 'x-ui': { control: 'text' } } },
    };
    expect(fillDefaults(schema)).toEqual({});
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

  test('treats an undefined old schema as "no prior model" and fills all defaults', () => {
    const result = migrateParams(undefined, geminiImageSchema, {});
    expect(result).toEqual({ resolution: '1K', seed: '' });
  });
});
