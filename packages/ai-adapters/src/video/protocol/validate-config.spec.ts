import { describe, it, expect } from 'vitest';
import { validateVideoProtocolConfig } from './validate-config';
import { arkVideoV3 } from './presets/vendors';
import type { ParamsSchema } from '@autix/domain/pricing';
import type { VideoProtocolPreset } from './types';

// 线上 video_generation 的真实 schema：只有 3 个属性（实测 GET /api/tasks/video_generation/models）。
const liveSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution', 'seconds'],
  properties: {
    ratio: { type: 'string', enum: ['1:1', '16:9', '9:16'], default: '16:9' },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5 },
    resolution: { type: 'string', enum: ['480p', '720p'], default: '720p' },
  },
} as unknown as ParamsSchema;

describe('validateVideoProtocolConfig', () => {
  // 回归守卫：arkVideoV3 有 7 个绑定而线上 schema 只有 3 个属性。
  // 若规则写反（要求「绑定必须存在于 schema」），这条会红 —— 校验器会拒绝 preset 自己。
  it('accepts the live schema against arkVideoV3 (7 bindings vs 3 schema props)', () => {
    expect(validateVideoProtocolConfig({ paramsSchema: liveSchema, preset: arkVideoV3 })).toEqual([]);
  });

  // 规则 1：正向闭合 —— 用户可见的参数没有绑定 = 上游永远收不到，静默丢弃。
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

  // 规则 2：反向白名单 —— 拼错的绑定会永远不生效且无人察觉。
  it('flags a binding whose key is not a known unified param', () => {
    const preset: VideoProtocolPreset = {
      ...arkVideoV3,
      submit: {
        ...arkVideoV3.submit,
        paramBindings: { ...arkVideoV3.submit.paramBindings, wartermark: { path: 'watermark' } },
      },
    };
    const violations = validateVideoProtocolConfig({ paramsSchema: liveSchema, preset });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ code: 'UNKNOWN_UNIFIED_PARAM', param: 'wartermark' });
  });

  it('reports both rule violations at once', () => {
    const preset: VideoProtocolPreset = {
      ...arkVideoV3,
      submit: {
        ...arkVideoV3.submit,
        paramBindings: {
          ...Object.fromEntries(
            Object.entries(arkVideoV3.submit.paramBindings).filter(([k]) => k !== 'ratio'),
          ),
          wartermark: { path: 'watermark' },
        },
      },
    };
    expect(validateVideoProtocolConfig({ paramsSchema: liveSchema, preset }).map((v) => v.code).sort())
      .toEqual(['UNKNOWN_UNIFIED_PARAM', 'WIRE_PARAM_NOT_BOUND']);
  });
});
