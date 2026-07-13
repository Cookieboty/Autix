import { resolveImagePricingResolution } from '@autix/domain/image';
import { validateParamsSchema } from '@autix/domain/pricing';
import { buildImageParamsSchema } from './seed-pricing.schemas';

describe('buildImageParamsSchema', () => {
  // 用 metadata.imageModelKind 显式钉住 kind（detectImageModelKind:41 优先读它），
  // 而不是靠 model-id 嗅探 —— 后者一旦改了 seed 里的 model id 就会静默换成别的 cap。
  const schema = buildImageParamsSchema({
    provider: null,
    model: 'test-image-model',
    metadata: { imageModelKind: 'gpt-image' },
  });

  it('emits a size property carrying the real upstream token', () => {
    // 上游真正要的 size 此前根本不在 schema 里（spec §3）——paramsSchema 一直只描述
    // 「计价用到的那些参数」，而 size 不计价，于是它就漏了。
    expect(schema.properties.size).toBeDefined();
    expect(schema.properties.size.type).toBe('string');
    expect(schema.properties.size.enum!.length).toBeGreaterThan(0);
  });

  it('marks size as wire + hidden — 表单外观不变', () => {
    // SchemaForm 跳过 control:'hidden'，所以加了这个属性也不会多出一个控件。
    expect(schema.properties.size['x-ui']!.role).toBe('wire');
    expect(schema.properties.size['x-ui']!.control).toBe('hidden');
  });

  it('gives size NO default and does not make it required — 行为中性的关键', () => {
    // 配了 default，applyParamDefaults 就会填上它；进了 required，今天不发 size 的
    // 调用方（4 个前端 quote 点都只发 resolution）会立刻 400。两者都是回归。
    expect('default' in schema.properties.size).toBe(false);
    expect(schema.required ?? []).not.toContain('size');
  });

  it('every size enum token is parseable as a pricing tier (spec §7.2 规则 7)', () => {
    // 防裸 WxH 与 WxH@tier 混用时静默落到默认档：枚举里的**每一个** token 都必须
    // 能被 imagePricingResolution 解析出档位，不是「大多数」。
    for (const token of schema.properties.size.enum!) {
      expect(resolveImagePricingResolution(String(token))).toBeDefined();
    }
  });

  it('keeps resolution a visible, required chips control (方案 A：第 1 期不翻转方向)', () => {
    // resolution 是工作台上用户在点的「分辨率」档位选择器（SchemaForm 渲染它）。
    // 把它改成 derived+hidden 会让一个真实控件消失 —— 那是第 2 期随 size-grid 一起做的事。
    expect(schema.properties.resolution['x-ui']!.control).toBe('chips');
    expect(schema.properties.resolution['x-ui']!.role).toBe('pricing');
    expect(schema.required ?? []).toContain('resolution');
  });

  it('marks quality as both and referenceImages as pricing', () => {
    expect(schema.properties.quality['x-ui']!.role).toBe('both');
    expect(schema.properties.referenceImages['x-ui']!.role).toBe('pricing');
  });

  it('passes its own structural validator', () => {
    // 新标的 role 必须通过 Task 1 的白名单校验。
    expect(validateParamsSchema(schema)).toEqual([]);
  });
});
