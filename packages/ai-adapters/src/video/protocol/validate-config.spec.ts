import { describe, it, expect } from 'vitest';
import { validateVideoProtocolConfig } from './validate-config';
import { arkVideoV3 } from './presets/vendors';
import type { ParamsSchema } from '@autix/domain/pricing';
import type { VideoProtocolPreset } from './types';

// 原生化后的 video schema：字段名就是火山 wire 名（duration，不是 seconds）。
const liveSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution', 'duration'],
  properties: {
    ratio: { type: 'string', enum: ['1:1', '16:9', '9:16'], default: '16:9' },
    duration: { type: 'integer', minimum: 4, maximum: 15, default: 5 },
    resolution: { type: 'string', enum: ['480p', '720p'], default: '720p' },
  },
} as unknown as ParamsSchema;

describe('validateVideoProtocolConfig', () => {
  // 回归守卫：arkVideoV3 绑定数多于 schema 属性数（watermark 等传输参数不进 schema）。
  // 若规则写反（要求「绑定必须存在于 schema」），这条会红 —— 校验器会拒绝 preset 自己。
  it('accepts the live schema against arkVideoV3', () => {
    expect(validateVideoProtocolConfig({ paramsSchema: liveSchema, preset: arkVideoV3 })).toEqual([]);
  });

  // 正向闭合：用户可见的参数没有绑定 = 上游永远收不到，静默丢弃。
  it('flags a wire param that has no binding', () => {
    const preset: VideoProtocolPreset = {
      ...arkVideoV3,
      submit: {
        ...arkVideoV3.submit,
        paramBindings: Object.fromEntries(
          Object.entries(arkVideoV3.submit.paramBindings).filter(([k]) => k !== 'ratio'),
        ),
      },
    };
    const violations = validateVideoProtocolConfig({ paramsSchema: liveSchema, preset });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ code: 'WIRE_PARAM_NOT_BOUND', param: 'ratio' });
  });

  // role: 'derived' / 'display' 的属性不发给上游，没有绑定是正常的。
  it('ignores non-wire params', () => {
    const schema = {
      ...liveSchema,
      properties: {
        ...liveSchema.properties,
        previewOnly: { type: 'string', 'x-ui': { role: 'display' } },
      },
    } as unknown as ParamsSchema;
    expect(validateVideoProtocolConfig({ paramsSchema: schema, preset: arkVideoV3 })).toEqual([]);
  });

  // 素材字段（x-content-role）走 materials 表、不进 paramBindings —— 正向闭合必须跳过它们，
  // 否则用户给的富参数 schema（含首尾帧/多参考）会因这些字段无绑定而被拒、模型存不进去。
  it('skips material fields marked with x-content-role', () => {
    const schema = {
      ...liveSchema,
      properties: {
        ...liveSchema.properties,
        first_frame: { type: 'string', format: 'image', 'x-content-role': 'first_frame' },
        reference_images: {
          type: 'array',
          items: { type: 'string', format: 'image' },
          'x-content-role': 'reference_image',
        },
      },
    } as unknown as ParamsSchema;
    expect(validateVideoProtocolConfig({ paramsSchema: schema, preset: arkVideoV3 })).toEqual([]);
  });
});
