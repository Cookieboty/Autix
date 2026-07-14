import { describe, it, expect } from 'vitest';
import type { ParamsSchema } from '@autix/domain/pricing';
import { validateModelProtocolConfig } from './validate-config';
import { gatewayOpenAIV1 } from './presets/gateway-openai-v1';
import type { ProtocolPreset } from './types';

const GOOD_SCHEMA: ParamsSchema = {
  type: 'object',
  required: ['size', 'quality', 'resolution'],
  properties: {
    size: {
      type: 'string', enum: ['1024x1024@1K', '2048x2048@2K'], default: '1024x1024@1K',
      'x-ui': { role: 'wire', control: 'size-grid', groupBy: 'tier',
                optionLabels: { '1024x1024@1K': '1:1', '2048x2048@2K': '1:1 2K' }, order: 10 },
    },
    quality: {
      type: 'string', enum: ['low', 'high'], default: 'high',
      'x-ui': { role: 'both', control: 'chips', order: 20 },
    },
    resolution: {
      type: 'string', enum: ['1K', '2K'], default: '1K',
      'x-ui': { role: 'derived', control: 'hidden',
                derivedFrom: { param: 'size', via: 'imagePricingResolution' }, order: 21 },
    },
    referenceImages: {
      type: 'integer', minimum: 0, default: 0,
      'x-ui': { role: 'pricing', control: 'hidden' },
    },
    // gatewayOpenAIV1 也绑定了 seed / negativePrompt（规则 1b 反向闭合要求它们在
    // schema 里存在）——这两个是可选的 wire 透传参数，不参与计价。
    seed: {
      type: 'integer', minimum: 0,
      'x-ui': { role: 'wire', control: 'text', order: 30 },
    },
    negativePrompt: {
      type: 'string',
      'x-ui': { role: 'wire', control: 'textarea', order: 31 },
    },
  },
};
const GOOD_META = { protocolKey: 'openai-images@v1', operations: ['generate', 'edit'], limits: { maxCount: 4 } };
// 用 rest 参数而非默认参数区分「没传第三个参数」与「显式传了 undefined」——
// 后者是「rejects a protocolKey with no registered preset」这个用例故意要模拟的
// 场景（preset 查不到，调用方传 undefined 而不是 resolveImagePreset 的抛异常版本）。
// 用 `= gatewayOpenAIV1` 默认参数会在两种情况下都套用默认值，永远测不到这条分支。
const run = (
  schema: ParamsSchema,
  metadata: unknown,
  ...presetArg: [ProtocolPreset | undefined] | []
) =>
  validateModelProtocolConfig({
    paramsSchema: schema,
    metadata,
    preset: presetArg.length > 0 ? presetArg[0] : gatewayOpenAIV1,
  });
const codes = (
  schema: ParamsSchema,
  metadata: unknown,
  ...presetArg: [ProtocolPreset | undefined] | []
) => run(schema, metadata, ...presetArg).map((v) => v.code);

describe('validateModelProtocolConfig', () => {
  it('accepts the canonical seeded config', () => {
    expect(run(GOOD_SCHEMA, GOOD_META)).toEqual([]);
  });

  // 规则 1a
  it('rejects a wire param the preset has no binding for — else it is silently dropped', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.guidanceScale = {
      type: 'number', minimum: 1, maximum: 20, 'x-ui': { role: 'wire', control: 'slider' },
    };
    expect(codes(schema, GOOD_META)).toContain('WIRE_PARAM_NOT_BOUND');
  });

  it('accepts a wire param bound by an explicit ignore strategy', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.steps = {
      type: 'integer', minimum: 4, maximum: 60, 'x-ui': { role: 'wire', control: 'slider' },
    };
    const preset: ProtocolPreset = {
      ...gatewayOpenAIV1,
      paramBindings: { ...gatewayOpenAIV1.paramBindings, steps: { strategy: 'ignore' } },
    };
    expect(run(schema, GOOD_META, preset)).toEqual([]);
  });

  // 规则 1b
  it('rejects a preset binding whose param is absent from the schema — the binding never fires', () => {
    const preset: ProtocolPreset = {
      ...gatewayOpenAIV1,
      paramBindings: { ...gatewayOpenAIV1.paramBindings, styleStrength: { path: 'style_strength' } },
    };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('BINDING_TARGETS_UNKNOWN_PARAM');
  });

  it('rejects a preset binding that targets a derived param — derived is never sent upstream', () => {
    const preset: ProtocolPreset = {
      ...gatewayOpenAIV1,
      paramBindings: { ...gatewayOpenAIV1.paramBindings, resolution: { path: 'resolution' } },
    };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('BINDING_TARGETS_DERIVED_PARAM');
  });

  // 规则 2
  it('rejects when an declared operation has no coreBindings', () => {
    const preset: ProtocolPreset = { ...gatewayOpenAIV1, coreBindings: { generate: gatewayOpenAIV1.coreBindings.generate! } };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('MISSING_CORE_BINDING');
  });

  it('does NOT require inputImages bindings for a generate-only model', () => {
    const preset: ProtocolPreset = {
      ...gatewayOpenAIV1,
      endpoints: { generate: gatewayOpenAIV1.endpoints.generate! },
      coreBindings: { generate: gatewayOpenAIV1.coreBindings.generate! },
    };
    expect(run(GOOD_SCHEMA, { ...GOOD_META, operations: ['generate'] }, preset)).toEqual([]);
  });

  // 规则 4
  it('rejects an unknown transform key in a binding', () => {
    const preset = {
      ...gatewayOpenAIV1,
      paramBindings: { ...gatewayOpenAIV1.paramBindings, size: { path: 'size', transform: 'stripTeirSuffix' } },
    } as unknown as ProtocolPreset;
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('UNKNOWN_TRANSFORM');
  });

  // 规则 5
  it('rejects a protocolKey with no registered preset', () => {
    expect(codes(GOOD_SCHEMA, { ...GOOD_META, protocolKey: 'nope@v9' }, undefined))
      .toContain('UNKNOWN_PROTOCOL_KEY');
  });

  // 规则 6
  it('rejects operations the preset does not implement', () => {
    const preset: ProtocolPreset = {
      ...gatewayOpenAIV1,
      endpoints: { generate: gatewayOpenAIV1.endpoints.generate! },
    };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('OPERATION_NOT_IMPLEMENTED');
  });

  it('rejects edit-capable models whose schema forbids referenceImages', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    delete schema.properties.referenceImages;
    expect(codes(schema, GOOD_META)).toContain('EDIT_NEEDS_REFERENCE_IMAGES');
  });

  // 规则 7 —— 裸 WxH 与 WxH@tier 混用时静默落到默认档，正是这条要拦的
  it('rejects a size enum token the derive fn cannot parse', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.size.enum = ['1024x1024@1K', 'auto'];
    expect(codes(schema, GOOD_META)).toContain('UNPARSEABLE_SOURCE_TOKEN');
  });

  it('names the offending token in the message, not just the param', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.size.enum = ['1024x1024@1K', 'weird-token'];
    expect(run(schema, GOOD_META).find((v) => v.code === 'UNPARSEABLE_SOURCE_TOKEN')?.message)
      .toMatch(/weird-token/);
  });
});
