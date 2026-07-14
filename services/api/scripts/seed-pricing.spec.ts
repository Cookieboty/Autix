import { applyParamDefaults, deriveParams, validateParams, validateParamsSchema } from '@autix/domain/pricing';
import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  resolveImagePricingResolution,
  type ImageModelHint,
} from '@autix/domain/image';
import { readImageModelMetadata, supportsImageOperation } from '@autix/domain/model';
import { PROTOCOL_PRESETS, validateModelProtocolConfig } from '@autix/ai-adapters/image';
import { buildImageParamsSchema, type ModelSchemaHint } from './seed-pricing.schemas';
import { SEED_MODELS } from './seed-pricing.models';

// 三个探测 imageModelKind 的固定 hint —— 用 metadata.imageModelKind 显式钉住 kind
// （detectImageModelKind:41 优先读它），而不是靠 model-id 嗅探 —— 后者一旦改了 seed
// 里的 model id 就会静默换成别的 cap。
const GPT_IMAGE: ModelSchemaHint = {
  provider: null,
  model: 'test-gpt-image',
  metadata: { imageModelKind: 'gpt-image' },
};
const GEMINI_3_PRO: ModelSchemaHint = {
  provider: null,
  model: 'test-gemini-3-pro',
  metadata: { imageModelKind: 'gemini-3-pro-image' },
};
const COMPATIBLE: ModelSchemaHint = {
  provider: null,
  model: 'test-compatible',
  metadata: { imageModelKind: 'compatible' },
};

