import { describe, it, expect } from 'vitest';
import type { ParamsSchema } from '@autix/domain/pricing';
import { validateModelProtocolConfig } from './validate-config';
import { doubaoImagesV1, openaiImagesV1 } from './presets/vendors';
import type { ProtocolPreset } from './types';

/**
 * 夹具：doubao 形状 —— 统一参数与原生字段一一对应（直接绑定）。
 * 复合绑定（gpt-image 的 size = 比例 × 档位）另有一组用例，见文件末尾。
 */
const GOOD_SCHEMA: ParamsSchema = {
  type: 'object',
  required: ['aspectRatio', 'resolution'],
  properties: {
    aspectRatio: {
      type: 'string', enum: ['1:1', '16:9'], default: '1:1',
      'x-ui': { role: 'wire', control: 'select', optionLabels: { '1:1': '1:1', '16:9': '16:9' }, order: 10 },
    },
    resolution: {
      type: 'string', enum: ['2K', '4K'], default: '2K',
      'x-ui': { role: 'both', control: 'select', order: 20 },
    },
    safetyChecker: {
      type: 'boolean', default: true,
      'x-ui': { role: 'wire', control: 'switch', order: 90 },
    },
    referenceImages: {
      type: 'integer', minimum: 0, default: 0,
      'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 10 },
    },
  },
};
const GOOD_META = { protocolKey: 'doubao-images@v1', operations: ['generate', 'edit'], limits: { maxCount: 15 } };

// 用 rest 参数而非默认参数，才能区分「没传第三个参数」与「显式传了 undefined」——
// 后者正是「protocolKey 解析不到 preset」这个用例要模拟的。默认参数会把 undefined
// 也套上默认值，那条分支就永远测不到（恒真的假测试）。
const run = (
  schema: ParamsSchema,
  metadata: unknown,
  ...presetArg: [ProtocolPreset | undefined] | []
) =>
  validateModelProtocolConfig({
    paramsSchema: schema,
    metadata,
    preset: presetArg.length > 0 ? presetArg[0] : doubaoImagesV1,
  });
const codes = (
  schema: ParamsSchema,
  metadata: unknown,
  ...presetArg: [ProtocolPreset | undefined] | []
) => run(schema, metadata, ...presetArg).map((v) => v.code);

/**
 * 夹具：openai 形状 —— gpt-image 的 size 是复合绑定，referenceMode 是 edit-multipart。
 * 提到模块作用域，规则 (1)（edit-multipart 闭合）的用例也要用它。
 */
const OPENAI_SCHEMA: ParamsSchema = {
  type: 'object',
  required: ['aspectRatio', 'resolution', 'quality'],
  properties: {
    aspectRatio: {
      type: 'string', enum: ['1:1', '16:9'], default: '1:1',
      'x-ui': { role: 'wire', control: 'select', order: 10 },
    },
    resolution: {
      type: 'string', enum: ['1K', '2K'], default: '1K',
      'x-ui': { role: 'both', control: 'select', order: 20 },
    },
    quality: {
      type: 'string', enum: ['low', 'high'], default: 'low',
      'x-ui': { role: 'both', control: 'select', order: 30 },
    },
    background: {
      type: 'string', enum: ['auto', 'opaque'], default: 'auto',
      'x-ui': { role: 'wire', control: 'select', order: 80 },
    },
    outputFormat: {
      type: 'string', enum: ['png', 'jpeg'], default: 'png',
      'x-ui': { role: 'wire', control: 'select', order: 81 },
    },
    referenceImages: {
      type: 'integer', minimum: 0, default: 0,
      'x-ui': { role: 'pricing', control: 'hidden', uploadMax: 16 },
    },
  },
};
const OPENAI_META = {
  protocolKey: 'openai-images@v1',
  operations: ['generate', 'edit'],
  limits: { maxCount: 10 },
};

