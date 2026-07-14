import { applyParamDefaults, deriveParams, validateParams, validateParamsSchema } from '@autix/domain/pricing';
import { resolveImagePricingResolution } from '@autix/domain/image';
import { buildImageParamsSchema, type ModelSchemaHint } from './seed-pricing.schemas';

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