describe('buildImageParamsSchema', () => {
  const schema = buildImageParamsSchema(GPT_IMAGE);

  it('emits a size property carrying the real upstream token', () => {
    // 上游真正要的 size 此前根本不在 schema 里（spec §3）——paramsSchema 一直只描述
    // 「计价用到的那些参数」，而 size 不计价，于是它就漏了。
    expect(schema.properties.size).toBeDefined();
    expect(schema.properties.size.type).toBe('string');
    expect(schema.properties.size.enum!.length).toBeGreaterThan(0);
  });

  it('size is the user-facing control: size-grid, with a default, and required', () => {
    const geminiSchema = buildImageParamsSchema(GEMINI_3_PRO);
    const ui = geminiSchema.properties.size['x-ui']!;
    expect(ui.role).toBe('wire');
    expect(ui.control).toBe('size-grid'); // 第 1 期是 'hidden'
    expect(ui.groupBy).toBe('tier');
    expect(geminiSchema.properties.size.default).toBeDefined(); // 第 1 期是 undefined
    expect(geminiSchema.required).toContain('size'); // 第 1 期不在 required
  });

  it('resolution is derived from size and never rendered', () => {
    const geminiSchema = buildImageParamsSchema(GEMINI_3_PRO);
    const ui = geminiSchema.properties.resolution['x-ui']!;
    expect(ui.role).toBe('derived'); // 第 1 期是 'pricing'
    expect(ui.control).toBe('hidden'); // 第 1 期是 'chips'
    expect(ui.derivedFrom).toEqual({ param: 'size', via: 'imagePricingResolution' });
    // derive 在 validate 之前跑（spec §6.2），所以 required 里保留 resolution 是自洽的
    expect(geminiSchema.required).toContain('resolution');
  });

  it('size.optionLabels covers every enum token with the capability\'s human labels', () => {
    // 覆盖 size-grid 的显示层：optionLabels 缺失或只覆盖部分 enum 时，SchemaForm
    // 会把没映射到的 token 原样显示成裸 'WxH@tier' 字符串（silent degradation）。
    // 用 IMAGE_MODEL_CAPABILITIES 里真实的 cap.sizes 反推期望值，而不是重新调用
    // buildImageParamsSchema 内部同样的映射逻辑，否则这个断言测的只是"自己等于自己"。
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const modelSchema = buildImageParamsSchema(model);
      const kind = detectImageModelKind({
        provider: model.provider,
        model: model.model,
        metadata: model.metadata as ImageModelHint['metadata'],
      });
      const cap = IMAGE_MODEL_CAPABILITIES[kind];
      const expectedLabels = Object.fromEntries(cap.sizes.map((size) => [size.value, size.label]));
      const ui = modelSchema.properties.size['x-ui']!;

      expect(ui.optionLabels).toEqual(expectedLabels);
      for (const token of modelSchema.properties.size.enum ?? []) {
        expect(ui.optionLabels?.[String(token)]).toBe(expectedLabels[String(token)]);
      }
    }
  });

  it('every size enum token parses to a pricing tier (spec §7.2 规则 7)', () => {
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const modelSchema = buildImageParamsSchema(model);
      for (const token of modelSchema.properties.size?.enum ?? []) {
        expect(resolveImagePricingResolution(String(token))).toBeDefined();
      }
    }
  });

  it('marks quality as both and referenceImages as pricing', () => {
    expect(schema.properties.quality['x-ui']!.role).toBe('both');
    expect(schema.properties.referenceImages['x-ui']!.role).toBe('pricing');
  });

  // referenceImages 的值是「实际上传张数」，且被 ajv 校验（validateParams,
  // strict: true）；这份 paramsSchema 是 chat / canvas / 公开生成器共享的同一份
  // image_generation 任务 schema。canvas 的参考图选择没有上游数量上限，若这里设了
  // JSON-Schema 的 maximum，canvas 里合法的 9+ 张组合参考图会在 hold 时被 ajv 400。
  // 上传上限因此只能活在 x-ui.uploadMax（ajv 对 x-ui 整体 valid: true，零校验），
  // 供公开生成器的 getImageReferenceUploadLimit 读。
  it('does NOT set referenceImages.maximum, but does cap x-ui.uploadMax by reference-image support', () => {
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const modelSchema = buildImageParamsSchema(model);
      const kind = detectImageModelKind({
        provider: model.provider,
        model: model.model,
        metadata: model.metadata as ImageModelHint['metadata'],
      });
      const cap = IMAGE_MODEL_CAPABILITIES[kind];
      expect(modelSchema.properties.referenceImages.maximum).toBeUndefined();
      expect(modelSchema.properties.referenceImages['x-ui']?.uploadMax).toBe(
        cap.supportsReferenceImage ? 8 : 0,
      );
    }
  });

  // 回归守卫（本次修复的核心）：canvas 的参考图选择没有上游数量上限，一次 hold 可能
  // 携带 12 张组合参考图（source + reference）。如果 referenceImages 设了 ajv 的
  // maximum，这个对象会被 validateParams 判 400——这正是 Task 11 的 Critical bug。
  // 这里直接对种子 schema 跑 validateParams，确保它必须放行。
  it('validateParams passes a referenceImages count far above the old upload cap (canvas has no upstream limit)', () => {
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const modelSchema = buildImageParamsSchema(model);
      const withDefaults = applyParamDefaults(modelSchema, { referenceImages: 12 });
      const derived = deriveParams(modelSchema, withDefaults);
      expect(validateParams(modelSchema, derived)).toEqual([]);
    }
  });

  it('passes its own structural validator', () => {
    // 新标的 role 必须通过 Task 1 的白名单校验。
    expect(validateParamsSchema(schema)).toEqual([]);
  });

  // 变异测试：翻转后，applyParamDefaults → deriveParams → validateParams 必须自洽
  it('defaults + derive together satisfy required — a caller sending nothing still validates', () => {
    const geminiSchema = buildImageParamsSchema(GEMINI_3_PRO);
    const withDefaults = applyParamDefaults(geminiSchema, {});
    const derived = deriveParams(geminiSchema, withDefaults);
    expect(derived.resolution).toBeDefined();
    expect(validateParams(geminiSchema, derived)).toEqual([]);
  });

  // 变异测试：前端传一个便宜的 resolution，必须被 size 派生覆盖（堵住 spec §6.3 的洞）
  it('a client-sent cheap resolution is overwritten by the one derived from size', () => {
    const geminiSchema = buildImageParamsSchema(GEMINI_3_PRO);
    const params = deriveParams(geminiSchema, { size: '2048x2048@2K', resolution: '1K', quality: 'high' });
    expect(params.resolution).toBe('2K');
  });
});