describe('validateModelProtocolConfig', () => {
  it('accepts the canonical seeded config', () => {
    expect(run(GOOD_SCHEMA, GOOD_META)).toEqual([]);
  });

  // 规则 1a：正向闭合
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
      ...doubaoImagesV1,
      paramBindings: { ...doubaoImagesV1.paramBindings, steps: { strategy: 'ignore' } },
    };
    expect(run(schema, GOOD_META, preset)).toEqual([]);
  });

  // 规则 1b：反向闭合。
  //
  // 注意「preset 绑了这个模型没有的参数」**不是**违规：一个厂商 preset 会被同厂商、
  // 能力不同的多个模型共用（gemini 里只有 3.1-flash 有 thinkingLevel），必然绑定一个
  // 超集。对具体模型来说这条绑定是惰性的——assemble 遍历的是 req.params，绑定不会
  // 凭空造出值。真正的拼写错误由**注册表级**检查兜（每个绑定至少被一个模型认领，
  // 见 seed-pricing.spec.ts）。
  it('tolerates a binding for a param this model does not have — vendor presets bind a superset', () => {
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      paramBindings: { ...doubaoImagesV1.paramBindings, styleStrength: { path: 'style_strength' } },
    };
    expect(run(GOOD_SCHEMA, GOOD_META, preset)).toEqual([]);
  });

  it('rejects a preset binding that targets a derived param — derived is never sent upstream', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.pricingTier = {
      type: 'string', enum: ['2K', '4K'], default: '2K',
      'x-ui': {
        role: 'derived', control: 'hidden',
        derivedFrom: { param: 'resolution', via: 'imagePricingResolution' },
      },
    };
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      paramBindings: { ...doubaoImagesV1.paramBindings, pricingTier: { path: 'tier' } },
    };
    expect(codes(schema, GOOD_META, preset)).toContain('BINDING_TARGETS_DERIVED_PARAM');
  });

  // 规则 2：core binding 完整性（按 operation）
  it('rejects when a declared operation has no coreBindings', () => {
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      coreBindings: { generate: doubaoImagesV1.coreBindings.generate! },
    };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('MISSING_CORE_BINDING');
  });

  it('rejects when edit coreBindings exist but lack inputImages', () => {
    const { inputImages: _dropped, ...editWithoutImages } = doubaoImagesV1.coreBindings.edit!;
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      coreBindings: { ...doubaoImagesV1.coreBindings, edit: editWithoutImages },
    };
    const found = run(GOOD_SCHEMA, GOOD_META, preset).find((v) => v.code === 'MISSING_CORE_BINDING');
    expect(found?.message).toMatch(/inputImages/);
  });

  it('does NOT require inputImages bindings for a generate-only model', () => {
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      endpoints: { generate: doubaoImagesV1.endpoints.generate! },
      coreBindings: { generate: doubaoImagesV1.coreBindings.generate! },
    };
    expect(run(GOOD_SCHEMA, { ...GOOD_META, operations: ['generate'] }, preset)).toEqual([]);
  });

  // 规则 4：transform 白名单
  it('rejects an unknown transform key in a binding', () => {
    const preset = {
      ...doubaoImagesV1,
      paramBindings: {
        ...doubaoImagesV1.paramBindings,
        aspectRatio: { path: 'aspect_ratio', transform: 'stripTeirSuffix' },
      },
    } as unknown as ProtocolPreset;
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('UNKNOWN_TRANSFORM');
  });

  // 规则 5：协议存在性
  it('rejects a protocolKey with no registered preset', () => {
    expect(codes(GOOD_SCHEMA, { ...GOOD_META, protocolKey: 'nope@v9' }, undefined))
      .toContain('UNKNOWN_PROTOCOL_KEY');
  });

  // 规则 6：能力交集
  it('rejects operations the preset does not implement', () => {
    const preset: ProtocolPreset = {
      ...doubaoImagesV1,
      endpoints: { generate: doubaoImagesV1.endpoints.generate! },
    };
    expect(codes(GOOD_SCHEMA, GOOD_META, preset)).toContain('OPERATION_NOT_IMPLEMENTED');
  });

  it('rejects edit-capable models whose schema forbids referenceImages', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    delete schema.properties.referenceImages;
    expect(codes(schema, GOOD_META)).toContain('EDIT_NEEDS_REFERENCE_IMAGES');
  });
});

/**
 * 复合绑定（gpt-image）：`size` 不对应任何统一参数，它是 (aspectRatio × resolution)
 * 的函数。这组用例守的是「schema 允许的组合，preset 必须都能映射出来」。
 */
describe('validateModelProtocolConfig — 复合绑定（composeFrom）', () => {
  it('accepts the real gpt-image config: size is composed, aspectRatio/resolution count as bound', () => {
    expect(
      validateModelProtocolConfig({
        paramsSchema: OPENAI_SCHEMA, metadata: OPENAI_META, preset: openaiImagesV1,
      }),
    ).toEqual([]);
  });

  // 规则 8 —— 这条是本次新增的核心守卫
  it('rejects a schema whose aspect × tier combination the valueMap cannot map', () => {
    const schema = structuredClone(OPENAI_SCHEMA);
    // 21:9 在 gpt-image 的查表里不存在：用户能选，但发不出去 —— 参数会被静默丢掉，
    // 上游按自己的默认尺寸出图，用户拿到比例完全不对的图，还按选的档位付了钱。
    schema.properties.aspectRatio.enum = ['1:1', '21:9'];
    const violations = validateModelProtocolConfig({
      paramsSchema: schema, metadata: OPENAI_META, preset: openaiImagesV1,
    });
    const missing = violations.filter((v) => v.code === 'COMPOSED_BINDING_MISSING_COMBO');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.map((v) => v.message).join(' ')).toMatch(/21:9@/);
  });

  it('names every missing combination, not just the first', () => {
    const schema = structuredClone(OPENAI_SCHEMA);
    schema.properties.resolution.enum = ['1K', '8K']; // 8K 整列都查不到
    const messages = validateModelProtocolConfig({
      paramsSchema: schema, metadata: OPENAI_META, preset: openaiImagesV1,
    })
      .filter((v) => v.code === 'COMPOSED_BINDING_MISSING_COMBO')
      .map((v) => v.message)
      .join(' ');
    expect(messages).toMatch(/1:1@8K/);
    expect(messages).toMatch(/16:9@8K/);
  });

  // **部分**源缺失才是 bug：拼不出完整的 key，绑定永远查不到表，size 被静默丢掉，
  // 上游按自己的默认尺寸出图。（全部源都缺席则是惰性绑定，见上面的超集用例。）
  it('rejects a composed binding whose sources are only partially present', () => {
    const schema = structuredClone(OPENAI_SCHEMA);
    delete schema.properties.resolution; // aspectRatio 还在 → 拼不出 "1:1@?"
    const found = validateModelProtocolConfig({
      paramsSchema: schema, metadata: OPENAI_META, preset: openaiImagesV1,
    }).find((v) => v.code === 'BINDING_TARGETS_UNKNOWN_PARAM');
    expect(found?.message).toMatch(/can never be composed/);
  });
});

