import { describe, expect, it } from 'vitest';
import { compileParamsSchema, validateParams } from './validate-params';
import type { ParamsSchema } from './types';

const schema: ParamsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
  },
  allOf: [
    {
      if: { properties: { resolution: { const: '4K' } } },
      then: { properties: { seconds: { type: 'integer', maximum: 8 } } },
    },
  ],
};

const schemaWithUndeclaredThenType = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
  },
  allOf: [
    { if: { properties: { resolution: { const: '4K' } } }, then: { properties: { seconds: { maximum: 8 } } } },
  ],
} as unknown as ParamsSchema;

describe('validateParams', () => {
  it('accepts valid params', () => {
    expect(validateParams(schema, { resolution: '1K', seconds: 12 })).toEqual([]);
  });

  it('rejects a value outside the enum', () => {
    const violations = validateParams(schema, { resolution: '8K' });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].path).toBe('/resolution');
  });

  it('rejects a missing required param', () => {
    expect(validateParams(schema, { seconds: 5 }).length).toBeGreaterThan(0);
  });

  it('rejects a number below the minimum', () => {
    const violations = validateParams(schema, { resolution: '1K', seconds: 2 });
    expect(violations[0].path).toBe('/seconds');
  });

  it('enforces the if-then constraint: 4K caps seconds at 8', () => {
    expect(validateParams(schema, { resolution: '4K', seconds: 8 })).toEqual([]);
    expect(validateParams(schema, { resolution: '4K', seconds: 12 }).length).toBeGreaterThan(0);
  });

  it('ignores the x-ui annotation rather than treating it as an unknown keyword', () => {
    expect(() => validateParams(schema, { resolution: '1K' })).not.toThrow();
  });

  it('ignores the x-media annotation on video model paramsSchema (bug: 所有 video 模型计价 = 0)', () => {
    // 真实生产事故复现：seedance/veo/wan 等视频模型 paramsSchema 顶层带 x-media，
    // 声明输入媒体能力（image/video/audio）。ajv strict 遇到未知关键字会**抛异常**，
    // 被 compileParamsSchema 收成根级 violation → computeTaskEstimate 返回
    // violations 非空 → 前端置价为空、服务端扣费拒绝。
    const videoSchema = {
      type: 'object' as const,
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      'x-media': {
        image: { max: 9, roles: ['first_frame', 'last_frame', 'reference_image'] },
        video: { max: 3, maxSeconds: 15, totalSeconds: 15 },
        audio: { max: 3, maxSeconds: 15, totalSeconds: 15 },
      },
      required: ['resolution', 'duration'],
      properties: {
        resolution: {
          type: 'string' as const,
          enum: ['720p'],
          default: '720p',
          'x-ui': { control: 'chips' as const },
        },
        duration: {
          type: 'integer' as const,
          minimum: 4,
          maximum: 15,
          default: 5,
          'x-ui': { control: 'stepper' as const },
        },
      },
    } as unknown as ParamsSchema;

    expect(() =>
      validateParams(videoSchema, { resolution: '720p', duration: 5 }),
    ).not.toThrow();
    expect(validateParams(videoSchema, { resolution: '720p', duration: 5 })).toEqual([]);
  });

  it('rejects a then-branch constraint whose type is not declared — as a violation, not a throw', () => {
    // 意图不变（没声明 type 的 then 分支必须被拒），机制改了：这个函数跑在扣费链路上，
    // 让 ajv 的编译异常穿出去就是一个 500。现在它返回 violation → 调用方转成 400。
    const violations = validateParams(schemaWithUndeclaredThenType, {
      resolution: '4K',
      seconds: 8,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toMatch(/strict mode/i);
  });
});

describe('compileParamsSchema (ajv strict smoke test)', () => {
  // 这份 schema 结构上合法（validateParamsSchema 会放行），但 ajv strict 编译不过：
  // allOf 的 then 分支漏写了 type —— strict 模式下逐子 schema 独立做类型检查，
  // 看不到外层的 type（validate-params.ts:17-23 的注释解释了为什么不关这项检查）。
  const UNCOMPILABLE = {
    type: 'object' as const,
    properties: {
      resolution: {
        type: 'string' as const,
        enum: ['1K', '4K'],
        'x-ui': { control: 'chips' as const },
      },
      seconds: {
        type: 'integer' as const,
        minimum: 1,
        maximum: 16,
        'x-ui': { control: 'slider' as const },
      },
    },
    allOf: [
      {
        if: { properties: { resolution: { const: '4K' } } },
        then: { properties: { seconds: { maximum: 8 } } }, // ← 漏了 type
      },
    ],
  } as unknown as ParamsSchema;

  const COMPILABLE = {
    type: 'object' as const,
    properties: {
      quality: {
        type: 'string' as const,
        enum: ['low', 'high'],
        'x-ui': { control: 'chips' as const },
      },
    },
  } as unknown as ParamsSchema;

  it('returns a violation instead of throwing when ajv refuses to compile', () => {
    expect(() => compileParamsSchema(UNCOMPILABLE)).not.toThrow();
    expect(compileParamsSchema(UNCOMPILABLE).length).toBeGreaterThan(0);
  });

  it('returns no violation for a compilable schema', () => {
    expect(compileParamsSchema(COMPILABLE)).toEqual([]);
  });

  it('makes validateParams return a violation rather than throwing a 500', () => {
    // 这是本任务的全部意义：坏 schema 必须是 400（配置不合法），
    // 而不是 compile() 抛出未捕获异常变成 500。
    expect(() => validateParams(UNCOMPILABLE, { resolution: '1K', seconds: 4 })).not.toThrow();
    expect(validateParams(UNCOMPILABLE, { resolution: '1K', seconds: 4 }).length).toBeGreaterThan(0);
  });
});