// Task 8：SEED_MODELS 的每个 image 行必须显式声明 protocolKey / operations / limits——
// preset 路由（Task 9）读的就是它们，第 1 期只落了读取 helper，没有任何 seed 写这三个字段。
describe('SEED_MODELS image metadata (protocolKey / operations / limits)', () => {
  const imageRows = SEED_MODELS.filter((m) => m.capabilities.includes('image'));

  it('seeds protocolKey / operations / limits on every image model', () => {
    for (const row of imageRows) {
      const meta = readImageModelMetadata(row.metadata);
      expect(meta.protocolKey).toBe('openai-images@v1');
      expect(meta.operations?.length).toBeGreaterThan(0);
      expect(meta.limits?.maxCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('seeded metadata + seeded schema pass the cross-config validator (spec §7.2)', () => {
    for (const row of imageRows) {
      const schema = buildImageParamsSchema(row);
      const preset = PROTOCOL_PRESETS[readImageModelMetadata(row.metadata).protocolKey!];
      const violations = validateModelProtocolConfig({ paramsSchema: schema, metadata: row.metadata, preset });
      expect(violations).toEqual([]); // ← 构建期校验（spec §7.2：CI 对所有 preset × 所有 seed 模型跑一次）
    }
  });

  it('declares edit only for models whose capability actually supports source images', () => {
    for (const row of imageRows) {
      const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(row as ImageModelHint)];
      expect(supportsImageOperation(row.metadata, 'edit')).toBe(cap.supportsSourceImage);
    }
  });

  it('limits.maxCount matches the capability table (spec: 第 3 期会删掉能力表，metadata 现在必须与它一致)', () => {
    for (const row of imageRows) {
      const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(row as ImageModelHint)];
      expect(readImageModelMetadata(row.metadata).limits?.maxCount).toBe(cap.maxCount);
    }
  });
});

// Task 8 stub-property discrimination: seed / negativePrompt / quality stubs must not have defaults
// to prevent silent production regressions when applyParamDefaults fills them and wire projection
// starts leaking them into upstream bodies.
describe('stub properties must not have defaults', () => {
  it('seed stub has no default, is not required, is wire+hidden', () => {
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const schema = buildImageParamsSchema(model);
      expect(schema.properties.seed).toBeDefined();
      expect(schema.properties.seed.type).toBe('integer');
      expect(schema.properties.seed['x-ui']?.role).toBe('wire');
      expect(schema.properties.seed['x-ui']?.control).toBe('hidden');
      expect(schema.properties.seed.default).toBeUndefined();
      expect(schema.required).not.toContain('seed');
    }
  });

  it('negativePrompt stub has no default, is not required, is wire+hidden', () => {
    // negativePrompt is only present when cap.supportsNegativePrompt !== 'none'
    for (const model of [GPT_IMAGE, GEMINI_3_PRO, COMPATIBLE]) {
      const schema = buildImageParamsSchema(model);
      const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind({
        provider: model.provider,
        model: model.model,
        metadata: model.metadata as ImageModelHint['metadata'],
      })];
      if (cap.supportsNegativePrompt !== 'none') {
        expect(schema.properties.negativePrompt).toBeDefined();
        expect(schema.properties.negativePrompt.type).toBe('string');
        expect(schema.properties.negativePrompt['x-ui']?.role).toBe('wire');
        expect(schema.properties.negativePrompt['x-ui']?.control).toBe('hidden');
        expect(schema.properties.negativePrompt.default).toBeUndefined();
        expect(schema.required).not.toContain('negativePrompt');
      }
    }
  });

  it('quality stub (for models with no quality axis) has no default, is not required, is wire+hidden', () => {
    // Test gemini models which have no quality axis
    const geminiSchema = buildImageParamsSchema(GEMINI_3_PRO);
    const geminCap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind({
      provider: GEMINI_3_PRO.provider,
      model: GEMINI_3_PRO.model,
      metadata: GEMINI_3_PRO.metadata as ImageModelHint['metadata'],
    })];
    expect(geminCap.qualities.length).toBe(0); // Confirm no quality axis
    expect(geminiSchema.properties.quality).toBeDefined();
    expect(geminiSchema.properties.quality['x-ui']?.role).toBe('wire');
    expect(geminiSchema.properties.quality['x-ui']?.control).toBe('hidden');
    expect(geminiSchema.properties.quality.default).toBeUndefined();
    expect(geminiSchema.required).not.toContain('quality');
  });

  it('quality is the real priced control (role: both) for models with quality axis', () => {
    // gpt-image has quality axis
    const schema = buildImageParamsSchema(GPT_IMAGE);
    const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind({
      provider: GPT_IMAGE.provider,
      model: GPT_IMAGE.model,
      metadata: GPT_IMAGE.metadata as ImageModelHint['metadata'],
    })];
    expect(cap.qualities.length).toBeGreaterThan(0); // Confirm has quality axis
    expect(schema.properties.quality).toBeDefined();
    expect(schema.properties.quality['x-ui']?.role).toBe('both');
    expect(schema.properties.quality['x-ui']?.control).toBe('chips');
    expect(schema.properties.quality.default).toBeDefined();
    expect(schema.properties.quality.enum).toBeDefined();
    expect(schema.required).toContain('quality');
  });
});