/**
 * referenceMode 闭合规则：preset.referenceMode 描述了各厂商原生的参考图机制
 * （openaiImagesV1 = edit-multipart，doubaoImagesV1 = generate-json-url，maxImages=14）。
 * 这组用例守的是 referenceMode 与 metadata.operations / paramsSchema.referenceImages 之间
 * 不能悄悄分叉——否则要么运行期才 fail fast，要么参数被静默丢掉。
 */
describe('validateModelProtocolConfig — referenceMode 闭合', () => {
  // (1) edit-multipart preset 允许上传参考图（uploadMax > 0）⟹ operations 必须含 edit
  it('rejects an edit-multipart preset that allows upload but operations lacks "edit"', () => {
    const metadata = { ...OPENAI_META, operations: ['generate'] };
    const violations = validateModelProtocolConfig({
      paramsSchema: OPENAI_SCHEMA, metadata, preset: openaiImagesV1,
    });
    expect(violations.map((v) => v.code)).toContain('EDIT_MULTIPART_NEEDS_EDIT_OP');
  });

  it('accepts an edit-multipart preset that allows upload when operations includes "edit"', () => {
    const metadata = { ...OPENAI_META, operations: ['generate', 'edit'] };
    const violations = validateModelProtocolConfig({
      paramsSchema: OPENAI_SCHEMA, metadata, preset: openaiImagesV1,
    });
    expect(violations.map((v) => v.code)).not.toContain('EDIT_MULTIPART_NEEDS_EDIT_OP');
  });

  // (2) generate-json-url preset ⟹ paramsSchema 必须有 referenceImages 属性
  it('rejects a generate-json-url preset whose paramsSchema has no referenceImages property', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    delete schema.properties.referenceImages;
    const violations = validateModelProtocolConfig({
      paramsSchema: schema, metadata: GOOD_META, preset: doubaoImagesV1,
    });
    expect(violations.map((v) => v.code)).toContain('GENERATE_JSON_URL_NEEDS_REFERENCE_IMAGES');
  });

  it('accepts a generate-json-url preset whose paramsSchema declares referenceImages', () => {
    const violations = validateModelProtocolConfig({
      paramsSchema: GOOD_SCHEMA, metadata: GOOD_META, preset: doubaoImagesV1,
    });
    expect(violations.map((v) => v.code)).not.toContain('GENERATE_JSON_URL_NEEDS_REFERENCE_IMAGES');
  });

  // (3) uploadMax 不得超过 referenceMode.maxImages（doubaoImagesV1.maxImages = 14）
  it('rejects an uploadMax that exceeds referenceMode.maxImages', () => {
    const schema = structuredClone(GOOD_SCHEMA);
    schema.properties.referenceImages['x-ui']!.uploadMax = 15; // > doubao maxImages=14
    const violations = validateModelProtocolConfig({
      paramsSchema: schema, metadata: GOOD_META, preset: doubaoImagesV1,
    });
    expect(violations.map((v) => v.code)).toContain('UPLOAD_MAX_EXCEEDS_MODE_MAX');
  });

  it('accepts an uploadMax within referenceMode.maxImages', () => {
    // GOOD_SCHEMA.referenceImages.x-ui.uploadMax = 10, doubao maxImages = 14 → 10 <= 14
    const violations = validateModelProtocolConfig({
      paramsSchema: GOOD_SCHEMA, metadata: GOOD_META, preset: doubaoImagesV1,
    });
    expect(violations.map((v) => v.code)).not.toContain('UPLOAD_MAX_EXCEEDS_MODE_MAX');
  });
});
